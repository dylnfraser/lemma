<script lang="ts">
    import Icon from "../icons/Icon.svelte";
    import { prefersReducedMotion } from "svelte/motion";
    import { fetchLastEdited, getWikipediaArticleUrl, getWikipediaHistoryUrl } from "$lib/api/wikipedia";
    import { isKeyboardClick } from "$lib/focus";

    interface Props {
        title: string;
    }

    let { title }: Props = $props();

    const CC_BY_SA_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

    let lastEdited = $state<Date | null>(null);

    // Best-effort and only for the footer, so it never holds up the article itself.
    $effect(() => {
        const controller = new AbortController();
        fetchLastEdited(title, { signal: controller.signal }).then((date) => {
            if (!controller.signal.aborted) lastEdited = date;
        });
        return () => controller.abort();
    });

    function backToTop(event: MouseEvent) {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion.current ? "auto" : "smooth" });
        // keyboard users land on the title rather than staying on a button that has scrolled away
        if (isKeyboardClick(event)) document.getElementById("title")?.focus({ preventScroll: true });
    }
</script>

<footer class="article-footer">
    <div class="actions">
        <a class="wikipedia-link" href={getWikipediaArticleUrl(title)} target="_blank" rel="noopener noreferrer"
            >Read or edit on Wikipedia <Icon name="arrow-up-right" size="0.85em" /><span class="sr-only">
                (opens in a new tab)</span
            ></a
        >
        <button type="button" class="top-button" onclick={backToTop}>
            Back to top <Icon name="arrow-up" size="0.85em" />
        </button>
    </div>

    {#if lastEdited}
        <p class="edited">
            Last edited on <time datetime={lastEdited.toISOString()}
                >{lastEdited.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</time
            >
        </p>
    {/if}

    <p class="license">
        Text from the Wikipedia article
        “<a href={getWikipediaArticleUrl(title)} target="_blank" rel="noopener noreferrer">{title}</a>” by
        <a href={getWikipediaHistoryUrl(title)} target="_blank" rel="noopener noreferrer">its contributors</a>,
        available under
        <a href={CC_BY_SA_URL} target="_blank" rel="license noopener noreferrer">CC BY-SA 4.0</a>. Lemma has
        reformatted it and left out some elements. Images are licensed separately; see each file’s page on Wikipedia for
        its terms.
    </p>
</footer>

<style>
    .article-footer {
        margin-top: 4rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--rule);
        font-size: 0.85rem;
        line-height: 1.55;
        color: var(--muted);
    }

    .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem 1.5rem;
    }

    .wikipedia-link {
        font-family: default-serif;
        font-size: 1.1rem;
        font-weight: 550;
        color: var(--text-color);
        text-decoration: none;

        &:hover {
            color: var(--link-hover);
        }
    }

    .top-button {
        padding: 0.35rem 0.8rem;
        background: var(--bg-color);
        border: 1px solid var(--secondary);
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition:
            color var(--dur-fast),
            border-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &:hover {
            color: var(--link-hover);
            border-color: color-mix(in oklch, var(--link-hover) 40%, var(--secondary));
        }
    }

    p {
        margin: 1rem 0 0;
        font-size: inherit;
        text-wrap: pretty;
    }

    .edited {
        font-weight: 500;
    }

    .license a {
        text-decoration-color: color-mix(in oklch, currentColor 40%, transparent);
    }
</style>
