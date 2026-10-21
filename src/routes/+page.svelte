<script lang="ts">
    import { isSearchShortcut } from "$lib/search/searchOverlay.svelte";
    import HomeFeed from "../components/HomeFeed.svelte";
    import RandomButton from "../components/RandomButton.svelte";
    import Searchbar from "../components/search/Searchbar.svelte";

    const wordmark = [..."Lemma"];
    const description =
        "A private, fast and quiet way to read Wikipedia: clean pages, instant search, and nothing in the way.";
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
                    <span class="word" style:animation-delay="{i * 0.0075}s">{word}</span>{" "}
                {/each}
            </span>
        </p>

        <div class="search-slot">
            <Searchbar bind:this={searchbar} shortcutHint />
        </div>

        <div class="random-slot">
            <RandomButton variant="pill" label="Read a random article" />
        </div>
    </div>

    <HomeFeed />
</main>

<style>
    /*
     * The introduction and search on the left with today's featured article beside them; the rest of the feed shares
     * the row below. Steps down to two columns, then one. (The feed's sections are placed by their classes, below.)
     */
    main {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        grid-template-rows: minmax(min(32rem, 62vh), auto) auto;
        grid-template-areas: "hero hero hero featured featured featured";
        column-gap: clamp(2.5rem, 6vw, 6rem);
        row-gap: 4rem;
        width: min(74rem, calc(100% - 2.5rem));
        margin: 0 auto;
        padding: calc(var(--nav-height) + clamp(1.5rem, 6vh, 4rem)) 0 6rem;

        @media (max-width: 1099px) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-template-rows: auto;
            grid-template-areas:
                "hero hero"
                "featured featured";
            row-gap: 3.5rem;
        }

        @media (max-width: 759px) {
            grid-template-columns: minmax(0, 1fr);
            grid-template-areas: "hero" "featured";
            row-gap: 2.75rem;
        }
    }

    .hero {
        grid-area: hero;
        align-self: center;
        max-width: 32rem;
    }

    main :global(.area-featured) {
        grid-area: featured;
        align-self: center;
    }

    /* the feed's lists flow into the rows below, sharing the row evenly (the feed sets --lower-span: 2 or 3 of the
       six columns, 6 if there's only one) */
    main :global(.lower) {
        grid-column: span var(--lower-span, 2);

        @media (max-width: 1099px) {
            grid-column: span 1;
        }

        @media (max-width: 759px) {
            grid-column: auto;
        }
    }

    #header {
        margin: 0 0 0.9rem;
        font-size: clamp(3.25rem, 2.5rem + 2.5vw, 4.75rem);
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
        max-width: 36ch;
        margin: 0;
        font-size: 1.05rem;
        line-height: 1.6;
        text-wrap: balance;
        color: color-mix(in oklch, var(--text-color) 85%, var(--page-bg));
    }

    .word {
        display: inline-block;

        animation: text-appear 0.2s ease-out both;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    /* Only the bar's height is reserved: as results appear the card grows over the content below instead of pushing
       the page (and the featured article beside it) around. */
    .search-slot {
        position: relative;
        z-index: 5;
        height: 46px;
        margin-top: 2.25rem;

        :global(.search) {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
            margin-inline: 0;
        }
    }

    .random-slot {
        display: flex;
        margin-top: 1rem;

        animation: quickappear 0.5s 0.15s both;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }
</style>
