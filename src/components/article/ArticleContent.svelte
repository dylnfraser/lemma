<script lang="ts">
    import { isBlockHiddenByCollapsed } from "$lib/article/articleNavigation";
    import { isFoldableHeadingLevel } from "$lib/article/articleUtils";
    import { enhanceContent } from "$lib/article/enhanceContent";
    import type { ArticleBlock } from "$lib/article/types";
    import { isKeyboardClick, preventMouseFocus } from "$lib/focus";
    import { openLightbox } from "$lib/lightbox.svelte";
    import { DURATION, fold, pop, rise } from "$lib/motion";
    import { handlePronunciationClick, stopPronunciation } from "$lib/pronunciation";
    import ChevronIcon from "../icons/ChevronIcon.svelte";
    import Icon from "../icons/Icon.svelte";
    import ImageFan from "./ImageFan.svelte";

    interface Props {
        blocks: ArticleBlock[];
        collapsedSectionIds: ReadonlySet<string>;
        onToggleSection: (id: string) => void;
        onclick?: (event: MouseEvent) => void;
        /** Wikipedia's TemplateStyles for this article (scoped to .mw-parser-output, which this body carries). */
        styles?: string;
    }

    let { blocks, collapsedSectionIds, onToggleSection, onclick, styles = "" }: Props = $props();

    /** Adds the article's template CSS to the page while it's shown. textContent keeps it inert as markup. */
    function templateStyles(_node: HTMLElement, css: string) {
        const element = document.createElement("style");
        element.dataset.lemma = "template-styles";
        element.textContent = css;
        document.head.append(element);
        return {
            update: (next: string) => (element.textContent = next),
            destroy: () => element.remove(),
        };
    }

    function handleClick(event: MouseEvent) {
        if (!handlePronunciationClick(event)) onclick?.(event);
    }

    $effect(() => stopPronunciation);

    // Sections are told apart by their headings and the space above them; a rule only marks where the reading ends
    // and the back matter (See also, Notes, References…) begins.
    const BACK_MATTER =
        /^(see also|notes|footnotes|explanatory notes|citations|references|notes and references|sources|bibliography|works cited|further reading|external links)$/i;
    let backMatterId = $derived(
        blocks
            .flatMap((block) => (block.type === "heading" ? [block.heading] : []))
            .find((heading) => heading.level === 2 && BACK_MATTER.test(heading.text.trim()))?.id ?? "",
    );

    // The opening paragraph is styled as a standfirst.
    let leadIndex = $derived(blocks.findIndex((block) => block.type === "html" && block.kind === "paragraph"));

    let copyStatus = $state<{ id: string; ok: boolean } | null>(null);
    let copiedResetTimer: ReturnType<typeof setTimeout>;

    async function copySectionLink(id: string) {
        const url = new URL(window.location.href);
        url.hash = id;

        let ok = true;
        try {
            await navigator.clipboard.writeText(url.toString());
        } catch {
            ok = false;
        }

        copyStatus = { id, ok };
        clearTimeout(copiedResetTimer);
        copiedResetTimer = setTimeout(() => (copyStatus = null), 1600);
    }


</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (delegates clicks on in-article links) -->
<div class="article-body mw-parser-output" onclick={handleClick} use:templateStyles={styles}>
    {#each blocks as block, i (i)}
        <!-- each element sits directly in its own {#if shown}: Svelte's (local) transitions only play when the
             block immediately around an element is added or removed, so this is what lets folding animate -->
        {@const shown = !isBlockHiddenByCollapsed(block, collapsedSectionIds)}
        {#if block.type === "heading"}
            {@const heading = block.heading}
            {@const collapsed = collapsedSectionIds.has(heading.id)}
            {#if shown}
                {@const copied = copyStatus?.id === heading.id ? copyStatus : null}
                <svelte:element this={heading.tag.toLowerCase()} id={heading.id} class="section-heading" class:divided={heading.id === backMatterId} data-heading transition:fold>
                    {#if isFoldableHeadingLevel(heading.level)}
                        <button
                            class="chev"
                            type="button"
                            aria-label={`${collapsed ? "Expand" : "Collapse"} section ${heading.text}`}
                            aria-expanded={!collapsed}
                            onclick={() => onToggleSection(heading.id)}
                        >
                            <ChevronIcon {collapsed} />
                        </button>
                    {/if}{heading.text}
                    <button
                        class="copy-section"
                        class:copied
                        type="button"
                        aria-label={`Copy link to ${heading.text}`}
                        title="Copy link to section"
                        onclick={() => copySectionLink(heading.id)}
                    >
                        <!-- the link icon turns into a tick (or a cross), each fading through a blur into the next -->
                        <span class="copy-icon">
                            {#key copied ? (copied.ok ? "check" : "x") : "link"}
                                <span class="copy-glyph" in:pop={{ start: 0.85, duration: DURATION.slow }} out:pop={{ start: 0.85, duration: DURATION.base }}>
                                    <Icon name={copied ? (copied.ok ? "check" : "x") : "link"} size="0.95em" />
                                </span>
                            {/key}
                        </span>
                    </button
                    >{#if copied}
                        <span class="copy-note" aria-hidden="true" in:rise={{ y: 0, duration: DURATION.slow }} out:rise={{ y: 0, duration: DURATION.base }}
                            >{copied.ok ? "Copied" : "Couldn't copy"}</span
                        >
                    {/if}
                </svelte:element>
            {/if}
        {:else if block.type === "images" && block.images.length > 1}
            {#if shown}
                <div class="block images" transition:fold>
                    <ImageFan images={block.images} caption={block.caption} />
                </div>
            {/if}
        {:else if block.type === "images"}
            {@const image = block.images[0]}
            {@const caption = image.caption || block.caption}
            {#if shown}
                <div class="wiki-images" transition:fold>
                    <figure class:sized={image.width && image.height}>
                        <button
                            type="button"
                            class="zoomable"
                            style:--ar={image.width && image.height ? image.width / image.height : undefined}
                            style:--max-w={image.pixelWidth ? `${image.pixelWidth}px` : undefined}
                            aria-label={image.alt ? `View full screen: ${image.alt}` : "View image full screen"}
                            onmousedown={preventMouseFocus}
                            onclick={(event) =>
                                openLightbox([image], 0, [event.currentTarget.querySelector("img")], isKeyboardClick(event))}
                        >
                            <img
                                alt={image.alt}
                                src={image.src}
                                width={image.width}
                                height={image.height}
                                class:invert-dark={image.invertInDarkMode}
                                class:light-backing={image.lightBacking}
                                loading="lazy"
                                decoding="async"
                            />
                        </button>
                        {#if caption}
                            <figcaption>{@html caption}</figcaption>
                        {/if}
                    </figure>
                </div>
            {/if}
        {:else if block.kind === "table"}
            {#if shown}<div class="table-scroll" transition:fold use:enhanceContent>{@html block.html}</div>{/if}
        {:else}
            <!-- spacing lives on this wrapper (not the HTML inside) so folding never jumps by a collapsed margin -->
            {#if shown}
                <div class="block {block.kind}" class:lead={i === leadIndex} transition:fold use:enhanceContent>
                    {@html block.html}
                </div>
            {/if}
        {/if}
    {/each}
</div>

<p class="sr-only" role="status">
    {#if copyStatus}{copyStatus.ok ? "Section link copied" : "Couldn't copy the section link"}{/if}
</p>

<style>
    /* ---------- body text ---------- */

    .article-body {
        /* fewer lone words on a paragraph's last line (inherited by lists, quotes and captions) */
        text-wrap: pretty;
        font-size: 1.0625rem;
        line-height: var(--leading);
        font-variant-numeric: oldstyle-nums proportional-nums;
        hanging-punctuation: first;
        /* Long unbroken runs (digit sequences, URLs) must wrap rather than widen the page on phones. */
        overflow-wrap: break-word;

        /* Templates like {{gaps}} nest no-wrap digit groups inside a no-wrap run; let the run break between groups
           (marked when the article is parsed). */
        :global(.nowrap-groups) {
            white-space: normal !important;
        }

        :global([id]) {
            scroll-margin-top: calc(var(--nav-height) + 1.5rem);
        }


        :global(p) {
            margin: 0 0 1.15em;
        }

        /* The opening paragraph reads as a standfirst: set in the serif of the headings, a little larger, and on wider
           screens opening with a drop cap. */
        .lead :global(p) {
            font-family: default-serif;
            font-size: 1.06em;
            line-height: 1.6;
            letter-spacing: 0.003em;
            /* set as a block; hyphenation keeps the justified lines from opening up wide gaps */
            text-align: justify;
            hyphens: auto;
        }

        @media (min-width: 640px) {
            .lead :global(p) {
                font-size: 1.12em;
                line-height: 1.6;
            }

            .lead :global(p:first-of-type::first-letter) {
                float: left;
                margin: 0.06em 0.1em 0 0;
                font-size: 3.3em;
                font-weight: 600;
                line-height: 0.85;
                color: var(--accent);
            }
        }

        :global(b),
        :global(strong) {
            font-weight: 650;
        }

        :global(cite) {
            font-style: normal;
        }

        /* links: quiet underlines so dense paragraphs stay readable */
        :global(a) {
            color: inherit;
            text-decoration-line: underline;
            text-decoration-thickness: 1px;
            /* underlines carry a little of the article's accent */
            text-decoration-color: color-mix(in oklch, color-mix(in oklch, var(--accent) 45%, currentColor) 32%, transparent);
            text-underline-offset: 0.22em;
            transition:
                color var(--dur-fast),
                text-decoration-color var(--dur-fast);
        }

        :global(a:hover) {
            color: var(--link-hover);
            text-decoration-color: currentColor;
        }

        :global(a.external:not(.map-frame)::after) {
            content: "";
            display: inline-block;
            width: 0.62em;
            height: 0.62em;
            margin-left: 0.15em;
            vertical-align: 0.05em;
            background-color: var(--muted);
            mask: var(--icon-arrow-up-right) center / contain no-repeat;
            -webkit-mask: var(--icon-arrow-up-right) center / contain no-repeat;
        }

        :global(.redlink) {
            text-decoration: underline dotted;
            text-decoration-color: color-mix(in oklch, var(--danger) 60%, transparent);
            text-underline-offset: 0.22em;
            cursor: help;
        }

        /* citations: small, muted, no brackets; adjacent ones are separated by commas */
        :global(sup.reference),
        :global(.mw-ref) {
            line-height: 0;
            font-size: 0.68em;
            font-variant-numeric: lining-nums tabular-nums;
            padding-left: 0.08em;
        }

        :global(sup.reference.follows-citation::before) {
            content: ",";
            color: var(--muted);
        }

        :global(sup.reference .cite-bracket) {
            display: none;
        }

        :global(sup.reference a) {
            color: var(--muted);
            text-decoration: none;
            font-weight: 600;
        }

        :global(sup.reference a:hover) {
            color: var(--link-hover);
        }

        /* lists */
        :global(ul),
        :global(ol) {
            margin: 0 0 1.15em;
            padding-left: 1.4em;
        }

        :global(li) {
            margin-bottom: 0.35em;
            padding-left: 0.15em;
        }

        :global(li > :is(ul, ol)) {
            margin: 0.35em 0 0;
        }

        :global(li::marker) {
            color: var(--muted);
        }

        :global(dl) {
            margin: 0 0 1.15em;
        }

        :global(dt) {
            font-weight: 650;
        }

        :global(dd) {
            margin-left: 1.5rem;
        }

        /* pull quotes */
        :global(blockquote) {
            margin: 1.75em 0;
            padding: 0.1em 0 0.1em 1.25em;
            border-left: 2px solid color-mix(in oklch, var(--accent) 55%, var(--rule));
            font-family: default-serif;
            font-size: 1.05em;
            line-height: 1.6;
            color: color-mix(in oklch, var(--text-color) 85%, var(--page-bg));

            /* app.css sets a font on every <p>, so quote paragraphs must opt back into the serif */
            :global(p) {
                font-family: inherit;
                font-size: inherit;
            }

            :global(p:last-child) {
                margin-bottom: 0;
            }

            :global(.templatequotecite) {
                margin-top: 0.5em;
                font-family: default-sans;
                font-size: 0.8em;
                color: var(--muted);
            }
        }

        /* references and notes: compact, muted, without the external-link markers */
        :global(ol.references) {
            font-size: 0.85rem;
            line-height: 1.55;
            color: color-mix(in oklch, var(--text-color) 80%, var(--page-bg));
            padding-left: 2em;

            :global(li) {
                margin-bottom: 0.5em;
            }

            :global(li::marker) {
                font-variant-numeric: tabular-nums;
            }

            :global(a.external::after) {
                display: none;
            }

            :global(.mw-cite-backlink),
            :global(.mw-cite-backlink a) {
                color: var(--muted);
                text-decoration: none;
            }

            :global(.mw-cite-backlink sup) {
                font-size: 0.75em;
            }
        }

        /* math */
        /* MathML kept for screen readers; the rendered formula is the fallback image beside it. */
        :global(.mwe-math-mathml-a11y) {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip-path: inset(50%);
        }

        :global(.mwe-math-fallback-image-inline) {
            display: inline-block;
            vertical-align: middle;
        }

        :global(.mwe-math-fallback-image-display) {
            display: block;
            margin: 1.25em auto;
            max-width: 100%;
            height: auto !important;
        }

        /* Wikipedia ships these template layouts as TemplateStyles, which Lemma strips. */
        :global(.sfrac) {
            white-space: nowrap;
        }

        :global(.sfrac .tion) {
            display: inline-block;
            vertical-align: -0.5em;
            margin: 0 0.1em;
            font-size: 85%;
            line-height: 1.2;
            text-align: center;
        }

        :global(.sfrac .num) {
            display: block;
            border-bottom: 1px solid;
        }

        :global(.sfrac .den) {
            display: block;
        }
    }

    @media (prefers-color-scheme: dark) {
        .article-body :global(img.mw-invert),
        .article-body :global(img.skin-invert),
        .wiki-images img.invert-dark {
            filter: invert(1) hue-rotate(180deg);
        }
    }

    /* ---------- hatnotes ("Main article: …", "For other uses, see …") ---------- */

    .block.hatnote {
        position: relative;
        margin: 0.25em 0 1.9em;
        padding-left: 1.35em;
        font-size: 0.88em;
        line-height: 1.5;
        color: var(--muted);
        /* an opening quote mustn't hang toward the arrow (the body text hangs its punctuation) */
        hanging-punctuation: none;

        /* a run of hatnotes reads as one group, set apart from the text that follows */
        &:has(+ .block.hatnote) {
            margin-bottom: 0.45em;
        }

        /* a small arrow marks it as a pointer elsewhere, not article text */
        &::before {
            content: "";
            position: absolute;
            left: 0;
            top: calc(0.5lh - 0.45em);
            width: 0.9em;
            height: 0.9em;
            background-color: currentColor;
            mask: var(--icon-corner-down-right) center / contain no-repeat;
            -webkit-mask: var(--icon-corner-down-right) center / contain no-repeat;
        }

        :global(div.hatnote) {
            font-style: normal;
            padding: 0;
            margin: 0;
        }

        :global(a) {
            color: var(--text-color);
        }
    }

    /* a heading's hatnote sits close under it */
    .article-body :is(h2, h3, h4, h5, h6) + .block.hatnote {
        margin-top: -0.1em;
    }

    /* ---------- audio, video and pronunciation ---------- */

    .block.media {
        margin: 1.75rem 0;

        :global(figure) {
            margin: 0;
        }

        :global(video) {
            display: block;
            width: 100%;
            max-height: 70dvh;
            border-radius: 10px;
            background: black;
            box-shadow: 0 10px 30px -14px var(--shadow-color);
        }

        :global(audio) {
            display: block;
            width: 100%;
            height: 40px;
            accent-color: var(--accent);
        }

        :global(figcaption) {
            margin-top: 0.6rem;
            font-size: 0.8rem;
            line-height: 1.5;
            text-align: center;
            color: var(--muted);
        }

        :global(.media-audio) {
            padding: 0.75rem 0.85rem;
            border: 1px solid var(--rule);
            border-radius: 12px;
            background: color-mix(in oklch, var(--secondary) 14%, var(--bg-color));
        }

        :global(.media-audio figcaption) {
            margin-top: 0.5rem;
            text-align: left;
        }
    }

    .article-body :global(button.pronounce) {
        display: inline-grid;
        place-items: center;
        width: 1.4em;
        height: 1.4em;
        margin: 0 0.1em;
        padding: 0;
        /* centred on the text's height (its middle level with the middle of the letters beside it) */
        vertical-align: -0.06em;
        border: 1px solid var(--rule);
        border-radius: 50%;
        background: var(--bg-color);
        color: var(--muted);
        cursor: pointer;
        transition:
            color var(--dur-fast),
            border-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &::before {
            content: "";
            width: 0.8em;
            height: 0.8em;
            background-color: currentColor;
            mask: var(--icon-volume) center / contain no-repeat;
            -webkit-mask: var(--icon-volume) center / contain no-repeat;
        }

    }

    .article-body :global(button.pronounce:hover),
    .article-body :global(button.pronounce.playing) {
        color: var(--accent);
        border-color: color-mix(in oklch, var(--accent) 50%, var(--rule));
    }

    .article-body :global(button.pronounce.playing::before) {
        animation: pronounce-pulse 0.9s ease-in-out infinite;
    }

    @keyframes pronounce-pulse {
        50% {
            opacity: 0.45;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .article-body :global(button.pronounce.playing::before) {
            animation: none;
        }
    }

    /* ---------- unwrapped layout tables, legacy frames ---------- */

    /* columns of links (e.g. "See also" in two columns) flow as one list on narrow screens */
    .article-body :global(.layout-columns) {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
        column-gap: 1.5rem;
    }

    .block.figure {
        display: flex;
        justify-content: center;
        margin: 1.75rem 0;

        :global(.thumbinner) {
            display: flex;
            flex-direction: column;
            align-items: center;
            max-width: 100%;
            overflow-x: auto;
        }

        :global(.thumbcaption) {
            max-width: 52ch;
            margin-top: 0.6rem;
            font-size: 0.8rem;
            line-height: 1.5;
            text-align: center;
            color: var(--muted);
        }
    }

    /* ---------- sortable and collapsible tables ---------- */

    .article-body :global(.sort-button) {
        display: inline-flex;
        align-items: center;
        gap: 0.3em;
        padding: 0;
        border: none;
        background: none;
        font: inherit;
        font-weight: inherit;
        text-align: inherit;
        color: inherit;
        cursor: pointer;

        /* a faint up/down pair until the column is sorted, then one direction in the accent colour */
        &::after {
            content: "";
            flex: none;
            width: 0.75em;
            height: 0.75em;
            background-color: var(--muted);
            mask: var(--icon-chevron-right) center / contain no-repeat;
            -webkit-mask: var(--icon-chevron-right) center / contain no-repeat;
            rotate: 90deg;
            transition:
                rotate var(--dur-base) var(--ease-out),
                background-color var(--dur-base) var(--ease-out);
        }

        &:hover::after {
            background-color: var(--text-color);
        }
    }

    .article-body :global(th[aria-sort="ascending"] .sort-button::after) {
        rotate: -90deg;
        background-color: var(--accent);
    }

    .article-body :global(th[aria-sort="descending"] .sort-button::after) {
        rotate: 90deg;
        background-color: var(--accent);
    }

    .article-body :global(.collapse-toggle) {
        float: right;
        margin-left: 0.75em;
        padding: 0.05em 0.6em;
        border: 1px solid var(--rule);
        border-radius: 999px;
        background: var(--bg-color);
        font: inherit;
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1.6;
        color: var(--muted);
        cursor: pointer;
        transition:
            color var(--dur-fast),
            border-color var(--dur-fast);

        &:hover {
            color: var(--text-color);
            border-color: var(--secondary);
        }
    }

    /* ---------- lists inside image captions ---------- */

    /*
     * Captions are centred, but a list in one (e.g. a map's numbered key) reads badly centred line by line: its
     * numbers stay at the left while each label drifts. Centre the list as one block instead, text left-aligned
     * beside its numbers. (Covers standalone images and the fan's grid, which both render inside .article-body.)
     */
    .article-body :global(figcaption :is(ul, ol)) {
        margin: 0.3em 0 0;
        padding-left: 1.5em;
        text-align: left;
    }

    /* top-level lists shrink-wrap and sit centred; Wikipedia's inline left margin would pin them left */
    .article-body :global(figcaption :is(ul, ol):not(li *)) {
        display: table;
        margin-inline: auto !important;
    }

    .article-body :global(figcaption li) {
        margin: 0.1em 0 0;
        padding-left: 0.15em;
    }

    .article-body :global(figcaption li :is(ul, ol)) {
        margin-top: 0.1em;
        padding-left: 1.3em;
    }

    /* ---------- small icons and portal links ---------- */

    /* flags, portal and sister-project logos inside text (tagged by the parser) */
    .article-body :global(img.inline-icon) {
        display: inline-block;
        width: auto;
        max-height: 1.35em;
        vertical-align: -0.25em;
        margin-inline-end: 0.35em;
        border-radius: 2px;
    }

    /* "See also" portal box: a row of chips, each icon in the same-sized slot */
    .article-body :global(ul.portalbox) {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 0;
        list-style: none;
    }

    .article-body :global(li.portalbox-entry) {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        margin: 0;
        padding: 0.35rem 0.9rem 0.35rem 0.45rem;
        border: 1px solid var(--rule);
        border-radius: 999px;
        background: color-mix(in oklch, var(--secondary) 18%, transparent);
        font-size: 0.9em;
        line-height: 1.3;
        transition:
            border-color var(--dur-fast),
            background-color var(--dur-fast);

        &:hover {
            border-color: color-mix(in oklch, var(--accent) 45%, var(--rule));
            background: color-mix(in oklch, var(--accent) 8%, transparent);
        }

        &:has(a:focus-visible) {
            outline: 2px solid var(--accent);
            outline-offset: 2px;
        }
    }

    .article-body :global(.portalbox-image) {
        display: grid;
        place-items: center;
        flex: none;
        width: 1.6rem;
        height: 1.6rem;

        :global(img) {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            margin: 0;
            vertical-align: 0;
            object-fit: contain;
        }
    }

    .article-body :global(.portalbox-link a) {
        font-weight: 550;
        text-decoration: none;

        /* the whole chip is the link */
        &::after {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
        }

        &:focus-visible {
            outline: none;
        }
    }

    /* ---------- block spacing ---------- */

    .block {
        margin: 0 0 1.15em;

        /* the standfirst is set apart from the article below by a rule, with equal space on either side */
        &.lead {
            margin-bottom: 2em;
            padding-bottom: 2em;
            border-bottom: 1px solid var(--rule);

            > :global(:last-child) {
                margin-bottom: 0;
            }
        }

        &.quote {
            margin: 1.75em 0;
        }

        &.images {
            margin: 2.25rem 0;
        }
    }

    /* anchored under .article-body so it outranks the element rules above (p, ul, blockquote…) */
    .article-body .block > :global(*) {
        margin-block: 0;
    }

    /* Whatever comes just before a section rule leaves the spacing to the heading, so the gap above the rule is the
       same after a paragraph, a picture or a table; and nothing pads the very top of the article. */
    .article-body > :global(:has(+ h2)) {
        margin-bottom: 0 !important;
    }

    .article-body > :global(:first-child) {
        margin-top: 0 !important;
    }

    /* ---------- headings ---------- */

    .article-body :global(:is(h1, h2, h3, h4, h5, h6)) {
        position: relative;
        margin: 2em 0 0.6em;
        line-height: 1.25;
        text-wrap: balance;
    }

    .article-body :global(h2) {
        margin-top: 3.25rem;
        font-size: 1.85rem;
        font-weight: 550;
        letter-spacing: -0.005em;
    }

    /* Where the back matter begins, a rule: the h2's top border, with the same space above it (to the text before)
       as below it (to the heading's text). */
    .article-body :global(h2.divided) {
        --rule-gap: 2.25rem;
        margin-top: var(--rule-gap);
        padding-top: var(--rule-gap);
        border-top: 1px solid var(--rule);
    }

    /* The rule is the h2's own border: flash only the heading text below it, not the rule and padding. */
    .article-body :global(h2.divided.jump-flash) {
        isolation: isolate;
        border-radius: 0;
        animation: none;

        &::before {
            content: "";
            position: absolute;
            inset: calc(var(--rule-gap) + 1px) 0 0;
            z-index: -1;
            border-radius: 4px;
            animation: jump-flash 1.6s var(--ease-out);
        }
    }

    .article-body :global(h3) {
        margin-top: 2em;
        font-size: 1.4rem;
        font-weight: 550;
    }

    .article-body :global(h4) {
        margin-top: 1.75em;
        font-size: 1.15rem;
        font-weight: 600;
    }

    .article-body :global(:is(h5, h6)) {
        margin-top: 1.5em;
        font-family: default-sans;
        font-size: 0.8rem;
        font-weight: 650;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
    }

    /* A heading followed directly by its subsection shouldn't leave a gap between them. */
    .article-body :global(:is(h2, h3, h4) + :is(h3, h4, h5, h6)) {
        margin-top: 0.75em;
    }

    .chev {
        position: absolute;
        left: -2rem;
        /* centred on the heading's last line, whatever padding the heading has */
        bottom: calc((1.25em - 1.5rem) / 2);
        display: grid;
        place-items: center;
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: none;
        color: var(--muted);
        cursor: pointer;
        transition:
            color var(--dur-base) var(--ease-out),
            background-color var(--dur-base) var(--ease-out),
            scale var(--dur-instant) var(--ease-out);

        /* hover-capable pointers only: a tap would leave the background stuck on */
        @media (hover: hover) {
            &:hover {
                color: var(--text-color);
                background: color-mix(in oklch, var(--secondary) 40%, transparent);
            }
        }

        /* no margin to sit in: it moves to the heading's right edge */
        @media (max-width: 1050px) {
            left: auto;
            right: 0;
        }
    }

    .copy-section {
        position: absolute;
        right: 0;
        bottom: calc((1.25em - 1.6rem) / 2);
        display: grid;
        place-items: center;
        width: 1.6rem;
        height: 1.6rem;
        padding: 0;
        border: none;
        border-radius: 7px;
        background: none;
        font-size: 1rem;
        color: var(--muted);
        cursor: pointer;
        opacity: 0;
        transition:
            opacity var(--dur-base) var(--ease-out),
            color var(--dur-base) var(--ease-out),
            background-color var(--dur-base) var(--ease-out),
            scale var(--dur-instant) var(--ease-out);

        @media (hover: hover) {
            &:hover {
                color: var(--text-color);
                background: color-mix(in oklch, var(--secondary) 40%, transparent);
            }
        }

        @media (hover: none) {
            opacity: 0.6;
        }

        /* narrow screens: the fold button has the right edge, so the link sits just after the heading's text, like an
           anchor mark */
        @media (max-width: 1050px) {
            position: relative;
            right: auto;
            bottom: auto;
            display: inline-grid;
            vertical-align: middle;
            margin: -0.2em 0 0 0.3rem;
        }
    }

    @media (max-width: 1050px) {
        /* clear of the fold button at the right edge */
        .article-body :global(.section-heading) {
            padding-right: 2.25rem;
        }
    }

    [data-heading]:hover .copy-section,
    .copy-section:focus-visible,
    .copy-section.copied {
        opacity: 1;
    }

    .copy-section.copied {
        color: var(--accent);
    }

    /* the old and new icons share one cell, so they cross over in place */
    .copy-icon {
        display: grid;

        > :global(*) {
            grid-area: 1 / 1;
            display: grid;
            place-items: center;
        }
    }

    /* "Copied", just left of the button's icon */
    .copy-note {
        position: absolute;
        right: 1.6rem;
        bottom: calc((1.25em - 1.6rem) / 2);
        display: flex;
        align-items: center;
        height: 1.6rem;
        font-family: default-sans;
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: normal;
        text-transform: none;
        white-space: nowrap;
        color: var(--accent);
        pointer-events: none;

        /* wide screens: the tick alone says it */
        @media (min-width: 1051px) {
            display: none;
        }

        /* narrow screens: inline, just after the link button */
        @media (max-width: 1050px) {
            position: static;
            display: inline-flex;
            vertical-align: middle;
            margin: -0.2em 0 0 0;
        }
    }

    /* ---------- works cited, sources, bibliography ---------- */

    /* compact like the reference list: each work as a hanging-indented entry, its links quiet until hovered */
    .block.bibliography {
        font-size: 0.85rem;
        line-height: 1.55;
        color: color-mix(in oklch, var(--text-color) 80%, var(--page-bg));

        :global(ul),
        :global(ol) {
            margin: 0;
            padding: 0;
            list-style: none;
        }

        > :global(ul > li),
        > :global(ol > li) {
            margin: 0 0 0.6em;
            padding-left: 1.5em;
            text-indent: -1.5em;
            text-wrap: pretty;
        }

        :global(a) {
            color: inherit;
            text-decoration-color: transparent;
        }

        :global(a:hover) {
            color: var(--link-hover);
            text-decoration-color: currentColor;
        }

        /* the work's title (italic) leads; identifiers trail off */
        :global(cite i) {
            color: var(--text-color);
        }

        :global(a.external::after) {
            display: none;
        }
    }

    /* ---------- figures ---------- */

    /*
     * Images take their final size before they load (from Wikipedia's width/height), so the page never jumps as they
     * arrive: as wide as fits, no taller than the height cap, never stretched past the file's own pixels. The size is
     * set on the image's button (the image fills it), since a percentage width on the image itself would depend on
     * the button's, which depends on the image.
     */
    /* (a class rather than a :has() rule: Safari would re-check that on every style change in the article) */
    .wiki-images figure.sized {
        width: 100%;
    }

    .wiki-images .zoomable[style*="--ar"] {
        width: min(100%, var(--max-w, 100%), calc(min(28rem, 65dvh) * var(--ar)));

        img {
            width: 100%;
            height: auto;
            aspect-ratio: var(--ar);
        }
    }

    .wiki-images {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 1.25rem;
        margin: 2.25rem 0;

        figure {
            margin: 0;
            max-width: 100%;
        }

        img {
            display: block;
            max-width: 100%;
            /* a single photo shouldn't take over the screen */
            max-height: min(28rem, 65dvh);
            width: auto;
            height: auto;
            margin-inline: auto;
            object-fit: contain;
            border-radius: 8px;
            outline: 1px solid color-mix(in oklch, var(--text-color) 8%, transparent);
            outline-offset: -1px;
            box-shadow: 0 10px 30px -14px var(--shadow-color);
        }

        figcaption {
            max-width: 52ch;
            margin: 0.75rem auto 0;
            font-size: 0.8rem;
            line-height: 1.5;
            text-align: center;
            text-wrap: pretty;
            color: var(--muted);

            :global(a) {
                text-decoration-color: color-mix(in oklch, currentColor 35%, transparent);
            }
        }
    }

    .zoomable {
        display: block;
        max-width: 100%;
        margin-inline: auto;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: none;
        cursor: zoom-in;
    }

    /* on hover it grows a touch, in place */
    .wiki-images .zoomable img {
        transition:
            transform var(--dur-slow) var(--ease-out),
            box-shadow var(--dur-slow) var(--ease-out);
    }

    @media (hover: hover) {
        .wiki-images .zoomable:is(:hover, :focus-visible) img {
            transform: scale(1.02);
            box-shadow: 0 16px 36px -16px var(--shadow-color);
        }
    }

    /* ---------- tables ---------- */

    .table-scroll {
        width: fit-content;
        max-width: 100%;
        margin: 2rem auto;
        overflow-x: auto;
        border: 1px solid var(--rule);
        border-radius: 10px;
        /* edge shadows appear only while there's more table to scroll to */
        background:
            linear-gradient(to right, var(--page-bg) 30%, transparent) left / 2.5rem 100% no-repeat local,
            linear-gradient(to left, var(--page-bg) 30%, transparent) right / 2.5rem 100% no-repeat local,
            radial-gradient(farthest-side at 0 50%, var(--shadow-color), transparent) left / 0.9rem 100% no-repeat scroll,
            radial-gradient(farthest-side at 100% 50%, var(--shadow-color), transparent) right / 0.9rem 100% no-repeat
                scroll;

        :global(table) {
            margin: 0 !important;
            /* Wikipedia floats small tables (e.g. a historical population) to the side; here they sit in the column.
               A float inside the scroller would hang off its left edge, out of reach of scrolling. */
            float: none !important;
            /* small tables (a few narrow columns) shouldn't read as a sliver down the page */
            min-width: min(20rem, calc(100vw - 3rem));
            border-collapse: collapse;
            font-size: 0.85rem;
            line-height: 1.45;
            font-variant-numeric: lining-nums tabular-nums;
        }

        /* Tables take the width their content needs (up to the column, then they scroll). Wikipedia's own widths don't
           fit here: fixed ones (15em) were sized for its smaller text, and percentages ("70%") would be a share of this
           wrapper, which itself shrinks to the table, leaving an empty strip beside it. */
        :global(table:is([width], [style*="width:"], [style*="width :"], [style*="width: "])) {
            width: auto !important;
        }

        :global(caption) {
            padding: 0.7rem 0.85rem 0.6rem;
            font-weight: 600;
            text-align: left;
            border-bottom: 1px solid var(--rule);
        }

        :global(:is(th, td)) {
            padding: 0.45rem 0.7rem;
            border: 1px solid var(--rule);
            vertical-align: top;
        }

        /* the wrapper draws the outer frame */
        :global(tr > :first-child) {
            border-left: none;
        }

        :global(tr > :last-child) {
            border-right: none;
        }

        :global(tr:first-child > *) {
            border-top: none;
        }

        :global(tr:last-child > *) {
            border-bottom: none;
        }

        :global(th) {
            background: color-mix(in oklch, var(--secondary) 30%, transparent);
            font-weight: 600;
            text-align: left;
        }

        :global(p) {
            margin: 0;
        }

        /* rules inside a cell: a thin full-width divider, not a heavy bar */
        :global(td hr),
        :global(th hr) {
            height: 0;
            margin: 0.45rem 0;
            border: none;
            border-top: 1px solid var(--rule);
        }

        /* lists and definitions inside cells sit flush, without the page's indents */
        :global(:is(td, th) :is(ul, ol)) {
            margin: 0.2rem 0;
            padding-left: 1.1em;
        }

        :global(:is(td, th) dl) {
            margin: 0;
        }

        :global(:is(td, th) dd) {
            margin: 0 0 0.2rem;
        }
    }

    /* Glaring cell colours (pure blues and reds: club and party colours) calm to the same hue, less saturated. */
    .article-body :global([style*="--light-bg"]:not(.legend-color, .legend-color *)) {
        background: var(--light-bg) !important;
    }

    /*
     * Dark mode: Wikipedia's light cell colours swap for their dark counterparts (--dark-bg, worked out when the article
     * is parsed: same hue, darker; whites become the card colour), and the text on them follows the page's palette.
     * Legend swatches keep their real colour: they're a key, not a background.
     */
    @media (prefers-color-scheme: dark) {
        .article-body :global([style*="--dark-bg"]:not(.legend-color, .legend-color *)) {
            background: var(--dark-bg) !important;
            color: var(--text-color) !important;
        }

        .article-body :global([style*="--dark-bg"]:not(.legend-color) a) {
            color: inherit !important;
        }

        /* anything coloured that couldn't be converted (gradients, images) keeps dark text, so it stays legible */
        .article-body
            :global(
                :is([bgcolor], [style*="background"]):not([style*="--dark-bg"], [style*="var(--"], [style*="transparent"], [style*="background:none"], [style*="background: none"], [style*="inherit"])
            ) {
            color: oklch(0.25 0.02 var(--hue));
        }
    }
</style>
