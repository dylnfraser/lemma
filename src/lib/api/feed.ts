import { normalizeProtocol, requestJson, WIKIPEDIA_ORIGIN, WikipediaError, type RequestOptions } from "./wikipedia";

/** An article as the feed describes it: enough for a card. */
export type FeedPage = {
  title: string;
  description: string;
  extract: string;
  thumbnail: { src: string; width: number; height: number } | null;
};

export type FeedNewsItem = {
  /** Wikipedia's story HTML, unsanitized: sanitize and rewrite links before rendering. */
  storyHtml: string;
  pages: FeedPage[];
};

export type FeedEvent = { year: number | null; text: string; pages: FeedPage[] };

export type FeedPicture = {
  /** File name without the "File:" prefix. */
  file: string;
  src: string;
  width: number;
  height: number;
  /** Plain-text description. */
  description: string;
  artist: string;
  license: string;
};

export type FeaturedFeed = {
  featured: FeedPage | null;
  /** Picture of the day. */
  picture: FeedPicture | null;
  news: FeedNewsItem[];
  onThisDay: FeedEvent[];
  mostRead: (FeedPage & { views: number })[];
};

type RawPage = {
  type?: string;
  namespace?: { id?: number };
  title?: string;
  titles?: { normalized?: string };
  normalizedtitle?: string;
  description?: string;
  extract?: string;
  views?: number;
  thumbnail?: { source?: string; width?: number; height?: number };
};

type RawPicture = {
  title?: string;
  thumbnail?: { source?: string; width?: number; height?: number };
  description?: { text?: string };
  artist?: { text?: string };
  license?: { type?: string };
};

type FeedResponse = {
  tfa?: RawPage;
  image?: RawPicture;
  news?: { story?: string; links?: RawPage[] }[];
  onthisday?: { year?: number; text?: string; pages?: RawPage[] }[];
  mostread?: { articles?: RawPage[] };
};

// The most-read list includes the front page and special pages; they're not articles to read.
const NOT_READING = /^(Main Page|Special:|Wikipedia:|Portal:|File:|Help:)/;

function toPage(raw: RawPage | undefined): FeedPage | null {
  const title = raw?.titles?.normalized ?? raw?.normalizedtitle ?? raw?.title?.replaceAll("_", " ");
  if (!raw || !title) return null;
  if (raw.namespace?.id !== undefined && raw.namespace.id !== 0) return null;
  const thumbnail = raw.thumbnail;
  return {
    title,
    description: raw.description ?? "",
    extract: raw.extract ?? "",
    thumbnail:
      thumbnail?.source && thumbnail.width && thumbnail.height
        ? { src: normalizeProtocol(thumbnail.source), width: thumbnail.width, height: thumbnail.height }
        : null,
  };
}

function toPicture(raw: RawPicture | undefined): FeedPicture | null {
  const thumbnail = raw?.thumbnail;
  if (!raw?.title || !thumbnail?.source || !thumbnail.width || !thumbnail.height) return null;
  return {
    file: raw.title.replace(/^File:/, ""),
    src: normalizeProtocol(thumbnail.source),
    width: thumbnail.width,
    height: thumbnail.height,
    description: raw.description?.text?.replace(/\s+/g, " ").trim() ?? "",
    artist: raw.artist?.text?.replace(/\s+/g, " ").trim().replace(/\.$/, "") ?? "",
    license: raw.license?.type ?? "",
  };
}

const pages = (raw: RawPage[] | undefined) => (raw ?? []).map(toPage).filter((page): page is FeedPage => page !== null);

/** The feed path for a day, e.g. "2026/10/21" (local date, zero-padded). */
export function feedDatePath(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

async function fetchFeedDay(date: Date, options: RequestOptions): Promise<FeaturedFeed> {
  const url = new URL(`/api/rest_v1/feed/featured/${feedDatePath(date)}`, WIKIPEDIA_ORIGIN);
  const json = await requestJson<FeedResponse>(url, options);

  return {
    featured: toPage(json.tfa),
    picture: toPicture(json.image),
    news: (json.news ?? [])
      .filter((item) => item.story)
      .map((item) => ({ storyHtml: item.story!, pages: pages(item.links) })),
    onThisDay: (json.onthisday ?? [])
      .filter((event) => event.text)
      .map((event) => ({ year: event.year ?? null, text: event.text!, pages: pages(event.pages) })),
    mostRead: (json.mostread?.articles ?? [])
      .map((raw) => {
        const page = toPage(raw);
        return page && !NOT_READING.test(page.title) ? { ...page, views: raw.views ?? 0 } : null;
      })
      .filter((page): page is FeedPage & { views: number } => page !== null),
  };
}

/**
 * Wikipedia's front-page feed for a day: featured article, in the news, on this day, most read.
 *
 * A day's feed fills in gradually (early on, or when the reader's date is ahead of UTC, it may hold only "on this
 * day"), so whatever is missing is taken from the day before. "On this day" always comes from the requested date.
 */
export async function fetchFeaturedFeed(date: Date, options: RequestOptions = {}): Promise<FeaturedFeed> {
  const feed = await fetchFeedDay(date, options);
  if (feed.featured && feed.picture && feed.mostRead.length > 0) return feed;

  const dayBefore = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  let previous: FeaturedFeed;
  try {
    previous = await fetchFeedDay(dayBefore, options);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return feed; // the fallback is a nicety: show what today has
  }
  return {
    featured: feed.featured ?? previous.featured,
    picture: feed.picture ?? previous.picture,
    news: feed.news.length > 0 ? feed.news : previous.news,
    onThisDay: feed.onThisDay.length > 0 ? feed.onThisDay : previous.onThisDay,
    mostRead: feed.mostRead.length > 0 ? feed.mostRead : previous.mostRead,
  };
}

type RandomResponse = { query?: { random?: { title: string }[] } };

/** A random article title (namespace 0). */
export async function fetchRandomTitle(options: RequestOptions = {}): Promise<string> {
  const url = new URL("/w/api.php", WIKIPEDIA_ORIGIN);
  url.search = new URLSearchParams({
    action: "query",
    list: "random",
    rnnamespace: "0",
    rnlimit: "1",
    format: "json",
    origin: "*",
  }).toString();

  const json = await requestJson<RandomResponse>(url, options);
  const title = json.query?.random?.[0]?.title;
  if (!title) throw new WikipediaError("invalid", "Wikipedia sent a response Lemma couldn't read.");
  return title;
}
