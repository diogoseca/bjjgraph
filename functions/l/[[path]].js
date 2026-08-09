/**
 * /l/<code> — the share-link edge tier (Cloudflare Pages Function).
 *
 * THIS TIER IS OPTIONAL BY DESIGN. Everything a recipient actually does — the lit graph, the
 * named list, drilling the class — happens in the browser off the plain static shell, reached
 * by the `/l/* /l.html 200` rewrite in `_redirects`. If this file never builds, never deploys,
 * or throws, the feature still works and only the social preview degrades to generic text.
 * e2e/journeys/share-lists.spec.ts tests that rung explicitly, with no Function in the path.
 *
 * What this tier adds, and the only thing it adds: WhatsApp, Telegram, X and Slack fetch a
 * shared URL SERVER-SIDE and never run JavaScript. So "these are the techniques we learned in
 * today's class" can only reach the group-chat preview from the edge. Here we decode the code,
 * look the names up in the emitted ordinal manifest, and write them into og:title /
 * og:description.
 *
 * Two placement facts this file depends on (both verified in this repo, the hard way):
 *   · A `functions/` directory at the REPO ROOT *is* picked up by
 *     `wrangler pages deploy source/public` — proven live by functions/ping.js.
 *   · It must NOT live in `source/public/functions/`: Quartz's build rimrafs source/public,
 *     wrangler resolves `functions` from cwd, and Pages' uploader excludes a `functions`
 *     directory from the asset upload. Three silent deaths, no warning.
 *
 * Plain .js (like ping.js), not .ts: this repo has no @cloudflare/workers-types, and the pure
 * helpers are imported by `node --test` (tests/share_lists_store.test.mjs) from the SAME source
 * the browser bundle uses — one codec, one og-text implementation, no drift.
 */

import { ngListDecodeOrdinals } from "../../neural/src/lists-codec.src.js";
import {
  ngListParseSharePath,
  ngShareOgTitle,
  ngShareOgDescription,
} from "../../neural/src/lists.src.js";

const SHELL_PATH = "/l.html";
const MANIFEST_PATH = "/l-manifest.json";

/** Rewrite the marked <meta> tags. `data-share-og="<field>"` is written by
 *  scripts/build_share_shell.mjs — that attribute IS the contract between the two files. */
class OgMeta {
  constructor(values) {
    this.values = values;
  }
  element(el) {
    const field = el.getAttribute("data-share-og");
    const value = field ? this.values[field] : null;
    // setAttribute escapes on its own — the helpers deliberately return plain, unescaped text
    if (value) el.setAttribute("content", value);
  }
}

class TitleText {
  constructor(title) {
    this.title = title;
  }
  element(el) {
    el.setInnerContent(this.title);
  }
}

/** A marker so a human (and the e2e suite) can tell an edge-rendered response from the plain
 *  shell at a glance: `document.documentElement.dataset.shareOg`. */
class HtmlMarker {
  element(el) {
    el.setAttribute("data-share-og", "1");
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // The shell is the one source of truth for the page. Fetch it by its own path so this never
  // depends on how the rewrite is configured.
  let shell;
  try {
    shell = await env.ASSETS.fetch(new URL(SHELL_PATH, url));
  } catch (e) {
    shell = null;
  }
  if (!shell || !shell.ok) {
    // No shell in this deployment: hand the request back to the static layer rather than
    // inventing a page. Worst case the visitor gets the 404, which is honest.
    return env.ASSETS.fetch(request);
  }

  const code = ngListParseSharePath(url.pathname + url.search);
  const decoded = code ? ngListDecodeOrdinals(code) : { ok: false };
  if (!decoded.ok) return withHeaders(shell, code ? "invalid" : "none");

  // ordinal -> technique name (emitted by scripts/build_share_shell.mjs). Optional: without it
  // the preview stays generic, which is exactly the no-Function behaviour.
  let names = null;
  try {
    const res = await env.ASSETS.fetch(new URL(MANIFEST_PATH, url));
    if (res && res.ok) {
      const json = await res.json();
      names = json && json.names ? json.names : null;
    }
  } catch (e) {
    names = null;
  }
  if (!names) return withHeaders(shell, "no-manifest");

  const resolved = [];
  for (const o of decoded.ordinals) {
    const name = names[String(o)];
    if (typeof name === "string" && name) resolved.push(name);
  }
  if (!resolved.length) return withHeaders(shell, "unresolved");

  const values = {
    title: ngShareOgTitle(resolved, decoded.ordinals.length),
    description: ngShareOgDescription(resolved, decoded.ordinals.length),
    url: url.origin + "/l/" + code,
  };
  const out = new HTMLRewriter()
    .on("html", new HtmlMarker())
    .on("title", new TitleText(values.title))
    .on("meta[data-share-og]", new OgMeta(values))
    .transform(shell);
  return withHeaders(out, "ok", resolved.length);
}

function withHeaders(res, state, count) {
  const headers = new Headers(res.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  // A code deterministically names one set of techniques, so this is highly cacheable; the
  // short browser max-age keeps a deploy propagating fast.
  headers.set("cache-control", "public, max-age=300, s-maxage=86400");
  // Belt AND braces with the shell's <meta name="robots">: a share URL is never content.
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.set("x-share-og", count ? state + ":" + count : state);
  return new Response(res.body, { status: 200, headers: headers });
}
