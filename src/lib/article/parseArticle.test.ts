import { describe, expect, it } from "vitest";
import { parseArticle } from "./parseArticle";
import { DUPLICATE_HEADINGS, EDIT_AFFORDANCES, GALLERY_ARTICLE, INFOBOX_ARTICLE, ORDINARY_ARTICLE, SKIPPED_LEVELS } from "./fixtures/articles";
import type { HtmlBlock, ImagesBlock, InfoboxRow, ParsedArticle } from "./types";

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

  it("tags small images inside text and lists as inline icons", () => {
    const list = htmlBlocks(article).find((block) => block.kind === "list")!;
    expect(list.html).toMatch(/<img[^>]*Tiny\.png[^>]*class="inline-icon"|<img[^>]*class="inline-icon"[^>]*Tiny\.png/);
  });

  it("ignores icon-sized images such as map markers", () => {
    const sources = imageBlocks(article).flatMap((block) => block.images.map((image) => image.src));
    expect(sources.some((src) => src.includes("Marker.svg"))).toBe(false);
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

describe("parseArticle infobox", () => {
  const { infobox, blocks } = parse(INFOBOX_ARTICLE, "Poland");
  // succession rows hold structured entries instead of HTML
  const rowHtml = (row: InfoboxRow | undefined) => (row && "html" in row ? row.html : "");
  const dataRow = (label: string) => infobox!.rows.find((row) => row.kind === "data" && row.label === label);

  it("lifts the infobox out of the article body", () => {
    expect(infobox).not.toBeNull();
    expect(blocks.every((block) => block.type !== "html" || !block.html.includes("Warsaw"))).toBe(true);
  });

  it("reads the title and the rows in order", () => {
    expect(infobox!.title).toContain("Republic of Poland");
    expect(infobox!.title).toContain("Rzeczpospolita Polska");
    expect(infobox!.rows.map((row) => row.kind)).toEqual([
      "full",
      "full",
      "full",
      "data",
      "header",
      "data",
      "data",
      "data",
      "succession",
    ]);

    const capital = infobox!.rows.find((row) => row.kind === "data");
    expect(capital).toMatchObject({ kind: "data", label: "Capital" });
    expect(rowHtml(capital)).toContain('href="/wiki/Warsaw"');
  });

  it("drops players, hidden rows, empty rows and extra switcher maps", () => {
    const html = infobox!.rows.map(rowHtml).join("");
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("secret");
    expect(html).not.toContain("Show globe");
    expect(html).toContain("Globe.svg");
    expect(html).not.toContain("Europe.svg");
  });

  it("unwraps image links and indexes article-sized images for the viewer", () => {
    const html = infobox!.rows.map(rowHtml).join("");
    expect(html).not.toContain("mw-file-description");
    expect(infobox!.images.map((image) => image.alt)).toEqual(["Flag", "Globe"]);
    expect(html).toContain('<button type="button" class="zoom-image" data-lightbox-index="0" aria-label="View full screen: Flag">');
    expect(html).toContain('data-lightbox-index="1"');
    // the 16px coordinates icon is an inline icon, not a viewer image
    expect(html).toMatch(/Coords\.svg[^>]*class="inline-icon"|class="inline-icon"[^>]*Coords\.svg/);
  });

  it("shows short collapsible lists plainly and turns long ones into <details>", () => {
    const languages = rowHtml(dataRow("Regional languages"));
    expect(languages).not.toContain(">List<");
    expect(languages).toContain("Belarusian");
    expect(languages).not.toContain("<details");

    expect(rowHtml(dataRow("Cities"))).toContain('<details class="infobox-collapsible"><summary>Major cities (7)</summary>');
  });

  it("reads preceded-by / succeeded-by blocks into flag + name entries", () => {
    const succession = infobox!.rows.find((row) => row.kind === "succession")!;
    if (succession.kind !== "succession") throw new Error("expected a succession row");

    expect(succession.before.map((entry) => entry.html)).toEqual([
      '<a href="/wiki/Kingdom_of_Poland">Kingdom of Poland</a>',
      '<a href="/wiki/German_Empire">German Empire</a>',
    ]);
    expect(succession.before[0].icon).toContain("Flag_A.svg");
    // the flag sits after the name on this side in Wikipedia's markup; it's still picked up as the icon
    expect(succession.after).toEqual([{ icon: expect.stringContaining("Flag_C.svg"), html: '<a href="/wiki/Soviet_Union">Soviet Union</a>' }]);
  });

  it("is null for articles without one", () => {
    expect(parse(SKIPPED_LEVELS).infobox).toBeNull();
  });
});

describe("parseArticle edit affordances", () => {
  const article = parse(EDIT_AFFORDANCES, "Bee");
  const html = allHtml(article);
  const infoboxHtml = [
    article.infobox!.title,
    ...article.infobox!.rows.map((row) => (row.kind === "data" ? row.label + row.html : "html" in row ? row.html : "")),
  ].join("");

  it("removes section edit links, update prompts and template bars", () => {
    expect(html).not.toMatch(/action=edit(?!.*redlink)/);
    expect(html).not.toContain("[update]");
    expect(html).not.toContain("mw-editsection");
    expect(html).not.toContain("Template:Bees");
  });

  it("removes Wikidata and taxonomy pencils, in the body and the infobox", () => {
    expect(html).not.toContain("Edit this");
    expect(html).not.toContain("wikidata.org");
    expect(infoboxHtml).not.toContain("Edit this");
    expect(infoboxHtml).not.toContain("Template:Taxonomy");
    expect(infoboxHtml).toContain("Rusty patched bumble bee");
    expect(infoboxHtml).toContain("example.org");
  });

  it("removes editor-only citation maintenance notes but keeps the citation", () => {
    expect(html).not.toContain("CS1 maint");
    expect(html).toContain("Bee book.");
  });

  it("keeps red links as text and images that merely mention editing", () => {
    expect(html).toContain("an unwritten bee</span>");
    expect(html).toContain("Edith Bee portrait");
  });
});

describe("parseArticle images", () => {
  const article = parse(GALLERY_ARTICLE, "Bridges");
  const gallery = htmlBlocks(article).find((block) => block.html.includes("gallery"))!;

  it("turns gallery photos into viewer buttons, captioned by their gallery text", () => {
    expect(gallery.images?.map((image) => image.alt)).toEqual(["A stone bridge", ""]);
    expect(gallery.images?.[0].caption).toContain('href="/wiki/Old_Bridge"');
    expect(gallery.images?.[1].caption).toBe("Its plan");
    expect(gallery.html).toContain('<button type="button" class="zoom-image" data-lightbox-index="0" aria-label="View full screen: A stone bridge">');
    expect(gallery.html).toContain('data-lightbox-index="1" aria-label="View image full screen"');
    // a click should zoom, not open the File: page
    expect(gallery.html).not.toContain("mw-file-description");
  });

  it("records each image's file", () => {
    expect(gallery.images?.map((image) => image.fileName)).toEqual(["Bridge.jpg", "Bridge_plan.svg"]);
  });

  it("puts possibly transparent images, but not photos or invertible ones, on a light backing", () => {
    const [map, graph] = imageBlocks(article)[0].images;
    expect(map.lightBacking).toBe(true);
    expect(graph.invertInDarkMode).toBe(true);
    expect(graph.lightBacking).toBe(false);
    expect(gallery.images?.map((image) => image.lightBacking)).toEqual([false, true]);
    expect(gallery.html).toMatch(/Bridge_plan\.svg[^>]*class="light-backing"|class="light-backing"[^>]*Bridge_plan\.svg/);
  });

  it("leaves blocks without viewer images alone", () => {
    expect(htmlBlocks(article).find((block) => block.kind === "paragraph")).not.toHaveProperty("images");
  });
});
