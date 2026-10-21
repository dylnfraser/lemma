import { describe, expect, it, vi } from "vitest";
import { fetchArticle, searchArticles, WikipediaError } from "./wikipedia";

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

    await expect(fetchArticle("Turing early life", { fetch: fetcher })).resolves.toEqual({
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
    await expectKind(fetchArticle("A", { fetch: mockFetch(new Response("", { status: 503 })) }), "http");
    await expectKind(fetchArticle("A", { fetch: mockFetch(new Response("<html>", { status: 200 })) }), "invalid");
    await expectKind(fetchArticle("A", { fetch: mockFetch(json({ parse: { title: "A" } })) }), "invalid");
    await expectKind(fetchArticle("A", { fetch: mockFetch(new TypeError("Failed to fetch")) }), "offline");
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
