<script lang="ts">
    import { headingHasChildren, isHeadingHiddenByCollapsed } from "$lib/article/articleNavigation";
    import type { ArticleHeading } from "$lib/article/types";
    import ChevronIcon from "../icons/ChevronIcon.svelte";

    interface Props {
        headings: ArticleHeading[];
        activeId: string;
        /** Whether the active entry is visually highlighted; it stays marked as current for assistive tech either way. */
        highlightActive: boolean;
        collapsedIds: ReadonlySet<string>;
        onToggle: (id: string) => void;
        onOpen: (id: string, event: MouseEvent) => void;
    }

    let { headings, activeId, highlightActive, collapsedIds, onToggle, onOpen }: Props = $props();

    let list: HTMLElement;

    // Keep the active entry visible by scrolling the outline itself (never the page).
    $effect(() => {
        if (!activeId || !list) return;
        const active = list.querySelector<HTMLElement>('.breadcrumb[aria-current="location"]');
        if (!active) return;

        const padding = 40;
        const listRect = list.getBoundingClientRect();
        const itemRect = active.getBoundingClientRect();

        if (itemRect.top < listRect.top + padding) {
            list.scrollTop -= listRect.top + padding - itemRect.top;
        } else if (itemRect.bottom > listRect.bottom - padding) {
            list.scrollTop += itemRect.bottom - (listRect.bottom - padding);
        }
    });
</script>

<p class="outline-title" aria-hidden="true">Contents</p>
<nav class="crumbs" bind:this={list} aria-label="Article sections">
    <ul>
        {#each headings as heading (heading.id)}
            {#if !isHeadingHiddenByCollapsed(heading, collapsedIds)}
                {@const collapsed = collapsedIds.has(heading.id)}
                <li class="breadcrumb-row">
                    {#if headingHasChildren(heading)}
                        <button
                            class="breadcrumb-fold"
                            type="button"
                            aria-label={`${collapsed ? "Expand" : "Collapse"} ${heading.text}`}
                            aria-expanded={!collapsed}
                            onclick={() => onToggle(heading.id)}
                        >
                            <ChevronIcon {collapsed} size={16} />
                        </button>
                    {:else}
                        <span class="breadcrumb-fold-spacer"></span>
                    {/if}
                    <a
                        class="breadcrumb breadcrumb-{heading.tag.toLowerCase()}"
                        class:active={activeId === heading.id && highlightActive}
                        class:faded={activeId === heading.id && !highlightActive}
                        aria-current={activeId === heading.id ? "location" : undefined}
                        href="#{encodeURIComponent(heading.id)}"
                        onclick={(event) => onOpen(heading.id, event)}>{heading.text}</a
                    >
                </li>
            {/if}
        {/each}
    </ul>
</nav>

<style>
    .outline-title {
        margin: 0 0 0.85rem 1.2rem;
        font-size: 0.72rem;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
    }

    .crumbs {
        flex: 1;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 2px 10px 3rem 2px;
        scrollbar-gutter: stable;
        mask-image: linear-gradient(to bottom, black calc(100% - 3rem), transparent);
    }

    ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .breadcrumb-row {
        display: flex;
        align-items: flex-start;
        gap: 0.2rem;
        min-width: 0;
        margin-bottom: 0.25rem;
    }

    .breadcrumb-fold,
    .breadcrumb-fold-spacer {
        flex: 0 0 1rem;
        width: 1rem;
        height: 1.25rem;
        margin: 0;
    }

    .breadcrumb-fold {
        display: grid;
        place-items: center;
        border: none;
        padding: 0;
        background: none;
        cursor: pointer;
        opacity: 0.6;

        &:hover {
            opacity: 1;
        }
    }

    .breadcrumb {
        display: block;
        min-width: 0;
        line-height: 1.25rem;
        opacity: 0.8;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-decoration: none;
        transition:
            color 0.15s ease,
            font-weight 0.15s ease,
            opacity 0.15s ease;

        &:hover {
            opacity: 1;
            text-decoration: underline;
        }

        /* the post-load highlight eases out slowly rather than snapping off */
        &.faded {
            transition-duration: 0.9s;
        }

        @media (prefers-reduced-motion: reduce) {
            transition: none;
        }
    }

    .breadcrumb.active {
        color: var(--accent);
        font-weight: 700;
        opacity: 1;
    }

    .breadcrumb-h1 {
        font-size: 1rem;
        font-weight: 650;
    }

    .breadcrumb-h2 {
        font-size: 0.95rem;
        font-weight: 600;
        margin-left: 0.35rem;
    }

    .breadcrumb-h3 {
        font-size: 0.85rem;
        font-weight: 500;
        margin-left: 0.9rem;
    }

    .breadcrumb-h4 {
        font-size: 0.78rem;
        font-weight: 450;
        margin-left: 1.35rem;
    }

    .breadcrumb-h5 {
        font-size: 0.72rem;
        font-weight: 425;
        margin-left: 1.75rem;
    }

    .breadcrumb-h6 {
        font-size: 0.68rem;
        font-weight: 400;
        margin-left: 2.1rem;
    }
</style>
