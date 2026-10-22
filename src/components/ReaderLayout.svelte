<script lang="ts">
    import type { Snippet } from "svelte";
    import { fade } from "svelte/transition";
    import { DURATION, motion } from "$lib/motion";

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
            <button
                type="button"
                class="outline-backdrop"
                aria-label="Close sections"
                tabindex="-1"
                onclick={close}
                transition:fade={{ duration: motion(DURATION.fast) }}
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
        --gap: clamp(1.5rem, 4vw, 3.5rem);
        --pad: clamp(1.25rem, 4vw, 2rem);
        --measure-px: var(--measure);
        /* width of each side column, for content placed in the margins (e.g. the infobox) */
        --side-width: calc((100vw - 2 * var(--pad) - var(--measure-px) - 2 * var(--gap)) / 2);

        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, var(--measure)) minmax(0, 1fr);
        column-gap: var(--gap);
        padding: calc(var(--nav-height) + 2rem) max(var(--pad), env(safe-area-inset-right)) 40vh max(var(--pad), env(safe-area-inset-left));
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
        /* level with the margin infobox: the article header's 1.5rem top margin plus the infobox's 1.5rem offset */
        margin-top: 3rem;
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
            margin-left: env(safe-area-inset-left);
            margin-top: 0;
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
            /* closes a little quicker than it opens; visibility flips once it's off-screen */
            transition:
                transform var(--dur-fast) ease-in,
                visibility 0s linear var(--dur-fast);

            &.open {
                visibility: visible;
                transform: none;
                transition: transform var(--dur-base) var(--ease-out);
            }
        }

        .outline-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 24;
            border: none;
            background: rgb(0 0 0 / 14%);

            /* a full-screen layer shouldn't take part in the global press-scale */
            &:active {
                scale: 1;
            }
        }

        .outline-toggle {
            display: block;
            position: fixed;
            z-index: 26;
            left: env(safe-area-inset-left);
            bottom: calc(1.5rem + env(safe-area-inset-bottom));
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
