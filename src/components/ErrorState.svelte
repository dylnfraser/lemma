<script lang="ts">
    interface Props {
        heading: string;
        message: string;
        onRetry?: () => void;
        /** Label for the retry action ("Try again", "Give it another go"…). */
        retryLabel?: string;
    }

    let { heading, message, onRetry, retryLabel = "Try again" }: Props = $props();

    const homeMessages = ["Go back home", "Return to ground zero", "Take me back", "Home sweet home"];
    const homeText = homeMessages[Math.floor(Math.random() * homeMessages.length)];

    // The message drifts in a word at a time; screen readers get it whole (see the sr-only copy below).
    let words = $derived(message.split(" "));
</script>

<section class="error-state" role="alert" aria-labelledby="error-heading">
    <h1 id="error-heading">{heading}</h1>

    <p>
        <span class="sr-only">{message}</span>
        <span aria-hidden="true">
            {#each words as word, i}
                <span class="word" style:--i={i}>{word}</span>{" "}
            {/each}
        </span>
    </p>

    <div class="actions" style:--after={words.length}>
        {#if onRetry}
            <button type="button" class="primary" onclick={onRetry}>{retryLabel}</button>
            <!-- its own element, so it isn't part of (underlined with, clickable as) either link -->
            <span class="separator" aria-hidden="true">·</span>
        {/if}
        <a href="/">{homeText}</a>
    </div>
</section>

<style>
    .error-state {
        text-align: center;
    }

    h1 {
        margin: 0 0 0.6rem;
        font-size: 3rem;
        font-weight: 350;
        line-height: 1.15;
        text-wrap: balance;
        overflow-wrap: anywhere;

        animation: popup 0.5s both;
    }

    p {
        max-width: 50ch;
        margin: 0 auto;
        line-height: 1.7;
        text-align: justify;
        text-align-last: center;
        text-wrap: pretty;
    }

    .word {
        animation: appear-word 1.2s both;
        animation-delay: calc(var(--i) * 12ms + 150ms);
    }

    /* quiet text links, separated by dots, arriving once the message has */
    .actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: baseline;
        gap: 0.4rem 0;
        margin-top: 1.75rem;

        animation: popup 0.5s both;
        animation-delay: calc(var(--after) * 12ms + 450ms);
    }

    .separator {
        margin: 0 0.75rem;
        color: var(--muted);
    }

    button,
    a {
        padding: 0;
        border: none;
        background: none;
        font: inherit;
        color: inherit;
        text-decoration: underline;
        text-decoration-color: color-mix(in oklch, currentColor 35%, transparent);
        text-underline-offset: 0.22em;
        cursor: pointer;
        transition:
            color var(--dur-fast),
            text-decoration-color var(--dur-fast);

        &:hover {
            color: var(--link-hover);
            text-decoration-color: currentColor;
        }
    }

    .primary {
        font-weight: 600;
        color: var(--accent);
        text-decoration-color: color-mix(in oklch, var(--accent) 45%, transparent);
    }

    @keyframes popup {
        from {
            opacity: 0;
            filter: blur(1px);
            transform: translateY(6px);
        }
    }

    @keyframes appear-word {
        from {
            opacity: 0;
            filter: blur(1px);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        h1,
        .word,
        .actions {
            animation: none;
        }
    }
</style>
