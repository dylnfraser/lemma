<script lang="ts">
    import { onMount } from "svelte";

    let isScrolled = $state(false);

    onMount(() => {
        function handleScroll() {
            isScrolled = window.scrollY > 20;
        }
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    });
</script>

<div id="navbar">
    <a id="header" href="/" aria-label="Go to home page">
        <img src="../logo.svg" alt="" />
        <h1 aria-label="Lemma">
            <span class="char" style="--i: 0" aria-hidden="true">L</span>
            <span class="char" style="--i: 1" aria-hidden="true">e</span>
            <span class="char" style="--i: 2" aria-hidden="true">m</span>
            <span class="char" style="--i: 3" aria-hidden="true">m</span>
            <span class="char" style="--i: 4" aria-hidden="true">a</span>
        </h1>
    </a>

    <span id="buttons">
        <!-- <a href="/tools">Tools</a> -->
        <!-- <a href="/options">Options</a> -->
        <a href="/about">About</a>
    </span>
</div>

<style>
    #navbar {
        position: fixed;
        user-select: none;
        width: 100%;
        height: 52px;
        background: color-mix(in oklch, var(--page-bg) 80%, transparent);
        border-bottom: 1px solid color-mix(in oklch, var(--secondary) 70%, transparent);
        z-index: 1;
        backdrop-filter: blur(2px);
        left: 0;
        top: 0;

        #buttons {
            position: absolute;
            right: 20px;

            height: 100%;
            width: fit-content;
            top: 0;
            user-select: none;
            display: flex;
            gap: 24px;
            align-items: center;
            cursor: default;
            pointer-events: none;

            a {
                pointer-events: auto;
                font-size: 0.85rem;
                cursor: default;

                background: none;
                border: none;

                color: var(--text-color);

                &:hover {
                    cursor: pointer;
                }
            }
        }

        a:focus {
            outline: none;
        }

        #header {
            position: absolute;
            user-select: none;
            left: 0;
            top: 0;
            height: 52px;
            min-width: 140px;
            color: inherit;
            text-decoration: none;

            img {
                position: absolute;

                left: 8px;
                top: 8px;

                width: 36px;
                height: 36px;
                z-index: 100;
            }

            h1 {
                position: absolute;
                left: 52px;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                white-space: nowrap;
                font-size: 1.65rem;
                line-height: 1;
                font-weight: 250;
                margin: 0;

                .char {
                    display: inline-block;
                    font-weight: 250;
                }
            }
        }

        #header:hover {
            h1 .char {
                animation: font-weight-wave 0.8s ease-in-out;
                animation-delay: calc(0.5s + var(--i) * 0.04s);
                @media (prefers-reduced-motion: reduce) {
                    animation: none;
                }
            }
        }
    }

    @keyframes font-weight-wave {
        0%,
        100% {
            font-weight: 250;
        }

        50% {
            font-weight: 700;
        }
    }
</style>
