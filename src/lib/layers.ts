/**
 * Escape closes the layer opened most recently (a panel, sheet, card or the image viewer), not every one that's open:
 * with settings open under search, or the viewer over an expanded gallery, one press peels back one layer. Each
 * registers while it's open, typically from an effect: `$effect(() => { if (open) return escapeCloses(close); })`.
 *
 * A handler that deals with Escape itself first (a search field clearing its text) calls `preventDefault()`, and the
 * layers leave that press alone.
 */
const layers: (() => void)[] = [];
let listening = false;

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented || layers.length === 0) return;
  event.preventDefault();
  layers.at(-1)!();
}

/** Makes Escape call `close` while it's the newest layer; returns the function that unregisters it. */
export function escapeCloses(close: () => void): () => void {
  if (!listening) {
    window.addEventListener("keydown", handleKeydown);
    listening = true;
  }
  layers.push(close);
  return () => {
    const index = layers.lastIndexOf(close);
    if (index >= 0) layers.splice(index, 1);
  };
}
