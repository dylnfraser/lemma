import { fetchArticle } from "$lib/api/wikipedia";
import { parseArticle } from "$lib/article/parseArticle";
import type { ArticleMeta, ParsedArticle } from "$lib/article/types";
import type { PageLoad } from "./$types";

type ParsedArticleData = { article: ParsedArticle; redirectFragment: string; meta: ArticleMeta };

// Articles are fetched straight from Wikipedia in the reader's browser; there is no server to render them.
export const ssr = false;
export const prerender = false;

// How long navigation waits for the article before showing a skeleton instead.
const SKELETON_AFTER_MS = 400;

/**
 * The article is returned as a promise, but navigation waits for it briefly first: a quick article replaces the
 * previous page directly (no blank page or skeleton flashing in between), and a slow one shows the skeleton rather than
 * leaving the previous page up. On a cold start there's no previous page, so the skeleton shows straight away.
 * SvelteKit only ever renders data for the latest navigation, so a slow earlier response can't replace a newer article.
 *
 * Hovering a link preloads this, which only downloads the article: parsing it is one long block of work, and doing that
 * on hover would freeze the page the reader is still reading (and its animations) for every link they pass over. The
 * page parses it with `article()` once it's actually opened.
 */
export const load: PageLoad = async ({ params, fetch }) => {
  const controller = new AbortController();

  const content = fetchArticle(params.title, { fetch, signal: controller.signal });
  // Rejections are handled by the page; this stops abandoned requests from being reported as unhandled.
  content.catch(() => {});

  let parsed: Promise<ParsedArticleData> | undefined;
  const article = () =>
    (parsed ??= content.then((content) => ({
      article: parseArticle(content),
      redirectFragment: content.redirectFragment ?? "",
      meta: {
        redirectedFrom: content.redirectedFrom ?? "",
        languages: content.languages ?? [],
        categories: content.categories ?? [],
        disambiguation: content.disambiguation ?? false,
        revisionId: content.revisionId ?? null,
      },
    })));

  if (typeof window !== "undefined" && document.getElementById("main")) {
    await Promise.race([content.catch(() => {}), new Promise((resolve) => setTimeout(resolve, SKELETON_AFTER_MS))]);
  }

  return {
    requestedTitle: params.title.replaceAll("_", " "),
    /** Parses the article (once): call it when the page shows it. */
    article,
    /** Abort the request if the reader leaves before it finishes. */
    cancel: () => controller.abort(),
  };
};
