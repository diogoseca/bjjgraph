// Dev-only snapshot button (bottom-left camera). Captures what the user is looking at — a PNG of
// the tab plus a dump of client state — writes both to tests/artifacts/snapshots/ via
// scripts/dev-serve.mjs, and copies a one-line <snapshot /> reference to the clipboard for
// pasting into Claude Code. See CLAUDE.md "Dev Snapshots".
//
// Two gates keep it off every non-dev surface: a localhost hostname check, and a probe of
// /__snapshot/ping (so plain `npx serve`, the e2e fixture server on :8123, and prod never show
// it — nothing there can receive the POST anyway).
//
// Capture degrades rather than fails: tab capture -> neural canvas -> JSON only.

import { collectSnapshotState } from "./snapshotState"

const BTN_ID = "dev-snapshot-btn"
const DEV_HOSTS = ["localhost", "127.0.0.1", "[::1]"]
const POST_TIMEOUT_MS = 15_000
const PICKER_TIMEOUT_MS = 60_000 // human decision time at the "Share this tab" prompt
const FRAME_TIMEOUT_MS = 10_000 // a frame should land in <1s once the stream exists
const OK_MS = 2000
const ERR_MS = 2500

const svg = (inner: string) =>
  `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
const svgCamera = svg(
  '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
)
const svgCheck = svg('<polyline points="20 6 9 17 4 12"/>')
const svgAlert = svg(
  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
)

const isDevHost = () => DEV_HOSTS.includes(location.hostname)
const btn = () => document.getElementById(BTN_ID) as HTMLButtonElement | null

// Escape hatch for automation and for anyone who'd rather not answer the picker every time:
// go straight to the canvas fallback. Needed because a headless browser does not *reject*
// getDisplayMedia — it leaves it pending forever, so there is nothing to detect.
function canvasOnly(): boolean {
  try {
    if ((window as any).__snapshotCanvasOnly === true) return true
    return new URLSearchParams(location.search).get("snapshot") === "canvas"
  } catch {
    return false
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

let busy = false
let resetTimer: ReturnType<typeof setTimeout> | undefined
let pingOk: Promise<boolean> | undefined

// Cached per full page load. Silent on failure — the e2e journeys run against a static server
// where this 404s on every page, and their console assertions must stay clean.
function probe(): Promise<boolean> {
  if (!pingOk) {
    // We only need availability. GET downloads the entire custom 404 page on a static
    // preview server; HEAD preserves the status check without wasting that startup payload.
    pingOk = fetch("/__snapshot/ping", { method: "HEAD" })
      .then((r) => r.ok)
      .catch(() => false)
  }
  return pingOk
}

function setState(cls: "" | "snap-busy" | "snap-ok" | "snap-err", icon: string): void {
  const b = btn() // may have been re-created by a nav mid-flight
  if (!b) return
  b.classList.remove("snap-busy", "snap-ok", "snap-err")
  if (cls) b.classList.add(cls)
  b.disabled = cls === "snap-busy"
  b.innerHTML = icon
}

// Draw the first decoded frame of a MediaStream to a PNG data URL. Preferred over ImageCapture
// (Chrome-only, unreliable on the first frame).
//
// Every exit is guarded: a stream that never delivers a frame (user hits "Stop sharing" before
// the first one — that fires `ended`, not `error`) would otherwise leave this pending forever,
// which is the one path that can strand `busy` and leave the button hidden until a reload.
function frameFromStream(stream: MediaStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.muted = true
    video.playsInline = true
    video.srcObject = stream

    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.srcObject = null
      fn()
    }
    const fail = (msg: string) => finish(() => reject(new Error(msg)))
    const timer = setTimeout(() => fail("capture timed out"), FRAME_TIMEOUT_MS)

    const draw = () =>
      finish(() => {
        try {
          const canvas = document.createElement("canvas")
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext("2d")
          if (!ctx || !canvas.width || !canvas.height) throw new Error("empty capture frame")
          ctx.drawImage(video, 0, 0)
          resolve(canvas.toDataURL("image/png"))
        } catch (e) {
          reject(e)
        }
      })

    video.onerror = () => fail("capture video failed")
    stream.getVideoTracks().forEach((t) => t.addEventListener("ended", () => fail("capture ended")))
    video
      .play()
      .then(() => {
        const rvfc = (video as any).requestVideoFrameCallback
        if (typeof rvfc === "function") rvfc.call(video, () => draw())
        else requestAnimationFrame(() => requestAnimationFrame(draw))
      })
      .catch((e) => fail(String(e?.message ?? e)))
  })
}

// Chrome preselects "This tab", so a capture is one confirm click. Cancelling rejects and we fall
// back — but an unanswered or absent picker (headless) leaves the promise pending FOREVER rather
// than rejecting, so the request must be raced against a timeout or the whole button deadlocks.
async function captureTab(): Promise<string> {
  const req = (navigator.mediaDevices as any).getDisplayMedia({
    video: { displaySurface: "browser" },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
    systemAudio: "exclude",
  }) as Promise<MediaStream>

  let stream: MediaStream
  try {
    stream = await withTimeout(req, PICKER_TIMEOUT_MS, "capture picker timed out")
  } catch (e) {
    // If the user answers the picker after we gave up, release the stream we no longer want —
    // otherwise the browser keeps showing a "sharing this tab" bar for a capture nobody uses.
    req.then(
      (s) => s.getTracks().forEach((t) => t.stop()),
      () => {},
    )
    throw e
  }
  try {
    return await frameFromStream(stream)
  } finally {
    stream.getTracks().forEach((t: MediaStreamTrack) => t.stop()) // drop the "sharing this tab" bar
  }
}

// Canvas-2D and taint-free (the app never drawImages cross-origin), so toDataURL is safe here.
// Misses DOM overlays — that's the documented cost of the fallback path.
function captureCanvas(): string | null {
  const canvas = document.querySelector("#neural-root canvas") as HTMLCanvasElement | null
  return canvas ? canvas.toDataURL("image/png") : null
}

async function capturePng(): Promise<string | null> {
  const b = btn()
  if (b) b.style.visibility = "hidden" // keep the button itself out of the pixels
  try {
    if (!canvasOnly() && (navigator.mediaDevices as any)?.getDisplayMedia) return await captureTab()
  } catch {
    /* denied / cancelled / timed out / unsupported — fall through */
  } finally {
    const cur = btn()
    if (cur) cur.style.visibility = ""
  }
  try {
    return captureCanvas()
  } catch {
    return null // JSON-only snapshot
  }
}

async function post(png: string | null): Promise<{ line: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), POST_TIMEOUT_MS)
  try {
    const res = await fetch("/__snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        slug: document.body?.dataset?.slug ?? location.pathname,
        variant: document.documentElement?.dataset?.variant ?? "legacy",
        png,
        state: await collectSnapshotState(),
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) throw new Error(data?.error ?? `server responded ${res.status}`)
    return data
  } finally {
    clearTimeout(timer)
  }
}

async function copy(line: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(line)
    return
  } catch {
    /* insecure context / permission denied — try the legacy path */
  }
  try {
    const ta = document.createElement("textarea")
    ta.value = line
    ta.style.cssText = "position:fixed;top:-9999px"
    document.body.appendChild(ta)
    ta.select()
    document.execCommand("copy")
    ta.remove()
  } catch {
    /* the line is still on the console and in the dev-serve terminal */
  }
}

async function onClick(): Promise<void> {
  if (busy) return
  busy = true
  // Cancel any pending ok/err reset: a click within OK_MS of the last one would otherwise have
  // the stale timer fire mid-capture, clearing snap-busy and re-enabling a button that then
  // silently swallows clicks until the in-flight capture lands.
  clearTimeout(resetTimer)
  setState("snap-busy", svgCamera)
  try {
    // getDisplayMedia must come first: it needs the click's transient user activation, which
    // expires across long awaits (collecting state first turns every capture into a fallback).
    const png = await capturePng()
    const { line } = await post(png)
    await copy(line)
    console.log("[snapshot] " + line)
    setState("snap-ok", svgCheck)
    resetTimer = setTimeout(() => setState("", svgCamera), OK_MS)
  } catch (e) {
    console.error("[snapshot] failed:", e)
    setState("snap-err", svgAlert)
    resetTimer = setTimeout(() => setState("", svgCamera), ERR_MS)
  } finally {
    busy = false
  }
}

async function ensureButton(): Promise<void> {
  if (!isDevHost() || document.getElementById(BTN_ID)) return
  if (!(await probe())) return
  if (document.getElementById(BTN_ID)) return // re-check: two navs can straddle the probe await

  const b = document.createElement("button")
  b.id = BTN_ID
  b.type = "button"
  b.innerHTML = svgCamera
  b.ariaLabel = "Snapshot page for Claude"
  b.title = "Snapshot → clipboard"
  b.addEventListener("click", onClick)
  document.body.appendChild(b)
  // micromorph drops script-created body children on soft nav anyway; removing it ourselves
  // pre-morph keeps its positional child diff clean. The nav handler re-creates it after.
  window.addCleanup(() => b.remove())
}

document.addEventListener("nav", () => void ensureButton())
