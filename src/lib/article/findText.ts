/**
 * Finding text in rendered article HTML: case-insensitive, with any run of whitespace matching any other, and matches
 * free to span inline markup ("Ala<b>n</b> Turing"). Text in different blocks (paragraphs, cells) never runs together.
 */

const BLOCK_SELECTOR = "p, li, dd, dt, td, th, caption, figcaption, blockquote, h1, h2, h3, h4, h5, h6, div, section, header, aside, pre";
// Text that's on the page but isn't the article's to search: controls, screen-reader copies, decorative bits.
const SKIP_SELECTOR = "button, style, script, .sr-only, [aria-hidden='true'], .mw-cite-backlink";

type Position = { node: Text; offset: number } | null;

/** Lower-case, whitespace-collapsed text of `root`, with each character mapped back to where it came from. */
export function collectText(root: Element, include: (node: Text) => boolean = () => true) {
  let text = "";
  // null marks a space inserted between blocks: there's no character there in the DOM
  const map: Position[] = [];
  let lastBlock: Element | null = null;

  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP_SELECTOR) || !include(node as Text)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const block = node.parentElement?.closest(BLOCK_SELECTOR) ?? null;
    if (block !== lastBlock && text && !text.endsWith(" ")) {
      text += " ";
      map.push(null);
    }
    lastBlock = block;

    const value = node.data;
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      if (/\s/.test(char)) {
        if (text.endsWith(" ") || !text) continue;
        text += " ";
      } else {
        const lower = char.toLowerCase();
        // a few characters lower-case to two (e.g. "İ"); keep the original so positions stay one-to-one
        text += lower.length === 1 ? lower : char;
      }
      map.push({ node, offset: i });
    }
  }
  return { text, map };
}

/** Normalises a query the same way `collectText` normalises the page. */
export function normalizeQuery(query: string): string {
  return [...query.replace(/\s+/g, " ").trim()].map((char) => (char.toLowerCase().length === 1 ? char.toLowerCase() : char)).join("");
}

/** Every match of `query` in `root`, as DOM ranges in document order (at most `limit`). */
export function findTextRanges(root: Element, query: string, { limit = 1000, include }: { limit?: number; include?: (node: Text) => boolean } = {}): Range[] {
  const needle = normalizeQuery(query);
  if (!needle) return [];
  const { text, map } = collectText(root, include);
  const ranges: Range[] = [];

  for (let index = text.indexOf(needle); index !== -1 && ranges.length < limit; index = text.indexOf(needle, index + needle.length)) {
    let first = index;
    while (first < index + needle.length && !map[first]) first++;
    let last = index + needle.length - 1;
    while (last >= first && !map[last]) last--;
    const start = map[first];
    const end = map[last];
    if (!start || !end) continue;

    const range = root.ownerDocument.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset + 1);
    ranges.push(range);
  }
  return ranges;
}

/** Whether `html`'s text contains `query`, by the same rules (for content that isn't on the page, like folded sections). */
export function htmlContains(html: string, query: string, parse = (markup: string) => new DOMParser().parseFromString(markup, "text/html").body): boolean {
  const needle = normalizeQuery(query);
  return !!needle && collectText(parse(html)).text.includes(needle);
}
