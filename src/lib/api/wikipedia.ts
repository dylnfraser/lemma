export const WIKIPEDIA_ORIGIN = "https://en.wikipedia.org";

// Wikimedia asks API clients to identify themselves:
// https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy
const API_USER_AGENT = "Lemma/0.1 (https://github.com/dylnfraser/lemma)";
const REQUEST_TIMEOUT_MS = 15_000;
const SEARCH_LIMIT = 5;

export type WikipediaErrorKind = "not_found" | "offline" | "timeout" | "http" | "invalid";

export class WikipediaError extends Error {
  constructor(
    readonly kind: WikipediaErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "WikipediaError";
  }
}

export type WikipediaSearchResult = {
  title: string;
  description: string;
  thumbnail: string;
};

type QuickSearchResponse = {
  pages?: {
    title: string;
    description?: string | null;
    thumbnail?: { url?: string } | null;
  }[];
};

export type ArticleLanguage = {
  /** Language code ("fr"). */
  code: string;
  /** English name ("French"). */
  name: string;
  /** The language's own name ("français"). */
  autonym: string;
  /** The article's title in that language. */
  title: string;
  url: string;
};

export type WikipediaPageContent = {
  title: string;
  text: string;
  redirectFragment?: string;
  /** The title the reader asked for, when a redirect led here. */
  redirectedFrom?: string;
  languages?: ArticleLanguage[];
  /** Reader-facing categories (Wikipedia's hidden maintenance categories are left out), with spaces in their names. */
  categories?: string[];
};

type ParseResponse =
  | {
      parse: {
        title: string;
        text: { "*": string };
        redirects?: { from: string; to: string; tofragment?: string }[];
        langlinks?: { lang: string; url: string; langname?: string; autonym?: string; "*": string }[];
        categories?: { "*": string; hidden?: string }[];
      };
    }
  | { error: { code: string; info: string } };

export type RequestOptions = {
  fetch?: typeof fetch;
  signal?: AbortSignal;
};

export function getWikipediaArticleUrl(title: string): string {
  return `${WIKIPEDIA_ORIGIN}/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

/** Shared GET helper for Wikipedia APIs: identifies Lemma, times out, and maps failures to WikipediaError. */
export async function requestJson<T>(url: URL, { fetch: fetcher = fetch, signal }: RequestOptions): Promise<T> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let res: Response;

  try {
    res = await fetcher(url, {
      headers: { "Api-User-Agent": API_USER_AGENT },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted) throw new WikipediaError("timeout", "Wikipedia took too long to respond.");
    throw new WikipediaError("offline", "Couldn't reach Wikipedia. Check your connection.");
  }

  if (res.status === 404) throw new WikipediaError("not_found", "This article doesn't exist.", 404);
  if (!res.ok) throw new WikipediaError("http", `Wikipedia returned an error (${res.status}).`, res.status);

  try {
    return (await res.json()) as T;
  } catch {
    throw new WikipediaError("invalid", "Wikipedia sent a response Lemma couldn't read.");
  }
}

export async function searchArticles(query: string, options: RequestOptions = {}): Promise<WikipediaSearchResult[]> {
  const url = new URL("/w/rest.php/v1/search/title", WIKIPEDIA_ORIGIN);
  url.search = new URLSearchParams({ q: query, limit: String(SEARCH_LIMIT) }).toString();

  const json = await requestJson<QuickSearchResponse>(url, options);

  return (json.pages ?? []).map((page) => ({
    title: page.title,
    description: page.description ?? "",
    thumbnail: normalizeProtocol(page.thumbnail?.url ?? ""),
  }));
}

export async function fetchArticle(title: string, options: RequestOptions = {}): Promise<WikipediaPageContent> {
  const url = new URL("/w/api.php", WIKIPEDIA_ORIGIN);
  url.search = new URLSearchParams({
    action: "parse",
    page: title,
    prop: "text|langlinks|categories",
    redirects: "1",
    format: "json",
    origin: "*",
  }).toString();

  const json = await requestJson<ParseResponse>(url, options);

  if ("error" in json) {
    if (json.error.code === "missingtitle" || json.error.code === "invalidtitle") {
      throw new WikipediaError("not_found", "This article doesn't exist.", 404);
    }
    throw new WikipediaError("http", json.error.info);
  }

  if (typeof json.parse?.text?.["*"] !== "string") {
    throw new WikipediaError("invalid", "Wikipedia sent a response Lemma couldn't read.");
  }

  return {
    title: json.parse.title,
    text: json.parse.text["*"],
    redirectFragment: json.parse.redirects?.at(-1)?.tofragment,
    redirectedFrom: json.parse.redirects?.[0]?.from,
    languages: (json.parse.langlinks ?? []).map((link) => ({
      code: link.lang,
      name: link.langname ?? link.lang,
      autonym: link.autonym ?? link.langname ?? link.lang,
      title: link["*"],
      url: link.url,
    })),
    categories: (json.parse.categories ?? []).filter((category) => !("hidden" in category)).map((category) => category["*"].replaceAll("_", " ")),
  };
}

export type RelatedArticle = {
  title: string;
  description: string;
  thumbnail: string;
};

type RelatedResponse = {
  query?: { pages?: { title: string; index?: number; description?: string; thumbnail?: { source?: string } }[] };
};

/** Articles like this one, by Wikipedia's search ("morelike:"), best match first. */
export async function fetchRelatedArticles(title: string, options: RequestOptions = {}): Promise<RelatedArticle[]> {
  const url = new URL("/w/api.php", WIKIPEDIA_ORIGIN);
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `morelike:${title}`,
    gsrnamespace: "0",
    gsrlimit: "6",
    prop: "pageimages|description",
    piprop: "thumbnail",
    pithumbsize: "240",
    pilimit: "6",
    pilicense: "any",
    format: "json",
    formatversion: "2",
    origin: "*",
  }).toString();

  const json = await requestJson<RelatedResponse>(url, options);
  return (json.query?.pages ?? [])
    .toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((page) => ({
      title: page.title,
      description: page.description ?? "",
      thumbnail: normalizeProtocol(page.thumbnail?.source ?? ""),
    }));
}

type RevisionsResponse = {
  query?: { pages?: { revisions?: { timestamp?: string }[] }[] };
};

/**
 * When the article was last edited, for the attribution footer. The parse API doesn't report it, so this is a separate,
 * best-effort request: any failure (including a caller abort) resolves to null rather than throwing.
 */
export async function fetchLastEdited(title: string, options: RequestOptions = {}): Promise<Date | null> {
  const url = new URL("/w/api.php", WIKIPEDIA_ORIGIN);
  url.search = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "timestamp",
    titles: title,
    redirects: "1",
    format: "json",
    formatversion: "2",
    origin: "*",
  }).toString();

  try {
    const json = await requestJson<RevisionsResponse>(url, options);
    const timestamp = json.query?.pages?.[0]?.revisions?.[0]?.timestamp;
    const date = timestamp ? new Date(timestamp) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

/** Where a reader can see an article's contributors, as CC BY-SA attribution asks. */
export function getWikipediaHistoryUrl(title: string): string {
  const url = new URL("/w/index.php", WIKIPEDIA_ORIGIN);
  url.search = new URLSearchParams({ title: title.replaceAll(" ", "_"), action: "history" }).toString();
  return url.href;
}

export type ImageCredit = {
  /** Plain-text author ("Jane Doe", "Unknown author"), or an empty string. */
  artist: string;
  /** Short license name ("CC BY-SA 4.0", "Public domain"), or an empty string. */
  license: string;
  /** An http(s) link to the license, or an empty string. */
  licenseUrl: string;
};

type ImageInfoResponse = {
  query?: { pages?: { imageinfo?: { extmetadata?: Record<string, { value?: unknown } | undefined> }[] }[] };
};

/** Commons metadata values are HTML ("<a href=…>Jane Doe</a>"); only their text is shown. */
function metadataText(value: unknown): string {
  if (typeof value !== "string") return "";
  // DOMParser documents are inert, so reading text from untrusted HTML this way runs nothing.
  return new DOMParser().parseFromString(value, "text/html").body.textContent?.replaceAll(/\s+/g, " ").trim() ?? "";
}

/**
 * Who made an image and under which license, for the viewer's credit line. Best-effort like `fetchLastEdited`: any
 * failure resolves to null.
 */
export async function fetchImageCredit(fileName: string, options: RequestOptions = {}): Promise<ImageCredit | null> {
  const url = new URL("/w/api.php", WIKIPEDIA_ORIGIN);
  url.search = new URLSearchParams({
    action: "query",
    prop: "imageinfo",
    iiprop: "extmetadata",
    iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl",
    titles: `File:${fileName}`,
    format: "json",
    formatversion: "2",
    origin: "*",
  }).toString();

  try {
    const json = await requestJson<ImageInfoResponse>(url, options);
    const metadata = json.query?.pages?.[0]?.imageinfo?.[0]?.extmetadata;
    if (!metadata) return null;

    const licenseUrl = normalizeProtocol(metadataText(metadata.LicenseUrl?.value));
    return {
      artist: metadataText(metadata.Artist?.value),
      license: metadataText(metadata.LicenseShortName?.value),
      licenseUrl: /^https?:\/\//.test(licenseUrl) ? licenseUrl : "",
    };
  } catch {
    return null;
  }
}

export type ArticleSummary = {
  /** Resolved title (redirects are followed). */
  title: string;
  description: string;
  /** Plain-text opening of the article. */
  extract: string;
  thumbnail: { src: string; width: number; height: number } | null;
  /** Disambiguation pages list meanings rather than summarise a topic. */
  disambiguation: boolean;
};

type SummaryResponse = {
  type?: string;
  title?: string;
  titles?: { normalized?: string };
  description?: string;
  extract?: string;
  thumbnail?: { source?: string; width?: number; height?: number };
};

/** The short summary Wikipedia uses for its own link previews. Follows redirects. */
export async function fetchSummary(title: string, options: RequestOptions = {}): Promise<ArticleSummary> {
  const url = new URL(`/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}`, WIKIPEDIA_ORIGIN);
  const json = await requestJson<SummaryResponse>(url, options);

  const resolvedTitle = json.titles?.normalized ?? json.title;
  if (!resolvedTitle) throw new WikipediaError("invalid", "Wikipedia sent a response Lemma couldn't read.");

  const thumbnail = json.thumbnail;
  return {
    title: resolvedTitle,
    description: json.description ?? "",
    extract: json.extract ?? "",
    thumbnail:
      thumbnail?.source && thumbnail.width && thumbnail.height
        ? { src: normalizeProtocol(thumbnail.source), width: thumbnail.width, height: thumbnail.height }
        : null,
    disambiguation: json.type === "disambiguation",
  };
}

export function normalizeProtocol(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}
