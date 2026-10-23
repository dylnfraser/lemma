<script lang="ts">
    import "../app.css";
    import { navigating, page } from "$app/state";
    import Navbar from "../components/Navbar.svelte";
    import PageScrollbar from "../components/PageScrollbar.svelte";
    import ShortcutsSheet from "../components/ShortcutsSheet.svelte";
    import GlobalSearch from "../components/search/GlobalSearch.svelte";

    let { children } = $props();

    let canonicalUrl = $derived(`${page.url.origin}${page.url.pathname}`);
</script>

<svelte:head>
    <link rel="canonical" href={canonicalUrl} />
    <meta property="og:url" content={canonicalUrl} />
</svelte:head>

<a class="skip-link" href="#main">Skip to content</a>
<Navbar />
{#if navigating.to}
    <!-- while the next page loads (the current one stays up meanwhile): a hairline creeping across under the navbar -->
    <div class="navigation-progress" aria-hidden="true"></div>
{/if}
<PageScrollbar />
<ShortcutsSheet />
{#if page.route.id !== "/"}
    <!-- The landing page has its own search box, so the overlay would only duplicate it. -->
    <GlobalSearch />
{/if}

{@render children()}

<style>
    .navigation-progress {
        position: fixed;
        z-index: 22;
        top: calc(var(--nav-height) - 1px);
        left: 0;
        right: 0;
        height: 2px;
        background: var(--accent);
        transform-origin: 0 50%;
        /* held back a moment, so quick navigations don't flicker it */
        animation:
            navigation-progress 2.5s cubic-bezier(0.1, 0.7, 0.2, 1) 120ms both,
            fade-in var(--dur-base) var(--ease-out) 120ms both;
    }

    @keyframes navigation-progress {
        from {
            transform: scaleX(0);
        }

        to {
            transform: scaleX(0.9);
        }
    }
</style>
