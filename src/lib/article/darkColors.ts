/**
 * Wikipedia's tables paint cells with fixed light colours (white, pale blue, a bright orange heat-map). On Lemma's dark
 * page those glare, so each inline background gets a dark-mode counterpart: the same hue, darker and calmer, with
 * near-white and grey backgrounds dropping away to the page's own card colour. The counterpart is stored as
 * --dark-bg on the element and only applied in dark mode (ArticleContent). Glaring colours also get a calmer
 * light-mode counterpart, --light-bg.
 */

import { rgbToOklch } from "$lib/imageTint";

type Rgb = [number, number, number];

const NAMED: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  gold: "#ffd700",
  silver: "#c0c0c0",
  red: "#ff0000",
  green: "#008000",
  lime: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  pink: "#ffc0cb",
  lightgray: "#d3d3d3",
  lightgrey: "#d3d3d3",
  gainsboro: "#dcdcdc",
  whitesmoke: "#f5f5f5",
  ghostwhite: "#f8f8ff",
  aliceblue: "#f0f8ff",
  lightblue: "#add8e6",
  lightgreen: "#90ee90",
  lightyellow: "#ffffe0",
  lavender: "#e6e6fa",
  beige: "#f5f5dc",
  ivory: "#fffff0",
  honeydew: "#f0fff0",
  mintcream: "#f5fffa",
  azure: "#f0ffff",
  linen: "#faf0e6",
  seashell: "#fff5ee",
  snow: "#fffafa",
  wheat: "#f5deb3",
  khaki: "#f0e68c",
  salmon: "#fa8072",
  coral: "#ff7f50",
  tomato: "#ff6347",
  skyblue: "#87ceeb",
  palegreen: "#98fb98",
  peachpuff: "#ffdab9",
};

/** Parses a CSS colour as written in Wikipedia's markup: #rgb, #rrggbb, rgb(…), or a common name. */
export function parseColor(value: string): Rgb | null {
  const text = value.trim().toLowerCase();
  const hex = (NAMED[text] ?? text).match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as Rgb;
  }
  const rgb = text.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

/**
 * The dark-mode version of a light background, as a CSS colour: near-neutral colours become the card colour, and
 * coloured ones keep their hue at a low lightness, so a heat-map still reads as hotter and colder.
 */
export function darkVariant([r, g, b]: Rgb): string {
  const { l, c, h } = rgbToOklch(r, g, b);
  if (c < 0.03) {
    // white, near-white and greys: a step in from the page, darker greys a touch lighter, so stripes still show
    const step = Math.round((1 - l) * 10) / 100;
    return `color-mix(in oklch, var(--bg-color), var(--text-color) ${Math.min(14, Math.round(step * 100))}%)`;
  }
  // darker for paler colours, so a pale tint doesn't become a bright block; vivid ones keep more of their strength
  const lightness = 0.3 + c * 0.35;
  const chroma = Math.min(c * 0.6, 0.1);
  return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${h.toFixed(1)})`;
}

/**
 * The light-mode version of a glaring background (pure #0000ff, red, yellow: club colours, party colours), or null
 * when the colour is calm enough to keep. Same hue and lightness, so the text on it stays as legible, with the chroma
 * reined in to sit with the page's muted palette.
 */
export function lightVariant([r, g, b]: Rgb): string | null {
  const { l, c, h } = rgbToOklch(r, g, b);
  if (c <= VIVID_CHROMA) return null;
  return `oklch(${l.toFixed(3)} ${VIVID_CHROMA.toFixed(3)} ${h.toFixed(1)})`;
}

const VIVID_CHROMA = 0.16;

/** Stores a background's counterparts for each theme on the element. */
function markVariants(element: HTMLElement, color: Rgb) {
  element.style.setProperty("--dark-bg", darkVariant(color));
  const light = lightVariant(color);
  if (light) element.style.setProperty("--light-bg", light);
}

const BACKGROUND = /background(?:-color)?\s*:\s*([^;!]+)/i;

/**
 * After render: backgrounds that come from template classes rather than inline styles (a purple table caption) get
 * counterparts too. Only opaque backgrounds that are clearly light (for dark mode) or glaring (for both) are touched.
 */
export function markComputedDarkBackgrounds(root: Element) {
  for (const element of root.querySelectorAll<HTMLElement>("table, caption, tr, th, td, div")) {
    if (element.style.getPropertyValue("--dark-bg") || element.closest(".legend-color")) continue;
    const match = getComputedStyle(element).backgroundColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
    if (!match || (match[4] !== undefined && Number(match[4]) < 0.5)) continue;
    const rgb: Rgb = [Number(match[1]), Number(match[2]), Number(match[3])];
    const { l, c } = rgbToOklch(...rgb);
    if (c > VIVID_CHROMA) markVariants(element, rgb);
    else if (l >= 0.8) element.style.setProperty("--dark-bg", darkVariant(rgb));
  }
}

/** Gives every element with an inline background (or bgcolor) a --dark-bg to use in dark mode. */
export function markDarkBackgrounds(root: Element) {
  for (const element of root.querySelectorAll<HTMLElement>("[style*='background'], [bgcolor]")) {
    const declared = element.getAttribute("style")?.match(BACKGROUND)?.[1] ?? element.getAttribute("bgcolor") ?? "";
    // Wikipedia's palette variables (var(--background-color-…)) already follow Lemma's theme
    if (declared.includes("var(")) continue;
    const color = parseColor(declared.split(/\s+(?![^(]*\))/)[0] ?? "");
    if (!color) continue;
    markVariants(element, color);
  }
}
