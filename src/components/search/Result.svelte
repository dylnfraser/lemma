<script lang="ts">
    let {
        title,
        desc = "",
        imgsrc = "",
        href,
        active = false,
    } = $props<{
        title: string;
        desc?: string;
        imgsrc?: string;
        href: string;
        active?: boolean;
    }>();

    function getInitials(value: string) {
        const words = value.trim().split(/\s+/).filter(Boolean);

        if (words.length >= 2) {
            return `${words[0][0]}${words[1][0]}`.toUpperCase();
        }

        return value.trim().slice(0, 2).toUpperCase();
    }
</script>

<a class:active class="res" {href}>
    {#if imgsrc}
        <img alt="" src={imgsrc} />
    {:else}
        <span class="placeholder" aria-hidden="true">{getInitials(title)}</span>
    {/if}
    <span class="title">{title}</span>
    {#if desc}
        <span class="desc">{desc}</span>
    {/if}
</a>

<style>
    .res {
        position: relative;
        display: block;
        cursor: pointer;
        user-select: none;
        width: 100%;
        min-height: 40px;
        margin-left: 0;
        color: inherit;
        text-decoration: none;
        border-radius: 7px;
    }

    .res:hover,
    .res.active,
    .res:focus-visible {
        background: color-mix(in oklch, var(--secondary) 35%, transparent);
    }

    .title {
        position: absolute;
        top: 3px;
        left: 48px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: default-serif;
        font-size: 0.9rem;
        text-overflow: ellipsis;
        max-width: 60%;
    }

    .desc {
        position: absolute;
        bottom: 4px;
        left: 48px;
        right: 8px;
        white-space: nowrap;
        font-size: 0.75rem;
        font-weight: 350;
        opacity: 0.75;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    }

    img,
    .placeholder {
        position: absolute;
        left: 0;
        top: 0;
        width: 40px;
        height: 40px;
        border-radius: 7px 0 0 7px;
        /*border: solid rgba(0, 0, 0, 0.1) 0.5px;*/
        /*outline: solid var(--secondary) 0.5px;*/
        /*box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 12px 1px;*/
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
