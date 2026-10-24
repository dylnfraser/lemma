<script lang="ts">
    import { onMount } from "svelte";
    import { prefersReducedMotion } from "svelte/motion";

    // Overlay scrollbar for the page itself. The native one is hidden (app.css) because a styled native scrollbar
    // reserves a gutter the fixed navbar can't cover; this one floats over the content instead.
    const MIN_THUMB = 36;
    // how much the thumb shortens per pixel of overscroll, and how short it can get
    const SQUASH = 0.6;
    const MIN_SQUASHED = 12;
    const IDLE_MS = 1200;

    let track = $state<HTMLElement>();
    let thumbSize = $state(0);
    let thumbOffset = $state(0);
    let scrollable = $state(false);
    let active = $state(false);
    let dragging = $state(false);

    let idleTimer: ReturnType<typeof setTimeout>;
    let frame = 0;
    // Fixed for the whole drag: on phones the viewport's height changes as the browser's toolbars slide away, and the
    // thumb shortens at either end, either of which would otherwise shift where the page is under the finger.
    let dragStart: { pointerY: number; scrollY: number; pixelsPerTrackPixel: number } | null = null;
    let dragY = 0;
    let dragFrame = 0;

    const root = () => document.documentElement;
    const scrollRange = () => root().scrollHeight - innerHeight;

    function measure() {
        frame = 0;
        const range = scrollRange();
        // decide this first: the track only renders once the page is scrollable
        scrollable = range > 1;
        if (!scrollable || !track) return;

        const trackHeight = track.clientHeight;
        const size = Math.max(MIN_THUMB, (trackHeight * innerHeight) / root().scrollHeight);
        // Rubber-banding past either end (macOS) reports a scroll position beyond the range: like the system's own
        // scrollbar, the thumb stays pinned to that end and squashes against it, then springs back with the page.
        const overscroll = scrollY < 0 ? -scrollY : Math.max(0, scrollY - range);
        thumbSize = Math.max(MIN_SQUASHED, size - overscroll * SQUASH);
        thumbOffset = scrollY < 0 ? 0 : scrollY > range ? trackHeight - thumbSize : (scrollY / range) * (trackHeight - thumbSize);
    }

    function scheduleMeasure() {
        if (!frame) frame = requestAnimationFrame(measure);
    }

    function wake() {
        active = true;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => (active = false), IDLE_MS);
    }

    function handleScroll() {
        scheduleMeasure();
        wake();
    }

    function startDrag(event: PointerEvent) {
        event.preventDefault();
        event.stopPropagation();
        if (!track) return;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        dragging = true;
        dragY = event.clientY;
        dragStart = {
            pointerY: event.clientY,
            scrollY: Math.min(Math.max(scrollY, 0), scrollRange()),
            pixelsPerTrackPixel: scrollRange() / Math.max(1, track.clientHeight - thumbSize),
        };
    }

    // at most one scroll a frame, to wherever the pointer is by then (touch moves can come several times a frame)
    function drag(event: PointerEvent) {
        if (!dragStart) return;
        dragY = event.clientY;
        dragFrame ||= requestAnimationFrame(() => {
            dragFrame = 0;
            if (!dragStart) return;
            scrollTo({ top: dragStart.scrollY + (dragY - dragStart.pointerY) * dragStart.pixelsPerTrackPixel, behavior: "instant" });
        });
    }

    function endDrag() {
        dragging = false;
        dragStart = null;
        cancelAnimationFrame(dragFrame);
        dragFrame = 0;
        wake();
    }

    // Clicking the track pages toward the click (smoothly, unless the reader prefers reduced motion). Mouse only: on a
    // touch screen the edge of the page is for swiping.
    function pageToward(event: PointerEvent) {
        if (!track || event.pointerType === "touch") return;
        const clickY = event.clientY - track.getBoundingClientRect().top;
        const direction = clickY < thumbOffset ? -1 : 1;
        scrollBy({ top: direction * innerHeight * 0.85, behavior: prefersReducedMotion.current ? "instant" : "smooth" });
    }

    // size the thumb as soon as the track exists
    $effect(() => {
        if (track) measure();
    });

    onMount(() => {
        measure();
        // content height changes constantly (loading, folding sections, the image fan); keep the thumb in proportion
        const observer = new ResizeObserver(scheduleMeasure);
        observer.observe(document.body);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
            cancelAnimationFrame(dragFrame);
            clearTimeout(idleTimer);
        };
    });
</script>

<svelte:window onscroll={handleScroll} onresize={scheduleMeasure} />

{#if scrollable}
    <!-- svelte-ignore a11y_no_static_element_interactions (decorative mouse affordance; keyboard, wheel and touch scrolling stay native) -->
    <div
        class="track"
        class:active={active || dragging}
        class:dragging
        bind:this={track}
        onpointerdown={pageToward}
        aria-hidden="true"
    >
        <!-- svelte-ignore a11y_no_static_element_interactions (see above) -->
        <div
            class="thumb"
            style:height="{thumbSize}px"
            style:transform="translateY({thumbOffset}px)"
            onpointerdown={startDrag}
            onpointermove={drag}
            onpointerup={endDrag}
            onpointercancel={endDrag}
        ></div>
    </div>
{/if}

<style>
    .track {
        position: fixed;
        z-index: 25;
        top: calc(var(--nav-height) + 4px);
        bottom: 4px;
        right: 0;
        width: 14px;
        touch-action: none;
    }

    .thumb {
        position: absolute;
        top: 0;
        right: 3px;
        width: 4px;
        border-radius: 999px;
        background: color-mix(in oklch, var(--text-color) 34%, transparent);
        opacity: 0;
        cursor: grab;
        /* never transition the position: the thumb must follow the scroll exactly */
        transition:
            opacity var(--dur-slow) ease,
            width var(--dur-fast) var(--ease-out),
            background-color var(--dur-fast) ease;
    }

    .track.active .thumb {
        opacity: 1;
        transition-duration: var(--dur-fast), var(--dur-fast), var(--dur-fast);
    }

    /* reaching for the edge reveals and widens it */
    .track:hover .thumb,
    .track.dragging .thumb {
        opacity: 1;
        width: 8px;
        background: color-mix(in oklch, var(--text-color) 48%, transparent);
    }

    .track.dragging .thumb {
        cursor: grabbing;
        background: color-mix(in oklch, var(--accent) 70%, var(--text-color));
    }

    /*
     * Touch: the edge of the page stays the page's, so swipes there scroll it as anywhere else. Only the thumb takes a
     * finger, and only while it's showing (as the page scrolls), through a target much wider than it looks.
     */
    @media (pointer: coarse) {
        .track {
            width: 8px;
            pointer-events: none;
            touch-action: auto;
        }

        .thumb {
            touch-action: none;

            &::before {
                content: "";
                position: absolute;
                inset: -10px -4px -10px -28px;
            }
        }

        .track.active .thumb {
            pointer-events: auto;
        }

        .track.dragging .thumb {
            width: 6px;
        }
    }
</style>
