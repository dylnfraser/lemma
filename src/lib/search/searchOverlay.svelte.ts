/** Shared state for the global search overlay so any page (navbar, error page) can open it. */
export const searchOverlay = $state({ open: false, query: "" });

export function openSearch(query = "") {
  searchOverlay.query = query;
  searchOverlay.open = true;
}

export function closeSearch() {
  searchOverlay.open = false;
}

export function toggleSearch() {
  if (searchOverlay.open) closeSearch();
  else openSearch();
}

/** True when a keystroke is going into a text field and shouldn't trigger shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
}

export function isSearchShortcut(event: KeyboardEvent): boolean {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") return true;
  return event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget(event.target);
}
