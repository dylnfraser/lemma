<script lang="ts">
    import { tick } from "svelte";
    import { scale } from "svelte/transition";
    import type { ArticleLanguage } from "$lib/api/wikipedia";
    import { isKeyboardClick } from "$lib/focus";
    import { DURATION, cubicOut, motion } from "$lib/motion";
    import Icon from "../icons/Icon.svelte";

    // "Read in another language": the same article on other Wikipedias. Lemma reads English Wikipedia, so these open
    // the other edition in a new tab.
    let { languages }: { languages: ArticleLanguage[] } = $props();

    const uid = $props.id();
    let open = $state(false);
    let filter = $state("");
    let root = $state<HTMLElement>();
    let input = $state<HTMLInputElement>();

    let shown = $derived.by(() => {
        const query = filter.trim().toLocaleLowerCase();
        const sorted = languages.toSorted((a, b) => a.name.localeCompare(b.name));
        if (!query) return sorted;
        return sorted.filter((language) =>
            [language.name, language.autonym, language.code].some((value) => value.toLocaleLowerCase().includes(query)),
        );
    });

    async function toggle(event: MouseEvent) {
        open = !open;
        filter = "";
        if (open && isKeyboardClick(event)) {
            await tick();
            input?.focus();
        }
    }

    function handleWindowPointerDown(event: PointerEvent) {
        if (open && root && !root.contains(event.target as Node)) open = false;
    }

    function handleKeydown(event: KeyboardEvent) {
        if (open && event.key === "Escape") {
            open = false;
            root?.querySelector<HTMLButtonElement>(".toggle")?.focus();
        }
    }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleKeydown} />

<span class="languages" bind:this={root}>
    <button
        type="button"
        class="toggle"
        aria-expanded={open}
        aria-controls="{uid}-panel"
        onmousedown={(event) => event.preventDefault()}
        onclick={toggle}
    >
        {languages.length} languages
    </button>

    {#if open}
        <div
            class="panel"
            id="{uid}-panel"
            role="dialog"
            aria-label="Read in another language"
            transition:scale={{ start: 0.97, opacity: 0, duration: motion(DURATION.fast), easing: cubicOut }}
        >
            <input
                bind:this={input}
                bind:value={filter}
                type="search"
                placeholder="Find a language"
                aria-label="Find a language"
                autocomplete="off"
                spellcheck="false"
            />
            <ul>
                {#each shown as language (language.code)}
                    <li>
                        <a href={language.url} target="_blank" rel="noopener noreferrer" lang={language.code} hreflang={language.code}>
                            <span class="autonym">{language.autonym}</span>
                            {#if language.name !== language.autonym}<span class="name">{language.name}</span>{/if}
                            <Icon name="arrow-up-right" size="0.75em" />
                        </a>
                    </li>
                {:else}
                    <li class="empty">No language matches “{filter}”</li>
                {/each}
            </ul>
        </div>
    {/if}
</span>

<style>
    .languages {
        position: relative;
    }

    .toggle {
        padding: 0;
        border: none;
        background: none;
        font: inherit;
        color: inherit;
        cursor: pointer;

        &:hover {
            color: var(--link-hover);
        }
    }

    .panel {
        position: absolute;
        z-index: 15;
        top: calc(100% + 0.5rem);
        left: 50%;
        translate: -50% 0;
        width: min(18rem, 80vw);
        padding: 0.5rem;
        border: 1px solid var(--rule);
        border-radius: 12px;
        background: var(--bg-color);
        box-shadow: 0 18px 40px -18px var(--shadow-color);
        transform-origin: 50% 0;
        font-style: normal;
        letter-spacing: normal;
        color: var(--text-color);
    }

    input {
        box-sizing: border-box;
        width: 100%;
        margin-bottom: 0.35rem;
        padding: 0.45rem 0.6rem;
        border: 1px solid var(--rule);
        border-radius: 8px;
        background: var(--page-bg);
        font: inherit;
        font-size: 0.85rem;
        color: inherit;

        &:focus-visible {
            outline: none;
            border-color: color-mix(in oklch, var(--accent) 45%, var(--rule));
        }

        &::-webkit-search-cancel-button {
            display: none;
        }
    }

    ul {
        max-height: min(18rem, 50dvh);
        margin: 0;
        padding: 0;
        overflow-y: auto;
        list-style: none;
        overscroll-behavior: contain;
    }

    a {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        padding: 0.35rem 0.5rem;
        border-radius: 7px;
        font-size: 0.85rem;
        color: inherit;
        text-decoration: none;

        &:hover,
        &:focus-visible {
            background: color-mix(in oklch, var(--secondary) 38%, transparent);
            color: inherit;
        }

        :global(.icon) {
            margin-left: auto;
            opacity: 0.5;
        }
    }

    .autonym {
        font-weight: 550;
    }

    .name {
        font-size: 0.75rem;
        color: var(--muted);
    }

    .empty {
        padding: 0.5rem;
        font-size: 0.8rem;
        color: var(--muted);
    }
</style>
