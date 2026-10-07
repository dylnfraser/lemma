# lemma

Lemma is a lightweight, distraction-free Wikipedia client built with SvelteKit. It strips out Wikipedia's default interface clutter to deliver a clean reading experience with customizable typography, article metrics, and streamlined navigation.

All requests are handled directly on the client side without intermediate proxies, tracking, or API keys.

## Tech Stack

* **Framework:** [SvelteKit](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev/)
* **Build Tool:** [Vite](https://vite.dev/)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Package Manager / Runtime:** [Bun](https://bun.sh/)

## Getting Started

1. Install dependencies:
```bash
bun install

```


2. Start the development server:
```bash
bun run dev

```


3. Open the local server URL provided in the console (typically `http://localhost:5173`). To launch the app in your browser automatically upon start:
```bash
bun run dev --open

```



## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Starts the Vite development server |
| `bun run build` | Builds the application for production |
| `bun run preview` | Previews the production build locally |
| `bun run check` | Runs SvelteKit type checks (`svelte-check`) |
| `bun run check:watch` | Runs type checks in watch mode |

## How It Works

### Routing & Article Fetching

Articles are served via the dynamic route `/wiki/[title]`. For example:

* `/wiki/MacOS`
* `/wiki/Alan_Turing`
* `/wiki/Svelte`

When a user visits a route, Lemma fetches the raw article data, strips non-essential elements (like boilerplate templates and sidebars), and formats the body for optimal reading width.

### Wikipedia API Integration

Lemma makes direct client-side requests to Wikipedia's public Action API:

* **Search:** `action=query&list=search`
* **Article Parsing:** `action=parse&prop=text`

The request implementation lives in `src/lib/api/wikipedia.ts`, utilizing schemas defined in `src/lib/api/schemas.ts`. URL-safe parameter encoding is handled via `encodeSchemaURL`.

## Deployment

This project uses `@sveltejs/adapter-auto`. It auto-detects common hosting platforms (Vercel, Netlify, Cloudflare Pages, etc.) during build. If targeting a specialized environment, replace `@sveltejs/adapter-auto` in `svelte.config.js` with the corresponding adapter package.

To create and preview a production build:

```bash
bun run build
bun run preview
```
