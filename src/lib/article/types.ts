export type ArticleHeadingTag = "H1" | "H2" | "H3" | "H4" | "H5" | "H6";

export interface ArticleHeading {
  id: string;
  text: string;
  tag: ArticleHeadingTag;
  level: number;
  parentId: string | null;
  childIds: string[];
  /** Every enclosing heading in the outline, nearest last. */
  ancestorIds: string[];
}

interface BaseBlock {
  /** Foldable headings (H1–H4) this block sits under, outermost first. */
  sectionIds: string[];
}

export interface HeadingBlock extends BaseBlock {
  type: "heading";
  heading: ArticleHeading;
}

export interface ArticleImage {
  src: string;
  alt: string;
  /** Sanitized caption HTML, or an empty string. */
  caption: string;
  width?: number;
  height?: number;
  /** Wikipedia marked the image as safe to invert in dark mode (diagrams, formulas). */
  invertInDarkMode: boolean;
}

export interface ImagesBlock extends BaseBlock {
  type: "images";
  images: ArticleImage[];
}

export type HtmlBlockKind = "paragraph" | "list" | "references" | "table" | "quote";

export interface HtmlBlock extends BaseBlock {
  type: "html";
  kind: HtmlBlockKind;
  /** Sanitized outer HTML of the source element. */
  html: string;
}

export type ArticleBlock = HeadingBlock | ImagesBlock | HtmlBlock;

export type InfoboxRow =
  /** Section heading inside the infobox ("Government", "Area"). */
  | { kind: "header"; html: string }
  /** A label/value pair. */
  | { kind: "data"; label: string; html: string }
  /** A full-width row: images, maps, captions, subheaders. */
  | { kind: "full"; html: string };

export interface Infobox {
  /** Sanitized title HTML (may include a native-language name). */
  title: string;
  rows: InfoboxRow[];
  /** Images in the infobox, in order, for the full-screen viewer; their <img> tags carry data-lightbox-index. */
  images: ArticleImage[];
}

export interface ArticleStats {
  words: number;
  links: number;
  readingMinutes: number;
}

export interface ParsedArticle {
  title: string;
  /** Wikipedia's short description, or an empty string. */
  description: string;
  /** The article's infobox, when it has one. */
  infobox: Infobox | null;
  blocks: ArticleBlock[];
  headings: ArticleHeading[];
  stats: ArticleStats;
  /** Maps element ids (headings, citations, references) to the index of the block containing them. */
  anchors: Record<string, number>;
}
