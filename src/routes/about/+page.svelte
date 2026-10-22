<script lang="ts">
    import ReaderLayout from "../../components/ReaderLayout.svelte";
</script>

<svelte:head>
    <title>About • Lemma</title>
</svelte:head>

<ReaderLayout>
    <div class="about">
        <header class="about-header">
            <h1 id="title">About Lemma</h1>
        </header>

        <p>
            Lemma is a private, fast Wikipedia reader built for calm, focused browsing. It strips away visual clutter and
            presents articles in a clean custom layout with strong typography and lightweight navigation.
        </p>

        <section>
            <h2>Why it exists</h2>
            <p>
                Lemma is designed for quick lookups, deeper reading, and browsing Wikipedia without the usual noise. It’s
                meant to feel private, fast, and pleasant enough that reading becomes the default.
            </p>
        </section>

        <section>
            <h2>How it works</h2>
            <p>
                Lemma fetches articles straight from Wikipedia’s public endpoints in your browser, with no API key, backend
                proxy, or server-side cache, then renders just the readable content in a distraction-free reader.
            </p>
            <p>It’s built with SvelteKit, Svelte 5, Vite, TypeScript, and Bun.</p>
        </section>
    </div>
</ReaderLayout>

<style>
    /* the same gentle entrance as an article (see ArticleView) */
    .about {
        animation: enter var(--dur-slow) var(--ease-out) backwards;
    }


    .about-header {
        margin: 1.5rem 0 2rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid var(--rule);
    }

    #title {
        margin: 0;
        font-size: clamp(2.1rem, 1.6rem + 2vw, 2.75rem);
        font-weight: 600;
        line-height: 1.1;
        letter-spacing: -0.01em;
    }

    p {
        margin: 0 0 1em;
        text-wrap: pretty;

        &:last-child {
            margin-bottom: 0;
        }
    }

    section {
        margin-top: 2.5rem;
    }

    h2 {
        margin: 0 0 0.75rem;
        font-size: 1.5rem;
        font-weight: 550;
        line-height: 1.2;
    }
</style>
