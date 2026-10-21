import { EDIT_AFFORDANCE_SELECTOR } from "./articleUtils";
import type { ArticleImage, Infobox, InfoboxRow, SuccessionEntry } from "./types";
import { makeImagesZoomable } from "./zoomableImages";

// Interactive or editing parts of infoboxes that don't work (or mean nothing) outside Wikipedia.
// Audio (anthems, name pronunciations) stays; video doesn't fit the column.
const INFOBOX_JUNK_SELECTOR = [
  "video",
  EDIT_AFFORDANCE_SELECTOR,
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

/** One side of a succession block: a nested table of flag | name rows. */
function readSuccessionEntries(cell: Element | undefined): SuccessionEntry[] {
  if (!cell) return [];
  return [...cell.querySelectorAll("tr")]
    .map((row) => {
      const icon = row.querySelector("img");
      const name = [...row.querySelectorAll("td")].find((td) => !td.querySelector("img") && td.textContent?.trim());
      return { icon: icon?.outerHTML ?? "", html: name?.innerHTML.trim() ?? "" };
    })
    .filter((entry) => entry.html);
}

/**
 * Former-country infoboxes mark their "Preceded by / Succeeded by" header row with #before-after; the next row holds
 * one nested table per side. On Wikipedia both rows sit in a table nested inside one full-width infobox row.
 */
function readSuccession(table: HTMLElement) {
  const header = table.querySelector("#before-after")?.closest("tr");
  const body = header?.nextElementSibling;
  if (!header || !body) return null;

  const [beforeCell, afterCell] = body.querySelectorAll(":scope > td");
  const row: InfoboxRow = {
    kind: "succession",
    before: readSuccessionEntries(beforeCell),
    after: readSuccessionEntries(afterCell),
  };
  return { header, body, row };
}

/** Removes the "• " Wikipedia types before sub-row labels; returns whether there was one. */
function stripLeadingBullet(label: Element): boolean {
  const walker = label.ownerDocument.createTreeWalker(label, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    if (!text.trim()) continue;
    if (!/^\s*•/.test(text)) return false;
    node.textContent = text.replace(/^\s*•[\s\u00a0]*/, "");
    return true;
  }
  return false;
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

  const images = makeImagesZoomable(table, toImage);

  let title = table.querySelector(":scope > caption")?.innerHTML.trim() ?? "";
  const rows: InfoboxRow[] = [];
  const succession = readSuccession(table);

  for (const row of table.querySelectorAll(":scope > tbody > tr, :scope > tr")) {
    // the infobox row that holds the succession block (or is its header, when not nested) becomes one structured row
    if (succession && (row === succession.header || row.contains(succession.header))) {
      rows.push(succession.row);
      continue;
    }
    if (succession && row === succession.body) continue;
    if (isEmpty(row)) continue;
    const header = row.querySelector(":scope > th");
    const cells = row.querySelectorAll(":scope > td");

    if (header?.matches(".infobox-above") || (!title && header && cells.length === 0 && rows.length === 0)) {
      if (!title) title = header.innerHTML.trim();
      else rows.push({ kind: "full", html: header.innerHTML.trim() });
    } else if (header && cells.length === 0) {
      rows.push({ kind: "header", html: header.innerHTML.trim() });
    } else if (header && cells.length > 0) {
      const sub = stripLeadingBullet(header);
      rows.push({ kind: "data", label: header.innerHTML.trim(), html: cells[0].innerHTML.trim(), ...(sub && { sub }) });
    } else if (cells.length > 0) {
      rows.push({ kind: "full", html: [...cells].map((cell) => cell.innerHTML.trim()).join(" ") });
    }
  }

  if (!title && rows.length === 0) return null;
  return { title, rows, images };
}
