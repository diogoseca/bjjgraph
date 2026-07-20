#!/usr/bin/env node
// Local dev server (replaces `npx serve -l 8080 source/public`).
//
// Serves the built site exactly like `npx serve` did — via serve-handler, the same library the
// serve CLI wraps — and adds two loopback-only dev routes powering the snapshot button:
//
//   GET  /__snapshot/ping  -> 204. The button probes this and never renders if it fails, so the
//                             button cannot appear against prod, plain `npx serve`, or the e2e
//                             fixture server on :8123.
//   POST /__snapshot       -> writes a {json,png} pair into tests/artifacts/snapshots/ (gitignored)
//                             and answers with a one-line <snapshot /> reference to paste into
//                             Claude Code (repo-relative paths, so its Read tool resolves them).
//
// Write scope is deliberately narrow: the destination directory is hardcoded, filenames are
// generated server-side from a sanitized slug (the client never supplies a path), and both dev
// routes reject non-loopback callers. Static serving stays open on all interfaces for parity with
// `npx serve` (LAN testing from a phone), but such clients cannot write.
//
// See CLAUDE.md "Dev Snapshots" for the <snapshot /> convention.
//
// PAIRED-DEBUG BRIDGE (see .claude/skills/paired-debugging/SKILL.md): when a session file
// exists at e2e/paired/.session/bridge-token, served HTML gets a <script> appended that
// connects the page back here over SSE — letting Claude drive the owner's OWN tab (click,
// navigate, seed storage, call window.__neural.*, eval) while the owner watches live from
// another machine (bjjgraph:8080). Trust model mirrors the snapshot routes: command INGRESS
// (/__paired/cmd) and result reads are loopback-only (only Claude can drive); the page-side
// legs (/__paired/events, /__paired/result) are token-gated and LAN-reachable because the
// owner's browser is on another machine. No session file -> every route 404s and HTML is
// served byte-identical to plain serve. Every executed command is journaled to
// e2e/paired/journals/<session>.jsonl for later translation into e2e specs.

import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import serveHandler from "serve-handler"

// Resolve from this file's location, never process.cwd() — `npm run serve` runs at the repo root
// but nothing guarantees that for other callers.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const STATIC_ROOT = path.join(REPO_ROOT, "source", "public")
const SNAP_REL = path.join("tests", "artifacts", "snapshots")
const SNAP_DIR = path.join(REPO_ROOT, SNAP_REL)
const PORT = Number(process.env.PORT || 8080)
const MAX_BODY = 64 * 1024 * 1024 // ~4K tab capture in base64, with 5x headroom
const PNG_PREFIX = /^data:image\/png;base64,/

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"])
const isLoopback = (req) => LOOPBACK.has(req.socket.remoteAddress ?? "")

function git(args) {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim()
  } catch {
    return null
  }
}

// Recomputed per capture: the dirty flag and HEAD both move during a session.
function buildInfo() {
  let version = null
  try {
    version = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).version
  } catch {
    /* unreadable package.json — leave null */
  }
  const status = git(["status", "--porcelain"])
  return {
    version,
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    sha: git(["rev-parse", "--short", "HEAD"]),
    dirty: status === null ? null : status.length > 0,
  }
}

function stamp(d) {
  const p = (n) => String(n).padStart(2, "0")
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  )
}

const sanitizeSlug = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "page"

function uniqueBase(dir, base) {
  const taken = (b) => fs.existsSync(path.join(dir, `${b}.json`)) || fs.existsSync(path.join(dir, `${b}.png`))
  if (!taken(base)) return base
  for (let i = 2; i < 100; i++) {
    if (!taken(`${base}-${i}`)) return `${base}-${i}`
  }
  return `${base}-${Date.now()}`
}

const escapeAttr = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    req.on("data", (c) => {
      if (settled) return
      size += c.length
      if (size > MAX_BODY) {
        settled = true
        const err = new Error("payload too large")
        err.statusCode = 413
        // Pause rather than destroy: the socket must stay alive long enough to answer 413
        // (a destroyed request leaves the client with no response at all). sendJson closes it.
        req.pause()
        reject(err)
        return
      }
      chunks.push(c)
    })
    req.on("end", () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks).toString("utf8"))
    })
    req.on("error", (e) => {
      if (settled) return
      settled = true
      reject(e)
    })
  })
}

const sendJson = (res, code, payload) => {
  if (res.writableEnded) return
  // Close the connection explicitly: on the 413 path the client may still be uploading, and
  // without this the response can sit behind an unread request body.
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", connection: "close" })
  res.end(JSON.stringify(payload))
}

async function handleSnapshot(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "POST only" })

  const raw = await readBody(req)
  let body
  try {
    body = JSON.parse(raw)
  } catch {
    return sendJson(res, 400, { ok: false, error: "body must be JSON" })
  }

  const now = new Date()
  const meta = {
    ...buildInfo(),
    capturedAt: now.toISOString(),
    slug: typeof body.slug === "string" ? body.slug : null,
    variant: typeof body.variant === "string" ? body.variant : null,
  }

  fs.mkdirSync(SNAP_DIR, { recursive: true })
  const base = uniqueBase(SNAP_DIR, `${stamp(now)}-${sanitizeSlug(body.slug)}`)

  const hasPng = typeof body.png === "string" && PNG_PREFIX.test(body.png)
  const jsonRel = path.posix.join(SNAP_REL.split(path.sep).join("/"), `${base}.json`)
  const pngRel = hasPng ? path.posix.join(SNAP_REL.split(path.sep).join("/"), `${base}.png`) : null

  try {
    if (hasPng) {
      fs.writeFileSync(
        path.join(SNAP_DIR, `${base}.png`),
        Buffer.from(body.png.replace(PNG_PREFIX, ""), "base64"),
      )
    }
    fs.writeFileSync(
      path.join(SNAP_DIR, `${base}.json`),
      JSON.stringify({ meta: { ...meta, png: pngRel }, state: body.state ?? null }, null, 2),
    )
  } catch (e) {
    console.error("[snapshot] write failed:", e)
    return sendJson(res, 500, { ok: false, error: String(e?.message ?? e) })
  }

  const attrs = [
    `slug="${escapeAttr(meta.slug ?? "")}"`,
    `variant="${escapeAttr(meta.variant ?? "")}"`,
    `t="${meta.capturedAt}"`,
    `json="${jsonRel}"`,
    ...(pngRel ? [`png="${pngRel}"`] : []),
  ]
  const line = `<snapshot ${attrs.join(" ")} />`

  // The terminal running `npm run dev` doubles as a copy source when the clipboard is unavailable.
  console.log(line)
  sendJson(res, 200, { ok: true, line, json: jsonRel, png: pngRel })
}

// ── paired-debug bridge ─────────────────────────────────────────────────────────────────
const PAIRED_DIR = path.join(REPO_ROOT, "e2e", "paired")
const PAIRED_TOKEN_FILE = path.join(PAIRED_DIR, ".session", "bridge-token")
const PAIRED_JOURNALS = path.join(PAIRED_DIR, "journals")

// token cache: per-request fs hits are fine locally, but cache 2s to keep HTML serving cheap
let _tok = { v: null, at: 0 }
function pairedToken() {
  const now = Date.now()
  if (now - _tok.at > 2000) {
    let v = null
    try {
      v = fs.readFileSync(PAIRED_TOKEN_FILE, "utf8").trim() || null
    } catch {
      v = null
    }
    _tok = { v, at: now }
  }
  return _tok.v
}

const paired = {
  seq: 0,
  queue: [], // commands not yet delivered to a page
  results: [], // executed-command results (ring, newest last)
  clients: new Set(), // live SSE responses
  session: null, // journal basename for the active session
}

function pairedJournal(entry) {
  try {
    fs.mkdirSync(PAIRED_JOURNALS, { recursive: true })
    const name = paired.session ?? `session-${stamp(new Date())}`
    paired.session = name
    fs.appendFileSync(path.join(PAIRED_JOURNALS, `${name}.jsonl`), JSON.stringify(entry) + "\n")
  } catch (e) {
    console.error("[paired] journal write failed:", e)
  }
}

function pairedPush(cmd) {
  const wire = `data: ${JSON.stringify(cmd)}\n\n`
  for (const c of paired.clients) {
    try {
      c.write(wire)
    } catch {
      paired.clients.delete(c)
    }
  }
}

async function handlePaired(req, res, route, query) {
  const token = pairedToken()
  if (!token) return sendJson(res, 404, { ok: false, error: "no paired session" })
  const q = new URLSearchParams(query ?? "")

  if (route === "/__paired/ping") {
    res.writeHead(204)
    return res.end()
  }
  if (route === "/__paired/client.js") {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" })
    return res.end(PAIRED_CLIENT_JS)
  }
  if (route === "/__paired/events") {
    if (q.get("t") !== token) return sendJson(res, 403, { ok: false, error: "bad token" })
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
    })
    res.write(`data: ${JSON.stringify({ kind: "hello" })}\n\n`)
    for (const cmd of paired.queue.splice(0)) res.write(`data: ${JSON.stringify(cmd)}\n\n`)
    paired.clients.add(res)
    req.on("close", () => paired.clients.delete(res))
    return
  }
  if (route === "/__paired/result") {
    if (q.get("t") !== token) return sendJson(res, 403, { ok: false, error: "bad token" })
    const body = JSON.parse(await readBody(req))
    const entry = { ...body, at: new Date().toISOString() }
    paired.results.push(entry)
    if (paired.results.length > 500) paired.results.splice(0, paired.results.length - 500)
    pairedJournal({ kind: "result", ...entry })
    return sendJson(res, 200, { ok: true })
  }

  // Claude-side routes: loopback only (only the local agent may drive or read)
  if (!isLoopback(req)) return sendJson(res, 403, { ok: false, error: "loopback only" })
  if (route === "/__paired/cmd") {
    const body = JSON.parse(await readBody(req))
    const cmd = { kind: "cmd", id: ++paired.seq, ...body }
    pairedJournal({ ...cmd, at: new Date().toISOString() })
    if (paired.clients.size) pairedPush(cmd)
    else paired.queue.push(cmd)
    return sendJson(res, 200, { ok: true, id: cmd.id, connected: paired.clients.size })
  }
  if (route === "/__paired/results") {
    const since = Number(q.get("since") ?? 0)
    return sendJson(res, 200, {
      ok: true,
      connected: paired.clients.size,
      results: paired.results.filter((r) => Number(r.id ?? 0) > since),
    })
  }
  return sendJson(res, 404, { ok: false, error: "unknown paired route" })
}

// Page-side client (served, never built into the site). Executes commands in the owner's tab
// and posts results back. Command kinds: goto | click | type | press-key(dispatch) | eval |
// seed (localStorage) | neural (call window.__neural method) | read (eval + return value) |
// shot (page state summary). `eval` is a dev tool by design — ingress is loopback-only.
const PAIRED_CLIENT_JS = `(() => {
  if (window.__pairedActive) return; window.__pairedActive = true;
  const T = (document.currentScript && new URL(document.currentScript.src, location.href).searchParams.get("t")) || "";
  if (!T) return;
  const errs = [];
  window.addEventListener("error", (e) => { errs.push(String(e.message)); if (errs.length > 50) errs.shift(); });
  const post = (payload) => fetch("/__paired/result?t=" + encodeURIComponent(T), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(payload), keepalive: true }).catch(() => {});
  const summary = () => ({ url: location.pathname + location.hash, title: document.title,
    neural: !!window.__neural, errors: errs.slice(-5) });
  const run = async (c) => {
    try {
      if (c.kind !== "cmd") return;
      let value = null;
      if (c.op === "goto") { post({ id: c.id, ok: true, note: "navigating", state: summary() }); location.href = c.url; return; }
      else if (c.op === "click") { const el = document.querySelector(c.sel); if (!el) throw new Error("no match: " + c.sel); el.click(); }
      else if (c.op === "type") { const el = document.querySelector(c.sel); if (!el) throw new Error("no match: " + c.sel); el.focus(); el.value = c.text; el.dispatchEvent(new Event("input", { bubbles: true })); }
      else if (c.op === "press") { document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: c.key, bubbles: true })); }
      else if (c.op === "seed") { localStorage.setItem(c.key, typeof c.value === "string" ? c.value : JSON.stringify(c.value)); }
      else if (c.op === "neural") { const a = window.__neural; if (!a) throw new Error("__neural absent"); value = await a[c.method](...(c.args || [])); }
      else if (c.op === "eval" || c.op === "read") { value = await (new Function("return (async()=>{" + c.js + "})()"))(); }
      else if (c.op === "shot") { /* summary only */ }
      else throw new Error("unknown op: " + c.op);
      let safe; try { safe = JSON.parse(JSON.stringify(value ?? null)); } catch { safe = String(value); }
      post({ id: c.id, ok: true, value: safe, state: summary() });
    } catch (e) { post({ id: c.id, ok: false, error: String(e && e.message || e), state: summary() }); }
  };
  const es = new EventSource("/__paired/events?t=" + encodeURIComponent(T));
  es.onmessage = (m) => { try { run(JSON.parse(m.data)); } catch {} };
  es.onopen = () => post({ id: 0, ok: true, note: "page connected", state: summary() });
})();
`

// When a session is active, resolve HTML files ourselves and append the client tag; anything
// we can't resolve falls through to serve-handler untouched (then just isn't injected).
function resolveHtml(route) {
  const safe = path.normalize(decodeURIComponent(route)).replace(/^([/\\])+/, "")
  if (safe.startsWith("..")) return null
  const base = path.join(STATIC_ROOT, safe)
  if (!base.startsWith(STATIC_ROOT)) return null
  const tries = route.endsWith("/")
    ? [path.join(base, "index.html")]
    : route.endsWith(".html")
      ? [base]
      : [`${base}.html`, path.join(base, "index.html"), route === "/" ? null : null]
  for (const t of tries) {
    if (t && fs.existsSync(t) && fs.statSync(t).isFile()) return t
  }
  if (route === "/") {
    const idx = path.join(STATIC_ROOT, "index.html")
    if (fs.existsSync(idx)) return idx
  }
  return null
}

const server = http.createServer(async (req, res) => {
  const [route, query] = (req.url ?? "/").split("?")

  if (route.startsWith("/__paired/")) {
    try {
      return await handlePaired(req, res, route, query)
    } catch (e) {
      return sendJson(res, e?.statusCode ?? 500, { ok: false, error: String(e?.message ?? e) })
    }
  }

  // Active paired session -> serve HTML with the bridge client appended (trailing <script>
  // is hoisted into <body> by the parser; byte-identical serving resumes when the session ends)
  const ptoken = pairedToken()
  if (ptoken && req.method === "GET" && String(req.headers.accept ?? "").includes("text/html")) {
    const file = resolveHtml(route)
    if (file) {
      const html =
        fs.readFileSync(file) +
        `\n<script src="/__paired/client.js?t=${encodeURIComponent(ptoken)}" defer></script>\n`
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" })
      return res.end(html)
    }
  }

  if (route === "/__snapshot" || route === "/__snapshot/ping") {
    if (!isLoopback(req)) return sendJson(res, 403, { ok: false, error: "loopback only" })
    if (route === "/__snapshot/ping") {
      res.writeHead(204)
      return res.end()
    }
    try {
      return await handleSnapshot(req, res)
    } catch (e) {
      const code = e?.statusCode ?? 500
      if (code !== 413) console.error("[snapshot] failed:", e)
      return sendJson(res, code, { ok: false, error: String(e?.message ?? e) })
    }
  }

  // etag matches the serve CLI's default (serve-handler's own default is false). cleanUrls and
  // directoryListing are already serve-handler defaults — don't override. The CLI also gzips;
  // skipped here as it needs another dep and buys nothing over loopback.
  return serveHandler(req, res, { public: STATIC_ROOT, etag: true })
})

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`[dev-serve] port ${PORT} is already in use — stop the other server or set PORT.`)
    process.exit(1)
  }
  throw e
})

if (!fs.existsSync(STATIC_ROOT)) {
  console.warn(`[dev-serve] ${path.relative(REPO_ROOT, STATIC_ROOT)} does not exist — run \`npm run build\` first.`)
}

server.listen(PORT, () => {
  console.log(`[dev-serve] http://localhost:${PORT} — snapshots -> ${SNAP_REL}/`)
})
