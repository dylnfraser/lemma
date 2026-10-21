import type { ArticleLanguage } from "$lib/api/wikipedia";

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
  /** Roughly how many pixels wide the chosen file is, so it's never stretched past its resolution. */
  pixelWidth?: number;
  /** Wikipedia marked the image as safe to invert in dark mode (diagrams, formulas). */
  invertInDarkMode: boolean;
  /** May be partly transparent (PNG, SVG, GIF), so it sits on a light backing in dark mode. */
  lightBacking: boolean;
  /** The Wikimedia file it shows, for its File: page and credits; null when it isn't an upload. */
  fileName: string | null;
}

export interface ImagesBlock extends BaseBlock {
  type: "images";
  images: ArticleImage[];
  /** Sanitized HTML of a caption shared by the whole group ({{multiple image}}), or absent. */
  caption?: string;
}

export type HtmlBlockKind =
  | "paragraph"
  | "list"
  | "references"
  | "table"
  | "quote"
  /** "Main article: …", "For other uses, see …" */
  | "hatnote"
  /** An audio or video player, with its caption. */
  | "media"
  /** A legacy thumbnail frame holding something other than a plain image (e.g. a chess board), kept whole. */
  | "figure";

export interface HtmlBlock extends BaseBlock {
  type: "html";
  kind: HtmlBlockKind;
  /** Sanitized outer HTML of the source element. */
  html: string;
}

export type ArticleBlock = HeadingBlock | ImagesBlock | HtmlBlock;

export interface SuccessionEntry {
  /** Flag or emblem <img> HTML, or an empty string. */
  icon: string;
  /** The state's name (usually a link). */
  html: string;
}

export type InfoboxRow =
  /** Section heading inside the infobox ("Government", "Area"). */
  | { kind: "header"; html: string }
  /** A label/value pair. */
  | {
      kind: "data";
      label: string;
      html: string;
      /** A detail of the row above ("• President" under "Government"), shown tucked under it without a bullet. */
      sub?: boolean;
    }
  /** A full-width row: images, maps, captions, subheaders. */
  | { kind: "full"; html: string }
  /** "Preceded by / Succeeded by" in former-country infoboxes. */
  | { kind: "succession"; before: SuccessionEntry[]; after: SuccessionEntry[] };

export interface Infobox {
  /** Sanitized title HTML (may include a native-language name). */
  title: string;
  rows: InfoboxRow[];
  /** Images in the infobox, in order, for the full-screen viewer; their zoom buttons carry data-lightbox-index. */
  images: ArticleImage[];
}

export interface ArticleStats {
  words: number;
  links: number;
  readingMinutes: number;
}

/** A navbox or series sidebar, kept as a list of related topics. */
export interface RelatedTopics {
  /** Sanitized title HTML ("Alan Turing", "Part of a series on Computer science"). */
  title: string;
  groups: {
    /** Sanitized label HTML, or an empty string. */
    label: string;
    /** Sanitized HTML of the group's links (usually a list). */
    html: string;
  }[];
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
  /** Navboxes and series sidebars, shown at the end of the article. */
  related: RelatedTopics[];
  /** Wikipedia's TemplateStyles CSS for the templates in this article, minus rules for parts Lemma restyles. */
  styles: string;
}

/** Facts about the article that come with it but aren't part of its text. */
export interface ArticleMeta {
  /** The title the reader asked for, when a redirect led here (empty otherwise). */
  redirectedFrom: string;
  /** The same article in other languages. */
  languages: ArticleLanguage[];
  /** Reader-facing categories. */
  categories: string[];
}
