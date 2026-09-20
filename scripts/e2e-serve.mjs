#!/usr/bin/env node
// The e2e harness's static server. Drop-in for `npx serve <root> -l <port>`, with ONE
// behavioural difference: a BARE route that names a page emitted BOTH ways resolves to the
// FLAT file, the way production does.
//
// WHY THIS FILE EXISTS
// --------------------
// 1,518 of the site's pages are emitted twice — `X.html` AND `X/index.html`. The two are not
// copies: the folder one is a strictly degraded clone, 6–25 KB smaller, and 1,506 of them carry
// no `#page-graph-data` block at all. Production (Cloudflare Pages) resolves them by URL FORM,
// measured 2026-09-20 with read-only curls against bjjgraph.org:
//
//      bare  /Positions/Mount    -> Positions/Mount.html         (data-slug="Positions/Mount")
//      slash /Positions/Mount/   -> Positions/Mount/index.html   (data-slug="Positions/Mount/index")
//
// `serve` resolves BOTH to the folder copy, and its stock `cleanUrls` 301s `/X.html` back to the
// bare form — so under the harness the flat document was unreachable at EVERY url, not merely
// tested at the wrong one. Re-derived from the tree at v1.195.0: 21 navigation sites across
// eleven spec files fetch one of NINE duplicated routes bare, nine of those tests @curated.
//
// `scripts/dev-serve.mjs` is NOT the fix and must not be cited as one: its `resolveHtml()`
// does implement production's rule, but its only call site
// is inside the paired-debug branch, so the ordinary path is `serveHandler(...)` — the same
// library, the same answer as `serve`. Verifying that code SAYS the right thing is not verifying
// that it RUNS (CLAUDE.md 6.8).
//
// WHAT IT DOES, AND WHAT IT DELIBERATELY DOES NOT
// ----------------------------------------------
// The table is DERIVED from the tree about to be served, at startup, never authored — so it
// cannot go stale against a content change, and the count is printed every run (CLAUDE.md 6.6:
// a rule that matched nothing must not read like a clean one). A route with no entry is served
// by exactly the code that serves it today, so this change affects only what it names.
//
// The rewrite is armed per request against the EXACT path, which is why `/X/` still gets the
// folder copy: a `rewrites: [{source: "/X"}]` table handed to serve-handler wholesale also
// catches `/X/` (path-to-regexp treats the trailing slash as optional), which would serve the
// flat file where production serves the folder one. Arming one exact rule avoids that, and it is
// also why this costs nothing: the whole-table form compiles 1,518 patterns on EVERY request,
// measured at +12ms each (p50 3.1ms -> 15.3ms for neural.js, interleaved) — a tax on a 20-minute gate.
//
// Everything else is serve's own request handler, verbatim (node_modules/serve/build/main.js):
// `compress(req, res)` then `handler(req, res, config)` with `etag: true`. Byte-for-byte parity
// matters here — `payload-first-hand.spec.ts` weighs the boot.
import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import serveHandler from "serve-handler"
import compression from "compression"

const compress = promisify(compression())

const argv = process.argv.slice(2)
let root = null
let port = 3000
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === "-l" || a === "--listen") port = Number(argv[++i])
  else if (a.startsWith("-")) continue // --no-clipboard etc: accepted and ignored, for drop-in use
  else if (root === null) root = a
}
if (!root) {
  console.error("[e2e-serve] usage: node scripts/e2e-serve.mjs <root> -l <port>")
  process.exit(1)
}
const ROOT = path.resolve(root)

/** Every route the build emits BOTH ways, mapped bare -> flat. Derived, never authored. */
function duplicateRoutes(dir) {
  const map = new Map()
  let htmlCount = 0
  const walk = (abs, rel) => {
    let entries
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = path.join(abs, e.name)
      const r = rel ? `${rel}/${e.name}` : e.name
      // A Dirent for a SYMLINK is neither isFile() nor isDirectory(), and a herdr worktree
      // shadows source/public with an entry-per-symlink tree — so a walk that trusts the Dirent
      // finds zero html there and this server refuses to start. statSync follows the link;
      // lstatSync would not. (Whether the linked file is then SERVED is serve-handler's
      // `symlinks` option, which comes from serve.json above, exactly as under `serve`.)
      let isDir = e.isDirectory()
      let isFile = e.isFile()
      if (e.isSymbolicLink()) {
        try {
          const st = fs.statSync(p)
          isDir = st.isDirectory()
          isFile = st.isFile()
        } catch {
          continue // a dangling link is not a page
        }
      }
      if (isDir) walk(p, r)
      else if (isFile && e.name.endsWith(".html")) {
        htmlCount++
        if (e.name === "index.html") continue
        const stem = r.slice(0, -5)
        if (fs.existsSync(path.join(dir, stem, "index.html"))) map.set(`/${stem}`, `/${stem}.html`)
      }
    }
  }
  walk(dir, "")
  return { map, htmlCount }
}

if (!fs.existsSync(ROOT)) {
  console.error(`[e2e-serve] ${ROOT} does not exist — run \`npm run build\` first.`)
  process.exit(1)
}
const { map: DUPES, htmlCount } = duplicateRoutes(ROOT)
if (htmlCount === 0) {
  console.error(`[e2e-serve] ${ROOT} contains no HTML — refusing to serve an empty tree.`)
  process.exit(1)
}
// The positive coverage count, printed every run. Zero is legal (it is what deleting the folder
// duplicates would produce) but it is never silent: the gate that pins this lives in
// e2e/journeys/harness-resolution.spec.ts and fails loudly rather than passing vacuously.
console.log(
  `[e2e-serve] http://localhost:${port} — ${htmlCount} html files, ` +
    `flat-first rewrites armed for ${DUPES.size} duplicated routes`,
)

// `serve` reads `serve.json` from the directory it serves, and the worktree recipe depends on it:
// a herdr worktree shadows `source/public` with symlinked entries and needs `{"symlinks": true}`,
// without which serve-handler 404s every one of them. Ignoring the file would have made this
// server a drop-in everywhere except the setup that most needs it. `rewrites` is ours — if a
// serve.json carries its own, say so rather than silently dropping either.
let fileConfig = {}
const CONFIG_FILE = path.join(ROOT, "serve.json")
if (fs.existsSync(CONFIG_FILE)) {
  try {
    fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"))
    if (fileConfig.rewrites?.length) {
      console.warn(
        `[e2e-serve] ${CONFIG_FILE} declares ${fileConfig.rewrites.length} rewrites — IGNORED. ` +
          `This server derives its own flat-first table from the tree.`,
      )
    }
    delete fileConfig.rewrites
    delete fileConfig.public
    console.log(`[e2e-serve] merged ${CONFIG_FILE}: ${Object.keys(fileConfig).join(", ") || "(empty)"}`)
  } catch (e) {
    console.error(`[e2e-serve] ${CONFIG_FILE} is not readable JSON: ${e?.message ?? e}`)
    process.exit(1)
  }
}
const CONFIG = { ...fileConfig, public: ROOT, etag: fileConfig.etag ?? true }

http
  .createServer(async (req, res) => {
    const reqPath = decodeURIComponent((req.url ?? "/").split("?")[0])
    const flat = DUPES.get(reqPath)
    // serve-handler applies `rewrites` after its cleanUrls redirect check and only when the
    // requested path is not itself a file — which is precisely the bare-route case.
    const rewrites = flat ? [{ source: reqPath, destination: flat }] : []
    try {
      await compress(req, res)
      await serveHandler(req, res, { ...CONFIG, rewrites })
    } catch (e) {
      if (!res.headersSent) res.writeHead(500)
      res.end(String(e?.message ?? e))
    }
  })
  .listen(port, () => {})
  .on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.error(`[e2e-serve] port ${port} is already in use — a previous run leaked a server.`)
      process.exit(1)
    }
    throw e
  })
