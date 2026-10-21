import DOMPurify from "dompurify";
import type { WikipediaPageContent } from "$lib/api/wikipedia";
import { rewriteArticleLink } from "./articleLinks";
import { parseInfobox } from "./parseInfobox";
import {
  countWords,
  EDIT_AFFORDANCE_SELECTOR,
  EXCLUDED_CONTENT_SELECTOR,
  getBestImageSrc,
  getHeadingLevel,
  getImageFileName,
  isArticleHeadingTag,
  isBlockedArticleImage,
  isFoldableHeadingLevel,
  mayHaveTransparency,
} from "./articleUtils";
import type {
  ArticleBlock,
  ArticleHeading,
  ArticleImage,
  HtmlBlockKind,
  ImagesBlock,
  ParsedArticle,
} from "./types";

const WORDS_PER_MINUTE = 230;
const BLOCK_SELECTOR = "p, h1, h2, h3, h4, h5, h6, ul, ol, dl, blockquote, table, img";
// Elements that are rendered as part of a larger block rather than on their own.
const INLINE_CONTAINER_SELECTOR = "p, li, dd, dt, blockquote, table, figcaption";
const CITATION_SELECTOR = "sup.reference, .mw-cite-backlink";
// Images shown smaller than this (map markers, flags, sister-project logos) are icons, not article images.
const MIN_ARTICLE_IMAGE_SIZE = 64;

/**
 * Wikipedia's parser output is the trust boundary: it's sanitized here (scripts, event handlers,
 * embeds, forms, styles and unsafe URLs removed) before anything is parsed or rendered.
 */
function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["style", "link", "form", "input", "button", "textarea", "select", "iframe", "object", "embed"],
  });
}

function parseDocument(html: string): Document {
  // DOMParser documents are inert: images don't load and nothing executes while we work on them.
  return new DOMParser().parseFromString(sanitizeArticleHtml(html), "text/html");
}

function removeClutter(root: HTMLElement) {
  root.querySelectorAll(EXCLUDED_CONTENT_SELECTOR).forEach((element) => element.remove());
  root.querySelectorAll(EDIT_AFFORDANCE_SELECTOR).forEach((element) => element.remove());

  const contentRoot = root.firstElementChild;
  contentRoot?.querySelectorAll(":scope > .plainlist").forEach((element) => element.remove());
}

/** Tags flags, portal and sister-project logos so they can be sized consistently inside text and lists. */
function markInlineIcons(root: HTMLElement) {
  root.querySelectorAll("img").forEach((image) => {
    const size = Math.max(Number(image.getAttribute("width")), Number(image.getAttribute("height")));
    if (size > 0 && size < MIN_ARTICLE_IMAGE_SIZE) image.classList.add("inline-icon");
  });
}

function isInvertedInDarkMode(image: HTMLImageElement): boolean {
  return image.matches(".mw-invert, .skin-invert") || !!image.closest("figure")?.matches(".skin-invert-image, .mw-invert-image");
}

/** Tags images that may be see-through (diagrams, maps) so dark mode can put a light sheet behind them. */
function markLightBackings(root: HTMLElement) {
  root.querySelectorAll("img:not(.inline-icon)").forEach((image) => {
    if (!isInvertedInDarkMode(image as HTMLImageElement) && mayHaveTransparency(image.getAttribute("src") ?? "")) {
      image.classList.add("light-backing");
    }
  });
}

function toArticleImage(image: HTMLImageElement): ArticleImage | null {
  const src = getBestImageSrc(image);
  if (!src || isBlockedArticleImage(src)) return null;

  const figure = image.closest("figure");
  const caption = figure?.querySelector("figcaption")?.innerHTML.trim() ?? "";
  const width = Number(image.getAttribute("width")) || undefined;
  const height = Number(image.getAttribute("height")) || undefined;
  if (Math.max(width ?? Infinity, height ?? Infinity) < MIN_ARTICLE_IMAGE_SIZE) return null;
  const invertInDarkMode = isInvertedInDarkMode(image);

  return {
    src,
    alt: image.getAttribute("alt") ?? "",
    caption,
    width,
    height,
    invertInDarkMode,
    lightBacking: !invertInDarkMode && mayHaveTransparency(src),
    fileName: getImageFileName(src),
  };
}

function getHtmlBlockKind(element: Element): HtmlBlockKind | null {
  switch (element.tagName) {
    case "P":
      return element.textContent?.trim() || element.querySelector("img") ? "paragraph" : null;
    case "UL":
    case "OL":
    case "DL":
      if (!element.textContent?.trim() && !element.querySelector("img")) return null;
      return element.matches("ol.references") ? "references" : "list";
    case "TABLE":
      return "table";
    case "BLOCKQUOTE":
      return "quote";
    default:
      return null;
  }
}

function isStandaloneBlock(element: Element): boolean {
  if (element.closest(EXCLUDED_CONTENT_SELECTOR) !== null) return false;
  return element.parentElement?.closest(INLINE_CONTAINER_SELECTOR) == null;
}

function countLinks(element: Element): number {
  return [...element.querySelectorAll("a[href]")].filter((link) => !link.closest(CITATION_SELECTOR)).length;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let suffix = 2; used.has(id); suffix += 1) id = `${base}_${suffix}`;
  used.add(id);
  return id;
}

export function parseArticle(pageContent: WikipediaPageContent): ParsedArticle {
  const document = parseDocument(pageContent.text);
  const root = document.body;

  // Wikipedia's one-line summary ("English computer scientist (1912–1954)") is hidden markup; keep it as a subtitle.
  const description = root.querySelector(".shortdescription")?.textContent?.trim() ?? "";

  // The infobox is shown beside the article rather than inline, so lift it out before clutter removal discards it.
  const infoboxTable = root.querySelector<HTMLElement>("table.infobox");
  infoboxTable?.remove();
  let infobox = null;
  if (infoboxTable) {
    infoboxTable.querySelectorAll("a").forEach(rewriteArticleLink);
    markInlineIcons(infoboxTable);
    markLightBackings(infoboxTable);
    infobox = parseInfobox(infoboxTable, toArticleImage);
  }

  removeClutter(root);
  root.querySelectorAll("a").forEach(rewriteArticleLink);
  markInlineIcons(root);
  markLightBackings(root);

  // Galleries become image blocks, so they stack into a fan like any other image group. Each photo's caption is its
  // gallery text rather than a figcaption.
  const galleryImages = new Map<Element, ArticleImage[]>();
  root.querySelectorAll("ul.gallery").forEach((gallery) => {
    const images = [...gallery.querySelectorAll("img")].flatMap((element) => {
      const image = toArticleImage(element);
      if (!image) return [];
      const text = element.closest(".gallerybox")?.querySelector(".gallerytext")?.innerHTML.trim();
      return [text ? { ...image, caption: text } : image];
    });
    if (images.length > 0) galleryImages.set(gallery, images);
  });
  // A gallery is its own group: images that follow it start a new one rather than joining its fan.
  const galleryBlocks = new Set<ImagesBlock>();

  const blocks: ArticleBlock[] = [];
  const headings: ArticleHeading[] = [];
  const anchors: Record<string, number> = {};
  const headingIds = new Set<string>();
  const outlineStack: ArticleHeading[] = [];
  const foldStack: ArticleHeading[] = [];
  let words = 0;
  let links = 0;

  const sectionIds = () => foldStack.map((heading) => heading.id);

  function registerAnchors(element: Element, blockIndex: number) {
    if (element.id) anchors[element.id] ??= blockIndex;
    element.querySelectorAll("[id]").forEach((child) => (anchors[child.id] ??= blockIndex));
  }

  for (const element of root.querySelectorAll(BLOCK_SELECTOR)) {
    if (!isStandaloneBlock(element)) continue;
    const tag = element.tagName;

    if (tag === "IMG") {
      const image = toArticleImage(element as HTMLImageElement);
      if (!image) continue;

      const previous = blocks.at(-1);
      if (previous?.type === "images" && !galleryBlocks.has(previous)) {
        previous.images.push(image);
      } else {
        blocks.push({ type: "images", images: [image], sectionIds: sectionIds() } satisfies ImagesBlock);
      }
    } else if (isArticleHeadingTag(tag)) {
      const level = getHeadingLevel(tag);
      const text = element.textContent?.trim() ?? "";
      if (!text) continue;

      while (outlineStack.at(-1) && outlineStack.at(-1)!.level >= level) outlineStack.pop();
      while (foldStack.at(-1) && foldStack.at(-1)!.level >= level) foldStack.pop();

      const parent = outlineStack.at(-1);
      const heading: ArticleHeading = {
        id: uniqueId(element.id || text.replaceAll(/\s+/g, "_"), headingIds),
        text,
        tag,
        level,
        parentId: parent?.id ?? null,
        childIds: [],
        ancestorIds: outlineStack.map((ancestor) => ancestor.id),
      };

      parent?.childIds.push(heading.id);
      headings.push(heading);
      anchors[heading.id] = blocks.length;
      blocks.push({ type: "heading", heading, sectionIds: sectionIds() });

      outlineStack.push(heading);
      if (isFoldableHeadingLevel(level)) foldStack.push(heading);
      words += countWords(text);
    } else if (galleryImages.has(element)) {
      registerAnchors(element, blocks.length);
      const block: ImagesBlock = { type: "images", images: galleryImages.get(element)!, sectionIds: sectionIds() };
      galleryBlocks.add(block);
      blocks.push(block);
    } else {
      const kind = getHtmlBlockKind(element);
      if (!kind) continue;

      registerAnchors(element, blocks.length);
      blocks.push({ type: "html", kind, html: element.outerHTML, sectionIds: sectionIds() });

      if (kind !== "references") {
        links += countLinks(element);
        if (kind !== "table") words += countWords(element.textContent ?? "");
      }
    }
  }

  return {
    title: pageContent.title,
    description,
    infobox,
    blocks,
    headings,
    stats: { words, links, readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)) },
    anchors,
  };
}
