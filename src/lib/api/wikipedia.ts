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

export type WikipediaPageContent = {
  title: string;
  text: string;
  redirectFragment?: string;
};

type ParseResponse =
  | {
      parse: {
        title: string;
        text: { "*": string };
        redirects?: { from: string; to: string; tofragment?: string }[];
      };
    }
  | { error: { code: string; info: string } };

type RequestOptions = {
  fetch?: typeof fetch;
  signal?: AbortSignal;
};

export function getWikipediaArticleUrl(title: string): string {
  return `${WIKIPEDIA_ORIGIN}/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

async function requestJson<T>(url: URL, { fetch: fetcher = fetch, signal }: RequestOptions): Promise<T> {
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
    prop: "text",
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
  };
}

function normalizeProtocol(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}
