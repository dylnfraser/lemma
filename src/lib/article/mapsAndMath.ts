import type { Coordinates } from "./types";

// Maps, coordinates and formulas: parts of Wikipedia's HTML that lean on its own scripts and services.

/** OpenStreetMap centred on a place, with a marker on it. */
export function openStreetMapUrl({ lat, lon }: Coordinates, zoom = 15): string {
  const round = (value: number) => Number(value.toFixed(6));
  return `https://www.openstreetmap.org/?mlat=${round(lat)}&mlon=${round(lon)}#map=${zoom}/${round(lat)}/${round(lon)}`;
}

/** Reads `{{coord}}`'s machine-readable "48.858222; 2.294500" (the hidden `.geo` span). */
export function readGeo(element: Element | null | undefined): Coordinates | null {
  const match = element?.textContent?.match(/(-?\d+(?:\.\d+)?)\s*;\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

/**
 * Where the article's subject is: the coordinates Wikipedia shows by the title (#coordinates), or failing that the
 * ones in the infobox. Coordinates elsewhere in the text may be of other places, so they don't count.
 */
export function findArticleCoordinates(root: Element): Coordinates | null {
  return readGeo(root.querySelector("#coordinates .geo")) ?? readGeo(root.querySelector("table.infobox .geo"));
}

/**
 * Coordinates link to GeoHack (a page of map services) and maps to Wikipedia's map viewer; both point at OpenStreetMap
 * instead. The static map image becomes a link to the same place rather than an image for the viewer.
 */
export function convertMaps(root: Element, coordinates: Coordinates | null) {
  // {{coord}} links: each carries its own position
  root.querySelectorAll<HTMLAnchorElement>('a[href*="geohack.toolforge.org"]').forEach((link) => {
    const position = readGeo(link.querySelector(".geo"));
    if (position) link.setAttribute("href", openStreetMapUrl(position));
  });

  // {{maplink}}: an inline link to an interactive map
  root.querySelectorAll<HTMLAnchorElement>("a.mw-kartographer-maplink").forEach((link) => {
    const lat = Number(link.dataset.lat);
    const lon = Number(link.dataset.lon);
    const zoom = Number(link.dataset.zoom) || 13;
    if (Number.isFinite(lat) && Number.isFinite(lon) && link.dataset.lat && link.dataset.lon) {
      link.setAttribute("href", openStreetMapUrl({ lat, lon }, zoom));
    } else if (coordinates) {
      link.setAttribute("href", openStreetMapUrl(coordinates, zoom));
    } else {
      link.replaceWith(...link.childNodes);
    }
  });

  // {{mapframe}}: a static map picture
  root.querySelectorAll<HTMLElement>(".mw-kartographer-map").forEach((frame) => {
    const image = frame.querySelector("img");
    if (!image) {
      frame.remove();
      return;
    }
    // a sharper 2x picture in place of the srcset (its sizes don't match the column the map is shown in)
    image.removeAttribute("srcset");
    const retina = image.getAttribute("src")?.replace(/,(\d+)x(\d+)\.png/, ",$1x$2@2x.png");
    if (retina) image.setAttribute("src", retina);
    image.className = "map-image";
    image.setAttribute("alt", "Map");

    const lat = Number(frame.dataset.lat);
    const lon = Number(frame.dataset.lon);
    const zoom = Number(frame.dataset.zoom) || 13;
    const position = frame.dataset.lat && frame.dataset.lon ? { lat, lon } : coordinates;

    const doc = root.ownerDocument;
    const replacement = doc.createElement(position ? "a" : "span");
    replacement.className = "map-frame";
    if (position) {
      replacement.setAttribute("href", openStreetMapUrl(position, zoom));
      const label = doc.createElement("span");
      label.className = "map-open";
      label.textContent = "Open map";
      replacement.append(image, label);
    } else {
      replacement.append(image);
    }
    frame.replaceWith(replacement);
  });
}

const MATH_RENDER_PREFIX = "https://wikimedia.org/api/rest_v1/media/math/render/svg/";

/**
 * Formulas are rendered as black SVG pictures. Each is drawn instead as a mask filled with the text colour, so formulas
 * match the prose around them in light and dark mode. (The renderer allows cross-origin use, which masks need.)
 */
export function tintMath(root: Element) {
  root.querySelectorAll<HTMLImageElement>("img.mwe-math-fallback-image-inline, img.mwe-math-fallback-image-display").forEach((image) => {
    const src = image.getAttribute("src") ?? "";
    if (!src.startsWith(MATH_RENDER_PREFIX) || !/^[\w/:.-]+$/.test(src)) return;
    image.classList.remove("mw-invert", "skin-invert");
    image.classList.add("math-tinted");
    image.style.setProperty("--math-src", `url("${src}")`);
  });
}
