<script lang="ts">
    import ReaderLayout from "../ReaderLayout.svelte";

    let { seed }: { seed: string } = $props();

    // Lines per paragraph, and how many entries the placeholder outline shows.
    const PARAGRAPHS = [5, 7, 6, 4];
    const OUTLINE_ENTRIES = 9;

    // Stable, title-seeded widths (as percentages) so the skeleton doesn't jitter between renders.
    let layout = $derived.by(() => {
        let state = 2166136261;
        for (const character of seed) {
            state ^= character.charCodeAt(0);
            state = Math.imul(state, 16777619);
        }
        const random = (min: number, max: number) => {
            state = Math.imul(state, 1664525) + 1013904223;
            return min + ((state >>> 0) % (max - min + 1));
        };

        return {
            // full lines run nearly to the measure; each paragraph's last line stops short
            paragraphs: PARAGRAPHS.map((lines) =>
                Array.from({ length: lines }, (_, i) => (i === lines - 1 ? random(35, 70) : random(92, 100))),
            ),
            outline: Array.from({ length: OUTLINE_ENTRIES }, () => random(40, 85)),
        };
    });
</script>

<!-- Mirrors ArticleView's layout (outline, header, margin infobox, body) so nothing jumps when the article lands. -->
<ReaderLayout>
    {#snippet outline()}
        <div class="outline-skeleton" aria-hidden="true">
            <p class="outline-title">Contents</p>
            <div class="track">
                {#each layout.outline as width}
                    <div class="outline-row"><span class="skeleton bar" style:--width="{width}%"></span></div>
                {/each}
            </div>
        </div>
    {/snippet}

    <div class="article-skeleton" role="status" aria-label="Loading article">
        <div class="header" aria-hidden="true">
            <!-- the real title, where the article's heading will be -->
            <p class="title">{seed}</p>
            <div class="skeleton bar description"></div>
            <div class="skeleton bar meta"></div>
        </div>

        <div class="infobox-skeleton" aria-hidden="true">
            <div class="skeleton bar infobox-title"></div>
            <div class="skeleton infobox-image"></div>
            {#each { length: 6 } as _}
                <div class="infobox-row">
                    <span class="skeleton bar"></span>
                    <span class="skeleton bar"></span>
                </div>
            {/each}
        </div>

        <div class="body" aria-hidden="true">
            {#each layout.paragraphs as lines}
                <div class="paragraph">
                    {#each lines as width}
                        <div class="skeleton bar line" style:--width="{width}%"></div>
                    {/each}
                </div>
            {/each}
        </div>
    </div>
</ReaderLayout>

<style>
    .article-skeleton,
    .outline-skeleton {
        /* no hold-back: it only shows on a cold start or once an article is already slow (the route's load) */
        animation: fade-in var(--dur-base) var(--ease-out) backwards;
    }

    .article-skeleton {
        position: relative;
    }

    /* a bar paints its strip on ::before (below); everything else paints its own box */
    .skeleton:not(.bar),
    .bar::before {
        background: linear-gradient(
            90deg,
            color-mix(in oklch, var(--secondary) 65%, transparent) 25%,
            color-mix(in oklch, var(--secondary) 35%, var(--page-bg)) 50%,
            color-mix(in oklch, var(--secondary) 65%, transparent) 75%
        );
        background-size: 200% 100%;
        border-radius: 6px;

        animation: shimmer 1.4s ease-in-out infinite;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    /*
     * A bar takes up a whole line box (--line) like the text it stands in for, but only paints a --bar-thick strip in
     * its middle. The strip is its own box rather than a content-box-clipped background: a border-radius on the whole
     * line box would leave the strip with flattened, elliptical ends.
     */
    .bar {
        display: block;
        position: relative;
        width: var(--width, 100%);
        height: var(--line);

        &::before {
            content: "";
            position: absolute;
            inset: calc((var(--line) - var(--bar)) / 2) 0;
            border-radius: 999px;
        }
    }

    /* the same boxes as .article-header in ArticleView */
    .header {
        margin: 1.5rem 0 1.75rem;
        padding-bottom: 1.75rem;
        border-bottom: 1px solid var(--rule);
    }

    /* set exactly like ArticleView's #title */
    .title {
        margin: 0;
        font-family: var(--display-font);
        font-size: clamp(2.1rem, 1.6rem + 2vw, 2.75rem);
        font-weight: 600;
        line-height: 1.1;
        letter-spacing: -0.01em;
        text-wrap: balance;
        color: var(--text-color);
    }

    .description {
        --line: calc(1.15rem * 1.4);
        --bar: 0.7rem;
        width: min(55%, 17rem);
        margin-top: 0.6rem;
    }

    /* stands in for the row of action pills */
    .meta {
        --line: 1.9rem;
        --bar: 1.9rem;
        width: min(60%, 20rem);
        margin-top: 1rem;
    }

    .paragraph {
        margin-bottom: 1.15em;
    }

    .line {
        --line: calc(1em * var(--leading));
        --bar: 0.6em;
    }

    /* the opening paragraph reads as a standfirst on wider screens, as in ArticleContent */
    @media (min-width: 640px) {
        .paragraph:first-child {
            font-size: 1.1em;
        }
    }

    /* Only in the right margin, where it can't push the text around; inline, it would shift articles without one. */
    .infobox-skeleton {
        display: none;
    }

    :global(.infobox-in-margin) .infobox-skeleton {
        display: block;
        position: absolute;
        top: 1.5rem;
        left: calc(100% + var(--gap));
        box-sizing: border-box;
        width: min(21rem, var(--side-width));
        padding: 1rem;
        border: 1px solid var(--rule);
        border-radius: 14px;
        background: color-mix(in oklch, var(--bg-color) 70%, var(--page-bg));
    }

    .infobox-title {
        --line: 1.45rem;
        --bar: 0.9rem;
        width: 60%;
        margin: 0 auto 0.75rem;
    }

    .infobox-image {
        aspect-ratio: 4 / 3;
        margin-bottom: 0.75rem;
        border-radius: 8px;
    }

    .infobox-row {
        display: grid;
        grid-template-columns: 38% 1fr;
        gap: 0.9rem;
        padding: 0.5rem 0;
        border-top: 1px solid color-mix(in oklch, var(--rule) 60%, transparent);

        .bar {
            --line: 1.15rem;
            --bar: 0.6rem;
        }

        .bar:first-child {
            width: 80%;
        }
    }

    /* matches the outline in ArticleBreadcrumbs: label, then entries beside a faint rail */
    .outline-title {
        margin: 0 0 0.6rem 14px;
        font-size: 0.72rem;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
    }

    .track {
        position: relative;
        /* bars start where the real entries' text does */
        padding-left: 14px;

        &::before {
            content: "";
            position: absolute;
            top: 0;
            bottom: 0;
            left: 3px;
            width: 1px;
            background: var(--rule);
        }
    }

    .outline-row {
        .bar {
            --line: 1.5rem;
            --bar: 0.6rem;
        }
    }
</style>
