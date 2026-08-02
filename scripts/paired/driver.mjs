#!/usr/bin/env node
// Paired-debugging Mode-2 driver — acts on the SHARED Chromium (started by
// `node scripts/paired_session.mjs start`) that the owner watches via the DevTools
// screencast on :9222. Each invocation connects over CDP, performs ONE action, appends it
// to the session journal, and disconnects — browser/page state persists between calls.
//
//   node scripts/paired/driver.mjs goto <url>
//   node scripts/paired/driver.mjs click <selector>
//   node scripts/paired/driver.mjs type <selector> <text>
//   node scripts/paired/driver.mjs press <key>
//   node scripts/paired/driver.mjs eval <js-expression>      (async body allowed)
//   node scripts/paired/driver.mjs reload
//   node scripts/paired/driver.mjs screenshot [out.png]
//   node scripts/paired/driver.mjs text <selector>
//   node scripts/paired/driver.mjs html <selector>
//   node scripts/paired/driver.mjs note <free text>          (journal-only marker)
//   node scripts/paired/driver.mjs pause | resume            (journal markers for think-time)
//
// The journal (e2e/paired/journals/<session>.jsonl) is later TRANSLATED — not replayed —
// into a deterministic e2e spec; pause/resume markers let the converter clamp think-time.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const require = createRequire(path.join(REPO_ROOT, "package.json"))
const SESSION_DIR = path.join(REPO_ROOT, "e2e", "paired", ".session")
const JOURNALS = path.join(REPO_ROOT, "e2e", "paired", "journals")
const CDP = process.env.PAIRED_CDP || "http://127.0.0.1:9222"

function journal(entry) {
  fs.mkdirSync(JOURNALS, { recursive: true })
  let name = "mode2-session"
  try {
    name = fs.readFileSync(path.join(SESSION_DIR, "journal-name"), "utf8").trim() || name
  } catch {}
  fs.appendFileSync(
    path.join(JOURNALS, `${name}.jsonl`),
    JSON.stringify({ at: new Date().toISOString(), mode: 2, ...entry }) + "\n",
  )
}

const [, , cmd, ...args] = process.argv
if (!cmd) {
  console.error("usage: driver.mjs <goto|click|type|press|eval|reload|screenshot|text|html|note|pause|resume> ...")
  process.exit(2)
}

// journal-only commands need no browser
if (cmd === "note" || cmd === "pause" || cmd === "resume") {
  journal({ cmd, args: args.join(" ") })
  console.log(JSON.stringify({ ok: true, cmd }))
  process.exit(0)
}

const { chromium } = require("playwright-core")
const browser = await chromium.connectOverCDP(CDP)
try {
  const ctx = browser.contexts()[0] ?? (await browser.newContext())
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  let out = { ok: true, cmd, url: page.url() }

  if (cmd === "goto") await page.goto(args[0], { waitUntil: "domcontentloaded" })
  else if (cmd === "click") await page.click(args[0], { timeout: 8000 })
  else if (cmd === "type") await page.fill(args[0], args.slice(1).join(" "), { timeout: 8000 })
  else if (cmd === "press") await page.keyboard.press(args[0])
  else if (cmd === "eval") out.value = await page.evaluate(`(async () => { return (${args.join(" ")}); })()`)
  else if (cmd === "reload") await page.reload({ waitUntil: "domcontentloaded" })
  else if (cmd === "screenshot") {
    const to = args[0] || path.join(SESSION_DIR, `shot-${Date.now()}.png`)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    await page.screenshot({ path: to })
    out.path = to
  } else if (cmd === "text") out.value = await page.textContent(args[0], { timeout: 8000 })
  else if (cmd === "html") out.value = await page.innerHTML(args[0], { timeout: 8000 })
  else {
    console.error(`unknown command: ${cmd}`)
    process.exit(2)
  }

  out.url = page.url()
  out.title = await page.title()
  journal({ cmd, args, url: out.url })
  console.log(JSON.stringify(out))
} finally {
  await browser.close() // closes the CDP CONNECTION only, not the shared browser
}
