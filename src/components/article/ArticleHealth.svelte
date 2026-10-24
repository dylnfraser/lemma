<script lang="ts">
    import type { Assessment } from "$lib/api/wikipedia";
    import { SOURCE_KINDS, SOURCE_LABELS, percentOf, totalSources, type SourceMix } from "$lib/article/sources";
    import Icon from "../icons/Icon.svelte";

    // A quiet line under the title on how far to trust what follows: Wikipedia's own rating, how it's sourced, and what
    // its editors have flagged. (How it's being edited, and by whom, is in the footer.)
    interface Props {
        assessment: Assessment | null;
        sources: SourceMix;
        /** Ids of the claims flagged as needing a source. */
        claims: string[];
        /** The References section, for the sources count to jump to. */
        sourcesTarget: string;
        onJump: (id: string) => void;
    }

    let { assessment, sources, claims, sourcesTarget, onJump }: Props = $props();

    const RATINGS = {
        featured: { icon: "star", label: "Featured article", help: "One of Wikipedia's best articles, as judged by its editors" },
        good: { icon: "badge-check", label: "Good article", help: "Meets Wikipedia's good article criteria, as reviewed by its editors" },
    } as const;

    let total = $derived(totalSources(sources));
    let mix = $derived(
        SOURCE_KINDS.filter((kind) => sources[kind] > 0).map((kind) => ({ kind, share: sources[kind] / total })),
    );
    let mixDescription = $derived(mix.map(({ kind }) => `${SOURCE_LABELS[kind]} ${percentOf(sources[kind], total)}`).join(" · "));

    // each press goes to the next flagged claim, round and round
    let nextClaim = 0;
    function goToNextClaim() {
        onJump(claims[nextClaim % claims.length]);
        nextClaim++;
    }

</script>

{#if assessment || total > 0 || claims.length > 0}
    <ul class="health" aria-label="About this article">
        {#if assessment}
            <li class="rating {assessment}" title={RATINGS[assessment].help}>
                <Icon name={RATINGS[assessment].icon} size="0.95em" />{RATINGS[assessment].label}
            </li>
        {/if}
        {#if total > 0}
            <li>
                <button type="button" title="Sources: {mixDescription}" onclick={() => onJump(sourcesTarget)}>
                    <Icon name="book-open" size="0.95em" />{total.toLocaleString()} sources
                    <span class="mix" aria-hidden="true">
                        {#each mix as { kind, share } (kind)}
                            <span class="segment {kind}" style:flex-grow={share}></span>
                        {/each}
                    </span>
                    <span class="sr-only">({mixDescription})</span>
                </button>
            </li>
        {/if}
        {#if claims.length > 0}
            <li>
                <button type="button" class="flags" title="Go to the next one" onclick={goToNextClaim}>
                    <Icon name="flag" size="0.95em" />{claims.length}
                    {claims.length === 1 ? "claim needs" : "claims need"} a source
                </button>
            </li>
        {/if}
    </ul>
{/if}

<style>
    .health {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.3rem 1.1rem;
        margin: 0.7rem 0 0;
        padding: 0;
        list-style: none;
        font-size: 0.8rem;
        line-height: 1.4;
        color: var(--muted);
    }

    /* set apart by space and their icons (dots between them would be left dangling where the line wraps) */
    li {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
    }

    .rating {
        font-weight: 600;
        color: var(--accent);
    }

    button {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0;
        border: none;
        background: none;
        font: inherit;
        color: inherit;
        cursor: pointer;
        text-decoration: underline;
        text-decoration-color: transparent;
        text-underline-offset: 0.2em;
        transition:
            color var(--dur-base) var(--ease-out),
            text-decoration-color var(--dur-base) var(--ease-out);

        &:hover {
            color: var(--text-color);
            text-decoration-color: color-mix(in oklch, currentColor 40%, transparent);
        }
    }

    .flags {
        color: color-mix(in oklch, var(--danger) 70%, var(--muted));
    }

    /* the mix of sources, in miniature (the same colours as the reference labels) */
    .mix {
        display: inline-flex;
        gap: 1px;
        width: 2.75rem;
        height: 0.4rem;
        margin-left: 0.15rem;
        overflow: hidden;
        border-radius: 999px;
    }

    .segment {
        flex: 0 0 0;
        min-width: 2px;
        background: var(--source-color);
    }

    .segment.academic {
        --source-color: var(--source-academic);
    }

    .segment.book {
        --source-color: var(--source-book);
    }

    .segment.news {
        --source-color: var(--source-news);
    }

    .segment.government {
        --source-color: var(--source-government);
    }

    .segment.web {
        --source-color: var(--source-web);
    }
</style>
