<script lang="ts">
    import { page } from "$app/state";
    import { openSearch } from "$lib/search/searchOverlay.svelte";
    import { getArticlePath, safeDecodeURIComponent } from "$lib/article/articleUtils";
    import { trail } from "$lib/trail.svelte";
    import ReaderSettings from "./ReaderSettings.svelte";
    import Icon from "./icons/Icon.svelte";
    import Logo from "./icons/Logo.svelte";
    import SearchIcon from "./icons/SearchIcon.svelte";

    const wordmark = [..."Lemma"];

    // On an article: the few read just before it this session (the thread is recorded by ArticleView).
    const TRAIL_SHOWN = 3;
    // only once this article has been recorded (while it loads, the thread still ends at the previous one)
    let onArticle = $derived(
        page.route.id === "/wiki/[title]" &&
            !!trail.titles.length &&
            safeDecodeURIComponent(page.url.pathname) === safeDecodeURIComponent(getArticlePath(trail.titles.at(-1)!)),
    );
    let thread = $derived(onArticle ? trail.titles.slice(0, -1).slice(-TRAIL_SHOWN) : []);
    let current = $derived(trail.titles.at(-1) ?? "");
    let threadCut = $derived(onArticle && trail.titles.length - 1 > TRAIL_SHOWN);
</script>

<header id="navbar">
    <a id="header" href="/" aria-label="Lemma home">
        <Logo />
        <span class="wordmark" aria-hidden="true">
            {#each wordmark as char, i}
                <span class="char" style:--i={i}>{char}</span>
            {/each}
        </span>
    </a>

    {#if thread.length > 0}
        <nav class="thread" aria-label="Articles you've just read">
            {#if threadCut}<span class="thread-more" aria-hidden="true">…</span>{/if}
            {#each thread as previous, i (previous)}
                <a href={getArticlePath(previous)} style:--i={i}>{previous}</a>
                <span class="thread-arrow" style:--i={i} aria-hidden="true"><Icon name="arrow-right" size="0.8em" /></span>
            {/each}
            {#key current}
                <span class="thread-current" aria-current="page" style:--i={thread.length}>{current}</span>
            {/key}
        </nav>
    {/if}

    <nav aria-label="Primary">
        {#if page.route.id !== "/"}
            <button type="button" class="search-button" onclick={() => openSearch()} aria-keyshortcuts="Control+K Meta+K /">
                <SearchIcon size={20} />
                <span>Search</span>
                <kbd aria-hidden="true">/</kbd>
            </button>
        {/if}
        <ReaderSettings />
        <a
            class="library-link"
            href="/library"
            aria-label="Your library"
            title="Your library"
            aria-current={page.route.id === "/library" ? "page" : undefined}
        >
            <Icon name="bookmark" size="18px" />
        </a>
    </nav>
</header>

<style>
    #navbar {
        position: fixed;
        inset: 0 0 auto;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: var(--nav-height);
        /* symmetric insets: the logo and the search button each sit 8px from their edge (and from top and bottom) */
        --inset: 8px;
        padding: 0 max(var(--inset), env(safe-area-inset-right)) 0 max(var(--inset), env(safe-area-inset-left));
        box-sizing: border-box;
        user-select: none;
        background: color-mix(in oklch, var(--page-bg) 80%, transparent);
        border-bottom: 1px solid color-mix(in oklch, var(--secondary) 70%, transparent);
        backdrop-filter: blur(6px);
    }

    #header {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 100%;
        color: inherit;
        text-decoration: none;

        :global(.logo) {
            flex: none;
        }
    }

    .wordmark {
        display: flex;
        white-space: nowrap;
        font-family: default-serif;
        font-size: 1.65rem;
        line-height: 1;
        font-weight: 300;

        .char {
            display: inline-block;
        }
    }

    #header:hover .char {
        animation: font-weight-wave 0.8s ease-in-out;
        animation-delay: calc(0.5s + var(--i) * 0.04s);
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    nav {
        display: flex;
        align-items: center;
        gap: 4px;

        button {
            font-size: 0.85rem;
        }
    }

    /* the thread of articles read just before this one, faint and fading further the older they are */
    .thread {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 0.4rem;
        min-width: 0;
        margin: 0 1.5rem;
        overflow: hidden;
        font-size: 0.8rem;
        color: var(--muted);
        white-space: nowrap;
        mask-image: linear-gradient(to left, transparent, black 1.5rem);

        a {
            min-width: 0;
            max-width: 13rem;
            overflow: hidden;
            text-overflow: ellipsis;
            color: inherit;
            text-decoration: none;
            opacity: calc(0.6 + var(--i) * 0.15);
            transition:
                color var(--dur-base) var(--ease-out),
                opacity var(--dur-base) var(--ease-out);

            &:hover {
                color: var(--text-color);
                opacity: 1;
            }
        }

        a,
        .thread-arrow {
            flex: none;
            animation: fade-in var(--dur-base) var(--ease-out) backwards;
            animation-delay: calc(var(--i) * 25ms);
        }

        a {
            flex: 0 1 auto;
        }

        .thread-arrow {
            display: inline-flex;
            opacity: 0.6;
        }

        @media (max-width: 900px) {
            display: none;
        }
    }

    /* where the reader is now: the end of the thread, a touch stronger than the way there */
    .thread-current {
        flex: 0 1 auto;
        min-width: 0;
        max-width: 16rem;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 550;
        color: var(--text-color);
        animation: fade-in var(--dur-base) var(--ease-out) backwards;
        animation-delay: calc(var(--i) * 25ms);
    }

    .thread-more {
        opacity: 0.5;
    }

    .library-link {
        display: grid;
        place-items: center;
        box-sizing: border-box;
        width: 36px;
        height: 36px;
        border: 1px solid transparent;
        border-radius: 8px;
        color: var(--muted);
        transition:
            color var(--dur-base) var(--ease-out),
            border-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &:hover,
        &[aria-current="page"] {
            color: var(--text-color);
            border-color: var(--secondary);
        }

        &:active {
            scale: 0.94;
        }
    }

    /* the same 36px box as the logo, so both ends of the bar mirror each other */
    .search-button {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        box-sizing: border-box;
        height: 36px;
        padding: 0 0.5rem 0 0.4rem;
        background: none;
        border: 1px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        color: var(--muted);
        transition:
            color var(--dur-base) var(--ease-out),
            border-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &:hover {
            color: var(--text-color);
            border-color: var(--secondary);
        }

        @media (max-width: 600px) {
            kbd {
                display: none;
            }
        }
    }
</style>
