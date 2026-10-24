<script lang="ts" module>
    import { fetchImageCredit, type ImageCredit } from "$lib/api/wikipedia";

    // Credits are fetched once per file for the whole session; failures are forgotten so they can be retried.
    const credits = new Map<string, Promise<ImageCredit | null>>();

    function loadCredit(fileName: string) {
        let request = credits.get(fileName);
        if (!request) {
            request = fetchImageCredit(fileName).then((credit) => {
                if (!credit) credits.delete(fileName);
                return credit;
            });
            credits.set(fileName, request);
        }
        return request;
    }
</script>

<script lang="ts">
    import { tick } from "svelte";
    import { fade } from "svelte/transition";
    import { getFilePath, resizeWikimediaThumb } from "$lib/article/articleUtils";
    import { preventMouseFocus } from "$lib/focus";
    import { closeLightbox, lightbox } from "$lib/lightbox.svelte";
    import { BLUR_PX, DURATION, EASE_OUT, motion } from "$lib/motion";
    import ChevronIcon from "../icons/ChevronIcon.svelte";
    import Icon from "../icons/Icon.svelte";

    const OPEN_MS = 260;
    const CLOSE_MS = 210;
    // quick start, soft landing: feels snappier than a plain ease-out at the same duration
    const SNAP = "cubic-bezier(0.16, 1, 0.3, 1)";
    // the frame's resting corners and shadow (keep in step with the styles below)
    const FRAME_CLIP = "inset(0px 0px round 8px)";
    const FRAME_SHADOW = "0 30px 80px -20px rgb(0 0 0 / 45%)";
    const NO_SHADOW = "0 0px 0px 0px rgb(0 0 0 / 0%)";
    const SWIPE_PX = 50;
    // dragging the picture down this far lets it go
    const DISMISS_PX = 110;
    // movement below this is still a click/tap
    const DRAG_SLOP_PX = 6;
    const MAX_ZOOM = 4;
    const KEY_ZOOM_STEP = 1.5;
    const KEY_PAN_PX = 80;

    type Point = { x: number; y: number };
    type Zoom = { scale: number; x: number; y: number };
    const UNZOOMED: Zoom = { scale: 1, x: 0, y: 0 };

    let stage = $state<HTMLElement>();
    let frame = $state<HTMLElement>();
    let crop = $state<HTMLElement>();
    let baseImage = $state<HTMLImageElement>();
    let hiResImage = $state<HTMLImageElement>();
    let closeButton = $state<HTMLButtonElement>();
    let closing = $state(false);
    // true while the picture zooms back into its thumbnail; the backdrop fades out in step with it
    let zoomingBack = $state(false);
    let hiResLoaded = $state(false);
    let credit = $state<ImageCredit | null>(null);
    let returnFocusTo: HTMLElement | null = null;

    // Zoom and pan of the picture, plus the unzoomed drag offset of a swipe or drag-to-dismiss in progress.
    let zoom = $state<Zoom>(UNZOOMED);
    let drag = $state<Point>({ x: 0, y: 0 });
    // While a finger, mouse or wheel is moving the picture it follows directly; otherwise changes ease.
    let gesturing = $state(false);
    const pointers = new Map<number, Point>();
    let gesture: { start: Point[]; from: Zoom; axis: "x" | "y" | null } | null = null;
    // A drag shouldn't also count as the click that zooms or closes.
    let moved = false;
    let wheelTimer: ReturnType<typeof setTimeout>;

    let image = $derived(lightbox.images[lightbox.index]);
    let count = $derived(lightbox.images.length);
    let aspect = $derived(image?.width && image?.height ? image.width / image.height : null);
    // Article images come at 960px; the viewer asks Wikimedia for a sharper copy and swaps it in once loaded.
    let hiResSrc = $derived(image && /\/960px-/.test(image.src) ? resizeWikimediaThumb(image.src, 1920) : null);
    let zoomed = $derived(zoom.scale > 1);
    let dismissProgress = $derived(Math.min(Math.max(drag.y, 0) / (DISMISS_PX * 3), 1));

    function source(index = lightbox.index) {
        const element = lightbox.sources[index];
        return element?.isConnected ? element : null;
    }

    function isOnScreen(element: Element) {
        const rect = element.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < innerHeight && rect.width > 0;
    }

    /** Transform that makes the viewer's picture sit exactly over `from` (both boxes hug the same picture). */
    function transformFrom(from: DOMRect, to: DOMRect) {
        const scale = from.width / to.width;
        const dx = from.left + from.width / 2 - (to.left + to.width / 2);
        const dy = from.top + from.height / 2 - (to.top + to.height / 2);
        return `translate(${dx}px, ${dy}px) scale(${scale})`;
    }

    /**
     * How the viewer's picture (laid out at `to`) matches a thumbnail on the page: scaled to cover the thumbnail's box,
     * then cropped to it with the same rounded corners, so a cropped thumbnail (an infobox montage, a grid) lines up
     * exactly instead of only by its width.
     */
    function thumbnailPose(thumbnail: HTMLElement, to: DOMRect) {
        const from = thumbnail.getBoundingClientRect();
        const scale = Math.max(from.width / to.width, from.height / to.height);
        const insetX = Math.max(0, (to.width - from.width / scale) / 2);
        const insetY = Math.max(0, (to.height - from.height / scale) / 2);
        const radius = Number.parseFloat(getComputedStyle(thumbnail).borderTopLeftRadius) || 0;
        const dx = from.left + from.width / 2 - (to.left + to.width / 2);
        const dy = from.top + from.height / 2 - (to.top + to.height / 2);
        return {
            transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
            clip: `inset(${insetY}px ${insetX}px round ${radius / scale}px)`,
        };
    }

    /** Stops any open or close animation still running, so a new one never fights it. */
    function settle() {
        for (const element of [frame, crop]) element?.getAnimations().forEach((animation) => animation.cancel());
    }

    // The page behind stays put without locking its scrolling (overflow: hidden on the root, which in Safari lays out
    // the whole article again, a visible stall on opening): the viewer covers the screen and takes the wheel and touch
    // gestures itself (captureWheel, touch-action), and these keys would otherwise scroll the page underneath.
    const PAGE_SCROLL_KEYS = new Set([" ", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"]);

    // ---------- zoom and pan ----------

    /** The picture's untransformed centre and size (the stage is laid out in the fixed, full-viewport lightbox). */
    function layoutBox() {
        if (!stage) return { cx: innerWidth / 2, cy: innerHeight / 2, width: 1, height: 1 };
        const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = stage;
        return { cx: offsetLeft + offsetWidth / 2, cy: offsetTop + offsetHeight / 2, width: offsetWidth, height: offsetHeight };
    }

    /**
     * Keeps a zoomed picture covering the viewport where it's big enough to (no panning past its edges), and on
     * screen where it isn't.
     */
    function clampPan(scale: number, x: number, y: number): Zoom {
        const box = layoutBox();
        const axis = (offset: number, centre: number, size: number, viewport: number) => {
            const half = (size * scale) / 2;
            const nearEdge = half - centre;
            const farEdge = viewport - centre - half;
            return Math.min(Math.max(offset, Math.min(nearEdge, farEdge)), Math.max(nearEdge, farEdge));
        };
        return { scale, x: axis(x, box.cx, box.width, innerWidth), y: axis(y, box.cy, box.height, innerHeight) };
    }

    /** Zooms to `scale`, keeping the spot under `anchor` where it was (or moving it to `to`, for pinches). */
    function zoomAround(from: Zoom, scale: number, anchor: Point, to: Point = anchor): Zoom {
        const next = Math.min(Math.max(scale, 1), MAX_ZOOM);
        if (next === 1) return UNZOOMED;
        const box = layoutBox();
        const localX = (anchor.x - box.cx - from.x) / from.scale;
        const localY = (anchor.y - box.cy - from.y) / from.scale;
        return clampPan(next, to.x - box.cx - localX * next, to.y - box.cy - localY * next);
    }

    /** Actual size of the sharpest copy loaded, but always at least 2× so small images still zoom usefully. */
    function fullZoom() {
        const natural = (hiResLoaded ? hiResImage : baseImage)?.naturalWidth ?? 0;
        return Math.min(MAX_ZOOM, Math.max(2, natural / layoutBox().width));
    }

    const viewportCentre = (): Point => ({ x: innerWidth / 2, y: innerHeight / 2 });

    function toggleZoom(at: Point = viewportCentre()) {
        zoom = zoomed ? UNZOOMED : zoomAround(zoom, fullZoom(), at);
    }

    function zoomBy(factor: number) {
        zoom = zoomAround(zoom, zoom.scale * factor, viewportCentre());
    }

    function pan(dx: number, dy: number) {
        zoom = clampPan(zoom.scale, zoom.x + dx, zoom.y + dy);
    }

    // ---------- opening, closing and stepping ----------

    // Opening: zoom out of the thumbnail the reader clicked.
    $effect(() => {
        if (!lightbox.open) return;

        returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        closing = false;
        zoomingBack = false;
        zoom = UNZOOMED;
        drag = { x: 0, y: 0 };
        gesturing = false;
        pointers.clear();
        gesture = null;

        tick().then(() => {
            if (lightbox.keyboard) closeButton?.focus({ preventScroll: true });
            const from = source();
            if (!frame || !crop) return;
            // nothing on screen to fly out of (opened from the keyboard far away, or a thumbnail scrolled off): it pops in
            if (!from || !isOnScreen(from)) {
                frame.animate(
                    [{ opacity: 0, transform: "scale(0.96)", filter: `blur(${BLUR_PX}px)` }, { opacity: 1, transform: "none", filter: "none" }],
                    { duration: motion(DURATION.base), easing: EASE_OUT },
                );
                return;
            }
            const pose = thumbnailPose(from, frame.getBoundingClientRect());
            const timing = { duration: motion(OPEN_MS), easing: SNAP };
            frame.animate([{ transform: pose.transform, boxShadow: NO_SHADOW }, { transform: "none", boxShadow: FRAME_SHADOW }], timing);
            crop.animate([{ clipPath: pose.clip }, { clipPath: FRAME_CLIP }], timing);
        });

    });

    // The thumbnail on show is hidden while the viewer has it, so it never appears twice: not while the picture flies
    // out of it or back into it, nor through the backdrop.
    $effect(() => {
        if (!lightbox.open) return;
        const thumbnail = source();
        if (!thumbnail) return;
        thumbnail.style.visibility = "hidden";
        return () => thumbnail.style.removeProperty("visibility");
    });

    $effect(() => {
        void image;
        hiResLoaded = false;
    });

    // The neighbours are a likely next step; start fetching them so stepping doesn't wait on the network.
    $effect(() => {
        if (!lightbox.open || count < 2) return;
        for (const offset of [1, -1]) {
            const neighbour = lightbox.images[(lightbox.index + offset + count) % count];
            if (neighbour) new Image().src = neighbour.src;
        }
    });

    // Who made the picture and under which license, from its Commons page.
    $effect(() => {
        const fileName = image?.fileName;
        credit = null;
        if (!lightbox.open || !fileName) return;

        let current = true;
        loadCredit(fileName).then((result) => current && (credit = result));
        return () => (current = false);
    });

    // Closing: shrink back into the current image's thumbnail (or just fade if it's gone or off-screen).
    async function close() {
        if (closing) return;
        closing = true;

        const to = source();
        if (frame && crop && to && isOnScreen(to)) {
            zoomingBack = true;
            // Start from wherever the picture is now (zoomed, panned, mid-drag or still opening), with the stage
            // snapped back beneath.
            const visual = frame.getBoundingClientRect();
            settle();
            gesturing = true;
            zoom = UNZOOMED;
            drag = { x: 0, y: 0 };
            await tick();
            const layout = frame.getBoundingClientRect();
            const pose = thumbnailPose(to, layout);

            const timing = { duration: motion(CLOSE_MS), easing: SNAP, fill: "forwards" } as const;
            const animation = frame.animate(
                [
                    { transform: transformFrom(visual, layout), boxShadow: FRAME_SHADOW },
                    { transform: pose.transform, boxShadow: NO_SHADOW },
                ],
                timing,
            );
            crop.animate([{ clipPath: FRAME_CLIP }, { clipPath: pose.clip }], timing);
            await animation.finished.catch(() => {});
        }

        // hand focus back only if it was in play: opened from the keyboard, or tabbed into the viewer since
        const focusWasInside = document.activeElement?.closest(".lightbox") != null;
        closeLightbox();
        zoomingBack = false;
        if (lightbox.keyboard || focusWasInside) returnFocusTo?.focus({ preventScroll: true });
    }

    function step(delta: number) {
        if (count < 2) return;
        zoom = UNZOOMED;
        lightbox.index = (lightbox.index + delta + count) % count;
        tick().then(() =>
            frame?.animate([{ opacity: 0, transform: `translateX(${delta * 24}px)`, filter: `blur(${BLUR_PX}px)` }, { opacity: 1, transform: "none", filter: "none" }], {
                duration: motion(DURATION.base),
                easing: EASE_OUT,
            }),
        );
    }

    // ---------- input ----------

    function handleKeydown(event: KeyboardEvent) {
        if (!lightbox.open) return;
        const arrows: Record<string, Point> = {
            ArrowLeft: { x: 1, y: 0 },
            ArrowRight: { x: -1, y: 0 },
            ArrowUp: { x: 0, y: 1 },
            ArrowDown: { x: 0, y: -1 },
        };

        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
        } else if (event.key in arrows && zoomed) {
            // zoomed in, the arrows look around the picture
            event.preventDefault();
            pan(arrows[event.key].x * KEY_PAN_PX, arrows[event.key].y * KEY_PAN_PX);
        } else if (event.key === "ArrowRight") {
            step(1);
        } else if (event.key === "ArrowLeft") {
            step(-1);
        } else if (event.key === "+" || event.key === "=") {
            zoomBy(KEY_ZOOM_STEP);
        } else if (event.key === "-") {
            zoomBy(1 / KEY_ZOOM_STEP);
        } else if (event.key === "0") {
            zoom = UNZOOMED;
        } else if (PAGE_SCROLL_KEYS.has(event.key) && !(event.target as Element).closest?.("button, a, input")) {
            event.preventDefault();
        } else if (event.key === "Tab") {
            // keep focus inside the viewer
            const focusable = [...document.querySelectorAll<HTMLElement>(".lightbox button, .lightbox a[href]")];
            const index = focusable.indexOf(document.activeElement as HTMLElement);
            const next = focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length];
            event.preventDefault();
            next?.focus();
        }
    }

    const toPoint = (event: PointerEvent | MouseEvent): Point => ({ x: event.clientX, y: event.clientY });
    const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
    const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    /** (Re)starts a gesture from the pointers currently down, so adding or lifting a finger never makes it jump. */
    function beginGesture() {
        gesture = { start: [...pointers.values()], from: zoom, axis: gesture?.axis ?? null };
    }

    function handlePointerDown(event: PointerEvent) {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if ((event.target as Element).closest("button, a, figcaption")) return;
        if (pointers.size === 0) moved = false;
        pointers.set(event.pointerId, toPoint(event));
        // a second finger turns a swipe into a pinch
        if (pointers.size > 1) drag = { x: 0, y: 0 };
        beginGesture();
    }

    function handlePointerMove(event: PointerEvent) {
        if (!gesture || !pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, toPoint(event));
        const points = [...pointers.values()];
        const { start, from } = gesture;

        // Pinch: scale by the change in finger spread, around (and following) the point between them.
        if (points.length >= 2 && start.length >= 2) {
            moved = gesturing = true;
            const spread = distance(points[0], points[1]) / (distance(start[0], start[1]) || 1);
            zoom = zoomAround(from, from.scale * spread, midpoint(start[0], start[1]), midpoint(points[0], points[1]));
            return;
        }

        const dx = points[0].x - start[0].x;
        const dy = points[0].y - start[0].y;
        if (!moved && Math.hypot(dx, dy) < DRAG_SLOP_PX) return;
        moved = gesturing = true;

        if (from.scale > 1) {
            zoom = clampPan(from.scale, from.x + dx, from.y + dy);
            return;
        }

        // Unzoomed, the picture follows the drag: sideways to step through images, down to let go. Other directions
        // (and sideways with nothing to step to) resist.
        gesture.axis ??= Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        drag =
            gesture.axis === "x"
                ? { x: count > 1 ? dx : dx * 0.25, y: 0 }
                : { x: 0, y: dy > 0 ? dy : dy * 0.25 };
    }

    function handlePointerUp(event: PointerEvent) {
        if (!pointers.delete(event.pointerId)) return;
        if (pointers.size > 0) return beginGesture();

        const axis = gesture?.axis;
        gesture = null;

        if (axis === "x" && count > 1 && Math.abs(drag.x) > SWIPE_PX) {
            // Snap the stage back without easing; the next image slides in from the side the drag came from.
            const delta = drag.x < 0 ? 1 : -1;
            drag = { x: 0, y: 0 };
            step(delta);
            requestAnimationFrame(() => (gesturing = false));
        } else if (axis === "y" && drag.y > DISMISS_PX) {
            close();
        } else {
            gesturing = false;
            drag = { x: 0, y: 0 };
        }
    }

    let captionMore = $state(false);

    /** Fade the caption's bottom edge while there's more of it to scroll to. */
    function updateCaptionFade(caption: HTMLElement) {
        captionMore = caption.scrollHeight - caption.scrollTop - caption.clientHeight > 2;
    }

    function captionOverflow(caption: HTMLElement) {
        const update = () => updateCaptionFade(caption);
        const observer = new ResizeObserver(update);
        observer.observe(caption);
        caption.addEventListener("scroll", update, { passive: true });
        update();
        return {
            destroy: () => {
                observer.disconnect();
                caption.removeEventListener("scroll", update);
            },
        };
    }

    function handleWheel(event: WheelEvent) {
        // a long caption scrolls on its own; only pinch / ctrl+wheel there still zooms the picture
        const caption = (event.target as Element).closest?.("figcaption");
        if (caption && !event.ctrlKey && !event.metaKey && caption.scrollHeight > caption.clientHeight + 1) return;

        event.preventDefault();
        gesturing = true;
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => (gesturing = false), 150);

        if (event.ctrlKey || event.metaKey) {
            // trackpad pinches arrive as ctrl+wheel; mouse wheels with ctrl/⌘ held zoom the same way
            const delta = Math.min(Math.max(event.deltaY, -50), 50);
            zoom = zoomAround(zoom, zoom.scale * Math.exp(-delta * 0.01), toPoint(event));
        } else if (zoomed) {
            pan(-event.deltaX, -event.deltaY);
        }
    }

    /** Wheel events need a non-passive listener to stop the browser zooming the page instead. */
    function captureWheel(node: HTMLElement) {
        node.addEventListener("wheel", handleWheel, { passive: false });
        return { destroy: () => node.removeEventListener("wheel", handleWheel) };
    }

    // Clicking the picture zooms in and out; clicking the backdrop closes. Controls and caption links do their own thing.
    function handleClick(event: MouseEvent) {
        if (moved) {
            moved = false;
            return;
        }
        const target = event.target as Element;
        if (target.closest("button, a, figcaption")) return;
        if (target.closest(".frame")) toggleZoom(toPoint(event));
        else close();
    }
</script>

<svelte:window
    onkeydown={handleKeydown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    onresize={() => (zoom = UNZOOMED)}
/>

{#if lightbox.open && image}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape, arrow and zoom keys are handled on the window) -->
    <div
        class="lightbox"
        class:zoomed
        class:gesturing
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-label={image.alt || "Image viewer"}
        onclick={handleClick}
        onpointerdown={handlePointerDown}
        use:captureWheel
        style:--close-ms="{motion(CLOSE_MS)}ms"
        style:--dismiss={dismissProgress}
        out:fade={{ duration: zoomingBack ? 0 : motion(DURATION.fast) }}
    >
        <div class="backdrop" class:closing aria-hidden="true"></div>
        <figure style:--ar={aspect}>
            <div
                class="stage"
                bind:this={stage}
                style:transform="translate({zoom.x + drag.x}px, {zoom.y + drag.y}px) scale({zoom.scale})"
            >
                <div class="frame" bind:this={frame} style:--ar={aspect}>
                    <!-- cropped to a thumbnail's shape while the picture flies to and from it -->
                    <div class="crop" bind:this={crop}>
                        <img
                            class="base"
                            src={image.src}
                            alt={image.alt}
                            draggable="false"
                            class:invert-dark={image.invertInDarkMode}
                            class:light-backing={image.lightBacking}
                            bind:this={baseImage}
                        />
                        {#if hiResSrc}
                            <img
                                class="hi-res"
                                class:loaded={hiResLoaded}
                                src={hiResSrc}
                                alt=""
                                aria-hidden="true"
                                draggable="false"
                                class:invert-dark={image.invertInDarkMode}
                                bind:this={hiResImage}
                                onload={() => (hiResLoaded = true)}
                            />
                        {/if}
                    </div>
                </div>
            </div>
            {#if image.caption || image.fileName}
                <figcaption class:closing class:hidden={zoomed} class:more={captionMore} use:captionOverflow>
                    {#if image.caption}{@html image.caption}{/if}
                    {#if image.fileName}
                        <span class="credit">
                            <!-- separators are their own elements: inside a link they'd be underlined and clickable -->
                            {#if credit?.artist}
                                <span class="artist" title={credit.artist}>{credit.artist}</span>
                                <span class="sep" aria-hidden="true">·</span>
                            {/if}
                            {#if credit?.license}
                                {#if credit.licenseUrl}
                                    <a class="license" href={credit.licenseUrl} target="_blank" rel="noopener noreferrer"
                                        >{credit.license}</a
                                    >
                                {:else}
                                    <span class="license">{credit.license}</span>
                                {/if}
                                <span class="sep" aria-hidden="true">·</span>
                            {/if}
                            <a href={getFilePath(image.fileName)} onclick={() => closeLightbox()}>File details</a>
                        </span>
                    {/if}
                </figcaption>
            {/if}
        </figure>

        <button type="button" class="control close" aria-label="Close image" bind:this={closeButton} onmousedown={preventMouseFocus} onclick={close}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
        </button>
        <button
            type="button"
            class="control zoom"
            aria-label={zoomed ? "Zoom out" : "Zoom in"}
            aria-keyshortcuts="+ -"
            onmousedown={preventMouseFocus}
            onclick={() => toggleZoom()}
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" stroke-width="2" />
                <path d="m15 15 5 5M8 10.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path class="plus" d="M10.5 8v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
        </button>
        {#if count > 1}
            <button type="button" class="control prev" aria-label="Previous image" onmousedown={preventMouseFocus} onclick={() => step(-1)}>
                <span class="chevron"><ChevronIcon size={22} /></span>
            </button>
            <button type="button" class="control next" aria-label="Next image" onmousedown={preventMouseFocus} onclick={() => step(1)}>
                <span class="chevron"><ChevronIcon size={22} /></span>
            </button>
        {/if}
    </div>
{/if}

<style>
    .lightbox {
        position: fixed;
        inset: 0;
        z-index: 40;
        display: grid;
        place-items: center;
        padding: 4.5rem 1rem 1.5rem;
        cursor: zoom-out;
        /* every gesture (swipe, pinch, drag to dismiss) is handled here */
        touch-action: none;
        user-select: none;
    }

    .backdrop {
        position: absolute;
        inset: 0;
        z-index: -1;
        background: color-mix(in oklch, var(--page-bg) 72%, rgb(0 0 0 / 55%));
        backdrop-filter: blur(14px) saturate(1.1);
        /* fades as the picture is dragged away */
        opacity: calc(1 - var(--dismiss) * 0.8);
        transition: opacity var(--close-ms) ease-out;

        &.closing {
            opacity: 0;
        }
    }

    /* Opening, everything but the picture fades in around it (the picture itself flies out of its thumbnail fully
       opaque, or pops in); closing, the same fades out while it drops back into place. */
    .backdrop,
    .control,
    figcaption {
        animation: lightbox-surroundings-in var(--dur-base) var(--ease-out) backwards;
    }

    @keyframes lightbox-surroundings-in {
        from {
            opacity: 0;
        }
    }

    .lightbox:has(.backdrop.closing) .control {
        opacity: 0;
        transition: opacity var(--close-ms) ease-out;
    }

    .control,
    figcaption {
        opacity: calc(1 - var(--dismiss));
    }

    /* the picture follows fingers and the wheel directly (the backdrop too, until it fades out on close) */
    .lightbox.gesturing {
        .stage,
        .backdrop:not(.closing) {
            transition: none;
        }
    }

    figure {
        display: grid;
        justify-items: center;
        gap: 1rem;
        margin: 0;
        max-width: 100%;
    }

    /* zoom, pan and drag; the frame inside does the open/close/step animations */
    .stage {
        position: relative;
        /* a zoomed picture covers the caption */
        z-index: 1;
        transition: transform var(--dur-base) var(--ease-out);
    }

    .frame {
        position: relative;
        overflow: hidden;
        border-radius: 8px;
        box-shadow: 0 30px 80px -20px rgb(0 0 0 / 45%);
        /* largest size that fits the viewport while keeping the picture's shape */
        width: min(92vw, 1400px, calc((100dvh - 11rem) * var(--ar, 1.5)));
        aspect-ratio: var(--ar, auto);
        cursor: zoom-in;

        .crop {
            position: relative;
            width: 100%;
            height: 100%;
        }

        img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .hi-res {
            position: absolute;
            inset: 0;
            opacity: 0;
            transition: opacity var(--dur-base) ease;

            &.loaded {
                opacity: 1;
            }
        }
    }

    .lightbox.zoomed .frame {
        cursor: grab;
    }

    .lightbox.zoomed.gesturing .frame {
        cursor: grabbing;
    }

    figcaption {
        max-width: 60ch;
        /*
         * Long captions (e.g. a map's full key) scroll instead of running off the screen. They get whatever height is
         * left under the picture (viewport − padding 6rem − gap 1rem − picture), between 3rem and 9rem.
         */
        --picture-height: min(calc(92vw / var(--ar, 1.5)), calc(1400px / var(--ar, 1.5)), calc(100dvh - 11rem));
        max-height: clamp(3rem, calc(100dvh - 7rem - var(--picture-height)), 9rem);
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        font-size: 0.85rem;
        line-height: 1.5;
        text-align: center;
        text-wrap: pretty;
        color: color-mix(in oklch, var(--text-color) 85%, transparent);
        cursor: auto;
        user-select: text;
        transition: opacity var(--dur-fast);

        &.more {
            mask-image: linear-gradient(to bottom, black calc(100% - 1.75rem), transparent);
        }

        &.hidden {
            opacity: 0;
            pointer-events: none;
        }

        &.closing {
            opacity: 0;
            transition-duration: var(--close-ms);
        }
    }

    /* citations look as they do in the article: small, muted, no brackets */
    figcaption :global(sup.reference) {
        font-size: 0.7em;
        line-height: 0;
    }

    figcaption :global(sup.reference .cite-bracket) {
        display: none;
    }

    figcaption :global(sup.reference a) {
        color: var(--muted);
        font-weight: 600;
        text-decoration: none;
    }

    /* lists in captions: centred as one block, text left-aligned beside its numbers (as in the article) */
    figcaption :global(:is(ul, ol)) {
        margin: 0.3em 0 0;
        padding-left: 1.5em;
        text-align: left;
    }

    figcaption :global(:is(ul, ol):not(li *)) {
        display: table;
        margin-inline: auto !important;
    }

    figcaption :global(li) {
        margin: 0.1em 0 0;
        padding-left: 0.15em;
    }

    figcaption :global(li :is(ul, ol)) {
        margin-top: 0.1em;
        padding-left: 1.3em;
    }


    .credit {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        margin-top: 0.4rem;
        font-size: 0.75rem;
        color: var(--muted);

        .sep {
            margin: 0 0.5em;
        }

        a {
            color: inherit;
            text-decoration-color: color-mix(in oklch, currentColor 35%, transparent);
            text-underline-offset: 0.18em;
        }

        /* arrives after the caption; eases in rather than popping */
        .artist,
        .license,
        .sep {
            animation: fade-in var(--dur-base) var(--ease-out) backwards;
        }

        .artist {
            max-width: 28ch;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    .control {
        position: fixed;
        z-index: 2;
        display: grid;
        place-items: center;
        width: 2.75rem;
        height: 2.75rem;
        padding: 0;
        border: 1px solid color-mix(in oklch, var(--secondary) 70%, transparent);
        border-radius: 50%;
        background: color-mix(in oklch, var(--bg-color) 80%, transparent);
        backdrop-filter: blur(8px);
        color: var(--text-color);
        cursor: pointer;
        transition:
            background-color var(--dur-fast),
            border-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &:hover {
            background: var(--bg-color);
            border-color: var(--secondary);
        }
    }

    .close {
        top: 1rem;
        right: 1rem;
    }

    .zoom {
        top: 1rem;
        right: 4.25rem;

        /* the plus folds into a minus once zoomed */
        .plus {
            transform-box: fill-box;
            transform-origin: center;
            transition: scale var(--dur-fast) var(--ease-out);
        }
    }

    .lightbox.zoomed .zoom .plus {
        scale: 1 0;
    }

    .prev,
    .next {
        top: 50%;
        translate: 0 -50%;
    }

    .prev {
        left: 1rem;
    }

    .next {
        right: 1rem;
    }

    /* the chevron points down; turn it to point sideways */
    .prev .chevron {
        rotate: 90deg;
    }

    .next .chevron {
        rotate: -90deg;
    }

    .chevron {
        display: grid;
    }

    :global([data-scheme="dark"]) img.invert-dark {
        filter: invert(1) hue-rotate(180deg);
    }

    @media (max-width: 640px) {
        .prev,
        .next {
            top: auto;
            bottom: 1rem;
            translate: none;
        }
    }
</style>
