<script lang="ts">
    import { tick } from "svelte";
    import { isKeyboardClick } from "$lib/focus";
    import { DURATION, pop } from "$lib/motion";
    import { BODY_FONTS, LINE_WIDTHS, TEXT_SIZES, THEMES, settings } from "$lib/settings.svelte";
    import { slidingTabs } from "$lib/slidingTabs";

    // How articles read: theme, text size, body font and line width. A popover from the navbar ("Aa").
    const uid = $props.id();
    let open = $state(false);
    let root = $state<HTMLElement>();
    let panel = $state<HTMLElement>();

    const THEME_NAMES = { system: "Auto", light: "Light", sepia: "Sepia", dark: "Dark" } as const;
    const FONT_NAMES = { sans: "Sans", serif: "Serif" } as const;
    const WIDTH_NAMES = { narrow: "Narrow", normal: "Normal", wide: "Wide" } as const;

    async function toggle(event: MouseEvent) {
        open = !open;
        if (open && isKeyboardClick(event)) {
            await tick();
            panel?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
        }
    }

    function close() {
        open = false;
        root?.querySelector<HTMLButtonElement>(".toggle")?.focus();
    }

    function handleWindowPointerDown(event: PointerEvent) {
        if (open && root && !root.contains(event.target as Node)) open = false;
    }

    function handleWindowKeydown(event: KeyboardEvent) {
        if (open && event.key === "Escape") close();
    }

    /** Arrow keys move the choice within a radio group (and focus with it), as in a native one. */
    function radioKeys<T>(event: KeyboardEvent, options: readonly T[], current: T, choose: (value: T) => void) {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = options[(options.indexOf(current) + step + options.length) % options.length];
        choose(next);
        const group = (event.currentTarget as HTMLElement).closest('[role="radiogroup"]');
        tick().then(() => group?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
    }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeydown} />

<span class="reader-settings" bind:this={root}>
    <button
        type="button"
        class="toggle"
        aria-label="Reader settings"
        title="Reader settings"
        aria-expanded={open}
        aria-controls="{uid}-panel"
        onmousedown={(event) => event.preventDefault()}
        onclick={toggle}
    >
        <span class="glyph" aria-hidden="true">Aa</span>
    </button>

    {#if open}
        <div class="panel" id="{uid}-panel" role="dialog" aria-label="Reader settings" bind:this={panel} transition:pop={{ y: -4 }}>
            <div class="setting">
                <span class="label" id="{uid}-theme">Theme</span>
                <div class="themes" role="radiogroup" aria-labelledby="{uid}-theme">
                    {#each THEMES as theme}
                        {@const checked = settings.theme === theme}
                        <button
                            type="button"
                            role="radio"
                            class="theme"
                            aria-checked={checked}
                            tabindex={checked ? 0 : -1}
                            onclick={() => settings.setTheme(theme)}
                            onkeydown={(event) => radioKeys(event, THEMES, settings.theme, settings.setTheme)}
                        >
                            <span class="swatch {theme}" aria-hidden="true">Aa</span>
                            {THEME_NAMES[theme]}
                        </button>
                    {/each}
                </div>
            </div>

            <div class="setting">
                <span class="label" id="{uid}-size">Text size</span>
                <div class="size" role="group" aria-labelledby="{uid}-size">
                    <button
                        type="button"
                        class="step smaller"
                        aria-label="Smaller text"
                        disabled={settings.textSize === 0}
                        onclick={() => settings.stepTextSize(-1)}>A</button
                    >
                    <span class="dots" role="img" aria-label="{Math.round(TEXT_SIZES[settings.textSize] * 100)}%">
                        {#each TEXT_SIZES as _, i}
                            <span class="dot" class:on={i <= settings.textSize}></span>
                        {/each}
                    </span>
                    <button
                        type="button"
                        class="step larger"
                        aria-label="Larger text"
                        disabled={settings.textSize === TEXT_SIZES.length - 1}
                        onclick={() => settings.stepTextSize(1)}>A</button
                    >
                </div>
            </div>

            <div class="setting">
                <span class="label" id="{uid}-font">Font</span>
                <div class="segments" role="radiogroup" aria-labelledby="{uid}-font" use:slidingTabs={settings.font}>
                    {#each BODY_FONTS as font}
                        {@const checked = settings.font === font}
                        <button
                            type="button"
                            role="radio"
                            class="font-{font}"
                            aria-checked={checked}
                            tabindex={checked ? 0 : -1}
                            onclick={() => settings.setFont(font)}
                            onkeydown={(event) => radioKeys(event, BODY_FONTS, settings.font, settings.setFont)}
                            >{FONT_NAMES[font]}</button
                        >
                    {/each}
                </div>
            </div>

            <div class="setting">
                <span class="label" id="{uid}-width">Line width</span>
                <div class="segments" role="radiogroup" aria-labelledby="{uid}-width" use:slidingTabs={settings.width}>
                    {#each LINE_WIDTHS as width}
                        {@const checked = settings.width === width}
                        <button
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            tabindex={checked ? 0 : -1}
                            onclick={() => settings.setWidth(width)}
                            onkeydown={(event) => radioKeys(event, LINE_WIDTHS, settings.width, settings.setWidth)}
                            >{WIDTH_NAMES[width]}</button
                        >
                    {/each}
                </div>
            </div>

            <div class="footer">
                <span class="note">Saved in this browser</span>
                <button type="button" class="reset" disabled={settings.isDefault} onclick={() => settings.reset()}>Reset</button>
            </div>
        </div>
    {/if}
</span>

<style>
    .reader-settings {
        display: contents;
    }

    /* the navbar's icon-button box, like the library link beside it */
    .toggle {
        display: grid;
        place-items: center;
        box-sizing: border-box;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 1px solid transparent;
        border-radius: 8px;
        background: none;
        color: var(--muted);
        cursor: pointer;
        transition:
            color var(--dur-base) var(--ease-out),
            border-color var(--dur-fast),
            scale var(--dur-instant) var(--ease-out);

        &:hover,
        &[aria-expanded="true"] {
            color: var(--text-color);
            border-color: var(--secondary);
        }

        &:active {
            scale: 0.94;
        }
    }

    /* px, like the navbar's other icons: the bar doesn't grow with the text size */
    .glyph {
        font-family: default-serif;
        font-size: 17px;
        font-weight: 500;
        line-height: 1;
        letter-spacing: -0.02em;
    }

    .panel {
        position: fixed;
        z-index: 35;
        top: calc(var(--nav-height) + 0.5rem);
        right: max(0.5rem, env(safe-area-inset-right));
        box-sizing: border-box;
        width: min(calc(19rem / var(--text-scale)), calc(100vw - 1rem));
        padding: 1em;
        border: 1px solid var(--rule);
        border-radius: 14px;
        background: var(--bg-color);
        box-shadow: 0 18px 40px -18px var(--shadow-color);
        transform-origin: calc(100% - 1.67em) 0;
        color: var(--text-color);
        /* the panel itself stays one size while the reader tries text sizes */
        font-size: calc(0.9rem / var(--text-scale));

        @media (max-width: 600px) {
            left: max(0.75rem, env(safe-area-inset-left));
            right: max(0.75rem, env(safe-area-inset-right));
            width: auto;
            transform-origin: 50% 0;
        }
    }

    .setting + .setting {
        margin-top: 1.06em;
    }

    .label {
        display: block;
        margin-bottom: 0.5em;
        font-size: 0.72em;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
    }

    /* ---------- theme: a swatch of each page ---------- */

    .themes {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.44em;
    }

    .theme {
        display: grid;
        justify-items: center;
        gap: 0.39em;
        padding: 0;
        border: none;
        background: none;
        font: inherit;
        font-size: 0.78em;
        font-weight: 550;
        color: var(--muted);
        cursor: pointer;
        transition: color var(--dur-base) var(--ease-out);

        &:hover,
        &[aria-checked="true"] {
            color: var(--text-color);
        }

        &:focus-visible {
            outline: none;

            .swatch {
                outline: 2px solid var(--accent);
                outline-offset: 2px;
            }
        }
    }

    /* each swatch shows its own page, whatever the current theme; the chosen one is ringed in the accent */
    .swatch {
        display: grid;
        place-items: center;
        box-sizing: border-box;
        width: 100%;
        height: 2.89em;
        border-radius: 10px;
        border: 1px solid var(--rule);
        font-family: default-serif;
        font-size: 1.15em;
        font-weight: 500;
        box-shadow: 0 0 0 0 transparent;
        transition: box-shadow var(--dur-base) var(--ease-out);

        &.light {
            background: oklch(0.975 0.0075 75);
            color: oklch(0.3 0.064 75);
        }

        &.sepia {
            background: oklch(0.935 0.03 80);
            color: oklch(0.31 0.06 60);
        }

        &.dark {
            background: oklch(0.2 0.005 75);
            color: oklch(0.8 0.05 75);
        }

        /* "Auto": half light, half dark */
        &.system {
            background: linear-gradient(135deg, oklch(0.975 0.0075 75) 50%, oklch(0.2 0.005 75) 50%);
            color: oklch(0.55 0.04 75);
        }
    }

    [aria-checked="true"] > .swatch {
        border-color: transparent;
        box-shadow: 0 0 0 2px var(--accent);
    }

    /* ---------- text size: smaller A, the steps, larger A ---------- */

    .size {
        display: flex;
        align-items: center;
        gap: 0.56em;
        padding: 0.22em;
        border-radius: 9px;
        background: color-mix(in oklch, var(--secondary) 30%, var(--bg-color));
    }

    .step {
        display: grid;
        place-items: center;
        width: 2.67em;
        height: 2.22em;
        padding: 0;
        border: none;
        border-radius: 7px;
        background: none;
        font-family: default-serif;
        line-height: 1;
        color: var(--text-color);
        cursor: pointer;
        transition:
            background-color var(--dur-fast) ease,
            opacity var(--dur-fast) ease;

        &.smaller {
            font-size: 0.85em;
        }

        &.larger {
            font-size: 1.3em;
        }

        &:hover:not(:disabled) {
            background: var(--bg-color);
        }

        &:disabled {
            opacity: 0.35;
            cursor: default;
        }
    }

    .dots {
        flex: 1;
        display: flex;
        justify-content: center;
        gap: 0.5em;
    }

    .dot {
        width: 0.44em;
        height: 0.44em;
        border-radius: 50%;
        background: color-mix(in oklch, var(--muted) 35%, transparent);
        transition:
            background-color var(--dur-base) var(--ease-out),
            scale var(--dur-base) var(--ease-spring);

        &.on {
            background: var(--accent);
        }
    }

    /* ---------- font and width: segmented, with a sliding highlight (as in Cite) ---------- */

    .segments {
        position: relative;
        --tab-radius: 7px;
        display: flex;
        gap: 0.22em;
        padding: 0.22em;
        border-radius: 9px;
        background: color-mix(in oklch, var(--secondary) 30%, var(--bg-color));

        button {
            flex: 1;
            padding: 0.44em 0;
            border: none;
            border-radius: 7px;
            background: none;
            font: inherit;
            font-size: 0.86em;
            font-weight: 550;
            color: var(--muted);
            cursor: pointer;
            /* above the sliding highlight */
            position: relative;
            z-index: 1;
            transition: color var(--dur-base) var(--ease-out);

            &:hover,
            &[aria-checked="true"] {
                color: var(--text-color);
            }
        }

        /* each font's name is set in it */
        .font-sans {
            font-family: default-sans;
        }

        .font-serif {
            font-family: default-serif;
            font-size: 0.95em;
        }
    }

    .footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.83em;
        margin-top: 1.11em;
        padding-top: 0.83em;
        border-top: 1px solid var(--rule);
    }

    .note {
        font-size: 0.78em;
        color: var(--muted);
    }

    .reset {
        padding: 0.33em 0.67em;
        border: 1px solid var(--rule);
        border-radius: 7px;
        background: none;
        font: inherit;
        font-size: 0.8em;
        font-weight: 550;
        color: var(--text-color);
        cursor: pointer;
        transition:
            border-color var(--dur-fast),
            opacity var(--dur-fast) ease;

        &:hover:not(:disabled) {
            border-color: var(--secondary);
        }

        &:disabled {
            opacity: 0.4;
            cursor: default;
        }
    }
</style>
