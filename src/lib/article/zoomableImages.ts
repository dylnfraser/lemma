import type { ArticleImage } from "./types";

/**
 * Turns the article-sized images inside Wikipedia HTML (galleries, the infobox) into buttons that open the viewer, so
 * they work from the keyboard as well as the mouse. Each image's link to its File: page is unwrapped (a click should
 * zoom, not leave), and its button carries `data-lightbox-index`, the image's position in the returned list.
 */
export function makeImagesZoomable(
  container: Element,
  toImage: (image: HTMLImageElement) => ArticleImage | null,
): ArticleImage[] {
  const images: ArticleImage[] = [];

  container.querySelectorAll("img").forEach((element) => {
    const image = toImage(element);
    if (!image) return;

    const link = element.closest("a");
    if (link && container.contains(link) && link.querySelectorAll("img").length === 1 && !link.textContent?.trim()) {
      link.replaceWith(...link.childNodes);
    }

    const button = element.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "zoom-image";
    button.dataset.lightboxIndex = String(images.length);
    button.setAttribute("aria-label", image.alt ? `View full screen: ${image.alt}` : "View image full screen");
    element.replaceWith(button);
    button.append(element);
    images.push(image);
  });

  return images;
}
