<script lang="ts">
    import { tick } from "svelte";
    import { prefersReducedMotion } from "svelte/motion";
    import type { ArticleImage } from "$lib/article/types";

    interface Props {
        images: ArticleImage[];
    }

    let { images }: Props = $props();

    // Cards beyond this are hidden behind the stack; the badge still counts them.
    const MAX_FANNED = 4;
    const uid = $props.id();

    // Springy ease-out so cards overshoot a touch as they land, like iMessage's photo stacks.
    const EASING = "cubic-bezier(0.22, 1.2, 0.36, 1)";
    const DURATION_MS = 560;
    const STAGGER_MS = 35;
    // The surrounding text glides with the height change, without overshoot.
    const HEIGHT_EASING = "cubic-bezier(0.25, 1, 0.5, 1)";
    // Final clip extends past the image so its drop shadow is never cut off when the clip is removed.
    const OPEN_CLIP = "inset(-48px -48px round 60px)";

    let expanded = $state(false);
    let toggledByReader = false;
    let fanned = $derived(images.slice(0, MAX_FANNED));
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
            element.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], {
                duration: 280,
                delay,
                easing: "ease-out",
                fill: "backwards",
            });
        }
    }

    /** FLIP: render the grid, then fly each image out from the card it was shown on. */
    async function expand() {
        const cards = measureCards();
        const stackHeight = fanButton?.parentElement?.getBoundingClientRect().height ?? 0;
        toggledByReader = true;
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

        fadeIn(grid.querySelectorAll("figcaption, .collapse"), DURATION_MS * 0.55);
    }

    /** Reverse FLIP: render the stack, then fly each card back from its spot in the grid onto its fanned pose. */
    async function collapse() {
        const images = [...(grid?.querySelectorAll<HTMLElement>("figure img") ?? [])].map((image) =>
            centre(image.getBoundingClientRect()),
        );
        const gridHeight = grid?.getBoundingClientRect().height ?? 0;
        toggledByReader = true;
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

        fadeIn(fanButton.parentElement?.querySelectorAll(".badge, figcaption") ?? [], DURATION_MS * 0.6);
    }

    // Expanding/collapsing replaces the focused control, so move focus to its counterpart (never on first render).
    function focusWhenToggled(node: HTMLElement) {
        if (toggledByReader) node.focus({ preventScroll: true });
    }

    /** Front card sits straight; the rest alternate left and right, each a little further out and more tilted. */
    function cardTransform(index: number) {
        if (index === 0) return { x: 0, y: 0, rotate: 0 };
        const side = index % 2 === 1 ? -1 : 1;
        const step = Math.ceil(index / 2);
        return { x: side * step * 9, y: step * 2, rotate: side * (4 + step * 3) };
    }
</script>

{#if expanded}
    <div
        class="expanded"
        id="{uid}-grid"
        tabindex="-1"
        aria-label={`${images.length} images`}
        role="group"
        bind:this={grid}
        use:focusWhenToggled
    >
        <div class="grid">
            {#each images as image, i}
                <!-- earlier images stay on top while they fly out, matching the stack's order -->
                <figure style:z-index={images.length - i}>
                    <!-- not lazy: the cards already loaded these, and the animation needs their real size -->
                    <img
                        alt={image.alt}
                        src={image.src}
                        width={image.width}
                        height={image.height}
                        class:invert-dark={image.invertInDarkMode}
                        decoding="async"
                    />
                    {#if image.caption}
                        <figcaption>{@html image.caption}</figcaption>
                    {/if}
                </figure>
            {/each}
        </div>
        <button type="button" class="collapse" aria-controls="{uid}-grid" onclick={collapse}>
            Stack images
        </button>
    </div>
{:else}
    <figure class="fan-figure">
        <button
            type="button"
            class="fan"
            aria-expanded="false"
            aria-label={`Show all ${images.length} images`}
            onclick={expand}
            bind:this={fanButton}
            use:focusWhenToggled
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
                        loading="lazy"
                        decoding="async"
                    />
                </span>
            {/each}
            <span class="badge" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="6" width="14" height="14" rx="3" stroke="currentColor" stroke-width="2" />
                    <path d="M7 3h11a3 3 0 0 1 3 3v11" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                {images.length}
            </span>
        </button>
        {#if images[0].caption}
            <figcaption>{@html images[0].caption}</figcaption>
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
            0 1px 2px color-mix(in oklch, var(--shadow-color) 80%, transparent),
            0 14px 34px -12px var(--shadow-color);
        transform: translate(var(--x), var(--y)) rotate(var(--r));
        transform-origin: 50% 90%;
        transition: transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1);

        img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }

    /* spread the stack a little further on hover/focus, like nudging a pile of photos */
    .fan:is(:hover, :focus-visible) .card:not(:first-child) {
        transform: translate(calc(var(--x) * 1.9), calc(var(--y) * 1.5)) rotate(calc(var(--r) * 1.6));
    }

    .fan:is(:hover, :focus-visible) .card:first-child {
        transform: translateY(-2%) scale(1.02);
    }

    .badge {
        position: absolute;
        z-index: 10;
        right: 0.6rem;
        bottom: 0.6rem;
        display: flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.2rem 0.55rem 0.2rem 0.45rem;
        border-radius: 999px;
        background: rgb(0 0 0 / 55%);
        backdrop-filter: blur(8px);
        color: white;
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1.4;
        font-variant-numeric: tabular-nums;
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
        margin: 2.25rem 0;

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

        img {
            display: block;
            width: 100%;
            height: auto;
            max-height: min(28rem, 65dvh);
            object-fit: contain;
            border-radius: 12px;
            box-shadow: 0 10px 30px -14px var(--shadow-color);
        }

        figcaption {
            margin-top: 0.6rem;
        }
    }

    .collapse {
        display: block;
        margin: 1rem auto 0;
        padding: 0.35rem 0.85rem;
        border: 1px solid var(--rule);
        border-radius: 999px;
        background: var(--bg-color);
        font-size: 0.78rem;
        font-weight: 550;
        color: var(--muted);
        cursor: pointer;

        &:hover {
            color: var(--text-color);
            border-color: var(--secondary);
        }
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
</style>
