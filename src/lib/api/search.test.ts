import { describe, expect, it, vi } from "vitest";
import { fetchPageCards, getSearchPath, searchFullText, snippetToHtml } from "./search";

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
const mockFetch = (outcome: Response) => vi.fn<typeof fetch>(async () => outcome);

describe("snippetToHtml", () => {
  it("marks matches and escapes everything else", () => {
    expect(snippetToHtml('The <span class="searchmatch">Enigma</span> &quot;machine&quot; <b>x</b> &lt;script&gt;')).toBe(
      'The <mark>Enigma</mark> &quot;machine&quot; x &lt;script&gt;',
    );
  });

  it("drops markup that isn't a match", () => {
    expect(snippetToHtml('<img src=x onerror="alert(1)"><span class="other">a</span>')).toBe("a");
  });
});

describe("searchFullText", () => {
  it("requests article search with suggestions and maps the response", async () => {
    const fetcher = mockFetch(
      json({
        query: {
          searchinfo: { totalhits: 42, suggestion: "enigma machine" },
          search: [{ title: "Enigma machine", snippet: 'An <span class="searchmatch">Enigma</span>', wordcount: 9000 }],
        },
        continue: { sroffset: 20 },
      }),
    );

    await expect(searchFullText("enigma machne", { fetch: fetcher, offset: 0 })).resolves.toEqual({
      results: [{ title: "Enigma machine", snippet: "An <mark>Enigma</mark>", wordCount: 9000 }],
      total: 42,
      suggestion: "enigma machine",
      nextOffset: 20,
    });

    const params = new URL(String(fetcher.mock.calls[0][0])).searchParams;
    expect(params.get("list")).toBe("search");
    expect(params.get("srsearch")).toBe("enigma machne");
    expect(params.get("srnamespace")).toBe("0");
    expect(params.get("srinfo")).toBe("totalhits|suggestion");
  });

  it("reports no next page and no suggestion when there are none", async () => {
    const result = await searchFullText("x", { fetch: mockFetch(json({ query: { search: [] } })) });
    expect(result).toEqual({ results: [], total: 0, suggestion: "", nextOffset: null });
  });
});

describe("fetchPageCards", () => {
  it("keys descriptions and thumbnails by title", async () => {
    const fetcher = mockFetch(
      json({ query: { pages: [{ title: "Pi", description: "Constant", thumbnail: { source: "//x/pi.png" } }, { title: "Tau" }] } }),
    );
    const cards = await fetchPageCards(["Pi", "Tau"], { fetch: fetcher });
    expect(cards.get("Pi")).toEqual({ description: "Constant", thumbnail: "https://x/pi.png" });
    expect(cards.get("Tau")).toEqual({ description: "", thumbnail: "" });
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("titles")).toBe("Pi|Tau");
  });

  it("skips the request for no titles", async () => {
    const fetcher = mockFetch(json({}));
    expect((await fetchPageCards([], { fetch: fetcher })).size).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it("builds search paths", () => {
  expect(getSearchPath(" a & b ")).toBe("/search?q=a%20%26%20b");
});
