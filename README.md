# lemma

Lemma is a lightweight, distraction-free Wikipedia client built with SvelteKit. It strips out Wikipedia's default interface clutter to deliver a clean reading experience with customizable typography, article metrics, and streamlined navigation.

All requests are made directly from the reader's browser to Wikipedia, without intermediate proxies, tracking, or API keys.

## Tech Stack

* **Framework:** [SvelteKit](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev/)
* **Build Tool:** [Vite](https://vite.dev/)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Package Manager / Runtime:** [Bun](https://bun.sh/)
* **Sanitizer:** [DOMPurify](https://github.com/cure53/DOMPurify)
* **Tests:** [Vitest](https://vitest.dev/) with jsdom

## Getting Started

1. Install dependencies:

   ```bash
   bun install
   ```

2. Start the development server:

   ```bash
   bun run dev
   ```

3. Open the local server URL provided in the console (typically `http://localhost:5173`), or run `bun run dev --open` to launch it automatically.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Starts the Vite development server |
| `bun run build` | Builds the static site into `build/` |
| `bun run preview` | Previews the production build locally |
| `bun run check` | Runs SvelteKit type checks (`svelte-check`) |
| `bun run check:watch` | Runs type checks in watch mode |
| `bun run test` | Runs the unit tests once |
| `bun run test:watch` | Runs the unit tests in watch mode |

## How It Works

### Routing

| Route | Rendering |
| --- | --- |
| `/` | Prerendered landing page with search |
| `/about` | Prerendered |
| `/wiki/[title]` | Rendered in the browser (`ssr = false`) |

Article URLs mirror Wikipedia's, e.g. `/wiki/Alan_Turing`. Redirects (`/wiki/Turing`) and differently cased titles are resolved by Wikipedia, and the URL is then rewritten to the canonical title.

### Loading articles

`src/routes/wiki/[title]/+page.ts` starts the request and returns it as a promise, so the reader sees a skeleton immediately. Links preload on hover, SvelteKit only renders the latest navigation, and a request is aborted if the reader leaves before it finishes. Failures show an in-page error with retry (offline, timeout, missing article, or generic). Back/forward navigation restores the reading position and folded sections via a SvelteKit snapshot.

### Wikipedia API integration

`src/lib/api/wikipedia.ts` talks to Wikipedia's public APIs:

* **Search suggestions:** `rest.php/v1/search/title`
* **Article content:** `api.php?action=parse&prop=text&redirects=1`

Requests identify Lemma with an `Api-User-Agent` header, as [Wikimedia asks](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy). They time out after 15 seconds, and failures are reported as a typed `WikipediaError` (`not_found`, `offline`, `timeout`, `http`, `invalid`).

### Parsing and the trust boundary

`src/lib/article/parseArticle.ts` turns Wikipedia's HTML into a list of blocks (headings, image groups, paragraphs, lists, tables, quotes, references):

1. The raw HTML is **sanitized with DOMPurify** first. This removes scripts, event handlers, embeds, forms, `<style>` tags, and unsafe URLs. Everything later rendered with `{@html}` comes from this sanitized output.
2. It is parsed with `DOMParser`, which creates an inert document, so no images load and nothing executes while Lemma works on it.
3. Infoboxes, navboxes, hatnotes, maintenance banners, and layout tables are removed. `wikitable` data tables are kept.
4. Links are rewritten (`articleLinks.ts`):
   * Article links stay inside Lemma.
   * Same-page anchors stay local and open folded sections when followed.
   * Non-article namespaces (`File:`, `Category:`, `Help:`, …) and other sites open in a new tab, with `rel="noopener noreferrer"`.
   * Red links become plain text.
5. Every block records which foldable sections contain it, and every element id maps to its block, so collapsing sections and jumping to citations are cheap lookups.

The parser is covered by fixture-based tests in `src/lib/article/*.test.ts`.

## Deployment

Lemma builds to static files with `@sveltejs/adapter-static`, configured in `vite.config.ts`:

* `/` and `/about` are prerendered.
* Every other path is served by the SPA fallback, `build/200.html`. `static/_redirects` tells Netlify to do this, and `netlify.toml` sets the build command and publish directory.
* Social metadata (Open Graph and Twitter cards) lives in `src/app.html`. It needs an absolute site URL, which comes from `PUBLIC_SITE_URL`, then Netlify's built-in `URL` variable, then `http://localhost:4173`.

Any other static host works the same way, as long as it serves `200.html` for unknown paths.

> **Why articles don't have per-article link previews:** article pages are rendered in the reader's browser so that Lemma never proxies Wikipedia traffic. Link-preview crawlers don't run JavaScript, so every page shares the generic Lemma card. Server-rendering articles would fix the previews, but it would route reading activity through a server.

To create and preview a production build:

```bash
bun run build
bun run preview
```
