import type { PageLoad } from "./$types";

// Fetched from Wikipedia in the reader's browser, like articles.
export const ssr = false;
export const prerender = false;

export const load: PageLoad = ({ params }) => ({ name: params.name.replaceAll("_", " ") });
