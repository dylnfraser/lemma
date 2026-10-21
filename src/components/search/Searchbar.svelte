<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { searchArticles, type WikipediaSearchResult } from "$lib/api/wikipedia";
    import { getArticlePath } from "$lib/article/articleUtils";
    import SearchIcon from "../icons/SearchIcon.svelte";
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

<div class="search">
    <div class="searchbar">
        <span class="search-icon"><SearchIcon /></span>
        <input
            bind:this={inputBox}
            bind:value={query}
            oninput={scheduleSearch}
            onkeydown={handleKeydown}
            type="search"
            role="combobox"
            placeholder="Search articles, people, places..."
            aria-label="Search Wikipedia articles"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={showOptions}
            aria-activedescendant={showOptions && activeIndex >= 0 ? optionId(activeIndex) : undefined}
            autocomplete="off"
            spellcheck="false"
        />
    </div>

    <div class="results" class:open={showPanel}>
        {#if showPanel}
            {#if isLoading && results.length === 0}
                <p class="status" role="status">Searching…</p>
            {:else if errorMessage}
                <p class="status error" role="alert">{errorMessage}</p>
            {:else if results.length === 0}
                <p class="status" role="status">No articles match “{searchedQuery}”. Press Enter to try it anyway.</p>
            {/if}
        {/if}

        <div id={listboxId} role="listbox" aria-label="Search results" hidden={!showOptions}>
            {#if showOptions}
                {#each results as result, i (result.title)}
                    <Result
                        id={optionId(i)}
                        title={result.title}
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
    </div>
</div>

<style>
    .search {
        position: relative;
        width: min(55ch, 100%);
        margin-inline: auto;

        animation: quickappear 0.5s both;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    .searchbar {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        height: 48px;
        padding: 0 12px;
        box-sizing: border-box;
        background: var(--bg-color);
        border: solid 1px var(--secondary);
        border-radius: 12px;
        box-shadow: 0 12px 32px var(--shadow-color);
        z-index: 2;

        &:focus-within {
            border-color: color-mix(in oklch, var(--accent) 45%, var(--secondary));
        }
    }

    .search-icon {
        display: grid;
        flex: none;
        opacity: 0.55;
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

        &:focus,
        &:focus-visible {
            outline: none;
        }

        &::-webkit-search-cancel-button {
            display: none;
        }
    }

    .results {
        display: none;
        position: absolute;
        top: calc(48px + 12px);
        left: 0;
        right: 0;
        gap: 3px;
        padding: 6px;
        background: var(--bg-color);
        border: solid 1px var(--secondary);
        box-shadow: 0 12px 32px var(--shadow-color);
        border-radius: 12px;
        z-index: 1;

        &.open {
            display: grid;
            animation: results-appear 0.1s ease-in both;
            @media (prefers-reduced-motion: reduce) {
                animation: none;
            }
        }
    }

    [role="listbox"]:not([hidden]) {
        display: grid;
        gap: 3px;
    }

    .status {
        margin: 0;
        padding: 0.4rem 4px;
        font-size: 0.9rem;
        opacity: 0.7;
    }

    .error {
        color: var(--danger);
        opacity: 1;
    }

    @keyframes results-appear {
        from {
            opacity: 0;
            filter: blur(2px);
        }

        to {
            opacity: 1;
            filter: none;
        }
    }
</style>
