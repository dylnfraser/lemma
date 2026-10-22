import { getWikipediaArticleUrl, WIKIPEDIA_ORIGIN } from "$lib/api/wikipedia";

export type CitationStyle = "APA" | "MLA" | "Chicago" | "BibTeX";
export const CITATION_STYLES: CitationStyle[] = ["APA", "MLA", "Chicago", "BibTeX"];

export type CitationSource = {
  title: string;
  /** The revision being read, for a permanent link; null cites the live article. */
  revisionId: number | null;
  /** When that revision was made, if known. */
  revised: Date | null;
  /** When the reader read it. */
  accessed: Date;
};

/** A link to exactly the version being read, so the citation still matches if the article changes. */
export function permanentUrl(title: string, revisionId: number | null): string {
  if (!revisionId) return getWikipediaArticleUrl(title);
  const url = new URL("/w/index.php", WIKIPEDIA_ORIGIN);
  url.search = new URLSearchParams({ title: title.replaceAll(" ", "_"), oldid: String(revisionId) }).toString();
  return url.href;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// MLA abbreviates months longer than four letters
const MLA_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

const monthDayYear = (date: Date) => `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
const dayMonthYearMla = (date: Date) => `${date.getDate()} ${MLA_MONTHS[date.getMonth()]} ${date.getFullYear()}`;

/** A citation of the article in a common style, following Wikipedia's own "Cite this page" formats. */
export function formatCitation(style: CitationStyle, { title, revisionId, revised, accessed }: CitationSource): string {
  const url = permanentUrl(title, revisionId);
  const dated = revised ?? accessed;

  switch (style) {
    case "APA":
      return `Wikipedia contributors. (${dated.getFullYear()}, ${MONTHS[dated.getMonth()]} ${dated.getDate()}). ${title}. In Wikipedia, The Free Encyclopedia. Retrieved ${monthDayYear(accessed)}, from ${url}`;
    case "MLA":
      return `“${title}.” Wikipedia, The Free Encyclopedia, ${dayMonthYearMla(dated)}, ${url}. Accessed ${dayMonthYearMla(accessed)}.`;
    case "Chicago":
      return `Wikipedia contributors, “${title},” Wikipedia, The Free Encyclopedia, ${url} (accessed ${monthDayYear(accessed)}).`;
    case "BibTeX": {
      const key = `wiki:${title.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "")}`;
      const escaped = title.replace(/([{}\\])/g, "\\$1");
      return [
        `@misc{${key},`,
        `  author = "{Wikipedia contributors}",`,
        `  title = "${escaped} --- {W}ikipedia{,} The Free Encyclopedia",`,
        `  year = "${dated.getFullYear()}",`,
        `  url = "${url}",`,
        `  note = "[Online; accessed ${accessed.getDate()}-${MONTHS[accessed.getMonth()]}-${accessed.getFullYear()}]"`,
        `}`,
      ].join("\n");
    }
  }
}
