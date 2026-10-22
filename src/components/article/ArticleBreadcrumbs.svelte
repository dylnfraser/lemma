<script lang="ts">
    import { untrack } from "svelte";
    import { headingHasChildren, isHeadingHiddenByCollapsed } from "$lib/article/articleNavigation";
    import type { ArticleHeading } from "$lib/article/types";
    import { DURATION, fold } from "$lib/motion";
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
    let track: HTMLElement;

    // Accent bar that glides along a fixed rail to the active entry. Positioned from the link's layout box.
    let indicator = $state<{ y: number; height: number } | null>(null);
    // No gliding into place on first render; only later moves animate.
    let indicatorReady = $state(false);

    function placeIndicator() {
        const active = track?.querySelector<HTMLElement>('.breadcrumb[aria-current="location"]');
        const next = active ? { y: active.offsetTop, height: active.offsetHeight } : null;
        indicator = next;
        if (next && !indicatorReady) requestAnimationFrame(() => (indicatorReady = true));
    }

    $effect(() => {
        void activeId;
        void collapsedIds.size;
        // untracked: placing the indicator reads and writes its own state, which must not re-trigger this effect
        untrack(placeIndicator);
    });

    // Folding entries animate their height; follow them frame by frame instead of jumping at the end.
    $effect(() => {
        const observer = new ResizeObserver(placeIndicator);
        observer.observe(track);
        return () => observer.disconnect();
    });

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
    <div class="track" bind:this={track}>
        <span
            class="indicator"
            class:on={indicator && highlightActive}
            class:ready={indicatorReady}
                style:--y="{indicator?.y ?? 0}px"
            style:--h="{indicator?.height ?? 0}px"
            aria-hidden="true"
        ></span>
        <ul>
            {#each headings as heading (heading.id)}
                {#if !isHeadingHiddenByCollapsed(heading, collapsedIds)}
                    {@const collapsed = collapsedIds.has(heading.id)}
                    <li class="breadcrumb-row" transition:fold={{ duration: DURATION.fast }}>
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
    </div>
</nav>

<style>
    .outline-title {
        /* aligned with the entries' text: rail padding + fold-button column */
        margin: 0 0 0.85rem calc(12px + 1.2rem + 2px);
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

    /* entries sit right of a faint rail; the active marker always rides that same rail, at every level */
    .track {
        position: relative;
        padding-left: 12px;

        &::before {
            content: "";
            position: absolute;
            top: 0;
            bottom: 0;
            left: 1px;
            width: 1px;
            background: var(--rule);
        }
    }

    .indicator {
        position: absolute;
        top: 0;
        left: 0;
        width: 3px;
        height: var(--h);
        border-radius: 3px;
        background: var(--accent);
        transform: translateY(var(--y));
        opacity: 0;
        pointer-events: none;
        /* fades out as slowly as the text highlight after load */
        transition: opacity var(--dur-fade) ease;

        &.on {
            opacity: 1;
            transition: opacity var(--dur-fast) ease;
        }

        &.ready {
            transition:
                transform var(--dur-base) var(--ease-out),
                height var(--dur-base) var(--ease-out),
                opacity var(--dur-fade) ease;
        }

        &.ready.on {
            transition:
                transform var(--dur-base) var(--ease-out),
                height var(--dur-base) var(--ease-out),
                opacity var(--dur-fast) ease;
        }
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
        color: var(--muted);
        cursor: pointer;
        transition: color var(--dur-base) var(--ease-out);

        &:hover {
            color: var(--text-color);
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
            color var(--dur-fast) ease,
            font-weight var(--dur-fast) ease,
            opacity var(--dur-fast) ease;

        &:hover {
            opacity: 1;
            text-decoration: underline;
        }

        /* the post-load highlight eases out slowly rather than snapping off */
        &.faded {
            transition-duration: var(--dur-fade);
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
