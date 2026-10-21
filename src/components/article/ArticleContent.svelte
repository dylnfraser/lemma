<script lang="ts">
    import { isBlockHiddenByCollapsed } from "$lib/article/articleNavigation";
    import { isFoldableHeadingLevel } from "$lib/article/articleUtils";
    import type { ArticleBlock } from "$lib/article/types";
    import { fold } from "$lib/motion";
    import ChevronIcon from "../icons/ChevronIcon.svelte";
    import ImageFan from "./ImageFan.svelte";

    interface Props {
        blocks: ArticleBlock[];
        collapsedSectionIds: ReadonlySet<string>;
        onToggleSection: (id: string) => void;
        onclick?: (event: MouseEvent) => void;
    }

    let { blocks, collapsedSectionIds, onToggleSection, onclick }: Props = $props();

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

    function copyLabel(id: string) {
        if (copyStatus?.id !== id) return "#";
        return copyStatus.ok ? "Copied!" : "Copy failed";
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (delegates clicks on in-article links) -->
<div class="article-body" {onclick}>
    {#each blocks as block, i (i)}
        {#if !isBlockHiddenByCollapsed(block, collapsedSectionIds)}
            {#if block.type === "heading"}
                {@const heading = block.heading}
                {@const collapsed = collapsedSectionIds.has(heading.id)}
                <svelte:element this={heading.tag.toLowerCase()} id={heading.id} data-heading transition:fold>
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
                        class:copied={copyStatus?.id === heading.id}
                        type="button"
                        aria-label={`Copy link to ${heading.text}`}
                        title="Copy link to section"
                        onclick={() => copySectionLink(heading.id)}
                    >
                        {copyLabel(heading.id)}
                    </button>
                </svelte:element>
            {:else if block.type === "images" && block.images.length > 1}
                <div class="block images" transition:fold>
                    <ImageFan images={block.images} />
                </div>
            {:else if block.type === "images"}
                {@const image = block.images[0]}
                <div class="wiki-images" transition:fold>
                    <figure>
                        <img
                            alt={image.alt}
                            src={image.src}
                            width={image.width}
                            height={image.height}
                            class:invert-dark={image.invertInDarkMode}
                            loading="lazy"
                            decoding="async"
                        />
                        {#if image.caption}
                            <figcaption>{@html image.caption}</figcaption>
                        {/if}
                    </figure>
                </div>
            {:else if block.kind === "table"}
                <div class="table-scroll" transition:fold>{@html block.html}</div>
            {:else}
                <!-- spacing lives on this wrapper (not the HTML inside) so folding never jumps by a collapsed margin -->
                <div class="block {block.kind}" class:lead={i === leadIndex} transition:fold>{@html block.html}</div>
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
        font-size: 1.0625rem;
        line-height: var(--leading);
        font-variant-numeric: oldstyle-nums proportional-nums;
        hanging-punctuation: first;
        /* Long unbroken runs (digit sequences, URLs) must wrap rather than widen the page on phones. */
        overflow-wrap: break-word;

        /* Templates like {{gaps}} nest no-wrap digit groups inside a no-wrap run; let the run break between groups. */
        :global(:is(.nowrap, [style*="white-space:nowrap"], [style*="white-space: nowrap"]):has(:is(.nowrap, [style*="white-space:nowrap"], [style*="white-space: nowrap"]))) {
            white-space: normal !important;
        }

        :global([id]) {
            scroll-margin-top: calc(var(--nav-height) + 1.5rem);
        }

        /* jumping to a citation or section briefly lights it up, then fades */
        :global(.jump-flash) {
            border-radius: 4px;
            animation: jump-flash 1.6s var(--ease-out);
        }

        :global(p) {
            margin: 0 0 1.15em;
        }

        /* On wider screens the opening paragraph reads as a standfirst. */
        @media (min-width: 640px) {
            .lead :global(p) {
                font-size: 1.1em;
                line-height: 1.65;
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
            text-decoration-color: color-mix(in oklch, currentColor 28%, transparent);
            text-underline-offset: 0.22em;
            transition:
                color var(--dur-fast),
                text-decoration-color var(--dur-fast);
        }

        :global(a:hover) {
            color: var(--link-hover);
            text-decoration-color: currentColor;
        }

        :global(a.external::after) {
            content: "↗";
            display: inline-block;
            margin-left: 0.12em;
            font-size: 0.7em;
            color: var(--muted);
            text-decoration: none;
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

        :global(sup.reference + sup.reference::before) {
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

    /* ---------- block spacing ---------- */

    .block {
        margin: 0 0 1.15em;

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

    /* ---------- headings ---------- */

    .article-body :global(:is(h1, h2, h3, h4, h5, h6)) {
        position: relative;
        margin: 2em 0 0.6em;
        line-height: 1.25;
        text-wrap: balance;
    }

    .article-body :global(h2) {
        margin-top: 2.1em;
        padding-top: 1em;
        border-top: 1px solid var(--rule);
        font-size: 1.85rem;
        font-weight: 550;
        letter-spacing: -0.005em;
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
        opacity: 0.6;
        transition:
            opacity var(--dur-fast),
            background-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &:hover {
            opacity: 1;
            background: color-mix(in oklch, var(--secondary) 40%, transparent);
        }

        @media (max-width: 1050px) {
            left: auto;
            right: 1.75rem;
        }
    }

    .copy-section {
        position: absolute;
        right: 0;
        bottom: calc((1.25em - 1.4rem) / 2);
        height: 1.4rem;
        padding: 0 0.35rem;
        border: none;
        border-radius: 6px;
        background: none;
        font-family: default-sans;
        font-size: 0.8rem;
        font-weight: 500;
        letter-spacing: normal;
        text-transform: none;
        color: var(--muted);
        cursor: pointer;
        opacity: 0;
        transition:
            opacity var(--dur-fast) ease,
            background-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &:hover {
            background: color-mix(in oklch, var(--secondary) 40%, transparent);
        }

        @media (hover: none) {
            opacity: 0.5;
        }
    }

    [data-heading]:hover .copy-section,
    .copy-section:focus-visible,
    .copy-section.copied {
        opacity: 1;
    }

    .copy-section.copied {
        color: var(--accent);

        animation: copy-confirm 0.2s ease-in;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    @keyframes -global-jump-flash {
        from,
        15% {
            background-color: color-mix(in oklch, var(--accent) 22%, transparent);
            box-shadow: 0 0 0 4px color-mix(in oklch, var(--accent) 22%, transparent);
        }

        to {
            background-color: transparent;
            box-shadow: 0 0 0 4px transparent;
        }
    }

    @keyframes copy-confirm {
        from {
            opacity: 0;
            filter: blur(2px);
        }
    }

    /* ---------- figures ---------- */

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
            border-collapse: collapse;
            font-size: 0.85rem;
            line-height: 1.45;
            font-variant-numeric: lining-nums tabular-nums;
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
    }

    /* Wikipedia's coloured cells and swatches assume dark text; keep them legible in dark mode. */
    @media (prefers-color-scheme: dark) {
        .article-body
            :global(
                :is([bgcolor], [style*="background"]):not([style*="transparent"], [style*="background:none"], [style*="background: none"], [style*="inherit"])
            ),
        .article-body
            :global(
                :is([bgcolor], [style*="background"]):not([style*="transparent"], [style*="background:none"], [style*="background: none"], [style*="inherit"])
                    a
            ) {
            color: oklch(0.25 0.02 var(--hue));
        }
    }

    /* ---------- galleries ---------- */

    .article-body :global(ul.gallery) {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(11rem, 100%), 1fr));
        gap: 1.25rem;
        margin: 2rem 0;
        padding: 0;
    }

    .article-body :global(li.gallerybox) {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        width: auto !important;
        margin: 0 !important;
        padding: 0;
        list-style: none;
        line-height: 1.4;
    }

    .article-body :global(li.gallerybox .thumb),
    .article-body :global(li.gallerybox .thumbinner),
    .article-body :global(li.gallerybox figure) {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        background: none !important;
    }

    .article-body :global(li.gallerybox img) {
        display: block;
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        border-radius: 8px;
        outline: 1px solid color-mix(in oklch, var(--text-color) 8%, transparent);
        outline-offset: -1px;
    }

    .article-body :global(li.gallerybox .gallerytext),
    .article-body :global(li.gallerybox .thumbcaption) {
        padding: 0 !important;
        margin-top: 0.5rem;
        min-height: 2rem;
        text-align: center;
        font-size: 0.75rem;
        line-height: 1.4;
        color: var(--muted);
        text-wrap: pretty;
    }

    .article-body :global(li.gallerybox p) {
        margin: 0;
    }
</style>
