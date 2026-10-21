<script lang="ts" module>
    export type IconName =
        | "arrow-left"
        | "arrow-right"
        | "arrow-up"
        | "arrow-down"
        | "arrow-up-right"
        | "corner-down-left"
        | "chevron-right";
</script>

<script lang="ts">
    // Shapes live in app.css (--icon-*) so CSS-only places (::after markers) share the exact same icons.
    let { name, size = "1em" }: { name: IconName; size?: string } = $props();
</script>

<span class="icon" style:--icon="var(--icon-{name})" style:--size={size} aria-hidden="true"></span>

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
    }
</style>
