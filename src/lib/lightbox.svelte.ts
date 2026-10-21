import type { ArticleImage } from "$lib/article/types";

/**
 * Shared state for the full-screen image viewer. `sources` are the on-page elements each image was opened from,
 * so the viewer can zoom out of (and back into) the right thumbnail.
 */
export const lightbox = $state<{
  open: boolean;
  images: ArticleImage[];
  sources: (HTMLElement | null)[];
  index: number;
  /** Opened from the keyboard: focus moves into the viewer and back out on close. Mouse opens leave focus alone. */
  keyboard: boolean;
}>({ open: false, images: [], sources: [], index: 0, keyboard: false });

export function openLightbox(images: ArticleImage[], index: number, sources: (HTMLElement | null)[], keyboard = false) {
  lightbox.keyboard = keyboard;
  lightbox.images = images;
  lightbox.sources = sources;
  lightbox.index = index;
  lightbox.open = true;
}

export function closeLightbox() {
  lightbox.open = false;
}
