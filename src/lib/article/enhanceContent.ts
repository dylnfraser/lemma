import { markComputedDarkBackgrounds } from "./darkColors";

/**
 * Behaviour Wikipedia adds to article content with JavaScript, re-created for Lemma's rendered blocks:
 * collapsible sections/tables ("mw-collapsible") and sortable tables ("sortable"). Runs on live DOM after render.
 */

// ---------- motion ----------

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Whether to animate: not when the reader prefers reduced motion, nor where there's no Web Animations (tests). */
function canAnimate(element: Element): boolean {
  return typeof element.animate === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Rows a sort moved glide from where they were (FLIP); only those on screen, so long tables stay cheap. */
function glideRows(table: HTMLTableElement, rows: HTMLTableRowElement[], before: Map<HTMLTableRowElement, number>) {
  const viewport = window.innerHeight;
  const glides: Animation[] = [];
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    const from = before.get(row);
    if (from === undefined || from === rect.top) continue;
    if ((from < -100 || from > viewport + 100) && (rect.bottom < -100 || rect.top > viewport + 100)) continue;
    glides.push(row.animate([{ translate: `0 ${from - rect.top}px` }, { translate: "0 0" }], { duration: 320, easing: EASE_OUT }));
  }

  // Rows gliding in from past the table's edge briefly overflow its horizontal scroller, which would flash a vertical
  // scrollbar on and off: it doesn't scroll vertically while they move.
  const scroller = table.parentElement;
  if (glides.length === 0 || !scroller || getComputedStyle(scroller).overflowY === "visible") return;
  scroller.style.overflowY = "hidden";
  Promise.allSettled(glides.map((glide) => glide.finished)).then(() => scroller.style.removeProperty("overflow-y"));
}

// ---------- sorting ----------

/** The value a cell sorts by: Wikipedia's data-sort-value if present, otherwise its visible text without footnotes. */
export function sortKey(cell: Element): string {
  const explicit = cell.getAttribute("data-sort-value") ?? cell.querySelector("[data-sort-value]")?.getAttribute("data-sort-value");
  if (explicit !== null && explicit !== undefined) return explicit.trim();
  const copy = cell.cloneNode(true) as Element;
  copy.querySelectorAll("sup.reference, .sortkey, [style*='display:none'], [style*='display: none']").forEach((hidden) => hidden.remove());
  return copy.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

/** Parses "1,234.5", "−12 %", "$3.4", "45 km" as numbers; anything else isn't numeric. */
export function numericValue(value: string): number | null {
  const cleaned = value.replace(/[−–]/g, "-").replace(/[,\s  ]/g, "");
  const match = cleaned.match(/^[^\d.-]{0,3}(-?\d+(?:\.\d+)?)(?:e[+-]?\d+)?[^\d]{0,6}$/i);
  return match ? Number.parseFloat(match[1]) : null;
}

/** Compares two sort keys: numerically when both are numbers, otherwise as text (natural order, case-insensitive). */
export function compareKeys(a: string, b: string): number {
  const x = numericValue(a);
  const y = numericValue(b);
  if (x !== null && y !== null) return x - y;
  // empty cells sort last either way round
  if (!a && b) return 1;
  if (a && !b) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Leading rows made only of header cells (a table can have two: grouped columns, then the columns). */
function headerRows(table: HTMLTableElement): HTMLTableRowElement[] {
  const rows: HTMLTableRowElement[] = [];
  for (const row of table.rows) {
    if (row.cells.length === 0 || [...row.cells].some((cell) => cell.tagName !== "TH")) break;
    rows.push(row);
  }
  return rows;
}

/** For each cell of the given rows, the logical column it starts at (accounting for row and column spans). */
function columnPositions(rows: HTMLTableRowElement[]): Map<HTMLTableCellElement, number> {
  const positions = new Map<HTMLTableCellElement, number>();
  const occupied: boolean[][] = [];
  rows.forEach((row, r) => {
    occupied[r] ??= [];
    let column = 0;
    for (const cell of row.cells) {
      while (occupied[r][column]) column++;
      positions.set(cell, column);
      for (let dr = 0; dr < Math.max(1, cell.rowSpan); dr++) {
        occupied[r + dr] ??= [];
        for (let dc = 0; dc < Math.max(1, cell.colSpan); dc++) occupied[r + dr][column + dc] = true;
      }
      column += Math.max(1, cell.colSpan);
    }
  });
  return positions;
}

/** The cell covering a logical column in a row without row spans. */
function cellAt(row: HTMLTableRowElement, column: number): HTMLTableCellElement | undefined {
  let position = 0;
  for (const cell of row.cells) {
    position += Math.max(1, cell.colSpan);
    if (position > column) return cell;
  }
  return undefined;
}

/**
 * Splits cells spanning several rows into one copy per row, so rows can be reordered independently (Wikipedia's
 * sorter does the same before its first sort).
 */
function explodeRowSpans(rows: HTMLTableRowElement[]) {
  // pending[column] = the spanning cell still covering upcoming rows, and how many rows it has left
  const pending: { cell: HTMLTableCellElement; left: number }[] = [];
  for (const row of rows) {
    const physical = [...row.cells];
    let column = 0;
    let index = 0;
    while (index < physical.length || pending.some((entry, c) => entry && entry.left > 0 && c >= column)) {
      const spanning = pending[column];
      if (spanning && spanning.left > 0) {
        const copy = spanning.cell.cloneNode(true) as HTMLTableCellElement;
        copy.rowSpan = 1;
        row.insertBefore(copy, physical[index] ?? null);
        spanning.left--;
        column += Math.max(1, copy.colSpan);
        continue;
      }
      const cell = physical[index++];
      if (!cell) break;
      if (cell.rowSpan > 1) {
        pending[column] = { cell, left: cell.rowSpan - 1 };
        cell.rowSpan = 1;
      }
      column += Math.max(1, cell.colSpan);
    }
  }
}

function makeSortable(table: HTMLTableElement) {
  const heads = headerRows(table);
  const body = table.tBodies[0];
  if (heads.length === 0 || !body) return;

  const positions = columnPositions(heads);
  const columns = Math.max(...[...positions].map(([cell, column]) => column + Math.max(1, cell.colSpan)));
  const isBodyRow = (row: HTMLTableRowElement) => !heads.includes(row) && row.parentElement === body;
  const bodyRows = [...body.rows].filter(isBodyRow);
  // tables split into sections by full-width rows ("Trump job approval" …) would be scrambled by sorting
  if (bodyRows.some((row) => row.cells.length === 1 && row.cells[0].colSpan >= columns)) return;

  let exploded = false;
  // sortable headers: cells naming a single column (grouping cells above several columns aren't)
  for (const [cell, column] of positions) {
    if (cell.colSpan > 1 || cell.classList.contains("unsortable")) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sort-button";
    button.append(...cell.childNodes);
    cell.append(button);
    cell.setAttribute("aria-sort", "none");

    button.addEventListener("click", () => {
      if (!exploded) {
        explodeRowSpans([...body.rows].filter(isBodyRow));
        exploded = true;
      }
      const ascending = cell.getAttribute("aria-sort") !== "ascending";
      for (const other of positions.keys()) if (other.hasAttribute("aria-sort")) other.setAttribute("aria-sort", "none");
      cell.setAttribute("aria-sort", ascending ? "ascending" : "descending");

      // "sortbottom" rows (totals) stay at the end
      const rows = [...body.rows].filter((row) => isBodyRow(row) && !row.classList.contains("sortbottom"));
      const bottom = [...body.rows].filter((row) => isBodyRow(row) && row.classList.contains("sortbottom"));
      const key = (row: HTMLTableRowElement) => {
        const target = cellAt(row, column);
        return target ? sortKey(target) : "";
      };
      const animate = canAnimate(table) && rows.length <= 400;
      const before = new Map(animate ? rows.map((row) => [row, row.getBoundingClientRect().top]) : []);
      rows.sort((a, b) => compareKeys(key(a), key(b)) * (ascending ? 1 : -1));
      body.append(...rows, ...bottom);
      if (animate) glideRows(table, rows, before);
    });
  }
}

// ---------- collapsing ----------

function makeCollapsible(element: HTMLElement) {
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "collapse-toggle";

  let parts: HTMLElement[];
  if (element instanceof HTMLTableElement) {
    // the first row (or the caption) stays visible as the table's heading
    const rows = [...element.rows];
    const keep = element.caption ? null : rows[0];
    parts = rows.filter((row) => row !== keep);
    (element.caption ?? keep?.cells[keep.cells.length - 1])?.append(toggle);
  } else {
    const content = element.querySelector<HTMLElement>(":scope > .mw-collapsible-content");
    parts = content ? [content] : ([...element.children].slice(1) as HTMLElement[]);
    (element.firstElementChild ?? element).append(toggle);
  }
  if (parts.length === 0) {
    toggle.remove();
    return;
  }

  const set = (collapsed: boolean) => {
    for (const part of parts) part.hidden = collapsed;
    element.classList.toggle("is-collapsed", collapsed);
    toggle.textContent = collapsed ? "Show" : "Hide";
    toggle.setAttribute("aria-expanded", String(!collapsed));
  };
  set(element.matches(".mw-collapsed, .autocollapse"));
  toggle.addEventListener("click", () => {
    const opening = element.classList.contains("is-collapsed");
    set(!opening);
    // revealed content settles in rather than snapping into place (the first rows are all that's on screen)
    if (opening && canAnimate(element)) {
      for (const part of parts.slice(0, 40)) {
        part.animate(
          [
            { opacity: 0, translate: "0 -4px", filter: "blur(4px)" },
            { opacity: 1, translate: "0 0", filter: "blur(0)" },
          ],
          { duration: 320, easing: EASE_OUT },
        );
      }
    }
  });
}

/** Svelte action for a rendered article block. */
export function enhanceContent(node: HTMLElement) {
  // colours set by template classes, now that their styles apply
  if (node.querySelector("table")) markComputedDarkBackgrounds(node);
  for (const table of node.querySelectorAll<HTMLTableElement>("table.sortable")) makeSortable(table);
  // collapsibles nested in collapsibles work independently
  for (const element of node.querySelectorAll<HTMLElement>(".mw-collapsible")) makeCollapsible(element);
  if (node.matches(".mw-collapsible")) makeCollapsible(node);
}
