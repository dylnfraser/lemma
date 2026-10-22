<script lang="ts" module>
    let open = $state(false);

    /** Shows the keyboard shortcuts (also bound to "?"). */
    export function showShortcuts() {
        open = true;
    }
</script>

<script lang="ts">
    import { tick } from "svelte";
    import { fade } from "svelte/transition";
    import { isTypingTarget } from "$lib/search/searchOverlay.svelte";
    import { DURATION, motion, pop } from "$lib/motion";
    import Icon from "./icons/Icon.svelte";

    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
    const mod = isMac ? "⌘" : "Ctrl";

    const groups: { title: string; keys: { keys: string[]; label: string }[] }[] = [
        {
            title: "Anywhere",
            keys: [
                { keys: ["/"], label: "Search" },
                { keys: [mod, "K"], label: "Search" },
                { keys: ["?"], label: "Show these shortcuts" },
            ],
        },
        {
            title: "Reading an article",
            keys: [
                { keys: ["J"], label: "Next section" },
                { keys: ["K"], label: "Previous section" },
                { keys: ["["], label: "Fold the current section" },
                { keys: ["]"], label: "Unfold the current section" },
                { keys: ["S"], label: "Save or unsave" },
                { keys: ["T"], label: "Back to top" },
            ],
        },
    ];

    let dialog = $state<HTMLElement>();
    let returnFocus: HTMLElement | null = null;

    $effect(() => {
        if (!open) return;
        returnFocus = document.activeElement as HTMLElement | null;
        tick().then(() => dialog?.focus());
        return () => returnFocus?.focus?.();
    });

    function handleKeydown(event: KeyboardEvent) {
        if (open && event.key === "Escape") {
            event.preventDefault();
            open = false;
            return;
        }
        if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget(event.target)) {
            event.preventDefault();
            open = !open;
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
    <div class="backdrop" transition:fade={{ duration: motion(DURATION.fast) }} onclick={() => (open = false)} aria-hidden="true"></div>
    <div
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        tabindex="-1"
        bind:this={dialog}
        transition:pop={{ duration: DURATION.base }}
    >
        <header>
            <h2 id="shortcuts-title"><Icon name="keyboard" size="1em" /> Keyboard shortcuts</h2>
            <button type="button" class="close" aria-label="Close" onclick={() => (open = false)}><Icon name="x" size="0.85em" /></button>
        </header>
        {#each groups as group}
            <section>
                <h3>{group.title}</h3>
                <dl>
                    {#each group.keys as shortcut}
                        <div>
                            <dt>
                                {#each shortcut.keys as key}<kbd>{key}</kbd>{/each}
                            </dt>
                            <dd>{shortcut.label}</dd>
                        </div>
                    {/each}
                </dl>
            </section>
        {/each}
    </div>
{/if}

<style>
    .backdrop {
        position: fixed;
        inset: 0;
        z-index: 40;
        background: color-mix(in oklch, var(--page-bg) 55%, transparent);
        backdrop-filter: blur(3px);
    }

    .sheet {
        position: fixed;
        z-index: 41;
        top: 50%;
        left: 50%;
        translate: -50% -50%;
        width: min(30rem, calc(100vw - 2rem));
        max-height: calc(100dvh - 4rem);
        overflow-y: auto;
        box-sizing: border-box;
        padding: 1.1rem 1.25rem 1.25rem;
        border: 1px solid var(--rule);
        border-radius: 16px;
        background: var(--bg-color);
        box-shadow: 0 30px 60px -24px var(--shadow-color);
        outline: none;
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    }

    h2 {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        margin: 0;
        padding: 0;
        border: none;
        font-family: default-sans;
        font-size: 1rem;
        font-weight: 650;
    }

    .close {
        display: grid;
        place-items: center;
        width: 1.9rem;
        height: 1.9rem;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: none;
        color: var(--muted);
        cursor: pointer;

        &:hover {
            background: color-mix(in oklch, var(--secondary) 35%, transparent);
            color: var(--text-color);
        }
    }

    h3 {
        margin: 1rem 0 0.4rem;
        font-family: default-sans;
        font-size: 0.7rem;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
    }

    dl {
        margin: 0;
    }

    dl div {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        padding: 0.35rem 0;
        border-bottom: 1px solid color-mix(in oklch, var(--rule) 60%, transparent);
        font-size: 0.88rem;
    }

    dt {
        display: flex;
        flex: none;
        gap: 0.2rem;
        width: 4.5rem;
    }

    dd {
        margin: 0;
    }

    kbd {
        display: inline-grid;
        place-items: center;
        box-sizing: border-box;
        min-width: 1.5rem;
        height: 1.5rem;
        padding: 0 0.35rem;
        border: 1px solid color-mix(in oklch, var(--rule) 80%, transparent);
        border-bottom-width: 2px;
        border-radius: 6px;
        background: var(--page-bg);
        font: inherit;
        font-size: 0.75rem;
        font-weight: 600;
    }
</style>
