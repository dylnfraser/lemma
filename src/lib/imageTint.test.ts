import { describe, expect, it } from "vitest";
import { dominantTint, rgbToOklch } from "./imageTint";

const fill = (count: number, ...rgb: [number, number, number][]) => {
  const pixels = new Uint8ClampedArray(count * rgb.length * 4);
  rgb.forEach(([r, g, b], group) => {
    for (let i = 0; i < count; i++) pixels.set([r, g, b, 255], (group * count + i) * 4);
  });
  return pixels;
};

describe("rgbToOklch", () => {
  it("matches known OKLCH values", () => {
    const white = rgbToOklch(255, 255, 255);
    expect(white.l).toBeCloseTo(1, 3);
    expect(white.c).toBeLessThan(0.001);
    const red = rgbToOklch(255, 0, 0);
    expect(red.l).toBeCloseTo(0.628, 2);
    expect(red.c).toBeCloseTo(0.258, 2);
    expect(red.h).toBeCloseTo(29.2, 0);
    const blue = rgbToOklch(0, 0, 255);
    expect(blue.h).toBeCloseTo(264, 0);
  });
});

describe("dominantTint", () => {
  it("finds the prevailing hue of a colourful image", () => {
    const tint = dominantTint(fill(50, [40, 110, 200]));
    expect(tint).not.toBeNull();
    expect(tint!.hue).toBeGreaterThan(240);
    expect(tint!.hue).toBeLessThan(270);
  });

  it("lets colourful pixels outvote grey ones", () => {
    const tint = dominantTint(fill(50, [120, 120, 120], [200, 60, 40]));
    expect(tint!.hue).toBeGreaterThan(20);
    expect(tint!.hue).toBeLessThan(45);
  });

  it("gives no tint for greyscale images", () => {
    expect(dominantTint(fill(50, [90, 90, 90], [180, 180, 180]))).toBeNull();
    expect(dominantTint(new Uint8ClampedArray(0))).toBeNull();
  });
});
