import type { ArticleImage } from "$lib/article/types";
import { isKeyboardClick } from "$lib/focus";

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

/**
 * Click handler for Wikipedia HTML whose images were made zoomable (see zoomableImages.ts): opens the viewer on the
 * clicked image. `images` is the list the buttons' data-lightbox-index values point into.
 */
export function openLightboxFromClick(event: MouseEvent, images: ArticleImage[]) {
  const container = event.currentTarget as HTMLElement;
  const button = (event.target as Element).closest<HTMLElement>("[data-lightbox-index]");
  if (!button || !container.contains(button)) return;

  event.preventDefault();
  const sources = [...container.querySelectorAll<HTMLElement>("[data-lightbox-index] img")];
  openLightbox(images, Number(button.dataset.lightboxIndex), sources, isKeyboardClick(event));
}

/** Matching `onmousedown`: those image buttons shouldn't take focus from a mouse click (keyboard focus still works). */
export function preventMouseFocusOnZoomImages(event: MouseEvent) {
  if ((event.target as Element).closest("[data-lightbox-index]")) event.preventDefault();
}
