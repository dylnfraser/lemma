<script lang="ts">
    import { tick } from "svelte";
    import { fade } from "svelte/transition";
    import { resizeWikimediaThumb } from "$lib/article/articleUtils";
    import { preventMouseFocus } from "$lib/focus";
    import { closeLightbox, lightbox } from "$lib/lightbox.svelte";
    import { DURATION, EASE_OUT, motion } from "$lib/motion";
    import ChevronIcon from "../icons/ChevronIcon.svelte";

    const OPEN_MS = 300;
    const CLOSE_MS = 230;
    // quick start, soft landing: feels snappier than a plain ease-out at the same duration
    const SNAP = "cubic-bezier(0.2, 0.9, 0.1, 1)";
    const SWIPE_PX = 50;

    let frame = $state<HTMLElement>();
    let closeButton = $state<HTMLButtonElement>();
    let closing = $state(false);
    // true while the picture zooms back into its thumbnail; the backdrop fades out in step with it
    let zoomingBack = $state(false);
    let hiResLoaded = $state(false);
    let returnFocusTo: HTMLElement | null = null;
    let swipeStartX: number | null = null;

    let image = $derived(lightbox.images[lightbox.index]);
    let count = $derived(lightbox.images.length);
    let aspect = $derived(image?.width && image?.height ? image.width / image.height : null);
    // Article images come at 960px; the viewer asks Wikimedia for a sharper copy and swaps it in once loaded.
    let hiResSrc = $derived(image && /\/960px-/.test(image.src) ? resizeWikimediaThumb(image.src, 1920) : null);

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

    function lockScroll(locked: boolean) {
        const root = document.documentElement;
        if (locked) {
            // keep the page from shifting when the scrollbar disappears
            root.style.paddingRight = `${innerWidth - root.clientWidth}px`;
            root.style.overflow = "hidden";
        } else {
            root.style.overflow = "";
            root.style.paddingRight = "";
        }
    }

    // Opening: zoom out of the thumbnail the reader clicked.
    $effect(() => {
        if (!lightbox.open) return;

        returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        closing = false;
        zoomingBack = false;
        lockScroll(true);

        tick().then(() => {
            if (lightbox.keyboard) closeButton?.focus({ preventScroll: true });
            const from = source();
            if (!frame || !from || !isOnScreen(from)) return;
            frame.animate(
                [
                    { transform: transformFrom(from.getBoundingClientRect(), frame.getBoundingClientRect()), borderRadius: "12px" },
                    { transform: "none", borderRadius: "8px" },
                ],
                { duration: motion(OPEN_MS), easing: SNAP },
            );
        });

        return () => lockScroll(false);
    });

    $effect(() => {
        void image;
        hiResLoaded = false;
    });

    // Closing: shrink back into the current image's thumbnail (or just fade if it's gone or off-screen).
    async function close() {
        if (closing) return;
        closing = true;

        const to = source();
        if (frame && to && isOnScreen(to)) {
            zoomingBack = true;
            const animation = frame.animate(
                [
                    { transform: "none", borderRadius: "8px" },
                    { transform: transformFrom(to.getBoundingClientRect(), frame.getBoundingClientRect()), borderRadius: "12px" },
                ],
                { duration: motion(CLOSE_MS), easing: SNAP, fill: "forwards" },
            );
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
        const next = (lightbox.index + delta + count) % count;
        lightbox.index = next;
        tick().then(() =>
            frame?.animate([{ opacity: 0, transform: `translateX(${delta * 24}px)` }, { opacity: 1, transform: "none" }], {
                duration: motion(DURATION.base),
                easing: EASE_OUT,
            }),
        );
    }

    function handleKeydown(event: KeyboardEvent) {
        if (!lightbox.open) return;
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
        } else if (event.key === "ArrowRight") {
            step(1);
        } else if (event.key === "ArrowLeft") {
            step(-1);
        } else if (event.key === "Tab") {
            // keep focus inside the viewer
            const focusable = [...document.querySelectorAll<HTMLElement>(".lightbox button")];
            const index = focusable.indexOf(document.activeElement as HTMLElement);
            const next = focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length];
            event.preventDefault();
            next?.focus();
        }
    }

    function handlePointerDown(event: PointerEvent) {
        swipeStartX = event.clientX;
    }

    function handlePointerUp(event: PointerEvent) {
        if (swipeStartX === null) return;
        const dx = event.clientX - swipeStartX;
        swipeStartX = null;
        if (Math.abs(dx) > SWIPE_PX) step(dx < 0 ? 1 : -1);
    }

    // Clicking the backdrop or the picture closes; controls and caption links don't.
    function handleClick(event: MouseEvent) {
        if ((event.target as Element).closest("button, a, figcaption")) return;
        close();
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if lightbox.open && image}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape and arrow keys are handled on the window) -->
    <div
        class="lightbox"
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-label={image.alt || "Image viewer"}
        onclick={handleClick}
        onpointerdown={handlePointerDown}
        onpointerup={handlePointerUp}
        style:--close-ms="{motion(CLOSE_MS)}ms"
        transition:fade={{ duration: zoomingBack ? 0 : motion(closing ? DURATION.fast : DURATION.base) }}
    >
        <div class="backdrop" class:closing aria-hidden="true"></div>
        <figure>
            <div class="frame" bind:this={frame} style:--ar={aspect}>
                <img class="base" src={image.src} alt={image.alt} class:invert-dark={image.invertInDarkMode} />
                {#if hiResSrc}
                    <img
                        class="hi-res"
                        class:loaded={hiResLoaded}
                        src={hiResSrc}
                        alt=""
                        aria-hidden="true"
                        class:invert-dark={image.invertInDarkMode}
                        onload={() => (hiResLoaded = true)}
                    />
                {/if}
            </div>
            {#if image.caption || count > 1}
                <figcaption class:closing>
                    {#if count > 1}<span class="counter">{lightbox.index + 1} / {count}</span>{/if}
                    {#if image.caption}{@html image.caption}{/if}
                </figcaption>
            {/if}
        </figure>

        <button type="button" class="control close" aria-label="Close image" bind:this={closeButton} onmousedown={preventMouseFocus} onclick={close}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
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
        touch-action: pan-y;
    }

    .backdrop {
        position: absolute;
        inset: 0;
        z-index: -1;
        background: color-mix(in oklch, var(--page-bg) 72%, rgb(0 0 0 / 55%));
        backdrop-filter: blur(14px) saturate(1.1);
        transition: opacity var(--close-ms) ease-out;

        &.closing {
            opacity: 0;
        }
    }

    /* everything but the picture fades with the backdrop while it drops back into place */
    .lightbox:has(.backdrop.closing) .control {
        opacity: 0;
        transition: opacity var(--close-ms) ease-out;
    }

    figure {
        display: grid;
        justify-items: center;
        gap: 1rem;
        margin: 0;
        max-width: 100%;
    }

    .frame {
        position: relative;
        overflow: hidden;
        border-radius: 8px;
        box-shadow: 0 30px 80px -20px rgb(0 0 0 / 45%);
        /* largest size that fits the viewport while keeping the picture's shape */
        width: min(92vw, 1400px, calc((100dvh - 11rem) * var(--ar, 1.5)));
        aspect-ratio: var(--ar, auto);
        will-change: transform;

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

    figcaption {
        max-width: 60ch;
        font-size: 0.85rem;
        line-height: 1.5;
        text-align: center;
        text-wrap: pretty;
        color: color-mix(in oklch, var(--text-color) 85%, transparent);
        cursor: auto;
        transition: opacity var(--dur-fast);

        &.closing {
            opacity: 0;
            transition-duration: var(--close-ms);
        }
    }

    .counter {
        display: inline-block;
        margin-right: 0.6rem;
        padding: 0.05rem 0.5rem;
        border-radius: 999px;
        background: color-mix(in oklch, var(--secondary) 50%, transparent);
        font-size: 0.75rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }

    .control {
        position: fixed;
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

    @media (prefers-color-scheme: dark) {
        img.invert-dark {
            filter: invert(1) hue-rotate(180deg);
        }
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
