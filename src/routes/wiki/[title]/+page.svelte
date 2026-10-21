<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import type { Snapshot } from "./$types";
    import { WikipediaError } from "$lib/api/wikipedia";
    import type { ArticleMeta, ParsedArticle } from "$lib/article/types";
    import ArticleSkeleton from "../../../components/article/ArticleSkeleton.svelte";
    import ArticleView, { type ArticleViewState } from "../../../components/article/ArticleView.svelte";
    import ErrorState from "../../../components/ErrorState.svelte";
    import ReaderLayout from "../../../components/ReaderLayout.svelte";

    let { data } = $props();

    type View =
        | { status: "loading" }
        | { status: "ready"; article: ParsedArticle; redirectFragment: string; meta: ArticleMeta }
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
                    heading: "Nothing by that name",
                    message: `Wikipedia doesn't have an article called “${data.requestedTitle}”, at least not under that exact title. It might be spelled differently, or live under a broader topic. The search up top should find it.`,
                    retry: false,
                };
            case "offline":
                return {
                    heading: "Lost the connection",
                    message: `We couldn't reach Wikipedia to fetch “${data.requestedTitle}”. It looks like you're offline, or the network dropped for a moment. Once you're back online, give it another go.`,
                    retry: true,
                };
            case "timeout":
                return {
                    heading: "Taking its time",
                    message: `Wikipedia is being slow to answer for “${data.requestedTitle}”. That usually clears up in a moment, so it's worth another try.`,
                    retry: true,
                };
            default:
                return {
                    heading: "Something went sideways",
                    message: `We hit a snag loading “${data.requestedTitle}” from Wikipedia. It's probably a hiccup on their end or ours, and trying again usually sorts it out.`,
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
            meta={view.meta}
            {restoreState}
        />
    {/key}
{:else if errorDetails}
    <ReaderLayout>
        <div class="error-wrapper">
            <ErrorState
                heading={errorDetails.heading}
                message={errorDetails.message}
                onRetry={errorDetails.retry ? () => invalidateAll() : undefined}
                retryLabel="Give it another go"
            />
        </div>
    </ReaderLayout>
{:else}
    <ArticleSkeleton seed={data.requestedTitle} />
{/if}

<style>
    .error-wrapper {
        padding-top: 12vh;
    }
</style>
