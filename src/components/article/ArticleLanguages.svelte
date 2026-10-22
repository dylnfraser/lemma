<script lang="ts">
    import { tick } from "svelte";
    import type { ArticleLanguage } from "$lib/api/wikipedia";
    import { isKeyboardClick } from "$lib/focus";
    import { DURATION, pop } from "$lib/motion";
    import Icon from "../icons/Icon.svelte";
    import SearchIcon from "../icons/SearchIcon.svelte";

    // "Read in another language": the same article on other Wikipedias. Lemma reads English Wikipedia, so these open
    // the other edition in a new tab.
    let { languages }: { languages: ArticleLanguage[] } = $props();

    const uid = $props.id();
    let open = $state(false);
    let filter = $state("");
    let root = $state<HTMLElement>();
    let input = $state<HTMLInputElement>();
    let list = $state<HTMLElement>();

    const sorted = $derived(languages.toSorted((a, b) => a.name.localeCompare(b.name)));
    let shown = $derived.by(() => {
        const query = filter.trim().toLocaleLowerCase();
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

    function close() {
        open = false;
        root?.querySelector<HTMLButtonElement>(".toggle")?.focus();
    }

    function handleWindowPointerDown(event: PointerEvent) {
        if (open && root && !root.contains(event.target as Node)) open = false;
    }

    function handleWindowKeydown(event: KeyboardEvent) {
        if (open && event.key === "Escape") close();
    }

    // Up and down move between the filter and the languages, like a menu.
    function handlePanelKeydown(event: KeyboardEvent) {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        const links = [...(list?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];
        const stops: HTMLElement[] = [input!, ...links].filter(Boolean);
        const index = stops.indexOf(document.activeElement as HTMLElement);
        const next = stops[Math.min(Math.max(index + (event.key === "ArrowDown" ? 1 : -1), 0), stops.length - 1)];
        if (!next) return;
        event.preventDefault();
        next.focus();
        next.scrollIntoView({ block: "nearest" });
    }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeydown} />

<span class="languages" bind:this={root}>
    <button
        type="button"
        class="toggle action-pill"
        aria-expanded={open}
        aria-controls="{uid}-panel"
        onmousedown={(event) => event.preventDefault()}
        onclick={toggle}
    >
        <Icon name="globe" size="0.9em" />
        {languages.length} languages
    </button>

    {#if open}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions (arrow keys move between the field and the links inside) -->
        <div
            class="panel"
            id="{uid}-panel"
            role="dialog"
            aria-label="Read in another language"
            tabindex="-1"
            onkeydown={handlePanelKeydown}
            transition:pop={{ y: -4, duration: DURATION.base }}
        >
            <label class="field">
                <SearchIcon size={16} />
                <input
                    bind:this={input}
                    bind:value={filter}
                    type="search"
                    placeholder="Find a language"
                    aria-label="Find a language"
                    autocomplete="off"
                    spellcheck="false"
                />
                <!-- on phones the sheet covers its pill, so it closes from here -->
                <button type="button" class="close" aria-label="Close" onclick={close}><Icon name="x" size="0.85em" /></button>
            </label>

            <ul bind:this={list}>
                {#each shown as language, i (language.code)}
                    <li style:--i={Math.min(i, 10)}>
                        <a href={language.url} target="_blank" rel="noopener noreferrer" lang={language.code} hreflang={language.code}>
                            <span class="autonym">{language.autonym}</span>
                            {#if language.name !== language.autonym}<span class="name">{language.name}</span>{/if}
                        </a>
                    </li>
                {:else}
                    <li class="empty">No language matches “{filter}”</li>
                {/each}
            </ul>

            <p class="note"><Icon name="arrow-up-right" size="0.9em" />Opens Wikipedia in that language</p>
        </div>
    {/if}
</span>

<style>
    .languages {
        position: relative;
    }

    /* grows out of the pill it belongs to */
    .panel {
        position: absolute;
        z-index: 15;
        top: calc(100% + 0.5rem);
        left: 0;
        display: flex;
        flex-direction: column;
        width: min(19rem, calc(100vw - 2.5rem));
        overflow: hidden;
        border: 1px solid var(--rule);
        border-radius: 14px;
        background: var(--bg-color);
        box-shadow: 0 18px 40px -18px var(--shadow-color);
        transform-origin: 1.5rem 0;
        font-style: normal;
        letter-spacing: normal;
        color: var(--text-color);

        /* on phones the pill may sit near the right edge: the panel becomes a sheet under the navbar instead (at the
           top, so the on-screen keyboard can't cover its field) */
        @media (max-width: 600px) {
            position: fixed;
            /* above the floating Sections button */
            z-index: 35;
            top: calc(var(--nav-height) + 0.75rem);
            left: max(1.25rem, env(safe-area-inset-left));
            right: max(1.25rem, env(safe-area-inset-right));
            width: auto;
            max-height: min(34rem, calc(100dvh - var(--nav-height) - 6rem));
            transform-origin: 50% 0;

            ul {
                max-height: none;
                flex: 1;
            }
        }
    }

    .field {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0 0.85rem;
        height: 2.75rem;
        border-bottom: 1px solid var(--rule);
        color: var(--muted);

        input {
            flex: 1;
            min-width: 0;
            padding: 0;
            border: none;
            outline: none;
            background: none;
            font: inherit;
            font-size: 0.88rem;
            color: var(--text-color);

            /* iOS zooms into fields smaller than 16px */
            @media (pointer: coarse) {
                font-size: 16px;
            }

            &::placeholder {
                color: var(--muted);
            }

            &::-webkit-search-cancel-button {
                display: none;
            }
        }
    }

    .close {
        display: none;
        place-items: center;
        flex: none;
        width: 2rem;
        height: 2rem;
        margin-right: -0.4rem;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: none;
        color: var(--muted);
        cursor: pointer;

        @media (max-width: 600px) {
            display: grid;
        }
    }

    ul {
        max-height: min(17rem, 50dvh);
        margin: 0;
        padding: 0.35rem;
        overflow-y: auto;
        list-style: none;
        overscroll-behavior: contain;
        scrollbar-width: thin;
    }

    li {
        animation: enter var(--dur-base) var(--ease-out) backwards;
        animation-delay: calc(var(--i) * 18ms + 60ms);
    }

    a {
        display: flex;
        align-items: baseline;
        gap: 0.75rem;
        padding: 0.4rem 0.6rem;
        border-radius: 8px;
        font-size: 0.88rem;
        color: inherit;
        text-decoration: none;
        outline: none;
        transition:
            background-color var(--dur-base) var(--ease-out),
            color var(--dur-base) var(--ease-out);

        &:hover,
        &:focus-visible {
            background: color-mix(in oklch, var(--secondary) 34%, transparent);
            color: inherit;

            .name {
                color: var(--text-color);
            }
        }
    }

    .autonym {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 550;
    }

    .name {
        flex: none;
        font-size: 0.78rem;
        color: var(--muted);
        transition: color var(--dur-base) var(--ease-out);
    }

    .empty {
        padding: 0.9rem 0.6rem;
        font-size: 0.85rem;
        color: var(--muted);
        animation: fade-in var(--dur-base) var(--ease-out) backwards;
    }

    .note {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin: 0;
        padding: 0.55rem 0.85rem;
        border-top: 1px solid var(--rule);
        font-size: 0.74rem;
        color: var(--muted);
    }
</style>
