# lemma

Lemma is a Wikipedia reader that shows you the article and not much else. It leaves out Wikipedia's editing tools, banners and sidebars, and sets the text so it's comfortable to read, with themes and typography you can adjust (see [Reader settings](#reader-settings)). It's built with SvelteKit.

All requests are made directly from the reader's browser to Wikipedia, without intermediate proxies, tracking, accounts, or API keys. Everything personal (saved articles, history, reading positions, settings) stays in the browser.

## Features

**Reading**

* A contents sidebar that follows along as you read, with sections that fold (on phones, a floating button showing the current section).
* Previews on hover: an article's summary for links, the full reference for footnotes.
* The infobox beside the text on wide screens, and images that stack into a fan and open in a full-screen viewer.
* Tidy back matter: references tagged by kind of source (academic, book, news, government, website), with a summary of the article's source mix and its "citation needed" flags; compact back-links, archive and identifier links; year lists in two columns.
* Select text to copy it as a quote, or as a link that opens the article at that passage.
* Read next and related topics, the article in other languages, its categories, and when it was last edited.

**Getting around**

* Search from anywhere (<kbd>/</kbd> or <kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>K</kbd>), with suggestions as you type and full results at `/search`.
* Keyboard shortcuts for reading (<kbd>J</kbd>/<kbd>K</kbd> between sections, <kbd>[</kbd>/<kbd>]</kbd> to fold, <kbd>S</kbd> to save, <kbd>T</kbd> to the top); <kbd>?</kbd> lists them.
* Category and image pages inside Lemma, and a trail in the navbar of the articles just read.
* The home page shows today's featured article and picture, what people are reading, and a random article.

**Keeping**

* Save articles, and find them with your reading history in the library (`/library`). Reopening an article returns to where you stopped.
* Cite an article (APA, MLA, Chicago, BibTeX), linked to the exact revision you read; listen to its spoken version where Wikipedia has one; print it.

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
| `/` | Prerendered landing page with search and today's featured articles |
| `/about` | Prerendered |
| `/wiki/[title]` | An article, rendered in the browser (`ssr = false`) |
| `/search` | Full search results, rendered in the browser |
| `/category/[name]` | A category's articles and subcategories, rendered in the browser |
| `/file/[name]` | An image's details and credits, rendered in the browser |
| `/library` | Saved articles and reading history, rendered in the browser |

Article URLs mirror Wikipedia's, e.g. `/wiki/Alan_Turing`. Redirects (`/wiki/Turing`) and differently cased titles are resolved by Wikipedia, and the URL is then rewritten to the canonical title.

### Loading articles

`src/routes/wiki/[title]/+page.ts` starts the request and returns it as a promise, so the reader sees a skeleton immediately. SvelteKit only renders the latest navigation, and a request is aborted if the reader leaves before it finishes. Failures show an in-page error with retry (offline, timeout, missing article, or generic). Back/forward navigation restores the reading position and folded sections via a SvelteKit snapshot.

Getting an article on screen sooner:

* **Opening an article directly**, an inline script in `src/app.html` starts downloading it before the app has loaded (a `<link rel="preload" as="fetch">`), and the app's own request picks that download up. That only works while both ask for exactly the same URL; `wikipedia.test.ts` fails if they drift apart.
* **Links inside an article** preload when pressed, not hovered (`data-sveltekit-preload-data="tap"`): prose is dense with links, and sweeping across it shouldn't download every article. A link preview card that shows after a pause (`LinkPreview.svelte`) preloads its article, so following it is instant. Links elsewhere (results, the library) still preload on hover.
* **Preparing the article** happens in stages (`parseArticleInStages`), giving the browser a turn between them, so the page and the skeleton's animation keep moving. `parseArticle` does the same work in one go, for tests.

### Wikipedia API integration

`src/lib/api/wikipedia.ts` talks to Wikipedia's public APIs:

* **Search suggestions:** `rest.php/v1/search/title`
* **Article content:** `api.php?action=parse&prop=text|langlinks|categories|properties|indicators|revid&redirects=1`, without the edit links and parser report (`disableeditsection`, `disablelimitreport`), and cacheable for five minutes (`maxage`, `smaxage`)
* **Link previews:** `rest_v1/page/summary`
* **Edit activity** (last edited, edits this week): `api.php?action=query&prop=revisions`

Requests carry no custom headers (not even Wikimedia's optional `Api-User-Agent`), so browsers send them without a CORS preflight round trip first. They time out after 15 seconds, and failures are reported as a typed `WikipediaError` (`not_found`, `offline`, `timeout`, `busy`, `http`, `invalid`); requests that hit Wikipedia's rate limit or a gateway hiccup are retried a couple of times first.

### Parsing and the trust boundary

`src/lib/article/parseArticle.ts` turns Wikipedia's HTML into a list of blocks (headings, image groups, paragraphs, lists, tables, quotes, references):

1. The raw HTML is **sanitized with DOMPurify** first. This removes scripts, event handlers, embeds, forms, `<style>` tags, and unsafe URLs. Everything later rendered with `{@html}` comes from this sanitized output.
2. DOMPurify hands back the document it parsed and cleaned (`RETURN_DOM`) rather than a string to parse again. It builds that document with `DOMParser`, so it's inert: no images load and nothing executes while Lemma works on it.
3. The infobox is lifted out, to be shown beside the article. Navboxes, sidebars, maintenance banners, and layout tables are removed; `wikitable` data tables and hatnotes are kept.
4. The back matter is tidied (`backMatter.ts`, `citations.ts`): back-links, archive notes and identifiers become compact links, runs of citations become one marker, and each reference is tagged with its kind of source (`sources.ts`).
5. Links are rewritten (`articleLinks.ts`):
   * Article links stay inside Lemma.
   * Same-page anchors stay local and open folded sections when followed.
   * Non-article namespaces (`File:`, `Category:`, `Help:`, …) and other sites open in a new tab, with `rel="noopener noreferrer"`.
   * Red links become plain text.
6. Every block records which foldable sections contain it, and every element id maps to its block, so collapsing sections and jumping to citations are cheap lookups.

The parser is covered by fixture-based tests in `src/lib/article/*.test.ts`; the rest of `src/lib` has tests beside the code it covers.

### Reader settings

The **Aa** button in the navbar opens the reader settings (`src/components/ReaderSettings.svelte`):

| Setting | Options |
| --- | --- |
| Theme | Auto (follows the device), Light, Sepia, Dark |
| Text size | Five steps, 90% to 132% |
| Font | Mixed (serif headings and titles over sans text), Serif, Sans |
| Line width | Narrow, Normal, Wide |
| Citations | Show (numbers), Subtle (small dots that still open their preview), Hidden |

Like the library, the settings are stored only in the browser (`localStorage`, key `lemma:settings:v1`) and stay in step across tabs. `src/lib/settings.svelte.ts` owns them and applies them as attributes on `<html>`, which `src/app.css` reads:

* `data-theme` is the theme as chosen; `data-scheme` is the resolved `light` or `dark` (Auto follows `prefers-color-scheme` live). Dark-mode styles key off `[data-scheme="dark"]` rather than the media query, so they follow the reader's choice. Sepia overrides the light palette.
* `data-font` sets `--display-font` and `--body-font`; components use those variables rather than naming a typeface.
* `data-citations` restyles the footnote markers in the text (the reference lists are unchanged).
* `data-width` and the `--text-scale` property set the reading measure and root font size. Larger text keeps the column's width on screen and fits fewer words per line.

A small inline script in `src/app.html` applies the stored settings before the first paint, so a dark or sepia page never flashes light. It reads the same key, so keep the two in step when adding a setting.

Larger text or a wider line leaves less margin, so whether the infobox sits in the right margin isn't a fixed breakpoint: `ReaderLayout` measures the margin and exposes the result as `layout.infoboxInMargin` (`src/lib/layout.svelte.ts`) and the `.infobox-in-margin` class.

### Panels and Escape

Panels that open over the page (reader settings, languages, cite, search, the shortcuts sheet, link previews, the image viewer, an expanded gallery, the mobile contents) register with `escapeCloses` (`src/lib/layers.ts`) while they're open. Escape closes only the newest one, so with settings open under search, one press closes search and the next closes settings. A handler that deals with Escape itself first (the search field clearing its text) calls `preventDefault()`, and the layers leave that press alone.

### Accessibility

* **Contrast:** text meets WCAG AA (4.5:1) in all three themes. `--muted`, the secondary text colour, is as light as it can be while still reaching that on every surface it's used on, which is why dark mode mixes in more of the text colour than light and sepia do. Prefer `--muted` to fading it further.
* **Languages:** each language in the languages menu is marked with its language, so screen readers pronounce it and browsers pick the right glyphs. Wikipedia's own edition codes that aren't valid language tags (`simple`, `zh-yue`…) are mapped to standard ones (`src/lib/languageTags.ts`).
* **Keyboard:** controls show a focus indicator. Panels opened from the keyboard take focus and give it back to their button when closed, and the search dialog keeps Tab inside it.
* **Motion:** the motion tokens in `src/app.css` drop to zero under `prefers-reduced-motion`, which turns off every transition and animation built on them.

An automated check (axe-core) of every page and panel, in each theme, finds no issues beyond small link targets inside running text, which WCAG exempts.

## Deployment

Lemma builds to static files with `@sveltejs/adapter-static`, configured in `vite.config.ts`:

* `/` and `/about` are prerendered.
* Every other path is served by the SPA fallback, `build/200.html`.
* Social metadata (Open Graph and Twitter cards) lives in `src/app.html`. It needs an absolute site URL, which comes from `PUBLIC_SITE_URL` (falling back to `http://localhost:4173`).

It's deployed on Cloudflare Workers with static assets. `wrangler.jsonc` points the Worker at `build/`; real files (the prerendered pages, scripts, styles) are served directly, and `cloudflare/worker.js` answers every other path with `200.html`. Build with `bun run build`, deploy with `npx wrangler deploy`, and set `PUBLIC_SITE_URL` in the build variables.

`static/_headers` tells Cloudflare to let browsers cache the built scripts and styles (`/_app/immutable/*`) for a year: their names carry a hash of their contents, so a changed file always has a new name.

Any other static host works the same way, as long as it serves `200.html` for unknown paths (and, ideally, the long cache for `/_app/immutable/`).

> **Why articles don't have per-article link previews:** article pages are rendered in the reader's browser so that Lemma never proxies Wikipedia traffic. Link-preview crawlers don't run JavaScript, so every page shares the generic Lemma card. Server-rendering articles would fix the previews, but it would route reading activity through a server.

To create and preview a production build:

```bash
bun run build
bun run preview
```
