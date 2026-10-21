<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { WikipediaAPI, type WikipediaSearchResult } from "$lib/api/wikipedia";
    import Result from "./Result.svelte";

    let { autofocus = false, onDismiss } = $props<{
        autofocus?: boolean;
        onDismiss?: () => void;
    }>();

    const api = new WikipediaAPI();

    function handleKeyDown(event: KeyboardEvent) {
        if ((event.metaKey || event.ctrlKey) && event.key === "k") {
            event.preventDefault();
            inputBox.focus();
        }
    }

    onMount(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    });
    const debounceMs = 200;
    const maxResults = 5;

    let inputBox: HTMLInputElement;
    let query = $state("");
    let results = $state<WikipediaSearchResult[]>([]);
    let isLoading = $state(false);
    let errorMessage = $state("");
    let activeIndex = $state(-1);
    let searchRequestId = 0;
    let debounceTimer: ReturnType<typeof setTimeout>;

    function getArticlePath(title: string) {
        return `/wiki/${encodeURIComponent(title.trim().replaceAll(" ", "_"))}`;
    }

    function clearResults() {
        results = [];
        activeIndex = -1;
        errorMessage = "";
    }

    function focusInput() {
        inputBox?.focus();
        inputBox?.select();
    }

    function scheduleSearch() {
        clearTimeout(debounceTimer);
        const trimmedQuery = query.trim();

        if (!trimmedQuery) {
            isLoading = false;
            clearResults();
            return;
        }

        debounceTimer = setTimeout(() => search(trimmedQuery), debounceMs);
    }

    async function search(searchQuery: string) {
        const requestId = ++searchRequestId;
        isLoading = true;
        errorMessage = "";

        try {
            const searchResults = await api.getSearchResults(searchQuery);
            if (requestId !== searchRequestId) return;

            results = searchResults.slice(0, maxResults);
            activeIndex = results.length > 0 ? 0 : -1;
        } catch {
            if (requestId !== searchRequestId) return;

            results = [];
            activeIndex = -1;
            errorMessage = "Couldn't load results. Try again.";
        } finally {
            if (requestId === searchRequestId) {
                isLoading = false;
            }
        }
    }

    async function openArticle(title = query) {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) return;

        await goto(getArticlePath(trimmedTitle));
        onDismiss?.();
    }

    function handleWindowKeydown(event: KeyboardEvent) {
        if (event.key !== "/") return;

        const target = event.target as HTMLElement;
        if (["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable) return;

        event.preventDefault();
        focusInput();
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            event.preventDefault();
            openArticle(results[activeIndex]?.title ?? query);
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            if (results.length > 0) {
                activeIndex = Math.min(activeIndex + 1, results.length - 1);
            }
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (results.length > 0) {
                activeIndex = Math.max(activeIndex - 1, 0);
            }
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
        if (autofocus) focusInput();

        return () => clearTimeout(debounceTimer);
    });
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div id="search">
    <div id="searchbar">
        <img src="/icon/search.svg" class="icon" alt="" aria-hidden="true" id="searchbaritem" />
        <input
            placeholder="Search articles, people, places..."
            id="searchbar-item"
            bind:this={inputBox}
            bind:value={query}
            oninput={scheduleSearch}
            onkeydown={handleKeydown}
            aria-label="Search Wikipedia articles"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-expanded={results.length > 0 || isLoading || !!errorMessage}
        />
    </div>

    {#if query.trim().length > 0 && (results.length > 0 || isLoading || errorMessage)}
        <div id="results" role="listbox" aria-label="Search results">
            {#if isLoading}
                <p class="status">Searching…</p>
            {:else if errorMessage}
                <p class="status error">{errorMessage}</p>
            {:else}
                {#each results as result, i}
                    <Result
                        title={result.title}
                        desc={result.description}
                        imgsrc={result.thumbnail}
                        href={getArticlePath(result.title)}
                        active={i === activeIndex}
                    />
                {/each}
            {/if}
        </div>
    {/if}
</div>

<style>
    #search {
        opacity: 0;

        animation: quickappear 0.5s forwards;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }

        position: fixed;
        width: 55ch;
        left: calc(50% - 27.5ch);
        top: var(--search-top, auto);
        z-index: var(--search-z-index, auto);

        @media (max-width: 600px) {
            width: calc(80dvw);
            left: calc(10dvw);
        }
    }

    #searchbar {
        position: relative;
        background: var(--bg-color);
        border: solid 1px var(--secondary);
        border-radius: 12px;
        box-shadow: 0 12px 32px var(--shadow-color);
        width: 100%;
        height: 48px;
        z-index: 2;

        img {
            position: absolute;
            user-select: none;
            width: 24px;
            height: 24px;
            left: 12px;
            top: 12px;
        }

        input {
            font-size: 16px;
            line-height: 1;
            height: 24px;
            padding: 0;
            margin: 0;
            position: absolute;
            left: 38px;
            top: 12px;
            width: calc(100% - 62px);
            background: none;
            border: none;
            color: var(--text-color, inherit);
        }

        input:focus {
            outline: none;
        }
    }

    #results {
        animation: appear 0.1s ease-in forwards;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }

        position: absolute;
        top: calc(48px + 12px);
        left: 0;
        width: calc(100% - 12px);
        display: grid;
        gap: 3px;
        padding: 6px;
        background: var(--bg-color);
        border: solid 1px var(--secondary);
        box-shadow: 0 12px 32px var(--shadow-color);
        border-radius: 12px;
        z-index: 1;
    }

    .status {
        margin: 0;
        padding: 0 4px;
        font-size: 0.9rem;
        opacity: 0.7;
    }

    .error {
        color: oklch(0.5 0.18 25);
        opacity: 1;
    }

    @keyframes appear {
        0% {
            opacity: 0;
            filter: blur(2px);
        }

        100% {
            opacity: 1;
            filter: none;
        }
    }
</style>
