/**
 * The reader's settings: theme, text size, body font and line width. Like the library they live only in this browser
 * (localStorage), and other tabs stay in step. They're applied as attributes on <html> (see app.css): app.html applies
 * the stored ones before the first paint, so a dark or sepia page never flashes light, and this keeps them current.
 */

export type Theme = "system" | "light" | "sepia" | "dark";
export type BodyFont = "mixed" | "serif" | "sans";
export type LineWidth = "narrow" | "normal" | "wide";

export const THEMES: readonly Theme[] = ["system", "light", "sepia", "dark"];
/** mixed: serif headings and titles over sans text (Lemma's own); serif or sans: one typeface throughout. */
export const BODY_FONTS: readonly BodyFont[] = ["mixed", "serif", "sans"];
export const LINE_WIDTHS: readonly LineWidth[] = ["narrow", "normal", "wide"];
/** Text sizes as multiples of the default; the setting is an index into this. */
export const TEXT_SIZES = [0.9, 1, 1.1, 1.2, 1.32] as const;
const DEFAULT_TEXT_SIZE = 1;

export type ReaderSettings = { theme: Theme; textSize: number; font: BodyFont; width: LineWidth };

const DEFAULTS: ReaderSettings = { theme: "system", textSize: DEFAULT_TEXT_SIZE, font: "mixed", width: "normal" };
// app.html reads the same key
const STORAGE_KEY = "lemma:settings:v1";

const pick = <T>(options: readonly T[], value: unknown, fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

function read(): ReaderSettings {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? {};
    return {
      theme: pick(THEMES, value.theme, DEFAULTS.theme),
      textSize: pick(TEXT_SIZES.map((_, i) => i), value.textSize, DEFAULTS.textSize),
      font: pick(BODY_FONTS, value.font, DEFAULTS.font),
      width: pick(LINE_WIDTHS, value.width, DEFAULTS.width),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

const state = $state<ReaderSettings>(read());

const systemDark = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

/** Puts the settings on <html>: data-theme (as chosen), data-scheme (light or dark, "system" resolved), and the rest. */
function apply() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = state.theme;
  root.dataset.scheme = state.theme === "dark" || (state.theme === "system" && systemDark?.matches) ? "dark" : "light";
  root.dataset.font = state.font;
  root.dataset.width = state.width;
  root.style.setProperty("--text-scale", String(TEXT_SIZES[state.textSize]));
}

function write() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked (private mode): the settings just don't persist
  }
}

/** Changes the page's colours with a short cross-fade where the browser can (rather than everything snapping at once). */
function changeColours(update: () => void) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduced) update();
  else document.startViewTransition(update);
}

if (typeof window !== "undefined") {
  apply();
  systemDark?.addEventListener("change", () => state.theme === "system" && changeColours(apply));
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    Object.assign(state, read());
    apply();
  });
}

function update(change: Partial<ReaderSettings>) {
  const recolour = change.theme !== undefined && change.theme !== state.theme;
  Object.assign(state, change);
  write();
  if (recolour) changeColours(apply);
  else apply();
}

export const settings = {
  get theme() {
    return state.theme;
  },
  get textSize() {
    return state.textSize;
  },
  get font() {
    return state.font;
  },
  get width() {
    return state.width;
  },
  get isDefault() {
    return (Object.keys(DEFAULTS) as (keyof ReaderSettings)[]).every((key) => state[key] === DEFAULTS[key]);
  },

  setTheme: (theme: Theme) => update({ theme }),
  setFont: (font: BodyFont) => update({ font }),
  setWidth: (width: LineWidth) => update({ width }),
  /** Steps the text size up (1) or down (-1), within the available sizes. */
  stepTextSize: (by: 1 | -1) =>
    update({ textSize: Math.min(Math.max(state.textSize + by, 0), TEXT_SIZES.length - 1) }),
  reset: () => update({ ...DEFAULTS }),
};
