import { normalizeProtocol, requestJson, WIKIPEDIA_ORIGIN, type RequestOptions } from "./wikipedia";

export const FULL_SEARCH_PAGE_SIZE = 20;

export type FullTextResult = {
  title: string;
  /** Safe HTML: escaped text with the matched words wrapped in <mark>. */
  snippet: string;
  wordCount: number;
};

export type FullTextSearch = {
  results: FullTextResult[];
  total: number;
  /** Wikipedia's spelling suggestion ("Did you mean …"), or an empty string. */
  suggestion: string;
  /** Offset for the next page, or null when there are no more results. */
  nextOffset: number | null;
};

type SearchResponse = {
  query?: {
    searchinfo?: { totalhits?: number; suggestion?: string };
    search?: { title: string; snippet?: string; wordcount?: number }[];
  };
  continue?: { sroffset?: number };
};

export type PageCard = { description: string; thumbnail: string };

type PageCardsResponse = {
  query?: {
    pages?: { title: string; description?: string; thumbnail?: { source?: string } }[];
  };
};

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/**
 * Search snippets are HTML with matches wrapped in `<span class="searchmatch">`. Rebuild them from text only: every
 * other tag is dropped and all text escaped, so the result is safe to render with {@html}.
 */
export function snippetToHtml(snippet: string): string {
  const doc = new DOMParser().parseFromString(`<body>${snippet}</body>`, "text/html");
  let html = "";
  const walk = (node: Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) html += escapeHtml(child.textContent ?? "");
      else if (child instanceof Element && child.classList.contains("searchmatch")) {
        html += `<mark>${escapeHtml(child.textContent ?? "")}</mark>`;
      } else walk(child);
    }
  };
  walk(doc.body);
  return html.replaceAll(/\s+/g, " ").trim();
}

/** Full-text search across article text (namespace 0), with Wikipedia's spelling suggestion. */
export async function searchFullText(
  query: string,
  { offset = 0, limit = FULL_SEARCH_PAGE_SIZE, ...options }: RequestOptions & { offset?: number; limit?: number } = {},
): Promise<FullTextSearch> {
  const url = new URL("/w/api.php", WIKIPEDIA_ORIGIN);
  url.search = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srnamespace: "0",
    srlimit: String(limit),
    sroffset: String(offset),
    srinfo: "totalhits|suggestion",
    srprop: "snippet|wordcount",
    format: "json",
    origin: "*",
  }).toString();

  const json = await requestJson<SearchResponse>(url, options);
  const search = json.query?.search ?? [];

  return {
    results: search.map((item) => ({
      title: item.title,
      snippet: snippetToHtml(item.snippet ?? ""),
      wordCount: item.wordcount ?? 0,
    })),
    total: json.query?.searchinfo?.totalhits ?? search.length,
    suggestion: json.query?.searchinfo?.suggestion ?? "",
    nextOffset: json.continue?.sroffset ?? null,
  };
}

/** Short descriptions and thumbnails for a batch of titles (up to 50), keyed by title. Missing pages are skipped. */
export async function fetchPageCards(titles: string[], options: RequestOptions = {}): Promise<Map<string, PageCard>> {
  const cards = new Map<string, PageCard>();
  if (titles.length === 0) return cards;

  const url = new URL("/w/api.php", WIKIPEDIA_ORIGIN);
  url.search = new URLSearchParams({
    action: "query",
    titles: titles.join("|"),
    prop: "pageimages|description",
    piprop: "thumbnail",
    pithumbsize: "160",
    pilimit: String(titles.length),
    format: "json",
    formatversion: "2",
    origin: "*",
  }).toString();

  const json = await requestJson<PageCardsResponse>(url, options);
  for (const page of json.query?.pages ?? []) {
    cards.set(page.title, {
      description: page.description ?? "",
      thumbnail: normalizeProtocol(page.thumbnail?.source ?? ""),
    });
  }
  return cards;
}

export function getSearchPath(query: string): string {
  return `/search?q=${encodeURIComponent(query.trim())}`;
}
