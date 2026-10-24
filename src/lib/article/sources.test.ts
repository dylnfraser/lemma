import { describe, expect, it } from "vitest";
import { markClaimsNeedingSources } from "./parseArticle";
import { classifySource, markSources } from "./sources";

const root = (html: string) => {
  const document = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return document.body;
};
const reference = (inner: string) => root(`<ol class="references"><li id="cite_note-1">${inner}</li></ol>`).querySelector("li")!;

describe("classifySource", () => {
  it("goes by the citation template's type", () => {
    expect(classifySource(reference('<cite class="citation journal cs1">Smith (2001)</cite>'))).toBe("academic");
    expect(classifySource(reference('<cite class="citation book cs1">A Book</cite>'))).toBe("book");
    expect(classifySource(reference('<cite class="citation news cs1">Headline</cite>'))).toBe("news");
    expect(classifySource(reference('<cite class="citation magazine cs1">Feature</cite>'))).toBe("news");
  });

  it("goes by where a web citation links", () => {
    const web = (href: string) => reference(`<cite class="citation web cs1"><a class="external" href="${href}">Page</a></cite>`);
    expect(classifySource(web("https://www.nytimes.com/2020/story"))).toBe("news");
    expect(classifySource(web("https://www.census.gov/data"))).toBe("government");
    expect(classifySource(web("https://www.gov.uk/guidance"))).toBe("government");
    expect(classifySource(web("https://data.gov.uk/x"))).toBe("government");
    expect(classifySource(web("https://www.ox.ac.uk/research"))).toBe("academic");
    expect(classifySource(web("https://doi.org/10.1000/xyz"))).toBe("academic");
    expect(classifySource(web("https://example.com/blog"))).toBe("web");
  });

  it("follows a short footnote to the work it cites", () => {
    const body = root(`
      <ol class="references"><li id="cite_note-2"><a href="#CITEREFSmith2001">Smith 2001</a>, p. 5.</li></ol>
      <ul><li><cite id="CITEREFSmith2001" class="citation book cs1">Smith, J. (2001). A Book.</cite></li></ul>`);
    expect(classifySource(body.querySelector("#cite_note-2")!)).toBe("book");
  });

  it("recognises a book by its ISBN, and leaves explanatory notes out", () => {
    expect(classifySource(reference('Smith, A Book, <a href="/wiki/Special:BookSources/978-0">ISBN 978-0</a>'))).toBe("book");
    expect(classifySource(reference("The name is also spelled differently in older sources."))).toBeNull();
  });
});

describe("markSources", () => {
  it("labels the footnotes and counts their kinds, and labels bibliography entries without counting them", () => {
    const body = root(`
      <ol class="references">
        <li><cite class="citation news cs1">A</cite></li>
        <li><cite class="citation news cs1">B</cite></li>
        <li><cite class="citation journal cs1">C</cite></li>
        <li>An explanatory note.</li>
      </ol>
      <ul><li><cite class="citation book cs1">D</cite></li></ul>`);
    expect(markSources(body)).toEqual({ academic: 1, news: 2, book: 0, government: 0, web: 0 });
    expect([...body.querySelectorAll("li")].map((li) => li.dataset.source ?? "")).toEqual(["news", "news", "academic", "", "book"]);
  });
});

describe("markClaimsNeedingSources", () => {
  it("gives each flagged claim an id, in reading order", () => {
    const body = root('<p>One<sup class="noprint Inline-Template Template-Fact">[citation needed]</sup> two<sup class="Template-Fact">[better source needed]</sup></p>');
    expect(markClaimsNeedingSources(body)).toEqual(["lemma-flag-1", "lemma-flag-2"]);
    expect(body.querySelector(".Template-Fact")!.id).toBe("lemma-flag-1");
  });
});
