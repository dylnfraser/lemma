<script lang="ts">
    import { tick } from "svelte";
    import { prefersReducedMotion } from "svelte/motion";
    import type { ArticleImage } from "$lib/article/types";
    import { isKeyboardClick, preventMouseFocus } from "$lib/focus";
    import { lightbox, openLightbox } from "$lib/lightbox.svelte";
    import { BLUR_PX, DURATION, EASE_OUT, motion } from "$lib/motion";
    import { overlayScrollbar } from "$lib/overlayScrollbar";
    import { searchOverlay } from "$lib/search/searchOverlay.svelte";

    interface Props {
        images: ArticleImage[];
        /** A caption for the whole set ({{multiple image}}), shown instead of the front image's own caption. */
        caption?: string;
    }

    let { images, caption = "" }: Props = $props();

    // Cards beyond this are hidden behind the stack (expanding shows them all).
    const MAX_FANNED = 4;
    const uid = $props.id();

    // A calm ease-out: the photos glide into place without overshooting, close together rather than one by one.
    const EASING = EASE_OUT;
    const DURATION_MS = 340;
    const STAGGER_MS = 14;
    // The surrounding text glides with the height change, without overshoot.
    const HEIGHT_EASING = "cubic-bezier(0.25, 1, 0.5, 1)";
    // Final clip extends past the image so its drop shadow is never cut off when the clip is removed.
    const OPEN_CLIP = "inset(-48px -48px round 60px)";

    let expanded = $state(false);
    // Move focus to the stack/grid after toggling only when the reader is using the keyboard.
    let focusAfterToggle = false;
    let fanned = $derived(images.slice(0, MAX_FANNED));
    // Larger sets open into a row to scroll through rather than a tall grid.
    const STRIP_FROM = 4;
    let strip = $derived(images.length >= STRIP_FROM);
    let fanButton = $state<HTMLButtonElement>();
    let grid = $state<HTMLElement>();

    type Rect = { cx: number; cy: number; width: number; height: number };

    function centre(rect: DOMRect): Rect {
        return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, width: rect.width, height: rect.height };
    }

    /** Smoothly resize the block between the stack's and the grid's heights so the text below doesn't jump. */
    function animateHeight(element: HTMLElement, fromHeight: number) {
        const toHeight = element.getBoundingClientRect().height;
        element.animate([{ height: `${fromHeight}px` }, { height: `${toHeight}px` }], {
            duration: DURATION_MS,
            easing: HEIGHT_EASING,
        });
    }

    /** Where each card currently appears: its centre, angle and on-screen width (hover spread included). */
    function measureCards() {
        return [...(fanButton?.querySelectorAll<HTMLElement>(".card") ?? [])].map((card) => {
            const matrix = new DOMMatrix(getComputedStyle(card).transform);
            const scale = Math.hypot(matrix.a, matrix.b) || 1;
            // A rotated box's bounding-rect centre is still its true centre.
            return {
                ...centre(card.getBoundingClientRect()),
                width: card.offsetWidth * scale,
                height: card.offsetHeight * scale,
                angle: Math.atan2(matrix.b, matrix.a),
            };
        });
    }

    function fadeIn(elements: Iterable<Element>, delay: number) {
        for (const element of elements) {
            element.animate([{ opacity: 0, transform: "translateY(4px)", filter: `blur(${BLUR_PX}px)` }, { opacity: 1, transform: "none", filter: "none" }], {
                duration: motion(DURATION.base),
                delay,
                easing: EASE_OUT,
                fill: "backwards",
            });
        }
    }

    // How long a click waits for pictures that still aren't ready before animating anyway.
    const DECODE_WAIT_MS = 100;

    /**
     * Downloads and decodes every picture, including those hidden behind the stack, so expanding never waits on the
     * network or stalls mid-flight decoding one. Started ahead of time (see `preloadNearby`); repeat calls reuse it.
     */
    let decoded: Promise<unknown> | null = null;
    function decodeImages() {
        decoded ??= Promise.all(
            images.map((image) => {
                const preload = new Image();
                preload.src = image.src;
                return preload.decode().catch(() => {});
            }),
        );
        return decoded;
    }

    /** Starts decoding the pictures once the stack comes near the screen. */
    function preloadNearby(node: HTMLElement) {
        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                decodeImages();
                observer.disconnect();
            },
            { rootMargin: "600px 0px" },
        );
        observer.observe(node);
        return { destroy: () => observer.disconnect() };
    }

    /** FLIP: render the grid, then fly each image out from the card it was shown on. */
    async function expand(event: MouseEvent) {
        if (!prefersReducedMotion.current) {
            await Promise.race([decodeImages(), new Promise((resolve) => setTimeout(resolve, DECODE_WAIT_MS))]);
        }
        const cards = measureCards();
        const stackHeight = fanButton?.parentElement?.getBoundingClientRect().height ?? 0;
        focusAfterToggle = isKeyboardClick(event);
        expanded = true;
        await tick();
        if (prefersReducedMotion.current || !grid || cards.length === 0) return;

        animateHeight(grid, stackHeight);

        grid.querySelectorAll<HTMLElement>("figure img").forEach((image, index) => {
            const target = centre(image.getBoundingClientRect());
            // Images that were hidden behind the stack emerge from the front card.
            const from = cards[index] ?? cards[0];
            // Start scaled to cover the card and clipped to the card's crop, then unclip in flight: a true morph.
            const scale = Math.max(from.width / target.width, from.height / target.height);
            const insetX = (target.width - from.width / scale) / 2;
            const insetY = (target.height - from.height / scale) / 2;

            image.animate(
                [
                    {
                        transform: `translate(${from.cx - target.cx}px, ${from.cy - target.cy}px) rotate(${from.angle}rad) scale(${scale})`,
                        clipPath: `inset(${insetY}px ${insetX}px round ${18 / scale}px)`,
                        opacity: index < cards.length ? 1 : 0,
                    },
                    { transform: "none", clipPath: OPEN_CLIP, opacity: 1 },
                ],
                { duration: DURATION_MS, delay: index * STAGGER_MS, easing: EASING, fill: "backwards" },
            );
        });

        fadeIn(grid.querySelectorAll("figcaption"), DURATION_MS * 0.55);
    }

    // Clicking a photo opens the viewer; clicking anywhere else on the grid stacks it again (caption links still work).
    function handleGridClick(event: MouseEvent) {
        if ((event.target as Element).closest("a, button")) return;
        collapse();
    }

    // While another overlay is up, Escape and outside clicks belong to it.
    const overlayOpen = () => lightbox.open || searchOverlay.open;

    function handleWindowKeydown(event: KeyboardEvent) {
        if (!expanded || event.key !== "Escape" || overlayOpen()) return;
        collapse({ focus: grid?.contains(document.activeElement) ?? false });
    }

    // pointerdown rather than click: the click that expanded the fan must not count as an outside click.
    function handleWindowPointerDown(event: PointerEvent) {
        if (!expanded || !grid || overlayOpen()) return;
        const target = event.target as Element;
        if (grid.contains(target) || target.closest('[role="dialog"]')) return;
        collapse();
    }

    function openViewer(index: number, event: MouseEvent) {
        const sources = [...(grid?.querySelectorAll<HTMLElement>("figure img") ?? [])];
        openLightbox(images, index, sources, isKeyboardClick(event));
    }

    /** Reverse FLIP: render the stack, then fly each card back from its spot in the grid onto its fanned pose. */
    async function collapse({ focus = false }: { focus?: boolean } = {}) {
        const images = [...(grid?.querySelectorAll<HTMLElement>("figure img") ?? [])].map((image) =>
            centre(image.getBoundingClientRect()),
        );
        const gridHeight = grid?.getBoundingClientRect().height ?? 0;
        focusAfterToggle = focus;
        expanded = false;
        await tick();
        if (prefersReducedMotion.current || !fanButton || images.length === 0) return;

        if (fanButton.parentElement) animateHeight(fanButton.parentElement, gridHeight);

        // Cards are laid out over the button and rotate around 50% 90%, so solve the start transform for that origin.
        const box = fanButton.getBoundingClientRect();
        const base = centre(box);
        const origin = { x: box.left + box.width * 0.5, y: box.top + box.height * 0.9 };

        fanButton.querySelectorAll<HTMLElement>(".card").forEach((card, index) => {
            const from = images[index];
            if (!from) return;
            // Cards show a centre crop of their image, so start each one exactly over that crop of the grid image.
            const scale = Math.min(from.width / card.offsetWidth, from.height / card.offsetHeight);
            const tx = from.cx - origin.x - scale * (base.cx - origin.x);
            const ty = from.cy - origin.y - scale * (base.cy - origin.y);

            card.animate(
                [
                    { transform: `translate(${tx}px, ${ty}px) scale(${scale})`, borderRadius: `${12 / scale}px` },
                    { transform: getComputedStyle(card).transform, borderRadius: "18px" },
                ],
                { duration: DURATION_MS, delay: index * STAGGER_MS, easing: EASING, fill: "backwards" },
            );
        });

        fadeIn(fanButton.parentElement?.querySelectorAll("figcaption") ?? [], DURATION_MS * 0.6);
    }

    // Expanding/collapsing replaces the focused control, so move focus to its counterpart (never on first render).
    function focusWhenToggled(node: HTMLElement) {
        if (focusAfterToggle) node.focus({ preventScroll: true });
    }

    /** Front card sits straight; the rest alternate left and right, each a little further out and more tilted. */
    function cardTransform(index: number) {
        if (index === 0) return { x: 0, y: 0, rotate: 0 };
        const side = index % 2 === 1 ? -1 : 1;
        const step = Math.ceil(index / 2);
        return { x: side * step * 5, y: step * 1.5, rotate: side * (2 + step * 1.5) };
    }
</script>

<svelte:window onkeydown={handleWindowKeydown} onpointerdown={handleWindowPointerDown} />

{#if expanded}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events (Escape anywhere stacks the images again; each photo is its own button) -->
    <div
        class="expanded"
        id="{uid}-grid"
        tabindex="-1"
        aria-label={`${images.length} images. Press Escape to stack them again.`}
        role="group"
        bind:this={grid}
        use:focusWhenToggled
        onclick={handleGridClick}
    >
        <div class="grid" class:strip use:overlayScrollbar={strip}>
            {#each images as image, i}
                <!-- earlier images stay on top while they fly out, matching the stack's order -->
                <figure style:z-index={images.length - i}>
                    <button
                        type="button"
                        class="zoomable"
                        aria-label={image.alt ? `View full screen: ${image.alt}` : `View image ${i + 1} full screen`}
                        onmousedown={preventMouseFocus}
                        onclick={(event) => openViewer(i, event)}
                    >
                        <!-- not lazy: the cards already loaded these, and the animation needs their real size -->
                        <img
                            alt={image.alt}
                            src={image.src}
                            width={image.width}
                            height={image.height}
                            style:--ar={image.width && image.height ? image.width / image.height : undefined}
                            style:--max-w={image.pixelWidth ? `${image.pixelWidth}px` : undefined}
                            class:invert-dark={image.invertInDarkMode}
                            class:light-backing={image.lightBacking}
                            decoding="async"
                        />
                    </button>
                    {#if image.caption}
                        <figcaption>{@html image.caption}</figcaption>
                    {/if}
                </figure>
            {/each}
        </div>
        {#if caption}
            <p class="set-caption">{@html caption}</p>
        {/if}
    </div>
{:else}
    <figure class="fan-figure">
        <button
            type="button"
            class="fan"
            aria-expanded="false"
            aria-label={`Show all ${images.length} images`}
            onmousedown={preventMouseFocus}
            onclick={expand}
            onpointerenter={decodeImages}
            bind:this={fanButton}
            use:focusWhenToggled
            use:preloadNearby
        >
            {#each fanned as image, i}
                {@const t = cardTransform(i)}
                <span
                    class="card"
                    style:--x="{t.x}%"
                    style:--y="{t.y}%"
                    style:--r="{t.rotate}deg"
                    style:z-index={fanned.length - i}
                >
                    <img
                        alt=""
                        src={image.src}
                        class:invert-dark={image.invertInDarkMode}
                        class:light-backing={image.lightBacking}
                        loading="lazy"
                        decoding="async"
                    />
                </span>
            {/each}
        </button>
        {#if caption || images[0].caption}
            <figcaption>{@html caption || images[0].caption}</figcaption>
        {/if}
    </figure>
{/if}

<style>
    /* ---------- stacked fan ---------- */

    .fan-figure {
        margin: 2.5rem 0 2.25rem;
    }

    .fan {
        position: relative;
        display: block;
        width: min(15rem, 62%);
        aspect-ratio: 4 / 5;
        margin: 0 auto;
        padding: 0;
        border: none;
        background: none;
        cursor: zoom-in;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            outline: none;

            .card:first-child {
                outline: 2px solid var(--accent);
                outline-offset: 3px;
            }
        }
    }

    .card {
        position: absolute;
        inset: 0;
        overflow: hidden;
        border-radius: 18px;
        background: var(--bg-color);
        box-shadow:
            0 1px 2px color-mix(in oklch, var(--shadow-color) 60%, transparent),
            0 10px 24px -14px var(--shadow-color);
        transform: translate(var(--x), var(--y)) rotate(var(--r));
        transform-origin: 50% 90%;
        transition: transform var(--dur-slow) var(--ease-out);

        img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }

    /* on hover the stack loosens a touch, like nudging a pile of photos */
    .fan:is(:hover, :focus-visible) .card:not(:first-child) {
        transform: translate(calc(var(--x) * 1.35), calc(var(--y) * 1.2)) rotate(calc(var(--r) * 1.3));
    }

    .fan:is(:hover, :focus-visible) .card:first-child {
        transform: translateY(-1%);
    }


    .fan-figure > figcaption,
    figcaption {
        max-width: 52ch;
        margin: 1.1rem auto 0;
        font-size: 0.8rem;
        line-height: 1.5;
        text-align: center;
        text-wrap: pretty;
        color: var(--muted);
    }

    /* ---------- expanded grid ---------- */

    .expanded {
        /* positions the strip's scrollbar */
        position: relative;
        margin: 2.25rem 0;
        border-radius: 14px;
        cursor: zoom-out;

        &:focus {
            outline: none;
        }


    }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(13rem, 100%), 1fr));
        gap: 1.25rem;
        align-items: start;

        figure {
            position: relative;
            margin: 0;
        }

        /* the box hugs the picture (no object-fit letterboxing), so the rounded corners always land on the photo */
        img {
            display: block;
            width: auto;
            max-width: 100%;
            height: auto;
            max-height: min(28rem, 65dvh);
            margin-inline: auto;
            border-radius: 12px;
            box-shadow: 0 10px 30px -14px var(--shadow-color);
        }

        figcaption {
            margin-top: 0.6rem;
        }
    }

    /* a row of same-height pictures that scrolls sideways, snapping from one to the next */
    .grid.strip {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scroll-snap-type: x mandatory;
        scroll-padding-inline: 1.25rem;
        padding: 0.5rem 1.25rem 1rem;
        margin-inline: -1.25rem;
        /* the row fades out at its edges, hinting that there's more */
        mask-image: linear-gradient(to right, transparent, black 1.25rem, black calc(100% - 1.25rem), transparent);

        figure {
            flex: none;
            display: flex;
            flex-direction: column;
            /* as wide as its picture; the caption wraps to fit under it */
            width: min-content;
            scroll-snap-align: start;
        }

        img {
            width: auto;
            max-width: min(34rem, 80vw);
            height: min(14rem, 40dvh);
            max-height: none;
            object-fit: cover;
        }

        .zoomable {
            margin-inline: 0;
        }
    }

    .zoomable {
        display: block;
        max-width: 100%;
        margin-inline: auto;
        padding: 0;
        border: none;
        border-radius: 12px;
        background: none;
        cursor: zoom-in;
    }

    @media (prefers-color-scheme: dark) {
        img.invert-dark {
            filter: invert(1) hue-rotate(180deg);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .card {
            transition: none;
        }
    }

    /* the caption for the whole set, under the expanded grid */
    .set-caption {
        max-width: 52ch;
        margin: 1rem auto 0;
        font-size: 0.8rem;
        line-height: 1.5;
        text-align: center;
        text-wrap: pretty;
        color: var(--muted);
    }
</style>
