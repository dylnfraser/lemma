import { describe, expect, it } from "vitest";
import { getCollapsibleHeadingIds, isBlockHiddenByCollapsed, isHeadingHiddenByCollapsed } from "./articleNavigation";
import { parseArticle } from "./parseArticle";
import { SKIPPED_LEVELS } from "./fixtures/articles";

const article = parseArticle({ title: "Levels", text: SKIPPED_LEVELS });
const heading = (id: string) => article.headings.find((candidate) => candidate.id === id)!;

describe("article navigation", () => {
  it("lists headings that have children", () => {
    expect(getCollapsibleHeadingIds(article.headings)).toEqual(["A"]);
  });

  it("hides headings under a collapsed ancestor", () => {
    const collapsed = new Set(["A"]);
    expect(isHeadingHiddenByCollapsed(heading("A"), collapsed)).toBe(false);
    expect(isHeadingHiddenByCollapsed(heading("A_mid"), collapsed)).toBe(true);
    expect(isHeadingHiddenByCollapsed(heading("B"), collapsed)).toBe(false);
  });

  it("hides blocks inside collapsed sections only", () => {
    const collapsed = new Set(["A_mid"]);
    const hidden = article.blocks.filter((block) => isBlockHiddenByCollapsed(block, collapsed));
    expect(hidden).toEqual([expect.objectContaining({ type: "html", html: "<p>a mid</p>" })]);
  });
});
