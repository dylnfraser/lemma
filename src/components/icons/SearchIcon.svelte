<script lang="ts">
    // Drawn like every other icon in Lemma (Icon.svelte): a 24px grid, 2px rounded strokes in the current colour.
    // An inline SVG rather than a mask so the search bar can fade it out behind its loading spinner.
    let { size = 24 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
    <path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
</svg>
