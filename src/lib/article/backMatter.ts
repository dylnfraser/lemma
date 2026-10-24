/**
 * Tidying the end of an article (and the citations throughout), at parse time:
 * - reference lists: one quiet "↑" back to where a reference is cited instead of "^ a b c d…", archive notes folded
 *   into a small "Archived" link, and identifiers (DOI, PubMed, Bibcode…) as labelled chips at the end;
 * - explanatory notes read as footnotes, with their way back at the end;
 * - "See also" lists split each link from its description, for a card layout;
 * - "External links" name the site each link goes to;
 * - lists of "1921 – Nobel Prize…" entries get a year column.
 */

const ARCHIVE_HOSTS = /(^|\.)(web\.archive\.org|archive\.(today|ph|is|org|md|li)|webcitation\.org|ghostarchive\.org|wayback\.archive-it\.org)$/;

const hostOf = (href: string | null): string => {
  try {
    return new URL(href ?? "", "https://en.wikipedia.org").hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** The text of the nearest h2 before `element` (the section it's in). */
function sectionTitle(headings: Element[], element: Element): string {
  let title = "";
  for (const heading of headings) {
    if (heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) title = heading.textContent?.trim() ?? "";
    else break;
  }
  return title;
}

/** The lists in the section headed `pattern` (top-level ones, up to the next h2). */
function sectionLists(root: HTMLElement, pattern: RegExp): HTMLElement[] {
  const lists: HTMLElement[] = [];
  for (const heading of root.querySelectorAll("h2")) {
    if (!pattern.test(heading.textContent?.trim() ?? "")) continue;
    let node = (heading.closest(".mw-heading") ?? heading).nextElementSibling;
    while (node && !node.matches("h2, .mw-heading2")) {
      if (node.matches("ul")) lists.push(node as HTMLElement);
      else lists.push(...node.querySelectorAll<HTMLElement>(":scope ul:not(li ul)"));
      node = node.nextElementSibling;
    }
  }
  return lists;
}

// ---------- reference lists ----------

/**
 * "^ a b c d e" → "↑12": one link back to the first place the reference is cited, with how many there are. (A note
 * takes its way back at the end instead; see markExplanatoryNotes.)
 */
export function tidyBacklinks(root: HTMLElement) {
  for (const backlink of root.querySelectorAll<HTMLElement>("ol.references > li > .mw-cite-backlink")) {
    const targets = [...backlink.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
    // a reference defined but never cited in the text: its "^" leads nowhere
    if (targets.length === 0) {
      backlink.replaceChildren();
      continue;
    }
    const link = backlink.ownerDocument.createElement("a");
    link.className = "backlink";
    link.setAttribute("href", targets[0].getAttribute("href")!);
    link.setAttribute("title", targets.length > 1 ? `Cited ${targets.length} times: back to the first` : "Back to where it's cited");
    link.textContent = "↑";
    if (targets.length > 1) {
      const count = backlink.ownerDocument.createElement("span");
      count.className = "backlink-count";
      count.textContent = String(targets.length);
      link.append(count);
    }
    backlink.replaceChildren(link);
  }
}

/** Removes what follows an archive note up to the end of its sentence ("from the original on June 17, 2020"). */
function dropRestOfNote(start: ChildNode | null) {
  let node = start;
  while (node) {
    const next: ChildNode | null = node.nextSibling;
    if (node.nodeType === Node.TEXT_NODE) {
      const stop = node.textContent!.indexOf(".");
      if (stop >= 0) {
        node.textContent = node.textContent!.slice(stop);
        return;
      }
      node.remove();
    } else if (node instanceof Element && node.matches("a")) {
      node.remove();
    } else {
      return;
    }
    node = next;
  }
}

/** The chip ends its sentence, so the full stop after it goes (". Retrieved…" → " Retrieved…"). */
function dropStopAfter(chip: Element) {
  const next = chip.nextSibling;
  const text = next?.nodeType === Node.TEXT_NODE ? next : next instanceof Element ? next.firstChild : null;
  if (text?.nodeType === Node.TEXT_NODE) text.textContent = text.textContent!.replace(/^\.(?=\s|$)/, "");
}

/**
 * Archive notes become a small "Archived" link to the archived copy, the rest of their sentence going with them:
 * "Archived from the original on June 17, 2020", "Archived July 13, 2023, at the Wayback Machine", and (when the
 * title itself links to the archived copy) a plain "Archived from the original on …".
 */
export function foldArchiveNotes(root: HTMLElement) {
  for (const link of [...root.querySelectorAll<HTMLAnchorElement>("a[href]")]) {
    if (link.textContent?.trim() !== "Archived" || !ARCHIVE_HOSTS.test(hostOf(link.getAttribute("href")))) continue;
    dropRestOfNote(link.nextSibling);
    link.className = "archived";
    link.setAttribute("title", "An archived copy of the source");
    dropStopAfter(link);
  }

  for (const citation of root.querySelectorAll<HTMLElement>("cite.citation")) {
    for (const text of [...citation.childNodes]) {
      if (text.nodeType !== Node.TEXT_NODE || !/(^|\s)Archived from\s*$/.test(text.textContent!)) continue;
      const archive = [...citation.querySelectorAll<HTMLAnchorElement>("a[href]")].find((each) =>
        ARCHIVE_HOSTS.test(hostOf(each.getAttribute("href"))),
      );
      if (!archive) continue;
      const chip = citation.ownerDocument.createElement("a");
      chip.className = "archived";
      chip.setAttribute("href", archive.getAttribute("href")!);
      chip.setAttribute("title", "An archived copy of the source");
      chip.textContent = "Archived";
      text.textContent = text.textContent!.replace(/Archived from\s*$/, "");
      text.after(chip);
      dropRestOfNote(chip.nextSibling);
      dropStopAfter(chip);
    }
  }
}

// Wikipedia's labels for identifiers, as shown on the chips
const IDENTIFIER_LABELS: Record<string, string> = {
  doi: "DOI",
  pmid: "PubMed",
  pmc: "PMC",
  bibcode: "Bibcode",
  isbn: "ISBN",
  issn: "ISSN",
  eissn: "eISSN",
  jstor: "JSTOR",
  s2cid: "S2CID",
  oclc: "OCLC",
  arxiv: "arXiv",
  hdl: "Handle",
  lccn: "LCCN",
  osti: "OSTI",
  ssrn: "SSRN",
  citeseerx: "CiteSeerX",
  zbl: "zbMATH",
  mr: "MathSciNet",
  ol: "Open Library",
  "proquest": "ProQuest",
};

/**
 * "Bibcode:1974Moon…53B. doi:10.1007/BF01877794." → chips at the end of the citation, labelled by kind (the code
 * itself is in each chip's tooltip). Freely readable ones are marked.
 */
export function chipIdentifiers(root: HTMLElement) {
  for (const citation of root.querySelectorAll<HTMLElement>("cite.citation, .citation")) {
    const chips: HTMLElement[] = [];
    for (const label of [...citation.querySelectorAll<HTMLAnchorElement>('a[href*="_(identifier)"]')]) {
      const separator = label.nextSibling;
      if (separator?.nodeType !== Node.TEXT_NODE || !/^[:  ]+$/.test(separator.textContent!)) continue;
      const value = separator.nextSibling;
      const valueLink = value instanceof Element ? (value.matches("a") ? value : value.querySelector("a")) : null;
      if (!valueLink) continue;

      const kind = (label.textContent ?? "").trim();
      const chip = citation.ownerDocument.createElement("a");
      chip.className = "identifier";
      chip.setAttribute("href", valueLink.getAttribute("href") ?? "");
      chip.setAttribute("title", `${kind} ${valueLink.textContent?.trim() ?? ""}`);
      chip.textContent = IDENTIFIER_LABELS[kind.toLowerCase()] ?? kind;
      if ((value as Element).matches(".id-lock-free") || valueLink.closest(".id-lock-free")) chip.classList.add("free");
      chips.push(chip);

      // take its sentence's full stop with it, so no ". ." is left behind
      const before = label.previousSibling;
      const after = value!.nextSibling;
      label.remove();
      separator.remove();
      value!.remove();
      if (after?.nodeType === Node.TEXT_NODE && (!before || /[.,]\s*$/.test(before.textContent ?? ""))) {
        after.textContent = after.textContent!.replace(/^[.,]\s?/, "");
      }
    }
    dropDoubledStops(citation);
    if (chips.length === 0) continue;
    const group = citation.ownerDocument.createElement("span");
    group.className = "identifiers";
    group.append(...chips);
    citation.append(" ", group);
  }
}

/**
 * Removes a full stop that follows another with nothing between ("696. . Retrieved…", where identifiers between them
 * were taken out), across the citation's text in reading order. Ellipses ("...") are left alone.
 */
function dropDoubledStops(citation: HTMLElement) {
  const walker = citation.ownerDocument.createTreeWalker(citation, NodeFilter.SHOW_TEXT);
  let previous = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent!;
    if (!text.trim()) continue;
    if (/[.,]\s*$/.test(previous) && !/\.\.\s*$/.test(previous) && /^\s*\.(?!\.)/.test(text)) {
      node.textContent = text.replace(/^(\s*)\./, "$1");
    }
    // a node left blank keeps the text before it as the one to compare with
    if (node.textContent!.trim()) previous = node.textContent!;
  }
}

/** Notes groups ("a", "b"…: asides, not sources) read as footnotes, with the way back at the end of each. */
export function markExplanatoryNotes(root: HTMLElement) {
  for (const list of root.querySelectorAll<HTMLElement>("ol.references[data-mw-group]")) {
    list.classList.add("explanatory");
    for (const item of list.querySelectorAll(":scope > li")) {
      const backlink = item.querySelector(":scope > .mw-cite-backlink");
      if (backlink) item.append(" ", backlink);
    }
  }
}

// ---------- see also, external links ----------

/** "Selenography – Study of the surface…" → the link, then its description on a line of its own (as cards). */
export function markSeeAlso(root: HTMLElement) {
  for (const list of sectionLists(root, /^see also$/i)) {
    list.classList.add("see-also");
    for (const item of list.querySelectorAll(":scope > li")) {
      const link = item.firstElementChild;
      const rest = link?.nextSibling;
      if (!link?.matches("a") || rest?.nodeType !== Node.TEXT_NODE || !/^[\s ]*[–—-]\s/.test(rest.textContent!)) continue;
      const description = item.ownerDocument.createElement("span");
      description.className = "see-also-description";
      rest.textContent = rest.textContent!.replace(/^[\s ]*[–—-]\s+/, "");
      while (link.nextSibling) description.append(link.nextSibling);
      item.append(description);
    }
  }
}

/** Each external link names the site it goes to ("nasa.gov"), so it's clear where it leads before following it. */
export function markExternalLinks(root: HTMLElement) {
  for (const list of sectionLists(root, /^external links$/i)) {
    list.classList.add("external-links");
    for (const item of list.querySelectorAll(":scope > li")) {
      const link = item.querySelector<HTMLAnchorElement>("a.external");
      const host = hostOf(link?.getAttribute("href") ?? null);
      if (!link || !host || ARCHIVE_HOSTS.test(host)) continue;
      // already named in the entry ("… on YouTube")
      const name = host.split(".").at(-2) ?? host;
      const elsewhere = (item.textContent ?? "").replace(link.textContent ?? "", "");
      if (elsewhere.toLowerCase().includes(name.toLowerCase())) continue;
      const site = item.ownerDocument.createElement("span");
      site.className = "site";
      site.textContent = host;
      // at the end of the entry, not in the middle of its sentence ("Video … on YouTube")
      item.append(" ", site);
    }
  }
}

// ---------- year lists ----------

const YEAR_PREFIX = /^\s*((?:c\.\s*)?\d{4}(?:\s*[–-]\s*(?:\d{2,4}|present))?)\s*(?:[:–—-]\s*|\s+(?=\S))/;
const MIN_YEAR_ITEMS = 4;

/**
 * Lists of "1921 – Nobel Prize in Physics" (awards, works, events) get a column of years: each year in its own cell,
 * so the list scans down the dates. Only lists where nearly every entry starts with one.
 */
export function markYearLists(root: HTMLElement) {
  for (const list of root.querySelectorAll<HTMLElement>("ul")) {
    if (list.closest("table, ol.references, .navbox, .gallery")) continue;
    const items = [...list.querySelectorAll<HTMLElement>(":scope > li")];
    if (items.length < MIN_YEAR_ITEMS) continue;
    const firstText = (item: HTMLElement) => {
      const node = item.firstChild;
      return node?.nodeType === Node.TEXT_NODE ? node : null;
    };
    const matching = items.filter((item) => YEAR_PREFIX.test(firstText(item)?.textContent ?? ""));
    if (matching.length < items.length * 0.8) continue;

    list.classList.add("year-list");
    for (const item of items) {
      const text = firstText(item);
      const match = text?.textContent?.match(YEAR_PREFIX);
      const year = item.ownerDocument.createElement("span");
      year.className = "year";
      if (text && match) {
        year.textContent = match[1];
        text.textContent = text.textContent!.slice(match[0].length);
      }
      const rest = item.ownerDocument.createElement("span");
      rest.className = "year-entry";
      rest.append(...item.childNodes);
      item.append(year, rest);
    }
  }
}

// ---------- which lists cite sources ----------

/**
 * Whether a list item outside the footnotes is one of the article's sources: a work its footnotes cite ("Smith 2001"
 * links to it), or an entry under a heading that only ever means sources. A "Bibliography" or "Works" section of a
 * writer's own books looks just the same, but nothing cites it.
 */
export function sourceListFilter(root: HTMLElement): (item: Element) => boolean {
  const cited = new Set(
    [...root.querySelectorAll('ol.references a[href^="#CITEREF"]')].map((link) => {
      const id = link.getAttribute("href")!.slice(1);
      try {
        return decodeURIComponent(id);
      } catch {
        return id;
      }
    }),
  );
  const headings = [...root.querySelectorAll("h2")];
  const SOURCE_SECTIONS = /^(further reading|sources|cited sources|general sources|works cited|cited works|general references|references|notes and references|citations)$/i;
  return (item) =>
    [...item.querySelectorAll("[id]")].some((element) => cited.has(element.id)) ||
    SOURCE_SECTIONS.test(sectionTitle(headings, item));
}
