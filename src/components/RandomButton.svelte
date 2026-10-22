<script lang="ts">
    import { goto } from "$app/navigation";
    import { fetchRandomTitle } from "$lib/api/feed";
    import { getArticlePath } from "$lib/article/articleUtils";

    interface Props {
        /** "nav": the navbar's 36px box; "pill": a bordered pill for page content; "text": a plain text link. */
        variant?: "nav" | "pill" | "text";
        label?: string;
    }

    let { variant = "nav", label = "Random" }: Props = $props();

    let busy = $state(false);
    let failed = $state(false);
    let failTimer: ReturnType<typeof setTimeout>;

    async function openRandom() {
        if (busy) return;
        busy = true;
        failed = false;
        clearTimeout(failTimer);

        try {
            await goto(getArticlePath(await fetchRandomTitle()));
        } catch {
            failed = true;
            failTimer = setTimeout(() => (failed = false), 2500);
        } finally {
            busy = false;
        }
    }
</script>

<button
    type="button"
    class="random {variant}"
    class:busy
    aria-busy={busy}
    title="Open a random article"
    onclick={openRandom}
>
    <svg class="shuffle" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22M18 2l4 4-4 4M2 6h1.9c1.5 0 2.9.9 3.6 2.2M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8M18 14l4 4-4 4"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
    </svg>
    <span>{failed ? "Try again" : label}</span>
</button>
<span class="sr-only" role="status">{failed ? "Couldn't reach Wikipedia for a random article." : ""}</span>

<style>
    .random {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        box-sizing: border-box;
        cursor: pointer;
        font-size: 0.85rem;
        color: inherit;
        transition:
            color var(--dur-base) var(--ease-out),
            border-color var(--dur-fast),
            background-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &.busy {
            cursor: progress;
        }
    }

    /* matches the navbar's search button: the same 36px box as the logo */
    .nav {
        height: 36px;
        padding: 0 0.5rem 0 0.4rem;
        background: none;
        border: 1px solid transparent;
        border-radius: 8px;
        color: var(--muted);

        &:hover {
            color: var(--text-color);
            border-color: var(--secondary);
        }
    }

    .pill {
        height: 2.25rem;
        padding: 0 0.95rem 0 0.8rem;
        border: 1px solid var(--rule);
        border-radius: 999px;
        background: var(--bg-color);
        color: var(--muted);

        &:hover {
            color: var(--text-color);
            border-color: var(--secondary);
        }
    }

    /* the arrows swap over on hover, a small shuffle of their own */
    .text {
        gap: 0.3rem;
        padding: 0;
        border: none;
        background: none;
        font: inherit;
        color: inherit;

        &:hover {
            color: var(--link-hover);
        }

        .shuffle {
            width: 0.95em;
            height: 0.95em;
        }
    }

    .shuffle {
        flex: none;
        transition: scale var(--dur-base) var(--ease-spring);
    }

    .random:hover .shuffle {
        scale: -1 1;
    }

    .busy .shuffle {
        animation: shuffle 0.6s ease-in-out infinite;

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    @keyframes shuffle {
        50% {
            translate: 0 -2px;
            rotate: -8deg;
        }
    }
</style>
