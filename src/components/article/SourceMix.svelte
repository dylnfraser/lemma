<script lang="ts">
    import { SOURCE_KINDS, SOURCE_LABELS, percentOf, totalSources, type SourceMix } from "$lib/article/sources";

    // Above the reference list: what the article's sources are, as one bar and a key. Each reference below carries the
    // same label and colour.
    let { sources }: { sources: SourceMix } = $props();

    let total = $derived(totalSources(sources));
    let kinds = $derived(
        SOURCE_KINDS.filter((kind) => sources[kind] > 0).map((kind) => ({
            kind,
            count: sources[kind],
            percent: percentOf(sources[kind], total),
        })),
    );
</script>

<div class="source-mix" role="group" aria-label="Kinds of source">
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
