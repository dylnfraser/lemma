<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import type { Snapshot } from "./$types";
    import { WikipediaError } from "$lib/api/wikipedia";
    import type { ParsedArticle } from "$lib/article/types";
    import ArticleSkeleton from "../../../components/article/ArticleSkeleton.svelte";
    import ArticleView, { type ArticleViewState } from "../../../components/article/ArticleView.svelte";
    import ErrorState from "../../../components/ErrorState.svelte";
    import ReaderLayout from "../../../components/ReaderLayout.svelte";

    let { data } = $props();

    type View =
        | { status: "loading" }
        | { status: "ready"; article: ParsedArticle; redirectFragment: string }
        | { status: "error"; error: unknown };

    let view = $state.raw<View>({ status: "loading" });
    let articleView = $state<ReturnType<typeof ArticleView>>();
    // Snapshot values belong to the navigation they were restored for, so they never leak into a later article.
    let restored = $state.raw<{ data: typeof data; value: ArticleViewState | null } | null>(null);
    let restoreState = $derived(restored?.data === data ? restored.value : null);

    // Follow the current navigation's request; leaving or navigating again aborts it if it's still running.
    $effect(() => {
        const current = data;
        let active = true;
        view = { status: "loading" };

        current.article.then(
            (result) => active && (view = { status: "ready", ...result }),
            (error) => active && (view = { status: "error", error }),
        );

        return () => {
            active = false;
            current.cancel();
        };
    });

    // Back/forward restores the reading position and folds once the article has loaded again.
    export const snapshot: Snapshot<ArticleViewState | null> = {
        capture: () => articleView?.captureState() ?? null,
        restore: (value) => (restored = { data, value }),
    };

    let errorDetails = $derived.by(() => {
        if (view.status !== "error") return null;
        const kind = view.error instanceof WikipediaError ? view.error.kind : "invalid";

        switch (kind) {
            case "not_found":
                return {
                    heading: "No such article",
                    message: `Wikipedia doesn't have an article called “${data.requestedTitle}”.`,
                    retry: false,
                };
            case "offline":
                return {
                    heading: "You're offline",
                    message: `Couldn't reach Wikipedia to load “${data.requestedTitle}”. Check your connection and try again.`,
                    retry: true,
                };
            case "timeout":
                return {
                    heading: "That took too long",
                    message: `Wikipedia didn't respond in time while loading “${data.requestedTitle}”.`,
                    retry: true,
                };
            default:
                return {
                    heading: "Something went wrong",
                    message: `Lemma couldn't load “${data.requestedTitle}” from Wikipedia.`,
                    retry: true,
                };
        }
    });
</script>

<svelte:head>
    {#if view.status !== "ready"}
        <title>{errorDetails?.heading ?? data.requestedTitle} • Lemma</title>
    {/if}
    {#if errorDetails}
        <meta name="robots" content="noindex" />
    {/if}
</svelte:head>

{#if view.status === "ready"}
    {#key view.article}
        <ArticleView
            bind:this={articleView}
            article={view.article}
            redirectFragment={view.redirectFragment}
            {restoreState}
        />
    {/key}
{:else}
    <ReaderLayout>
        {#if errorDetails}
            <div class="error-wrapper">
                <ErrorState
                    heading={errorDetails.heading}
                    message={errorDetails.message}
                    searchQuery={data.requestedTitle}
                    onRetry={errorDetails.retry ? () => invalidateAll() : undefined}
                />
            </div>
        {:else}
            <ArticleSkeleton seed={data.requestedTitle} />
        {/if}
    </ReaderLayout>
{/if}

<style>
    .error-wrapper {
        padding-top: 12vh;
    }
</style>
