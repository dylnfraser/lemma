import { prefersReducedMotion } from "svelte/motion";
import { cubicOut, quintOut } from "svelte/easing";
import { slide, type TransitionConfig } from "svelte/transition";

/** JS-side counterparts of the motion tokens in app.css, for Svelte transitions and the Web Animations API. */
export const DURATION = { instant: 90, fast: 150, base: 240, slow: 420 } as const;
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_SPRING = "cubic-bezier(0.34, 1.4, 0.64, 1)";
export { cubicOut, quintOut };

/** A duration that collapses to zero when the reader prefers reduced motion. */
export function motion(ms: number): number {
  return prefersReducedMotion.current ? 0 : ms;
}

function isNearViewport(node: Element, margin = 200): boolean {
  const rect = node.getBoundingClientRect();
  return rect.bottom > -margin && rect.top < window.innerHeight + margin;
}

/**
 * Slide + fade for content that folds away (article sections, outline entries). Off-screen nodes skip the animation,
 * so folding a section with hundreds of blocks only animates the handful the reader can actually see.
 */
export function fold(node: Element, { duration = DURATION.base }: { duration?: number } = {}): TransitionConfig {
  const slideConfig = slide(node, { duration: isNearViewport(node) ? motion(duration) : 0, easing: cubicOut });
  return {
    ...slideConfig,
    css: (t, u) => `${slideConfig.css?.(t, u) ?? ""};opacity: ${cubicOut(t)};`,
  };
}
