import { normalizeProtocol } from "$lib/api/wikipedia";
import { rewriteArticleLink } from "./articleLinks";
import { EDIT_AFFORDANCE_SELECTOR } from "./articleUtils";
import type { RelatedTopics } from "./types";

// Parts of Wikipedia's article HTML that Lemma keeps in a different shape than Wikipedia renders them.

const textOf = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";

/** An element's text with its links kept and everything else (tables, colour spans, line breaks) flattened. */
function textAndLinks(element: Element | null | undefined): string {
  if (!element) return "";
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
  copy.querySelectorAll("img").forEach((image) => image.remove());
  // unwrap innermost-first so nested wrappers all go
  for (const child of [...copy.querySelectorAll("*")].reverse()) {
    if (child.tagName === "A" && child.getAttribute("href")) continue;
    child.replaceWith(" ", ...child.childNodes, " ");
  }
  return copy.innerHTML.replace(/\s+/g, " ").trim();
}

/** Links and icons inside lifted-out content get the same treatment as the article body. */
function prepareFragment(element: Element) {
  element.querySelectorAll(EDIT_AFFORDANCE_SELECTOR).forEach((child) => child.remove());
  // boxes carry their own colours (navy title bars, white text); in a list they'd clash or vanish
  element.querySelectorAll("[style]").forEach((child) => child.removeAttribute("style"));
  element.querySelectorAll("hr").forEach((rule) => rule.remove());
  element.querySelectorAll("a").forEach(rewriteArticleLink);
  // icons (flags, symbols) stay; pictures don't belong in a list of topics
  element.querySelectorAll("img").forEach((image) => {
    const size = Math.max(Number(image.getAttribute("width")), Number(image.getAttribute("height")));
    if (size > 0 && size < 64) image.classList.add("inline-icon");
    else image.remove();
  });
}

function navboxTopics(navbox: Element): RelatedTopics | null {
  const titleCell = navbox.querySelector(".navbox-title");
  titleCell?.querySelectorAll(".navbar, .mw-collapsible-toggle").forEach((child) => child.remove());
  const title = textAndLinks(titleCell);

  const groups: RelatedTopics["groups"] = [];
  for (const list of navbox.querySelectorAll("td.navbox-list")) {
    // lists that only hold a nested navbox are represented by that navbox's own lists
    if (list.querySelector(".navbox-subgroup, .navbox-list")) continue;
    if (!textOf(list)) continue;
    const row = list.parentElement;
    const label = row?.querySelector(":scope > th.navbox-group")?.innerHTML.trim() ?? "";
    // inside a subgroup, prefix the parent group's label ("Works › Novels")
    const parentRow = list.closest(".navbox-subgroup")?.closest("tr");
    const parentLabel = parentRow?.querySelector(":scope > th.navbox-group")?.innerHTML.trim() ?? "";
    groups.push({ label: parentLabel && label ? `${parentLabel} › ${label}` : label || parentLabel, html: list.innerHTML.trim() });
  }
  if (!title && groups.length === 0) return null;
  return { title: title || "Related", groups };
}

/** Adds a content cell's groups: one per collapsible block ({{hidden}}, sidebar lists), plus any loose content. */
function pushCellGroups(cell: Element, label: string, groups: RelatedTopics["groups"]) {
  const blocks = [...cell.querySelectorAll(".hidden-begin, .sidebar-list")];
  for (const block of blocks) {
    const title = block.querySelector(".hidden-title, .sidebar-list-title");
    const content = block.querySelector(".hidden-content, .sidebar-list-content");
    if (content && textOf(content)) groups.push({ label: title?.innerHTML.trim() ?? label, html: content.innerHTML.trim() });
    block.remove();
  }
  if (textOf(cell)) groups.push({ label: blocks.length ? "" : label, html: cell.innerHTML.trim() });
}

function sidebarTopics(sidebar: Element): RelatedTopics | null {
  // titles come in several layouts (plain, with a pretitle, a person's portrait table); keep their text and links
  const pretitle = textAndLinks(sidebar.querySelector(".sidebar-pretitle"));
  const titleHtml = textAndLinks(sidebar.querySelector(".sidebar-title, .sidebar-title-with-pretitle, .sidebar-person-title"));
  const title = [pretitle, titleHtml].filter(Boolean).join(" ");

  const groups: RelatedTopics["groups"] = [];
  let label = "";
  for (const cell of sidebar.querySelectorAll(".sidebar-heading, .sidebar-content")) {
    if (cell.matches(".sidebar-heading")) {
      label = cell.innerHTML.trim();
    } else {
      pushCellGroups(cell, label, groups);
      label = "";
    }
  }
  if (!title && groups.length === 0) return null;
  return { title: title || "Related", groups };
}

/**
 * Navboxes (the topic grids at the bottom of articles) and series sidebars ("Part of a series on …") are dropped from
 * the reading flow, but the topics they link are how readers find related articles, so they're kept as lists.
 * Call before clutter removal; the boxes themselves are removed with it.
 */
export function extractRelatedTopics(root: Element): RelatedTopics[] {
  const topics: RelatedTopics[] = [];
  // Each navbox that doesn't wrap other navboxes is one topic list: wrappers ({{Navboxes}}, "Articles related to …")
  // only group them. Subgroups are tables, not .navbox, so they stay part of their navbox. Authority control lists
  // library identifiers, not topics.
  const boxes = [...root.querySelectorAll(".navbox, table.sidebar")].filter(
    (box) =>
      !box.closest(".infobox") &&
      !box.matches(".authority-control") &&
      (box.matches("table.sidebar") ? !box.parentElement?.closest(".navbox, table.sidebar") : !box.querySelector(".navbox")),
  );
  for (const box of boxes) {
    const copy = box.cloneNode(true) as Element;
    prepareFragment(copy);
    const topic = copy.matches(".navbox") ? navboxTopics(copy) : sidebarTopics(copy);
    if (topic && topic.groups.length > 0) topics.push(topic);
  }
  return topics;
}

/**
 * Tables Wikipedia uses purely for layout (column lists, side-by-side blocks) are unwrapped so their content flows as
 * ordinary blocks, instead of being dropped along with the table.
 */
export function unwrapLayoutTables(root: Element) {
  const layoutTables = [...root.querySelectorAll('table[role="presentation"], table.col-begin, table.multicol')].filter(
    (table) => !table.closest(".infobox, .navbox, table.sidebar, .wikitable"),
  );
  for (const table of layoutTables) {
    const columns = root.ownerDocument.createElement("div");
    columns.className = "layout-columns";
    for (const cell of table.querySelectorAll(":scope > tbody > tr > td, :scope > tr > td")) {
      if (!textOf(cell) && !cell.querySelector("img")) continue;
      const column = root.ownerDocument.createElement("div");
      column.append(...cell.childNodes);
      columns.append(column);
    }
    table.replaceWith(columns);
  }
}

/** Audio and video sources and posters use protocol-relative URLs; make them https. */
export function normalizeMediaUrls(root: Element) {
  root.querySelectorAll("audio, video, source, track").forEach((element) => {
    for (const attribute of ["src", "poster"]) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, normalizeProtocol(value));
    }
  });
}

/**
 * Pronunciation buttons ({{IPA}} audio) are a script-driven widget on Wikipedia. Each becomes a plain button carrying
 * the clip's URL, played by the article view.
 */
export function convertPronunciations(root: Element) {
  root.querySelectorAll(".ext-phonos").forEach((widget) => {
    let url = "";
    try {
      const config = JSON.parse(widget.querySelector("[data-ooui]")?.getAttribute("data-ooui") ?? "{}");
      url = config.href ?? "";
    } catch {
      // fall through to the link
    }
    url ||= widget.querySelector("a[href]")?.getAttribute("href") ?? "";
    if (!url) {
      widget.remove();
      return;
    }

    const button = root.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "pronounce";
    button.dataset.audio = normalizeProtocol(url);
    button.setAttribute("aria-label", "Listen to the pronunciation");
    button.title = "Listen";
    widget.replaceWith(button);
  });
}

/**
 * The element an audio or video player should be shown with (its figure, its {{listen}} box, or itself), and the
 * player's caption.
 */
export function mediaContainer(player: Element): { container: Element; caption: string } {
  const figure = player.closest("figure");
  if (figure) return { container: figure, caption: figure.querySelector("figcaption")?.innerHTML.trim() ?? "" };

  const listen = player.closest(".haudio");
  if (listen) {
    const header = listen.querySelector(".listen-file-header")?.innerHTML.trim() ?? "";
    const description = listen.querySelector(".description")?.innerHTML.trim() ?? "";
    return { container: listen, caption: [header, description].filter(Boolean).join(" — ") };
  }
  // a cell of a {{multiple image}} set, or a legacy thumbnail frame
  const cell = player.closest(".tsingle, .thumbinner");
  if (cell) return { container: cell, caption: cell.querySelector(".thumbcaption")?.innerHTML.trim() ?? "" };

  return { container: player.closest('[typeof^="mw:File"]') ?? player, caption: "" };
}

/** A clean player figure: the native controls, sources, poster and caption, nothing else. */
export function mediaHtml(player: Element, caption: string): string {
  const copy = player.cloneNode(true) as HTMLMediaElement;
  for (const attribute of ["id", "style", "width", "height", "class", "data-mw-tmh", "data-durationhint"]) {
    copy.removeAttribute(attribute);
  }
  copy.setAttribute("controls", "");
  copy.setAttribute("preload", "none");
  copy.setAttribute("playsinline", "");
  // captions/subtitle tracks point at Commons' API; keep only real sources
  copy.querySelectorAll("track").forEach((track) => track.remove());

  const figure = player.ownerDocument.createElement("figure");
  figure.className = `media media-${player.tagName.toLowerCase()}`;
  figure.append(copy);
  if (caption) {
    const figcaption = player.ownerDocument.createElement("figcaption");
    figcaption.innerHTML = caption;
    figure.append(figcaption);
  }
  return figure.outerHTML;
}

/** Players inside other content (e.g. an anthem in the infobox): native controls, no Wikipedia player attributes. */
export function tidyPlayers(root: Element) {
  root.querySelectorAll("audio").forEach((player) => {
    for (const attribute of ["id", "style", "width", "height", "class", "data-mw-tmh", "data-durationhint"]) {
      player.removeAttribute(attribute);
    }
    player.setAttribute("controls", "");
    player.setAttribute("preload", "none");
    player.querySelectorAll("track").forEach((track) => track.remove());
  });
}
