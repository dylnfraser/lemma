import type { ArticleBlock, ArticleHeading } from "./types";

export function headingHasChildren(heading: ArticleHeading): boolean {
  return heading.childIds.length > 0;
}

export function getCollapsibleHeadingIds(headings: readonly ArticleHeading[]): string[] {
  return headings.filter(headingHasChildren).map((heading) => heading.id);
}

export function isHeadingHiddenByCollapsed(heading: ArticleHeading, collapsedIds: ReadonlySet<string>): boolean {
  return heading.ancestorIds.some((id) => collapsedIds.has(id));
}

export function isBlockHiddenByCollapsed(block: ArticleBlock, collapsedIds: ReadonlySet<string>): boolean {
  return block.sectionIds.some((id) => collapsedIds.has(id));
}
