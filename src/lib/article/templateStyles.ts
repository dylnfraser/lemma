/**
 * Wikipedia's per-template CSS ("TemplateStyles") arrives as <style data-mw-deduplicate> tags inside the article HTML.
 * The sanitizer strips <style>, so the CSS is collected from the raw HTML first. MediaWiki has already sanitized it
 * (no scripts, only safe properties), and every selector is scoped to `.mw-parser-output`, which Lemma puts on the
 * article body, so templates look as their authors intended without touching the rest of the page.
 *
 * Rules for parts Lemma removes or draws itself are dropped, so they can't fight Lemma's own styling.
 */

// Classes whose Wikipedia styling Lemma replaces (or whose elements it removes). Each is a prefix: "legend" also
// covers .legend-color, "thumb" .thumbinner and .thumbcaption.
const RESTYLED = [
  "infobox",
  "ib-",
  "navbox",
  "navbar",
  "sidebar",
  "hatnote",
  "legend",
  "sfrac",
  "mw-heading",
  "shortdescription",
  "tmulti",
  "thumb",
  "gallery",
  "portalbox",
  "portal-bar",
  "sister",
  "side-box",
  "ambox",
  "metadata",
  "mw-editsection",
  "reflist",
  "references",
  "reference",
  "mw-cite-backlink",
  "hlist",
  "plainlist",
  "calculator",
];
const RESTYLED_SELECTOR = new RegExp(`\\.(?:${RESTYLED.map((name) => name.replace(/[-]/g, "\\$&")).join("|")})`);

/** Splits CSS into top-level chunks: `prelude { body }` (bodies may nest, as in @media). */
function splitRules(css: string): { prelude: string; body: string }[] {
  const rules: { prelude: string; body: string }[] = [];
  let depth = 0;
  let preludeStart = 0;
  let bodyStart = 0;
  let prelude = "";

  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    if (char === "{") {
      if (depth === 0) {
        prelude = css.slice(preludeStart, i).trim();
        bodyStart = i + 1;
      }
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        rules.push({ prelude, body: css.slice(bodyStart, i) });
        preludeStart = i + 1;
      }
      if (depth < 0) return rules; // unbalanced: stop rather than guess
    } else if (char === ";" && depth === 0) {
      // statements like @import / @charset: never wanted here
      preludeStart = i + 1;
    }
  }
  return rules;
}

/** Splits a selector list on top-level commas (not those inside :not(...), :is(...) etc). */
function splitSelectors(prelude: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < prelude.length; i++) {
    if (prelude[i] === "(") depth++;
    else if (prelude[i] === ")") depth--;
    else if (prelude[i] === "," && depth === 0) {
      parts.push(prelude.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(prelude.slice(start).trim());
  return parts.filter(Boolean);
}

function filterCss(css: string): string {
  const out: string[] = [];
  for (const { prelude, body } of splitRules(css)) {
    if (prelude.startsWith("@media") || prelude.startsWith("@supports")) {
      const inner = filterCss(body);
      if (inner) out.push(`${prelude}{${inner}}`);
    } else if (prelude.startsWith("@")) {
      // @font-face, @keyframes, @page…: keyframes are harmless, the rest unexpected; keep only keyframes
      if (/^@(-webkit-)?keyframes\b/.test(prelude)) out.push(`${prelude}{${body}}`);
    } else {
      // keep only selectors scoped to the article, and none for parts Lemma restyles
      const kept = splitSelectors(prelude).filter(
        (selector) => selector.includes(".mw-parser-output") && !RESTYLED_SELECTOR.test(selector),
      );
      if (kept.length) out.push(`${kept.join(",")}{${body}}`);
    }
  }
  return out.join("\n");
}

/** Collects, de-duplicates and filters the TemplateStyles in raw (unsanitized) article HTML. */
export function extractTemplateStyles(html: string): string {
  const seen = new Set<string>();
  const sheets: string[] = [];
  for (const match of html.matchAll(/<style\b[^>]*data-mw-deduplicate="([^"]*)"[^>]*>([\s\S]*?)<\/style>/g)) {
    const [, key, css] = match;
    if (seen.has(key)) continue;
    seen.add(key);
    const filtered = filterCss(css);
    if (filtered) sheets.push(filtered);
  }
  // CSS can't end a <style> early, but never let a stray "</" through anyway
  return sheets.join("\n").replaceAll("</", "<\\/");
}
