import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

// Absolute URL used for social metadata in app.html and for prerendering. Netlify provides `URL` at build time.
process.env.PUBLIC_SITE_URL ??= process.env.URL ?? "http://localhost:4173";

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
      },

      // Lemma talks to Wikipedia from the browser, so it ships as static files: the landing and about pages are
      // prerendered and every other route (articles) is served by the SPA fallback. See static/_redirects.
      adapter: adapter({ fallback: "200.html" }),
      prerender: { origin: process.env.PUBLIC_SITE_URL },
    }),
  ],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
