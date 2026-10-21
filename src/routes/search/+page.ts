import type { PageLoad } from "./$types";

// Results come straight from Wikipedia in the reader's browser, like articles.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = ({ url }) => ({ query: url.searchParams.get("q")?.trim() ?? "" });
