<script lang="ts">
    import { onMount } from "svelte";
    import { cubicOut, quintOut } from "svelte/easing";
    import { fetchSummary, type ArticleSummary } from "$lib/api/wikipedia";
    import { getArticlePath, safeDecodeURIComponent } from "$lib/article/articleUtils";
    import { lightbox } from "$lib/lightbox.svelte";
    import { motion } from "$lib/motion";
    import { searchOverlay } from "$lib/search/searchOverlay.svelte";

    // Hover previews for article links, like Wikipedia's own: the summary starts loading as soon as the pointer lands
    // on a link, but the card only appears after a short pause so sweeping across text doesn't flash cards.
    // Also previews citations: hovering a footnote marker shows the reference it points to.
    let {
        currentTitle,
        getReference = () => null,
    }: {
        currentTitle: string;
        /** Sanitized HTML of the reference with this id (from the parsed article, so folded sections work too). */
        getReference?: (id: string) => string | null;
    } = $props();

    const SHOW_DELAY_MS = 350;
    const HIDE_DELAY_MS = 200;
    const CARD_WIDTH = 340;
    const GAP = 10;
    const EDGE = 12;
    // below the link unless there's less room than this and more above
    const ROOM_NEEDED = 320;

    type Loaded = {
        summary: ArticleSummary;
        /** The image has transparent edges (diagram, logo): show it whole on a light backing, not cropped. */
        diagram: boolean;
    };

    type Content = ({ kind: "article" } & Loaded) | { kind: "reference"; label: string; html: string };

    type Preview = Content & {
        href: string;
        left: number;
        /** Where the link's centre falls on the card, so the drop animation grows from the link. */
        originX: number;
        top?: number;
        bottom?: number;
        above: boolean;
    };

    // one load per title for the life of the page; failures resolve to null (no card)
    const loaded = new Map<string, Promise<Loaded | null>>();
    const TRANSPARENCY_WAIT_MS = 500;
    // Content and visibility are separate: hiding only flips `visible`, so the closing animation still has the last
    // card's data to render (nulling it mid-outro crashed and left the card stuck on screen).
    let preview = $state<Preview | null>(null);
    let visible = $state(false);
    let activeLink: HTMLAnchorElement | null = null;
    let showTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;

    let banner = $derived(
        preview?.kind === "article" &&
            preview.summary.thumbnail &&
            preview.summary.thumbnail.width >= preview.summary.thumbnail.height * 1.15,
    );

    /**
     * Whether an image's edges are transparent. File types can't tell a diagram from a painting (both are often PNG),
     * but transparency can: those images look wrong cropped and enlarged, so they're shown whole instead.
     */
    function hasTransparentEdges(src: string): Promise<boolean> {
        return new Promise((resolve) => {
            const image = new Image();
            image.crossOrigin = "anonymous"; // Wikimedia allows it, which lets the canvas read pixels
            image.onerror = () => resolve(false);
            image.onload = () => {
                try {
                    const size = 24;
                    const canvas = document.createElement("canvas");
                    canvas.width = canvas.height = size;
                    const context = canvas.getContext("2d", { willReadFrequently: true })!;
                    context.drawImage(image, 0, 0, size, size);
                    const { data } = context.getImageData(0, 0, size, size);
                    let transparent = 0;
                    for (let i = 0; i < size; i++) {
                        for (const [x, y] of [[i, 0], [i, size - 1], [0, i], [size - 1, i]]) {
                            if (data[(y * size + x) * 4 + 3] < 250) transparent++;
                        }
                    }
                    resolve(transparent > 3);
                } catch {
                    resolve(false);
                }
            };
            image.src = src;
        });
    }

    function load(title: string) {
        if (!loaded.has(title)) {
            const result = fetchSummary(title).then(async (summary): Promise<Loaded> => {
                if (!summary.thumbnail) return { summary, diagram: false };
                // renders of SVGs are always illustrations (charts, maps, logos), even with a solid background
                if (/\.svg\.png(\?|$)/i.test(summary.thumbnail.src)) return { summary, diagram: true };
                // don't hold the card back for a slow image: fall back to the photo treatment
                const wait = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), TRANSPARENCY_WAIT_MS));
                return { summary, diagram: await Promise.race([hasTransparentEdges(summary.thumbnail.src), wait]) };
            });
            loaded.set(title, result.catch(() => null));
        }
        return loaded.get(title)!;
    }

    /** The article a link points to, if it's one worth previewing (not this article, not a section of it). */
    function previewTitle(link: HTMLAnchorElement): string | null {
        const href = link.getAttribute("href");
        if (!href?.startsWith("/wiki/") || link.closest(".link-preview")) return null;
        const title = safeDecodeURIComponent(href.slice("/wiki/".length).split("#")[0]).replaceAll("_", " ");
        if (!title || title === currentTitle) return null;
        return title;
    }

    /** The reference a footnote marker points to: its number/letter and text. */
    function referenceFor(link: HTMLAnchorElement): { label: string; html: string } | null {
        const href = link.getAttribute("href");
        if (!href?.startsWith("#") || !link.closest("sup.reference")) return null;
        const html = getReference(safeDecodeURIComponent(href.slice(1)));
        if (!html) return null;
        const label = (link.textContent ?? "").replace(/[[\]]/g, "").trim();
        return { label, html };
    }

    function linkFrom(target: EventTarget | null): HTMLAnchorElement | null {
        const link = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
        return link?.closest("article") ? link : null;
    }

    function place(link: HTMLAnchorElement, content: Content, pointerY?: number) {
        // wrapped links have several boxes; use the line under the pointer
        const rects = [...link.getClientRects()];
        const rect = (pointerY !== undefined && rects.find((r) => pointerY >= r.top - 2 && pointerY <= r.bottom + 2)) || rects[0];
        if (!rect) return;

        // centred on the link text, nudged inwards only as far as needed to stay on screen
        const anchorX = rect.left + rect.width / 2;
        const left = Math.min(Math.max(anchorX - CARD_WIDTH / 2, EDGE), window.innerWidth - CARD_WIDTH - EDGE);
        const originX = Math.min(Math.max(anchorX - left, 16), CARD_WIDTH - 16);
        const roomBelow = window.innerHeight - rect.bottom;
        const above = roomBelow < ROOM_NEEDED && rect.top > roomBelow;

        preview = {
            ...content,
            href: link.getAttribute("href")!,
            left,
            originX,
            ...(above ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
            above,
        };
        visible = true;
    }

    function show(link: HTMLAnchorElement, pointer?: { x: number; y: number }) {
        if (lightbox.open || searchOverlay.open) return;
        const reference = referenceFor(link);
        const title = reference ? null : previewTitle(link);
        if (!reference && !title) return;

        clearTimeout(hideTimer);
        if (activeLink === link && visible) return;
        activeLink = link;
        clearTimeout(showTimer);

        // start loading now, during the pause
        const pending: Promise<Content | null> = reference
            ? Promise.resolve({ kind: "reference", ...reference })
            : load(title!).then((result) => (result ? { kind: "article", ...result } : null));
        showTimer = setTimeout(async () => {
            const result = await pending;
            if (activeLink !== link || !result || lightbox.open || searchOverlay.open) return;
            place(link, result, pointer?.y);
        }, SHOW_DELAY_MS);
    }

    function hideSoon() {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hideNow, HIDE_DELAY_MS);
    }

    function hideNow() {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        activeLink = null;
        visible = false;
    }

    function handlePointerOver(event: PointerEvent) {
        if (event.pointerType === "touch") return; // touch has no hover; a tap should just follow the link
        const link = linkFrom(event.target);
        if (link) show(link, { x: event.clientX, y: event.clientY });
    }

    function handlePointerOut(event: PointerEvent) {
        const link = linkFrom(event.target);
        if (!link || link !== activeLink) return;
        // moving from the link into the card keeps it open
        const to = event.relatedTarget as Element | null;
        if (to && (link.contains(to) || to.closest?.(".link-preview"))) return;
        hideSoon();
    }

    // keyboard: show for links reached with Tab, as a visual aid (the link itself stays the thing you activate)
    function handleFocusIn(event: FocusEvent) {
        const link = linkFrom(event.target);
        if (link?.matches(":focus-visible")) show(link);
    }

    function handleFocusOut(event: FocusEvent) {
        if (linkFrom(event.target) === activeLink) hideSoon();
    }

    function handlePointerDown(event: PointerEvent) {
        if (!(event.target as Element).closest?.(".link-preview")) hideNow();
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape" && visible) hideNow();
    }

    // the card follows the page closing other overlays (search, viewer) and disappears with them
    $effect(() => {
        if (lightbox.open || searchOverlay.open) hideNow();
    });

    const DROP_MS = 280;
    const LIFT_MS = 140;

    /**
     * Arrival: the card drops into place. Each property gets its own curve from the same linear clock: the drop
     * settles slowly (quint), while opacity and the blur clear early (cubic, ~60% of the way), so the card is solid
     * before it finishes moving.
     */
    function drop(_node: Element) {
        return {
            duration: motion(DROP_MS),
            css: (t: number) => {
                const settle = quintOut(t);
                const fade = cubicOut(Math.min(1, t / 0.6));
                return `opacity: ${fade}; transform: translateY(${(1 - settle) * -8}px) scale(${0.97 + settle * 0.03}); filter: blur(${(1 - fade) * 2}px);`;
            },
        };
    }

    /** Departure: a quick lift and fade, so dismissing never feels slower than reading on. */
    function lift(_node: Element) {
        return {
            duration: motion(LIFT_MS),
            easing: cubicOut,
            css: (t: number) => `opacity: ${t}; transform: translateY(${(1 - t) * -4}px) scale(${0.985 + t * 0.015});`,
        };
    }

    onMount(() => {
        document.addEventListener("pointerover", handlePointerOver);
        document.addEventListener("pointerout", handlePointerOut);
        document.addEventListener("focusin", handleFocusIn);
        document.addEventListener("focusout", handleFocusOut);
        return () => {
            document.removeEventListener("pointerover", handlePointerOver);
            document.removeEventListener("pointerout", handlePointerOut);
            document.removeEventListener("focusin", handleFocusIn);
            document.removeEventListener("focusout", handleFocusOut);
            hideNow();
        };
    });
</script>

<svelte:window onscroll={hideNow} onresize={hideNow} onpointerdown={handlePointerDown} onkeydown={handleKeydown} />

{#if visible && preview?.kind === "reference"}
    <!-- the reference stays readable and its links (sources, archives) clickable; the marker itself is what's announced -->
    <div
        class="link-preview reference"
        class:above={preview.above}
        role="note"
        aria-label="Reference {preview.label}"
        style:left="{preview.left}px"
        style:--origin-x="{preview.originX}px"
        style:top={preview.top !== undefined ? `${preview.top}px` : undefined}
        style:bottom={preview.bottom !== undefined ? `${preview.bottom}px` : undefined}
        style:width="{CARD_WIDTH}px"
        onpointerenter={() => clearTimeout(hideTimer)}
        onpointerleave={hideSoon}
        in:drop
        out:lift
    >
        <p class="reference-label">Reference {preview.label}</p>
        <div class="reference-text">{@html preview.html}</div>
    </div>
{:else if visible && preview?.kind === "article"}
    {@const { summary } = preview}
    <!-- a visual aid for the hovered/focused link, which is what assistive tech already announces -->
    <a
        class="link-preview"
        class:above={preview.above}
        href={preview.href}
        tabindex="-1"
        aria-hidden="true"
        style:left="{preview.left}px"
        style:--origin-x="{preview.originX}px"
        style:top={preview.top !== undefined ? `${preview.top}px` : undefined}
        style:bottom={preview.bottom !== undefined ? `${preview.bottom}px` : undefined}
        style:width="{CARD_WIDTH}px"
        onpointerenter={() => clearTimeout(hideTimer)}
        onpointerleave={hideSoon}
        onclick={hideNow}
        in:drop
        out:lift
    >
        {#if summary.thumbnail && banner}
            <img class="banner" class:diagram={preview.diagram} src={summary.thumbnail.src} alt="" />
        {/if}
        <div class="body">
            {#if summary.thumbnail && !banner}
                <img class="portrait" class:diagram={preview.diagram} src={summary.thumbnail.src} alt="" />
            {/if}
            <p class="title">{summary.title}</p>
            {#if summary.description}
                <p class="description">{summary.description}</p>
            {/if}
            {#if summary.disambiguation}
                <p class="extract note">This title may refer to several topics. Open it to see them all.</p>
            {:else if summary.extract}
                <p class="extract">{summary.extract}</p>
            {/if}
        </div>
    </a>
{/if}

<style>
    .link-preview {
        position: fixed;
        z-index: 35;
        display: block;
        overflow: hidden;
        box-sizing: border-box;
        border: 1px solid var(--rule);
        border-radius: 12px;
        background: var(--bg-color);
        box-shadow:
            0 1px 2px color-mix(in oklch, var(--shadow-color) 70%, transparent),
            0 18px 40px -18px var(--shadow-color);
        color: var(--text-color);
        text-decoration: none;
        transform-origin: var(--origin-x, 50%) 0;

        &.above {
            transform-origin: var(--origin-x, 50%) 100%;
        }

        &:hover {
            color: var(--text-color);
            border-color: var(--secondary);
        }
    }

    .banner {
        display: block;
        width: 100%;
        height: 150px;
        object-fit: cover;
        background: var(--secondary);
    }

    /* img.diagram outranks .banner/.portrait, whichever order they're declared in */
    img.diagram {
        box-sizing: border-box;
        object-fit: contain;
        object-position: center;
        padding: 10px;
        background: color-mix(in oklch, var(--secondary) 22%, var(--bg-color));

        @media (prefers-color-scheme: dark) {
            background: oklch(0.95 0.006 var(--hue));
        }
    }

    .body {
        display: flow-root;
        padding: 0.85rem 1rem 0.95rem;
    }

    .portrait {
        float: right;
        width: 64px;
        height: 80px;
        margin: 0.1rem 0 0.4rem 0.85rem;
        border-radius: 8px;
        object-fit: cover;
        object-position: 50% 25%;
        background: var(--secondary);
    }

    p {
        margin: 0;
        font-size: inherit;
    }

    .title {
        font-family: default-serif;
        font-size: 1.05rem;
        font-weight: 600;
        line-height: 1.25;
        text-wrap: balance;
    }

    .description {
        margin-top: 0.15rem;
        font-size: 0.78rem;
        line-height: 1.35;
        color: var(--muted);
    }

    .extract {
        margin-top: 0.55rem;
        font-size: 0.85rem;
        line-height: 1.5;
        text-wrap: pretty;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 6;
        line-clamp: 6;
        overflow: hidden;

        &.note {
            color: var(--muted);
            font-style: italic;
        }
    }

    /* citation previews */
    .reference {
        padding: 0.8rem 1rem 0.9rem;
    }

    .reference-label {
        font-size: 0.7rem;
        font-weight: 650;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--muted);
    }

    .reference-text {
        margin-top: 0.35rem;
        max-height: 14rem;
        overflow-y: auto;
        overscroll-behavior: contain;
        font-size: 0.85rem;
        line-height: 1.5;
        overflow-wrap: break-word;
        text-wrap: pretty;

        :global(a) {
            color: inherit;
            text-decoration-color: color-mix(in oklch, currentColor 30%, transparent);
            text-underline-offset: 0.18em;
        }

        :global(a:hover) {
            color: var(--link-hover);
        }

        :global(a.external::after) {
            display: none;
        }

        :global(cite) {
            font-style: normal;
        }
    }
</style>
