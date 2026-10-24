/**
 * Tidying the footnote markers in the text: page numbers move into the citation they belong to (shown in its preview
 * rather than as ":70" after it), and long runs of citations ("[4][5][6][7]") become one marker ("4–7").
 */

/** "Page / location: 70" → "Page 70"; "Pages: 3–5" → "Pages 3–5"; anything else keeps its own label. */
function pageLabel(title: string, text: string): string {
  const [kind = "", ...rest] = title.split(":");
  const value = (rest.join(":").trim() || text.replace(/^[\s:\u200a\u2009]+|[\s\u200a\u2009]+$/g, "")).trim();
  if (!value) return "";
  if (/pages/i.test(kind)) return `Pages ${value}`;
  if (/page/i.test(kind)) return `Page ${value}`;
  return kind.trim() ? `${kind.trim()} ${value}` : value;
}

/**
 * {{rp}}: a citation's page ("[38]:70") is a separate, linkless marker right after it. It becomes `data-at` on the
 * citation, for its preview, and leaves the text.
 */
export function foldCitationPages(root: HTMLElement) {
  for (const marker of root.querySelectorAll<HTMLElement>("sup.reference")) {
    if (marker.querySelector("a")) continue;
    const citation = marker.previousSibling;
    if (!(citation instanceof HTMLElement) || !citation.matches("sup.reference") || !citation.querySelector("a")) continue;
    const label = pageLabel(marker.querySelector("[title]")?.getAttribute("title") ?? "", marker.textContent ?? "");
    if (label) citation.dataset.at = label;
    marker.remove();
  }
}

/** "4, 5, 6, 7" → "4–7"; "3, 8, 9" → "3, 8–9"; lettered notes are listed as they are. */
export function compressLabels(labels: string[]): string {
  const numbers = labels.map((label) => (/^\d+$/.test(label) ? Number(label) : NaN));
  if (numbers.some(Number.isNaN)) return labels.join(", ");
  const parts: string[] = [];
  let start = 0;
  for (let i = 1; i <= numbers.length; i++) {
    if (i < numbers.length && numbers[i] === numbers[i - 1] + 1) continue;
    const run = numbers.slice(start, i);
    parts.push(run.length > 2 ? `${run[0]}–${run.at(-1)}` : run.join(", "));
    start = i;
  }
  return parts.join(", ");
}

const MIN_GROUP = 3;
const isCitation = (node: Node | null): node is HTMLElement =>
  node instanceof HTMLElement && node.matches("sup.reference") && !!node.querySelector('a[href^="#"]');

/**
 * Runs of three or more citations side by side become one marker, labelled with their numbers ("4–7"), whose link
 * lists them all for the preview (`data-refs`, with their labels and pages in `data-labels` and `data-ats`). Each
 * citation's id stays, on an empty span inside the marker, so the reference list's "^" links still find where it was
 * cited.
 */
export function groupCitationRuns(root: HTMLElement) {
  for (const first of [...root.querySelectorAll("sup.reference")]) {
    if (!first.isConnected || !isCitation(first) || isCitation(first.previousSibling)) continue;
    const run: HTMLElement[] = [first];
    while (isCitation(run.at(-1)!.nextSibling)) run.push(run.at(-1)!.nextSibling as HTMLElement);
    if (run.length < MIN_GROUP) continue;

    const document = first.ownerDocument;
    const links = run.map((citation) => citation.querySelector<HTMLAnchorElement>('a[href^="#"]')!);
    const group = document.createElement("sup");
    group.className = "reference citation-group";
    const link = document.createElement("a");
    link.setAttribute("href", links[0].getAttribute("href")!);
    link.dataset.refs = links.map((each) => each.getAttribute("href")!.slice(1)).join(" ");
    link.dataset.ats = run.map((citation) => citation.dataset.at ?? "").join("|");
    const labels = links.map((each) => (each.textContent ?? "").replace(/[[\]]/g, "").trim());
    link.dataset.labels = labels.join("|");
    link.textContent = compressLabels(labels);
    group.append(link);
    for (const citation of run) {
      if (!citation.id) continue;
      const anchor = document.createElement("span");
      anchor.id = citation.id;
      group.append(anchor);
    }
    first.before(group);
    run.forEach((citation) => citation.remove());
  }
}
