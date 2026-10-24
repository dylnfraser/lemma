<script lang="ts" module>
    export type IconName =
        | "arrow-left"
        | "arrow-right"
        | "arrow-up"
        | "arrow-down"
        | "arrow-up-right"
        | "corner-down-left"
        | "chevron-right"
        | "x"
        | "volume"
        | "corner-down-right"
        | "star"
        | "badge-check"
        | "link"
        | "check"
        | "map-pin"
        | "headphones"
        | "bookmark"
        | "bookmark-filled"
        | "history"
        | "search"
        | "quote"
        | "copy"
        | "printer"
        | "keyboard"
        | "play"
        | "pause"
        | "image"
        | "folder"
        | "chevron-down"
        | "globe"
        | "lock"
        | "pencil"
        | "flag"
        | "book-open";
</script>

<script lang="ts">
    // Shapes live in app.css (--icon-*) so CSS-only places (::after markers) share the exact same icons.
    let { name, size = "1em" }: { name: IconName; size?: string } = $props();
</script>

<span class="icon" data-icon={name} style:--icon="var(--icon-{name})" style:--size={size} aria-hidden="true"></span>

<style>
    .icon {
        display: inline-block;
        flex: none;
        width: var(--size);
        height: var(--size);
        vertical-align: -0.125em;
        background-color: currentColor;
        mask: var(--icon) center / contain no-repeat;
        -webkit-mask: var(--icon) center / contain no-repeat;
        transition: translate var(--dur-fast) var(--ease-out);
    }
</style>
