<script lang="ts">
    import ReaderLayout from "../../components/ReaderLayout.svelte";
</script>

<svelte:head>
    <title>About • Lemma</title>
</svelte:head>

<ReaderLayout>
    <h1 id="title">About Lemma</h1>
    <p class="article-meta">Why was Lemma made?</p>
    <hr />

    <p style:--i={0}>
        Lemma is a private, fast Wikipedia reader built for calm, focused browsing. It strips away visual clutter and
        presents articles in a clean custom layout with strong typography and lightweight navigation.
    </p>

    <h2 style:--i={1}>Why it exists</h2>
    <p style:--i={1}>
        Lemma is designed for quick lookups, deeper reading, and browsing Wikipedia without the usual noise. It’s meant
        to feel private, fast, and pleasant enough that reading becomes the default.
    </p>

    <h3 style:--i={2}>What does it do?</h3>
    <p style:--i={2}>
        Lemma fetches Wikipedia articles directly from public endpoints, extracts readable content, and renders it in a
        distraction-free reader. It includes article stats, images, headings, links, and section navigation for longer
        pages.
    </p>

    <h3 style:--i={3}>Built for reading</h3>
    <p style:--i={3}>
        The interface uses a soft neutral background, local fonts, subtle shadows, and a centered reading width to keep
        the experience quiet and easy on the eyes. The goal is simple: make exploring knowledge feel effortless.
    </p>

    <h2 style:--i={4}>The Stack</h2>
    <p style:--i={4}>
        Lemma is built with SvelteKit, Svelte 5, Vite, TypeScript, and Bun. It uses client-side Wikipedia requests, so
        there’s no API key, backend proxy, or server-side cache.
    </p>
    <p style:--i={4}>
        The app is organized around reusable UI components and route-based pages for the landing screen, search, errors,
        and article readers.
    </p>
</ReaderLayout>

<style>
    #title {
        margin: 1.25rem 0 0;
        line-height: 1.2;
    }

    .article-meta {
        margin: 0.75rem 0 0;
        font-size: 0.85rem;
        font-style: italic;
        font-weight: 450;
    }

    hr {
        width: 100%;
        margin: 1rem 0 0.5rem;
    }

    h2,
    h3,
    p:not(.article-meta) {
        animation: text-appear 0.4s ease-out both;
        animation-delay: calc(var(--i) * 0.1s);
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    h3 {
        font-size: 1.15rem;
        margin-top: 1.75rem;
    }
</style>
