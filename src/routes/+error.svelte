<script lang="ts">
    import { page } from "$app/state";
    import ErrorState from "../components/ErrorState.svelte";

    let isNotFound = $derived(page.status === 404);
    let heading = $derived(isNotFound ? "404" : String(page.status));
    let message = $derived(
        isNotFound
            ? "We looked everywhere, but there’s nothing at this address. It may have moved, been renamed, or never existed in the first place. Try going back, or start fresh from the homepage."
            : `Something went sideways on our end${page.error?.message ? ` (${page.error.message})` : ""}. A reload usually sorts it out.`,
    );
</script>

<svelte:head>
    <title>{heading} • Lemma</title>
    <meta name="robots" content="noindex" />
</svelte:head>

<main id="main">
    <ErrorState {heading} {message} onRetry={isNotFound ? undefined : () => location.reload()} retryLabel="Reload the page" />
</main>

<style>
    main {
        width: min(55ch, calc(100% - 2.5rem));
        margin: 0 auto;
        padding-top: max(calc(var(--nav-height) + 2rem), 15vh);
    }
</style>
