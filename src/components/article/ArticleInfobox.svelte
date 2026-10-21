<script lang="ts">
    import { MediaQuery } from "svelte/reactivity";
    import type { Infobox } from "$lib/article/types";
    import { openLightbox } from "$lib/lightbox.svelte";
    import { DURATION, fold } from "$lib/motion";

    let { infobox }: { infobox: Infobox } = $props();

    // In the right margin (wide screens) the whole infobox shows; inline (narrow) it starts as a short preview.
    const wide = new MediaQuery("min-width: 1280px");
    const PREVIEW_DATA_ROWS = 5;

    let expanded = $state(false);
    let card = $state<HTMLElement>();

    // Preview: everything up to and including the first few label/value rows (keeps the lead image and map).
    let previewLength = $derived.by(() => {
        let dataRows = 0;
        const index = infobox.rows.findIndex((row) => row.kind === "data" && ++dataRows === PREVIEW_DATA_ROWS);
        return index === -1 ? infobox.rows.length : index + 1;
    });
    let showAll = $derived(wide.current || expanded);
    let rows = $derived(showAll ? infobox.rows : infobox.rows.slice(0, previewLength));
    let hiddenCount = $derived(infobox.rows.length - previewLength);

    // Infobox images open the full-screen viewer.
    function handleClick(event: MouseEvent) {
        const image = (event.target as Element).closest<HTMLImageElement>("img[data-lightbox-index]");
        if (!image || !card) return;
        event.preventDefault();
        const sources = [...card.querySelectorAll<HTMLElement>("img[data-lightbox-index]")];
        openLightbox(infobox.images, Number(image.dataset.lightboxIndex), sources);
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (image zoom is a mouse shortcut; every image is also reachable in the article) -->
<aside class="infobox" class:inline={!wide.current} aria-label="Quick facts" bind:this={card} onclick={handleClick}>
    {#if infobox.title}
        <div class="title">{@html infobox.title}</div>
    {/if}

    <div class="rows">
        {#each rows as row, i (i)}
            <div class="row {row.kind}" transition:fold={{ duration: DURATION.base }}>
                {#if row.kind === "data"}
                    <div class="label">{@html row.label}</div>
                    <div class="value">{@html row.html}</div>
                {:else}
                    {@html row.html}
                {/if}
            </div>
        {/each}
    </div>

    {#if !wide.current && hiddenCount > 0}
        <button type="button" class="toggle" aria-expanded={expanded} onclick={() => (expanded = !expanded)}>
            {expanded ? "Show fewer facts" : `Show all facts (${hiddenCount} more)`}
        </button>
    {/if}
</aside>

<style>
    .infobox {
        box-sizing: border-box;
        padding: 1rem 1rem 0.75rem;
        border: 1px solid var(--rule);
        border-radius: 14px;
        background: color-mix(in oklch, var(--bg-color) 70%, var(--page-bg));
        box-shadow: 0 14px 34px -24px var(--shadow-color);
        font-size: 0.8rem;
        line-height: 1.45;
        font-variant-numeric: lining-nums tabular-nums;
        /* break only words that can't fit at all; never split "languages" mid-word */
        overflow-wrap: break-word;
        hyphens: manual;

        &.inline {
            margin: 0 0 2rem;
        }
    }

    .title {
        margin-bottom: 0.75rem;
        font-family: default-serif;
        font-size: 1.15rem;
        font-weight: 600;
        line-height: 1.25;
        text-align: center;
        text-wrap: balance;

        /* native-language names and similar second lines */
        :global(div + div),
        :global(i),
        :global(.nickname) {
            display: block;
            font-family: default-sans;
            font-size: 0.8rem;
            font-weight: 450;
            color: var(--muted);
        }
    }

    .rows {
        display: grid;
    }

    .row {
        padding: 0.5rem 0;
        border-top: 1px solid color-mix(in oklch, var(--rule) 60%, transparent);
    }

    .row.data {
        display: grid;
        /* wide enough for labels like "Official languages" on one line */
        grid-template-columns: minmax(6.75rem, 38%) minmax(0, 1fr);
        gap: 0.9rem;
        align-items: baseline;
    }

    .label {
        font-size: 0.74rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        line-height: 1.35;
        color: var(--muted);

        /* "and largest city" and similar qualifiers */
        :global(div) {
            font-weight: 450;
        }
    }

    .value {
        color: var(--text-color);

        :global(ul),
        :global(ol) {
            padding-left: 0;
            list-style: none;
        }

        :global(li + li) {
            margin-top: 0.15rem;
        }
    }

    .row.header {
        margin-top: 0.6rem;
        padding-top: 0.6rem;
        border-top-color: var(--rule);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
    }

    .row.full {
        text-align: center;
        color: color-mix(in oklch, var(--text-color) 85%, var(--page-bg));
    }

    .rows > .row:first-child {
        border-top: none;
    }

    /* content from Wikipedia */
    .infobox {
        :global(a) {
            color: inherit;
            text-decoration-color: color-mix(in oklch, currentColor 30%, transparent);
            text-underline-offset: 0.18em;
        }

        :global(a:hover) {
            color: var(--link-hover);
        }

        :global(img) {
            max-width: 100%;
            height: auto;
        }

        :global(img[data-lightbox-index]) {
            border-radius: 6px;
            cursor: zoom-in;
        }

        :global(img.inline-icon) {
            width: auto;
            max-height: 1.3em;
            vertical-align: -0.25em;
            margin-inline-end: 0.3em;
        }

        :global(table) {
            width: 100%;
            margin: 0;
            border-collapse: collapse;
        }

        :global(:is(td, th)) {
            padding: 0.15rem;
            vertical-align: top;
        }

        :global([id]) {
            scroll-margin-top: calc(var(--nav-height) + 1.5rem);
        }

        /* long collapsible lists (see parseInfobox) */
        :global(details.infobox-collapsible summary) {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            color: var(--muted);
            font-weight: 600;
            cursor: pointer;
            list-style: none;
        }

        :global(details.infobox-collapsible summary::-webkit-details-marker) {
            display: none;
        }

        :global(details.infobox-collapsible summary::before) {
            content: "▸";
            font-size: 0.8em;
            transition: rotate var(--dur-fast) var(--ease-out);
        }

        :global(details.infobox-collapsible[open] summary::before) {
            rotate: 90deg;
        }

        :global(details.infobox-collapsible[open] summary) {
            margin-bottom: 0.25rem;
        }

        /* app.css sizes every <p> at 1rem; inside the card they should match it */
        :global(p) {
            margin: 0.2rem 0 0;
            font-size: inherit;
            line-height: inherit;
        }

        :global(.infobox-caption),
        :global(.ib-country-map-caption) {
            margin-top: 0.3rem;
            font-size: 0.75rem;
            color: var(--muted);
        }

        :global(ul),
        :global(ol) {
            margin: 0;
            padding-left: 1.1em;
        }

        :global(.plainlist ul) {
            padding: 0;
            list-style: none;
        }

        /* Wikipedia's horizontal lists ("Polish · Pole") */
        :global(.hlist ul) {
            display: inline;
            padding: 0;
        }

        :global(.hlist li) {
            display: inline;
        }

        :global(.hlist li:not(:last-child)::after) {
            content: " · ";
            font-weight: 700;
        }

        :global(sup.reference) {
            font-size: 0.75em;
            line-height: 0;
        }

        :global(sup.reference .cite-bracket) {
            display: none;
        }

        :global(sup.reference a) {
            color: var(--muted);
            text-decoration: none;
        }

        :global(.mwe-math-mathml-a11y),
        :global(.sr-only) {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip-path: inset(50%);
        }
    }

    @media (prefers-color-scheme: dark) {
        .infobox :global(img.mw-invert),
        .infobox :global(img.skin-invert) {
            filter: invert(1) hue-rotate(180deg);
        }
    }

    .toggle {
        display: block;
        width: 100%;
        margin-top: 0.6rem;
        padding: 0.45rem;
        border: 1px solid var(--rule);
        border-radius: 999px;
        background: var(--bg-color);
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--muted);
        cursor: pointer;
        transition:
            color var(--dur-fast),
            border-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &:hover {
            color: var(--text-color);
            border-color: var(--secondary);
        }
    }
</style>
