<script lang="ts">
    import { onMount } from "svelte";
    import { fetchRelatedArticles, getWikipediaArticleUrl, type RelatedArticle } from "$lib/api/wikipedia";
    import { getArticlePath } from "$lib/article/articleUtils";
    import Icon from "../icons/Icon.svelte";

    // The end of the article: articles like this one, then its categories. Related articles are only requested once
    // the reader scrolls near the end, so most article views never make the extra request.
    let { title, categories }: { title: string; categories: string[] } = $props();

    // long category lists (some articles have 60+) start trimmed
    const CATEGORY_PREVIEW = 12;
    let showAllCategories = $state(false);
    let shownCategories = $derived(showAllCategories ? categories : categories.slice(0, CATEGORY_PREVIEW));

    let section = $state<HTMLElement>();
    let related = $state<RelatedArticle[] | null>(null);

    onMount(() => {
        const controller = new AbortController();
        const observer = new IntersectionObserver(
            async ([entry]) => {
                if (!entry.isIntersecting) return;
                observer.disconnect();
                try {
                    related = await fetchRelatedArticles(title, { signal: controller.signal });
                } catch {
                    related = []; // quietly leave the section out
                }
            },
            { rootMargin: "800px 0px" },
        );
        if (section) observer.observe(section);
        return () => {
            observer.disconnect();
            controller.abort();
        };
    });
</script>

<section class="read-next" bind:this={section}>
    {#if related === null || related.length > 0}
        <h2>Read next</h2>
        <ul class="cards" aria-busy={related === null}>
            {#if related === null}
                {#each { length: 4 } as _}
                    <li class="card skeleton" aria-hidden="true"><span></span></li>
                {/each}
            {:else}
                {#each related as article, i (article.title)}
                    <li class="arrived" style:--i={i}>
                        <a class="card" href={getArticlePath(article.title)}>
                            {#if article.thumbnail}
                                <img src={article.thumbnail} alt="" loading="lazy" decoding="async" />
                            {:else}
                                <span class="placeholder" aria-hidden="true">{article.title.slice(0, 1)}</span>
                            {/if}
                            <span class="text">
                                <span class="title">{article.title}</span>
                                {#if article.description}<span class="description">{article.description}</span>{/if}
                            </span>
                        </a>
                    </li>
                {/each}
            {/if}
        </ul>
    {/if}

    {#if categories.length > 0}
        <h2>Categories</h2>
        <ul class="categories">
            {#each shownCategories as category}
                <li>
                    <a href={getWikipediaArticleUrl(`Category:${category}`)} target="_blank" rel="noopener noreferrer"
                        >{category}<span class="sr-only"> (opens Wikipedia in a new tab)</span></a
                    >
                </li>
            {/each}
            {#if categories.length > CATEGORY_PREVIEW}
                <li>
                    <button type="button" class="more" aria-expanded={showAllCategories} onclick={() => (showAllCategories = !showAllCategories)}>
                        {showAllCategories ? "Show fewer" : `Show all ${categories.length}`}
                    </button>
                </li>
            {/if}
        </ul>
        <p class="note"><Icon name="arrow-up-right" size="0.8em" /> Categories open on Wikipedia</p>
    {/if}
</section>

<style>
    .read-next {
        margin-top: 3rem;
    }

    h2 {
        margin: 2rem 0 0.75rem;
        padding: 0;
        border: none;
        font-family: default-sans;
        font-size: 0.75rem;
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

    .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(15rem, 100%), 1fr));
        gap: 0.6rem;
    }

    .card {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-height: 4rem;
        padding: 0.5rem;
        box-sizing: border-box;
        border: 1px solid var(--rule);
        border-radius: 12px;
        background: var(--bg-color);
        color: inherit;
        text-decoration: none;
        transition:
            border-color var(--dur-fast),
            translate var(--dur-fast) var(--ease-out),
            box-shadow var(--dur-fast);

        &:hover {
            color: inherit;
            border-color: var(--secondary);
            translate: 0 -1px;
            box-shadow: 0 10px 24px -16px var(--shadow-color);

            img {
                scale: 1.05;
            }

            .title {
                color: var(--link-hover);
            }
        }
    }

    /* loaded cards replace the skeletons in a short cascade */
    .arrived {
        animation: card-in var(--dur-slow) var(--ease-out) both;
        animation-delay: calc(var(--i) * 50ms);

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    @keyframes card-in {
        from {
            opacity: 0;
            translate: 0 6px;
        }
    }

    img,
    .placeholder {
        flex: none;
        width: 48px;
        height: 48px;
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

    .text {
        display: grid;
        min-width: 0;
        line-height: 1.3;
    }

    .title {
        overflow: hidden;
        font-family: default-serif;
        font-size: 0.95rem;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: color var(--dur-fast);
    }

    .description {
        display: -webkit-box;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        font-size: 0.78rem;
        color: var(--muted);
    }

    .skeleton {
        height: 4rem;
        background: color-mix(in oklch, var(--secondary) 25%, var(--bg-color));
        animation: pulse 1.4s ease-in-out infinite;

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    @keyframes pulse {
        50% {
            opacity: 0.55;
        }
    }

    .categories {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;

        a {
            display: inline-block;
            padding: 0.25rem 0.7rem;
            border: 1px solid var(--rule);
            border-radius: 999px;
            font-size: 0.8rem;
            color: inherit;
            text-decoration: none;
            transition: border-color var(--dur-fast);

            &:hover {
                color: var(--link-hover);
                border-color: color-mix(in oklch, var(--accent) 40%, var(--rule));
            }
        }
    }

    .more {
        padding: 0.25rem 0.7rem;
        border: 1px dashed var(--rule);
        border-radius: 999px;
        background: none;
        font: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--muted);
        cursor: pointer;

        &:hover {
            color: var(--text-color);
            border-color: var(--secondary);
        }
    }

    .note {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        margin: 0.6rem 0 0;
        font-size: 0.72rem;
        color: var(--muted);
    }
</style>
