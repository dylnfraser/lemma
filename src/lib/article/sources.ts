/**
 * What kind of source each reference is (academic, news, book, government or other website), for the labels in the
 * reference list and the article's source mix. Worked out from the citation template Wikipedia used (`cite.citation`
 * carries its type as a class: journal, news, book, web…) and from where its links point.
 */

export type SourceKind = "academic" | "news" | "book" | "government" | "web";
export const SOURCE_KINDS: readonly SourceKind[] = ["academic", "book", "news", "government", "web"];
export type SourceMix = Record<SourceKind, number>;

export const SOURCE_LABELS: Record<SourceKind, string> = {
  academic: "Academic",
  news: "News",
  book: "Book",
  government: "Government",
  web: "Website",
};

const ACADEMIC_TYPES = new Set(["journal", "conference", "thesis", "arxiv", "biorxiv", "medrxiv", "ssrn", "citeseerx"]);
const BOOK_TYPES = new Set(["book", "encyclopaedia"]);
const NEWS_TYPES = new Set(["news", "magazine", "newspaper"]);

// publishers and indexes of scholarly work, and universities
const ACADEMIC_HOSTS = [
  "doi.org", "jstor.org", "ncbi.nlm.nih.gov", "pubmed.gov", "arxiv.org", "biorxiv.org", "medrxiv.org", "ssrn.com",
  "sciencedirect.com", "springer.com", "wiley.com", "nature.com", "science.org", "tandfonline.com", "cambridge.org",
  "academic.oup.com", "semanticscholar.org", "plos.org", "frontiersin.org", "mdpi.com", "ieee.org", "acm.org",
  "sagepub.com", "bmj.com", "thelancet.com", "nejm.org", "cell.com", "pnas.org", "handle.net", "aps.org", "iop.org",
  "acs.org", "rsc.org", "annualreviews.org", "muse.jhu.edu", "scielo.org", "hathitrust.org",
];
const NEWS_HOSTS = [
  "nytimes.com", "washingtonpost.com", "theguardian.com", "bbc.co.uk", "bbc.com", "reuters.com", "apnews.com", "cnn.com",
  "nbcnews.com", "cbsnews.com", "abcnews.go.com", "npr.org", "wsj.com", "ft.com", "bloomberg.com", "economist.com",
  "latimes.com", "usatoday.com", "independent.co.uk", "telegraph.co.uk", "aljazeera.com", "time.com", "newsweek.com",
  "politico.com", "politico.eu", "axios.com", "theatlantic.com", "newyorker.com", "foxnews.com", "huffpost.com",
  "thehill.com", "vox.com", "cbc.ca", "abc.net.au", "smh.com.au", "thetimes.co.uk", "thetimes.com", "dailymail.co.uk",
  "scmp.com", "japantimes.co.jp", "hindustantimes.com", "indiatimes.com", "thehindu.com", "dw.com", "france24.com",
  "lemonde.fr", "spiegel.de", "nypost.com", "chicagotribune.com", "bostonglobe.com", "sfchronicle.com", "variety.com",
  "hollywoodreporter.com", "rollingstone.com", "billboard.com", "espn.com", "skysports.com", "theverge.com",
  "wired.com", "arstechnica.com", "techcrunch.com", "nationalgeographic.com", "smithsonianmag.com", "irishtimes.com",
  "straitstimes.com", "theglobeandmail.com", "nzherald.co.nz", "news.sky.com", "euronews.com", "cnbc.com",
];
const GOVERNMENT_HOST = /\.(gov|mil)$|(^|\.)gov\.[a-z]{2}$|(^|\.)gob\.[a-z]{2}$|\.go\.(jp|kr|id|th)$|\.gc\.ca$|\.gouv\.fr$|\.europa\.eu$|\.nic\.in$/;
const GOVERNMENT_HOSTS = ["un.org", "who.int", "worldbank.org", "imf.org", "oecd.org", "census.gov", "nasa.gov"];
const ACADEMIC_HOST = /\.edu$|\.ac\.[a-z]{2}$|\.edu\.[a-z]{2}$/;

/** Whether `host` is `domain` or one of its subdomains. */
const within = (host: string, domains: string[]) => domains.some((domain) => host === domain || host.endsWith(`.${domain}`));

/** The sites a reference links to (not Wikipedia's own pages). */
function linkedHosts(scope: Element): string[] {
  const hosts: string[] = [];
  for (const link of scope.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href")!;
    if (!/^(https?:)?\/\//.test(href)) continue;
    try {
      const host = new URL(href, "https://en.wikipedia.org").hostname.replace(/^www\./, "");
      if (!/(^|\.)(wikipedia|wikimedia|wikidata|wiktionary|wikisource)\.org$/.test(host)) hosts.push(host);
    } catch {
      // a malformed link says nothing about the source
    }
  }
  return hosts;
}

/** The full citation behind a short footnote ("Smith 2001, p. 5" links to Smith 2001 in the bibliography). */
function citedWork(item: Element): Element | null {
  const link = item.querySelector<HTMLAnchorElement>('a[href^="#CITEREF"]');
  if (!link) return null;
  let id = link.getAttribute("href")!.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep it as written
  }
  const target = item.ownerDocument.getElementById(id);
  return target ? (target.closest("li") ?? target) : null;
}

/** What kind of source a reference is, or null for an explanatory note that cites nothing. */
export function classifySource(item: Element): SourceKind | null {
  const work = item.querySelector(".citation") ? item : (citedWork(item) ?? item);
  const types = [...(work.querySelector("cite.citation, .citation")?.classList ?? [])];
  const hosts = linkedHosts(work);
  const has = (kinds: Set<string>) => types.some((type) => kinds.has(type));

  if (has(ACADEMIC_TYPES) || hosts.some((host) => within(host, ACADEMIC_HOSTS) || ACADEMIC_HOST.test(host))) return "academic";
  if (has(BOOK_TYPES)) return "book";
  if (has(NEWS_TYPES) || hosts.some((host) => within(host, NEWS_HOSTS))) return "news";
  if (hosts.some((host) => GOVERNMENT_HOST.test(host) || within(host, GOVERNMENT_HOSTS))) return "government";
  // a book cited without the template still has its ISBN
  if (work.querySelector('a[href*="Special:BookSources"]')) return "book";
  if (types.includes("citation") || hosts.length > 0) return "web";
  return null;
}

export const emptySourceMix = (): SourceMix => ({ academic: 0, news: 0, book: 0, government: 0, web: 0 });

/**
 * Labels a reference: `data-source` on its list item, and a tag naming the kind at the start of its text (the same
 * place in every entry, so the tags read as a column; and part of the reference wherever it's shown, as in previews).
 */
function label(item: HTMLElement, kind: SourceKind) {
  item.dataset.source = kind;
  const tag = item.ownerDocument.createElement("span");
  tag.className = `source-tag ${kind}`;
  tag.textContent = SOURCE_LABELS[kind];
  const text = item.querySelector(":scope > .reference-text") ?? item;
  text.prepend(tag, " ");
}

/**
 * Labels every reference in the footnote lists (and every work in a bibliography: the citations in other lists that
 * `isSource` accepts), and counts the footnotes' sources. Bibliography entries are labelled but not counted: the
 * footnotes citing them already are.
 */
export function markSources(root: HTMLElement, isSource: (item: Element) => boolean = () => true): SourceMix {
  const mix = emptySourceMix();
  for (const item of root.querySelectorAll<HTMLElement>("ol.references > li")) {
    const kind = classifySource(item);
    if (!kind) continue;
    label(item, kind);
    mix[kind]++;
  }
  for (const citation of root.querySelectorAll("li > cite.citation, li > .citation")) {
    const item = citation.parentElement!;
    if (item.parentElement?.matches("ol.references") || item.dataset.source || !isSource(item)) continue;
    const kind = classifySource(item);
    if (kind) label(item, kind);
  }
  return mix;
}

export const totalSources = (mix: SourceMix) => SOURCE_KINDS.reduce((sum, kind) => sum + mix[kind], 0);

/** A share as a whole percentage ("<1%" rather than a misleading "0%"). */
export function percentOf(count: number, total: number): string {
  const percent = (count / total) * 100;
  return percent > 0 && percent < 1 ? "<1%" : `${Math.round(percent)}%`;
}
