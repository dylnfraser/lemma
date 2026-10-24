<script lang="ts">
    import type { Snippet } from "svelte";
    import { fade } from "svelte/transition";
    import { layout } from "$lib/layout.svelte";
    import { DURATION, motion, rise } from "$lib/motion";
    import { settings } from "$lib/settings.svelte";
    import ChevronIcon from "./icons/ChevronIcon.svelte";

    interface Props {
        children: Snippet;
        /** Section navigation; receives a `close` callback for dismissing the drawer on small screens. */
        outline?: Snippet<[{ close: () => void }]>;
        /** The section being read, shown on the small-screen Sections button. */
        outlineLabel?: string;
    }

    let { children, outline, outlineLabel }: Props = $props();

    const uid = $props.id();
    let outlineOpen = $state(false);
    let reader: HTMLElement;

    // The infobox goes in the right margin when that margin is at least this wide (at the default settings, from a
    // window about 1280px wide; larger text or a wider line need a wider window).
    const MARGIN_INFOBOX_REM = 16.25;

    $effect(() => {
        // the settings change the column's width without changing the window's
        void settings.textSize;
        void settings.width;
        const measure = () => {
            const style = getComputedStyle(reader);
            const px = (property: string) => Number.parseFloat(property) || 0;
            const side =
                (reader.clientWidth - px(style.paddingLeft) - px(style.paddingRight) - px(style.getPropertyValue("--measure-px")) - 2 * px(style.columnGap)) / 2;
            const rem = px(getComputedStyle(document.documentElement).fontSize);
            layout.infoboxInMargin = side >= MARGIN_INFOBOX_REM * rem;
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(reader);
        return () => observer.disconnect();
    });

    function close() {
        outlineOpen = false;
    }

    function handleWindowKeydown(event: KeyboardEvent) {
        if (event.key === "Escape" && outlineOpen) close();
    }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="reader" class:infobox-in-margin={layout.infoboxInMargin} bind:this={reader}>
    {#if outline}
        <aside id="{uid}-outline" class="outline" class:open={outlineOpen} aria-label="Sections">
            {@render outline({ close })}
        </aside>

        {#if outlineOpen}
            <button
                type="button"
                class="outline-backdrop"
                aria-label="Close sections"
                tabindex="-1"
                onclick={close}
                transition:fade={{ duration: motion(DURATION.base) }}
            ></button>
        {/if}
        <!-- on small screens: a floating pill naming the section being read, with a ring that fills as you read -->
        <button
            type="button"
            class="outline-toggle"
            aria-controls="{uid}-outline"
            aria-expanded={outlineOpen}
            aria-label={outlineLabel ? `Sections (reading ${outlineLabel})` : "Sections"}
            onclick={() => (outlineOpen = !outlineOpen)}
        >
            <svg class="progress" viewBox="0 0 20 20" aria-hidden="true">
                <circle class="rail" cx="10" cy="10" r="7.5" />
                <circle class="read" cx="10" cy="10" r="7.5" pathLength="1" />
            </svg>
            <span class="label">
                {#key outlineLabel}
                    <span in:rise={{ y: 4, duration: DURATION.base }}>{outlineLabel ?? "Contents"}</span>
                {/key}
            </span>
            <ChevronIcon collapsed={!outlineOpen} size={16} />
        </button>
    {/if}

    <main id="main" class="content">
        {@render children()}
    </main>
</div>

<style>
    .reader {
        --gap: clamp(1.5rem, 4vw, 3.5rem);
        --pad: clamp(1.25rem, 4vw, 2rem);
        --measure-px: var(--measure);
        /* width of each side column, for content placed in the margins (e.g. the infobox) */
        --side-width: calc((100vw - 2 * var(--pad) - var(--measure-px) - 2 * var(--gap)) / 2);

        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, var(--measure)) minmax(0, 1fr);
        column-gap: var(--gap);
        padding: calc(var(--nav-height) + 2rem) max(var(--pad), env(safe-area-inset-right)) 40vh max(var(--pad), env(safe-area-inset-left));
        line-height: var(--leading);
        /* Last-resort guard: stray wide content must never widen the page (and the mobile viewport) itself. */
        overflow-x: clip;
    }

    .content {
        grid-column: 2;
        grid-row: 1;
        min-width: 0;
    }

    .outline {
        grid-column: 1;
        grid-row: 1;
        justify-self: end;
        align-self: start;
        position: sticky;
        top: calc(var(--nav-height) + 2rem);
        /* level with the margin infobox: the article header's 1.5rem top margin plus the infobox's 1.5rem offset */
        margin-top: 3rem;
        display: flex;
        flex-direction: column;
        width: min(100%, 17rem);
        max-height: calc(100dvh - var(--nav-height) - 4rem);
        line-height: 1.25;
    }

    .outline-toggle,
    .outline-backdrop {
        display: none;
    }

    @media (max-width: 1050px) {
        .reader {
            grid-template-columns: minmax(0, var(--measure));
            justify-content: center;
            /* where the floating Sections pill sits; its card opens just above it */
            --pill-height: 2.6rem;
            --pill-bottom: calc(1.25rem + env(safe-area-inset-bottom));
            --pill-left: max(1rem, env(safe-area-inset-left));
            /* the pill and its card share one border and one shadow; the card has the corners of the site's other panels */
            --pill-radius: calc(var(--pill-height) / 2);
            --pill-border: 1px solid var(--rule);
            --pill-shadow: 0 12px 32px -14px var(--shadow-color);
            --close: calc(var(--dur-fast) * 0.7);
        }

        .content {
            grid-column: 1;
        }

        /* a card that grows up out of the pill */
        .outline {
            position: fixed;
            z-index: 25;
            top: auto;
            left: var(--pill-left);
            bottom: calc(var(--pill-bottom) + var(--pill-height) + 0.6rem);
            margin: 0;
            width: min(20rem, calc(100vw - 2rem));
            max-height: min(64dvh, 34rem);
            box-sizing: border-box;
            padding: 1rem 0.6rem 0 0.4rem;
            background: var(--bg-color);
            border: var(--pill-border);
            border-radius: 14px;
            box-shadow: var(--pill-shadow);
            transform-origin: var(--pill-radius) 100%;

            visibility: hidden;
            opacity: 0;
            scale: 0.95;
            translate: 0 6px;
            /* closes quicker than it opens; visibility flips once it has faded */
            transition:
                opacity var(--close) ease-in,
                scale var(--close) ease-in,
                translate var(--close) ease-in,
                visibility 0s linear var(--close);

            &.open {
                visibility: visible;
                opacity: 1;
                scale: 1;
                translate: none;
                transition:
                    opacity var(--dur-fast) var(--ease-out),
                    scale var(--dur-base) var(--ease-out),
                    translate var(--dur-base) var(--ease-out);
            }
        }

        .outline-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 24;
            border: none;
            background: rgb(0 0 0 / 12%);

            /* a full-screen layer shouldn't take part in the global press-scale */
            &:active {
                scale: 1;
            }
        }

        .outline-toggle {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            position: fixed;
            z-index: 26;
            left: var(--pill-left);
            bottom: var(--pill-bottom);
            box-sizing: border-box;
            height: var(--pill-height);
            max-width: min(16rem, calc(100vw - 2rem));
            padding: 0 0.75rem 0 0.7rem;
            border: var(--pill-border);
            border-radius: var(--pill-radius);
            background: var(--bg-color);
            box-shadow: var(--pill-shadow);
            font-size: 0.82rem;
            font-weight: 600;
            line-height: 1;
            color: var(--text-color);
            cursor: pointer;
            transition: scale var(--dur-instant) var(--ease-out);

            > :global(svg:last-child) {
                flex: none;
                color: var(--muted);
            }
        }

        .label {
            display: grid;
            min-width: 0;

            span {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }

        /* reading progress: the ring fills as the page scrolls (where scroll-driven animations exist; else just the rail) */
        .progress {
            flex: none;
            width: 1.1rem;
            height: 1.1rem;
            rotate: -90deg;
            fill: none;
            stroke-width: 2.5;

            .rail {
                stroke: color-mix(in oklch, var(--secondary) 70%, transparent);
            }

            .read {
                stroke: var(--accent);
                stroke-linecap: round;
                stroke-dasharray: 1;
                stroke-dashoffset: 1;
            }
        }

        @supports (animation-timeline: scroll()) {
            .progress .read {
                animation: ring-fill linear both;
                animation-timeline: scroll(root);
            }
        }
    }

    @keyframes ring-fill {
        from {
            stroke-dashoffset: 0.97;
        }

        to {
            stroke-dashoffset: 0;
        }
    }
</style>
