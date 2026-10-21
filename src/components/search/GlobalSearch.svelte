<script lang="ts">
    import { afterNavigate } from "$app/navigation";
    import { fade, scale } from "svelte/transition";
    import { DURATION, cubicOut, motion } from "$lib/motion";
    import { closeSearch, isSearchShortcut, searchOverlay, toggleSearch } from "$lib/search/searchOverlay.svelte";
    import Searchbar from "./Searchbar.svelte";

    let navigatedWhileOpen = false;

    function handleWindowKeydown(event: KeyboardEvent) {
        if (isSearchShortcut(event)) {
            event.preventDefault();
            if (event.key === "/" && searchOverlay.open) return;
            toggleSearch();
        } else if (event.key === "Escape" && searchOverlay.open) {
            closeSearch();
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
        transition:fade={{ duration: motion(DURATION.fast) }}
    >
        <div
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search Wikipedia"
            transition:scale|global={{ start: 0.97, opacity: 0, duration: motion(DURATION.base), easing: cubicOut }}
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
        padding: min(28vh, 14rem) 1rem 0;

        background: color-mix(in oklch, var(--page-bg) 25%, transparent);
        backdrop-filter: blur(4px);
    }

    .dialog {
        width: min(55ch, 100%);
        margin-inline: auto;
    }
</style>
