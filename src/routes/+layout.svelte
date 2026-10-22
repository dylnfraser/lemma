<script lang="ts">
    import "../app.css";
    import { onNavigate } from "$app/navigation";
    import { page } from "$app/state";
    import { prefersReducedMotion } from "svelte/motion";
    import Navbar from "../components/Navbar.svelte";
    import PageScrollbar from "../components/PageScrollbar.svelte";
    import ShortcutsSheet from "../components/ShortcutsSheet.svelte";
    import GlobalSearch from "../components/search/GlobalSearch.svelte";

    let { children } = $props();

    let canonicalUrl = $derived(`${page.url.origin}${page.url.pathname}`);

    /*
     * Page changes are view transitions: the page cross-fades through a blur, and a followed link (or a card's title)
     * glides and grows into the new article's heading. The clicked element is tagged on click; the new page's title
     * (.morph-title, in the article or its loading skeleton) carries the same name, so the browser morphs one into the
     * other.
     */
    const MORPH = "article-title";
    let morphSource: HTMLElement | null = null;

    function handleClickCapture(event: MouseEvent) {
        morphSource?.style.removeProperty("view-transition-name");
        morphSource = null;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = (event.target as Element).closest?.<HTMLAnchorElement>("a[href]");
        if (!link || link.target || !link.pathname.startsWith("/wiki/") || link.origin !== location.origin) return;
        if (link.pathname === location.pathname) return; // a jump within the same article
        morphSource = link.querySelector<HTMLElement>("[data-morph]") ?? link;
    }

    onNavigate((navigation) => {
        if (!document.startViewTransition || prefersReducedMotion.current) return;
        const source = navigation.type === "link" ? morphSource : null;
        morphSource = null;
        // the page being left mustn't have two elements with the morph's name
        if (source) {
            document.documentElement.classList.add("morphing");
            source.style.setProperty("view-transition-name", MORPH);
        }
        return new Promise((resolve) => {
            const transition = document.startViewTransition(async () => {
                source?.style.removeProperty("view-transition-name");
                document.documentElement.classList.remove("morphing");
                resolve();
                await navigation.complete;
            });
            transition.finished.finally(() => document.documentElement.classList.remove("morphing"));
        });
    });
</script>

<svelte:head>
    <link rel="canonical" href={canonicalUrl} />
    <meta property="og:url" content={canonicalUrl} />
</svelte:head>

<svelte:document onclickcapture={handleClickCapture} />

<a class="skip-link" href="#main">Skip to content</a>
<Navbar />
<PageScrollbar />
<ShortcutsSheet />
{#if page.route.id !== "/"}
    <!-- The landing page has its own search box, so the overlay would only duplicate it. -->
    <GlobalSearch />
{/if}

{@render children()}
