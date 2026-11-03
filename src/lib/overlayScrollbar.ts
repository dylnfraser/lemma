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

  // Geometry, measured only when sizes change; scrolling just moves the thumb from these (no layout reads per frame).
  let range = 0;
  let trackWidth = 0;
  let thumbSize = 0;
  let idleTimer: ReturnType<typeof setTimeout>;
  let frame = 0;
  let layoutFrame = 0;
  let dragFrame = 0;
  let dragStart: { pointerX: number; scrollLeft: number } | null = null;
  let dragX = 0;

  function layout() {
    layoutFrame = 0;
    // reads first, then writes, so this costs one layout rather than several
    range = node.scrollWidth - node.clientWidth;
    const scrollable = range > 1;
    track.hidden = !scrollable;
    if (!scrollable) return;
    // the track runs along the element's bottom edge, inset by its side padding (so it lines up with the content)
    const style = getComputedStyle(node);
    const insetLeft = Number.parseFloat(style.paddingLeft) || 0;
    const insetRight = Number.parseFloat(style.paddingRight) || 0;
    const top = node.offsetTop + node.offsetHeight - track.offsetHeight;
    const left = node.offsetLeft + insetLeft;
    trackWidth = node.clientWidth - insetLeft - insetRight;
    thumbSize = Math.max(MIN_THUMB, (trackWidth * node.clientWidth) / node.scrollWidth);
    track.style.left = `${left}px`;
    track.style.top = `${top}px`;
    track.style.width = `${trackWidth}px`;
    thumb.style.width = `${thumbSize}px`;
    position();
  }

  function position() {
    frame = 0;
    if (range > 1) thumb.style.transform = `translateX(${(node.scrollLeft / range) * (trackWidth - thumbSize)}px)`;
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(position);
  };
  const scheduleLayout = () => {
    if (!layoutFrame) layoutFrame = requestAnimationFrame(layout);
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

  // pointer moves can outnumber frames: scroll once per frame, to the latest position
  function drag(event: PointerEvent) {
    if (!dragStart) return;
    dragX = event.clientX;
    if (dragFrame) return;
    dragFrame = requestAnimationFrame(() => {
      dragFrame = 0;
      if (!dragStart) return;
      const perPixel = range / Math.max(1, trackWidth - thumbSize);
      node.scrollTo({ left: dragStart.scrollLeft + (dragX - dragStart.pointerX) * perPixel, behavior: "instant" });
    });
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
  // the element's size, its parent's (where the track is placed) and its contents' (pictures loading change how far it
  // scrolls)
  const observer = new ResizeObserver(scheduleLayout);
  observer.observe(node);
  if (node.parentElement) observer.observe(node.parentElement);
  for (const child of node.children) observer.observe(child);
  layout();

  return {
    destroy() {
      observer.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(layoutFrame);
      cancelAnimationFrame(dragFrame);
      clearTimeout(idleTimer);
      node.removeEventListener("scroll", handleScroll);
      node.classList.remove("overlay-scrolled");
      track.remove();
    },
  };
}
