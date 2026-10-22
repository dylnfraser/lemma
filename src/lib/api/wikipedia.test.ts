import { describe, expect, it, vi } from "vitest";
import {
  fetchArticle,
  fetchImageCredit,
  fetchLastEdited,
  fetchRelatedArticles,
  fetchSummary,
  getWikipediaHistoryUrl,
  searchArticles,
  WikipediaError,
} from "./wikipedia";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, ...init });

const mockFetch = (outcome: Response | Error | DOMException) =>
  vi.fn<typeof fetch>(async () => {
    if (!(outcome instanceof Response)) throw outcome;
    return outcome;
  });

async function expectKind(promise: Promise<unknown>, kind: WikipediaError["kind"]) {
  await expect(promise).rejects.toBeInstanceOf(WikipediaError);
  await expect(promise).rejects.toMatchObject({ kind });
}

describe("fetchArticle", () => {
  it("requests the parse API with redirects and identifies the client", async () => {
    const fetcher = mockFetch(json({ parse: { title: "Alan Turing", text: { "*": "<p>Hi</p>" } } }));
    await fetchArticle("Turing", { fetch: fetcher });

    const [url, init] = fetcher.mock.calls[0];
    const params = new URL(String(url)).searchParams;
    expect(params.get("action")).toBe("parse");
    expect(params.get("page")).toBe("Turing");
    expect(params.get("redirects")).toBe("1");
    expect(new Headers(init?.headers).get("Api-User-Agent")).toMatch(/^Lemma\//);
  });

  it("returns the resolved title and redirect fragment", async () => {
    const fetcher = mockFetch(
      json({
        parse: {
          title: "Alan Turing",
          text: { "*": "<p>Hi</p>" },
          redirects: [{ from: "Turing early life", to: "Alan Turing", tofragment: "Early life" }],
        },
      }),
    );

    await expect(fetchArticle("Turing early life", { fetch: fetcher })).resolves.toMatchObject({
      title: "Alan Turing",
      text: "<p>Hi</p>",
      redirectFragment: "Early life",
    });
  });

  it("maps missing pages to not_found", async () => {
    const fetcher = mockFetch(json({ error: { code: "missingtitle", info: "The page you specified doesn't exist." } }));
    await expectKind(fetchArticle("Nope", { fetch: fetcher }), "not_found");
  });

  it("maps HTTP failures, malformed bodies and network errors", async () => {
    await expectKind(fetchArticle("A", { fetch: mockFetch(new Response("", { status: 503 })), retries: 0 }), "http");
    await expectKind(fetchArticle("A", { fetch: mockFetch(new Response("<html>", { status: 200 })) }), "invalid");
    await expectKind(fetchArticle("A", { fetch: mockFetch(json({ parse: { title: "A" } })) }), "invalid");
    await expectKind(fetchArticle("A", { fetch: mockFetch(new TypeError("Failed to fetch")) }), "offline");
  });

  it("waits and tries again when Wikipedia is busy, then succeeds", async () => {
    const busy = () => new Response("", { status: 429, headers: { "Retry-After": "0" } });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(busy())
      .mockResolvedValueOnce(new Response("", { status: 503, headers: { "Retry-After": "0" } }))
      .mockResolvedValueOnce(json({ parse: { title: "A", text: { "*": "<p>Hi</p>" } } }));
    await expect(fetchArticle("A", { fetch: fetcher })).resolves.toMatchObject({ title: "A" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("gives up with a 'busy' error when Wikipedia keeps refusing", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("", { status: 429, headers: { "Retry-After": "0" } }));
    await expectKind(fetchArticle("A", { fetch: fetcher, retries: 2 }), "busy");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("stops waiting to retry when the request is abandoned", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async () => new Response("", { status: 429, headers: { "Retry-After": "5" } }));
    const request = fetchArticle("A", { fetch: fetcher, signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    await expect(request).rejects.toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rethrows caller aborts untouched", async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException("Aborted", "AbortError");

    await expect(fetchArticle("A", { fetch: mockFetch(abortError), signal: controller.signal })).rejects.toBe(
      abortError,
    );
  });
});

describe("searchArticles", () => {
  it("normalizes results", async () => {
    const fetcher = mockFetch(
      json({
        pages: [
          { title: "Pi", description: "Mathematical constant", thumbnail: { url: "//upload.wikimedia.org/pi.png" } },
          { title: "Pie", description: null, thumbnail: null },
        ],
      }),
    );

    await expect(searchArticles("pi", { fetch: fetcher })).resolves.toEqual([
      { title: "Pi", description: "Mathematical constant", thumbnail: "https://upload.wikimedia.org/pi.png" },
      { title: "Pie", description: "", thumbnail: "" },
    ]);
  });
});

describe("fetchLastEdited", () => {
  it("asks for the latest revision's timestamp, following redirects", async () => {
    const fetcher = mockFetch(
      json({ query: { pages: [{ title: "Alan Turing", revisions: [{ timestamp: "2026-10-12T08:30:00Z" }] }] } }),
    );
    await expect(fetchLastEdited("Turing", { fetch: fetcher })).resolves.toEqual(new Date("2026-10-12T08:30:00Z"));

    const params = new URL(String(fetcher.mock.calls[0][0])).searchParams;
    expect(params.get("prop")).toBe("revisions");
    expect(params.get("titles")).toBe("Turing");
    expect(params.get("redirects")).toBe("1");
  });

  it("resolves to null instead of throwing", async () => {
    await expect(fetchLastEdited("A", { fetch: mockFetch(json({ query: { pages: [{ missing: true }] } })) })).resolves.toBeNull();
    await expect(fetchLastEdited("A", { fetch: mockFetch(new Response("", { status: 503 })), retries: 0 })).resolves.toBeNull();
    await expect(fetchLastEdited("A", { fetch: mockFetch(new TypeError("Failed to fetch")) })).resolves.toBeNull();
  });
});

describe("getWikipediaHistoryUrl", () => {
  it("links to the article's revision history", () => {
    expect(getWikipediaHistoryUrl("Alan Turing")).toBe("https://en.wikipedia.org/w/index.php?title=Alan_Turing&action=history");
  });
});

describe("fetchImageCredit", () => {
  const credit = (extmetadata: unknown) => mockFetch(json({ query: { pages: [{ imageinfo: [{ extmetadata }] }] } }));

  it("asks Commons metadata for the file and reads its author and license as text", async () => {
    const fetcher = credit({
      Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Jane">Jane  Doe</a>' },
      LicenseShortName: { value: "CC BY-SA 4.0" },
      LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" },
    });
    await expect(fetchImageCredit("Bridge.jpg", { fetch: fetcher })).resolves.toEqual({
      artist: "Jane Doe",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    });

    const params = new URL(String(fetcher.mock.calls[0][0])).searchParams;
    expect(params.get("titles")).toBe("File:Bridge.jpg");
    expect(params.get("prop")).toBe("imageinfo");
  });

  it("drops license links that aren't http(s)", async () => {
    const fetcher = credit({ LicenseShortName: { value: "Odd" }, LicenseUrl: { value: "javascript:alert(1)" } });
    await expect(fetchImageCredit("A.jpg", { fetch: fetcher })).resolves.toEqual({ artist: "", license: "Odd", licenseUrl: "" });
  });

  it("resolves to null instead of throwing", async () => {
    await expect(fetchImageCredit("A.jpg", { fetch: mockFetch(json({ query: { pages: [{ missing: true }] } })) })).resolves.toBeNull();
    await expect(fetchImageCredit("A.jpg", { fetch: mockFetch(new TypeError("Failed to fetch")) })).resolves.toBeNull();
  });
});

describe("fetchSummary", () => {
  it("requests the REST summary and normalises it", async () => {
    const fetcher = mockFetch(
      json({
        type: "standard",
        title: "Alan Turing",
        titles: { normalized: "Alan Turing" },
        description: "English computer scientist (1912–1954)",
        extract: "Alan Mathison Turing was an English mathematician.",
        thumbnail: { source: "//upload.wikimedia.org/turing.jpg", width: 330, height: 440 },
      }),
    );

    await expect(fetchSummary("Turing", { fetch: fetcher })).resolves.toEqual({
      title: "Alan Turing",
      description: "English computer scientist (1912–1954)",
      extract: "Alan Mathison Turing was an English mathematician.",
      thumbnail: { src: "https://upload.wikimedia.org/turing.jpg", width: 330, height: 440 },
      disambiguation: false,
    });
    expect(String(fetcher.mock.calls[0][0])).toBe("https://en.wikipedia.org/api/rest_v1/page/summary/Turing");
  });

  it("encodes titles and flags disambiguation pages without thumbnails", async () => {
    const fetcher = mockFetch(json({ type: "disambiguation", title: "AC/DC (disambiguation)", extract: "AC/DC may refer to:" }));
    const summary = await fetchSummary("AC/DC (disambiguation)", { fetch: fetcher });

    expect(String(fetcher.mock.calls[0][0])).toContain("/page/summary/AC%2FDC_(disambiguation)");
    expect(summary).toMatchObject({ disambiguation: true, thumbnail: null, description: "" });
  });

  it("maps missing pages and unreadable bodies to errors", async () => {
    await expectKind(fetchSummary("Nope", { fetch: mockFetch(new Response("", { status: 404 })) }), "not_found");
    await expectKind(fetchSummary("Odd", { fetch: mockFetch(json({ type: "standard" })) }), "invalid");
  });
});

describe("fetchArticle extras", () => {
  it("reads the redirect source, languages and visible categories", async () => {
    const fetcher = mockFetch(
      json({
        parse: {
          title: "Alan Turing",
          text: { "*": "<p>Hi</p>" },
          redirects: [{ from: "Turing", to: "Alan Turing" }],
          langlinks: [{ lang: "fr", url: "https://fr.wikipedia.org/wiki/Alan_Turing", langname: "French", autonym: "français", "*": "Alan Turing" }],
          categories: [{ "*": "Pages_with_errors", hidden: "" }, { "*": "British_cryptographers" }],
          properties: [{ name: "wikibase_item", "*": "Q7251" }, { name: "wikibase-badge-Q17437796", "*": "" }],
        },
      }),
    );
    const article = await fetchArticle("Turing", { fetch: fetcher });
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("prop")).toBe("text|langlinks|categories|properties|revid");
    expect(article.redirectedFrom).toBe("Turing");
    expect(article.languages).toEqual([{ code: "fr", name: "French", autonym: "français", title: "Alan Turing", url: "https://fr.wikipedia.org/wiki/Alan_Turing" }]);
    expect(article.categories).toEqual(["British cryptographers"]);
    expect(article.badge).toBe("featured");
    expect(article.disambiguation).toBe(false);
  });

  it("recognises disambiguation pages", async () => {
    const fetcher = mockFetch(json({ parse: { title: "Mercury", text: { "*": "<p>Mercury may refer to:</p>" }, properties: [{ name: "disambiguation", "*": "" }] } }));
    const article = await fetchArticle("Mercury", { fetch: fetcher });
    expect(article.disambiguation).toBe(true);
    expect(article.badge).toBeNull();
  });
});

describe("fetchRelatedArticles", () => {
  it("returns morelike results in rank order", async () => {
    const fetcher = mockFetch(
      json({
        query: {
          pages: [
            { title: "Second", index: 2, description: "two" },
            { title: "First", index: 1, thumbnail: { source: "//upload.wikimedia.org/first.jpg" } },
          ],
        },
      }),
    );
    await expect(fetchRelatedArticles("Alan Turing", { fetch: fetcher })).resolves.toEqual([
      { title: "First", description: "", thumbnail: "https://upload.wikimedia.org/first.jpg" },
      { title: "Second", description: "two", thumbnail: "" },
    ]);
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("gsrsearch")).toBe("morelike:Alan Turing");
  });
});
