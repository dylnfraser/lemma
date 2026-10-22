<script lang="ts">
    import { tick } from "svelte";
    import { fetchLastEdited } from "$lib/api/wikipedia";
    import { CITATION_STYLES, formatCitation, type CitationStyle } from "$lib/citation";
    import { isKeyboardClick } from "$lib/focus";
    import { library } from "$lib/library.svelte";
    import { DURATION, EASE_OUT, fold, motion, pop } from "$lib/motion";
    import type { SpokenAudio } from "$lib/article/types";
    import type { Snippet } from "svelte";
    import { slidingTabs } from "$lib/slidingTabs";
    import Icon from "../icons/Icon.svelte";

    // The row of things to do with an article: keep it, listen to it, cite it, print it.
    interface Props {
        title: string;
        description: string;
        thumbnail: string;
        spoken: SpokenAudio | null;
        revisionId: number | null;
        /** More pills for the end of the row (the article's languages, its place on a map). */
        children?: Snippet;
    }

    let { title, description, thumbnail, spoken, revisionId, children }: Props = $props();

    const uid = $props.id();

    // ---------- save ----------

    let saved = $derived(library.isSaved(title));
    // only animate the bookmark when the reader toggles it, not when the page loads already saved
    let justSaved = $state(false);

    function toggleSaved() {
        justSaved = library.toggleSaved({ title, description, thumbnail });
    }

    // ---------- listen ----------

    let listening = $state(false);
    let player = $state<HTMLAudioElement>();

    async function toggleListening() {
        listening = !listening;
        if (listening) {
            await tick();
            player?.play().catch(() => {});
        }
    }

    // ---------- cite ----------

    let citeOpen = $state(false);
    let style = $state<CitationStyle>("APA");
    let citePanel = $state<HTMLElement>();

    /** Switches citation style; the panel eases to the new citation's height rather than snapping. */
    async function selectStyle(next: CitationStyle) {
        if (next === style) return;
        const panel = citePanel;
        const duration = motion(DURATION.base);
        if (!panel || !duration) {
            style = next;
            copied = false;
            return;
        }
        // measure the panel before and after the new citation renders, then ease from one height to the other
        const from = panel.offsetHeight;
        style = next;
        copied = false;
        await tick();
        const to = panel.offsetHeight;
        if (from !== to) panel.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration, easing: EASE_OUT });
    }
    let revised = $state<Date | null>(null);
    let copied = $state(false);
    let copyTimer: ReturnType<typeof setTimeout>;
    let citeRoot = $state<HTMLElement>();
    let citeText = $state<HTMLElement>();
    const accessed = new Date();

    let citation = $derived(formatCitation(style, { title, revisionId, revised, accessed }));

    async function toggleCite(event: MouseEvent) {
        citeOpen = !citeOpen;
        copied = false;
        if (!citeOpen) return;
        if (!revised) fetchLastEdited(title).then((date) => (revised = date));
        if (isKeyboardClick(event)) {
            await tick();
            citeRoot?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus();
        }
    }

    async function copyCitation() {
        try {
            await navigator.clipboard.writeText(citation);
            copied = true;
        } catch {
            // no clipboard access: select the text so it can be copied by hand
            const range = document.createRange();
            if (citeText) range.selectNodeContents(citeText);
            getSelection()?.removeAllRanges();
            getSelection()?.addRange(range);
        }
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => (copied = false), 1800);
    }

    function handleTabKeydown(event: KeyboardEvent) {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const index = CITATION_STYLES.indexOf(style);
        const next = (index + (event.key === "ArrowRight" ? 1 : -1) + CITATION_STYLES.length) % CITATION_STYLES.length;
        selectStyle(CITATION_STYLES[next]);
        citeRoot?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }

    function handleWindowPointerDown(event: PointerEvent) {
        if (citeOpen && citeRoot && !citeRoot.contains(event.target as Node)) citeOpen = false;
    }

    function handleWindowKeydown(event: KeyboardEvent) {
        if (citeOpen && event.key === "Escape") {
            citeOpen = false;
            citeRoot?.querySelector<HTMLButtonElement>(".cite-toggle")?.focus();
        }
    }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeydown} />

<div class="actions">
    <button type="button" class="action-pill save" class:saved class:pop={justSaved && saved} aria-pressed={saved} onclick={toggleSaved}>
        <span class="save-icon"><Icon name={saved ? "bookmark-filled" : "bookmark"} size="0.95em" /></span>
        <!-- both labels share one cell, so the button keeps one width; they cross over through a blur -->
        <span class="label-swap">
            <span class:off={saved} aria-hidden={saved}>Save</span>
            <span class:off={!saved} aria-hidden={!saved}>Saved</span>
        </span>
    </button>

    {#if spoken}
        <button type="button" class="action-pill" aria-expanded={listening} aria-controls="{uid}-listen" onclick={toggleListening}>
            <Icon name="headphones" size="0.95em" />
            Listen{#if spoken.minutes}<span class="detail">{spoken.minutes} min</span>{/if}
        </button>
    {/if}

    <span class="cite" bind:this={citeRoot}>
        <button type="button" class="action-pill cite-toggle" aria-expanded={citeOpen} aria-controls="{uid}-cite" onclick={toggleCite}>
            <Icon name="quote" size="0.9em" />
            Cite
        </button>

        {#if citeOpen}
            <div
                class="cite-panel"
                bind:this={citePanel}
                id="{uid}-cite"
                role="dialog"
                aria-label="Cite this page"
                transition:pop
            >
                <div class="tabs" role="tablist" use:slidingTabs={style} aria-label="Citation style">
                    {#each CITATION_STYLES as option}
                        <button
                            type="button"
                            role="tab"
                            aria-selected={style === option}
                            tabindex={style === option ? 0 : -1}
                            onclick={() => selectStyle(option)}
                            onkeydown={handleTabKeydown}>{option}</button
                        >
                    {/each}
                </div>
                <div role="tabpanel" aria-label="{style} citation">
                    <pre class="cite-text" class:code={style === "BibTeX"} bind:this={citeText}>{citation}</pre>
                </div>
                <div class="cite-footer">
                    <span class="note">{revisionId ? "Links to the exact version you're reading" : "Links to the live article"}</span>
                    <button type="button" class="copy" class:copied onclick={copyCitation}>
                        <span class="copy-icon"><Icon name={copied ? "check" : "copy"} size="0.85em" /></span>
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>
            </div>
        {/if}
    </span>

    <button type="button" class="action-pill print" onclick={() => window.print()}>
        <Icon name="printer" size="0.9em" />
        Print
    </button>

    {@render children?.()}
</div>

{#if spoken && listening}
    <div class="listen" id="{uid}-listen" transition:fold>
        <!-- svelte-ignore a11y_media_has_caption (Spoken Wikipedia recordings have no caption files) -->
        <audio bind:this={player} controls preload="none">
            {#each spoken.sources as source}
                <source src={source.src} type={source.type} />
            {/each}
        </audio>
        <p class="recorded">
            A volunteer's reading from <a href="https://en.wikipedia.org/wiki/Wikipedia:Spoken_articles" target="_blank" rel="noopener noreferrer"
                >Spoken Wikipedia</a
            >{#if spoken.recorded}, recorded from the article as it was on {spoken.recorded}; it may not match the text below{/if}.
        </p>
    </div>
{/if}

<p class="sr-only" role="status">{copied ? "Citation copied" : ""}</p>

<style>
    .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-top: 1rem;
    }

    .detail {
        margin-left: 0.15rem;
        font-weight: 450;
        color: var(--muted);
    }

    .label-swap {
        display: grid;

        > span {
            grid-area: 1 / 1;
            transition:
                opacity var(--dur-base) var(--ease-out),
                filter var(--dur-base) var(--ease-out);
        }

        > .off {
            opacity: 0;
            filter: blur(var(--blur));
        }
    }

    .save-icon {
        display: inline-flex;
    }

    .save.saved {
        color: var(--accent);
        border-color: color-mix(in oklch, var(--accent) 40%, var(--rule));
        background: color-mix(in oklch, var(--accent) 7%, var(--bg-color));
    }

    /* the bookmark drops in when saved */
    .save.pop .save-icon {
        animation: bookmark-pop var(--dur-slow) var(--ease-spring);

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    @keyframes bookmark-pop {
        0% {
            scale: 0.6;
            translate: 0 -3px;
        }
        60% {
            scale: 1.2;
        }
    }

    /* ---------- cite ---------- */

    .cite {
        position: relative;
    }

    .cite-panel {
        position: absolute;
        /* clips the citation while the panel eases between heights (border-box, so those heights include the padding) */
        overflow: hidden;
        box-sizing: border-box;
        z-index: 15;
        top: calc(100% + 0.5rem);
        left: 0;
        width: min(30rem, calc(100vw - 2.5rem));
        padding: 0.6rem;
        border: 1px solid var(--rule);
        border-radius: 12px;
        background: var(--bg-color);
        box-shadow: 0 18px 40px -18px var(--shadow-color);
        transform-origin: 1.5rem 0;
        color: var(--text-color);

        @media (max-width: 600px) {
            position: fixed;
            /* above the floating Sections button */
            z-index: 35;
            top: auto;
            bottom: 1rem;
            left: 1.25rem;
            transform-origin: 50% 100%;
        }
    }

    .tabs {
        position: relative;
        --tab-radius: 7px;
        display: flex;
        gap: 0.2rem;
        padding: 0.2rem;
        border-radius: 9px;
        background: color-mix(in oklch, var(--secondary) 30%, var(--bg-color));

        button {
            flex: 1;
            padding: 0.3rem 0;
            border: none;
            border-radius: 7px;
            background: none;
            font: inherit;
            font-size: 0.78rem;
            font-weight: 550;
            color: var(--muted);
            cursor: pointer;
            /* above the sliding highlight */
            position: relative;
            z-index: 1;
            transition: color var(--dur-base) var(--ease-out);

            &:hover,
            &[aria-selected="true"] {
                color: var(--text-color);
            }
        }
    }

    .cite-text {
        margin: 0.6rem 0 0;
        padding: 0.7rem 0.8rem;
        max-height: 12rem;
        overflow: auto;
        border-radius: 8px;
        background: var(--page-bg);
        font-family: inherit;
        font-size: 0.82rem;
        line-height: 1.55;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        user-select: all;

        &.code {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 0.74rem;
        }
    }

    .cite-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-top: 0.55rem;
    }

    .note {
        font-size: 0.72rem;
        color: var(--muted);
    }

    .copy {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        height: 1.8rem;
        padding: 0 0.75rem;
        border: none;
        border-radius: 999px;
        background: var(--accent);
        font: inherit;
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--bg-color);
        cursor: pointer;
        transition:
            background-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &.copied .copy-icon {
            animation: bookmark-pop var(--dur-slow) var(--ease-spring);

            @media (prefers-reduced-motion: reduce) {
                animation: none;
            }
        }
    }

    .copy-icon {
        display: inline-flex;
    }

    /* ---------- listen ---------- */

    .listen {
        margin-top: 0.9rem;

        audio {
            display: block;
            width: 100%;
            height: 40px;
        }
    }

    .recorded {
        margin: 0.4rem 0 0;
        font-size: 0.75rem;
        line-height: 1.5;
        color: var(--muted);

        a {
            color: inherit;
        }
    }

    @media print {
        .actions,
        .listen {
            display: none;
        }
    }
</style>
