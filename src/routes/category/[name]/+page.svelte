<script lang="ts">
    import { fetchCategory, type CategoryMember } from "$lib/api/pages";
    import { getWikipediaArticleUrl, WikipediaError } from "$lib/api/wikipedia";
    import { getArticlePath, getCategoryPath } from "$lib/article/articleUtils";
    import ErrorState from "../../../components/ErrorState.svelte";
    import ReaderLayout from "../../../components/ReaderLayout.svelte";
    import Icon from "../../../components/icons/Icon.svelte";

    let { data } = $props();

    let status = $state<"loading" | "ready" | "error">("loading");
    let error = $state<unknown>(null);
    let pages = $state.raw<CategoryMember[]>([]);
    let subcategories = $state.raw<string[]>([]);
    let next = $state<string | null>(null);
    let loadingMore = $state(false);
    let moreFailed = $state(false);
    let attempt = $state(0);
    let request: AbortController | undefined;

    $effect(() => {
        const name = data.name;
        void attempt;
        request?.abort();
        const controller = new AbortController();
        request = controller;
        status = "loading";
        pages = [];
        subcategories = [];
        next = null;

        fetchCategory(name, { signal: controller.signal }).then(
            (category) => {
                pages = category.pages;
                subcategories = category.subcategories;
                next = category.next;
                status = "ready";
            },
            (reason) => {
                if (controller.signal.aborted) return;
                error = reason;
                status = "error";
            },
        );
        return () => controller.abort();
    });

    async function loadMore() {
        if (!next || loadingMore) return;
        loadingMore = true;
        moreFailed = false;
        try {
            const more = await fetchCategory(data.name, { next, signal: request?.signal });
            pages = [...pages, ...more.pages];
            subcategories = [...subcategories, ...more.subcategories];
            next = more.next;
        } catch {
            moreFailed = true;
        } finally {
            loadingMore = false;
        }
    }

    let empty = $derived(status === "ready" && pages.length === 0 && subcategories.length === 0);
</script>

<svelte:head>
    <title>{data.name} — Category • Lemma</title>
</svelte:head>

<ReaderLayout>
    <header class="page-header">
        <p class="kicker"><Icon name="folder" size="1.05em" /> Category</p>
        <h1>{data.name}</h1>
        {#if status === "ready" && !empty}
            <p class="meta">
                {pages.length}{next ? "+" : ""}
                {pages.length === 1 ? "article" : "articles"}
                {#if subcategories.length > 0}· {subcategories.length}{next ? "+" : ""} subcategories{/if}
                ·
                <a class="with-icon" href={getWikipediaArticleUrl(`Category:${data.name}`)} target="_blank" rel="noopener noreferrer"
                    >Wikipedia<Icon name="arrow-up-right" size="0.85em" /></a
                >
            </p>
        {/if}
    </header>

    {#if status === "error"}
        <div class="error">
            {#if error instanceof WikipediaError && error.kind === "not_found"}
                <ErrorState heading="No such category" message={`Wikipedia doesn't have a category called “${data.name}”.`} />
            {:else}
                <ErrorState
                    heading="Something went sideways"
                    message={`We couldn't load the category “${data.name}” from Wikipedia. It's probably a blip, and trying again usually sorts it out.`}
                    retryLabel="Give it another go"
                    onRetry={() => attempt++}
                />
            {/if}
        </div>
    {:else if status === "loading"}
        <ul class="pages" role="status" aria-label="Loading the category">
            {#each { length: 8 } as _, i}
                <li class="skeleton-row" aria-hidden="true" style:--i={i}>
                    <span class="skeleton thumb"></span>
                    <span class="lines">
                        <span class="skeleton bar" style:--width="{40 + ((i * 17) % 35)}%"></span>
                        <span class="skeleton bar" style:--width="{55 + ((i * 23) % 30)}%"></span>
                    </span>
                </li>
            {/each}
        </ul>
    {:else if empty}
        <p class="empty">This category is empty, or doesn't exist on Wikipedia.</p>
    {:else}
        {#if subcategories.length > 0}
            <h2>Subcategories</h2>
            <ul class="subcategories">
                {#each subcategories as subcategory, i (subcategory)}
                    <li style:--i={i % 30}>
                        <a href={getCategoryPath(subcategory)}><Icon name="folder" size="0.9em" />{subcategory}</a>
                    </li>
                {/each}
            </ul>
        {/if}

        {#if pages.length > 0}
            {#if subcategories.length > 0}<h2>Articles</h2>{/if}
            <ul class="pages">
                {#each pages as page, i (page.title)}
                    <li style:--i={i % 60}>
                        <a href={getArticlePath(page.title)}>
                            {#if page.thumbnail}
                                <img src={page.thumbnail} alt="" loading="lazy" decoding="async" />
                            {:else}
                                <span class="placeholder" aria-hidden="true">{page.title.slice(0, 1)}</span>
                            {/if}
                            <span class="text">
                                <span data-morph class="title">{page.title}</span>
                                {#if page.description}<span class="description">{page.description}</span>{/if}
                            </span>
                        </a>
                    </li>
                {/each}
            </ul>
        {/if}

        {#if next}
            <div class="more">
                <button type="button" aria-busy={loadingMore} disabled={loadingMore} onclick={loadMore}>
                    {loadingMore ? "Loading…" : moreFailed ? "Couldn't load more. Try again" : "Show more"}
                </button>
            </div>
        {/if}
    {/if}
</ReaderLayout>

<style>
    .page-header {
        margin: 1.5rem 0 1.5rem;
        padding-bottom: 1.25rem;
        border-bottom: 1px solid var(--rule);
    }

    .kicker {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin: 0 0 0.5rem;
        font-size: 0.72rem;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
    }

    h1 {
        margin: 0;
        font-size: clamp(1.9rem, 1.5rem + 1.6vw, 2.5rem);
        font-weight: 600;
        line-height: 1.15;
        text-wrap: balance;
    }

    .meta {
        margin: 0.8rem 0 0;
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--muted);

        a {
            color: inherit;
            text-decoration: none;

            &:hover {
                color: var(--link-hover);
            }
        }
    }

    h2 {
        margin: 1.75rem 0 0.75rem;
        padding: 0;
        border: none;
        font-family: default-sans;
        font-size: 0.72rem;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
    }

    ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    li {
        animation: enter var(--dur-slow) var(--ease-out) backwards;
        animation-delay: calc(min(var(--i), 10) * var(--stagger));

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }


    .subcategories {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;

        a {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.3rem 0.75rem;
            border: 1px solid var(--rule);
            border-radius: 999px;
            font-size: 0.82rem;
            color: inherit;
            text-decoration: none;
            transition: border-color var(--dur-fast);

            :global(.icon) {
                color: var(--muted);
            }

            &:hover {
                border-color: var(--secondary);
                color: var(--link-hover);
            }
        }
    }

    .pages {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(17rem, 100%), 1fr));
        gap: 0.25rem 1rem;

        a {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.45rem 0.5rem;
            margin-inline: -0.5rem;
            border-radius: 10px;
            color: inherit;
            text-decoration: none;
            transition: background-color var(--dur-fast);

            &:hover {
                background: color-mix(in oklch, var(--secondary) 28%, transparent);

                .title {
                    color: var(--link-hover);
                }

                img {
                    scale: 1.05;
                }
            }
        }

        img,
        .placeholder,
        .thumb {
            flex: none;
            width: 44px;
            height: 44px;
            border-radius: 8px;
            object-fit: cover;
            background: var(--secondary);
            transition: scale var(--dur-base) var(--ease-out);
        }

        .placeholder {
            display: grid;
            place-items: center;
            font-family: default-serif;
            font-weight: 600;
            color: var(--muted);
        }
    }

    .text {
        display: grid;
        min-width: 0;
        line-height: 1.3;
    }

    .title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: default-serif;
        font-size: 0.98rem;
        font-weight: 600;
        transition: color var(--dur-fast);
    }

    .description {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.78rem;
        color: var(--muted);
    }

    .skeleton-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.45rem 0;
    }

    .lines {
        display: grid;
        flex: 1;
        gap: 0.45rem;
    }

    .skeleton {
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

        &.thumb {
            border-radius: 8px;
        }

        &.bar {
            width: var(--width);
            height: 0.6rem;
        }
    }


    .more {
        display: flex;
        justify-content: center;
        margin-top: 1.5rem;

        button {
            height: 2.25rem;
            padding: 0 1.1rem;
            border: 1px solid var(--rule);
            border-radius: 999px;
            background: var(--bg-color);
            font: inherit;
            font-size: 0.85rem;
            font-weight: 550;
            color: inherit;
            cursor: pointer;
            transition:
                border-color var(--dur-fast),
                scale var(--dur-instant) var(--ease-out);

            &:hover {
                border-color: var(--secondary);
            }

            &:disabled {
                cursor: progress;
                opacity: 0.7;
            }
        }
    }

    .empty {
        color: var(--muted);
    }

    .error {
        padding-top: 8vh;
    }
</style>
