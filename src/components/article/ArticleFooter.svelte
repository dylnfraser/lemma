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
        <a class="wikipedia-link with-icon" href={getWikipediaArticleUrl(title)} target="_blank" rel="noopener noreferrer"
            >Read or edit on Wikipedia<Icon name="arrow-up-right" size="0.85em" /><span class="sr-only">
                (opens in a new tab)</span
            ></a
        >
        <button type="button" class="action-pill top-button" onclick={backToTop}>
            Back to top<Icon name="arrow-up" size="0.9em" />
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
        font-family: var(--display-font);
        font-size: 1.1rem;
        font-weight: 550;
        color: var(--text-color);
        text-decoration: none;

        &:hover {
            color: var(--link-hover);
        }
    }

    /* the arrow sits a touch closer to the edge than the text does: icons carry their own whitespace */
    .top-button {
        padding-right: 0.6rem;
    }

    p {
        margin: 1rem 0 0;
        font-size: inherit;
        text-wrap: pretty;
    }

    .edited {
        font-weight: 500;
        /* it arrives after the article, so ease it in rather than popping */
        animation: fade-in var(--dur-base) var(--ease-out) backwards;
    }

    .license a {
        text-decoration-color: color-mix(in oklch, currentColor 40%, transparent);
    }
</style>
