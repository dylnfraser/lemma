<script lang="ts">
    import { MediaQuery } from "svelte/reactivity";
    import type { Infobox } from "$lib/article/types";
    import { openLightboxFromClick, preventMouseFocusOnZoomImages } from "$lib/lightbox.svelte";
    import { handlePronunciationClick } from "$lib/pronunciation";
    import { DURATION, fold } from "$lib/motion";
    import Icon from "../icons/Icon.svelte";

    // `expanded` is bindable so the article can keep it across back/forward navigation.
    let { infobox, expanded = $bindable(false) }: { infobox: Infobox; expanded?: boolean } = $props();

    // In the right margin (wide screens) the whole infobox shows; inline (narrow) it starts as a short preview.
    const wide = new MediaQuery("min-width: 1280px");
    const PREVIEW_DATA_ROWS = 5;

    // Rows only animate in when the reader toggles; restoring from back/forward lays them out instantly.
    let animateRows = $state(false);

    // Preview: everything up to and including the first few label/value rows (keeps the lead image and map).
    let previewLength = $derived.by(() => {
        let dataRows = 0;
        const index = infobox.rows.findIndex((row) => row.kind === "data" && ++dataRows === PREVIEW_DATA_ROWS);
        return index === -1 ? infobox.rows.length : index + 1;
    });
    let showAll = $derived(wide.current || expanded);
    let rows = $derived(showAll ? infobox.rows : infobox.rows.slice(0, previewLength));
    let hiddenCount = $derived(infobox.rows.length - previewLength);

</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (delegates clicks from the image buttons inside; see zoomableImages.ts) -->
<aside
    class="infobox"
    class:inline={!wide.current}
    aria-label="Quick facts"
    onmousedown={preventMouseFocusOnZoomImages}
    onclick={(event) => handlePronunciationClick(event) || openLightboxFromClick(event, infobox.images)}
>
    {#if infobox.title}
        <div class="title">{@html infobox.title}</div>
    {/if}

    <div class="rows">
        {#each rows as row, i (i)}
            <div class="row {row.kind}" transition:fold={{ duration: animateRows ? DURATION.base : 0 }} class:sub={row.kind === "data" && row.sub}>
                {#if row.kind === "data"}
                    <div class="label">{@html row.label}</div>
                    <div class="value">{@html row.html}</div>
                {:else if row.kind === "succession"}
                    {#each [{ label: "Preceded by", before: true, entries: row.before }, { label: "Succeeded by", before: false, entries: row.after }] as group (group.label)}
                        {#if group.entries.length}
                            <div class="succession-group">
                                <div class="succession-label">
                                    {#if group.before}<Icon name="arrow-left" />{/if}
                                    {group.label}
                                    {#if !group.before}<Icon name="arrow-right" />{/if}
                                </div>
                                <ul>
                                    {#each group.entries as entry}
                                        <li>
                                            <span class="flag">{@html entry.icon}</span>
                                            <span>{@html entry.html}</span>
                                        </li>
                                    {/each}
                                </ul>
                            </div>
                        {/if}
                    {/each}
                {:else}
                    {@html row.html}
                {/if}
            </div>
        {/each}
    </div>

    {#if !wide.current && hiddenCount > 0}
        <button
            type="button"
            class="toggle"
            aria-expanded={expanded}
            onclick={() => {
                animateRows = true;
                expanded = !expanded;
            }}
        >
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
        padding: 0.32rem 0;
        border-top: 1px solid color-mix(in oklch, var(--rule) 45%, transparent);
    }

    .row.data {
        display: grid;
        /* wide enough for labels like "Official languages" on one line */
        grid-template-columns: minmax(6.75rem, 38%) minmax(0, 1fr);
        gap: 0.75rem;
        align-items: baseline;
        line-height: 1.4;
    }

    /* Details of the row above ("President" under "Government", the parts of a population breakdown): tucked under
       it as one group, no dividers, a small dot instead of Wikipedia's typed bullet. */
    .row.sub {
        padding: 0.06rem 0;
        border-top: none;

        .label {
            position: relative;
            padding-left: 0.75rem;
            font-weight: 500;

            &::before {
                content: "";
                position: absolute;
                left: 0.2rem;
                top: calc(0.5lh - 1.5px);
                width: 3px;
                height: 3px;
                border-radius: 50%;
                background: currentColor;
                opacity: 0.6;
            }
        }
    }

    /* the group's last sub-row leaves a little air before the next divider */
    .row.sub:has(+ .row:not(.sub)) {
        padding-bottom: 0.3rem;
    }

    /* rows straight after a section heading start the section; the heading already separates it */
    .row.header + .row {
        border-top: none;
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
    }

    /* top-level lists in a value sit flush with the column (nested lists keep their indent) */
    .infobox .value > :global(:is(ul, ol)),
    .infobox .value > :global(div > :is(ul, ol)) {
        padding-left: 0;
        list-style: none;
    }

    .infobox .value :global(li + li) {
        margin-top: 0.15rem;
    }

    .row.header {
        margin-top: 0.35rem;
        padding: 0.5rem 0 0.15rem;

        /* keep a heading's citation or qualifier on its line ("Racial makeup (2022)³") */
        :global(div) {
            display: inline;
        }

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

    /* "Preceded by / Succeeded by": two labelled groups, side by side when the card has room */
    .row.succession {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
        gap: 0.75rem 1rem;
        margin-top: 0.2rem;
        padding-top: 0.65rem;
    }

    .succession-label {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        margin-bottom: 0.4rem;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
    }

    .succession-group ul {
        display: grid;
        gap: 0.35rem;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .succession-group li {
        display: grid;
        grid-template-columns: 1.4rem minmax(0, 1fr);
        align-items: start;
        gap: 0.45rem;
        line-height: 1.35;
    }

    /* every flag in the same slot, aligned with the first line of its name */
    .flag {
        display: grid;
        place-items: center;
        height: 1.35em;

        :global(img) {
            display: block;
            width: auto;
            max-width: 100%;
            max-height: 0.95em;
            margin: 0;
            border-radius: 2px;
            outline: 1px solid color-mix(in oklch, var(--text-color) 12%, transparent);
            outline-offset: -1px;
        }
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

        :global(.zoom-image img) {
            border-radius: 6px;
        }

        /*
         * Photo montages ({{multiple image}}): rows of pictures side by side, each row filling the box and its pictures
         * cropped to one height, with short captions under them. Wikipedia's fixed pixel widths are let go.
         */
        :global(.tmulti) {
            width: 100%;
        }

        :global(.tmulti .multiimageinner) {
            display: grid;
            gap: 0.45rem;
            width: auto !important;
            max-width: none !important;
        }

        :global(.tmulti .trow) {
            display: flex;
            gap: 0.35rem;
        }

        :global(.tmulti .tsingle) {
            display: flex;
            flex: 1 1 0;
            flex-direction: column;
            gap: 0.25rem;
            min-width: 0;
            width: auto !important;
            max-width: none !important;
        }

        /* the picture's frame: one height per row (taller when a picture has the row to itself) */
        :global(.tmulti .tsingle > div:first-child) {
            height: 4.75rem !important;
            overflow: hidden;
            border-radius: 6px;
        }

        :global(.tmulti .trow:has(> .tsingle:only-child) .tsingle > div:first-child) {
            height: 9rem !important;
        }

        :global(.tmulti .tsingle :is(span, .zoom-image)) {
            display: block;
            width: 100%;
            height: 100%;
        }

        :global(.tmulti .tsingle img) {
            display: block;
            width: 100%;
            height: 100%;
            max-width: none;
            object-fit: cover;
            border-radius: 0;
            transition: scale var(--dur-slow) var(--ease-out);
        }

        :global(.tmulti .tsingle .zoom-image:hover img) {
            scale: 1.05;
        }

        :global(.tmulti .tsingle > div:not(:first-child)) {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            line-clamp: 2;
            overflow: hidden;
            font-size: 0.7rem;
            line-height: 1.3;
            text-align: center;
            text-wrap: balance;
            color: var(--muted);

            :global(a) {
                color: inherit;
                text-decoration: none;
            }

            :global(a:hover) {
                color: var(--link-hover);
            }
        }

        /* flags, trend arrows and similar icons stay at text height */
        :global(img.inline-icon) {
            width: auto;
            max-height: 1em;
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






        :global(audio) {
            display: block;
            width: 100%;
            height: 36px;
            margin: 0.35rem 0 0.15rem;
            accent-color: var(--accent);
        }

        :global(button.pronounce) {
            display: inline-grid;
            place-items: center;
            width: 1.4em;
            height: 1.4em;
            margin: 0 0.1em;
            padding: 0;
            vertical-align: -0.06em;
            border: 1px solid var(--rule);
            border-radius: 50%;
            background: var(--bg-color);
            color: var(--muted);
            cursor: pointer;
        }

        :global(button.pronounce::before) {
            content: "";
            width: 0.8em;
            height: 0.8em;
            background-color: currentColor;
            mask: var(--icon-volume) center / contain no-repeat;
            -webkit-mask: var(--icon-volume) center / contain no-repeat;
        }

        :global(button.pronounce:hover),
        :global(button.pronounce.playing) {
            color: var(--accent);
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
