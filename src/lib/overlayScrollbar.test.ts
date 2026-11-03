import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { overlayScrollbar } from "./overlayScrollbar";

// jsdom has no layout: the strip gets fixed sizes, resizes are reported by hand, and frames run when `nextFrame` says.
let resized: () => void;
let frames: FrameRequestCallback[] = [];
const nextFrame = () => frames.splice(0).forEach((callback) => callback(0));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const size = (element: HTMLElement, sizes: Record<string, number>) => {
  for (const [name, value] of Object.entries(sizes)) Object.defineProperty(element, name, { value, configurable: true });
};

/** A strip 250px wide showing a quarter of its 1000px of pictures, with 10px of padding each side. */
function strip(scrollWidth = 1000) {
  const parent = document.createElement("div");
  const node = document.createElement("div");
  node.style.paddingLeft = node.style.paddingRight = "10px";
  parent.append(node);
  document.body.append(parent);
  size(node, { scrollWidth, clientWidth: 250, offsetLeft: 0, offsetTop: 0, offsetHeight: 100 });
  const action = overlayScrollbar(node);
  const track = parent.querySelector<HTMLElement>(".overlay-track")!;
  const thumb = track.querySelector<HTMLElement>(".overlay-thumb")!;
  return { node, track, thumb, action };
}

const scrollTo = (node: HTMLElement, left: number) => {
  node.scrollLeft = left;
  node.dispatchEvent(new Event("scroll"));
  nextFrame();
};

describe("overlayScrollbar", () => {
  it("sizes the thumb to the share showing, and moves it with scrolling", () => {
    const { node, track, thumb } = strip();
    // the track runs inside the padding: 250 - 10 - 10
    expect(track.style.width).toBe("230px");
    expect(thumb.style.width).toBe("57.5px");

    scrollTo(node, 750);
    expect(thumb.style.transform).toBe("translateX(172.5px)");
    scrollTo(node, 375);
    expect(thumb.style.transform).toBe("translateX(86.25px)");
  });

  it("hides when there's nothing to scroll", () => {
    const { track } = strip(250);
    expect(track.hidden).toBe(true);
  });

  it("measures when sizes change, not on every scroll", () => {
    const { node, thumb } = strip();
    // more pictures load: nothing re-measures until the resize is reported
    size(node, { scrollWidth: 2000 });
    scrollTo(node, 750);
    expect(thumb.style.width).toBe("57.5px");

    resized();
    nextFrame();
    // 230 × 250 / 2000 is under the 36px minimum
    expect(thumb.style.width).toBe("36px");
    expect(thumb.style.transform).toBe(`translateX(${(750 / 1750) * (230 - 36)}px)`);
  });

  it("removes itself", () => {
    const { node, action } = strip();
    action?.destroy();
    expect(document.querySelector(".overlay-track")).toBeNull();
    expect(node.classList.contains("overlay-scrolled")).toBe(false);
  });
});
