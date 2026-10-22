<script lang="ts" module>
    export type ArticleViewState = {
        scrollY: number;
        collapsedSections: string[];
        /** Whether the inline infobox was showing all facts (optional: older snapshots don't have it). */
        infoboxExpanded?: boolean;
    };
</script>

<script lang="ts">
    import { flushSync, onMount, tick } from "svelte";
    import { prefersReducedMotion } from "svelte/motion";
    import { SvelteSet } from "svelte/reactivity";
    import { page } from "$app/state";
    import { replaceState } from "$app/navigation";
    import { getCollapsibleHeadingIds } from "$lib/article/articleNavigation";
    import { collectText, findTextRanges, normalizeQuery } from "$lib/article/findText";
    import { isTypingTarget } from "$lib/search/searchOverlay.svelte";
    import { getArticlePath, isFoldableHeadingLevel, resizeWikimediaThumb, safeDecodeURIComponent } from "$lib/article/articleUtils";
    import { openStreetMapUrl } from "$lib/article/mapsAndMath";
    import type { ArticleMeta, ParsedArticle } from "$lib/article/types";
    import { sampleTint } from "$lib/imageTint";
    import { library, type ReadingPosition } from "$lib/library.svelte";
    import { trail } from "$lib/trail.svelte";
    import { motionPaused, rise } from "$lib/motion";
    import ReaderLayout from "../ReaderLayout.svelte";
    import ArticleActions from "./ArticleActions.svelte";
    import ArticleBreadcrumbs from "./ArticleBreadcrumbs.svelte";
    import ArticleContent from "./ArticleContent.svelte";
    import Icon from "../icons/Icon.svelte";
    import ArticleFooter from "./ArticleFooter.svelte";
    import ArticleInfobox from "./ArticleInfobox.svelte";
    import ArticleLanguages from "./ArticleLanguages.svelte";
    import ArticleReadNext from "./ArticleReadNext.svelte";
    import ArticleRelated from "./ArticleRelated.svelte";
    import QuoteShare from "./QuoteShare.svelte";
    import Lightbox from "./Lightbox.svelte";
    import LinkPreview from "./LinkPreview.svelte";

    interface Props {
        article: ParsedArticle;
        /** Section a redirect pointed at (e.g. "Alan Turing#Early life"), used when the URL has no hash. */
        redirectFragment?: string;
        /** Scroll position and folds from a back/forward snapshot. */
        restoreState?: ArticleViewState | null;
        meta?: ArticleMeta;
    }

    let {
        article,
        redirectFragment = "",
        restoreState = null,
        meta = { redirectedFrom: "", languages: [], categories: [] },
    }: Props = $props();

    const BADGE_LABELS = { featured: "Featured article", good: "Good article" } as const;

    // A heading counts as "current" once its top passes this far below the viewport top (under the navbar).
    const ACTIVE_OFFSET = 140;
    // While the page settles after loading (scroll restore, a hash jump), moves don't count as the reader's own.
    const LOAD_HIGHLIGHT_MS = 1500;

    // This component is re-created for every article ({#key} in the route), so per-article state is set up once.
    // svelte-ignore state_referenced_locally
    const { title, description, blocks, headings, anchors, coordinates } = article;
    // a small picture for the reader's history and saved list
    // svelte-ignore state_referenced_locally
    const firstImage = article.infobox?.images[0] ?? blocks.find((block) => block.type === "images")?.images[0];
    const thumbnail = firstImage ? resizeWikimediaThumb(firstImage.src, 160) : "";
    const headingsById = new Map(headings.map((heading) => [heading.id, heading]));
    const collapsedSections = new SvelteSet<string>();
    const collapsedOutline = new SvelteSet<string>(getCollapsibleHeadingIds(headings));
    const autoExpandedOutline = new Set<string>();

    let activeHeadingId = $state(headings[0]?.id ?? "");
    // hidden as the article opens (it would only say "you're at the start"); it appears once the reader moves
    let highlightActive = $state(false);
    // True while the page is still settling after load (initial scroll, hash or snapshot restore).
    let settling = true;
    let articleElement = $state() as HTMLElement;
    let frame = 0;
    let restoredFrom: ArticleViewState | null = null;
    let infoboxExpanded = $state(false);
    // Set when goToAnchor changes the hash itself, so the hashchange listener doesn't handle that jump twice.
    let ownHashChange: string | null = null;

    export function captureState(): ArticleViewState {
        return { scrollY: window.scrollY, collapsedSections: [...collapsedSections], infoboxExpanded };
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

    // Reference text for citation previews, read from the parsed article so it works while the list is folded away.
    const references = new Map<string, string | null>();
    function referenceHtml(id: string): string | null {
        if (references.has(id)) return references.get(id)!;
        let html: string | null = null;
        const block = blocks[anchors[id]];
        if (block?.type === "html") {
            const item = new DOMParser().parseFromString(block.html, "text/html").getElementById(id);
            html = (item?.querySelector(".reference-text") ?? item)?.innerHTML.trim() || null;
        }
        references.set(id, html);
        return html;
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
            ownHashChange = id;
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

    /** Unfolds whatever hides `id`, then scrolls to it and flashes it. */
    async function showTarget(id: string) {
        const element = await reveal(id);
        if (!element) return;
        element.scrollIntoView();
        flash(element);
        if (headingsById.has(id)) setActiveHeading(id);
        else scheduleActiveUpdate();
    }

    // Back/forward between hash entries: the target may sit in a section folded since, which the browser can't reach.
    function handleHashChange() {
        const id = safeDecodeURIComponent(location.hash.slice(1));
        if (!id) return;
        if (id === ownHashChange) {
            ownHashChange = null;
            return;
        }
        showTarget(id);
    }

    async function applyRestoreState(state: ArticleViewState) {
        restoredFrom = state;
        collapsedSections.clear();
        state.collapsedSections.forEach((id) => collapsedSections.add(id));
        // restore the infobox's height before the scroll position, or the page could be too short to scroll back
        infoboxExpanded = state.infoboxExpanded ?? false;
        await tick();
        window.scrollTo({ top: state.scrollY });
        scheduleActiveUpdate();
    }

    $effect(() => {
        if (restoreState && restoreState !== restoredFrom) applyRestoreState(restoreState);
    });

    // ---------- reading position ----------

    // Where the reader is, anchored to the section heading above them (so it survives layout changes better than a
    // raw scroll offset).
    function currentPosition(): Omit<ReadingPosition, "at"> {
        const heading = activeHeadingId ? document.getElementById(activeHeadingId) : null;
        const headingTop = heading ? heading.getBoundingClientRect().top + window.scrollY : 0;
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        return {
            headingId: heading ? activeHeadingId : "",
            headingText: heading ? (headingsById.get(activeHeadingId)?.text ?? "") : "",
            offset: Math.round(window.scrollY - headingTop),
            progress: scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 1,
        };
    }

    let positionTimer: ReturnType<typeof setTimeout> | undefined;
    function rememberPosition() {
        clearTimeout(positionTimer);
        positionTimer = setTimeout(savePositionNow, 700);
    }

    function savePositionNow() {
        clearTimeout(positionTimer);
        positionTimer = undefined;
        // only while the article is on screen: after navigating away the scroll position belongs to the next page
        if (settling || !articleElement?.isConnected) return;
        // back near the top: next time starts from the beginning anyway
        if (window.scrollY < 400) library.clearPosition(title);
        else library.savePosition(title, currentPosition());
    }

    // ---------- the article's mood ----------

    // Lemma's own warm hue; an article's accents lean most of the way toward its lead picture's colour from it
    const BASE_HUE = 75;
    const TINT_STRENGTH = 0.9;

    // the first photograph: logos, maps and diagrams (SVGs) say little about an article's mood
    // svelte-ignore state_referenced_locally
    const leadPhoto = [...(article.infobox?.images ?? []), ...blocks.flatMap((block) => (block.type === "images" ? block.images : []))].find(
        (image) => !/\.svg/i.test(image.fileName ?? image.src),
    );

    $effect(() => {
        if (!leadPhoto) return;
        const controller = new AbortController();
        const root = document.documentElement;
        sampleTint(resizeWikimediaThumb(leadPhoto.src, 120), controller.signal).then((tint) => {
            if (!tint || controller.signal.aborted) return;
            // the short way round the colour wheel
            const delta = ((tint.hue - BASE_HUE + 540) % 360) - 180;
            root.style.setProperty("--accent-hue", String(Math.round(BASE_HUE + delta * TINT_STRENGTH)));
        });
        return () => {
            controller.abort();
            root.style.removeProperty("--accent-hue");
        };
    });

    // ---------- quotes, shortcuts, printing ----------

    // each block's searchable text, worked out the first time a quote link needs it
    const blockTexts = new Map<number, string>();
    function blockText(index: number): string {
        let text = blockTexts.get(index);
        if (text === undefined) {
            const block = blocks[index];
            const html =
                block.type === "heading" ? block.heading.text : block.type === "html" ? block.html : block.images.map((image) => image.caption).join(" ");
            text = collectText(new DOMParser().parseFromString(html, "text/html").body).text;
            blockTexts.set(index, text);
        }
        return text;
    }

    /** Unfolds any folded sections whose text contains `query`, and waits for them to render. */
    async function revealMatches(query: string) {
        const needle = normalizeQuery(query);
        let opened = false;
        blocks.forEach((block, index) => {
            if (!block.sectionIds.some((id) => collapsedSections.has(id))) return;
            if (!blockText(index).includes(needle)) return;
            for (const id of block.sectionIds) opened = collapsedSections.delete(id) || opened;
        });
        if (opened) await tick();
    }

    // A shared quote link (?quote=…): find the passage, open its section, and mark it.
    async function showQuote(quote: string): Promise<boolean> {
        await revealMatches(quote);
        const body = articleElement.querySelector(".article-body");
        const [range] = body ? findTextRanges(body, quote, { limit: 1 }) : [];
        if (!range) return false;
        const rect = range.getBoundingClientRect();
        window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight / 3 });
        if (typeof CSS !== "undefined" && "highlights" in CSS) {
            CSS.highlights.set("lemma-quote", new Highlight(range));
            // the mark stays until the reader clicks or starts selecting elsewhere
            window.addEventListener("pointerdown", () => CSS.highlights.delete("lemma-quote"), { once: true });
        }
        settling = false;
        scheduleActiveUpdate();
        return true;
    }

    /** The foldable section the reader is in: the current heading, or its nearest foldable ancestor. */
    function currentFoldableSection(): string | null {
        const heading = headingsById.get(activeHeadingId);
        if (!heading) return null;
        const chain = [heading.id, ...[...heading.ancestorIds].reverse()];
        return chain.find((id) => isFoldableHeadingLevel(headingsById.get(id)?.level ?? 0)) ?? null;
    }

    function jumpToSection(direction: 1 | -1) {
        const elements = [...articleElement.querySelectorAll<HTMLElement>("[data-heading]")];
        // relative to where a jump puts a heading (its scroll margin), so the heading just jumped to counts as "here"
        const tops = elements.map(
            (element) => element.getBoundingClientRect().top - (Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0),
        );
        const index = direction === 1 ? tops.findIndex((top) => top > 2) : tops.findLastIndex((top) => top < -2);
        const target = elements[index];
        if (!target) {
            if (direction === -1) window.scrollTo({ top: 0, behavior: prefersReducedMotion.current ? "auto" : "smooth" });
            return;
        }
        target.scrollIntoView({ behavior: prefersReducedMotion.current ? "auto" : "smooth" });
        settling = false;
        highlightActive = true;
        setActiveHeading(target.id);
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented || isTypingTarget(event.target)) return;

        switch (event.key) {
            case "j":
                jumpToSection(1);
                break;
            case "k":
                jumpToSection(-1);
                break;
            case "[":
            case "]": {
                const id = currentFoldableSection();
                if (!id) return;
                const folding = event.key === "[";
                if (folding === collapsedSections.has(id)) return;
                toggleSection(id);
                if (folding) document.getElementById(id)?.scrollIntoView({ block: "nearest" });
                break;
            }
            case "s":
                library.toggleSaved({ title, description, thumbnail });
                break;
            case "t":
                window.scrollTo({ top: 0, behavior: prefersReducedMotion.current ? "auto" : "smooth" });
                break;
            default:
                return;
        }
        event.preventDefault();
    }

    // Printing shows everything: folded sections and the infobox's hidden facts open for the printout, then go back.
    let beforePrint: { collapsed: string[]; infoboxExpanded: boolean } | null = null;
    function handleBeforePrint() {
        beforePrint = { collapsed: [...collapsedSections], infoboxExpanded };
        motionPaused.current = true;
        flushSync(() => {
            collapsedSections.clear();
            infoboxExpanded = true;
        });
    }

    function handleAfterPrint() {
        motionPaused.current = false;
        if (!beforePrint) return;
        const { collapsed, infoboxExpanded: expanded } = beforePrint;
        beforePrint = null;
        collapsed.forEach((id) => collapsedSections.add(id));
        infoboxExpanded = expanded;
    }

    // An offer to start over, shown after the article reopens where the reader left it.
    let resumed = $state<ReadingPosition | null>(null);
    let resumeTimer: ReturnType<typeof setTimeout>;

    async function resume(position: ReadingPosition) {
        let top = position.offset;
        if (position.headingId) {
            const heading = await reveal(position.headingId);
            if (!heading) return;
            top += heading.getBoundingClientRect().top + window.scrollY;
        }
        window.scrollTo({ top });
        scheduleActiveUpdate();
        resumed = position;
        resumeTimer = setTimeout(() => (resumed = null), 7000);
    }

    function startOver() {
        resumed = null;
        clearTimeout(resumeTimer);
        library.clearPosition(title);
        window.scrollTo({ top: 0, behavior: prefersReducedMotion.current ? "auto" : "smooth" });
    }

    onMount(() => {
        const hashTarget = safeDecodeURIComponent(page.url.hash.slice(1));
        const fragment = hashTarget || redirectFragment.replaceAll(" ", "_");

        canonicalizeUrl(fragment);

        library.recordVisit({ title, description, thumbnail });
        trail.visit(title);

        // reopening an article picks up where the reader left off (unless the link points somewhere specific)
        const quote = page.url.searchParams.get("quote")?.trim() ?? "";
        const saved = !restoreState && !fragment && !quote ? library.position(title) : null;
        if (!restoreState && fragment) {
            showTarget(fragment);
        } else if (!restoreState && quote) {
            showQuote(quote).then((found) => found || scheduleActiveUpdate());
        } else if (saved && saved.progress < 0.97) {
            resume(saved);
        } else {
            scheduleActiveUpdate();
        }

        const fadeTimer = setTimeout(() => {
            if (!settling) return;
            settling = false;
            highlightActive = false;
        }, LOAD_HIGHLIGHT_MS);

        // leaving the page (or the tab closing) records the position straight away
        const handlePageHide = () => savePositionNow();
        window.addEventListener("pagehide", handlePageHide);

        return () => {
            // a scroll just before leaving hasn't been saved yet
            if (positionTimer) savePositionNow();
            window.removeEventListener("pagehide", handlePageHide);
            cancelAnimationFrame(frame);
            clearTimeout(fadeTimer);
            clearTimeout(resumeTimer);
        };
    });

    function handleScroll() {
        scheduleActiveUpdate();
        rememberPosition();
    }
</script>

<svelte:head>
    <title>{title} • Lemma</title>
</svelte:head>

<svelte:window
    onscroll={handleScroll}
    onresize={scheduleActiveUpdate}
    onhashchange={handleHashChange}
    onkeydown={handleKeydown}
    onbeforeprint={handleBeforePrint}
    onafterprint={handleAfterPrint}
/>

<div class="reading-progress" aria-hidden="true"></div>
<!-- the article's mood: a faint wash of its colour across the top of the page -->
<div class="mood" aria-hidden="true"></div>
<Lightbox />
<LinkPreview currentTitle={title} getReference={referenceHtml} />
<QuoteShare {title} root={articleElement} />

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
    <article bind:this={articleElement} lang="en" class:disambiguation={meta.disambiguation} onclick={handleArticleClick}>
        <header class="article-header">
            {#if meta.disambiguation}
                <p class="kicker">Disambiguation</p>
            {:else if meta.badge}
                <p class="kicker badge {meta.badge}" title="Wikipedia's editors rate this among its best articles">
                    <Icon name={meta.badge === "featured" ? "star" : "badge-check"} size="1.05em" />
                    {BADGE_LABELS[meta.badge]}
                </p>
            {/if}
            <!-- focusable so "Back to top" can move keyboard focus here -->
            <h1 id="title" class="morph-title" tabindex="-1">{title}</h1>
            {#if description}
                <p class="description">{description}</p>
            {/if}
            {#if meta.redirectedFrom && meta.redirectedFrom !== title}
                <p class="redirected">
                    <Icon name="corner-down-right" size="0.9em" />
                    Redirected from <span class="from">{meta.redirectedFrom}</span>
                </p>
            {/if}
            <ArticleActions
                {title}
                {description}
                {thumbnail}
                spoken={article.spoken}
                revisionId={meta.revisionId ?? null}
            >
                {#if meta.languages.length > 0}
                    <ArticleLanguages languages={meta.languages} />
                {/if}
                {#if coordinates}
                    <a class="action-pill" href={openStreetMapUrl(coordinates, 14)} target="_blank" rel="noopener noreferrer">
                        <Icon name="map-pin" size="0.9em" />
                        {Math.abs(coordinates.lat).toFixed(2)}° {coordinates.lat >= 0 ? "N" : "S"},
                        {Math.abs(coordinates.lon).toFixed(2)}° {coordinates.lon >= 0 ? "E" : "W"}<span class="sr-only">
                            (map, opens in a new tab)</span
                        >
                    </a>
                {/if}
            </ArticleActions>
        </header>

        {#if article.infobox}
            <div class="infobox-slot">
                <ArticleInfobox infobox={article.infobox} bind:expanded={infoboxExpanded} />
            </div>
        {/if}

        <ArticleContent
            {blocks}
            collapsedSectionIds={collapsedSections}
            onToggleSection={toggleSection}
            styles={article.styles}
        />

        {#if article.related.length > 0}
            <ArticleRelated topics={article.related} />
        {/if}

        <ArticleReadNext {title} categories={meta.categories} sisters={article.sisters} />

        <ArticleFooter {title} />
    </article>
</ReaderLayout>

{#if resumed}
    <div
        class="resume-toast"
        role="status"
        transition:rise={{ y: 16 }}
    >
        <Icon name="history" size="0.95em" />
        <span>
            Picked up where you left off{#if resumed.headingText}, in <b>{resumed.headingText}</b>{/if}
        </span>
        <button type="button" onclick={startOver}>Start from the top</button>
        <button type="button" class="dismiss" aria-label="Dismiss" onclick={() => (resumed = null)}>
            <Icon name="x" size="0.8em" />
        </button>
    </div>
{/if}

<style>
    article {
        position: relative;
        /* `backwards` so no filter or translate lingers afterwards (it would trap fixed/sticky children) */
        animation: enter var(--dur-slow) var(--ease-out) backwards;
    }

    /*
     * The article's colour (its accent, tinted by the lead photo) laid across the top of the page in a few soft,
     * overlapping washes, fading out as the page goes on. A faint grain keeps the gradient from banding and makes it
     * read as paper rather than screen.
     */
    .mood {
        position: absolute;
        z-index: -1;
        top: 0;
        left: 0;
        right: 0;
        height: 115vh;
        pointer-events: none;
        background:
            radial-gradient(55% 45% at 28% 8%, color-mix(in oklch, var(--accent) 9%, transparent), transparent 75%),
            radial-gradient(45% 40% at 78% 4%, color-mix(in oklch, var(--link-hover) 6%, transparent), transparent 75%),
            radial-gradient(80% 60% at 50% 25%, color-mix(in oklch, var(--accent) 4%, transparent), transparent 80%);
        mask-image: linear-gradient(to bottom, black 35%, transparent);

        &::after {
            content: "";
            position: absolute;
            inset: 0;
            opacity: 0.05;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
            mix-blend-mode: multiply;
        }

        @media (prefers-color-scheme: dark) {
            &::after {
                mix-blend-mode: screen;
                opacity: 0.03;
            }
        }

        @media print {
            display: none;
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

    /* the rule under the header has the same space on both sides */
    .article-header {
        position: relative;
        margin: 1.5rem 0 1.75rem;
        padding-bottom: 1.75rem;
        border-bottom: 1px solid var(--rule);
    }

    /* a faint wash of the article's colour (its accent, tinted by the lead picture) behind the header */

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

    .redirected {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin: 0.5rem 0 0;
        font-size: 0.8rem;
        line-height: 1.4;
        color: var(--muted);

        .from {
            font-style: italic;
        }
    }


    .kicker {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin: 0 0 0.6rem;
        font-size: 0.72rem;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);

        &.featured {
            color: oklch(0.68 0.13 75);
        }

        &.good {
            color: oklch(0.58 0.11 150);
        }
    }


    /* Disambiguation pages are lists of meanings: each entry reads as a row, its main link leading. */
    .disambiguation :global(.article-body .block.list) {
        /* rows bleed into the margin so their text lines up with the paragraphs around them */
        > :global(ul) {
            margin-inline: -0.65rem;
            padding-left: 0;
            list-style: none;
        }

        :global(li) {
            margin: 0;
            padding: 0.3rem 0.65rem;
            border-radius: 8px;
            line-height: 1.5;
            transition: background-color var(--dur-fast);
        }

        :global(li:hover) {
            background: color-mix(in oklch, var(--secondary) 28%, transparent);
        }

        :global(li > a:first-child) {
            font-weight: 600;
        }

        :global(li ul) {
            margin-top: 0.3rem;
            padding-left: 0.9rem;
        }
    }

    .resume-toast {
        position: fixed;
        z-index: 30;
        left: 50%;
        bottom: calc(1.25rem + env(safe-area-inset-bottom));
        translate: -50% 0;
        /* concentric: the buttons sit the same --inset from the top, bottom and end, so their round ends follow the
           toast's own (outer radius = inner radius + inset) */
        --inset: 5px;
        --control: 2rem;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        width: max-content;
        max-width: min(40rem, calc(100vw - 2rem));
        box-sizing: border-box;
        padding: var(--inset) var(--inset) var(--inset) 0.95rem;
        border: 1px solid var(--rule);
        border-radius: calc(var(--control) / 2 + var(--inset));
        background: var(--bg-color);
        box-shadow: 0 16px 36px -14px var(--shadow-color);
        font-size: 0.82rem;
        line-height: 1.35;
        color: var(--text-color);

        > :global(.icon) {
            color: var(--muted);
        }

        /* one line, so the toast keeps the height that makes it concentric; a long section name is shortened */
        span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        b {
            font-weight: 600;
        }

        button {
            flex: none;
            height: var(--control);
            padding: 0 0.85rem;
            border: none;
            border-radius: calc(var(--control) / 2);
            background: color-mix(in oklch, var(--accent) 12%, var(--bg-color));
            font: inherit;
            font-weight: 600;
            color: var(--accent);
            cursor: pointer;
            transition:
                background-color var(--dur-fast),
                scale var(--dur-instant) var(--ease-out);

            &:hover {
                background: color-mix(in oklch, var(--accent) 20%, var(--bg-color));
            }
        }

        /* sharing the toast's last stretch with "Start from the top", tucked close */
        .dismiss {
            display: grid;
            place-items: center;
            width: var(--control);
            margin-left: -0.35rem;
            padding: 0;
            background: none;
            color: var(--muted);

            &:hover {
                background: color-mix(in oklch, var(--secondary) 35%, transparent);
                color: var(--text-color);
            }
        }

    }

</style>
