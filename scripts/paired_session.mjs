#!/usr/bin/env node
// Paired-debugging session manager — one CLI for both modes
// (see .claude/skills/paired-debugging/SKILL.md).
//
// MODE 2 (shared watchable browser):
//   start   — launch Playwright's bundled Chromium headless with CDP on :9222 (loopback
//             only), open the app, print the owner's connect instructions
//   status  — is the shared browser up? which page?
//   stop    — kill it and clean the pid file
//
// MODE 1 (bridge into the owner's own tab at bjjgraph:8080, served by dev-serve):
//   bridge start  — mint the session token file (dev-serve picks it up within ~2s; the
//                   owner just RELOADS the page they're browsing), print status
//   bridge stop   — remove the token (HTML serving returns to byte-identical)
//   bridge status — token present? page connected? (asks dev-serve)
//   cmd '<json>'  — enqueue a command for the owner's tab, e.g.
//                   cmd '{"op":"click","sel":"[data-lesson]"}'
//                   ops: goto|click|type|press|seed|neural|eval|read|shot
//   results [sinceId] — read executed-command results back
//
// Both modes journal to e2e/paired/journals/ for later journal→spec translation.

import fs from "node:fs"
import path from "node:path"
import { spawn, execSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import crypto from "node:crypto"
import http from "node:http"
import { createRequire } from "node:module"

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SESSION_DIR = path.join(REPO_ROOT, "e2e", "paired", ".session")
const PID_FILE = path.join(SESSION_DIR, "chromium.pid")
const TOKEN_FILE = path.join(SESSION_DIR, "bridge-token")
const JOURNAL_NAME_FILE = path.join(SESSION_DIR, "journal-name")
const PROFILE = path.join(SESSION_DIR, "live-profile")
const CDP_PORT = Number(process.env.PAIRED_CDP_PORT || 9222)
const APP_URL = process.env.PAIRED_APP_URL || "http://localhost:8080"
const DEV_SERVE = process.env.PAIRED_DEV_SERVE || "http://localhost:8080"

function findChromium() {
  // authoritative: ask the repo's own playwright-core (survives cache-layout changes —
  // chromium-1228 uses chrome-linux64/, older builds used chrome-linux/)
  try {
    const require = createRequire(path.join(REPO_ROOT, "package.json"))
    const bin = require("playwright-core").chromium.executablePath()
    if (bin && fs.existsSync(bin)) return bin
  } catch {}
  // fallback: scan the cache accepting either layout
  const cache = path.join(process.env.HOME ?? "/home/user", ".cache/ms-playwright")
  const dirs = fs
    .readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))
  for (const d of dirs)
    for (const sub of ["chrome-linux64", "chrome-linux"]) {
      const bin = path.join(cache, d, sub, "chrome")
      if (fs.existsSync(bin)) return bin
    }
  throw new Error("no Playwright chromium found (playwright-core lookup + cache scan both failed)")
}

const stampName = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function httpJson(method, url, body) {
  return new Promise((resolve) => {
    const req = http.request(url, { method, headers: { "content-type": "application/json" } }, (res) => {
      let s = ""
      res.on("data", (c) => (s += c))
      res.on("end", () => {
        try {
          resolve({ code: res.statusCode, body: JSON.parse(s) })
        } catch {
          resolve({ code: res.statusCode, body: s })
        }
      })
    })
    req.on("error", (e) => resolve({ code: 0, body: String(e.message) }))
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const [, , cmd, sub, ...rest] = process.argv

if (cmd === "start") {
  fs.mkdirSync(SESSION_DIR, { recursive: true })
  if (fs.existsSync(PID_FILE) && alive(Number(fs.readFileSync(PID_FILE, "utf8")))) {
    console.log("shared browser already running — `status` for details")
    process.exit(0)
  }
  const bin = findChromium()
  const child = spawn(
    bin,
    [
      "--headless=new",
      `--remote-debugging-port=${CDP_PORT}`, // binds loopback by default — SSH-tunnel to reach
      `--user-data-dir=${PROFILE}`,
      "--window-size=1440,900",
      "--no-first-run",
      APP_URL,
    ],
    { detached: true, stdio: "ignore" },
  )
  child.unref()
  fs.writeFileSync(PID_FILE, String(child.pid))
  if (!fs.existsSync(JOURNAL_NAME_FILE)) fs.writeFileSync(JOURNAL_NAME_FILE, `paired-${stampName()}`)
  console.log(`shared Chromium up (pid ${child.pid}, CDP :${CDP_PORT}, profile ${path.relative(REPO_ROOT, PROFILE)})

OWNER — to watch this session from your machine:
  1. reconnect ssh with:   ssh -L ${CDP_PORT}:localhost:${CDP_PORT} -L 8080:localhost:8080 <this-host>
  2. open in your browser: http://localhost:${CDP_PORT}
  3. click the page title  -> DevTools opens with a LIVE screencast (you can click/type in it too)

Claude drives the same browser with: node scripts/paired/driver.mjs <goto|click|eval|...>`)
} else if (cmd === "status") {
  const pid = fs.existsSync(PID_FILE) ? Number(fs.readFileSync(PID_FILE, "utf8")) : null
  const up = pid && alive(pid)
  let target = null
  if (up) {
    const r = await httpJson("GET", `http://127.0.0.1:${CDP_PORT}/json/list`)
    if (Array.isArray(r.body)) target = r.body.map((t) => t.url).slice(0, 3)
  }
  console.log(JSON.stringify({ mode2: { up: !!up, pid, targets: target }, bridge: fs.existsSync(TOKEN_FILE) }))
} else if (cmd === "stop") {
  if (fs.existsSync(PID_FILE)) {
    const pid = Number(fs.readFileSync(PID_FILE, "utf8"))
    if (alive(pid)) {
      try {
        execSync(`kill ${pid}`)
      } catch {}
    }
    fs.rmSync(PID_FILE, { force: true })
    console.log(`stopped shared browser (pid ${pid})`)
  } else console.log("no shared browser pid file")
} else if (cmd === "bridge") {
  fs.mkdirSync(SESSION_DIR, { recursive: true })
  if (sub === "start") {
    const token = crypto.randomBytes(12).toString("hex")
    fs.writeFileSync(TOKEN_FILE, token)
    if (!fs.existsSync(JOURNAL_NAME_FILE)) fs.writeFileSync(JOURNAL_NAME_FILE, `paired-${stampName()}`)
    console.log(`bridge session ACTIVE (token ${token.slice(0, 4)}…)

OWNER — just RELOAD the page you're browsing at ${DEV_SERVE.replace("localhost", "bjjgraph")} —
dev-serve now appends the bridge client to served HTML; the tab connects back automatically.
(If dev-serve isn't running: npm run serve)

Claude drives your tab with:
  node scripts/paired_session.mjs cmd '{"op":"click","sel":"..."}'
  node scripts/paired_session.mjs results`)
  } else if (sub === "stop") {
    fs.rmSync(TOKEN_FILE, { force: true })
    console.log("bridge session ended — HTML serving is byte-identical again")
  } else if (sub === "status") {
    const has = fs.existsSync(TOKEN_FILE)
    const r = has ? await httpJson("GET", `${DEV_SERVE}/__paired/results?since=999999999`) : null
    console.log(JSON.stringify({ token: has, devServe: r?.code ?? null, connected: r?.body?.connected ?? 0 }))
  } else {
    console.error("usage: paired_session.mjs bridge <start|stop|status>")
    process.exit(2)
  }
} else if (cmd === "cmd") {
  const payload = JSON.parse(sub)
  const r = await httpJson("POST", `${DEV_SERVE}/__paired/cmd`, payload)
  console.log(JSON.stringify(r.body))
} else if (cmd === "results") {
  const r = await httpJson("GET", `${DEV_SERVE}/__paired/results?since=${sub ?? 0}`)
  console.log(JSON.stringify(r.body, null, 1))
} else {
  console.error("usage: paired_session.mjs <start|status|stop|bridge <start|stop|status>|cmd <json>|results [since]>")
  process.exit(2)
}
