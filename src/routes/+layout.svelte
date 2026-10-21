<script lang="ts">
    import "../app.css";
    import { page } from "$app/state";
    import Navbar from "../components/Navbar.svelte";
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
{#if page.route.id !== "/"}
    <!-- The landing page has its own search box, so the overlay would only duplicate it. -->
    <GlobalSearch />
{/if}

{@render children()}
