import { fetchArticle } from "$lib/api/wikipedia";
import { parseArticle } from "$lib/article/parseArticle";
import type { PageLoad } from "./$types";

// Articles are fetched straight from Wikipedia in the reader's browser; there is no server to render them.
export const ssr = false;
export const prerender = false;

// How long navigation waits for the article before showing a skeleton instead.
const SKELETON_AFTER_MS = 400;

/**
 * The article is returned as a promise, but navigation waits for it briefly first: a quick article replaces the
 * previous page directly (no blank page or skeleton flashing in between), and a slow one shows the skeleton rather than
 * leaving the previous page up. On a cold start there's no previous page, so the skeleton shows straight away.
 * Hover-preloading starts the request early, and SvelteKit only ever renders data for the latest navigation, so a slow
 * earlier response can't replace a newer article.
 */
export const load: PageLoad = async ({ params, fetch }) => {
  const controller = new AbortController();

  const article = fetchArticle(params.title, { fetch, signal: controller.signal }).then((content) => ({
    article: parseArticle(content),
    redirectFragment: content.redirectFragment ?? "",
    meta: {
      redirectedFrom: content.redirectedFrom ?? "",
      languages: content.languages ?? [],
      categories: content.categories ?? [],
      disambiguation: content.disambiguation ?? false,
      revisionId: content.revisionId ?? null,
    },
  }));
  // Rejections are handled by the page; this stops abandoned requests from being reported as unhandled.
  article.catch(() => {});

  if (typeof window !== "undefined" && document.getElementById("main")) {
    await Promise.race([article.catch(() => {}), new Promise((resolve) => setTimeout(resolve, SKELETON_AFTER_MS))]);
  }

  return {
    requestedTitle: params.title.replaceAll("_", " "),
    article,
    /** Abort the request if the reader leaves before it finishes. */
    cancel: () => controller.abort(),
  };
};
