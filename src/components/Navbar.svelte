<script lang="ts">
    import { page } from "$app/state";
    import { openSearch } from "$lib/search/searchOverlay.svelte";
    import SearchIcon from "./icons/SearchIcon.svelte";

    const wordmark = [..."Lemma"];
</script>

<header id="navbar">
    <a id="header" href="/" aria-label="Lemma home">
        <img src="/logo.svg" alt="" width="36" height="36" />
        <span class="wordmark" aria-hidden="true">
            {#each wordmark as char, i}
                <span class="char" style:--i={i}>{char}</span>
            {/each}
        </span>
    </a>

    <nav aria-label="Primary">
        {#if page.route.id !== "/"}
            <button type="button" class="search-button" onclick={() => openSearch()} aria-keyshortcuts="Control+K Meta+K /">
                <SearchIcon size={20} />
                <span>Search</span>
                <kbd aria-hidden="true">/</kbd>
            </button>
        {/if}
    </nav>
</header>

<style>
    #navbar {
        position: fixed;
        inset: 0 0 auto;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: var(--nav-height);
        padding: 0 20px 0 8px;
        box-sizing: border-box;
        user-select: none;
        background: color-mix(in oklch, var(--page-bg) 80%, transparent);
        border-bottom: 1px solid color-mix(in oklch, var(--secondary) 70%, transparent);
        backdrop-filter: blur(6px);
    }

    #header {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 100%;
        color: inherit;
        text-decoration: none;

        img {
            width: 36px;
            height: 36px;
        }
    }

    .wordmark {
        display: flex;
        white-space: nowrap;
        font-family: default-serif;
        font-size: 1.65rem;
        line-height: 1;
        font-weight: 300;

        .char {
            display: inline-block;
        }
    }

    #header:hover .char {
        animation: font-weight-wave 0.8s ease-in-out;
        animation-delay: calc(0.5s + var(--i) * 0.04s);
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    nav {
        display: flex;
        align-items: center;
        gap: 20px;

        a,
        button {
            font-size: 0.85rem;
            color: inherit;
        }

        a[aria-current="page"] {
            text-decoration-thickness: 2px;
        }
    }

    .search-button {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.25rem 0.4rem 0.25rem 0.2rem;
        background: none;
        border: 1px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        opacity: 0.85;
        transition:
            opacity var(--dur-fast),
            border-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &:hover {
            opacity: 1;
            border-color: var(--secondary);
        }

        @media (max-width: 600px) {
            kbd {
                display: none;
            }
        }
    }
</style>
