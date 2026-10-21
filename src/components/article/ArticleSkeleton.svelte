<script lang="ts">
    let { seed }: { seed: string } = $props();

    // Stable, title-seeded line widths so the skeleton doesn't jitter between renders.
    let widths = $derived.by(() => {
        let state = 2166136261;
        for (const character of seed) {
            state ^= character.charCodeAt(0);
            state = Math.imul(state, 16777619);
        }

        return Array.from({ length: 8 }, () => {
            state = Math.imul(state, 1664525) + 1013904223;
            return 62 + ((state >>> 0) % 39);
        });
    });
</script>

<div class="article-skeleton" role="status" aria-label="Loading article">
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-meta"></div>
    <div class="skeleton skeleton-rule"></div>
    {#each widths as width, i}
        <div class="skeleton skeleton-line" class:paragraph-break={i === 5} style:--skeleton-width="{width}%"></div>
    {/each}
</div>

<style>
    .article-skeleton {
        padding-top: 1.25rem;

        /* held back briefly: preloaded or fast articles replace it before it ever flickers into view */
        animation: appear var(--dur-base) var(--ease-out) 120ms both;
    }

    .skeleton {
        background: linear-gradient(
            90deg,
            color-mix(in oklch, var(--secondary) 65%, transparent) 25%,
            color-mix(in oklch, var(--secondary) 35%, var(--page-bg)) 50%,
            color-mix(in oklch, var(--secondary) 65%, transparent) 75%
        );
        background-size: 200% 100%;
        border-radius: 6px;

        animation: skeleton-shimmer 1.4s ease-in-out infinite;
        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    .skeleton-title {
        width: min(70%, 22rem);
        height: 2rem;
        margin-bottom: 0.85rem;
    }

    .skeleton-meta {
        width: min(42%, 12rem);
        height: 0.8rem;
        margin-bottom: 1.25rem;
    }

    .skeleton-rule {
        width: 100%;
        height: 2px;
        margin-bottom: 1.5rem;
    }

    .skeleton-line {
        width: var(--skeleton-width);
        height: 0.9rem;
        margin-bottom: 1.05rem;

        &.paragraph-break {
            margin-top: 2rem;
        }
    }

    @keyframes skeleton-shimmer {
        from {
            background-position: 200% 0;
        }

        to {
            background-position: -200% 0;
        }
    }
</style>
