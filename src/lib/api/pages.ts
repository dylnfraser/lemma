import DOMPurify from "dompurify";
import { rewriteArticleLink } from "$lib/article/articleLinks";
import { normalizeProtocol, requestJson, WIKIPEDIA_ORIGIN, WikipediaError, type RequestOptions } from "./wikipedia";

// Wikipedia pages that aren't articles but are worth reading in Lemma: categories and image files.

const CATEGORY_PAGE_SIZE = 60;
const FILE_USAGE_LIMIT = 12;

export type CategoryMember = { title: string; description: string; thumbnail: string };

export type CategoryPage = {
  /** Category name without the "Category:" prefix. */
  name: string;
  subcategories: string[];
  pages: CategoryMember[];
  /** Pass to the next request for more members; null when there are no more. */
  next: string | null;
};

type MembersResponse = {
  continue?: { cmcontinue?: string };
  query?: { categorymembers?: { title: string; type?: "page" | "subcat" | "file" }[] };
};

type DetailsResponse = {
  query?: { pages?: { title: string; description?: string; thumbnail?: { source?: string } }[] };
};

const withoutPrefix = (title: string) => title.replace(/^Category:/i, "");

/** One page of a category's members (articles and subcategories), with each article's description and thumbnail. */
export async function fetchCategory(name: string, { next = null, ...options }: RequestOptions & { next?: string | null } = {}): Promise<CategoryPage> {
  const membersUrl = new URL("/w/api.php", WIKIPEDIA_ORIGIN);
  membersUrl.search = new URLSearchParams({
    action: "query",
    list: "categorymembers",
    cmtitle: `Category:${withoutPrefix(name)}`,
    cmtype: "subcat|page",
    cmnamespace: "0|14",
    cmprop: "title|type",
    cmlimit: String(CATEGORY_PAGE_SIZE),
    ...(next && { cmcontinue: next }),
    format: "json",
    formatversion: "2",
    origin: "*",
  }).toString();

  const membersJson = await requestJson<MembersResponse>(membersUrl, options);
  const members = membersJson.query?.categorymembers ?? [];
  const pageTitles = members.filter((member) => member.type === "page").map((member) => member.title);

  // descriptions and thumbnails for the articles, in a second request (the member list itself keeps the sort order)
  const details = new Map<string, { description: string; thumbnail: string }>();
  if (pageTitles.length > 0) {
    const detailsUrl = new URL("/w/api.php", WIKIPEDIA_ORIGIN);
    detailsUrl.search = new URLSearchParams({
      action: "query",
      titles: pageTitles.join("|"),
      prop: "description|pageimages",
      piprop: "thumbnail",
      pithumbsize: "160",
      pilimit: String(pageTitles.length),
      pilicense: "any",
      format: "json",
      formatversion: "2",
      origin: "*",
    }).toString();
    try {
      const pages = (await requestJson<DetailsResponse>(detailsUrl, options)).query?.pages ?? [];
      for (const page of pages) {
        details.set(page.title, { description: page.description ?? "", thumbnail: normalizeProtocol(page.thumbnail?.source ?? "") });
      }
    } catch (error) {
      if (options.signal?.aborted) throw error;
      // the list is still useful without them
    }
  }

  return {
    name: withoutPrefix(name).replaceAll("_", " "),
    subcategories: members.filter((member) => member.type === "subcat").map((member) => withoutPrefix(member.title)),
    pages: pageTitles.map((title) => ({ title, description: "", thumbnail: "", ...details.get(title) })),
    next: membersJson.continue?.cmcontinue ?? null,
  };
}

export type FileDetails = {
  /** File name without the "File:" prefix. */
  name: string;
  /** A large rendering for the page. */
  src: string;
  width: number;
  height: number;
  /** The original upload. */
  originalUrl: string;
  mime: string;
  /** Sanitized HTML, with links pointed at Lemma. */
  description: string;
  author: string;
  date: string;
  credit: string;
  license: string;
  licenseUrl: string;
  /** Where the file is described in full (usually Wikimedia Commons). */
  sourcePage: string;
  /** English Wikipedia articles that show it. */
  usedIn: string[];
};

type FileResponse = {
  query?: {
    pages?: {
      title: string;
      imageinfo?: {
        url?: string;
        thumburl?: string;
        thumbwidth?: number;
        thumbheight?: number;
        width?: number;
        height?: number;
        mime?: string;
        descriptionurl?: string;
        extmetadata?: Record<string, { value?: unknown } | undefined>;
      }[];
    }[];
    imageusage?: { title: string }[];
  };
};

/** Commons metadata is HTML; keep text formatting and links (pointed at Lemma or opening in a new tab). */
function metadataHtml(value: unknown): string {
  if (typeof value !== "string") return "";
  const clean = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ["a", "b", "i", "em", "strong", "br", "p", "span", "ul", "ol", "li"],
    ALLOWED_ATTR: ["href", "lang"],
  });
  const doc = new DOMParser().parseFromString(`<body>${clean}</body>`, "text/html");
  doc.querySelectorAll("a").forEach(rewriteArticleLink);
  return doc.body.innerHTML.trim();
}

function metadataText(value: unknown): string {
  if (typeof value !== "string") return "";
  const doc = new DOMParser().parseFromString(value, "text/html");
  doc.querySelectorAll("[style*='display: none'], [style*='display:none']").forEach((hidden) => hidden.remove());
  return doc.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

/** A file's picture, description, author, licence and the articles that use it. */
export async function fetchFile(name: string, options: RequestOptions = {}): Promise<FileDetails> {
  const title = `File:${name.replace(/^(File|Image):/i, "")}`;
  const url = new URL("/w/api.php", WIKIPEDIA_ORIGIN);
  url.search = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1600",
    iiextmetadatafilter: "ImageDescription|Artist|Credit|LicenseShortName|LicenseUrl|DateTimeOriginal|ObjectName",
    list: "imageusage",
    iutitle: title,
    iunamespace: "0",
    iulimit: String(FILE_USAGE_LIMIT),
    redirects: "1",
    format: "json",
    formatversion: "2",
    origin: "*",
  }).toString();

  const json = await requestJson<FileResponse>(url, options);
  const page = json.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!page || !info?.url) throw new WikipediaError("not_found", "This file doesn't exist.", 404);

  const metadata = info.extmetadata ?? {};
  const licenseUrl = normalizeProtocol(metadataText(metadata.LicenseUrl?.value));
  return {
    name: page.title.replace(/^File:/, ""),
    src: info.thumburl ?? info.url,
    width: info.thumbwidth ?? info.width ?? 0,
    height: info.thumbheight ?? info.height ?? 0,
    originalUrl: info.url,
    mime: info.mime ?? "",
    description: metadataHtml(metadata.ImageDescription?.value),
    author: metadataHtml(metadata.Artist?.value),
    date: metadataText(metadata.DateTimeOriginal?.value),
    credit: metadataHtml(metadata.Credit?.value),
    license: metadataText(metadata.LicenseShortName?.value),
    licenseUrl: /^https?:\/\//.test(licenseUrl) ? licenseUrl : "",
    sourcePage: info.descriptionurl ?? `${WIKIPEDIA_ORIGIN}/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
    usedIn: (json.query?.imageusage ?? []).map((usage) => usage.title),
  };
}
