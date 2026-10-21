import { describe, expect, it } from "vitest";
import { parseArticle } from "./parseArticle";
import {
  DUPLICATE_HEADINGS,
  EDIT_AFFORDANCES,
  EXTRAS_ARTICLE,
  GALLERY_ARTICLE,
  INFOBOX_ARTICLE,
  LEGEND_ARTICLE,
  ORDINARY_ARTICLE,
  SKIPPED_LEVELS,
} from "./fixtures/articles";
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
    // only the article's hatnote comes before it
    expect(article.blocks.find((block) => !(block.type === "html" && block.kind === "hatnote"))?.type).toBe("images");
  });

  it("drops infoboxes, navboxes and empty elements, but keeps hatnotes and layout tables' content", () => {
    const html = allHtml(article);
    expect(html).not.toContain("Infobox.jpg");
    expect(html).not.toContain("Navigation box paragraph");
    expect(htmlBlocks(article).find((block) => block.kind === "hatnote")?.html).toContain("For other uses");
    // the layout table is unwrapped: its paragraph becomes an ordinary block
    expect(htmlBlocks(article).some((block) => block.kind === "paragraph" && block.html.includes("Layout table paragraph"))).toBe(true);
    expect(html).not.toContain('class="multicol"');
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
    expect(article.stats.links).toBe(8); // includes the hatnote's link
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

  it("keeps audio as a plain player, and drops hidden rows, empty rows and extra switcher maps", () => {
    const html = infobox!.rows.map(rowHtml).join("");
    expect(html).toMatch(/<audio src="anthem\.ogg" controls="" preload="none"><\/audio>/);
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

  it("marks bulleted rows as sub-rows and drops the bullet", () => {
    const president = infobox!.rows.find((row) => row.kind === "data" && row.label.includes("President"));
    expect(president).toMatchObject({ kind: "data", sub: true });
    expect(president && "label" in president && president.label).not.toContain("•");
    expect(infobox!.rows.find((row) => row.kind === "data" && row.label === "Capital")).not.toHaveProperty("sub");
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
  const imageGroup = (alt: string) => imageBlocks(article).find((block) => block.images.some((image) => image.alt === alt))!;
  const gallery = imageGroup("A stone bridge");

  it("turns galleries into their own image group (a fan), captioned by their gallery text", () => {
    expect(gallery.images.map((image) => image.alt)).toEqual(["A stone bridge", ""]);
    expect(gallery.images[0].caption).toContain('href="/wiki/Old_Bridge"');
    expect(gallery.images[1].caption).toBe("Its plan");
    // no longer rendered as an HTML list
    expect(htmlBlocks(article).some((block) => block.html.includes("gallery"))).toBe(false);
    // the figures that follow start a new group instead of joining the gallery's fan
    expect(imageGroup("A map")).not.toBe(gallery);
  });

  it("records each image's file", () => {
    expect(gallery.images.map((image) => image.fileName)).toEqual(["Bridge.jpg", "Bridge_plan.svg"]);
  });

  it("puts possibly transparent images, but not photos or invertible ones, on a light backing", () => {
    const [map, graph] = imageGroup("A map").images;
    expect(map.lightBacking).toBe(true);
    expect(graph.invertInDarkMode).toBe(true);
    expect(graph.lightBacking).toBe(false);
    expect(gallery.images.map((image) => image.lightBacking)).toEqual([false, true]);
  });

});

describe("parseArticle legends", () => {
  const caption = imageBlocks(parse(LEGEND_ARTICLE, "Euro"))[0].images[0].caption;
  const doc = new DOMParser().parseFromString(caption, "text/html");

  it("groups runs of legend entries, keeping other caption text in place", () => {
    const groups = [...doc.querySelectorAll(".legend-group")];
    expect(groups.map((group) => group.querySelectorAll(".legend").length)).toEqual([2, 1]);
    // the italic heading stays between the two groups, in its original position
    expect(groups[0].nextElementSibling?.tagName).toBe("I");
    expect(doc.body.textContent?.indexOf("Non-EU")).toBeGreaterThan(doc.body.textContent!.indexOf("committed"));
  });
});

describe("parseArticle extras", () => {
  const article = parse(EXTRAS_ARTICLE, "Topic");
  const blocksOf = (kind: string) => htmlBlocks(article).filter((block) => block.kind === kind);

  it("keeps hatnotes as their own blocks, not counted as words", () => {
    expect(blocksOf("hatnote")[0].html).toContain('href="/wiki/Topic_history"');
  });

  it("turns pronunciation widgets into play buttons", () => {
    const paragraph = blocksOf("paragraph")[0].html;
    expect(paragraph).toContain('<button type="button" class="pronounce" data-audio="https://upload.wikimedia.org/topic.ogg.mp3"');
    expect(paragraph).not.toContain("ext-phonos");
  });

  it("keeps {{multiple image}} as one group with per-image and shared captions", () => {
    const set = imageBlocks(article).find((block) => block.images.some((image) => image.alt === "Left"))!;
    expect(set.images.map((image) => image.caption)).toEqual(["The left view", "The right view"]);
    expect(set.caption).toBe("Two views Both views, side by side");
  });

  it("keeps legacy frames around tables whole, with their caption", () => {
    const [frame] = blocksOf("figure");
    expect(frame.html).toContain('class="chess-board"');
    expect(frame.html).toContain("A board");
    expect(blocksOf("table").some((block) => block.html.includes("chess-board"))).toBe(false);
  });

  it("keeps video and audio players with clean https sources and captions", () => {
    const [video, audio] = blocksOf("media");
    expect(video.html).toContain('poster="https://upload.wikimedia.org/poster.jpg"');
    expect(video.html).toContain('src="https://upload.wikimedia.org/clip.webm"');
    expect(video.html).toContain("<figcaption>A clip</figcaption>");
    expect(video.html).not.toContain("<track");
    expect(video.html).not.toContain("mwe_player");
    expect(audio.html).toContain('src="https://upload.wikimedia.org/theme.ogg"');
    expect(audio.html).toContain("Played on piano");
    expect(audio.html).toContain("The theme");
  });

  it("unwraps layout tables so their lists flow as blocks", () => {
    const lists = blocksOf("list").map((block) => block.html);
    expect(lists.some((html) => html.includes("/wiki/Alpha"))).toBe(true);
    expect(lists.some((html) => html.includes("/wiki/Beta"))).toBe(true);
  });

  it("keeps sortable and collapsible tables for the reader to enhance", () => {
    expect(blocksOf("table")[0].html).toContain('class="wikitable sortable mw-collapsible"');
  });

  it("turns navboxes and series sidebars into related topics", () => {
    const [sidebar, navbox] = article.related;
    expect(sidebar.title).toContain("Part of a series on");
    expect(sidebar.title).toContain('href="/wiki/Topics"');
    expect(sidebar.groups).toEqual([{ label: "Basics", html: expect.stringContaining("/wiki/Basic_topic") }]);

    expect(navbox.title).toContain('href="/wiki/Topic"');
    expect(navbox.title).not.toContain("Template:Topic"); // the v·t·e bar is gone
    expect(navbox.groups.map((group) => group.label)).toEqual(["People", "Works › Books", ""]);
    // icons stay, pictures go
    expect(navbox.groups[0].html).toContain("inline-icon");
    expect(navbox.groups[2].html).not.toContain("Big.jpg");
    // and the boxes themselves aren't in the article
    expect(allHtml(article)).not.toContain("navbox");
  });

  it("reads sidebars with portrait titles and collapsible groups, without their colours", () => {
    const sidebar = parse(
      `<div class="mw-parser-output"><p>Text.</p><table class="sidebar"><tbody>
        <tr><td><table><tbody><tr><td class="sidebar-person-title" style="background-color:#002466;color:#FFF"><div>This article is part of <br>a series about</div><a class="mw-selflink">Someone</a></td></tr></tbody></table></td></tr>
        <tr><td class="sidebar-content"><hr><div class="hidden-begin mw-collapsible"><div class="hidden-title">Personal</div><div class="hidden-content" style="text-align:center"><ul><li><a href="/wiki/Family">Family</a></li></ul></div></div>
        <div class="hidden-begin mw-collapsible"><div class="hidden-title">Career</div><div class="hidden-content"><ul><li><a href="/wiki/Job">Job</a></li></ul></div></div></td></tr>
      </tbody></table></div>`,
      "Someone",
    ).related[0];
    expect(sidebar.title).toBe("This article is part of a series about Someone");
    expect(sidebar.groups.map((group) => group.label)).toEqual(["Personal", "Career"]);
    expect(sidebar.groups[0].html).not.toContain("style=");
  });

  it("splits wrapper navboxes into their navboxes and skips authority control", () => {
    const wrapped = parse(
      `<div class="mw-parser-output"><p>Text.</p>
      <div class="navbox"><table><tbody><tr><th class="navbox-title">Articles related to X</th></tr><tr><td class="navbox-list">
        <div class="navbox"><table><tbody><tr><th class="navbox-title">First</th></tr><tr><td class="navbox-list"><a href="/wiki/A">A</a></td></tr></tbody></table></div>
        <div class="navbox"><table><tbody><tr><th class="navbox-title">Second</th></tr><tr><td class="navbox-list"><a href="/wiki/B">B</a></td></tr></tbody></table></div>
      </td></tr></tbody></table></div>
      <div class="navbox authority-control"><table><tbody><tr><th class="navbox-title">Authority control</th></tr><tr><td class="navbox-list"><a href="https://viaf.org/1">VIAF</a></td></tr></tbody></table></div>
      </div>`,
      "X",
    );
    expect(wrapped.related.map((topic) => topic.title)).toEqual(["First", "Second"]);
  });

  it("reads multiple-image sets that contain a player item by item", () => {
    const mixed = parse(
      `<div class="mw-parser-output"><div class="thumb tmulti"><div class="thumbinner"><div class="trow">
        <div class="tsingle"><img alt="Still" src="https://upload.wikimedia.org/a/250px-Still.jpg" width="250" height="200" /><div class="thumbcaption">A still</div></div>
        <div class="tsingle"><span><video controls=""><source src="https://upload.wikimedia.org/clip.webm" /></video></span><div class="thumbcaption">The clip</div></div>
      </div></div></div></div>`,
      "X",
    );
    expect(mixed.blocks.map((block) => (block.type === "html" ? block.kind : block.type))).toEqual(["images", "media"]);
    expect(imageBlocks(mixed)[0].images[0].caption).toBe("A still");
    expect(htmlBlocks(mixed).find((block) => block.kind === "media")?.html).toContain("<figcaption>The clip</figcaption>");
  });

  it("keeps TemplateStyles scoped to the article, minus restyled parts, once each", () => {
    expect(article.styles).toContain(".mw-parser-output .quotebox{border:1px solid var(--border-color-base,#a2a9b1);padding:6px}");
    expect(article.styles).toContain("@media screen{.mw-parser-output .chess-board td{width:24px}}");
    expect(article.styles).not.toContain("infobox");
    expect(article.styles).not.toContain("hatnote");
    expect(article.styles).not.toContain("navbox");
    expect(article.styles).not.toContain("global-leak");
    // restyled names cover the classes built from them
    expect(article.styles).not.toContain("legend-color");
    expect(article.styles).not.toContain("border:1px solid red"); // deduplicated
  });
});

describe("parseArticle image sizes", () => {
  const article = parse(
    `<div class="mw-parser-output">
      <figure><img alt="Big" src="//upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Big.jpg/250px-Big.jpg" width="250" height="200" data-file-width="4000" /></figure>
      <div class="thumb"><div class="thumbinner"><div><img alt="Twice" src="//upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Twice.jpg/250px-Twice.jpg" width="200" height="265" /></div><div><img alt="" src="//upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Twice.jpg/250px-Twice.jpg" width="200" height="265" /></div></div></div>
    </div>`,
    "X",
  );
  const images = imageBlocks(article).flatMap((block) => block.images);

  it("records the chosen file's pixel width", () => {
    expect(images[0].pixelWidth).toBe(960);
  });

  it("drops an image repeated straight after itself (image overlays)", () => {
    expect(images.map((image) => image.alt)).toEqual(["Big", "Twice"]);
  });
});
