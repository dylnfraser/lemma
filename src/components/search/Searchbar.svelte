<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { searchArticles, type WikipediaSearchResult } from "$lib/api/wikipedia";
    import { getArticlePath } from "$lib/article/articleUtils";
    import { preventMouseFocus } from "$lib/focus";
    import SearchIcon from "../icons/SearchIcon.svelte";
    import Icon from "../icons/Icon.svelte";
    import Result from "./Result.svelte";

    interface Props {
        autofocus?: boolean;
        initialQuery?: string;
        onDismiss?: () => void;
    }

    let { autofocus = false, initialQuery = "", onDismiss }: Props = $props();

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
    let showOptions = $derived(showPanel && !errorMessage && results.length > 0);

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
            activeIndex = results.length > 0 ? 0 : -1;
            searchedQuery = searchQuery;
        } catch {
            if (request.signal.aborted) return;
            results = [];
            activeIndex = -1;
            errorMessage = "Couldn't load results. Try again.";
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

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            event.preventDefault();
            openArticle(results[activeIndex]?.title ?? query);
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            if (results.length > 0) activeIndex = Math.min(activeIndex + 1, results.length - 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (results.length > 0) activeIndex = Math.max(activeIndex - 1, 0);
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
        if (trimmedQuery) search(trimmedQuery);

        return () => {
            clearTimeout(debounceTimer);
            activeRequest?.abort();
        };
    });
</script>

<div class="search" class:open={showPanel}>
    <div class="searchbar">
        <span class="search-icon" class:loading={isLoading}><SearchIcon /></span>
        <input
            bind:this={inputBox}
            bind:value={query}
            oninput={scheduleSearch}
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
            {:else if results.length === 0}
                <p class="status" role="status">
                    <span class="status-icon"><SearchIcon size={18} /></span>
                    <span>
                        No articles match “<b>{searchedQuery}</b>”
                        <span class="status-hint">Press <kbd aria-label="Enter"><Icon name="corner-down-left" /></kbd> to open it anyway</span>
                    </span>
                </p>
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

        animation: quickappear 0.5s both;
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
        opacity: 0.55;

        :global(svg) {
            transition: opacity var(--dur-fast) ease;
        }

        /* spinner that takes the icon's place while a search is in flight */
        &::after {
            content: "";
            position: absolute;
            inset: 5px;
            border: 1.5px solid currentColor;
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
    .clear {
        display: grid;
        place-items: center;
        flex: none;
        box-sizing: border-box;
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        border: 1px solid color-mix(in oklch, var(--rule) 80%, transparent);
        border-radius: 6px;
        background: var(--bg-color);
        color: var(--muted);
        cursor: pointer;
        animation: clear-in var(--dur-fast) var(--ease-out) both;
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

    @keyframes clear-in {
        from {
            opacity: 0;
            scale: 0.6;
        }
    }

    .results {
        display: none;
        border-top: 1px solid var(--rule);

        &.open {
            display: block;
            animation: results-appear var(--dur-base) var(--ease-out) both;
        }
    }

    /* grows open beneath the field */
    @keyframes results-appear {
        from {
            opacity: 0;
            transform: translateY(-4px);
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

    .status-hint {
        display: block;
        margin-top: 0.15rem;
        font-size: 0.8rem;
        opacity: 0.85;

        kbd {
            height: 1.25rem;
            min-width: 1.25rem;
            margin-block: -0.15rem;
            vertical-align: middle;
        }
    }

    .error {
        color: var(--danger);

        .status-icon {
            background: color-mix(in oklch, var(--danger) 15%, transparent);
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
