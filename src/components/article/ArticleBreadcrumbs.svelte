<script lang="ts">
    import { untrack } from "svelte";
    import { prefersReducedMotion } from "svelte/motion";
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

    // The entry the marker sits on: the current section, or (while it's inside a folded branch) the nearest heading
    // above it that's showing, so the marker never blinks out between folds.
    let markedId = $derived.by(() => {
        const byId = new Map(headings.map((heading) => [heading.id, heading]));
        const active = byId.get(activeId);
        if (!active) return "";
        if (!isHeadingHiddenByCollapsed(active, collapsedIds)) return active.id;
        return [...active.ancestorIds].reverse().find((id) => {
            const ancestor = byId.get(id);
            return ancestor && !isHeadingHiddenByCollapsed(ancestor, collapsedIds);
        }) ?? "";
    });

    // The headings showing once any folding settles (rows on their way out don't count).
    let visibleIds = $derived(headings.filter((heading) => !isHeadingHiddenByCollapsed(heading, collapsedIds)).map((heading) => heading.id));

    // Where the marker should be, worked out from where its row will end up rather than where it is mid-animation:
    // every row has the same height, so that's its place in the list times the row pitch. The marker can then glide
    // straight there alongside the folding rows instead of chasing its row frame by frame.
    function placeIndicator() {
        const index = visibleIds.indexOf(markedId);
        const first = track?.querySelector<HTMLElement>(".breadcrumb-row");
        const link = first?.querySelector<HTMLElement>(".breadcrumb");
        if (index < 0 || !first || !link) {
            indicator = null;
            return;
        }
        // the first row is top-level and so never folds: its spacing is the settled spacing
        const pitch = link.offsetHeight + (Number.parseFloat(getComputedStyle(first).marginBottom) || 0);
        const next = { y: first.offsetTop + index * pitch, height: link.offsetHeight };
        if (next.y !== indicator?.y || next.height !== indicator?.height) indicator = next;
        if (!indicatorReady) requestAnimationFrame(() => (indicatorReady = true));
    }

    // When folds change, the marker moves in step with the rows (same duration and easing); otherwise it glides
    // between entries at its own, slower pace.
    let syncing = $state(false);
    let syncTimer: ReturnType<typeof setTimeout>;
    let lastFolds: number | null = null;
    $effect(() => {
        const folds = collapsedIds.size;
        if (lastFolds !== null && folds !== lastFolds) {
            syncing = true;
            clearTimeout(syncTimer);
            syncTimer = setTimeout(() => (syncing = false), DURATION.base);
        }
        lastFolds = folds;
        return () => clearTimeout(syncTimer);
    });

    $effect(() => {
        void markedId;
        void visibleIds;
        // untracked: placing the indicator reads and writes its own state, which must not re-trigger this effect
        untrack(placeIndicator);
    });

    // Text size can change the row pitch (fonts loading, zoom).
    $effect(() => {
        const observer = new ResizeObserver(() => placeIndicator());
        observer.observe(track);
        return () => observer.disconnect();
    });

    // Keep the active entry visible by scrolling the outline itself (never the page), towards where it will settle.
    $effect(() => {
        if (!indicator || !list) return;
        const { y, height } = indicator;
        untrack(() => {
            const padding = 40;
            const top = track.offsetTop + y - list.scrollTop;
            let by = 0;
            if (top < padding) by = top - padding;
            else if (top + height > list.clientHeight - padding) by = top + height - (list.clientHeight - padding);
            if (by) list.scrollBy({ top: by, behavior: prefersReducedMotion.current ? "instant" : "smooth" });
        });
    });
</script>

<p class="outline-title" aria-hidden="true">Contents</p>
<nav class="crumbs" bind:this={list} aria-label="Article sections">
    <div class="track" bind:this={track}>
        <span
            class="indicator"
            class:on={indicator && highlightActive}
            class:ready={indicatorReady}
            class:syncing
            style:--y="{indicator?.y ?? 0}px"
            style:--h="{indicator?.height ?? 0}px"
            aria-hidden="true"
        ></span>
        <ul>
            {#each headings as heading (heading.id)}
                {#if !isHeadingHiddenByCollapsed(heading, collapsedIds)}
                    {@const collapsed = collapsedIds.has(heading.id)}
                    <li class="breadcrumb-row" transition:fold={{ duration: DURATION.base }}>
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
                            data-marked={markedId === heading.id ? "" : undefined}
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
                transform var(--dur-slow) var(--ease-out),
                height var(--dur-slow) var(--ease-out),
                opacity var(--dur-fade) ease;
        }

        &.ready.on {
            transition:
                transform var(--dur-slow) var(--ease-out),
                height var(--dur-slow) var(--ease-out),
                opacity var(--dur-fast) ease;
        }

        /* in step with folding rows: the fold transition's duration and easing (cubicOut) */
        &.ready.syncing {
            transition-duration: var(--dur-base), var(--dur-base), var(--dur-fast);
            transition-timing-function: cubic-bezier(0.33, 1, 0.68, 1), cubic-bezier(0.33, 1, 0.68, 1), ease;
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

        /* fingers need taller rows than a pointer does */
        @media (pointer: coarse) {
            --row: 2.1rem;
            margin-bottom: 0;
        }
    }

    .breadcrumb-fold,
    .breadcrumb-fold-spacer {
        flex: 0 0 1rem;
        width: 1rem;
        height: var(--row, 1.25rem);
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
        line-height: var(--row, 1.25rem);
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
