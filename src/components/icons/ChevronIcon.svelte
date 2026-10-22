<script lang="ts">
    let { collapsed = false, size = 24 }: { collapsed?: boolean; size?: number } = $props();
</script>

<svg class:collapsed width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path
        d="M7.6 10.3 12 14.8l4.4-4.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    />
</svg>

<style>
    svg {
        display: block;
        transition: transform var(--dur-base) var(--ease-spring);

        @media (prefers-reduced-motion: reduce) {
            transition: none;
        }
    }

    .collapsed {
        transform: rotate(180deg);
    }
</style>
