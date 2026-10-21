import type { ArticleImage, Infobox, InfoboxRow } from "./types";

// Interactive or edit-only parts of infoboxes that don't work (or mean nothing) outside Wikipedia.
const INFOBOX_JUNK_SELECTOR = [
  "audio",
  "video",
  ".mw-tmh-player",
  ".mw-editsection",
  ".navbar",
  ".switcher-label",
  "[style*='display:none']",
  "[style*='display: none']",
].join(", ");

/**
 * Wikipedia's map switcher shows one map at a time with JavaScript; without it every map renders. Keep the first.
 */
function collapseMapSwitchers(table: HTMLElement) {
  table.querySelectorAll(".switcher-container").forEach((container) => {
    [...container.children].slice(1).forEach((child) => child.remove());
  });
}

// Collapsible lists this short read better as plain lists than behind a toggle.
const MAX_INLINE_LIST_ENTRIES = 6;

/**
 * Wikipedia's {{Collapsible list}} needs its JavaScript to toggle. Short lists are shown plainly; long ones become a
 * native <details> so they stay collapsible without script.
 */
function convertCollapsibleLists(table: HTMLElement) {
  table.querySelectorAll(".collapsible-list.mw-collapsible").forEach((list) => {
    const title = list.firstElementChild;
    const content = list.querySelector(".mw-collapsible-content");
    if (!title || !content || title === content) return;

    // entries are list items, or <br>-separated lines inside a single item
    const entries = content.querySelectorAll("li").length + content.querySelectorAll("br").length;
    if (entries <= MAX_INLINE_LIST_ENTRIES) {
      list.replaceWith(content);
      return;
    }

    const details = table.ownerDocument.createElement("details");
    details.className = "infobox-collapsible";
    const summary = table.ownerDocument.createElement("summary");
    summary.textContent = `${title.textContent?.trim() || "List"} (${entries})`;
    details.append(summary, content);
    list.replaceWith(details);
  });
}

/** Image links go to File: pages; inside the infobox, a click should open the viewer instead. */
function unwrapImageLinks(table: HTMLElement) {
  table.querySelectorAll("a.mw-file-description, a.image").forEach((link) => link.replaceWith(...link.childNodes));
}

function isEmpty(element: Element) {
  return !element.textContent?.trim() && !element.querySelector("img");
}

/**
 * Turns a Wikipedia infobox table into title + rows. Expects sanitized HTML whose links and icons have already been
 * processed; `toImage` converts article-sized images for the viewer (icons return null).
 */
export function parseInfobox(table: HTMLElement, toImage: (image: HTMLImageElement) => ArticleImage | null): Infobox | null {
  table.querySelectorAll(INFOBOX_JUNK_SELECTOR).forEach((element) => element.remove());
  collapseMapSwitchers(table);
  convertCollapsibleLists(table);
  unwrapImageLinks(table);

  const images: ArticleImage[] = [];
  table.querySelectorAll("img").forEach((element) => {
    const image = toImage(element as HTMLImageElement);
    if (!image) return;
    element.setAttribute("data-lightbox-index", String(images.length));
    images.push(image);
  });

  let title = table.querySelector(":scope > caption")?.innerHTML.trim() ?? "";
  const rows: InfoboxRow[] = [];

  for (const row of table.querySelectorAll(":scope > tbody > tr, :scope > tr")) {
    if (isEmpty(row)) continue;
    const header = row.querySelector(":scope > th");
    const cells = row.querySelectorAll(":scope > td");

    if (header?.matches(".infobox-above") || (!title && header && cells.length === 0 && rows.length === 0)) {
      if (!title) title = header.innerHTML.trim();
      else rows.push({ kind: "full", html: header.innerHTML.trim() });
    } else if (header && cells.length === 0) {
      rows.push({ kind: "header", html: header.innerHTML.trim() });
    } else if (header && cells.length > 0) {
      rows.push({ kind: "data", label: header.innerHTML.trim(), html: cells[0].innerHTML.trim() });
    } else if (cells.length > 0) {
      rows.push({ kind: "full", html: [...cells].map((cell) => cell.innerHTML.trim()).join(" ") });
    }
  }

  if (!title && rows.length === 0) return null;
  return { title, rows, images };
}
