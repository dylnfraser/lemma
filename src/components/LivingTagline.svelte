<script lang="ts">
    import { onMount } from "svelte";
    import { prefersReducedMotion } from "svelte/motion";
    import type { FeaturedFeed } from "$lib/api/feed";
    import { getArticlePath } from "$lib/article/articleUtils";
    import { DURATION, rise } from "$lib/motion";

    // The line under the wordmark: Lemma's own, and now and then something from today's Wikipedia in its place.
    interface Props {
        tagline: string;
        feed: FeaturedFeed | null;
        /** While true (the reader is searching), the line holds still. */
        paused?: boolean;
    }

    let { tagline, feed, paused = false }: Props = $props();

    const HOLD_MS = 7000;
    const MAX_CHARS = 90;
    const EVENTS = 3;

    type Line = { text: string; href?: string };

    const shorten = (text: string) => (text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS).replace(/\s+\S*$/, "")}…` : text);
    const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

    let lines = $derived.by<Line[]>(() => {
        const result: Line[] = [{ text: tagline }];
        if (!feed) return result;
        if (feed.featured) {
            const { title, description } = feed.featured;
            result.push({ text: shorten(`Today: ${title}${description ? `, ${lowerFirst(description)}` : ""}`), href: getArticlePath(title) });
        }
        for (const event of feed.onThisDay.filter((event) => event.year !== null).slice(0, EVENTS)) {
            result.push({ text: shorten(`On this day in ${event.year}, ${lowerFirst(event.text)}`), href: event.pages[0] ? getArticlePath(event.pages[0].title) : undefined });
            result.push({ text: tagline }); // back home between facts
        }
        return result;
    });

    let index = $state(0);
    // the first showing arrives word by word; later lines cross over whole
    let cycled = $state(false);
    let words = $derived(tagline.split(" "));
    let hovered = $state(false);
    let line = $derived(lines[index % lines.length]);

    onMount(() => {
        const timer = setInterval(() => {
            if (paused || hovered || prefersReducedMotion.current || document.hidden || lines.length < 2) return;
            index = (index + 1) % lines.length;
            cycled = true;
        }, HOLD_MS);
        return () => clearInterval(timer);
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (hovering only pauses the rotation) -->
<p class="tagline" aria-live="off" onpointerenter={() => (hovered = true)} onpointerleave={() => (hovered = false)}>
    {#if !cycled}
        <span class="line" out:rise={{ y: -6, duration: DURATION.base }}>
            {#each words as word, i}<span class="word" style:--i={i}>{word}</span>{" "}{/each}
        </span>
    {:else}
        {#key index}
            <span class="line" in:rise={{ y: 6, duration: DURATION.slow, delay: 120 }} out:rise={{ y: -6, duration: DURATION.base }}>
                {#if line.href}
                    <a href={line.href}>{line.text}</a>
                {:else}
                    {line.text}
                {/if}
            </span>
        {/key}
    {/if}
</p>

<style>
    /* lines cross over in one cell, so the page doesn't shift between them */
    .tagline {
        display: grid;
        margin: 0;
        font-size: 1.05rem;
        line-height: 1.6;
        text-wrap: balance;
        color: var(--muted);
    }

    .line {
        grid-area: 1 / 1;
    }

    .word {
        display: inline-block;
        animation: enter var(--dur-slow) var(--ease-out) backwards;
        animation-delay: calc(var(--i) * var(--stagger) + 100ms);
    }

    a {
        color: inherit;
        text-decoration: none;
        transition: color var(--dur-base) var(--ease-out);

        &:hover {
            color: var(--link-hover);
        }
    }
</style>
