<script lang="ts">
    import { tick } from "svelte";
    import { prefersReducedMotion } from "svelte/motion";
    import { findTextRanges } from "$lib/article/findText";
    import { preventMouseFocus } from "$lib/focus";
    import { DURATION, rise } from "$lib/motion";
    import Icon from "../icons/Icon.svelte";

    // Find in the article. Unlike the browser's own find, it also searches sections the reader has folded away,
    // unfolding the ones with matches (and folding them again afterwards, except where the reader ended up).
    interface Props {
        /** What to search: the rendered article. */
        root: HTMLElement | undefined;
        /** Unfolds folded sections whose text contains `query`; resolves (once rendered) with the ids it opened. */
        revealMatches: (query: string) => Promise<string[]>;
        /** Folds sections opened for the search back up, except those around `keep` (the current match). */
        restoreFolds: (opened: string[], keep: Node | null) => void;
    }

    let { root, revealMatches, restoreFolds }: Props = $props();

    const HIGHLIGHT = "lemma-find";
    const CURRENT_HIGHLIGHT = "lemma-find-current";
    const supportsHighlights = typeof CSS !== "undefined" && "highlights" in CSS;

    let open = $state(false);
    let query = $state("");
    let ranges = $state.raw<Range[]>([]);
    let current = $state(-1);
    let input = $state<HTMLInputElement>();
    let opened: string[] = [];
    let searchTimer: ReturnType<typeof setTimeout>;
    let searchId = 0;

    export async function show() {
        if (open) {
            input?.select();
            return;
        }
        // start from what the reader has selected, if anything short
        const selected = getSelection()?.toString().trim() ?? "";
        if (selected && selected.length < 80 && !selected.includes("\n")) query = selected;
        open = true;
        await tick();
        input?.focus();
        input?.select();
        if (query) runSearch();
    }

    export function isOpen() {
        return open;
    }

    function close() {
        clearTimeout(searchTimer);
        searchId++;
        const keep = ranges[current]?.startContainer ?? null;
        clearHighlights();
        restoreFolds(opened, keep);
        opened = [];
        open = false;
        ranges = [];
        current = -1;
    }

    function clearHighlights() {
        if (!supportsHighlights) return;
        CSS.highlights.delete(HIGHLIGHT);
        CSS.highlights.delete(CURRENT_HIGHLIGHT);
    }

    function scheduleSearch() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(runSearch, 140);
    }

    async function runSearch() {
        const id = ++searchId;
        const text = query.trim();
        if (!text || !root) {
            ranges = [];
            current = -1;
            clearHighlights();
            return;
        }

        const newlyOpened = await revealMatches(text);
        if (id !== searchId) return;
        opened = [...new Set([...opened, ...newlyOpened])];

        const found = findTextRanges(root, text);
        ranges = found;
        // like the browser: the first match at or below where the reader is
        const firstVisible = found.findIndex((range) => range.getBoundingClientRect().bottom > 80);
        current = found.length === 0 ? -1 : Math.max(0, firstVisible);
        paint();
        reveal();
    }

    function paint() {
        if (!supportsHighlights) return;
        CSS.highlights.set(HIGHLIGHT, new Highlight(...ranges));
        if (ranges[current]) CSS.highlights.set(CURRENT_HIGHLIGHT, new Highlight(ranges[current]));
        else CSS.highlights.delete(CURRENT_HIGHLIGHT);
    }

    /** Scrolls the current match into the upper part of the screen, unless it's already comfortably in view. */
    function reveal() {
        const range = ranges[current];
        if (!range) return;
        const rect = range.getBoundingClientRect();
        const comfortable = rect.top > 100 && rect.bottom < window.innerHeight - 120;
        if (!comfortable) {
            window.scrollTo({
                top: window.scrollY + rect.top - window.innerHeight / 3,
                behavior: prefersReducedMotion.current ? "auto" : "smooth",
            });
        }
        // without the Highlight API, the selection marks the match
        if (!supportsHighlights) {
            getSelection()?.removeAllRanges();
            getSelection()?.addRange(range.cloneRange());
        }
    }

    function step(by: number) {
        if (ranges.length === 0) return;
        current = (current + by + ranges.length) % ranges.length;
        paint();
        reveal();
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            event.preventDefault();
            clearTimeout(searchTimer);
            // Enter before the debounce has run searches straight away
            if (query.trim() && ranges.length === 0) runSearch();
            else step(event.shiftKey ? -1 : 1);
        } else if (event.key === "Escape") {
            event.preventDefault();
            close();
        }
    }

    $effect(() => () => {
        clearTimeout(searchTimer);
        clearHighlights();
    });

    let status = $derived(!query.trim() ? "" : ranges.length === 0 ? "No matches" : `${current + 1} of ${ranges.length}`);
</script>

{#if open}
    <div
        class="find-bar"
        role="search"
        aria-label="Find in article"
        transition:rise={{ y: -8, duration: DURATION.fast }}
    >
        <Icon name="search" size="0.95em" />
        <input
            bind:this={input}
            bind:value={query}
            oninput={scheduleSearch}
            onkeydown={handleKeydown}
            type="search"
            placeholder="Find in article"
            aria-label="Find in article"
            autocomplete="off"
            spellcheck="false"
        />
        <span class="status" class:none={status === "No matches"} aria-live="polite">{status}</span>
        <span class="buttons">
            <button type="button" aria-label="Previous match" disabled={ranges.length === 0} onmousedown={preventMouseFocus} onclick={() => step(-1)}>
                <Icon name="arrow-up" size="0.85em" />
            </button>
            <button type="button" aria-label="Next match" disabled={ranges.length === 0} onmousedown={preventMouseFocus} onclick={() => step(1)}>
                <Icon name="arrow-down" size="0.85em" />
            </button>
            <button type="button" aria-label="Close find" onmousedown={preventMouseFocus} onclick={close}>
                <Icon name="x" size="0.8em" />
            </button>
        </span>
    </div>
{/if}

<style>
    .find-bar {
        position: fixed;
        z-index: 25;
        top: calc(var(--nav-height) + 0.75rem);
        right: max(1rem, env(safe-area-inset-right));
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: min(22rem, calc(100vw - 2rem));
        box-sizing: border-box;
        height: 2.75rem;
        padding: 0 0.35rem 0 0.8rem;
        border: 1px solid var(--rule);
        border-radius: 12px;
        background: var(--bg-color);
        box-shadow: 0 16px 36px -16px var(--shadow-color);
        color: var(--muted);

        &:focus-within {
            border-color: color-mix(in oklch, var(--accent) 45%, var(--rule));
        }
    }

    input {
        flex: 1;
        min-width: 0;
        padding: 0;
        border: none;
        outline: none;
        background: none;
        font: inherit;
        font-size: 0.9rem;
        color: var(--text-color);

        &::-webkit-search-cancel-button {
            display: none;
        }
    }

    .status {
        flex: none;
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;

        &.none {
            color: oklch(0.58 0.15 30);
        }
    }

    .buttons {
        display: flex;
        flex: none;
    }

    button {
        display: grid;
        place-items: center;
        width: 1.9rem;
        height: 1.9rem;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: none;
        color: var(--muted);
        cursor: pointer;
        transition:
            background-color var(--dur-fast),
            color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &:hover:not(:disabled) {
            background: color-mix(in oklch, var(--secondary) 35%, transparent);
            color: var(--text-color);
        }

        &:disabled {
            opacity: 0.4;
            cursor: default;
        }
    }

    @media print {
        .find-bar {
            display: none;
        }
    }
</style>
