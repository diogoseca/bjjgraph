/**
 * SPIKE (v1.77.0, temporary — delete once the answer is recorded).
 *
 * ONE question: does `wrangler pages deploy source/public` pick up a `functions/`
 * directory at the REPO ROOT?
 *
 * Why it matters: the shareable-lists feature wants a Pages Function at
 * `functions/l/[[path]].ts` to render dynamic Open Graph tags, because WhatsApp,
 * Telegram and X fetch a shared link server-side and never run JavaScript — a purely
 * static site can only ever give them a generic preview. Wrangler's source at the
 * pinned 3.90.0 resolves the directory as `join(cwd(), "functions")`, and the deploy
 * step sets no `workingDirectory`, so cwd should be the repo root. But wrangler is
 * installed nowhere in this repo, so that reading is unverified — and the failure mode
 * is SILENT: a `functions/` dir in the wrong place is simply never built, with no
 * warning, and the feature would appear to work locally and 404 in production.
 *
 * It must NOT live in `source/public/functions/` — triple-dead there: Quartz's build
 * rimrafs `source/public/*`, wrangler looks in cwd instead, and Pages' asset uploader
 * excludes a `functions` directory from the upload.
 *
 * Verdict:
 *   curl -s https://<dev-preview>.pages.dev/ping
 *     → this JSON        = repo-root functions/ works. Build the Function tier.
 *     → 404 / index HTML = it does not. Drop the Function, `_manifest.json`,
 *                          `build_share_shell.mjs` and its test harness (~400 lines)
 *                          and ship the static-shell + client-decode fallback, which
 *                          delivers the same in-app experience and only loses the
 *                          dynamic social preview.
 *
 * Deliberately plain .js: no @cloudflare/workers-types dependency, so a failure can
 * only mean "wrong placement" and never "TypeScript/type resolution".
 */
export function onRequest(context) {
  return new Response(
    JSON.stringify(
      {
        spike: "pages-functions-at-repo-root",
        verdict: "repo-root functions/ IS picked up by `wrangler pages deploy source/public`",
        path: new URL(context.request.url).pathname,
        version: "1.77.0",
      },
      null,
      1,
    ),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        // never let a CDN memoise a spike answer
        "cache-control": "no-store",
      },
    },
  );
}
