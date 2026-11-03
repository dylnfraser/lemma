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
            Lemma is a Wikipedia reader. It shows you the article and leaves out most of everything else: no edit links,
            banners or sidebars, just the text, its pictures and its sources, set in type that’s comfortable to read for a
            while.
        </p>

        <section>
            <h2>Why it exists</h2>
            <p>
                Wikipedia is wonderful, but its pages are busy, and a lot of what’s on them is there for editors rather
                than readers. Lemma is for the reading side: looking something up quickly, or settling in with a long
                article and following wherever the links take you.
            </p>
        </section>

        <section>
            <h2>How it works</h2>
            <p>
                Your browser fetches each article straight from Wikipedia: there’s no Lemma server fetching them for you,
                no account and no tracking. The articles you save, your history and your settings stay in this browser.
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
