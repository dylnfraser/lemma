<script lang="ts">
    import type { RelatedTopics } from "$lib/article/types";
    import ChevronIcon from "../icons/ChevronIcon.svelte";

    // Wikipedia's navboxes and series sidebars, kept as quiet expandable lists at the end of the article: the topics
    // stay one click away without the boxes interrupting the reading.
    let { topics }: { topics: RelatedTopics[] } = $props();

    const linkCount = (topic: RelatedTopics) =>
        topic.groups.reduce((count, group) => count + (group.html.match(/<a\s/g)?.length ?? 0), 0);
</script>

<section class="related" aria-labelledby="related-heading">
    <h2 id="related-heading">Related topics</h2>

    {#each topics as topic}
        <details>
            <summary>
                <span class="chevron"><ChevronIcon size={16} /></span>
                <span class="title">{@html topic.title}</span>
                <span class="count">{linkCount(topic)}</span>
            </summary>
            <div class="groups">
                {#each topic.groups as group}
                    <div class="group" class:unlabelled={!group.label}>
                        {#if group.label}<div class="label">{@html group.label}</div>{/if}
                        <div class="links">{@html group.html}</div>
                    </div>
                {/each}
            </div>
        </details>
    {/each}
</section>

<style>
    .related {
        margin: 3rem 0 0;
        padding-top: 1.25rem;
        border-top: 1px solid var(--rule);
    }

    h2 {
        margin: 0 0 0.75rem;
        font-family: default-sans;
        font-size: 0.75rem;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
    }

    details {
        border-bottom: 1px solid color-mix(in oklch, var(--rule) 70%, transparent);
    }

    summary {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.65rem 0;
        cursor: pointer;
        list-style: none;
        font-weight: 600;
        line-height: 1.35;

        &::-webkit-details-marker {
            display: none;
        }

        &:hover .chevron {
            color: var(--text-color);
        }
    }

    .chevron {
        display: grid;
        flex: none;
        color: var(--muted);
        rotate: 180deg;
        transition: rotate var(--dur-fast) var(--ease-out);
    }

    details[open] .chevron {
        rotate: 0deg;
    }

    .title {
        flex: 1;
        min-width: 0;

        :global(a) {
            color: inherit;
            text-decoration: none;
        }

        :global(a:hover) {
            text-decoration: underline;
        }
    }

    .count {
        flex: none;
        padding: 0.05rem 0.5rem;
        border-radius: 999px;
        background: color-mix(in oklch, var(--secondary) 40%, transparent);
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
    }

    .groups {
        display: grid;
        gap: 0.75rem;
        padding: 0.25rem 0 1rem 1.6rem;
        animation: appear var(--dur-base) var(--ease-out);
        font-size: 0.88rem;
        line-height: 1.6;
    }

    .group {
        display: grid;
        grid-template-columns: minmax(6rem, 9rem) 1fr;
        gap: 1rem;

        &.unlabelled {
            grid-template-columns: 1fr;
        }

        @media (max-width: 560px) {
            grid-template-columns: 1fr;
            gap: 0.2rem;
        }
    }

    .label {
        font-size: 0.78rem;
        font-weight: 600;
        line-height: 1.5;
        color: var(--muted);
        padding-top: 0.1rem;

        :global(a) {
            color: inherit;
        }
    }

    /* Wikipedia's link lists, shown inline with dot separators (like its "hlist") */
    .links {
        :global(ul),
        :global(ol) {
            display: inline;
            margin: 0;
            padding: 0;
            list-style: none;
        }

        :global(li) {
            display: inline;
        }

        :global(li:not(:last-child)::after) {
            content: " · ";
            color: var(--muted);
            font-weight: 700;
        }

        /* nested lists ("Novels (Book A · Book B)") read as a parenthesised run */
        :global(li > :is(ul, ol)::before) {
            content: " (";
        }

        :global(li > :is(ul, ol)::after) {
            content: ")";
        }

        :global(a) {
            color: inherit;
            text-decoration-color: color-mix(in oklch, currentColor 30%, transparent);
            text-underline-offset: 0.2em;
        }

        :global(a:hover) {
            color: var(--link-hover);
        }

        :global(img.inline-icon) {
            max-height: 1.1em;
            width: auto;
            vertical-align: -0.15em;
            margin-inline-end: 0.25em;
        }

        :global(p) {
            display: inline;
            margin: 0;
            font-size: inherit;
        }
    }
</style>
