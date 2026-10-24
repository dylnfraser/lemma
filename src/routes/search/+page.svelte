<script lang="ts">
    import { fetchPageCards, getSearchPath, searchFullText, type FullTextResult, type PageCard } from "$lib/api/search";
    import { WikipediaError } from "$lib/api/wikipedia";
    import { getArticlePath } from "$lib/article/articleUtils";
    import ErrorState from "../../components/ErrorState.svelte";
    import ReaderLayout from "../../components/ReaderLayout.svelte";
    import Searchbar from "../../components/search/Searchbar.svelte";

    let { data } = $props();

    type Status = "idle" | "loading" | "ready" | "error";

    let status = $state<Status>("idle");
    let results = $state.raw<FullTextResult[]>([]);
    let cards = $state.raw(new Map<string, PageCard>());
    let total = $state(0);
    let suggestion = $state("");
    // When the query finds nothing but Wikipedia suggests a spelling, results are shown for the suggestion instead.
    let shownQuery = $state("");
    let nextOffset = $state<number | null>(null);
    let loadingMore = $state(false);
    let moreFailed = $state(false);
    let request: AbortController | undefined;
    let attempt = $state(0);
    let busy = $state(false);

    const numberFormat = new Intl.NumberFormat("en");

    /** Descriptions and thumbnails are a nicety: a failure leaves results as they are. */
    async function addCards(page: FullTextResult[], signal: AbortSignal) {
        try {
            const fetched = await fetchPageCards(
                page.map((result) => result.title),
                { signal },
            );
            cards = new Map([...cards, ...fetched]);
        } catch {
            /* keep the plain results */
        }
    }

    // A new query (or a retry) starts over; leaving or searching again aborts what's in flight.
    $effect(() => {
        const query = data.query;
        void attempt;
        request?.abort();
        results = [];
        cards = new Map();
        nextOffset = null;
        suggestion = "";
        shownQuery = query;
        moreFailed = false;
        if (!query) {
            status = "idle";
            return;
        }

        const controller = new AbortController();
        request = controller;
        status = "loading";

        searchFullText(query, { signal: controller.signal })
            .then(async (first) => {
                let search = first;
                if (first.results.length === 0 && first.suggestion) {
                    search = await searchFullText(first.suggestion, { signal: controller.signal });
                    if (search.results.length > 0) shownQuery = first.suggestion;
                    else search = first;
                }
                if (controller.signal.aborted) return;
                results = search.results;
                total = search.total;
                suggestion = search.suggestion;
                nextOffset = search.nextOffset;
                status = "ready";
                addCards(search.results, controller.signal);
            })
            .catch((error) => {
                if (controller.signal.aborted) return;
                busy = error instanceof WikipediaError && error.kind === "busy";
                status = "error";
            });

        return () => controller.abort();
    });

    async function loadMore() {
        if (nextOffset === null || loadingMore || !request) return;
        const signal = request.signal;
        loadingMore = true;
        moreFailed = false;
        try {
            const search = await searchFullText(shownQuery, { offset: nextOffset, signal });
            if (signal.aborted) return;
            // pages can overlap as Wikipedia's index shifts; never list an article twice
            const seen = new Set(results.map((result) => result.title));
            const fresh = search.results.filter((result) => !seen.has(result.title));
            results = [...results, ...fresh];
            nextOffset = search.nextOffset;
            addCards(fresh, signal);
        } catch {
            if (!signal.aborted) moreFailed = true;
        } finally {
            loadingMore = false;
        }
    }

    const skeletonWidths = [92, 78, 85, 70, 88, 64];
</script>

<svelte:head>
    <title>{data.query ? `${data.query} — Search` : "Search"} • Lemma</title>
    <meta name="robots" content="noindex" />
</svelte:head>

<ReaderLayout>
    <h1 class="sr-only">Search results</h1>

    <div class="search-slot">
        {#key data.query}
            <Searchbar initialQuery={data.query} suggestInitialQuery={false} autofocus={!data.query} />
        {/key}
    </div>

    {#if status === "idle"}
        <p class="hint">Search the text of every Wikipedia article. Results appear as you type above; press Enter to open one.</p>
    {:else if status === "error"}
        <div class="error">
            <ErrorState
                heading={busy ? "Wikipedia needs a breather" : "Search hit a snag"}
                message={busy
                    ? `Wikipedia is fielding a lot of requests right now and asked us to slow down for a moment. Give it a few seconds, then search for “${data.query}” again.`
                    : `We couldn't reach Wikipedia to search for “${data.query}”. It might be your connection, or a blip on their end. Give it another go in a moment.`}
                retryLabel="Search again"
                onRetry={() => attempt++}
            />
        </div>
    {:else}
        <div class="summary" aria-live="polite">
            {#if status === "loading"}
                <span class="skeleton bar" style:--width="14rem"></span>
            {:else}
                {#if shownQuery !== data.query}
                    <p class="suggestion">Showing results for <a href={getSearchPath(shownQuery)}><i>{shownQuery}</i></a></p>
                    <p class="count">
                        No results for “<b>{data.query}</b>” · {numberFormat.format(total)}
                        {total === 1 ? "result" : "results"} for the suggestion
                    </p>
                {:else}
                    <p class="count">
                        {#if total > 0}
                            {numberFormat.format(total)} {total === 1 ? "result" : "results"} for “<b>{data.query}</b>”
                        {:else}
                            No results for “<b>{data.query}</b>”
                        {/if}
                    </p>
                {/if}
                {#if suggestion && shownQuery === data.query}
                    <p class="suggestion">
                        Did you mean <a href={getSearchPath(suggestion)}><i>{suggestion}</i></a>?
                    </p>
                {/if}
                <p class="exact">
                    <a href={getArticlePath(data.query)}>Go to the article titled “{data.query}”</a>
                </p>
            {/if}
        </div>

        {#if status === "loading"}
            <div class="results" role="status" aria-label="Searching">
                {#each skeletonWidths as width}
                    <div class="row skeleton-row" aria-hidden="true">
                        <span class="skeleton bar title-bar" style:--width="{width * 0.45}%"></span>
                        <span class="skeleton bar" style:--width="{width}%"></span>
                        <span class="skeleton bar" style:--width="{width * 0.7}%"></span>
                    </div>
                {/each}
            </div>
        {:else if results.length > 0}
            <ol class="results">
                {#each results as result, i (result.title)}
                    {@const card = cards.get(result.title)}
                    <li class="row" style:--i={i % 20}>
                        <div class="text">
                            <a class="title" href={getArticlePath(result.title)}>{result.title}</a>
                            {#if card?.description}<p class="description">{card.description}</p>{/if}
                            {#if result.snippet}<p class="snippet">…{@html result.snippet}…</p>{/if}
                            {#if result.wordCount}
                                <p class="meta">{numberFormat.format(result.wordCount)} words</p>
                            {/if}
                        </div>
                        {#if card?.thumbnail}
                            <img class="thumb" src={card.thumbnail} alt="" loading="lazy" decoding="async" />
                        {/if}
                    </li>
                {/each}
            </ol>

            {#if nextOffset !== null}
                <div class="more">
                    <button type="button" class="more-button" aria-busy={loadingMore} disabled={loadingMore} onclick={loadMore}>
                        {loadingMore ? "Loading…" : moreFailed ? "Couldn't load more. Try again" : "More results"}
                    </button>
                </div>
            {/if}
        {:else}
            <div class="empty">
                <p>Try different or fewer words, check the spelling, or search for a broader topic.</p>
            </div>
        {/if}
    {/if}
</ReaderLayout>

<style>
    .search-slot {
        margin: 1.5rem 0 1.75rem;
        /* the bar's own entrance animation stays; it fills the reading column */
        :global(.search) {
            width: 100%;
        }
    }

    .hint,
    .empty p {
        color: var(--muted);
        font-size: 0.95rem;
        text-wrap: pretty;
    }

    .error {
        padding-top: 8vh;
    }

    .summary {
        display: grid;
        gap: 0.3rem;
        padding-bottom: 1rem;
        margin-bottom: 0.5rem;
        border-bottom: 1px solid var(--rule);
        font-size: 0.85rem;
        line-height: 1.5;
        color: var(--muted);

        p {
            margin: 0;
            font-size: inherit;
        }

        b {
            color: var(--text-color);
            font-weight: 600;
        }
    }

    .suggestion {
        font-size: 0.95rem !important;
        color: var(--text-color);

        a {
            font-weight: 600;
        }
    }

    .exact a {
        color: inherit;
    }

    .results {
        display: grid;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .row {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1rem 0;
        border-bottom: 1px solid color-mix(in oklch, var(--rule) 60%, transparent);

        /* a short cascade; "More results" pages cascade from their own first row (--i counts within each page) */
        animation: enter var(--dur-slow) var(--ease-out) backwards;
        animation-delay: calc(min(var(--i), 8) * var(--stagger));
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }


    .text {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 0.2rem;

        p {
            margin: 0;
        }
    }

    .title {
        justify-self: start;
        font-family: var(--display-font);
        font-size: 1.2rem;
        font-weight: 600;
        line-height: 1.3;
        text-decoration: none;

        &:hover {
            text-decoration: underline;
        }
    }

    .description {
        font-size: 0.8rem;
        color: var(--muted);
    }

    .snippet {
        margin-top: 0.15rem !important;
        font-size: 0.9rem;
        line-height: 1.55;
        text-wrap: pretty;
        color: color-mix(in oklch, var(--text-color) 85%, var(--page-bg));

        :global(mark) {
            background: none;
            color: var(--text-color);
            font-weight: 650;
        }
    }

    .meta {
        font-size: 0.72rem;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
    }

    .thumb {
        flex: none;
        width: 72px;
        height: 72px;
        margin-top: 0.2rem;
        border-radius: 8px;
        object-fit: cover;
        background: var(--secondary);
        outline: 1px solid var(--image-edge);
        outline-offset: -1px;
        transition: scale var(--dur-base) var(--ease-out);
    }

    .row:has(.title:hover) .thumb {
        scale: 1.04;
    }

    .more {
        display: flex;
        justify-content: center;
        margin-top: 1.5rem;
    }

    .more-button {
        height: 2.25rem;
        padding: 0 1.1rem;
        border: 1px solid var(--rule);
        border-radius: 999px;
        background: var(--bg-color);
        font-size: 0.85rem;
        font-weight: 550;
        color: var(--muted);
        cursor: pointer;
        transition:
            color var(--dur-fast),
            border-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &:hover:not(:disabled) {
            color: var(--text-color);
            border-color: var(--secondary);
        }

        &:disabled {
            cursor: progress;
        }
    }

    /* loading placeholders, in the reader's skeleton style */
    .skeleton-row {
        display: grid;
        gap: 0.35rem;
        animation-delay: 120ms;
    }

    .bar {
        display: block;
        width: var(--width, 100%);
        height: 0.6rem;
        margin: 0.3rem 0;
        border-radius: 999px;
        background: linear-gradient(
            90deg,
            color-mix(in oklch, var(--secondary) 65%, transparent) 25%,
            color-mix(in oklch, var(--secondary) 35%, var(--page-bg)) 50%,
            color-mix(in oklch, var(--secondary) 65%, transparent) 75%
        );
        background-size: 200% 100%;
        animation: shimmer 1.4s ease-in-out infinite;

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    .title-bar {
        height: 0.9rem;
        margin-bottom: 0.5rem;
    }

</style>
