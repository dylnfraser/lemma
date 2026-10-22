<script lang="ts" module>
    // Links to a passage carry its opening words; more isn't needed to find it, and keeps links short.
    const QUOTE_LINK_CHARS = 160;

    /** A link to the article that scrolls to (and marks) the quoted passage. */
    export function quoteUrl(articlePath: string, text: string): string {
        let words = text.replace(/\s+/g, " ").trim();
        if (words.length > QUOTE_LINK_CHARS) words = words.slice(0, QUOTE_LINK_CHARS).replace(/\s+\S*$/, "");
        const url = new URL(articlePath, window.location.origin);
        url.searchParams.set("quote", words);
        return url.href;
    }
</script>

<script lang="ts">
    import { getArticlePath } from "$lib/article/articleUtils";
    import { pop } from "$lib/motion";
    import Icon from "../icons/Icon.svelte";

    // Select text in the article to copy it as a quote (with where it's from) or as a link straight to it.
    interface Props {
        title: string;
        /** Selections inside this element count. */
        root: HTMLElement | undefined;
    }

    let { title, root }: Props = $props();

    const MIN_CHARS = 3;
    const MAX_CHARS = 1500;

    let text = $state("");
    let position = $state<{ x: number; y: number; below: boolean } | null>(null);
    let copied = $state<"quote" | "link" | null>(null);
    let toolbar = $state<HTMLElement>();
    let range: Range | null = null;
    let selectionTimer: ReturnType<typeof setTimeout>;
    let copiedTimer: ReturnType<typeof setTimeout>;
    // touch screens show their own menu above a selection, so the toolbar goes underneath
    const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

    function readSelection() {
        const selection = getSelection();
        const selected = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
        if (!selection || selection.rangeCount === 0 || selected.length < MIN_CHARS || selected.length > MAX_CHARS || !root) {
            hide();
            return;
        }
        const candidate = selection.getRangeAt(0);
        const container = candidate.commonAncestorContainer;
        const element = container instanceof Element ? container : container.parentElement;
        // only the article's own text: not its header controls, inputs or the find bar
        if (!element || !root.contains(element) || element.closest("input, textarea, button, .article-header")) {
            hide();
            return;
        }
        range = candidate;
        text = selected;
        copied = null;
        place();
    }

    function place() {
        if (!range) return;
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return hide();
        const half = (toolbar?.offsetWidth ?? 200) / 2;
        const x = Math.min(Math.max(rect.left + rect.width / 2, half + 8), window.innerWidth - half - 8);
        const below = coarse || rect.top < 110;
        position = { x, y: below ? rect.bottom + 10 : rect.top - 10, below };
    }

    function hide() {
        range = null;
        position = null;
    }

    function handleSelectionChange() {
        clearTimeout(selectionTimer);
        // wait for the selection to settle (dragging fires this continuously)
        selectionTimer = setTimeout(readSelection, 180);
    }

    async function copy(kind: "quote" | "link") {
        const link = quoteUrl(getArticlePath(title), text);
        const value = kind === "link" ? link : `“${text}”\n— ${title}, Wikipedia (via Lemma)\n${link}`;
        try {
            await navigator.clipboard.writeText(value);
            copied = kind;
            clearTimeout(copiedTimer);
            copiedTimer = setTimeout(hide, 1100);
        } catch {
            copied = null;
        }
    }

    $effect(() => () => {
        clearTimeout(selectionTimer);
        clearTimeout(copiedTimer);
    });
</script>

<svelte:document onselectionchange={handleSelectionChange} />
<svelte:window onscroll={() => position && place()} onresize={() => position && place()} />

{#if position}
    <div
        class="quote-toolbar"
        class:below={position.below}
        bind:this={toolbar}
        style:left="{position.x}px"
        style:top="{position.y}px"
        role="toolbar"
        aria-label="Share the selected text"
        transition:pop={{ start: 0.92 }}
    >
        <button type="button" onmousedown={(event) => event.preventDefault()} onclick={() => copy("quote")}>
            <Icon name={copied === "quote" ? "check" : "quote"} size="0.9em" />
            {copied === "quote" ? "Copied" : "Copy quote"}
        </button>
        <span class="divider" aria-hidden="true"></span>
        <button type="button" onmousedown={(event) => event.preventDefault()} onclick={() => copy("link")}>
            <Icon name={copied === "link" ? "check" : "link"} size="0.9em" />
            {copied === "link" ? "Copied" : "Copy link"}
        </button>
    </div>
{/if}

<p class="sr-only" role="status">{copied ? (copied === "quote" ? "Quote copied" : "Link to the quote copied") : ""}</p>

<style>
    .quote-toolbar {
        position: fixed;
        z-index: 26;
        display: flex;
        align-items: center;
        padding: 0.2rem;
        border-radius: 10px;
        background: var(--text-color);
        box-shadow: 0 12px 28px -10px var(--shadow-color);
        translate: -50% -100%;
        transform-origin: 50% 100%;
        color: var(--bg-color);

        &.below {
            translate: -50% 0;
            transform-origin: 50% 0;
        }
    }

    button {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        height: 1.9rem;
        padding: 0 0.65rem;
        border: none;
        border-radius: 7px;
        background: none;
        font: inherit;
        font-size: 0.78rem;
        font-weight: 600;
        white-space: nowrap;
        color: inherit;
        cursor: pointer;
        transition:
            background-color var(--dur-base) var(--ease-out),
            scale var(--dur-instant) var(--ease-out);

        &:hover {
            background: color-mix(in oklch, var(--bg-color) 16%, transparent);
        }
    }

    .divider {
        width: 1px;
        height: 1rem;
        background: color-mix(in oklch, var(--bg-color) 25%, transparent);
        transition: opacity var(--dur-base) var(--ease-out);
    }

    /* a hovered button's highlight would butt against it */
    .quote-toolbar:has(button:hover) .divider {
        opacity: 0;
    }

    @media print {
        .quote-toolbar {
            display: none;
        }
    }
</style>
