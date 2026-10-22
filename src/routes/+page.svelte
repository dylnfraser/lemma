<script lang="ts">
    import { isSearchShortcut } from "$lib/search/searchOverlay.svelte";
    import HomeFeed from "../components/HomeFeed.svelte";
    import RandomButton from "../components/RandomButton.svelte";
    import Searchbar from "../components/search/Searchbar.svelte";

    const wordmark = [..."Lemma"];
    const description = "Wikipedia, without the noise.";
    const words = description.split(" ");

    let searchbar: ReturnType<typeof Searchbar>;

    function handleWindowKeydown(event: KeyboardEvent) {
        if (!isSearchShortcut(event)) return;
        event.preventDefault();
        searchbar.focus();
    }
</script>

<svelte:head>
    <title>Lemma — A better way to read Wikipedia</title>
</svelte:head>

<svelte:window onkeydown={handleWindowKeydown} />

<main id="main">
    <div class="hero">
        <h1 id="header">
            <span class="sr-only">Lemma</span>
            <span aria-hidden="true">
                {#each wordmark as char, i}
                    <span class="char" style:--i={i}>{char}</span>
                {/each}
            </span>
        </h1>

        <p>
            <span class="sr-only">{description}</span>
            <span aria-hidden="true">
                {#each words as word, i}
                    <span class="word" style:--i={i}>{word}</span>{" "}
                {/each}
            </span>
        </p>

        <div class="search-slot">
            <Searchbar bind:this={searchbar} shortcutHint />
        </div>

        <nav class="quick-links" aria-label="More ways in">
            <RandomButton variant="text" label="Random article" />
            <span class="dot" aria-hidden="true">·</span>
            <a href="/library">Your library</a>
        </nav>
    </div>

    <HomeFeed />
</main>

<style>
    /*
     * One centred column: the wordmark, a line, the search and two quiet links, with a little of today's Wikipedia in
     * a row underneath. Everything is centred on the search.
     */
    main {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: clamp(2.5rem, 7vh, 3.75rem);
        width: min(68rem, calc(100% - 2.5rem));
        margin: 0 auto;
        padding: calc(var(--nav-height) + clamp(2rem, 9vh, 5rem)) 0 5rem;

        /* today's Wikipedia sits right under the search, a little wider than it */
        > :global(.feed) {
            width: min(46rem, 100%);
        }
    }

    .hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: min(36rem, 100%);
        text-align: center;
    }

    #header {
        margin: 0 0 0.6rem;
        font-size: clamp(3.25rem, 2.5rem + 2.5vw, 4.5rem);
        font-family: default-serif;
        line-height: 1;
        user-select: none;

        .char {
            display: inline-block;
            font-weight: 300;

            animation: font-weight-wave 0.8s ease-in-out;
            animation-delay: calc(var(--i) * 0.075s + 2s);
            @media (prefers-reduced-motion: reduce) {
                animation: none;
            }
        }
    }

    p {
        margin: 0;
        font-size: 1.05rem;
        line-height: 1.6;
        color: var(--muted);
    }

    .word {
        display: inline-block;
        animation: enter var(--dur-slow) var(--ease-out) backwards;
        animation-delay: calc(var(--i) * var(--stagger) + 100ms);
    }

    /* Only the bar's height is reserved: as results appear the card grows over the content below instead of pushing
       the page around. */
    .search-slot {
        position: relative;
        z-index: 5;
        align-self: stretch;
        height: 46px;
        margin-top: 2rem;
        text-align: left;

        :global(.search) {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
            margin-inline: 0;
        }
    }

    /* quiet text links under the search: the search stays the one thing that stands out */
    .quick-links {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        margin-top: 1.1rem;
        font-size: 0.85rem;
        color: var(--muted);
        animation: fade-in var(--dur-slow) var(--ease-out) 250ms backwards;

        a {
            color: inherit;
            text-decoration: none;
            transition: color var(--dur-fast);

            &:hover {
                color: var(--link-hover);
            }
        }

        .dot {
            opacity: 0.6;
        }
    }
</style>
