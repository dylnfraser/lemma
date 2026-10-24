/**
 * Facts about the reading layout that depend on more than the window's width (the reader's text size and line width
 * change how much margin is left), measured by ReaderLayout and read wherever the layout branches on them.
 */
export const layout = $state({
  /** Whether the right margin has room for the infobox (otherwise it sits inline, under the article's header). */
  infoboxInMargin: false,
});
