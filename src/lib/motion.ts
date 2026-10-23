import { prefersReducedMotion } from "svelte/motion";
import { cubicOut, quintOut } from "svelte/easing";
import { slide, type TransitionConfig } from "svelte/transition";

/** JS-side counterparts of the motion tokens in app.css, for Svelte transitions and the Web Animations API. */
export const DURATION = { instant: 90, fast: 200, base: 260, slow: 420 } as const;
/** Matches --blur: how blurred things are as they appear. */
export const BLUR_PX = 4;
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_SPRING = "cubic-bezier(0.34, 1.4, 0.64, 1)";
export { cubicOut, quintOut };

/** Set while the page is being printed: everything appears at once, or the printout catches it mid-animation. */
export const motionPaused = { current: false };

/** A duration that collapses to zero when the reader prefers reduced motion (or the page is printing). */
export function motion(ms: number): number {
  return prefersReducedMotion.current || motionPaused.current ? 0 : ms;
}

// Which elements were near the viewport this frame, measured a whole row of siblings at a time (see below).
let nearViewport: WeakMap<Element, boolean> | null = null;

/**
 * Folding a section runs a transition for each of its blocks, one after another, and each one's styles dirty the
 * layout: measuring them one at a time would lay out the whole article again for every block (seconds, for a long
 * section). So the first call measures the node's siblings in a single pass, and the answers last for the frame.
 */
function isNearViewport(node: Element, margin = 200): boolean {
  if (!nearViewport) {
    nearViewport = new WeakMap();
    requestAnimationFrame(() => (nearViewport = null));
  }
  let near = nearViewport.get(node);
  if (near === undefined) {
    const top = -margin;
    const bottom = window.innerHeight + margin;
    for (const element of node.parentElement?.children ?? [node]) {
      const rect = element.getBoundingClientRect();
      nearViewport.set(element, rect.bottom > top && rect.top < bottom);
    }
    near = nearViewport.get(node) ?? false;
  }
  return near;
}

/**
 * Popovers, panels and dialogs: they grow out of where they're anchored (set transform-origin on the element) while
 * fading in from a blur. The site-wide counterpart of the `enter` keyframes.
 */
export function pop(
  _node: Element,
  { duration = DURATION.base, start = 0.96, y = 0, delay = 0 }: { duration?: number; start?: number; y?: number; delay?: number } = {},
): TransitionConfig {
  return {
    duration: motion(duration),
    delay,
    easing: cubicOut,
    // transform, not translate/scale: popovers often centre themselves with `translate`, which must keep working
    css: (t, u) => `opacity: ${t}; transform: translateY(${u * y}px) scale(${start + (1 - start) * t}); filter: blur(${u * BLUR_PX}px);`,
  };
}

/** Toasts, bars and rows: a short rise (or drop, with a negative `y`) out of a blur. */
export function rise(
  _node: Element,
  { duration = DURATION.base, y = 8, delay = 0 }: { duration?: number; y?: number; delay?: number } = {},
): TransitionConfig {
  return {
    duration: motion(duration),
    delay,
    easing: cubicOut,
    css: (t, u) => `opacity: ${t}; transform: translateY(${u * y}px); filter: blur(${u * BLUR_PX}px);`,
  };
}

/**
 * Slide + fade for content that folds away (article sections, outline entries). Off-screen nodes skip the animation,
 * so folding a section with hundreds of blocks only animates the handful the reader can actually see.
 */
export function fold(node: Element, { duration = DURATION.base }: { duration?: number } = {}): TransitionConfig {
  // not even slide's own measuring for nodes off screen
  if (!isNearViewport(node) || !motion(duration)) return { duration: 0 };
  const slideConfig = slide(node, { duration: motion(duration), easing: cubicOut });
  return {
    ...slideConfig,
    css: (t, u) => `${slideConfig.css?.(t, u) ?? ""};opacity: ${cubicOut(t)};filter: blur(${u * (BLUR_PX / 2)}px);`,
  };
}
