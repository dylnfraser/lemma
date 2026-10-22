/**
 * An article's mood: the dominant colour of its lead image, as an OKLCH hue, used to tint the page's accents.
 * Greyscale or near-greyscale images (portrait photographs, diagrams) give no tint.
 */

export type Tint = { hue: number; chroma: number };

const SAMPLE = 24;
// below this, an image is effectively grey: no tint
const MIN_CHROMA = 0.04;

/** sRGB (0–255) to OKLCH lightness, chroma and hue (degrees). */
export function rgbToOklch(r: number, g: number, b: number): { l: number; c: number; h: number } {
  const linear = (value: number) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.hypot(a, bb);
  const h = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/**
 * The image's prevailing hue from raw RGBA pixels: each pixel votes for its hue, weighted by how colourful it is (so a
 * blue sky outvotes a grey wall), averaged on the colour wheel. Null for images without real colour.
 */
export function dominantTint(pixels: Uint8ClampedArray): Tint | null {
  let x = 0;
  let y = 0;
  let weight = 0;
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue; // transparent
    const { l, c, h } = rgbToOklch(pixels[i], pixels[i + 1], pixels[i + 2]);
    count++;
    // very dark and very light pixels carry little colour you'd notice
    if (l < 0.2 || l > 0.95) continue;
    const w = c * c;
    const rad = (h * Math.PI) / 180;
    x += Math.cos(rad) * w;
    y += Math.sin(rad) * w;
    weight += c;
  }
  if (count === 0) return null;
  const chroma = weight / count;
  if (chroma < MIN_CHROMA) return null;
  const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return { hue: Math.round(hue), chroma };
}

/** Samples an image URL (it must allow cross-origin reads, as Wikimedia's do). Resolves null when it can't. */
export function sampleTint(src: string, signal?: AbortSignal): Promise<Tint | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    signal?.addEventListener("abort", () => resolve(null), { once: true });
    image.onerror = () => resolve(null);
    image.onload = () => {
      if (signal?.aborted) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0, SAMPLE, SAMPLE);
        resolve(dominantTint(context.getImageData(0, 0, SAMPLE, SAMPLE).data));
      } catch {
        resolve(null); // a tainted canvas (no CORS) or similar
      }
    };
    image.src = src;
  });
}
