<script lang="ts">
    interface Props {
        id: string;
        title: string;
        desc?: string;
        imgsrc?: string;
        href: string;
        active?: boolean;
        onhover?: () => void;
        onselect?: () => void;
    }

    let { id, title, desc = "", imgsrc = "", href, active = false, onhover, onselect }: Props = $props();

    function getInitials(value: string) {
        const words = value.trim().split(/\s+/).filter(Boolean);

        if (words.length >= 2) {
            return `${words[0][0]}${words[1][0]}`.toUpperCase();
        }

        return value.trim().slice(0, 2).toUpperCase();
    }
</script>

<a
    {id}
    class:active
    class="res"
    {href}
    role="option"
    aria-selected={active}
    tabindex="-1"
    onpointermove={onhover}
    onclick={onselect}
>
    {#if imgsrc}
        <img alt="" src={imgsrc} />
    {:else}
        <span class="placeholder" aria-hidden="true">{getInitials(title)}</span>
    {/if}
    <span class="text">
        <span class="title">{title}</span>
        {#if desc}
            <span class="desc">{desc}</span>
        {/if}
    </span>
</a>

<style>
    .res {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        cursor: pointer;
        user-select: none;
        color: inherit;
        text-decoration: none;
        border-radius: 7px;
        overflow: hidden;
    }

    .res.active {
        background: color-mix(in oklch, var(--secondary) 35%, transparent);
    }

    .text {
        display: grid;
        min-width: 0;
        padding-right: 8px;
        line-height: 1.25;
    }

    .title,
    .desc {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .title {
        font-family: default-serif;
        font-size: 0.9rem;
    }

    .desc {
        font-size: 0.75rem;
        font-weight: 350;
        opacity: 0.75;
    }

    img,
    .placeholder {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: 7px 0 0 7px;
        background: var(--secondary);
    }

    img {
        object-fit: cover;
    }

    .placeholder {
        display: grid;
        place-items: center;
        font-family: default-serif;
        font-size: 0.9rem;
        font-weight: 600;
        opacity: 0.8;
    }
</style>
