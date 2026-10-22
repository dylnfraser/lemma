import { describe, expect, it } from "vitest";
import { formatCitation, permanentUrl } from "./citation";

const source = {
  title: "Alan Turing",
  revisionId: 1234567,
  revised: new Date(2026, 4, 3),
  accessed: new Date(2026, 9, 21),
};
const PERMALINK = "https://en.wikipedia.org/w/index.php?title=Alan_Turing&oldid=1234567";

describe("formatCitation", () => {
  it("links to the exact revision", () => {
    expect(permanentUrl("Alan Turing", 1234567)).toBe(PERMALINK);
    expect(permanentUrl("Alan Turing", null)).toBe("https://en.wikipedia.org/wiki/Alan_Turing");
  });

  it("formats APA, MLA and Chicago", () => {
    expect(formatCitation("APA", source)).toBe(
      `Wikipedia contributors. (2026, May 3). Alan Turing. In Wikipedia, The Free Encyclopedia. Retrieved October 21, 2026, from ${PERMALINK}`,
    );
    expect(formatCitation("MLA", source)).toBe(
      `“Alan Turing.” Wikipedia, The Free Encyclopedia, 3 May 2026, ${PERMALINK}. Accessed 21 Oct. 2026.`,
    );
    expect(formatCitation("Chicago", source)).toBe(
      `Wikipedia contributors, “Alan Turing,” Wikipedia, The Free Encyclopedia, ${PERMALINK} (accessed October 21, 2026).`,
    );
  });

  it("formats BibTeX with a safe key and escaped title", () => {
    const bibtex = formatCitation("BibTeX", { ...source, title: "C++ {templates}" });
    expect(bibtex).toContain("@misc{wiki:C_templates,");
    expect(bibtex).toContain('title = "C++ \\{templates\\} --- {W}ikipedia{,} The Free Encyclopedia"');
    expect(bibtex).toContain('note = "[Online; accessed 21-October-2026]"');
  });

  it("falls back to the access date when the revision date is unknown", () => {
    expect(formatCitation("APA", { ...source, revised: null })).toContain("(2026, October 21)");
  });
});
