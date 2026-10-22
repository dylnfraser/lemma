<script lang="ts">
    import { fetchFile, type FileDetails } from "$lib/api/pages";
    import { WikipediaError } from "$lib/api/wikipedia";
    import { getArticlePath } from "$lib/article/articleUtils";
    import ErrorState from "../../../components/ErrorState.svelte";
    import ReaderLayout from "../../../components/ReaderLayout.svelte";
    import Icon from "../../../components/icons/Icon.svelte";

    let { data } = $props();

    let status = $state<"loading" | "ready" | "error">("loading");
    let error = $state<unknown>(null);
    let file = $state.raw<FileDetails | null>(null);
    let attempt = $state(0);
    let loaded = $state(false);

    $effect(() => {
        const name = data.name;
        void attempt;
        const controller = new AbortController();
        status = "loading";
        loaded = false;
        fetchFile(name, { signal: controller.signal }).then(
            (details) => {
                file = details;
                status = "ready";
            },
            (reason) => {
                if (controller.signal.aborted) return;
                error = reason;
                status = "error";
            },
        );
        return () => controller.abort();
    });

    let title = $derived(data.name.replace(/\.[a-z0-9]+$/i, ""));
    let isImage = $derived(file ? /^image\//.test(file.mime) : true);
</script>

<svelte:head>
    <title>{title} — File • Lemma</title>
</svelte:head>

<ReaderLayout>
    <header class="page-header">
        <p class="kicker"><Icon name="image" size="1.05em" /> File</p>
        <h1>{title}</h1>
    </header>

    {#if status === "error"}
        <div class="error">
            {#if error instanceof WikipediaError && error.kind === "not_found"}
                <ErrorState heading="No such file" message={`Wikipedia and Wikimedia Commons don't have a file called “${data.name}”.`} />
            {:else}
                <ErrorState
                    heading="Something went sideways"
                    message={`We couldn't load “${data.name}” from Wikipedia. It's probably a blip, and trying again usually sorts it out.`}
                    retryLabel="Give it another go"
                    onRetry={() => attempt++}
                />
            {/if}
        </div>
    {:else if status === "loading" || !file}
        <div class="picture skeleton" role="status" aria-label="Loading the file"></div>
    {:else}
        <figure class="picture" class:loaded style:--ar={file.width && file.height ? file.width / file.height : undefined}>
            {#if isImage}
                <a href={file.originalUrl} target="_blank" rel="noopener noreferrer" aria-label="Open the original file">
                    <img src={file.src} alt={title} width={file.width} height={file.height} onload={() => (loaded = true)} />
                </a>
            {:else}
                <a class="download with-icon" href={file.originalUrl} target="_blank" rel="noopener noreferrer">
                    Open the file ({file.mime || "unknown type"})<Icon name="arrow-up-right" size="0.85em" />
                </a>
            {/if}
        </figure>

        {#if file.description}
            <div class="description">{@html file.description}</div>
        {/if}

        <dl class="facts">
            {#if file.author}
                <div><dt>Author</dt><dd>{@html file.author}</dd></div>
            {/if}
            {#if file.date}
                <div><dt>Date</dt><dd>{file.date}</dd></div>
            {/if}
            {#if file.license}
                <div>
                    <dt>Licence</dt>
                    <dd>
                        {#if file.licenseUrl}
                            <a href={file.licenseUrl} target="_blank" rel="license noopener noreferrer">{file.license}</a>
                        {:else}{file.license}{/if}
                    </dd>
                </div>
            {/if}
            {#if file.credit}
                <div><dt>Source</dt><dd class="credit">{@html file.credit}</dd></div>
            {/if}
        </dl>

        <p class="links">
            <a class="with-icon" href={file.originalUrl} target="_blank" rel="noopener noreferrer">Original file<Icon name="arrow-up-right" size="0.85em" /></a>
            <a class="with-icon" href={file.sourcePage} target="_blank" rel="noopener noreferrer"
                >{file.sourcePage.includes("commons.wikimedia.org") ? "Wikimedia Commons" : "Wikipedia"}<Icon
                    name="arrow-up-right"
                    size="0.85em"
                /></a
            >
        </p>

        {#if file.usedIn.length > 0}
            <h2>Used in</h2>
            <ul class="used-in">
                {#each file.usedIn as article}
                    <li><a href={getArticlePath(article)}>{article}</a></li>
                {/each}
            </ul>
        {/if}
    {/if}
</ReaderLayout>

<style>
    .page-header {
        margin: 1.5rem 0 1.5rem;
    }

    .kicker {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin: 0 0 0.5rem;
        font-size: 0.72rem;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
    }

    h1 {
        margin: 0;
        font-size: clamp(1.7rem, 1.4rem + 1.4vw, 2.3rem);
        font-weight: 600;
        line-height: 1.15;
        overflow-wrap: anywhere;
        text-wrap: balance;
    }

    .picture {
        display: grid;
        place-items: center;
        margin: 0 0 1.5rem;
        aspect-ratio: var(--ar, 1.5);
        max-height: 75vh;
        border-radius: 12px;
        overflow: hidden;
        background: color-mix(in oklch, var(--secondary) 35%, var(--bg-color));

        a {
            display: contents;
        }

        img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            opacity: 0;
            transition: opacity var(--dur-slow) var(--ease-out);
            cursor: zoom-in;
        }

        &.loaded img {
            opacity: 1;
        }

        .download {
            font-weight: 600;
        }

        &.skeleton {
            animation: pulse 1.4s ease-in-out infinite;

            @media (prefers-reduced-motion: reduce) {
                animation: none;
            }
        }
    }


    .description {
        font-size: 1.05rem;
        line-height: var(--leading);
        text-wrap: pretty;

        :global(p) {
            margin: 0 0 0.8em;
        }
    }

    .facts {
        display: grid;
        gap: 0;
        margin: 1.25rem 0;
        border-top: 1px solid var(--rule);

        div {
            display: grid;
            grid-template-columns: 7rem 1fr;
            gap: 1rem;
            padding: 0.55rem 0;
            border-bottom: 1px solid var(--rule);
            font-size: 0.9rem;
            line-height: 1.5;
        }

        dt {
            font-weight: 600;
            color: var(--muted);
        }

        dd {
            margin: 0;
            min-width: 0;
            overflow-wrap: anywhere;
        }
    }

    .links {
        display: flex;
        gap: 1.25rem;
        font-size: 0.85rem;

        a {
            color: var(--muted);
            text-decoration: none;

            &:hover {
                color: var(--link-hover);
            }
        }
    }

    h2 {
        margin: 2rem 0 0.75rem;
        padding: 0;
        border: none;
        font-family: default-sans;
        font-size: 0.72rem;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
    }

    .used-in {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin: 0;
        padding: 0;
        list-style: none;

        a {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border: 1px solid var(--rule);
            border-radius: 999px;
            font-size: 0.82rem;
            color: inherit;
            text-decoration: none;
            transition: border-color var(--dur-fast);

            &:hover {
                border-color: var(--secondary);
                color: var(--link-hover);
            }
        }
    }

    .error {
        padding-top: 8vh;
    }
</style>
