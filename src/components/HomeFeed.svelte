<script lang="ts">
    import { onMount } from "svelte";
    import { fetchFeaturedFeed, type FeaturedFeed } from "$lib/api/feed";
    import { getArticlePath, getFilePath } from "$lib/article/articleUtils";

    // A little of Wikipedia's front page, under the search: today's featured article and picture as two quiet rows,
    // with what people are reading beside them. Fetched in the browser after the (prerendered) home page loads; if it
    // fails, nothing appears.
    const MOST_READ = 5;

    // the home page passes today's feed on to its tagline
    let { onload }: { onload?: (feed: FeaturedFeed) => void } = $props();

    let feed = $state.raw<FeaturedFeed | null>(null);
    let status = $state<"loading" | "ready" | "failed">("loading");
    let mostRead = $derived(feed?.mostRead.slice(0, MOST_READ) ?? []);

    const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

    onMount(() => {
        const controller = new AbortController();
        fetchFeaturedFeed(new Date(), { signal: controller.signal })
            .then((result) => {
                feed = result;
                onload?.(result);
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
        <div class="today" aria-hidden="true">
            {#each { length: 2 } as _}
                <div class="item">
                    <span class="skeleton thumb"></span>
                    <span class="lines">
                        <span class="skeleton bar" style:--width="40%"></span>
                        <span class="skeleton bar" style:--width="75%"></span>
                        <span class="skeleton bar" style:--width="60%"></span>
                    </span>
                </div>
            {/each}
        </div>
        <div class="reading" aria-hidden="true">
            <span class="skeleton bar label"></span>
            {#each [70, 55, 80, 60, 65] as width}
                <span class="skeleton bar" style:--width="{width}%"></span>
            {/each}
        </div>
    </div>
{:else if status === "ready" && feed && (feed.featured || feed.picture || mostRead.length > 0)}
    <div class="feed">
        {#if feed.featured || feed.picture}
            <section class="today" aria-label="Today on Wikipedia">
                {#if feed.featured}
                    {@const page = feed.featured}
                    <a class="item" href={getArticlePath(page.title)} style:--i={0}>
                        <span class="thumb">
                            {#if page.thumbnail}<img src={page.thumbnail.src} alt="" decoding="async" />{/if}
                        </span>
                        <span class="text">
                            <span class="label">Featured article</span>
                            <span class="title">{page.title}</span>
                            <span class="note">{page.description || page.extract}</span>
                        </span>
                    </a>
                {/if}
                {#if feed.picture}
                    {@const picture = feed.picture}
                    <a class="item" href={getFilePath(picture.file)} style:--i={1}>
                        <span class="thumb"><img src={picture.src} alt="" decoding="async" /></span>
                        <span class="text">
                            <span class="label">Picture of the day</span>
                            <span class="note two-lines">{picture.description || picture.file}</span>
                        </span>
                    </a>
                {/if}
            </section>
        {/if}

        {#if mostRead.length > 0}
            <section class="reading" aria-labelledby="mostread-heading" style:--i={0}>
                <h2 id="mostread-heading" class="label">Most read</h2>
                <ol>
                    {#each mostRead as page, i}
                        <li>
                            <a href={getArticlePath(page.title)}>
                                <span class="rank" aria-hidden="true">{i + 1}</span>
                                <span class="mr-title">{page.title}</span>
                                <span class="views">{compact.format(page.views)}<span class="sr-only"> views</span></span>
                            </a>
                        </li>
                    {/each}
                </ol>
            </section>
        {/if}
    </div>
{/if}

<style>
    /* today's picks on the left, most read on the right; stacked on narrow screens */
    .feed {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
        gap: 2rem clamp(2rem, 5vw, 3.5rem);
        align-items: start;
        text-align: left;

        @media (max-width: 680px) {
            grid-template-columns: minmax(0, 1fr);
        }
    }

    .today,
    .reading,
    .today .item {
        animation: enter var(--dur-slow) var(--ease-out) backwards;
        animation-delay: calc(var(--i, 0) * var(--stagger) + 150ms);
    }

    .today {
        display: grid;
        gap: 0.5rem;
        animation: none;
    }

    .label {
        display: block;
        margin: 0 0 0.15rem;
        font-family: default-sans;
        font-size: 0.68rem;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
    }

    /* ---------- featured article and picture: a thumbnail and a line or two ---------- */

    .item {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        margin-inline: -0.6rem;
        padding: 0.6rem;
        border-radius: 12px;
        color: inherit;
        text-decoration: none;
        transition: background-color var(--dur-base) var(--ease-out);

        &:hover {
            background: color-mix(in oklch, var(--secondary) 26%, transparent);

            .title {
                color: var(--link-hover);
            }

            img {
                scale: 1.06;
            }
        }
    }

    .thumb {
        flex: none;
        width: 4rem;
        height: 4rem;
        overflow: hidden;
        border-radius: 10px;
        background: var(--secondary);
        outline: 1px solid var(--image-edge);
        outline-offset: -1px;

        img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: 50% 25%;
            transition: scale var(--dur-slow) var(--ease-out);
        }
    }

    .text {
        display: grid;
        min-width: 0;
        line-height: 1.35;
    }

    .title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: default-serif;
        font-size: 1.05rem;
        font-weight: 600;
        transition: color var(--dur-base) var(--ease-out);
    }

    .note {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.82rem;
        color: var(--muted);

        &.two-lines {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            line-clamp: 2;
            white-space: normal;
            color: color-mix(in oklch, var(--text-color) 80%, var(--page-bg));
        }
    }

    /* ---------- most read ---------- */

    .reading {
        padding-top: 0.6rem;

        .label {
            margin-bottom: 0.45rem;
        }
    }

    ol {
        display: grid;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 0.9rem;

        a {
            display: flex;
            align-items: baseline;
            gap: 0.65rem;
            padding: 0.28rem 0;
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

    .rank {
        flex: none;
        width: 1rem;
        font-weight: 650;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
        transition: color var(--dur-base) var(--ease-out);
    }

    .mr-title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition:
            color var(--dur-base) var(--ease-out),
            translate var(--dur-base) var(--ease-out);
    }

    .views {
        flex: none;
        font-size: 0.76rem;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
    }

    /* ---------- loading ---------- */

    .skeleton {
        display: block;
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
            border-radius: 10px;
            outline: none;
        }
    }

    .lines {
        display: grid;
        flex: 1;
    }

    .bar {
        width: var(--width, 100%);
        height: 0.55rem;
        margin: 0.3rem 0;

        &.label {
            width: 6rem;
            margin-bottom: 0.9rem;
        }
    }
</style>
