import { describe, expect, it, vi } from "vitest";
import { feedDatePath, fetchFeaturedFeed, fetchRandomTitle, storyToHtml } from "./feed";
import { WikipediaError } from "./wikipedia";

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
const mockFetch = (outcome: Response) => vi.fn<typeof fetch>(async () => outcome);

const page = (title: string, extra: object = {}) => ({
  title: title.replaceAll(" ", "_"),
  titles: { normalized: title },
  namespace: { id: 0 },
  description: `${title} description`,
  extract: `${title} extract`,
  thumbnail: { source: `//upload.wikimedia.org/${title}.jpg`, width: 320, height: 240 },
  ...extra,
});

describe("fetchFeaturedFeed", () => {
  it("requests the day's feed and normalises every section", async () => {
    const fetcher = mockFetch(
      json({
        tfa: page("Hongwu Emperor"),
        image: {
          title: "File:Laccaria laccata.jpg",
          thumbnail: { source: "https://upload.wikimedia.org/laccaria.jpg", width: 640, height: 512 },
          description: { text: "Cap with  curled gills" },
          artist: { text: "D. J. Bergsma." },
          license: { type: "CC BY-SA 4.0" },
        },
        news: [{ story: '<a href="./Limoges">Limoges</a> burns', links: [page("Limoges")] }, { links: [] }],
        onthisday: [{ year: 1994, text: "A treaty was signed", pages: [page("Agreed Framework")] }],
        mostread: { articles: [page("Main Page"), page("Kim Jong Un", { views: 321 }), page("Special:Search")] },
      }),
    );

    const feed = await fetchFeaturedFeed(new Date(2026, 9, 3), { fetch: fetcher });
    expect(String(fetcher.mock.calls[0][0])).toBe("https://en.wikipedia.org/api/rest_v1/feed/featured/2026/10/03");
    expect(feed.featured).toMatchObject({
      title: "Hongwu Emperor",
      thumbnail: { src: "https://upload.wikimedia.org/Hongwu Emperor.jpg", width: 320, height: 240 },
    });
    expect(feed.picture).toEqual({
      file: "Laccaria laccata.jpg",
      src: "https://upload.wikimedia.org/laccaria.jpg",
      width: 640,
      height: 512,
      description: "Cap with curled gills",
      artist: "D. J. Bergsma",
      license: "CC BY-SA 4.0",
    });
    expect(feed.news).toHaveLength(1);
    expect(feed.news[0].pages.map((p) => p.title)).toEqual(["Limoges"]);
    expect(feed.onThisDay[0]).toMatchObject({ year: 1994, text: "A treaty was signed" });
    expect(feed.mostRead.map((p) => [p.title, p.views])).toEqual([["Kim Jong Un", 321]]);
  });

  it("tolerates a feed with sections missing", async () => {
    await expect(fetchFeaturedFeed(new Date(), { fetch: mockFetch(json({})) })).resolves.toEqual({
      featured: null,
      picture: null,
      news: [],
      onThisDay: [],
      mostRead: [],
    });
  });

  it("fills sections today's feed doesn't have yet from the day before", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).endsWith("/2026/10/21")
        ? json({ onthisday: [{ year: 1994, text: "Today's event", pages: [] }] })
        : json({
            tfa: page("Hongwu Emperor"),
            onthisday: [{ year: 1900, text: "Yesterday's event", pages: [] }],
            mostread: { articles: [page("Kim Jong Un", { views: 321 })] },
          }),
    );

    const feed = await fetchFeaturedFeed(new Date(2026, 9, 21), { fetch: fetcher });
    expect(String(fetcher.mock.calls[1][0])).toMatch(/\/2026\/10\/20$/);
    expect(feed.featured?.title).toBe("Hongwu Emperor");
    expect(feed.mostRead.map((p) => p.title)).toEqual(["Kim Jong Un"]);
    expect(feed.onThisDay.map((e) => e.text)).toEqual(["Today's event"]);
  });

  it("shows today's partial feed if the day before can't be fetched", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).endsWith("/2026/10/21")
        ? json({ onthisday: [{ year: 1994, text: "Today's event", pages: [] }] })
        : new Response("", { status: 503 }),
    );
    const feed = await fetchFeaturedFeed(new Date(2026, 9, 21), { fetch: fetcher });
    expect(feed.onThisDay).toHaveLength(1);
    expect(feed.featured).toBeNull();
  });
});

describe("storyToHtml", () => {
  it("keeps text formatting, drops everything else, and points links at Lemma", () => {
    const html = storyToHtml(
      '<!--Oct 17-->The <a rel="mw:WikiLink" href="./Hôtel_de_Ville,_Limoges" id="mwBg">Hôtel</a> in <b id="x"><a href="./Limoges">Limoges</a></b> <img src=x onerror=alert(1)>burns',
    );
    expect(html).toBe(
      'The <a href="/wiki/H%C3%B4tel_de_Ville%2C_Limoges">Hôtel</a> in <b><a href="/wiki/Limoges">Limoges</a></b> burns',
    );
  });
});

describe("fetchRandomTitle", () => {
  it("returns a random article title", async () => {
    const fetcher = mockFetch(json({ query: { random: [{ id: 1, ns: 0, title: "Sant Kumar" }] } }));
    await expect(fetchRandomTitle({ fetch: fetcher })).resolves.toBe("Sant Kumar");
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("rnnamespace")).toBe("0");
  });

  it("fails clearly on an unreadable response", async () => {
    await expect(fetchRandomTitle({ fetch: mockFetch(json({})) })).rejects.toBeInstanceOf(WikipediaError);
  });
});

it("zero-pads feed dates", () => {
  expect(feedDatePath(new Date(2026, 0, 5))).toBe("2026/01/05");
});
