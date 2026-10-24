<script lang="ts">
    import Icon from "../icons/Icon.svelte";
    import { prefersReducedMotion } from "svelte/motion";
    import { getWikipediaArticleUrl, getWikipediaHistoryUrl, type EditActivity, type Protection } from "$lib/api/wikipedia";
    import { isKeyboardClick } from "$lib/focus";

    interface Props {
        title: string;
        /** The article's recent editing (ArticleView fetches it), once it arrives. */
        activity: EditActivity | null;
        /** Who may edit it, when that's restricted. */
        protection: Protection | null;
    }

    let { title, activity, protection }: Props = $props();

    // how the article is being edited, beside when it last was
    const PROTECTIONS = {
        semi: "Semi-protected: only established accounts can edit it",
        extended: "Extended protected: only experienced editors can edit it",
        full: "Fully protected: only administrators can edit it",
        pending: "Edits by new accounts are reviewed before they show",
    } as const;

    let edits = $derived(activity?.editsThisWeek ?? 0);

    const CC_BY_SA_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

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

    {#if activity || protection}
        <p class="edited">
            {#if activity}
                <span
                    >Last edited on <time datetime={activity.lastEdited.toISOString()}
                        >{activity.lastEdited.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</time
                    ></span
                >
                {#if edits > 0}
                    <span
                        >{edits >= 50 ? "50+" : edits} {edits === 1 ? "edit" : "edits"} in the past week{#if activity.editorsThisWeek > 1}&nbsp;by
                            {activity.editorsThisWeek} editors{/if}</span
                    >
                {/if}
            {/if}
            {#if protection}
                <span class="protection"><Icon name="lock" size="0.9em" />{PROTECTIONS[protection]}</span>
            {/if}
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

    /* when and how it's being edited, as one line of facts (wrapping between them, not inside) */
    .edited {
        display: flex;
        flex-wrap: wrap;
        gap: 0.2rem 1rem;
        font-weight: 500;
        /* it arrives after the article, so ease it in rather than popping */
        animation: fade-in var(--dur-base) var(--ease-out) backwards;
    }

    .protection {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
    }

    .license a {
        text-decoration-color: color-mix(in oklch, currentColor 40%, transparent);
    }
</style>
