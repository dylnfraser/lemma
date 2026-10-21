<script lang="ts">
    import { isSearchShortcut } from "$lib/search/searchOverlay.svelte";
    import Searchbar from "../components/search/Searchbar.svelte";

    const wordmark = [..."Lemma"];
    const description =
        "Lemma is a private, fast, and beautifully designed Wikipedia wrapper that makes exploring knowledge feel effortless. Lemma provides a clean, focused reading experience with instant access to the information you want, without noise or distractions.";
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
        <Searchbar bind:this={searchbar} />
    </div>
</main>

<style>
    main {
        width: min(55ch, calc(100% - 2.5rem));
        margin: 0 auto;
        padding-top: max(calc(var(--nav-height) + 2rem), 15vh);
    }

    #header {
        font-size: 3rem;
        font-family: default-serif;
        text-align: center;
        margin: 0 0 0.35rem;
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
        text-align: justify;
        text-wrap: pretty;
        max-width: 50ch;
        margin: 0 auto;
        line-height: 1.6;

        @media (max-width: 600px) {
            text-align: left;
        }
    }

    .word {
        display: inline-block;

        animation: text-appear 0.2s ease-out both;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    .search-slot {
        margin-top: 2.5rem;
    }
</style>
