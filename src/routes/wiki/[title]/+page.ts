import { fetchArticle } from "$lib/api/wikipedia";
import { parseArticle } from "$lib/article/parseArticle";
import type { PageLoad } from "./$types";

// Articles are fetched straight from Wikipedia in the reader's browser; there is no server to render them.
export const ssr = false;
export const prerender = false;

/**
 * The article is returned as a promise rather than awaited so the reader shows a skeleton immediately (including on
 * a cold start) instead of a blank page. Hover-preloading still starts the request early, and SvelteKit only ever
 * renders data for the latest navigation, so a slow earlier response can't replace a newer article.
 */
export const load: PageLoad = ({ params, fetch }) => {
  const controller = new AbortController();

  const article = fetchArticle(params.title, { fetch, signal: controller.signal }).then((content) => ({
    article: parseArticle(content),
    redirectFragment: content.redirectFragment ?? "",
    meta: {
      redirectedFrom: content.redirectedFrom ?? "",
      languages: content.languages ?? [],
      categories: content.categories ?? [],
      badge: content.badge ?? null,
      disambiguation: content.disambiguation ?? false,
      revisionId: content.revisionId ?? null,
    },
  }));
  // Rejections are handled by the page; this stops abandoned requests from being reported as unhandled.
  article.catch(() => {});

  return {
    requestedTitle: params.title.replaceAll("_", " "),
    article,
    /** Abort the request if the reader leaves before it finishes. */
    cancel: () => controller.abort(),
  };
};
