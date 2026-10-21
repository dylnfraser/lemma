<script lang="ts" module>
    export type ArticleViewState = { scrollY: number; collapsedSections: string[] };
</script>

<script lang="ts">
    import { onMount, tick } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { page } from "$app/state";
    import { replaceState } from "$app/navigation";
    import { getWikipediaArticleUrl } from "$lib/api/wikipedia";
    import { getCollapsibleHeadingIds } from "$lib/article/articleNavigation";
    import { getArticlePath, safeDecodeURIComponent } from "$lib/article/articleUtils";
    import type { ParsedArticle } from "$lib/article/types";
    import ReaderLayout from "../ReaderLayout.svelte";
    import ArticleBreadcrumbs from "./ArticleBreadcrumbs.svelte";
    import ArticleContent from "./ArticleContent.svelte";
    import ArticleInfobox from "./ArticleInfobox.svelte";
    import Lightbox from "./Lightbox.svelte";

    interface Props {
        article: ParsedArticle;
        /** Section a redirect pointed at (e.g. "Alan Turing#Early life"), used when the URL has no hash. */
        redirectFragment?: string;
        /** Scroll position and folds from a back/forward snapshot. */
        restoreState?: ArticleViewState | null;
    }

    let { article, redirectFragment = "", restoreState = null }: Props = $props();

    // A heading counts as "current" once its top passes this far below the viewport top (under the navbar).
    const ACTIVE_OFFSET = 140;
    // Right after loading, the outline's highlight only says "you're at the start", so it shows briefly and then fades.
    const LOAD_HIGHLIGHT_MS = 1500;

    // This component is re-created for every article ({#key} in the route), so per-article state is set up once.
    // svelte-ignore state_referenced_locally
    const { title, description, blocks, headings, anchors, stats } = article;
    const headingsById = new Map(headings.map((heading) => [heading.id, heading]));
    const collapsedSections = new SvelteSet<string>();
    const collapsedOutline = new SvelteSet<string>(getCollapsibleHeadingIds(headings));
    const autoExpandedOutline = new Set<string>();

    let activeHeadingId = $state(headings[0]?.id ?? "");
    let highlightActive = $state(true);
    // True while the page is still settling after load (initial scroll, hash or snapshot restore).
    let settling = true;
    let articleElement: HTMLElement;
    let frame = 0;
    let restoredFrom: ArticleViewState | null = null;

    export function captureState(): ArticleViewState {
        return { scrollY: window.scrollY, collapsedSections: [...collapsedSections] };
    }

    function toggle(set: Set<string>, id: string) {
        if (set.has(id)) set.delete(id);
        else set.add(id);
    }

    function toggleSection(id: string) {
        toggle(collapsedSections, id);
        scheduleActiveUpdate();
    }

    function toggleOutline(id: string) {
        autoExpandedOutline.delete(id);
        toggle(collapsedOutline, id);
    }

    // The outline starts folded; it opens the branches around the section being read and refolds them afterwards,
    // without touching folds the reader toggled themselves.
    function syncOutlineToActive(id: string) {
        const ancestors = new Set(headingsById.get(id)?.ancestorIds ?? []);

        for (const sectionId of [...autoExpandedOutline]) {
            if (!ancestors.has(sectionId)) {
                collapsedOutline.add(sectionId);
                autoExpandedOutline.delete(sectionId);
            }
        }

        for (const sectionId of ancestors) {
            if (collapsedOutline.has(sectionId)) {
                collapsedOutline.delete(sectionId);
                autoExpandedOutline.add(sectionId);
            }
        }
    }

    function setActiveHeading(id: string) {
        if (id === activeHeadingId) return;
        activeHeadingId = id;
        syncOutlineToActive(id);
        if (!settling) highlightActive = true;
    }

    function updateActiveHeading() {
        let id = headings[0]?.id ?? "";

        for (const element of articleElement.querySelectorAll<HTMLElement>("[data-heading]")) {
            if (element.getBoundingClientRect().top > ACTIVE_OFFSET) break;
            id = element.id;
        }

        setActiveHeading(id);
    }

    function scheduleActiveUpdate() {
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            updateActiveHeading();
        });
    }

    /** Briefly lights up the element the reader jumped to, so the eye can find it after the scroll. */
    function flash(element: HTMLElement) {
        element.classList.remove("jump-flash");
        void element.offsetWidth; // restart the animation when jumping to the same target twice
        element.classList.add("jump-flash");
        const clear = () => element.classList.remove("jump-flash");
        element.addEventListener("animationend", clear, { once: true });
        setTimeout(clear, 2000); // in case the animation never runs
    }

    /** Opens any folded sections hiding `id` and returns its element once rendered. */
    async function reveal(id: string): Promise<HTMLElement | null> {
        const blockIndex = anchors[id];
        // not in the article body (e.g. a citation inside the infobox): nothing to unfold
        if (blockIndex === undefined) return document.getElementById(id);

        for (const sectionId of blocks[blockIndex].sectionIds) collapsedSections.delete(sectionId);
        for (const ancestorId of headingsById.get(id)?.ancestorIds ?? []) {
            collapsedOutline.delete(ancestorId);
            autoExpandedOutline.delete(ancestorId);
        }

        await tick();
        return document.getElementById(id);
    }

    async function goToAnchor(id: string) {
        const element = await reveal(id);
        if (!element) return;

        if (safeDecodeURIComponent(location.hash.slice(1)) === id) {
            element.scrollIntoView();
        } else {
            // A native hash change scrolls (respecting scroll-margin), sets :target and adds a history entry.
            location.hash = id;
        }
        flash(element);

        if (headingsById.has(id)) {
            // A deliberate jump always shows where the reader landed, even during the load fade.
            settling = false;
            highlightActive = true;
            setActiveHeading(id);
        }
    }

    function openFromOutline(id: string, event: MouseEvent, close: () => void) {
        event.preventDefault();
        close();
        goToAnchor(id);
    }

    // Same-page links (citations, "see below") may point into folded sections, so route them through goToAnchor.
    function handleArticleClick(event: MouseEvent) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;

        const link = (event.target as Element).closest?.<HTMLAnchorElement>('a[href^="#"]');
        if (!link) return;

        const id = safeDecodeURIComponent(link.getAttribute("href")!.slice(1));
        if (anchors[id] === undefined && !document.getElementById(id)) return;

        event.preventDefault();
        goToAnchor(id);
    }

    function canonicalizeUrl(fragment: string) {
        const canonicalPath = getArticlePath(title);
        const pathChanged = safeDecodeURIComponent(page.url.pathname) !== safeDecodeURIComponent(canonicalPath);
        if (!pathChanged && !(fragment && !page.url.hash)) return;

        const hash = fragment ? `#${encodeURIComponent(fragment)}` : "";
        replaceState(`${canonicalPath}${page.url.search}${hash}`, page.state);
    }

    async function applyRestoreState(state: ArticleViewState) {
        restoredFrom = state;
        collapsedSections.clear();
        state.collapsedSections.forEach((id) => collapsedSections.add(id));
        await tick();
        window.scrollTo({ top: state.scrollY });
        scheduleActiveUpdate();
    }

    $effect(() => {
        if (restoreState && restoreState !== restoredFrom) applyRestoreState(restoreState);
    });

    onMount(() => {
        const hashTarget = safeDecodeURIComponent(page.url.hash.slice(1));
        const fragment = hashTarget || redirectFragment.replaceAll(" ", "_");

        canonicalizeUrl(fragment);

        if (!restoreState && fragment) {
            reveal(fragment).then((element) => {
                element?.scrollIntoView();
                if (element) flash(element);
                if (headingsById.has(fragment)) setActiveHeading(fragment);
                else scheduleActiveUpdate();
            });
        } else {
            scheduleActiveUpdate();
        }

        const fadeTimer = setTimeout(() => {
            if (!settling) return;
            settling = false;
            highlightActive = false;
        }, LOAD_HIGHLIGHT_MS);

        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(fadeTimer);
        };
    });
</script>

<svelte:head>
    <title>{title} • Lemma</title>
</svelte:head>

<svelte:window onscroll={scheduleActiveUpdate} onresize={scheduleActiveUpdate} />

<div class="reading-progress" aria-hidden="true"></div>
<Lightbox />

<ReaderLayout>
    {#snippet outline({ close })}
        {#if headings.length > 0}
            <ArticleBreadcrumbs
                {headings}
                activeId={activeHeadingId}
                {highlightActive}
                collapsedIds={collapsedOutline}
                onToggle={toggleOutline}
                onOpen={(id, event) => openFromOutline(id, event, close)}
            />
        {/if}
    {/snippet}

    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (delegates clicks on same-page links in the body and infobox) -->
    <article bind:this={articleElement} lang="en" onclick={handleArticleClick}>
        <header class="article-header">
            <h1 id="title">{title}</h1>
            {#if description}
                <p class="description">{description}</p>
            {/if}
            <p class="article-meta">
                <span>{stats.words.toLocaleString()} words</span>
                <span>{stats.readingMinutes} min read</span>
                <span>{stats.links.toLocaleString()} links</span>
                <a class="source-link" href={getWikipediaArticleUrl(title)} target="_blank" rel="noopener noreferrer"
                    >Wikipedia<span aria-hidden="true"> ↗</span><span class="sr-only"> (opens in a new tab)</span></a
                >
            </p>
        </header>

        {#if article.infobox}
            <div class="infobox-slot">
                <ArticleInfobox infobox={article.infobox} />
            </div>
        {/if}

        <ArticleContent
            {blocks}
            collapsedSectionIds={collapsedSections}
            onToggleSection={toggleSection}
        />
    </article>
</ReaderLayout>

<style>
    article {
        position: relative;
        /* `backwards` so no transform lingers afterwards (it would trap the fixed/sticky children's positioning) */
        animation: article-in var(--dur-slow) var(--ease-out) backwards;
    }

    @keyframes article-in {
        from {
            opacity: 0;
            transform: translateY(6px);
        }
    }

    /* A hairline under the navbar that fills as you read; pure CSS, only where scroll-driven animations exist. */
    .reading-progress {
        display: none;
    }

    @supports (animation-timeline: scroll()) {
        .reading-progress {
            display: block;
            position: fixed;
            z-index: 21;
            top: calc(var(--nav-height) - 1px);
            left: 0;
            right: 0;
            height: 2px;
            background: var(--accent);
            transform-origin: 0 50%;
            animation: reading-progress linear both;
            animation-timeline: scroll(root);
        }
    }

    @keyframes reading-progress {
        from {
            transform: scaleX(0);
        }

        to {
            transform: scaleX(1);
        }
    }

    /* Wide screens: the infobox sits in the right margin, level with the title. Narrower: inline under the header. */
    @media (min-width: 1280px) {
        .infobox-slot {
            position: absolute;
            top: 1.5rem;
            left: calc(100% + var(--gap));
            width: min(21rem, var(--side-width));
        }
    }

    .article-header {
        margin: 1.5rem 0 2rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid var(--rule);
    }

    #title {
        margin: 0;
        font-size: clamp(2.1rem, 1.6rem + 2vw, 2.75rem);
        font-weight: 600;
        line-height: 1.1;
        letter-spacing: -0.01em;
        text-wrap: balance;
    }

    .description {
        margin: 0.6rem 0 0;
        font-family: default-serif;
        font-size: 1.15rem;
        line-height: 1.4;
        color: var(--muted);
        text-wrap: balance;
    }

    .article-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0.25rem 0;
        margin: 1rem 0 0;
        font-size: 0.8rem;
        font-weight: 500;
        letter-spacing: 0.01em;
        line-height: 1.4;
        color: var(--muted);
        font-variant-numeric: tabular-nums lining-nums;

        > :not(:last-child)::after {
            content: "·";
            margin: 0 0.55em;
            opacity: 0.7;
        }
    }

    .source-link {
        color: inherit;
        text-decoration: none;

        &:hover {
            color: var(--link-hover);
        }
    }
</style>
