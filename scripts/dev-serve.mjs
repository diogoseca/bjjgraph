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

const server = http.createServer(async (req, res) => {
  const route = (req.url ?? "/").split("?")[0]

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
