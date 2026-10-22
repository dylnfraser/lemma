import { describe, expect, it } from "vitest";
import { darkVariant, markDarkBackgrounds, parseColor } from "./darkColors";

describe("parseColor", () => {
  it("reads hex, rgb and names", () => {
    expect(parseColor("#FFF")).toEqual([255, 255, 255]);
    expect(parseColor("#ff860d")).toEqual([255, 134, 13]);
    expect(parseColor("rgb(10, 20, 30)")).toEqual([10, 20, 30]);
    expect(parseColor("gold")).toEqual([255, 215, 0]);
    expect(parseColor("linear-gradient(red, blue)")).toBeNull();
  });
});

describe("darkVariant", () => {
  it("turns whites and greys into the card colour", () => {
    expect(darkVariant([255, 255, 255])).toContain("var(--bg-color)");
    expect(darkVariant([236, 236, 236])).toContain("var(--bg-color)");
  });

  it("keeps a colour's hue, much darker", () => {
    const orange = darkVariant([255, 134, 13]);
    const [, l, , h] = orange.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/)!.map(Number);
    expect(l).toBeLessThan(0.45);
    expect(h).toBeGreaterThan(40);
    expect(h).toBeLessThan(70);
  });
});

it("marks inline backgrounds and bgcolor with a dark counterpart", () => {
  const root = document.createElement("div");
  root.innerHTML = `<table><tr><td style="background: #FFFFFF; color:#000000;">a</td><td bgcolor="#8080FF">b</td>
    <td style="background:linear-gradient(red,blue)">c</td></tr></table>`;
  markDarkBackgrounds(root);
  const [white, blue, gradient] = root.querySelectorAll("td");
  expect(white.style.getPropertyValue("--dark-bg")).toContain("var(--bg-color)");
  expect(blue.style.getPropertyValue("--dark-bg")).toMatch(/^oklch/);
  expect(gradient.style.getPropertyValue("--dark-bg")).toBe("");
});
