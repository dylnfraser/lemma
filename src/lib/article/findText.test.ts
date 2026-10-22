import { describe, expect, it } from "vitest";
import { collectText, findTextRanges, htmlContains } from "./findText";

const html = (markup: string) => {
  const root = document.createElement("div");
  root.innerHTML = markup;
  return root;
};

describe("findTextRanges", () => {
  it("matches case-insensitively, across inline markup and loose whitespace", () => {
    const root = html("<p>Ala<b>n</b>   Turing was a mathematician. ALAN turing!</p>");
    const ranges = findTextRanges(root, "alan turing");
    expect(ranges.map((range) => range.toString())).toEqual(["Alan   Turing", "ALAN turing"]);
  });

  it("doesn't run text from separate blocks together", () => {
    const root = html("<p>first end</p><p>start second</p>");
    expect(collectText(root).text).toBe("first end start second");
    expect(findTextRanges(root, "endstart")).toHaveLength(0);
    expect(findTextRanges(root, "end start")).toHaveLength(1);
  });

  it("skips controls and screen-reader copies", () => {
    const root = html('<p>Text <button>Show</button><span class="sr-only">show hidden</span> shown</p>');
    // only "shown" in the text itself: the button's "Show" and the hidden copy don't count
    expect(findTextRanges(root, "show").map((range) => range.toString())).toEqual(["show"]);
    expect(findTextRanges(root, "hidden")).toHaveLength(0);
  });

  it("respects the limit and ignores empty queries", () => {
    const root = html("<p>a a a a a</p>");
    expect(findTextRanges(root, "a", { limit: 3 })).toHaveLength(3);
    expect(findTextRanges(root, "   ")).toHaveLength(0);
  });
});

it("checks HTML that isn't on the page", () => {
  expect(htmlContains("<p>The <i>Enigma</i>  machine</p>", "enigma machine")).toBe(true);
  expect(htmlContains("<p>Bombe</p>", "enigma")).toBe(false);
});
