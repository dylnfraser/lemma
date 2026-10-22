/**
 * The reader's own library: articles read recently, articles saved for later, and where they stopped in each. It lives
 * only in this browser (localStorage); nothing is sent anywhere. Other tabs stay in step through the storage event.
 */

export type LibraryEntry = {
  title: string;
  description: string;
  /** A small thumbnail URL, or an empty string. */
  thumbnail: string;
  /** When it was read (history) or saved, in ms since the epoch. */
  at: number;
};

export type ReadingPosition = {
  /** The section heading the reader was in (empty: before the first heading). */
  headingId: string;
  headingText: string;
  /** Pixels scrolled past that heading's top. */
  offset: number;
  /** How far through the article, 0–1. */
  progress: number;
  at: number;
};

type Stored = {
  history: LibraryEntry[];
  saved: LibraryEntry[];
  positions: Record<string, ReadingPosition>;
};

const STORAGE_KEY = "lemma:library:v1";
const MAX_HISTORY = 60;
const MAX_POSITIONS = 120;

function emptyLibrary(): Stored {
  return { history: [], saved: [], positions: {} };
}

function read(): Stored {
  if (typeof localStorage === "undefined") return emptyLibrary();
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!value || typeof value !== "object") return emptyLibrary();
    return {
      history: Array.isArray(value.history) ? value.history : [],
      saved: Array.isArray(value.saved) ? value.saved : [],
      positions: value.positions && typeof value.positions === "object" ? value.positions : {},
    };
  } catch {
    return emptyLibrary();
  }
}

const state = $state<Stored>(read());

function write() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked (private mode): the library just doesn't persist
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    const next = read();
    state.history = next.history;
    state.saved = next.saved;
    state.positions = next.positions;
  });
}

const withoutTitle = (entries: LibraryEntry[], title: string) => entries.filter((entry) => entry.title !== title);

export const library = {
  get history(): readonly LibraryEntry[] {
    return state.history;
  },
  get saved(): readonly LibraryEntry[] {
    return state.saved;
  },

  isSaved(title: string): boolean {
    return state.saved.some((entry) => entry.title === title);
  },

  /** Puts an article at the top of the history. */
  recordVisit(entry: Omit<LibraryEntry, "at">) {
    state.history = [{ ...entry, at: Date.now() }, ...withoutTitle(state.history, entry.title)].slice(0, MAX_HISTORY);
    write();
  },

  removeFromHistory(title: string) {
    state.history = withoutTitle(state.history, title);
    delete state.positions[title];
    write();
  },

  clearHistory() {
    state.history = [];
    state.positions = {};
    write();
  },

  /** Saves the article, or unsaves it if it already is; returns whether it's now saved. */
  toggleSaved(entry: Omit<LibraryEntry, "at">): boolean {
    const saved = library.isSaved(entry.title);
    state.saved = saved ? withoutTitle(state.saved, entry.title) : [{ ...entry, at: Date.now() }, ...state.saved];
    write();
    return !saved;
  },

  position(title: string): ReadingPosition | null {
    return state.positions[title] ?? null;
  },

  savePosition(title: string, position: Omit<ReadingPosition, "at">) {
    state.positions[title] = { ...position, at: Date.now() };
    // keep only the most recent positions
    const titles = Object.keys(state.positions);
    if (titles.length > MAX_POSITIONS) {
      titles
        .sort((a, b) => state.positions[a].at - state.positions[b].at)
        .slice(0, titles.length - MAX_POSITIONS)
        .forEach((old) => delete state.positions[old]);
    }
    write();
  },

  clearPosition(title: string) {
    if (!(title in state.positions)) return;
    delete state.positions[title];
    write();
  },
};
