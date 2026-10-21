<script lang="ts">
    import { onMount } from "svelte";
    import { fetchFeaturedFeed, storyToHtml, type FeaturedFeed } from "$lib/api/feed";
    import { getArticlePath } from "$lib/article/articleUtils";

    // Wikipedia's front page, Lemma-style. Fetched in the browser after the (prerendered) home page loads; if it
    // fails, the sections simply don't appear.
    const MOST_READ = 5;
    const STORIES = 3;
    const EVENTS = 3;

    let feed = $state.raw<FeaturedFeed | null>(null);
    let status = $state<"loading" | "ready" | "failed">("loading");
    let stories = $derived(feed?.news.slice(0, STORIES).map((item) => ({ ...item, html: storyToHtml(item.storyHtml) })) ?? []);
    let events = $derived(
        [...(feed?.onThisDay ?? [])].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).slice(0, EVENTS),
    );

    let mostRead = $derived(feed?.mostRead.slice(0, MOST_READ) ?? []);
    // the lists below the introduction share their row evenly, however many Wikipedia sent today
    let lowerCount = $derived([stories, events, mostRead].filter((list) => list.length > 0).length);

    const today = new Date();
    const dayLabel = today.toLocaleDateString("en", { month: "long", day: "numeric" });
    const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

    onMount(() => {
        const controller = new AbortController();
        fetchFeaturedFeed(today, { signal: controller.signal })
            .then((result) => {
                feed = result;
                status = "ready";
            })
            .catch(() => {
                if (!controller.signal.aborted) status = "failed";
            });
        return () => controller.abort();
    });
</script>

{#if status === "loading"}
    <div class="feed" role="status" aria-label="Loading today's articles">
        <section class="area-featured">
            <div class="skeleton bar label"></div>
            <div class="featured skeleton-card">
                <div class="skeleton image"></div>
                <div class="featured-text">
                    <div class="skeleton bar" style:--width="55%"></div>
                    <div class="skeleton bar" style:--width="90%"></div>
                    <div class="skeleton bar" style:--width="80%"></div>
                    <div class="skeleton bar" style:--width="65%"></div>
                </div>
            </div>
        </section>
        <section class="lower">
            <div class="skeleton bar label"></div>
            {#each [85, 70, 78] as width}
                <div class="skeleton bar" style:--width="{width}%"></div>
            {/each}
        </section>
    </div>
{:else if status === "ready" && feed}
    <div class="feed" style:--lower-span={6 / Math.max(lowerCount, 1)}>
        {#if feed.featured}
            {@const page = feed.featured}
            <section class="area-featured" aria-labelledby="featured-heading">
                <h2 id="featured-heading">Today's featured article</h2>
                <a class="featured" href={getArticlePath(page.title)}>
                    {#if page.thumbnail}
                        <img class="image" src={page.thumbnail.src} alt="" decoding="async" />
                    {/if}
                    <div class="featured-text">
                        <p class="featured-title">{page.title}</p>
                        {#if page.description}<p class="description">{page.description}</p>{/if}
                        <p class="extract">{page.extract}</p>
                    </div>
                </a>
            </section>
        {/if}

        {#if stories.length > 0}
            <section class="lower" aria-labelledby="news-heading">
                <h2 id="news-heading">In the news</h2>
                <ul class="stories">
                    {#each stories as story, i}
                        <li class="story" style:--i={i}>{@html story.html}</li>
                    {/each}
                </ul>
            </section>
        {/if}

        {#if events.length > 0}
            <section class="lower" aria-labelledby="otd-heading">
                <h2 id="otd-heading">On this day <span class="date">· {dayLabel}</span></h2>
                <ol class="events">
                    {#each events as event, i}
                        <li style:--i={i}>
                            {#if event.year !== null}<span class="year">{event.year}</span>{/if}
                            {#if event.pages[0]}
                                <a class="event" href={getArticlePath(event.pages[0].title)}>{event.text}</a>
                            {:else}
                                <p>{event.text}</p>
                            {/if}
                        </li>
                    {/each}
                </ol>
            </section>
        {/if}

        {#if mostRead.length > 0}
            <section class="lower" aria-labelledby="mostread-heading">
                <h2 id="mostread-heading">Most read</h2>
                <ol class="most-read">
                    {#each mostRead as page, i}
                        <li style:--i={i}>
                            <a href={getArticlePath(page.title)}>
                                <span class="rank" aria-hidden="true">{i + 1}</span>
                                <span class="mr-title">{page.title}</span>
                                <span class="mr-meta">{compact.format(page.views)}<span class="sr-only"> views</span></span>
                            </a>
                        </li>
                    {/each}
                </ol>
            </section>
        {/if}
    </div>
{/if}

<style>
    /* The feed's sections are laid out by the home page's grid, so the featured article (.area-featured) can sit
       beside the introduction and the lists (.lower) share the row below. */
    .feed {
        display: contents;
    }

    section {
        min-width: 0;

        animation: appear var(--dur-slow) var(--ease-out) both;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    h2 {
        margin: 0 0 0.85rem;
        font-family: default-sans;
        font-size: 0.72rem;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);

        .date {
            font-weight: 500;
            letter-spacing: 0.04em;
        }
    }

    p {
        margin: 0;
        font-size: inherit;
    }

    /* list items arrive in a short cascade after their section */
    .lower li {
        animation: item-in var(--dur-slow) var(--ease-out) both;
        animation-delay: calc(var(--i, 0) * 45ms + 120ms);

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    @keyframes item-in {
        from {
            opacity: 0;
            translate: 0 6px;
        }
    }

    /* ---------- featured article ---------- */

    .featured {
        display: flex;
        gap: 1.25rem;
        align-items: flex-start;
        color: inherit;
        text-decoration: none;

        &:hover .featured-title {
            color: var(--link-hover);
        }

        &:hover .image {
            scale: 1.025;
            rotate: -0.6deg;
            box-shadow: 0 14px 28px -16px var(--shadow-color);
        }

        @media (max-width: 560px) {
            flex-direction: column;
        }
    }

    .image {
        flex: none;
        width: 8.5rem;
        height: 10.5rem;
        border-radius: 10px;
        object-fit: cover;
        object-position: 50% 25%;
        background: var(--secondary);
        outline: 1px solid color-mix(in oklch, var(--text-color) 8%, transparent);
        outline-offset: -1px;
        transition:
            scale var(--dur-base) var(--ease-spring),
            rotate var(--dur-base) var(--ease-spring),
            box-shadow var(--dur-base) var(--ease-out);

        @media (max-width: 560px) {
            width: 100%;
            height: 11rem;
        }
    }

    .featured-text {
        display: grid;
        gap: 0.35rem;
        min-width: 0;
        flex: 1;
    }

    .featured-title {
        font-family: default-serif;
        font-size: 1.35rem;
        font-weight: 600;
        line-height: 1.2;
        text-wrap: balance;
        transition: color var(--dur-fast);
    }

    .description {
        font-size: 0.8rem;
        color: var(--muted);
    }

    .extract {
        margin-top: 0.25rem;
        font-size: 0.9rem;
        line-height: 1.6;
        text-wrap: pretty;
        color: color-mix(in oklch, var(--text-color) 82%, var(--page-bg));
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 4;
        line-clamp: 4;
        overflow: hidden;
    }

    /* ---------- the lower row: three short, quiet lists ---------- */

    .stories,
    .events,
    .most-read {
        display: grid;
        gap: 0.75rem;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 0.88rem;
        line-height: 1.55;
        text-wrap: pretty;
    }

    .story {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        overflow: hidden;

        :global(a) {
            text-decoration-color: color-mix(in oklch, currentColor 28%, transparent);
            text-underline-offset: 0.2em;
        }

        /* Wikipedia bolds each story's main article; a lighter weight keeps it from shouting */
        :global(b),
        :global(strong) {
            font-weight: 600;
        }
    }

    .events li {
        display: grid;
        grid-template-columns: 2.75rem 1fr;
        gap: 0.6rem;
    }

    .year {
        font-weight: 650;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
        transition: color var(--dur-fast);
    }

    .events li:has(.event:hover) .year {
        color: var(--accent);
    }

    .event {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        overflow: hidden;
        color: inherit;
        text-decoration: none;
        transition: color var(--dur-fast);

        &:hover {
            color: var(--link-hover);
        }
    }

    .most-read {
        gap: 0.15rem;

        a {
            display: flex;
            align-items: baseline;
            gap: 0.6rem;
            padding: 0.2rem 0;
            color: inherit;
            text-decoration: none;

            &:hover {
                .mr-title {
                    color: var(--link-hover);
                    translate: 0.2rem 0;
                }

                .rank {
                    color: var(--accent);
                }
            }
        }
    }

    /* ranks match the years beside them: same size, weight and figures */
    .rank {
        flex: none;
        width: 1.1rem;
        font-weight: 650;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
        transition: color var(--dur-fast);
    }

    .mr-title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition:
            color var(--dur-fast),
            translate var(--dur-base) var(--ease-out);
    }

    .mr-meta {
        flex: none;
        font-size: 0.78rem;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
    }

    /* ---------- loading ---------- */

    .skeleton-card {
        pointer-events: none;
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
        animation: skeleton-shimmer 1.4s ease-in-out infinite;

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    .skeleton.image {
        border-radius: 10px;
    }

    .bar {
        width: var(--width, 100%);
        height: 0.6rem;
        margin: 0.45rem 0;
    }

    .bar.label {
        width: 9rem;
        margin: 0 0 1.4rem;
    }

    @keyframes skeleton-shimmer {
        from {
            background-position: 200% 0;
        }

        to {
            background-position: -200% 0;
        }
    }
</style>
