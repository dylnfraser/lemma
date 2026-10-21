<script lang="ts">
    import ReaderLayout from "../../components/ReaderLayout.svelte";

    const stack = ["SvelteKit", "Svelte 5", "Vite", "TypeScript", "Bun"];

    const pipeline = [
        { name: "Fetch", detail: "Public Wikipedia endpoints" },
        { name: "Extract", detail: "Just the readable content" },
        { name: "Render", detail: "A distraction-free reader" },
    ];
</script>

<svelte:head>
    <title>About • Lemma</title>
</svelte:head>

<ReaderLayout>
    <header class="about-header">
        <div>
            <h1 id="title">About Lemma</h1>
            <p class="description">Why was Lemma made?</p>
        </div>

        <!-- a tiny sketch of the reader: title, standfirst and body text -->
        <svg class="header-art" viewBox="0 0 96 112" fill="none" aria-hidden="true" focusable="false">
            <rect class="sheet" x="1" y="1" width="94" height="110" rx="12" />
            <rect class="accent" x="14" y="16" width="44" height="7" rx="3.5" />
            <rect class="line" x="14" y="30" width="30" height="4" rx="2" />
            <path class="rule" d="M14 42H82" />
            {#each [52, 60, 68, 76, 84] as y, i}
                <rect class="line" x="14" {y} width={i === 4 ? 40 : 68} height="4" rx="2" />
            {/each}
            <rect class="line" x="14" y="96" width="54" height="4" rx="2" />
        </svg>
    </header>

    <p class="lead" style:--i={0}>
        Lemma is a private, fast Wikipedia reader built for calm, focused browsing. It strips away visual clutter and
        presents articles in a clean custom layout with strong typography and lightweight navigation.
    </p>

    <section style:--i={1}>
        <h2>Why it exists</h2>
        <p>
            Lemma is designed for quick lookups, deeper reading, and browsing Wikipedia without the usual noise. It’s
            meant to feel private, fast, and pleasant enough that reading becomes the default.
        </p>
    </section>

    <section style:--i={2}>
        <h2>What it does</h2>
        <p>
            Lemma fetches Wikipedia articles directly from public endpoints, extracts readable content, and renders it
            in a distraction-free reader. It includes article stats, images, headings, links, and section navigation
            for longer pages.
        </p>

        <figure class="diagram">
            <ol class="pipeline">
                {#each pipeline as step, i}
                    <li>
                        <span class="step-number" aria-hidden="true">{i + 1}</span>
                        <span class="step-name">{step.name}</span>
                        <span class="step-detail">{step.detail}</span>
                    </li>
                {/each}
            </ol>
            <figcaption>From article request to reader</figcaption>
        </figure>
    </section>

    <section style:--i={3}>
        <h2>Built for reading</h2>
        <p>
            The interface uses a soft neutral background, local fonts, subtle shadows, and a centered reading width to
            keep the experience quiet and easy on the eyes. The goal is simple: make exploring knowledge feel
            effortless.
        </p>

        <figure class="diagram">
            <!-- wireframe of the article layout: outline, centred measure, infobox in the margin -->
            <svg class="wireframe" viewBox="0 0 360 200" fill="none" aria-hidden="true" focusable="false">
                <rect class="frame" x="1" y="1" width="358" height="198" rx="10" />
                <path class="stroke" d="M1 22H359" />
                <circle class="accent" cx="14" cy="11.5" r="4" />
                <rect class="fill" x="306" y="8" width="40" height="7" rx="3.5" />

                <!-- outline, with the active entry highlighted -->
                {#each [42, 52, 62, 72, 82, 92] as y, i}
                    <rect class={i === 2 ? "accent" : "fill"} x="22" {y} width={[44, 34, 40, 30, 38, 26][i]} height="4" rx="2" />
                {/each}
                <rect class="accent" x="16" y="60" width="2" height="8" rx="1" />

                <!-- reading column -->
                <rect class="accent" x="110" y="38" width="88" height="9" rx="4.5" />
                <rect class="fill" x="110" y="53" width="56" height="5" rx="2.5" />
                <path class="stroke" d="M110 66H250" />
                {#each [76, 86, 96, 106, 116, 126, 136, 146] as y, i}
                    <rect class="fill" x="110" {y} width={i === 7 ? 84 : 140} height="4" rx="2" />
                {/each}
                <path class="measure" d="M110 160V168M110 164H250M250 160V168" />

                <!-- infobox in the margin -->
                <rect class="card" x="278" y="38" width="64" height="84" rx="6" />
                <rect class="fill" x="284" y="44" width="52" height="30" rx="3" />
                {#each [82, 92, 102, 112] as y, i}
                    <rect class="fill" x="284" {y} width={[48, 36, 44, 30][i]} height="4" rx="2" />
                {/each}

                <text x="44" y="186">Outline</text>
                <text x="180" y="186">64ch reading measure</text>
                <text x="310" y="186">Infobox</text>
            </svg>
            <figcaption>Outline on the left, one calm column in the middle, extras in the margin</figcaption>
        </figure>
    </section>

    <section style:--i={4}>
        <h2>The stack</h2>
        <ul class="stack" aria-label="Technologies">
            {#each stack as item}
                <li>{item}</li>
            {/each}
        </ul>
        <p>
            Wikipedia is requested straight from the browser, so there’s no API key, backend proxy, or server-side
            cache.
        </p>

        <figure class="diagram">
            <div class="flow">
                <div class="node">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                        <circle cx="12" cy="12" r="8.25" />
                        <path
                            d="M3.75 12h16.5M12 3.75c2.25 2.25 3.25 5 3.25 8.25s-1 6-3.25 8.25c-2.25-2.25-3.25-5-3.25-8.25s1-6 3.25-8.25Z"
                        />
                    </svg>
                    Wikipedia
                </div>
                <span class="link" aria-hidden="true">
                    <span class="skipped">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                            <rect x="4.75" y="4.75" width="14.5" height="6" rx="1.5" />
                            <rect x="4.75" y="13.25" width="14.5" height="6" rx="1.5" />
                            <path d="M3 21 21 3" />
                        </svg>
                    </span>
                </span>
                <div class="node">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                        <rect x="3.75" y="4.75" width="16.5" height="11.5" rx="1.75" />
                        <path d="M9 19.25h6M12 16.25v3" />
                    </svg>
                    Your browser
                </div>
            </div>
            <figcaption>No server in between</figcaption>
        </figure>

        <p>
            The app is organized around reusable UI components and route-based pages for the landing screen, search,
            errors, and article readers.
        </p>
    </section>
</ReaderLayout>

<style>
    /* Mirrors the article header in ArticleView, so About reads like any other page in the reader. */
    .about-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
        margin: 1.5rem 0 2.5rem;
        padding-bottom: 2rem;
        border-bottom: 1px solid var(--rule);
        animation: text-appear var(--dur-slow) var(--ease-out) both;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    #title {
        margin: 0;
        font-size: clamp(2.1rem, 1.6rem + 2vw, 2.75rem);
        font-weight: 600;
        line-height: 1.1;
        letter-spacing: -0.01em;
        text-wrap: balance;
    }

    .description {
        margin: 0.6rem 0 0;
        font-family: default-serif;
        font-size: 1.15rem;
        line-height: 1.4;
        color: var(--muted);
        text-wrap: balance;
    }

    .header-art {
        flex: none;
        width: 4.5rem;
        rotate: 4deg;
        filter: drop-shadow(0 6px 14px var(--shadow-color));

        .sheet {
            fill: var(--bg-color);
            stroke: var(--secondary);
            stroke-width: 1.5;
        }

        .accent {
            fill: var(--accent);
            opacity: 0.8;
        }

        .line {
            fill: var(--secondary);
        }

        .rule {
            stroke: var(--secondary);
            stroke-width: 1.5;
        }

        @media (max-width: 480px) {
            display: none;
        }
    }

    /*
     * Spacing rhythm: 1em between paragraphs, 2rem around figures, 4rem between sections
     * (2.5rem of air above each divider, 1.5rem below it).
     */
    p {
        margin: 0 0 1em;
        text-wrap: pretty;

        &:last-child {
            margin-bottom: 0;
        }
    }

    /* the standfirst: set in the serif, larger, and given extra room before the first section */
    .lead {
        margin: 0.5rem 0 0;
        padding: 0.15rem 0 0.15rem 1.25rem;
        border-left: 3px solid var(--accent);
        font-family: default-serif;
        font-size: clamp(1.2rem, 1.1rem + 0.4vw, 1.35rem);
        line-height: 1.55;
        text-wrap: pretty;
    }

    .lead + section {
        margin-top: 3.5rem;
    }

    .lead,
    section {
        animation: text-appear var(--dur-slow) var(--ease-out) both;
        animation-delay: calc(var(--i) * 80ms + 80ms);
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    section {
        margin-top: 2.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--rule);
    }

    h2 {
        margin: 0 0 0.75rem;
        font-size: 1.85rem;
        font-weight: 550;
        line-height: 1.2;
        letter-spacing: -0.005em;
    }

    /* line icons share one stroke style */
    .flow svg {
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .diagram {
        margin: 2rem 0;

        &:last-child {
            margin-bottom: 0;
        }

        figcaption {
            margin-top: 0.75rem;
            text-align: center;
            font-size: 0.75rem;
            font-weight: 500;
            letter-spacing: 0.08em;
            line-height: 1.5;
            text-transform: uppercase;
            color: var(--muted);
        }
    }

    .pipeline {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.75rem;
        margin: 0;
        padding: 0;
        list-style: none;

        li {
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
            padding: 1rem 1.1rem 1.1rem;
            background: var(--bg-color);
            border: 1px solid var(--secondary);
            border-radius: 12px;
            box-shadow: 0 2px 8px var(--shadow-color);
            line-height: 1.35;
        }

        /* arrow into the next step */
        li:not(:last-child)::after {
            content: "";
            position: absolute;
            top: 50%;
            right: -1.75rem;
            width: 1.75rem;
            height: 1rem;
            translate: 0 -50%;
            background-color: var(--muted);
            mask: var(--icon-arrow-right) center / 1rem no-repeat;
            -webkit-mask: var(--icon-arrow-right) center / 1rem no-repeat;
        }

        .step-number {
            display: grid;
            place-items: center;
            width: 1.5rem;
            height: 1.5rem;
            margin-bottom: 0.5rem;
            border-radius: 50%;
            background: color-mix(in oklch, var(--accent) 14%, transparent);
            color: var(--accent);
            font-size: 0.75rem;
            font-weight: 700;
        }

        .step-name {
            font-family: default-serif;
            font-size: 1.1rem;
            font-weight: 550;
        }

        .step-detail {
            font-size: 0.8rem;
            color: var(--muted);
        }

        @media (max-width: 560px) {
            grid-template-columns: 1fr;
            gap: 1.5rem;

            li:not(:last-child)::after {
                mask-image: var(--icon-arrow-down);
                -webkit-mask-image: var(--icon-arrow-down);
                top: auto;
                bottom: -1.5rem;
                right: auto;
                left: 50%;
                width: 1rem;
                height: 1.5rem;
                translate: -50% 0;
            }
        }
    }

    .wireframe {
        display: block;
        width: 100%;
        height: auto;

        .frame {
            fill: var(--bg-color);
            stroke: var(--secondary);
            stroke-width: 1.5;
        }

        .card {
            fill: var(--page-bg);
            stroke: var(--secondary);
        }

        .stroke {
            stroke: var(--secondary);
            stroke-width: 1.5;
        }

        .fill {
            fill: var(--secondary);
        }

        .accent {
            fill: var(--accent);
            opacity: 0.8;
        }

        .measure {
            stroke: var(--accent);
            stroke-width: 1.5;
            stroke-linecap: round;
        }

        text {
            fill: var(--muted);
            font-family: default-sans;
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 0.04em;
            text-anchor: middle;
        }
    }

    .stack {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin: 0 0 1.25rem;
        padding: 0;
        list-style: none;

        li {
            padding: 0.2rem 0.7rem;
            background: var(--bg-color);
            border: 1px solid var(--secondary);
            border-radius: 999px;
            box-shadow: 0 2px 6px var(--shadow-color);
            font-size: 0.8rem;
            font-weight: 550;
            letter-spacing: 0.01em;
            line-height: 1.5;
        }
    }

    .flow {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 1rem;

        .node {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.6rem 0.9rem;
            background: var(--bg-color);
            border: 1px solid var(--secondary);
            border-radius: 10px;
            box-shadow: 0 2px 8px var(--shadow-color);
            font-size: 0.85rem;
            font-weight: 600;
            line-height: 1.3;

            svg {
                width: 1.25rem;
                color: var(--accent);
            }
        }

        /* dashed connector with an arrowhead, skipping over a struck-out server */
        .link {
            position: relative;
            height: 0;
            border-top: 1.5px dashed var(--muted);

            &::after {
                content: "";
                position: absolute;
                right: 0;
                top: -4.75px;
                width: 7px;
                height: 7px;
                border-top: 1.5px solid var(--muted);
                border-right: 1.5px solid var(--muted);
                rotate: 45deg;
            }
        }

        .skipped {
            position: absolute;
            left: 50%;
            top: -0.75px;
            translate: -50% -50%;
            display: grid;
            place-items: center;
            padding: 0 0.4rem;
            background: var(--page-bg);
            color: var(--muted);
            opacity: 0.8;

            svg {
                width: 1.4rem;
            }
        }
    }
</style>
