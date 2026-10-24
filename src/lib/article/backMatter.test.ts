import { describe, expect, it } from "vitest";
import {
  chipIdentifiers,
  foldArchiveNotes,
  markExplanatoryNotes,
  markExternalLinks,
  markSeeAlso,
  markYearLists,
  sourceListFilter,
  tidyBacklinks,
} from "./backMatter";

const root = (html: string) => new DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body;
const text = (element: Element) => element.textContent!.replace(/\s+/g, " ").trim();

describe("tidyBacklinks", () => {
  it("turns ^ a b c into one arrow back to the first citation, with the count", () => {
    const body = root(`<ol class="references">
      <li id="n1"><span class="mw-cite-backlink"><b><a href="#cite_ref-1">^</a></b></span> <span class="reference-text">One</span></li>
      <li id="n2"><span class="mw-cite-backlink">^ <a href="#r2-0"><sup><i><b>a</b></i></sup></a> <a href="#r2-1"><sup><i><b>b</b></i></sup></a> <a href="#r2-2"><sup><i><b>c</b></i></sup></a></span> <span class="reference-text">Two</span></li>
      <li id="n3"><span class="mw-cite-backlink">^</span> <span class="reference-text">Never cited</span></li>
    </ol>`);
    tidyBacklinks(body);
    const [one, two, three] = body.querySelectorAll(".mw-cite-backlink");
    expect(one.innerHTML).toBe('<a class="backlink" href="#cite_ref-1" title="Back to where it\'s cited">↑</a>');
    expect(two.querySelector("a")!.getAttribute("href")).toBe("#r2-0");
    expect(text(two)).toBe("↑3");
    expect(three.innerHTML).toBe("");
  });
});

describe("foldArchiveNotes", () => {
  it("folds an archive note into an Archived link, keeping the retrieval date", () => {
    const body = root(
      `<cite class="citation book">A Book. <a class="external text" href="https://web.archive.org/web/2020/x">Archived</a> from <a class="external text" href="https://x.org">the original</a> on June 17, 2020<span class="reference-accessdate">. Retrieved November 11, 2019</span>.</cite>`,
    );
    foldArchiveNotes(body);
    const cite = body.querySelector("cite")!;
    expect(cite.querySelector("a.archived")!.getAttribute("href")).toBe("https://web.archive.org/web/2020/x");
    expect(text(cite)).toBe("A Book. Archived Retrieved November 11, 2019.");
  });

  it("folds the Wayback Machine form", () => {
    const body = root(
      `<ul><li><a class="external text" href="https://nasa.gov/moon">NASA</a> <a class="external text" href="https://web.archive.org/web/2023/nasa">Archived</a> July 13, 2023, at the <a href="/wiki/Wayback_Machine">Wayback Machine</a></li></ul>`,
    );
    foldArchiveNotes(body);
    expect(text(body.querySelector("li")!)).toBe("NASA Archived");
  });

  it("folds a plain note when the title links to the archived copy", () => {
    const body = root(
      `<cite class="citation book"><a class="external text" href="https://web.archive.org/web/2016/guide">A Guide</a>. Press. Archived from <a class="external text" href="https://press.org/guide">the original</a> on January 1, 2016.</cite>`,
    );
    foldArchiveNotes(body);
    expect(text(body.querySelector("cite")!)).toBe("A Guide. Press. Archived");
    expect(body.querySelectorAll("a.archived")).toHaveLength(1);
  });
});

describe("chipIdentifiers", () => {
  it("gathers identifiers into labelled chips at the end, with no doubled full stops", () => {
    const body = root(
      `<cite class="citation journal">Binder (1974). <i>The Moon</i>. 11 (2): 53–76. <a href="/wiki/Bibcode_(identifier)">Bibcode</a>:<a class="external text" href="https://ui.adsabs.harvard.edu/abs/1974">1974Moon</a>. <a href="/wiki/Doi_(identifier)">doi</a>:<span class="id-lock-free"><a class="external text" href="https://doi.org/10.1007/x">10.1007/x</a></span>.</cite>`,
    );
    chipIdentifiers(body);
    const cite = body.querySelector("cite")!;
    const chips = [...cite.querySelectorAll<HTMLAnchorElement>(".identifiers a.identifier")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["Bibcode", "DOI"]);
    expect(chips[1].getAttribute("title")).toBe("doi 10.1007/x");
    expect(chips[1].classList.contains("free")).toBe(true);
    expect(text(cite)).toBe("Binder (1974). The Moon. 11 (2): 53–76. BibcodeDOI");
  });

  it("leaves no stray full stops when several identifiers in a row are taken out", () => {
    const body = root(
      `<cite class="citation journal">Reviews. 12 (4): <span class="nowrap">568–</span>591. <a href="/wiki/Bibcode_(identifier)">Bibcode</a>:<a href="https://ui.adsabs.harvard.edu/x">x</a>. <a href="/wiki/Doi_(identifier)">doi</a>:<a href="https://doi.org/y">y</a>. <a href="/wiki/Hdl_(identifier)">hdl</a>:<span class="id-lock-free"><a href="https://hdl.handle.net/z">z</a></span>. <a href="/wiki/ISSN_(identifier)">ISSN</a>&#160;<a href="https://search.worldcat.org/issn/1">1</a>.<span class="reference-accessdate">. Retrieved 1 May 2020</span></cite>`,
    );
    chipIdentifiers(body);
    expect(text(body.querySelector("cite")!)).toBe("Reviews. 12 (4): 568–591. Retrieved 1 May 2020 BibcodeDOIHandleISSN");
  });
});

describe("markExplanatoryNotes", () => {
  it("moves a note's way back to its end", () => {
    const body = root(`<ol class="references" data-mw-group="lower-alpha"><li><span class="mw-cite-backlink"><a href="#r">↑</a></span> <span class="reference-text">An aside.</span></li></ol>`);
    markExplanatoryNotes(body);
    const item = body.querySelector("li")!;
    expect(body.querySelector("ol")!.classList.contains("explanatory")).toBe(true);
    expect(item.lastElementChild!.matches(".mw-cite-backlink")).toBe(true);
  });
});

describe("See also and External links", () => {
  const page = `<div class="mw-heading mw-heading2"><h2 id="See_also">See also</h2></div>
    <ul><li><a href="/wiki/Selenography">Selenography</a>&nbsp;– Study of the surface of the Moon</li><li><a href="/wiki/Tides">Tides</a></li></ul>
    <div class="mw-heading mw-heading2"><h2 id="External_links">External links</h2></div>
    <ul><li><a class="external text" href="https://www.nasa.gov/moon">NASA images</a></li>
    <li><a class="external text" href="https://www.youtube.com/watch">A video</a> on <a href="/wiki/YouTube">YouTube</a></li></ul>`;

  it("splits each See also link from its description", () => {
    const body = root(page);
    markSeeAlso(body);
    const [first, second] = body.querySelectorAll("ul.see-also > li");
    expect(first.querySelector(".see-also-description")!.textContent).toBe("Study of the surface of the Moon");
    expect(second.querySelector(".see-also-description")).toBeNull();
  });

  it("names each external link's site, unless the entry already does", () => {
    const body = root(page);
    markExternalLinks(body);
    const sites = [...body.querySelectorAll("ul.external-links li")].map((item) => item.querySelector(".site")?.textContent ?? null);
    expect(sites).toEqual(["nasa.gov", null]);
  });
});

describe("markYearLists", () => {
  it("gives a list of dated entries a column of years", () => {
    const body = root(`<ul>
      <li>1921 – Nobel Prize in Physics</li><li>1921: Matteucci Medal</li><li>1925 – Copley Medal</li>
      <li>1926 – Gold Medal of the Royal Astronomical Society</li><li>1929–1930 – Max Planck Medal</li></ul>`);
    markYearLists(body);
    const items = [...body.querySelectorAll("ul.year-list > li")];
    expect(items.map((item) => item.querySelector(".year")!.textContent)).toEqual(["1921", "1921", "1925", "1926", "1929–1930"]);
    expect(items[0].querySelector(".year-entry")!.textContent).toBe("Nobel Prize in Physics");
  });

  it("leaves ordinary lists alone", () => {
    const body = root("<ul><li>Apples</li><li>1921 – one</li><li>Pears</li><li>Plums</li></ul>");
    markYearLists(body);
    expect(body.querySelector(".year-list")).toBeNull();
  });
});

describe("sourceListFilter", () => {
  it("counts a bibliography entry as a source only when the footnotes cite it, or under a sources heading", () => {
    const body = root(`
      <ol class="references"><li><a href="#CITEREFSmith2001">Smith 2001</a>, p. 5.</li></ol>
      <div class="mw-heading mw-heading2"><h2>Bibliography</h2></div>
      <ul><li id="cited"><cite id="CITEREFSmith2001" class="citation book">Smith (2001)</cite></li><li id="own"><cite class="citation book">Own Novel (1950)</cite></li></ul>
      <div class="mw-heading mw-heading2"><h2>Further reading</h2></div>
      <ul><li id="further"><cite class="citation book">Jones (1999)</cite></li></ul>`);
    const isSource = sourceListFilter(body);
    expect(isSource(body.querySelector("#cited")!)).toBe(true);
    expect(isSource(body.querySelector("#own")!)).toBe(false);
    expect(isSource(body.querySelector("#further")!)).toBe(true);
  });
});
