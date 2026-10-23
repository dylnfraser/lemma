import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

// Absolute URL used for social metadata in app.html and for prerendering. Set PUBLIC_SITE_URL in the deployment's build
// variables to the site's real address.
process.env.PUBLIC_SITE_URL ??= "http://localhost:4173";

export default defineConfig(({ command }) => ({
  plugins: [
    sveltekit({
      // In dev, components inject their own CSS instead of loading it as separate virtual stylesheet modules. Those
      // modules occasionally fail to load in dev ("failed to load virtual css module"), and Vite then serves the raw
      // .svelte file as CSS: its styles lose their scoping and leak onto the whole page. Builds are unaffected.
      vitePlugin: { emitCss: command !== "serve" },

      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
      },

      // Lemma talks to Wikipedia from the browser, so it ships as static files: the landing and about pages are
      // prerendered and every other route (articles) is served by the SPA fallback (cloudflare/worker.js
      // serves it on Cloudflare).
      adapter: adapter({ fallback: "200.html" }),
      prerender: { origin: process.env.PUBLIC_SITE_URL },
    }),
  ],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
}));
