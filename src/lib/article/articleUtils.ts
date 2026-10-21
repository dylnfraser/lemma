import type { ArticleHeadingTag } from "./types";

export const EXCLUDED_CONTENT_SELECTOR = [
  ".infobox",
  ".sidebar",
  ".navbox",
  ".vertical-navbox",
  ".metadata",
  ".ambox",
  ".hatnote",
  ".mw-editsection",
  ".mw-empty-elt",
  ".shortdescription",
  // Alternate renderings that Wikipedia hides with TemplateStyles (e.g. the static frame behind an animation).
  ".calculator-value-false",
  "table:not(.wikitable)",
].join(", ");

export const IMAGE_TARGET_WIDTH = 960;
const WIKIMEDIA_THUMB_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);

export function normalizeImageSrc(src: string): string {
  return src.startsWith("//") ? `https:${src}` : src;
}

function getThumbParts(src: string) {
  try {
    const url = new URL(normalizeImageSrc(src));
    if (!WIKIMEDIA_THUMB_HOSTS.has(url.hostname) || !url.pathname.includes("/thumb/")) return null;

    const pathParts = url.pathname.split("/");
    return {
      origin: url.origin,
      search: url.search,
      directory: pathParts.slice(0, -1).join("/"),
      fileName: pathParts[pathParts.length - 1],
      isVector: /\.svg$/i.test(pathParts[pathParts.length - 2] ?? ""),
    };
  } catch {
    return null;
  }
}

export function resizeWikimediaThumb(src: string, targetWidth = IMAGE_TARGET_WIDTH): string {
  const parts = getThumbParts(src);
  if (!parts) return normalizeImageSrc(src);

  const resizedFileName = parts.fileName.replace(/^\d+px-/, `${targetWidth}px-`);
  return `${parts.origin}${parts.directory}/${resizedFileName}${parts.search}`;
}

/**
 * Picks a sharp source for an article image. Wikimedia refuses to upscale raster thumbnails past the
 * original file, so only vectors and files wider than the target are resized; everything else uses
 * the largest candidate Wikipedia already offered.
 */
export function getBestImageSrc(image: HTMLImageElement, targetWidth = IMAGE_TARGET_WIDTH): string {
  const src = image.getAttribute("src") ?? "";
  const largestCandidate =
    (image.getAttribute("srcset") ?? "")
      .split(",")
      .map((candidate) => candidate.trim().split(/\s+/)[0])
      .filter(Boolean)
      .at(-1) ?? src;

  const fileWidth = Number(image.getAttribute("data-file-width"));
  const parts = getThumbParts(src);
  if (parts && (parts.isVector || fileWidth > targetWidth)) return resizeWikimediaThumb(src, targetWidth);

  return normalizeImageSrc(largestCandidate);
}

export function isArticleHeadingTag(tag: string): tag is ArticleHeadingTag {
  return /^H[1-6]$/.test(tag);
}

export function isFoldableHeadingLevel(level: number): boolean {
  return level <= 4;
}

export function getHeadingLevel(tag: ArticleHeadingTag): number {
  return Number(tag.slice(1));
}

export function isBlockedArticleImage(src: string): boolean {
  return ["Symbol_category_class", "Question_book-new", "Wikisource-logo"].some((pattern) => src.includes(pattern));
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function getArticlePath(title: string): string {
  return `/wiki/${encodeURIComponent(title.trim().replaceAll(" ", "_"))}`;
}

export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
