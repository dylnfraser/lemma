<script lang="ts">
    import { SvelteSet } from "svelte/reactivity";
    import type { RelatedTopics } from "$lib/article/types";
    import { fold } from "$lib/motion";
    import ChevronIcon from "../icons/ChevronIcon.svelte";

    // Wikipedia's navboxes and series sidebars, kept as quiet expandable lists at the end of the article: the topics
    // stay one click away without the boxes interrupting the reading.
    let { topics }: { topics: RelatedTopics[] } = $props();

    const uid = $props.id();
    // which topics are open (by position); each opens and folds away like an article section
    const open = new SvelteSet<number>();

    function toggle(index: number) {
        if (open.has(index)) open.delete(index);
        else open.add(index);
    }

    const linkCount = (topic: RelatedTopics) =>
        topic.groups.reduce((count, group) => count + (group.html.match(/<a\s/g)?.length ?? 0), 0);
</script>

<section class="related" aria-labelledby="related-heading">
    <h2 id="related-heading">Related topics</h2>

    {#each topics as topic, i}
        <div class="topic" class:open={open.has(i)}>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (the row is a larger target for the button inside it; links in the title still work) -->
            <div class="summary" onclick={(event) => !(event.target as Element).closest("a, button") && toggle(i)}>
                <button
                    type="button"
                    class="chevron"
                    aria-expanded={open.has(i)}
                    aria-controls="{uid}-topic-{i}"
                    aria-label="{open.has(i) ? 'Hide' : 'Show'} related topics"
                    onclick={() => toggle(i)}
                >
                    <ChevronIcon collapsed={!open.has(i)} />
                </button>
                <span class="title">{@html topic.title}</span>
                <span class="count">{linkCount(topic)}</span>
            </div>
            {#if open.has(i)}
                <div class="groups" id="{uid}-topic-{i}" transition:fold>
                    {#each topic.groups as group}
                        <div class="group" class:unlabelled={!group.label}>
                            {#if group.label}<div class="label">{@html group.label}</div>{/if}
                            <div class="links">{@html group.html}</div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
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

    .topic {
        border-bottom: 1px solid color-mix(in oklch, var(--rule) 70%, transparent);
    }

    /* the title lines up with "Related topics" above; the chevron hangs in the margin, like an article heading's */
    .summary {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.7rem 0;
        cursor: pointer;
        font-weight: 600;
        line-height: 1.35;

        &:hover .chevron {
            color: var(--text-color);
        }
    }

    .chevron {
        position: absolute;
        left: -2rem;
        top: 50%;
        translate: 0 -50%;
        display: grid;
        place-items: center;
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: none;
        color: var(--muted);
        cursor: pointer;
        transition:
            color var(--dur-base) var(--ease-out),
            background-color var(--dur-base) var(--ease-out);

        @media (hover: hover) {
            &:hover {
                background: color-mix(in oklch, var(--secondary) 40%, transparent);
            }
        }

        /* no margin to sit in: it moves to the row's right edge, after the count (as in the article) */
        @media (max-width: 1050px) {
            position: static;
            translate: none;
            order: 1;
        }
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
        gap: 0.9rem;
        padding: 0.15rem 0 1.25rem;
        font-size: 0.88rem;
        line-height: 1.75;
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

        /* an entry keeps its separator, so a wrapped line never starts with a stray dot */
        :global(li:not(:has(> ul, > ol))) {
            white-space: nowrap;
        }

        :global(li:not(:last-child)::after) {
            content: "·";
            margin-inline: 0.45em;
            color: color-mix(in oklch, var(--muted) 70%, transparent);
            font-weight: 700;
        }

        /* nested lists ("Novels (Book A · Book B)") read as a parenthesised run */
        :global(li > :is(ul, ol)::before) {
            content: " (";
        }

        :global(li > :is(ul, ol)::after) {
            content: ")";
        }

        /* a quiet list: links underline when hovered, rather than every entry carrying a line */
        :global(a) {
            color: inherit;
            text-decoration: underline;
            text-decoration-color: transparent;
            text-underline-offset: 0.2em;
            transition:
                color var(--dur-base) var(--ease-out),
                text-decoration-color var(--dur-base) var(--ease-out);
        }

        :global(a:hover) {
            color: var(--link-hover);
            text-decoration-color: color-mix(in oklch, currentColor 45%, transparent);
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
