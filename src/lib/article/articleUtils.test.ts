import { describe, expect, it } from "vitest";
import {
  countWords,
  getArticlePath,
  getBestImageSrc,
  getImageFileName,
  mayHaveTransparency,
  resizeWikimediaThumb,
  safeDecodeURIComponent,
} from "./articleUtils";

function image(attributes: Record<string, string>): HTMLImageElement {
  const element = document.createElement("img");
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

const base = "//thumb.wikimedia.org/wikipedia/commons/thumb/a/ab";

describe("getBestImageSrc", () => {
  it("resizes vector thumbnails", () => {
    const src = getBestImageSrc(image({ src: `${base}/Diagram.svg/250px-Diagram.svg.png`, "data-file-width": "300" }));
    expect(src).toBe("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Diagram.svg/960px-Diagram.svg.png");
  });

  it("resizes raster thumbnails whose original is wider than the target", () => {
    const src = getBestImageSrc(image({ src: `${base}/Photo.jpg/250px-Photo.jpg?x=1`, "data-file-width": "3000" }));
    expect(src).toBe("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Photo.jpg/960px-Photo.jpg?x=1");
  });

  it("uses the largest offered candidate for small rasters", () => {
    const src = getBestImageSrc(
      image({
        src: `${base}/Photo.jpg/250px-Photo.jpg`,
        srcset: `${base}/Photo.jpg/375px-Photo.jpg 1.5x, ${base}/Photo.jpg/500px-Photo.jpg 2x`,
        "data-file-width": "640",
      }),
    );
    expect(src).toBe("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Photo.jpg/500px-Photo.jpg");
  });

  it("leaves non-thumbnail sources alone", () => {
    expect(getBestImageSrc(image({ src: "https://example.com/a.png", "data-file-width": "5000" }))).toBe(
      "https://example.com/a.png",
    );
    expect(resizeWikimediaThumb("not a url")).toBe("not a url");
  });
});

describe("helpers", () => {
  it("counts words across any whitespace", () => {
    expect(countWords("  one\ttwo\n\nthree  ")).toBe(3);
    expect(countWords("")).toBe(0);
  });

  it("builds article paths", () => {
    expect(getArticlePath(" Alan Turing ")).toBe("/wiki/Alan_Turing");
    expect(getArticlePath("AC/DC")).toBe("/wiki/AC%2FDC");
  });

  it("decodes safely", () => {
    expect(safeDecodeURIComponent("Fr%C3%BChe")).toBe("Frühe");
    expect(safeDecodeURIComponent("100%")).toBe("100%");
  });
});

describe("getImageFileName", () => {
  it("reads the original file from thumbnails and direct uploads", () => {
    expect(getImageFileName(`${base}/Diagram.svg/250px-Diagram.svg.png`)).toBe("Diagram.svg");
    expect(getImageFileName("https://upload.wikimedia.org/wikipedia/en/c/cd/Caf%C3%A9_logo.png")).toBe("Café_logo.png");
  });

  it("is null for images that aren't uploads", () => {
    expect(getImageFileName("https://wikimedia.org/api/rest_v1/media/math/render/svg/abc")).toBeNull();
    expect(getImageFileName("not a url")).toBeNull();
  });
});

describe("mayHaveTransparency", () => {
  it("goes by the original file's format, not the thumbnail's", () => {
    expect(mayHaveTransparency(`${base}/Diagram.svg/250px-Diagram.svg.png`)).toBe(true);
    expect(mayHaveTransparency(`${base}/Map.png/250px-Map.png`)).toBe(true);
    expect(mayHaveTransparency(`${base}/Photo.jpg/250px-Photo.jpg`)).toBe(false);
  });
});
