import type { ArticleHeadingTag } from "./types";

export const EXCLUDED_CONTENT_SELECTOR = [
  ".infobox",
  ".sidebar",
  ".navbox",
  ".vertical-navbox",
  ".metadata",
  // message boxes (cleanup and maintenance notices)
  ".ambox",
  ".ombox",
  ".tmbox",
  ".imbox",
  ".cmbox",
  // "This disambiguation page lists…": the page itself says so
  ".dmbox",
  ".mw-empty-elt",
  ".shortdescription",
  // Alternate renderings that Wikipedia hides with TemplateStyles (e.g. the static frame behind an animation).
  ".calculator-value-false",
].join(", ");

/**
 * Lemma is a reader, so everything that invites editing goes: section [edit] links, v·t·e template bars, Wikidata and
 * taxonomy pencils, "[update]" prompts, editor-only citation maintenance notes, and any other link into the editor.
 * Red links (also `action=edit`) are kept here and turned into plain text by `rewriteArticleLink`.
 */
export const EDIT_AFFORDANCE_SELECTOR = [
  ".mw-editsection",
  ".navbar",
  ".sidebar-navbar",
  ".taxobox-edit-taxonomy",
  ".asof-tag",
  ".citation-comment",
  // "Cite error: …", for the article's editors
  ".mw-ext-cite-error",
  'a[href*="action=edit"]:not([href*="redlink=1"])',
  'a[href*="veaction=edit"]',
  'a[title^="Edit this"]',
  'img[alt^="Edit this"]',
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
 * The uploaded file an image shows ("Diagram.svg" for any thumbnail of it), for its File: page and credits.
 * Null for images that aren't Wikimedia uploads (e.g. rendered math).
 */
export function getImageFileName(src: string): string | null {
  try {
    const url = new URL(normalizeImageSrc(src));
    if (!WIKIMEDIA_THUMB_HOSTS.has(url.hostname)) return null;
    const pathParts = url.pathname.split("/");
    // thumbnails live at …/thumb/a/ab/<file>/<width>px-<file>; originals at …/a/ab/<file>
    const fileName = url.pathname.includes("/thumb/") ? pathParts.at(-2) : pathParts.at(-1);
    return fileName ? safeDecodeURIComponent(fileName) : null;
  } catch {
    return null;
  }
}

/**
 * Formats that can have see-through areas. Wikipedia's diagrams are mostly dark line art on transparency, which
 * vanishes on a dark page, so these get a light backing in dark mode. (Photos are JPEGs and never need one.)
 */
export function mayHaveTransparency(src: string): boolean {
  return /\.(?:png|svg|gif|webp)$/i.test(getImageFileName(src) ?? "");
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

/** The width in pixels of the file at `src`: from a thumbnail's "NNNpx-" name, or the original's recorded width. */
export function getPixelWidth(src: string, image: Element): number | undefined {
  const thumb = src.match(/\/(\d+)px-[^/]*$/);
  if (thumb) return Number(thumb[1]);
  return Number(image.getAttribute("data-file-width")) || Number(image.getAttribute("width")) || undefined;
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

/** Lemma's page for a category ("British cryptographers" or "Category:British cryptographers"). */
export function getCategoryPath(name: string): string {
  return `/category/${encodeURIComponent(name.trim().replace(/^Category:/i, "").replaceAll(" ", "_"))}`;
}

/** Lemma's page for an image or other file ("Eiffel.jpg" or "File:Eiffel.jpg"). */
export function getFilePath(name: string): string {
  return `/file/${encodeURIComponent(name.trim().replace(/^(File|Image):/i, "").replaceAll(" ", "_"))}`;
}

export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
