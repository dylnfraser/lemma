import { WIKIPEDIA_ORIGIN } from "$lib/api/wikipedia";
import { getArticlePath, getCategoryPath, getFilePath, safeDecodeURIComponent } from "./articleUtils";

// Pages in these namespaces aren't articles, so Lemma sends readers to Wikipedia for them.
const NON_ARTICLE_NAMESPACE =
  /^(?:Special|Media|Talk|User|Wikipedia|WP|Project|File|Image|MediaWiki|Template|Help|Category|Portal|Draft|TimedText|Module|Event)(?: talk)?:|^[^:]+ talk:/i;

const WIKIPEDIA_HOST = new URL(WIKIPEDIA_ORIGIN).hostname;

export function isArticleTitle(title: string): boolean {
  return !NON_ARTICLE_NAMESPACE.test(title);
}

/** Opens in a new tab; only links leaving Wikipedia get the `external` class (and its visual marker). */
function openInNewTab(anchor: HTMLAnchorElement, href: string) {
  anchor.setAttribute("href", href);
  anchor.setAttribute("target", "_blank");
  anchor.setAttribute("rel", "noopener noreferrer");
  anchor.classList.toggle("external", new URL(href).hostname !== WIKIPEDIA_HOST);
}

function replaceWithRedLink(anchor: HTMLAnchorElement) {
  const span = anchor.ownerDocument.createElement("span");
  span.className = "redlink";
  span.title = "This article hasn't been written yet";
  span.append(...anchor.childNodes);
  anchor.replaceWith(span);
}

function rewriteWikiPath(anchor: HTMLAnchorElement, pathname: string, hash: string) {
  const title = safeDecodeURIComponent(pathname.slice("/wiki/".length)).replaceAll("_", " ");

  // categories and files have pages of their own in Lemma
  const lemmaPath = /^Category:./i.test(title) ? getCategoryPath(title) : /^(File|Image):./i.test(title) ? getFilePath(title) : null;
  if (lemmaPath) {
    anchor.setAttribute("href", lemmaPath);
    anchor.removeAttribute("target");
  } else if (!title || !isArticleTitle(title)) {
    openInNewTab(anchor, `${WIKIPEDIA_ORIGIN}${pathname}${hash}`);
  } else {
    anchor.setAttribute("href", `${getArticlePath(title)}${hash}`);
    anchor.removeAttribute("target");
  }
}

/**
 * Points Wikipedia links at Lemma routes, keeps same-page anchors local, sends non-article pages and
 * other sites to a new tab, and turns red links into plain text.
 */
export function rewriteArticleLink(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return;

  let url: URL;
  try {
    url = new URL(href, WIKIPEDIA_ORIGIN);
  } catch {
    anchor.removeAttribute("href");
    return;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    if (url.protocol !== "mailto:") anchor.removeAttribute("href");
    return;
  }

  if (url.hostname === WIKIPEDIA_HOST) {
    if (url.searchParams.get("redlink") === "1") return replaceWithRedLink(anchor);
    if (url.pathname.startsWith("/wiki/") && !url.search) return rewriteWikiPath(anchor, url.pathname, url.hash);
  }

  if (url.protocol === "http:") url.protocol = "https:";
  openInNewTab(anchor, url.href);
}
