<script lang="ts">
    import Icon from "./icons/Icon.svelte";

    // The library's empty states: a small hand-drawn scene, a line of what goes here, and how to put it there.
    let { kind }: { kind: "saved" | "history" } = $props();
</script>

<div class="empty">
    <svg class="scene" viewBox="0 0 220 150" fill="none" aria-hidden="true">
        <!-- doodles around the edge: drawn in the muted ink, drifting and twinkling on their own clocks -->
        <g class="doodles" stroke-linecap="round" stroke-linejoin="round">
            <path class="twinkle" style:--d="0s" d="M34 38v14M27 45h14" />
            <path class="twinkle small" style:--d="1.3s" d="M186 104v9M181.5 108.5h9" />
            <path class="drift" style:--d="0.4s" d="M168 30c4-5 9-5 12 0s8 5 12 0" />
            <path class="drift" style:--d="1.8s" d="M22 104c3 4 7 4 10 0s7-4 10 0" />
            <circle class="twinkle" style:--d="0.8s" cx="182" cy="62" r="2.5" />
            <circle class="twinkle" style:--d="2.2s" cx="46" cy="76" r="2" />
            <circle class="twinkle small" style:--d="1.6s" cx="150" cy="16" r="1.6" />
        </g>

        {#if kind === "saved"}
            <!-- two article cards, the front one marked with a bookmark ribbon -->
            <g class="float">
                <g transform="rotate(-9 92 82)">
                    <rect class="card back" x="62" y="34" width="62" height="86" rx="9" />
                    <path class="lines" d="M73 54h36M73 64h40M73 74h28" />
                </g>
                <g transform="rotate(6 128 78)">
                    <rect class="card" x="96" y="28" width="66" height="92" rx="9" />
                    <rect class="picture" x="106" y="40" width="46" height="26" rx="5" />
                    <path class="lines" d="M106 78h40M106 88h46M106 98h30" />
                    <path class="ribbon" d="M140 22h14v26l-7-5-7 5z" />
                </g>
            </g>
        {:else}
            <!-- a clock, its hands at rest, with a trail looping back around it -->
            <g class="float">
                <circle class="card" cx="110" cy="76" r="40" />
                <path class="lines" d="M110 52v24l15 9" />
                <circle class="hub" cx="110" cy="76" r="3" />
                <path class="trail" d="M60 110c-18-30-6-70 30-80" />
                <path class="ribbon-stroke" d="M84 24l9 6-7 9" />
                <path class="lines faint" d="M110 40v4M146 76h-4M110 112v-4M74 76h4" />
            </g>
        {/if}
    </svg>

    {#if kind === "saved"}
        <h2>Nothing saved yet</h2>
        <p>
            Use
            <span class="pill"><Icon name="bookmark" size="0.9em" />Save</span>
            at the top of any article to keep it here for later.
        </p>
    {:else}
        <h2>No history yet</h2>
        <p>Articles you read show up here, so you can find your way back to them.</p>
    {/if}
</div>

<style>
    .empty {
        display: grid;
        justify-items: center;
        padding: 2.5rem 1rem 3rem;
        text-align: center;
        animation: enter var(--dur-slow) var(--ease-out) backwards;
    }

    .scene {
        width: min(15rem, 70%);
        height: auto;
        margin-bottom: 1.25rem;
        overflow: visible;
    }

    /* ---------- drawing ---------- */

    .doodles {
        stroke: color-mix(in oklch, var(--muted) 70%, transparent);
        stroke-width: 2;

        circle {
            fill: color-mix(in oklch, var(--muted) 55%, transparent);
            stroke: none;
        }
    }

    .card {
        fill: var(--bg-color);
        stroke: color-mix(in oklch, var(--text-color) 22%, transparent);
        stroke-width: 2;

        &.back {
            fill: color-mix(in oklch, var(--secondary) 35%, var(--bg-color));
        }
    }

    .picture {
        fill: color-mix(in oklch, var(--secondary) 55%, var(--bg-color));
    }

    .lines {
        stroke: color-mix(in oklch, var(--text-color) 28%, transparent);
        stroke-width: 3;
        stroke-linecap: round;
        stroke-linejoin: round;

        &.faint {
            stroke-width: 2;
            stroke: color-mix(in oklch, var(--text-color) 18%, transparent);
        }
    }

    .hub {
        fill: var(--accent);
    }

    .ribbon {
        fill: var(--accent);
    }

    .ribbon-stroke,
    .trail {
        stroke: var(--accent);
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .trail {
        stroke-dasharray: 2 7;
        opacity: 0.8;
    }

    /* ---------- motion: slow and small, so the page stays calm ---------- */

    .float {
        animation: float 6s ease-in-out infinite;
    }

    .twinkle {
        transform-box: fill-box;
        transform-origin: center;
        animation: twinkle 3.2s ease-in-out var(--d) infinite;

        &.small {
            animation-duration: 2.6s;
        }
    }

    .drift {
        animation: drift 5s ease-in-out var(--d) infinite;
    }

    @keyframes float {
        50% {
            translate: 0 -4px;
        }
    }

    @keyframes twinkle {
        50% {
            opacity: 0.35;
            scale: 0.7;
        }
    }

    @keyframes drift {
        50% {
            translate: 3px -2px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .float,
        .twinkle,
        .drift {
            animation: none;
        }
    }

    /* ---------- words ---------- */

    h2 {
        margin: 0 0 0.4rem;
        padding: 0;
        border: none;
        font-family: var(--display-font);
        font-size: 1.35rem;
        font-weight: 600;
        color: var(--text-color);
    }

    p {
        max-width: 34ch;
        margin: 0;
        font-size: 0.92rem;
        line-height: 1.7;
        text-wrap: pretty;
        color: var(--muted);
    }

    /* a picture of the button to press */
    .pill {
        display: inline-flex;
        align-items: center;
        gap: 0.3em;
        margin: 0 0.1em;
        padding: 0.05em 0.6em;
        border: 1px solid var(--rule);
        border-radius: 999px;
        background: var(--bg-color);
        font-size: 0.85em;
        font-weight: 600;
        color: var(--text-color);
        vertical-align: 0.05em;
    }
</style>
