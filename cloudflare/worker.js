// Runs only for paths that aren't a file in ./build (articles, search, the library…): those are routes the app renders
// in the browser, so answer with the SPA shell. "/200" rather than "/200.html": Cloudflare serves 200.html for it
// directly, where "/200.html" would be redirected to "/200" (its extensionless form).
export default {
  async fetch(request, env) {
    const shell = new URL("/200", request.url);
    const response = await env.ASSETS.fetch(new Request(shell, request));
    // keep the shell's body and headers, but it stands in for the page the reader asked for
    return new Response(response.body, { status: 200, headers: response.headers });
  },
};
