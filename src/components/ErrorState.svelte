<script lang="ts">
    import { openSearch } from "$lib/search/searchOverlay.svelte";

    interface Props {
        heading: string;
        message: string;
        /** Pre-fills the search overlay when the reader chooses to search instead. */
        searchQuery?: string;
        onRetry?: () => void;
    }

    let { heading, message, searchQuery, onRetry }: Props = $props();

    const homeMessages = ["Go back home", "Return to ground zero", "Take me back", "Home sweet home"];
    const homeText = homeMessages[Math.floor(Math.random() * homeMessages.length)];
</script>

<section class="error-state" role="alert" aria-labelledby="error-heading">
    <h1 id="error-heading">{heading}</h1>
    <p>{message}</p>

    <div class="actions">
        {#if onRetry}
            <button type="button" class="primary" onclick={onRetry}>Try again</button>
        {/if}
        {#if searchQuery !== undefined}
            <button type="button" onclick={() => openSearch(searchQuery)}>Search instead</button>
        {/if}
        <a href="/">{homeText}</a>
    </div>
</section>

<style>
    .error-state {
        text-align: center;
        animation: popup 0.5s both;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    h1 {
        font-size: 3rem;
        font-weight: 350;
        margin: 0 0 0.75rem;
        line-height: 1.15;
        overflow-wrap: anywhere;
    }

    p {
        max-width: 50ch;
        margin: 0 auto;
        text-wrap: pretty;
    }

    .actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 0.75rem 1.25rem;
        margin-top: 2rem;
    }

    button {
        padding: 0.45rem 0.9rem;
        border: 1px solid var(--secondary);
        border-radius: 999px;
        background: var(--bg-color);
        cursor: pointer;

        &:hover {
            border-color: var(--accent);
        }
    }

    .primary {
        border-color: color-mix(in oklch, var(--accent) 50%, var(--secondary));
        font-weight: 600;
    }

    @keyframes popup {
        from {
            opacity: 0;
            filter: blur(1px);
            transform: translateY(6px);
        }
    }
</style>
