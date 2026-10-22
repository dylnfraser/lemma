<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { getSearchPath } from "$lib/api/search";
    import { searchArticles, WikipediaError, type WikipediaSearchResult } from "$lib/api/wikipedia";
    import { getArticlePath } from "$lib/article/articleUtils";
    import { preventMouseFocus } from "$lib/focus";
    import { pop } from "$lib/motion";
    import SearchIcon from "../icons/SearchIcon.svelte";
    import Icon from "../icons/Icon.svelte";
    import Result from "./Result.svelte";

    interface Props {
        autofocus?: boolean;
        initialQuery?: string;
        /** Fetch suggestions for `initialQuery` straight away (off for the search page, which already shows results). */
        suggestInitialQuery?: boolean;
        onDismiss?: () => void;
        /** Show the "/" shortcut in the empty field (for pages where the shortcut focuses this bar). */
        shortcutHint?: boolean;
    }

    let { autofocus = false, initialQuery = "", suggestInitialQuery = true, onDismiss, shortcutHint = false }: Props = $props();

    const debounceMs = 200;
    const uid = $props.id();
    const listboxId = `${uid}-results`;
    const optionId = (index: number) => `${uid}-option-${index}`;

    let inputBox: HTMLInputElement;
    // svelte-ignore state_referenced_locally
    let query = $state(initialQuery);
    let results = $state<WikipediaSearchResult[]>([]);
    let isLoading = $state(false);
    let errorMessage = $state("");
    let activeIndex = $state(-1);
    let searchedQuery = $state("");
    let debounceTimer: ReturnType<typeof setTimeout>;
    let activeRequest: AbortController | undefined;

    let trimmedQuery = $derived(query.trim());
    let showPanel = $derived(trimmedQuery.length > 0 && (isLoading || !!errorMessage || !!searchedQuery));
    // Previous results stay visible while the next query loads so the list doesn't flicker on every keystroke.
    // The last option is always "Search all of Wikipedia", so there's something to choose even with no title matches.
    let showOptions = $derived(showPanel && !errorMessage && !!searchedQuery);
    let searchAllIndex = $derived(results.length);

    function clearQuery() {
        query = "";
        clearTimeout(debounceTimer);
        clearResults();
        inputBox?.focus();
    }

    export function focus() {
        inputBox?.focus();
        inputBox?.select();
    }

    function clearResults() {
        activeRequest?.abort();
        results = [];
        activeIndex = -1;
        errorMessage = "";
        isLoading = false;
        searchedQuery = "";
    }

    function scheduleSearch() {
        clearTimeout(debounceTimer);

        if (!trimmedQuery) {
            clearResults();
            return;
        }

        const nextQuery = trimmedQuery;
        debounceTimer = setTimeout(() => search(nextQuery), debounceMs);
    }

    async function search(searchQuery: string) {
        activeRequest?.abort();
        const request = new AbortController();
        activeRequest = request;
        isLoading = true;
        errorMessage = "";

        try {
            results = await searchArticles(searchQuery, { signal: request.signal });
            // with no title matches, the "search all" option is the natural choice
            activeIndex = 0;
            searchedQuery = searchQuery;
        } catch (error) {
            if (request.signal.aborted) return;
            results = [];
            activeIndex = -1;
            errorMessage =
                error instanceof WikipediaError && error.kind === "busy"
                    ? "Wikipedia's busy for a moment. Keep typing, or try again shortly."
                    : "Couldn't load results. Try again.";
        } finally {
            if (activeRequest === request) isLoading = false;
        }
    }

    async function openArticle(title: string) {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) return;

        clearTimeout(debounceTimer);
        activeRequest?.abort();
        await goto(getArticlePath(trimmedTitle));
        onDismiss?.();
    }

    async function searchEverything() {
        if (!trimmedQuery) return;
        clearTimeout(debounceTimer);
        activeRequest?.abort();
        await goto(getSearchPath(trimmedQuery));
        onDismiss?.();
    }

    // The top suggestion, when it starts with what's been typed: its remaining letters show faintly after the caret
    // (Tab or → takes them), and its picture takes the search icon's place.
    let top = $derived(results[0]);
    let completion = $derived(
        top && query && top.title.toLowerCase().startsWith(query.toLowerCase()) ? top.title.slice(query.length) : "",
    );
    // a long query scrolls inside the field, where the faint ending would no longer line up
    let overflowing = $state(false);

    function acceptCompletion(): boolean {
        if (!completion || !inputBox || inputBox.selectionStart !== query.length) return false;
        query = top!.title;
        activeIndex = 0;
        scheduleSearch();
        return true;
    }

    function handleKeydown(event: KeyboardEvent) {
        if ((event.key === "Tab" && !event.shiftKey) || event.key === "ArrowRight") {
            if (acceptCompletion()) event.preventDefault();
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            if (showOptions && activeIndex === searchAllIndex) searchEverything();
            // before suggestions arrive, Enter treats the query as a title (the article page offers search if it isn't one)
            else openArticle(results[activeIndex]?.title ?? query);
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            if (showOptions) activeIndex = Math.min(activeIndex + 1, searchAllIndex);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (showOptions) activeIndex = Math.max(activeIndex - 1, 0);
        } else if (event.key === "Escape") {
            if (onDismiss) {
                onDismiss();
            } else {
                query = "";
                clearResults();
            }
        }
    }

    onMount(() => {
        if (autofocus) focus();
        if (trimmedQuery && suggestInitialQuery) search(trimmedQuery);

        return () => {
            clearTimeout(debounceTimer);
            activeRequest?.abort();
        };
    });
</script>

<div class="search" class:open={showPanel}>
    <div class="searchbar">
        <span class="search-icon" class:loading={isLoading} class:has-thumb={!!(completion && top?.thumbnail)}>
            <SearchIcon />
            {#if completion && top?.thumbnail}
                {#key top.thumbnail}
                    <img class="top-thumb" src={top.thumbnail} alt="" transition:pop={{ start: 0.7 }} />
                {/key}
            {/if}
        </span>
        <span class="field">
            <input
                bind:this={inputBox}
                bind:value={query}
                oninput={() => {
                    overflowing = !!inputBox && inputBox.scrollWidth > inputBox.clientWidth;
                    scheduleSearch();
                }}
                onkeydown={handleKeydown}
                type="search"
                role="combobox"
                placeholder="Search Wikipedia"
                aria-label="Search Wikipedia articles"
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-expanded={showOptions}
                aria-activedescendant={showOptions && activeIndex >= 0 ? optionId(activeIndex) : undefined}
                autocomplete="off"
                spellcheck="false"
            />
            {#if completion && !overflowing}
                <span class="ghost" aria-hidden="true"><span class="typed">{query}</span>{completion}</span>
            {/if}
        </span>
        {#if query}
            <button
                type="button"
                class="clear"
                aria-label="Clear search"
                onmousedown={preventMouseFocus}
                onclick={clearQuery}
            >
                <Icon name="x" size="0.75rem" />
            </button>
        {:else if shortcutHint}
            <kbd class="shortcut-hint" aria-hidden="true" title="Press / to search">/</kbd>
        {/if}
    </div>

    <div class="results" class:open={showPanel}>
        {#if showPanel}
            {#if isLoading && results.length === 0}
                <p class="status" role="status">
                    <span class="status-icon"><span class="spinner"></span></span>
                    <span>Searching Wikipedia…</span>
                </p>
            {:else if errorMessage}
                <p class="status error" role="alert">
                    <span class="status-icon">!</span>
                    <span>{errorMessage}</span>
                </p>
            {:else if results.length === 0 && !isLoading}
                <p class="status no-titles" role="status"><span>No article titles match “<b>{searchedQuery}</b>”</span></p>
            {/if}
        {/if}

        <div id={listboxId} role="listbox" aria-label="Search results" hidden={!showOptions}>
            {#if showOptions}
                {#each results as result, i (result.title)}
                    <Result
                        id={optionId(i)}
                        title={result.title}
                        query={searchedQuery}
                        desc={result.description}
                        imgsrc={result.thumbnail}
                        href={getArticlePath(result.title)}
                        active={i === activeIndex}
                        onhover={() => (activeIndex = i)}
                        onselect={onDismiss}
                    />
                {/each}
                <a
                    id={optionId(searchAllIndex)}
                    class="search-all"
                    class:active={activeIndex === searchAllIndex}
                    href={getSearchPath(searchedQuery)}
                    role="option"
                    aria-selected={activeIndex === searchAllIndex}
                    tabindex="-1"
                    onpointermove={() => (activeIndex = searchAllIndex)}
                    onclick={onDismiss}
                >
                    <span class="search-all-icon" aria-hidden="true"><SearchIcon size={18} /></span>
                    <span class="search-all-text">Search all of Wikipedia for “<b>{searchedQuery}</b>”</span>
                    <kbd class="enter" aria-hidden="true"><Icon name="corner-down-left" size="0.75rem" /></kbd>
                </a>
            {/if}
        </div>

        {#if showPanel}
            <div class="hints" aria-hidden="true">
                {#if showOptions}<span
                        ><kbd><Icon name="arrow-up" /></kbd><kbd><Icon name="arrow-down" /></kbd> navigate</span
                    >{/if}
                <span><kbd><Icon name="corner-down-left" /></kbd> open</span>
                <span><kbd>esc</kbd> {onDismiss ? "close" : "clear"}</span>
            </div>
        {/if}
    </div>
</div>

<style>
    /* One card: the search field on top, results growing out beneath it. */
    .search {
        position: relative;
        width: min(55ch, 100%);
        margin-inline: auto;
        overflow: hidden;
        background: var(--bg-color);
        border: 1px solid var(--secondary);
        border-radius: 12px;
        box-shadow: 0 12px 32px var(--shadow-color);
        transition:
            border-color var(--dur-fast) ease,
            box-shadow var(--dur-base) var(--ease-out);

        animation: enter var(--dur-slow) var(--ease-out) backwards;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }

        &:focus-within {
            border-color: color-mix(in oklch, var(--accent) 45%, var(--secondary));
            box-shadow:
                0 12px 32px var(--shadow-color),
                0 0 0 4px color-mix(in oklch, var(--accent) 12%, transparent);
        }
    }

    .searchbar {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        height: 44px;
        padding: 0 8px 0 12px;
        box-sizing: border-box;
    }

    .search-icon {
        position: relative;
        display: grid;
        flex: none;
        color: var(--muted);

        :global(svg) {
            transition: opacity var(--dur-fast) ease;
        }

        /* spinner that takes the icon's place while a search is in flight */
        &::after {
            content: "";
            position: absolute;
            inset: 4px;
            border: 2px solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            opacity: 0;
            transition: opacity var(--dur-fast) ease;
            animation: spin 0.7s linear infinite;

            @media (prefers-reduced-motion: reduce) {
                animation: none;
                border-style: dotted;
                border-right-color: currentColor;
            }
        }

        /* only for searches slow enough to notice: quick responses never swap the icon */
        &.loading {
            :global(svg) {
                opacity: 0;
                transition-delay: 150ms;
            }

            &::after {
                opacity: 1;
                transition-delay: 150ms;
            }
        }
    }

    @keyframes spin {
        to {
            rotate: 1turn;
        }
    }

    /* the input with its faint completion laid over it, letter for letter */
    .field {
        position: relative;
        display: flex;
        flex: 1;
        min-width: 0;
    }

    .ghost {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        overflow: hidden;
        font: inherit;
        font-size: 16px;
        line-height: 1;
        white-space: pre;
        color: var(--muted);
        opacity: 0.55;
        pointer-events: none;
        animation: fade-in var(--dur-base) var(--ease-out) backwards;

        .typed {
            visibility: hidden;
        }
    }

    /* the top result's picture in the search icon's place */
    .search-icon {
        :global(svg) {
            transition: opacity var(--dur-base) var(--ease-out);
        }

        &.has-thumb:not(.loading) :global(svg) {
            opacity: 0;
        }
    }

    .top-thumb {
        position: absolute;
        inset: 1px;
        width: calc(100% - 2px);
        height: calc(100% - 2px);
        border-radius: 6px;
        object-fit: cover;
        background: var(--secondary);
    }

    .loading .top-thumb {
        opacity: 0;
    }

    input {
        flex: 1;
        min-width: 0;
        height: 24px;
        padding: 0;
        margin: 0;
        font: inherit;
        font-size: 16px;
        line-height: 1;
        background: none;
        border: none;
        color: inherit;

        &::placeholder {
            color: var(--muted);
            opacity: 0.8;
        }

        &:focus,
        &:focus-visible {
            outline: none;
        }

        &::-webkit-search-cancel-button {
            display: none;
        }
    }

    /* drawn like the palette's keycaps (same border, radius and fill), a touch larger as a click target */
    /* the "/" shortcut: fades out once the field has focus, and isn't shown where there's no keyboard to press it */
    .shortcut-hint {
        flex: none;
        margin-right: 0.15rem;
        animation: clear-in var(--dur-base) var(--ease-out) backwards;
        transition:
            opacity var(--dur-fast),
            scale var(--dur-fast) var(--ease-out);

        .search:focus-within & {
            opacity: 0;
            scale: 0.85;
        }

        @media (hover: none) {
            display: none;
        }
    }

    .clear {
        position: relative;
        display: grid;
        place-items: center;
        flex: none;

        /* a fingertip-sized target around the small button */
        @media (pointer: coarse) {
            &::after {
                content: "";
                position: absolute;
                inset: -0.6rem;
            }
        }
        box-sizing: border-box;
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        border: 1px solid color-mix(in oklch, var(--rule) 80%, transparent);
        border-radius: 6px;
        background: var(--bg-color);
        color: var(--muted);
        cursor: pointer;
        animation: clear-in var(--dur-base) var(--ease-out) backwards;
        transition:
            background-color var(--dur-fast),
            border-color var(--dur-fast),
            color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &:hover {
            border-color: var(--secondary);
            background: color-mix(in oklch, var(--secondary) 25%, var(--bg-color));
            color: var(--text-color);
        }
    }

    /* small controls appear the site's way, from a blur, growing in from a little smaller */
    @keyframes clear-in {
        from {
            opacity: 0;
            scale: 0.7;
            filter: blur(var(--blur));
        }
    }

    .results {
        display: none;
        border-top: 1px solid var(--rule);

        &.open {
            display: block;
            animation: fade-in var(--dur-base) var(--ease-out) backwards;
        }
    }

    [role="listbox"]:not([hidden]) {
        display: grid;
        gap: 0;
        padding: 4px;
    }

    .status {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin: 0;
        padding: 0.55rem 0.75rem;
        font-size: 0.9rem;
        line-height: 1.4;
        color: var(--muted);

        b {
            color: var(--text-color);
            font-weight: 600;
        }
    }

    .status-icon {
        display: grid;
        place-items: center;
        flex: none;
        width: 1.85rem;
        height: 1.85rem;
        border-radius: 8px;
        background: color-mix(in oklch, var(--secondary) 45%, transparent);
        font-weight: 700;
    }

    .spinner {
        width: 14px;
        height: 14px;
        border: 1.5px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;

        @media (prefers-reduced-motion: reduce) {
            animation: none;
            border-style: dotted;
            border-right-color: currentColor;
        }
    }

    .error {
        color: var(--danger);

        .status-icon {
            background: color-mix(in oklch, var(--danger) 15%, transparent);
        }
    }

    .no-titles {
        padding: 0.55rem 0.75rem 0.15rem;
        font-size: 0.8rem;
    }

    /* drawn like a result row (see Result.svelte) so the list reads as one set of choices */
    .search-all {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        min-height: 44px;
        padding: 4px 8px 4px 4px;
        box-sizing: border-box;
        border-radius: 8px;
        color: inherit;
        text-decoration: none;
        cursor: pointer;
        transition: background-color var(--dur-instant) ease;

        &.active {
            background: color-mix(in oklch, var(--secondary) 38%, transparent);
        }

        &:hover {
            color: inherit;
        }
    }

    .search-all-icon {
        display: grid;
        place-items: center;
        flex: none;
        width: 34px;
        height: 34px;
        border-radius: 7px;
        background: color-mix(in oklch, var(--secondary) 45%, transparent);
        color: var(--muted);
    }

    .search-all-text {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.85rem;
        color: var(--muted);

        b {
            color: var(--text-color);
            font-weight: 600;
        }
    }

    .search-all .enter {
        flex: none;
        opacity: 0;
        color: var(--muted);
        transition: opacity var(--dur-fast) ease;
    }

    .search-all.active .enter {
        opacity: 1;
    }

    @media (pointer: coarse) {
        .search-all .enter {
            display: none;
        }
    }

    .hints {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 1rem;
        padding: 0.45rem 0.75rem;
        border-top: 1px solid color-mix(in oklch, var(--rule) 70%, transparent);
        background: color-mix(in oklch, var(--secondary) 12%, transparent);
        font-size: 0.75rem;
        line-height: 1;
        color: var(--muted);

        span {
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
        }

        /* the arrow pair reads as one key group */
        kbd + kbd {
            margin-left: -0.125rem;
        }

        /* touch screens have no arrow keys */
        @media (pointer: coarse) {
            display: none;
        }
    }

    /* Fixed-size, flat keycaps: a symmetric box centres on the label's midline. */
    kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        height: 1.375rem;
        min-width: 1.375rem;
        padding: 0 0.375rem;
        border: 1px solid color-mix(in oklch, var(--rule) 80%, transparent);
        border-radius: 6px;
        background: var(--bg-color);
        font-family: inherit;
        font-size: 0.7rem;
        font-weight: 500;
        line-height: 1;
        color: var(--text-color);
        opacity: 1;
    }

    kbd :global(.icon) {
        --size: 0.75rem;
    }
</style>
