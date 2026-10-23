<script lang="ts">
    import { flip } from "svelte/animate";
    import { getArticlePath } from "$lib/article/articleUtils";
    import { library, type LibraryEntry } from "$lib/library.svelte";
    import { DURATION, cubicOut, motion, rise } from "$lib/motion";
    import LibraryEmpty from "../../components/LibraryEmpty.svelte";
    import ReaderLayout from "../../components/ReaderLayout.svelte";
    import { slidingTabs } from "$lib/slidingTabs";
    import Icon from "../../components/icons/Icon.svelte";

    type Tab = "saved" | "history";
    let tab = $state<Tab>(library.saved.length > 0 || library.history.length === 0 ? "saved" : "history");
    let confirmingClear = $state(false);

    let entries = $derived<readonly LibraryEntry[]>(tab === "saved" ? library.saved : library.history);

    const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    function when(at: number): string {
        const minutes = Math.round((at - Date.now()) / 60_000);
        if (minutes > -1) return "just now";
        if (minutes > -60) return relative.format(minutes, "minute");
        const hours = Math.round(minutes / 60);
        if (hours > -24) return relative.format(hours, "hour");
        const days = Math.round(hours / 24);
        if (days > -7) return relative.format(days, "day");
        return new Date(at).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
    }

    function remove(entry: LibraryEntry) {
        if (tab === "saved") library.toggleSaved(entry);
        else library.removeFromHistory(entry.title);
    }

    function clearHistory() {
        if (!confirmingClear) {
            confirmingClear = true;
            return;
        }
        library.clearHistory();
        confirmingClear = false;
    }
</script>

<svelte:head>
    <title>Your library • Lemma</title>
    <meta name="robots" content="noindex" />
</svelte:head>

<ReaderLayout>
    <header class="page-header">
        <h1>Your library</h1>
        <p class="note">Kept only in this browser. Nothing here is sent anywhere.</p>
    </header>

    <div class="toolbar">
        <div class="tabs" role="tablist" use:slidingTabs={tab} aria-label="Library">
            <button type="button" role="tab" aria-selected={tab === "saved"} onclick={() => ((tab = "saved"), (confirmingClear = false))}>
                <Icon name="bookmark" size="0.9em" /> Saved <span class="count">{library.saved.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === "history"} onclick={() => (tab = "history")}>
                <Icon name="history" size="0.9em" /> History <span class="count">{library.history.length}</span>
            </button>
        </div>
        {#if tab === "history" && library.history.length > 0}
            <button type="button" class="clear" class:confirming={confirmingClear} onclick={clearHistory} onblur={() => (confirmingClear = false)}>
                {confirmingClear ? "Clear all history?" : "Clear history"}
            </button>
        {/if}
    </div>

    <div role="tabpanel">
        {#if entries.length === 0}
            {#key tab}
                <LibraryEmpty kind={tab} />
            {/key}
        {:else}
            <ul class="entries">
                {#each entries as entry, i (entry.title)}
                    {@const position = library.position(entry.title)}
                    <li
                        style:--i={Math.min(i, 12)}
                        animate:flip={{ duration: motion(DURATION.base), easing: cubicOut }}
                        out:rise={{ duration: DURATION.base }}
                    >
                        <a href={getArticlePath(entry.title)}>
                            {#if entry.thumbnail}
                                <img src={entry.thumbnail} alt="" loading="lazy" decoding="async" />
                            {:else}
                                <span class="placeholder" aria-hidden="true">{entry.title.slice(0, 1)}</span>
                            {/if}
                            <span class="text">
                                <span class="title">{entry.title}</span>
                                <span class="meta">
                                    {#if entry.description}<span class="description">{entry.description}</span>{/if}
                                    <span class="when">{tab === "saved" ? "Saved" : "Read"} {when(entry.at)}</span>
                                </span>
                            </span>
                            {#if position && position.progress < 0.97}
                                <span class="progress" title="{Math.round(position.progress * 100)}% read">
                                    <span style:--progress={position.progress}></span>
                                </span>
                            {/if}
                        </a>
                        <button
                            type="button"
                            class="remove"
                            aria-label={tab === "saved" ? `Remove ${entry.title} from saved` : `Remove ${entry.title} from history`}
                            title="Remove"
                            onclick={() => remove(entry)}
                        >
                            <Icon name="x" size="0.8em" />
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</ReaderLayout>

<style>
    .page-header {
        margin: 1.5rem 0 1.25rem;
    }

    h1 {
        margin: 0;
        font-size: clamp(1.9rem, 1.5rem + 1.6vw, 2.5rem);
        font-weight: 600;
        line-height: 1.15;
    }

    .note {
        margin: 0.5rem 0 0;
        font-size: 0.85rem;
        color: var(--muted);
    }

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding-bottom: 0.9rem;
        margin-bottom: 0.5rem;
        border-bottom: 1px solid var(--rule);
    }

    .tabs {
        position: relative;
        --tab-radius: 8px;
        display: flex;
        gap: 0.2rem;
        padding: 0.2rem;
        border-radius: 10px;
        background: color-mix(in oklch, var(--secondary) 30%, var(--bg-color));

        button {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.35rem 0.8rem;
            border: none;
            border-radius: 8px;
            background: none;
            font: inherit;
            font-size: 0.85rem;
            font-weight: 550;
            color: var(--muted);
            cursor: pointer;
            /* above the sliding highlight */
            position: relative;
            z-index: 1;
            transition: color var(--dur-base) var(--ease-out);

            &:hover,
            &[aria-selected="true"] {
                color: var(--text-color);
            }
        }

        .count {
            font-weight: 450;
            color: var(--muted);
            font-variant-numeric: tabular-nums;
        }
    }

    .clear {
        padding: 0.3rem 0.8rem;
        border: 1px solid var(--rule);
        border-radius: 999px;
        background: none;
        font: inherit;
        font-size: 0.8rem;
        font-weight: 550;
        color: var(--muted);
        cursor: pointer;
        transition:
            color var(--dur-fast),
            border-color var(--dur-fast),
            background-color var(--dur-fast);

        &:hover {
            color: var(--text-color);
            border-color: var(--secondary);
        }

        &.confirming {
            color: oklch(0.55 0.17 25);
            border-color: color-mix(in oklch, oklch(0.55 0.17 25) 45%, var(--rule));
            background: color-mix(in oklch, oklch(0.55 0.17 25) 7%, transparent);
        }
    }

    .entries {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    li {
        position: relative;
        display: flex;
        align-items: center;
        border-bottom: 1px solid color-mix(in oklch, var(--rule) 60%, transparent);
        animation: enter var(--dur-slow) var(--ease-out) backwards;
        animation-delay: calc(var(--i) * var(--stagger));

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }

        &:hover .remove,
        &:focus-within .remove {
            opacity: 1;
        }
    }


    li a {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 0.85rem;
        min-width: 0;
        padding: 0.75rem 0;
        color: inherit;
        text-decoration: none;

        &:hover .title {
            color: var(--link-hover);
        }
    }

    img,
    .placeholder {
        flex: none;
        width: 48px;
        height: 48px;
        border-radius: 9px;
        object-fit: cover;
        background: var(--secondary);
    }

    .placeholder {
        display: grid;
        place-items: center;
        font-family: default-serif;
        font-weight: 600;
        color: var(--muted);
    }

    .text {
        display: grid;
        flex: 1;
        min-width: 0;
        gap: 0.1rem;
        line-height: 1.35;
    }

    .title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: default-serif;
        font-size: 1.05rem;
        font-weight: 600;
        transition: color var(--dur-fast);
    }

    .meta {
        display: flex;
        gap: 0.5rem;
        min-width: 0;
        font-size: 0.78rem;
        color: var(--muted);
    }

    .description {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .when {
        flex: none;

        .description + & {
            &::before {
                content: "·";
                margin-right: 0.5rem;
            }
        }
    }

    .progress {
        flex: none;
        width: 3.5rem;
        height: 4px;
        border-radius: 999px;
        overflow: hidden;
        background: color-mix(in oklch, var(--secondary) 55%, transparent);

        span {
            display: block;
            height: 100%;
            width: calc(var(--progress) * 100%);
            border-radius: inherit;
            background: var(--accent);
        }
    }

    .remove {
        display: grid;
        place-items: center;
        flex: none;
        width: 1.9rem;
        height: 1.9rem;

        @media (pointer: coarse) {
            width: 2.6rem;
            height: 2.6rem;
        }
        margin-left: 0.6rem;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: none;
        color: var(--muted);
        cursor: pointer;
        opacity: 0;
        transition:
            opacity var(--dur-fast),
            background-color var(--dur-fast),
            color var(--dur-fast);

        &:hover {
            background: color-mix(in oklch, var(--secondary) 35%, transparent);
            color: var(--text-color);
        }

        @media (hover: none) {
            opacity: 1;
        }
    }
</style>
