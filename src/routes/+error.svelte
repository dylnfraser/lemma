<script lang="ts">
    import { page } from "$app/state";
    import ErrorState from "../components/ErrorState.svelte";

    let isNotFound = $derived(page.status === 404);
    let heading = $derived(isNotFound ? "404" : String(page.status));
    let message = $derived(
        isNotFound
            ? "We couldn’t find what you were looking for. The page may have been moved, renamed, or no longer exists. Try going back or heading to the homepage."
            : (page.error?.message ?? "Something went wrong."),
    );
</script>

<svelte:head>
    <title>{heading} • Lemma</title>
    <meta name="robots" content="noindex" />
</svelte:head>

<main id="main">
    <ErrorState {heading} {message} onRetry={isNotFound ? undefined : () => location.reload()} />
</main>

<style>
    main {
        width: min(55ch, calc(100% - 2.5rem));
        margin: 0 auto;
        padding-top: max(calc(var(--nav-height) + 2rem), 15vh);
    }
</style>
