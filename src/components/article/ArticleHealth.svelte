<script lang="ts">
    import type { Assessment, EditActivity, Protection } from "$lib/api/wikipedia";
    import { SOURCE_KINDS, SOURCE_LABELS, percentOf, totalSources, type SourceMix } from "$lib/article/sources";
    import Icon from "../icons/Icon.svelte";

    // A quiet line under the title on how far to trust what follows: Wikipedia's own rating, how it's sourced, what
    // its editors have flagged, who may edit it, and how busy the editing is right now.
    interface Props {
        assessment: Assessment | null;
        protection: Protection | null;
        sources: SourceMix;
        /** Ids of the claims flagged as needing a source. */
        claims: string[];
        /** Arrives after the article (a separate request), or never. */
        activity: EditActivity | null;
        /** The References section, for the sources count to jump to. */
        sourcesTarget: string;
        onJump: (id: string) => void;
    }

    let { assessment, protection, sources, claims, activity, sourcesTarget, onJump }: Props = $props();

    const RATINGS = {
        featured: { icon: "star", label: "Featured article", help: "One of Wikipedia's best articles, as judged by its editors" },
        good: { icon: "badge-check", label: "Good article", help: "Meets Wikipedia's good article criteria, as reviewed by its editors" },
    } as const;

    const PROTECTIONS = {
        semi: { label: "Semi-protected", help: "Only established accounts can edit it, usually after vandalism" },
        extended: { label: "Extended protected", help: "Only experienced editors can edit it, usually because it's contentious" },
        full: { label: "Fully protected", help: "Only administrators can edit it, usually during a dispute" },
        pending: { label: "Edits reviewed", help: "Edits by new accounts are checked before they show" },
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

    let edits = $derived(activity?.editsThisWeek ?? 0);
</script>

{#if assessment || total > 0 || claims.length > 0 || protection || edits > 0}
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
        {#if protection}
            <li title={PROTECTIONS[protection].help}><Icon name="lock" size="0.95em" />{PROTECTIONS[protection].label}</li>
        {/if}
        {#if edits > 0}
            <li class="arrived" title="Edits to this article in the past seven days">
                <Icon name="pencil" size="0.95em" />{edits >= 50 ? "50+" : edits}
                {edits === 1 ? "edit" : "edits"} this week{#if activity && activity.editorsThisWeek > 1}&nbsp;by {activity.editorsThisWeek} editors{/if}
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

    /* edit activity comes a moment after the article */
    .arrived {
        animation: fade-in var(--dur-base) var(--ease-out) backwards;
    }
</style>
