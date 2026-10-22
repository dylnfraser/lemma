<script lang="ts">
    import { onMount } from "svelte";
    import { prefersReducedMotion } from "svelte/motion";
    import type { FeaturedFeed } from "$lib/api/feed";
    import { getArticlePath } from "$lib/article/articleUtils";
    import { BLUR_PX, DURATION, cubicOut, motion } from "$lib/motion";

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
    let hovered = $state(false);
    let line = $derived(lines[index % lines.length]);
    let lineWords = $derived(line.text.split(" "));

    // One line turns into the next a word at a time: the old words blur away in reading order, then the new ones
    // settle in after them.
    const WORD_STAGGER_OUT = 14;
    const WORD_STAGGER_IN = 32;
    const WORDS_IN_AFTER = 160;

    function word(_node: Element, { delay = 0, y = 4, duration = DURATION.base }: { delay?: number; y?: number; duration?: number }) {
        return {
            delay: motion(delay),
            duration: motion(duration),
            easing: cubicOut,
            css: (t: number, u: number) => `opacity: ${t}; filter: blur(${u * BLUR_PX}px); transform: translateY(${u * y}px);`,
        };
    }

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
    {#key index}
        <span class="line" class:first={!cycled}>
            {#snippet words(list: string[])}
                {#each list as text, i}<span
                        class="word"
                        style:--i={i}
                        in:word|global={{ delay: WORDS_IN_AFTER + i * WORD_STAGGER_IN, y: 4, duration: DURATION.slow }}
                        out:word|global={{ delay: i * WORD_STAGGER_OUT, y: -3 }}>{text}</span
                    >{" "}{/each}
            {/snippet}
            {#if line.href}
                <a href={line.href}>{@render words(lineWords)}</a>
            {:else}
                {@render words(lineWords)}
            {/if}
        </span>
    {/key}
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
    }

    /* the very first line arrives with the page (transitions don't play on first render) */
    .first .word {
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
