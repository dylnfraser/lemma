import { describe, expect, it } from "vitest";
import { compressLabels, foldCitationPages, groupCitationRuns } from "./citations";

const root = (html: string) => new DOMParser().parseFromString(`<body><p>${html}</p></body>`, "text/html").body;
const cite = (n: number | string, id = `cite_ref-${n}`) =>
  `<sup id="${id}" class="reference"><a href="#cite_note-${n}"><span class="cite-bracket">[</span>${n}<span class="cite-bracket">]</span></a></sup>`;

describe("foldCitationPages", () => {
  it("moves a citation's page into the citation and out of the text", () => {
    const body = root(`Text.${cite(38)}<sup class="reference nowrap"><span title="Page / location: 70">:&#8202;70&#8202;</span></sup> More.`);
    foldCitationPages(body);
    expect(body.querySelectorAll("sup")).toHaveLength(1);
    expect(body.querySelector("sup")!.dataset.at).toBe("Page 70");
    expect(body.textContent).toBe("Text.[38] More.");
  });

  it("names a page range as pages", () => {
    const body = root(`${cite(4)}<sup class="reference nowrap"><span title="Pages: 3–5">:3–5</span></sup>`);
    foldCitationPages(body);
    expect(body.querySelector("sup")!.dataset.at).toBe("Pages 3–5");
  });
});

describe("compressLabels", () => {
  it("shortens consecutive numbers to a range", () => {
    expect(compressLabels(["4", "5", "6", "7"])).toBe("4–7");
    expect(compressLabels(["3", "8", "9"])).toBe("3, 8, 9");
    expect(compressLabels(["1", "2", "3", "9", "10", "11"])).toBe("1–3, 9–11");
    expect(compressLabels(["a", "b", "c"])).toBe("a, b, c");
  });
});

describe("groupCitationRuns", () => {
  it("makes one marker of three or more citations in a row, keeping their ids for back-links", () => {
    const body = root(`Claim.${cite(4)}${cite(5)}${cite(6)}${cite(7)} Next.${cite(8)}${cite(9)}`);
    groupCitationRuns(body);
    const group = body.querySelector<HTMLElement>(".citation-group")!;
    const link = group.querySelector("a")!;
    expect(link.textContent).toBe("4–7");
    expect(link.getAttribute("href")).toBe("#cite_note-4");
    expect(link.dataset.refs).toBe("cite_note-4 cite_note-5 cite_note-6 cite_note-7");
    expect([...group.querySelectorAll("span[id]")].map((span) => span.id)).toEqual(["cite_ref-4", "cite_ref-5", "cite_ref-6", "cite_ref-7"]);
    // a pair stays as it is
    expect(body.querySelectorAll("sup.reference:not(.citation-group)")).toHaveLength(2);
  });
});
