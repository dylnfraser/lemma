/**
 * The thread of articles read in this session (Alan Turing → Enigma → Bletchley Park), kept in sessionStorage so it
 * lasts while the tab does. Going back to an article already on the thread folds the thread back to it; going home
 * ends the thread, so the next article starts a new one.
 */

const STORAGE_KEY = "lemma:trail";
const MAX = 8;

function read(): string[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

const state = $state({ titles: read() });

function save(titles: string[]) {
  state.titles = titles;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(titles));
  } catch {
    // storage unavailable: the thread lasts until the page reloads
  }
}

export const trail = {
  get titles(): readonly string[] {
    return state.titles;
  },

  /** Records arriving at `title`: it becomes the end of the thread (anything read after it is let go). */
  visit(title: string) {
    const index = state.titles.indexOf(title);
    save(index === -1 ? [...state.titles, title].slice(-MAX) : state.titles.slice(0, index + 1));
  },

  /** Ends the thread (on the home page): the next article starts a new one. */
  clear() {
    if (state.titles.length) save([]);
  },
};
