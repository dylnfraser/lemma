<script lang="ts">
    import type { Assessment } from "$lib/api/wikipedia";
    import { SOURCE_KINDS, SOURCE_LABELS, percentOf, totalSources, type SourceMix } from "$lib/article/sources";
    import Icon from "../icons/Icon.svelte";

    // Above the reference list, how far to trust the article: Wikipedia's own rating, how many sources it cites and of
    // what kind (one bar and a key; each reference below carries the same label and colour), and the claims its editors
    // have flagged as needing a source.
    interface Props {
        sources: SourceMix;
        assessment?: Assessment | null;
        /** Ids of the claims flagged as needing a source, in reading order. */
        claims?: string[];
        onJump?: (id: string) => void;
    }

    let { sources, assessment = null, claims = [], onJump }: Props = $props();

    const RATINGS = {
        featured: { icon: "star", label: "Featured article", help: "One of Wikipedia's best articles, as judged by its editors" },
        good: { icon: "badge-check", label: "Good article", help: "Meets Wikipedia's good article criteria, as reviewed by its editors" },
    } as const;

    // each press goes to the next flagged claim, round and round
    let nextClaim = 0;
    function goToNextClaim() {
        onJump?.(claims[nextClaim % claims.length]);
        nextClaim++;
    }

    let total = $derived(totalSources(sources));
    let kinds = $derived(
        SOURCE_KINDS.filter((kind) => sources[kind] > 0).map((kind) => ({
            kind,
            count: sources[kind],
            percent: percentOf(sources[kind], total),
        })),
    );
</script>

<div class="source-mix" role="group" aria-label="About the sources">
    <div class="summary">
        {#if assessment}
            <span class="rating" title={RATINGS[assessment].help}>
                <Icon name={RATINGS[assessment].icon} size="0.95em" />{RATINGS[assessment].label}
            </span>
        {/if}
        <span class="total"><Icon name="book-open" size="0.95em" />{total.toLocaleString()} sources</span>
        {#if claims.length > 0 && onJump}
            <button
                type="button"
                class="flags"
                title="Claims Wikipedia's editors have flagged as needing a source: go to the next one"
                onclick={goToNextClaim}
            >
                <Icon name="flag" size="0.95em" />{claims.length}
                {claims.length === 1 ? "citation" : "citations"} needed
            </button>
        {/if}
    </div>
    <div class="bar" aria-hidden="true">
        {#each kinds as { kind, count } (kind)}
            <span class="{kind}" style:flex-grow={count}></span>
        {/each}
    </div>
    <!-- plain elements: the article's own list and paragraph styles would reach a <ul> or <p> in here -->
    <div class="key" role="list">
        {#each kinds as { kind, count, percent } (kind)}
            <span class="item {kind}" role="listitem">
                <span class="dot" aria-hidden="true"></span>{SOURCE_LABELS[kind]}
                <span class="count">{count.toLocaleString()} · {percent}</span>
            </span>
        {/each}
    </div>
    <div class="note">Of {total.toLocaleString()} cited sources, judged from each citation's type and where it links</div>
</div>

<style>
    .source-mix {
        margin: 0.25rem 0 1.5rem;
        font-size: 0.8rem;
    }

    .summary {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.3rem 1.1rem;
        margin-bottom: 0.65rem;

        > * {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
        }
    }

    .total {
        font-weight: 600;
    }

    .rating {
        font-weight: 600;
        color: var(--accent);
    }

    .flags {
        padding: 0;
        border: none;
        background: none;
        font: inherit;
        color: color-mix(in oklch, var(--danger) 70%, var(--muted));
        cursor: pointer;
        text-decoration: underline;
        text-decoration-color: transparent;
        text-underline-offset: 0.2em;
        transition: text-decoration-color var(--dur-base) var(--ease-out);

        &:hover {
            text-decoration-color: color-mix(in oklch, currentColor 45%, transparent);
        }
    }

    .bar {
        display: flex;
        gap: 2px;
        height: 0.5rem;
        overflow: hidden;
        border-radius: 999px;

        span {
            flex: 0 0 0;
            min-width: 3px;
            background: var(--source-color);
        }
    }

    .key {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem 1.1rem;
        margin-top: 0.6rem;
    }

    .item {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 550;
    }

    .dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        background: var(--source-color);
    }

    .count {
        font-weight: 400;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
    }

    .note {
        margin-top: 0.45rem;
        font-size: 0.72rem;
        color: var(--muted);
    }

    .academic {
        --source-color: var(--source-academic);
    }

    .book {
        --source-color: var(--source-book);
    }

    .news {
        --source-color: var(--source-news);
    }

    .government {
        --source-color: var(--source-government);
    }

    .web {
        --source-color: var(--source-web);
    }
</style>
