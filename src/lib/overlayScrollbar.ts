import { prefersReducedMotion } from "svelte/motion";

/**
 * A horizontal overlay scrollbar for a sideways-scrolling element, matching the page's own (PageScrollbar): a thin
 * thumb that shows while scrolling, widens when reached for, and can be dragged. The native scrollbar is hidden;
 * wheel, trackpad, touch and keyboard scrolling stay native. The track is added to the element's parent, which must
 * be positioned. Styles: `.overlay-track` in app.css. Pass `false` to leave the element alone.
 */
export function overlayScrollbar(node: HTMLElement, enabled = true) {
  if (!enabled) return;
  const MIN_THUMB = 36;
  const IDLE_MS = 1200;

  const track = document.createElement("div");
  track.className = "overlay-track";
  track.setAttribute("aria-hidden", "true");
  const thumb = document.createElement("div");
  thumb.className = "overlay-thumb";
  track.append(thumb);
  node.after(track);
  node.classList.add("overlay-scrolled");

  let thumbSize = 0;
  let idleTimer: ReturnType<typeof setTimeout>;
  let frame = 0;
  let dragStart: { pointerX: number; scrollLeft: number } | null = null;

  const range = () => node.scrollWidth - node.clientWidth;

  function measure() {
    frame = 0;
    const scrollable = range() > 1;
    track.hidden = !scrollable;
    if (!scrollable) return;
    // the track runs along the element's bottom edge, inset by its side padding (so it lines up with the content)
    const style = getComputedStyle(node);
    const insetLeft = Number.parseFloat(style.paddingLeft) || 0;
    const insetRight = Number.parseFloat(style.paddingRight) || 0;
    track.style.left = `${node.offsetLeft + insetLeft}px`;
    track.style.top = `${node.offsetTop + node.offsetHeight - track.offsetHeight}px`;
    track.style.width = `${node.clientWidth - insetLeft - insetRight}px`;
    const trackWidth = track.clientWidth;
    thumbSize = Math.max(MIN_THUMB, (trackWidth * node.clientWidth) / node.scrollWidth);
    thumb.style.width = `${thumbSize}px`;
    thumb.style.transform = `translateX(${(node.scrollLeft / range()) * (trackWidth - thumbSize)}px)`;
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(measure);
  };

  function wake() {
    track.classList.add("active");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => track.classList.remove("active"), IDLE_MS);
  }

  function handleScroll() {
    schedule();
    wake();
  }

  function startDrag(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    thumb.setPointerCapture(event.pointerId);
    track.classList.add("dragging");
    dragStart = { pointerX: event.clientX, scrollLeft: node.scrollLeft };
  }

  function drag(event: PointerEvent) {
    if (!dragStart) return;
    const perPixel = range() / (track.clientWidth - thumbSize);
    node.scrollTo({ left: dragStart.scrollLeft + (event.clientX - dragStart.pointerX) * perPixel, behavior: "instant" });
  }

  function endDrag() {
    dragStart = null;
    track.classList.remove("dragging");
    wake();
  }

  // clicking the track pages toward the click
  function pageToward(event: PointerEvent) {
    event.stopPropagation();
    const thumbLeft = thumb.getBoundingClientRect().left;
    const direction = event.clientX < thumbLeft ? -1 : 1;
    node.scrollBy({ left: direction * node.clientWidth * 0.85, behavior: prefersReducedMotion.current ? "instant" : "smooth" });
  }

  // a click on the track or thumb shouldn't reach the element's own click handlers (e.g. "click to collapse")
  const swallow = (event: Event) => event.stopPropagation();

  node.addEventListener("scroll", handleScroll, { passive: true });
  track.addEventListener("pointerdown", pageToward);
  track.addEventListener("click", swallow);
  thumb.addEventListener("pointerdown", startDrag);
  thumb.addEventListener("pointermove", drag);
  thumb.addEventListener("pointerup", endDrag);
  thumb.addEventListener("pointercancel", endDrag);
  const observer = new ResizeObserver(schedule);
  observer.observe(node);
  measure();

  return {
    destroy() {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(idleTimer);
      node.removeEventListener("scroll", handleScroll);
      node.classList.remove("overlay-scrolled");
      track.remove();
    },
  };
}
