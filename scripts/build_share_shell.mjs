#!/usr/bin/env node
// build_share_shell.mjs — emit the SHARE-LINK static shell (`source/public/l.html`) plus the
// ordinal→name manifest the Cloudflare Function needs (`source/public/l-manifest.json`), then
// GATE that /l never leaked into anything a crawler reads.
//
// Why a shell at all, and why derived from the BUILT index.html rather than string-built:
//   · Rung 3 of the degradation ladder — the one that matters — is "the whole experience works
//     with NO Function deployed". `_redirects` rewrites `/l/* -> /l.html 200`, the shell boots
//     the ordinary Neural app, and the app decodes the code from `location.pathname`
//     client-side (app.src.jsx `_openSharedListFromUrl`). No Function, no server state.
//   · The Function (functions/l/[[path]].js) transforms THIS SAME file with HTMLRewriter, so
//     there is one source of truth for the page and the Function only ever adds the social
//     preview. String-building a second HTML document would drift from the real site's head,
//     scripts and fallback content within a release.
//
// Deploy path (this is the trap that eats features in this repo): the deploy workflows do NOT
// run root `npm run build`; they re-list the steps inline. So this script is wired into BOTH
// deploy workflows explicitly, not only into the root build script.
//
// Run: node scripts/build_share_shell.mjs   (after quartz build + regenerate_llms_txt.py)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const PUBLIC = resolve(ROOT, "source/public");
const INDEX = resolve(PUBLIC, "index.html");
const SHELL = resolve(PUBLIC, "l.html");
const MANIFEST = resolve(PUBLIC, "l-manifest.json");
const GRAPH_DATA = resolve(PUBLIC, "static/neural/graph-data.json");
const SITEMAP = resolve(PUBLIC, "sitemap.xml");
const LLMS = resolve(PUBLIC, "llms.txt");

const die = (msg) => {
  console.error("[share-shell] ERROR: " + msg);
  process.exit(1);
};

if (!existsSync(INDEX)) die(`${INDEX} not found — run the Quartz build first.`);

let html = readFileSync(INDEX, "utf8");

// ── 1. <base href="/"> ─────────────────────────────────────────────────────────────────────
// Quartz emits RELATIVE asset URLs ("../index.css", "../prescript.js"). Served at /l/<code>
// those happen to resolve, but at /l/<code>/ (a trailing slash, which link previews and chat
// clients DO add) they resolve to /l/index.css and the page ships with no CSS and no app.
// A <base> as the first thing in <head> makes every relative URL root-relative, whatever the
// request path was.
// Inserted AFTER <meta charset> on purpose: a charset declaration must land in the first
// 1024 bytes AND before content that needs decoding, or the browser restarts the parse.
const CHARSET = '<meta charset="utf-8"/>';
if (!html.includes(CHARSET))
  die("index.html has no <meta charset> — refusing to guess.");
html = html.replace(
  CHARSET,
  CHARSET + '<base href="/"/><meta name="robots" content="noindex,nofollow"/>',
);

// ── 2. identity: this is not a page, it is a link target ───────────────────────────────────
const TITLE = "Shared technique list · BJJGraph";
if (!/<title>[^<]*<\/title>/.test(html)) die("index.html has no <title>.");
html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`);

// (noindex,nofollow went in beside <base> above — a share URL is not content. It is asserted
// from the SERVED bytes by the e2e SEO journey, so losing it goes red.)
if (!/name="robots"[^>]*noindex/.test(html))
  die("the shell lost its noindex meta.");

// canonicalise to the site root, never to itself
html = html.replace(
  /<link rel="canonical" href="[^"]*"\/>/,
  '<link rel="canonical" href="https://bjjgraph.org/"/>',
);

// ── 3. og/twitter placeholders, MARKED for the Function ────────────────────────────────────
// data-share-og="<field>" is the contract between this file and functions/l/[[path]].js:
// HTMLRewriter matches `meta[data-share-og]` and replaces the content per field. The values
// below are what a link preview shows when the Function is absent — generic but never wrong.
const OG_TITLE = "A shared technique list · BJJGraph";
const OG_DESC =
  "Techniques from a class, on the BJJ knowledge graph — open the link to see them lit up and drill them.";
const ogRewrites = [
  [
    /<meta property="og:title" content="[^"]*"\/>/,
    `<meta property="og:title" content="${OG_TITLE}" data-share-og="title"/>`,
  ],
  [
    /<meta property="og:description" content="[^"]*"\/>/,
    `<meta property="og:description" content="${OG_DESC}" data-share-og="description"/>`,
  ],
  [
    /<meta property="og:url" content="[^"]*"\/>/,
    `<meta property="og:url" content="https://bjjgraph.org/l/" data-share-og="url"/>`,
  ],
  [
    /<meta property="og:type" content="[^"]*"\/>/,
    '<meta property="og:type" content="website"/>',
  ],
  [
    /<meta name="twitter:title" content="[^"]*"\/>/,
    `<meta name="twitter:title" content="${OG_TITLE}" data-share-og="title"/>`,
  ],
  [
    /<meta name="twitter:description" content="[^"]*"\/>/,
    `<meta name="twitter:description" content="${OG_DESC}" data-share-og="description"/>`,
  ],
  [
    /<meta name="description" content="[^"]*"\/>/,
    `<meta name="description" content="${OG_DESC}"/>`,
  ],
];
for (const [re, replacement] of ogRewrites) {
  if (!re.test(html))
    die(`index.html no longer contains ${re} — the shell's og contract broke.`);
  html = html.replace(re, replacement);
}
// article:* timestamps are meaningless for a link target and confuse previews
html = html.replace(
  /<meta property="article:(published|modified)_time" content="[^"]*"\/>/g,
  "",
);

if ((html.match(/data-share-og="/g) || []).length < 4)
  die("og markers were not written.");
writeFileSync(SHELL, html);

// ── 4. ordinal → technique name, for the Function's preview text ───────────────────────────
// The recipient's BROWSER needs no manifest (graph-data.json carries `o` per node), but the
// Function has no browser: WhatsApp/Telegram/X fetch the URL server-side and never run JS, so
// the names can only reach a preview from the edge. Small, flat, and cached at the edge.
if (!existsSync(GRAPH_DATA))
  die(`${GRAPH_DATA} not found — run \`npm run regenerate:neural\`.`);
const graph = JSON.parse(readFileSync(GRAPH_DATA, "utf8"));
const names = {};
let missing = 0;
for (const n of graph.nodes || []) {
  if (typeof n.o !== "number") {
    missing++;
    continue;
  }
  names[String(n.o)] = String(n.t || n.id);
}
if (missing)
  die(
    `${missing} graph node(s) carry no ordinal — the lockfile gate should have caught this.`,
  );
const count = Object.keys(names).length;
if (count < 1000)
  die(
    `only ${count} ordinals in the manifest — that cannot be the real graph.`,
  );
writeFileSync(MANIFEST, JSON.stringify({ v: 1, names }));

// ── 5. GATE: /l is not content ─────────────────────────────────────────────────────────────
// A share URL must appear in NEITHER the sitemap NOR llms.txt. This is checked here, in the
// build, because both files are generated and either one could start including l.html the day
// somebody teaches an emitter to walk source/public.
const leaks = [];
if (existsSync(SITEMAP)) {
  const locs = [
    ...readFileSync(SITEMAP, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g),
  ].map((m) => m[1]);
  if (locs.length < 1000)
    die(`sitemap.xml has only ${locs.length} URLs — build looks incomplete.`);
  for (const u of locs) {
    const path = u.replace(/^https?:\/\/[^/]+/, "");
    if (/^\/l(\.html|\/|$)/.test(path) || /^\/l-manifest\.json$/.test(path))
      leaks.push(`sitemap: ${u}`);
  }
} else {
  die("sitemap.xml not found — cannot prove /l stays out of it.");
}
if (existsSync(LLMS)) {
  const llms = readFileSync(LLMS, "utf8");
  const hits = llms.match(
    /\/l\.html|\/l-manifest\.json|https?:\/\/[^\s)]*\/l\/|\]\(\/l\//g,
  );
  if (hits) leaks.push(`llms.txt: ${[...new Set(hits)].join(", ")}`);
} else {
  die("llms.txt not found — cannot prove /l stays out of it.");
}
if (leaks.length)
  die("a share URL leaked into a crawler surface:\n  " + leaks.join("\n  "));

console.log(
  `[share-shell] wrote l.html (${(html.length / 1024).toFixed(1)} KB, noindex) + l-manifest.json ` +
    `(${count} ordinals) · /l absent from sitemap.xml and llms.txt`,
);
