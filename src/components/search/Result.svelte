<script lang="ts">
    import Icon from "../icons/Icon.svelte";

    interface Props {
        id: string;
        title: string;
        /** The query the results were found for; the matching part of the title is emphasised. */
        query?: string;
        desc?: string;
        imgsrc?: string;
        href: string;
        active?: boolean;
        onhover?: () => void;
        onselect?: () => void;
    }

    let { id, title, query = "", desc = "", imgsrc = "", href, active = false, onhover, onselect }: Props = $props();

    // Split the title around the first case-insensitive match of the query.
    let parts = $derived.by(() => {
        const at = query ? title.toLowerCase().indexOf(query.trim().toLowerCase()) : -1;
        if (at === -1) return { before: title, match: "", after: "" };
        const end = at + query.trim().length;
        return { before: title.slice(0, at), match: title.slice(at, end), after: title.slice(end) };
    });

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
        <span class="title">{parts.before}{#if parts.match}<mark>{parts.match}</mark>{/if}{parts.after}</span>
        {#if desc}
            <span class="desc">{desc}</span>
        {/if}
    </span>
    <kbd class="enter" aria-hidden="true"><Icon name="corner-down-left" size="0.75rem" /></kbd>
</a>

<style>
    .res {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        min-height: 44px;
        padding: 4px 8px 4px 4px;
        box-sizing: border-box;
        cursor: pointer;
        user-select: none;
        color: inherit;
        text-decoration: none;
        border-radius: 8px;
        transition: background-color var(--dur-instant) ease;
    }

    .res.active {
        background: color-mix(in oklch, var(--secondary) 38%, transparent);
    }

    .text {
        display: grid;
        flex: 1;
        min-width: 0;
        line-height: 1.25;
    }

    .title,
    .desc {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .title {
        font-family: var(--display-font);
        font-size: 0.9rem;
    }

    mark {
        background: none;
        color: inherit;
        font-weight: 650;
    }

    .desc {
        font-size: 0.75rem;
        color: var(--muted);
    }

    img,
    .placeholder {
        flex: none;
        width: 34px;
        height: 34px;
        border-radius: 7px;
    }

    img {
        object-fit: cover;
        background: var(--secondary);
        outline: 1px solid var(--image-edge);
        outline-offset: -1px;
    }

    .placeholder {
        display: grid;
        place-items: center;
        background: color-mix(in oklch, var(--accent) 10%, var(--secondary));
        color: color-mix(in oklch, var(--accent) 55%, var(--text-color));
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.06em;
    }

    .enter {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        height: 1.375rem;
        min-width: 1.375rem;
        padding: 0 0.375rem;
        border: 1px solid var(--rule);
        border-radius: 6px;
        background: var(--bg-color);
        font-family: inherit;
        font-size: 0.7rem;
        font-weight: 500;
        line-height: 1;
        color: var(--muted);
        opacity: 0;
        transition: opacity var(--dur-fast) ease;
    }

    .res.active .enter {
        opacity: 1;
    }

    @media (pointer: coarse) {
        .enter {
            display: none;
        }
    }
</style>
