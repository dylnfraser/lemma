import DOMPurify from "dompurify";
import type { WikipediaPageContent } from "$lib/api/wikipedia";
import {
  convertPronunciations,
  extractRelatedTopics,
  extractSisterLinks,
  extractSpokenAudio,
  tidyPlayers,
  mediaContainer,
  mediaHtml,
  normalizeMediaUrls,
  unwrapLayoutTables,
} from "./articleExtras";
import { rewriteArticleLink } from "./articleLinks";
import { markDarkBackgrounds } from "./darkColors";
import { convertMaps, findArticleCoordinates, tintMath } from "./mapsAndMath";
import { extractTemplateStyles } from "./templateStyles";
import { convertCollapsibleLists, parseInfobox } from "./parseInfobox";
import {
  countWords,
  EDIT_AFFORDANCE_SELECTOR,
  EXCLUDED_CONTENT_SELECTOR,
  getBestImageSrc,
  getHeadingLevel,
  getImageFileName,
  getPixelWidth,
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
const BLOCK_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, ul, ol, dl, blockquote, table, img, audio, video, div.hatnote, div.tmulti, div.thumb, .map-frame";
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

/**
 * Wraps each run of consecutive {{legend}} entries (colour swatch + label) in a `.legend-group`, so a map key can be laid
 * out as one block: rows left-aligned with their swatches in a column, the block centred under its image.
 * Only whitespace may separate the entries of a run; anything else ends it, so no text is reordered.
 */
function groupLegends(root: HTMLElement) {
  for (const legend of root.querySelectorAll(".legend")) {
    if (legend.parentElement?.classList.contains("legend-group")) continue;

    const group = root.ownerDocument.createElement("div");
    group.className = "legend-group";
    legend.before(group);

    let node: ChildNode | null = legend;
    while (node) {
      const next: ChildNode | null = node.nextSibling;
      if (node instanceof Element && node.classList.contains("legend")) group.append(node);
      else if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) node.remove();
      else break;
      node = next;
    }
  }
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
  // maps open OpenStreetMap rather than the image viewer
  if (image.classList.contains("map-image")) return null;
  const src = getBestImageSrc(image);
  if (!src || isBlockedArticleImage(src)) return null;

  const figure = image.closest("figure");
  // modern figures, {{multiple image}} cells, and legacy div.thumb frames each keep their caption differently
  const captionElement =
    figure?.querySelector("figcaption") ??
    image.closest(".tsingle")?.querySelector(".thumbcaption") ??
    image.closest(".thumbinner")?.querySelector(":scope > .thumbcaption");
  const caption = captionElement?.innerHTML.trim() ?? "";
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
    pixelWidth: getPixelWidth(src.split("?")[0], image),
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
      if (element.matches("ol.references")) return "references";
      return isBibliography(element) ? "bibliography" : "list";
    case "TABLE":
      return "table";
    case "BLOCKQUOTE":
      return "quote";
    case "DIV":
      return element.matches(".hatnote") && element.textContent?.trim() ? "hatnote" : null;
    default:
      return null;
  }
}

/** A list whose entries are (mostly) formatted citations: a works-cited or further-reading list. */
function isBibliography(list: Element): boolean {
  const items = list.querySelectorAll(":scope > li");
  if (items.length < 2) return false;
  const cited = [...items].filter((item) => item.querySelector("cite.citation, .citation")).length;
  return cited / items.length >= 0.6;
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
  // collected from the raw HTML: the sanitizer removes <style>
  const styles = extractTemplateStyles(pageContent.text);
  const document = parseDocument(pageContent.text);
  const root = document.body;

  // Maps, coordinates and formulas are converted throughout (infobox included) before anything is lifted out.
  const coordinates = findArticleCoordinates(root);
  convertMaps(root, coordinates);
  tintMath(root);
  markDarkBackgrounds(root);
  const spoken = extractSpokenAudio(root);
  const sisters = extractSisterLinks(root);

  // Wikipedia's one-line summary ("English computer scientist (1912–1954)") is hidden markup; keep it as a subtitle.
  const description = root.querySelector(".shortdescription")?.textContent?.trim() ?? "";

  // The infobox is shown beside the article rather than inline, so lift it out before clutter removal discards it.
  const infoboxTable = root.querySelector<HTMLElement>("table.infobox");
  infoboxTable?.remove();
  let infobox = null;
  if (infoboxTable) {
    infoboxTable.querySelectorAll("a").forEach(rewriteArticleLink);
    normalizeMediaUrls(infoboxTable);
    convertPronunciations(infoboxTable);
    tidyPlayers(infoboxTable);
    markInlineIcons(infoboxTable);
    groupLegends(infoboxTable);
    markLightBackings(infoboxTable);
    infobox = parseInfobox(infoboxTable, toArticleImage);
  }

  const related = extractRelatedTopics(root);
  removeClutter(root);
  // in the body (tables, mostly), lists like "Other names" stay folded so rows stay compact; the infobox, already
  // lifted out, shows its short ones plainly
  convertCollapsibleLists(root, 0);
  unwrapLayoutTables(root);
  root.querySelectorAll("a").forEach(rewriteArticleLink);
  normalizeMediaUrls(root);
  convertPronunciations(root);
  markInlineIcons(root);
  groupLegends(root);
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
  // {{multiple image}}: a fixed group, each image with its own caption, plus an optional caption for the whole set.
  const multiImages = new Map<Element, { images: ArticleImage[]; caption: string }>();
  root.querySelectorAll("div.tmulti").forEach((set) => {
    // a set mixing pictures with a player is read item by item, so the player gets its own block
    if (set.querySelector("audio, video")) return;
    const images = [...set.querySelectorAll("img")].flatMap((element) => toArticleImage(element) ?? []);
    const shared = [...set.querySelectorAll(".trow > .thumbcaption, .theader")]
      .filter((caption) => !caption.closest(".tsingle"))
      .map((caption) => caption.innerHTML.trim())
      .filter(Boolean)
      .join(" ");
    if (images.length > 0) multiImages.set(set, { images, caption: shared });
  });

  // A gallery or multiple-image set is its own group: images that follow it start a new one rather than joining it.
  const galleryBlocks = new Set<ImagesBlock>();
  // Elements already turned into a block whole; anything inside them is skipped.
  const consumed: Element[] = [];
  const insideConsumed = (element: Element) => consumed.some((container) => container !== element && container.contains(element));

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
    if (insideConsumed(element)) continue;
    const tag = element.tagName;

    // players can sit inside a paragraph-like wrapper, so they're picked up before the standalone check
    if (tag === "AUDIO" || tag === "VIDEO") {
      if (element.closest(EXCLUDED_CONTENT_SELECTOR) || element.closest("table, li")) continue;
      const { container, caption } = mediaContainer(element);
      consumed.push(container);
      registerAnchors(container, blocks.length);
      blocks.push({ type: "html", kind: "media", html: mediaHtml(element, caption), sectionIds: sectionIds() });
      continue;
    }

    if (!isStandaloneBlock(element)) continue;

    // a map picture outside the infobox: shown with its caption, as a figure
    if (element.matches(".map-frame")) {
      const container = element.closest("figure") ?? element;
      if (insideConsumed(container)) continue;
      consumed.push(container);
      blocks.push({ type: "html", kind: "figure", html: container.outerHTML, sectionIds: sectionIds() });
      continue;
    }

    if (multiImages.has(element)) {
      consumed.push(element);
      const { images, caption } = multiImages.get(element)!;
      const block: ImagesBlock = { type: "images", images, sectionIds: sectionIds(), ...(caption && { caption }) };
      galleryBlocks.add(block);
      blocks.push(block);
      continue;
    }

    if (tag === "DIV" && element.matches(".thumb")) {
      // a legacy frame around something other than a picture (a chess board, a table): keep the frame whole
      if (element.matches(".tmulti") || !element.querySelector("table")) continue;
      consumed.push(element);
      registerAnchors(element, blocks.length);
      blocks.push({ type: "html", kind: "figure", html: element.outerHTML, sectionIds: sectionIds() });
      continue;
    }

    if (tag === "IMG") {
      const image = toArticleImage(element as HTMLImageElement);
      if (!image) continue;

      const previous = blocks.at(-1);
      if (previous?.type === "images" && !galleryBlocks.has(previous)) {
        // {{Image overlay}} and similar draw the same picture twice, one on top of the other
        if (previous.images.at(-1)?.src === image.src) continue;
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
        if (kind !== "table" && kind !== "hatnote" && kind !== "bibliography") words += countWords(element.textContent ?? "");
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
    related,
    styles,
    coordinates,
    spoken,
    sisters,
  };
}
