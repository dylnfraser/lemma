<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        children: Snippet;
        /** Section navigation; receives a `close` callback for dismissing the drawer on small screens. */
        outline?: Snippet<[{ close: () => void }]>;
    }

    let { children, outline }: Props = $props();

    const uid = $props.id();
    let outlineOpen = $state(false);

    function close() {
        outlineOpen = false;
    }

    function handleWindowKeydown(event: KeyboardEvent) {
        if (event.key === "Escape" && outlineOpen) close();
    }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="reader">
    {#if outline}
        <aside id="{uid}-outline" class="outline" class:open={outlineOpen} aria-label="Sections">
            {@render outline({ close })}
        </aside>

        {#if outlineOpen}
            <button type="button" class="outline-backdrop" aria-label="Close sections" tabindex="-1" onclick={close}
            ></button>
        {/if}
        <button
            type="button"
            class="outline-toggle"
            aria-controls="{uid}-outline"
            aria-expanded={outlineOpen}
            onclick={() => (outlineOpen = !outlineOpen)}
        >
            Sections
        </button>
    {/if}

    <main id="main" class="content">
        {@render children()}
    </main>
</div>

<style>
    .reader {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, var(--measure)) minmax(0, 1fr);
        column-gap: clamp(1.5rem, 4vw, 3.5rem);
        padding: calc(var(--nav-height) + 2rem) clamp(1.25rem, 4vw, 2rem) 40vh;
        line-height: var(--leading);
        /* Last-resort guard: stray wide content must never widen the page (and the mobile viewport) itself. */
        overflow-x: clip;
    }

    .content {
        grid-column: 2;
        grid-row: 1;
        min-width: 0;
    }

    .outline {
        grid-column: 1;
        grid-row: 1;
        justify-self: end;
        align-self: start;
        position: sticky;
        top: calc(var(--nav-height) + 2rem);
        display: flex;
        flex-direction: column;
        width: min(100%, 17rem);
        max-height: calc(100dvh - var(--nav-height) - 4rem);
        line-height: 1.25;
    }

    .outline-toggle,
    .outline-backdrop {
        display: none;
    }

    @media (max-width: 1050px) {
        .reader {
            grid-template-columns: minmax(0, var(--measure));
            justify-content: center;
        }

        .content {
            grid-column: 1;
        }

        .outline {
            position: fixed;
            z-index: 25;
            left: 0;
            top: calc(var(--nav-height) + 1rem);
            width: min(85vw, 300px);
            max-height: min(72dvh, 620px);
            box-sizing: border-box;
            padding: 0.9rem 0.85rem 0.5rem;
            background: var(--bg-color);
            border: 1px solid var(--secondary);
            border-left: none;
            border-radius: 0 12px 12px 0;
            box-shadow: 0 12px 32px var(--shadow-color);

            visibility: hidden;
            transform: translateX(-100%);
            transition:
                transform 0.2s ease,
                visibility 0s linear 0.2s;

            &.open {
                visibility: visible;
                transform: none;
                transition: transform 0.2s ease;
            }

            @media (prefers-reduced-motion: reduce) {
                transition: none !important;
            }
        }

        .outline-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 24;
            border: none;
            background: transparent;
        }

        .outline-toggle {
            display: block;
            position: fixed;
            z-index: 26;
            left: 0;
            bottom: 1.5rem;
            padding: 0.55rem 0.9rem 0.55rem 0.75rem;
            background: var(--bg-color);
            border: 1px solid var(--secondary);
            border-left: none;
            border-radius: 0 999px 999px 0;
            box-shadow: 0 8px 24px var(--shadow-color);
            font-size: 0.75rem;
            font-weight: 650;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            cursor: pointer;
        }
    }
</style>
