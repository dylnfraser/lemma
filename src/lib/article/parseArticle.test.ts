import { describe, expect, it } from "vitest";
import { parseArticle } from "./parseArticle";
import { DUPLICATE_HEADINGS, ORDINARY_ARTICLE, SKIPPED_LEVELS } from "./fixtures/articles";
import type { HtmlBlock, ImagesBlock, ParsedArticle } from "./types";

const parse = (text: string, title = "Pi") => parseArticle({ title, text });

const htmlBlocks = (article: ParsedArticle) =>
  article.blocks.filter((block): block is HtmlBlock => block.type === "html");
const imageBlocks = (article: ParsedArticle) =>
  article.blocks.filter((block): block is ImagesBlock => block.type === "images");
const allHtml = (article: ParsedArticle) => htmlBlocks(article).map((block) => block.html).join("\n");

describe("parseArticle", () => {
  const article = parse(ORDINARY_ARTICLE);

  it("captures the short description before removing it", () => {
    expect(article.description).toBe("Mathematical constant");
  });

  it("keeps the lead image with its caption", () => {
    const [lead] = imageBlocks(article)[0].images;
    expect(lead.alt).toBe("A diagram of a circle");
    expect(lead.caption).toContain("circumference");
    expect(lead.caption).toContain('href="/wiki/Circumference"');
    expect(lead.width).toBe(250);
    expect(lead.invertInDarkMode).toBe(true);
    expect(article.blocks[0].type).toBe("images");
  });

  it("drops infoboxes, hatnotes, navboxes, layout tables and empty elements", () => {
    const html = allHtml(article);
    expect(html).not.toContain("Infobox.jpg");
    expect(html).not.toContain("For other uses");
    expect(html).not.toContain("Navigation box paragraph");
    expect(html).not.toContain("Layout table paragraph");
    expect(html).not.toContain("Mathematical constant</div>");
    expect(html).not.toContain("mw-empty-elt");
  });

  it("removes every style tag without eating the text between them", () => {
    const html = allHtml(article);
    expect(html).not.toContain("<style");
    expect(html).toContain("It is approximately");
    expect(html).toContain("22/7");
    expect(html).toContain("See also");
  });

  it("sanitizes event handlers and scripts", () => {
    expect(allHtml(article)).not.toContain("onerror");
  });

  it("does not duplicate images that live inside paragraphs or lists", () => {
    const sources = imageBlocks(article).flatMap((block) => block.images.map((image) => image.src));
    expect(sources.some((src) => src.includes("math/render"))).toBe(false);
    expect(sources.some((src) => src.includes("Tiny.png"))).toBe(false);
    expect(allHtml(article)).toContain("mwe-math-fallback-image-inline");
  });

  it("groups adjacent images and only upscales files that are large enough", () => {
    const group = imageBlocks(article).find((block) => block.images.length === 2)!;
    const [small, big] = group.images;
    expect(small.src).toContain("500px-Small.jpg");
    expect(small.caption).toBe("");
    expect(big.src).toContain("960px-Big.jpg");
    expect(big.src.startsWith("https://")).toBe(true);
  });

  it("emits nested lists once, inside their parent list", () => {
    const lists = htmlBlocks(article).filter((block) => block.kind === "list");
    expect(lists).toHaveLength(1);
    expect(lists[0].html).toContain("Nested item");
  });

  it("keeps wikitables and blockquotes as single blocks", () => {
    const table = htmlBlocks(article).find((block) => block.kind === "table")!;
    expect(table.html).toContain("<caption>Digits</caption>");
    expect(htmlBlocks(article).filter((block) => block.html.includes("<p>3</p>"))).toHaveLength(1);

    const quote = htmlBlocks(article).find((block) => block.kind === "quote")!;
    expect(quote.html).toContain("A quotation paragraph.");
    expect(htmlBlocks(article).filter((block) => block.html.includes("A quotation paragraph."))).toHaveLength(1);
  });

  it("rewrites links for Lemma", () => {
    const html = allHtml(article);
    expect(html).toContain('href="/wiki/Mathematical_constant"');
    expect(html).toContain('href="/wiki/Euler\'s_identity#Explanation"');
    expect(html).toContain('href="https://en.wikipedia.org/wiki/Category:Real_numbers"');
    expect(html).toContain('href="https://en.wikipedia.org/wiki/Help:IPA"');
    expect(html).toMatch(/<a href="https:\/\/www\.example\.com\/pi" class="external text" target="_blank" rel="noopener noreferrer">/);
    expect(html).toContain('href="https://fr.wikipedia.org/wiki/Pi"');
    // Wikipedia's own non-article pages open in a new tab without the external-site marker.
    expect(html).toMatch(/<a href="https:\/\/en\.wikipedia\.org\/wiki\/Help:IPA" target="_blank" rel="noopener noreferrer">/);
    expect(html).toContain('href="#cite_note-1"');
  });

  it("turns red links into plain text", () => {
    const html = allHtml(article);
    expect(html).not.toContain("redlink=1");
    expect(html).toContain('<span class="redlink"');
    expect(html).toContain("an unwritten topic</span>");
  });

  it("builds the outline tree", () => {
    const byId = Object.fromEntries(article.headings.map((heading) => [heading.id, heading]));
    expect(article.headings.map((heading) => heading.id)).toEqual([
      "Fundamentals",
      "Name",
      "Früher_Gebrauch",
      "Footnote_heading",
      "Data",
      "References",
    ]);
    expect(byId.Name.parentId).toBe("Fundamentals");
    expect(byId.Fundamentals.childIds).toEqual(["Name"]);
    expect(byId.Footnote_heading.ancestorIds).toEqual(["Fundamentals", "Name", "Früher_Gebrauch"]);
    expect(byId.Data.ancestorIds).toEqual([]);
  });

  it("records foldable section ancestry on every block", () => {
    const deep = htmlBlocks(article).find((block) => block.html.includes("Deep content"))!;
    expect(deep.sectionIds).toEqual(["Fundamentals", "Name", "Früher_Gebrauch"]);

    // H5 headings aren't foldable, so content beneath them belongs to the enclosing H4.
    const underH5 = htmlBlocks(article).find((block) => block.html.includes("Under an H5"))!;
    expect(underH5.sectionIds).toEqual(["Fundamentals", "Name", "Früher_Gebrauch"]);

    const intro = article.blocks[1];
    expect(intro.sectionIds).toEqual([]);
  });

  it("maps citation and heading anchors to their blocks", () => {
    const referenceIndex = article.anchors["cite_note-1"];
    expect(article.blocks[referenceIndex]).toMatchObject({ type: "html", kind: "references" });

    const citationIndex = article.anchors["cite_ref-1"];
    expect((article.blocks[citationIndex] as HtmlBlock).html).toContain("mathematical constant");

    expect(article.blocks[article.anchors.Data]).toMatchObject({ type: "heading" });
  });

  it("counts words and links but not references, citations or tables", () => {
    expect(article.stats.links).toBe(7);
    expect(article.stats.words).toBeGreaterThan(70);
    expect(article.stats.words).toBeLessThan(110);
    expect(article.stats.readingMinutes).toBe(1);
  });
});

describe("parseArticle headings", () => {
  it("gives every heading a unique, non-empty id", () => {
    const { headings } = parse(DUPLICATE_HEADINGS);
    expect(headings.map((heading) => heading.id)).toEqual(["History", "History_2"]);
  });

  it("handles skipped heading levels", () => {
    const { headings, blocks } = parse(SKIPPED_LEVELS);
    const byId = Object.fromEntries(headings.map((heading) => [heading.id, heading]));

    expect(byId.A_deep.parentId).toBe("A");
    expect(byId.A_mid.parentId).toBe("A");
    expect(byId.B.parentId).toBeNull();

    const aMid = blocks.find((block) => block.type === "html" && block.html.includes("a mid"))!;
    expect(aMid.sectionIds).toEqual(["A", "A_mid"]);
  });
});
