<script lang="ts">
    import { afterNavigate } from "$app/navigation";
    import { fade } from "svelte/transition";
    import { escapeCloses } from "$lib/layers";
    import { DURATION, motion, pop } from "$lib/motion";
    import { closeSearch, isSearchShortcut, searchOverlay, toggleSearch } from "$lib/search/searchOverlay.svelte";
    import Searchbar from "./Searchbar.svelte";

    let navigatedWhileOpen = false;

    function handleWindowKeydown(event: KeyboardEvent) {
        if (isSearchShortcut(event)) {
            event.preventDefault();
            if (event.key === "/" && searchOverlay.open) return;
            toggleSearch();
        }
    }

    $effect(() => {
        if (searchOverlay.open) return escapeCloses(closeSearch);
    });

    // A modal dialog: Tab cycles through the search and its results rather than wandering into the page behind.
    // (The field's own Tab, taking a suggestion's completion, comes first and claims the press.)
    function handleDialogKeydown(event: KeyboardEvent) {
        if (event.key !== "Tab" || event.defaultPrevented) return;
        const focusable = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("input, button, a[href]")].filter(
            (element) => !element.matches(":disabled") && element.tabIndex >= 0 && element.getClientRects().length > 0,
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus();
        }
    }

    function handleBackdropClick(event: MouseEvent) {
        if (event.target === event.currentTarget) closeSearch();
    }

    // Return focus to whatever opened the overlay, unless the reader navigated away with it.
    $effect.pre(() => {
        if (!searchOverlay.open) return;

        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        navigatedWhileOpen = false;

        return () => {
            if (!navigatedWhileOpen) requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
        };
    });

    afterNavigate(() => {
        navigatedWhileOpen = true;
        closeSearch();
    });
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if searchOverlay.open}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape closes the dialog) -->
    <div
        class="overlay"
        onclick={handleBackdropClick}
        transition:fade={{ duration: motion(DURATION.base) }}
    >
        <div
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search Wikipedia"
            tabindex="-1"
            onkeydown={handleDialogKeydown}
            transition:pop|global={{ duration: DURATION.base, y: -6 }}
        >
            <Searchbar autofocus initialQuery={searchOverlay.query} onDismiss={closeSearch} />
        </div>
    </div>
{/if}

<style>
    .overlay {
        z-index: 30;
        position: fixed;
        inset: 0;
        padding: min(22vh, 11rem) 1rem 0;

        background: color-mix(in oklch, var(--page-bg) 25%, transparent);
        backdrop-filter: blur(4px);
    }

    .dialog {
        width: min(55ch, 100%);
        margin-inline: auto;
    }
</style>
