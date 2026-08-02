// Dev-only console ring buffer feeding the snapshot button's JSON dump (see snapshotState.ts).
//
// Registered as beforeDOMLoaded, so it lands in prescript.js and runs in <head> — ahead of
// variant.inline.ts injecting the neural bundle, which is what makes mount-time failures
// ("[variant] neural bundle unavailable...", app boot throws) show up in a snapshot at all.
// Gated on localhost at runtime: prescript is global, so this ships to prod as ~0.3KB of
// never-executed bytes. Keep it import-free — every import into an inline script is bundled
// into the shared prescript.

const DEV_HOSTS = ["localhost", "127.0.0.1", "[::1]"]
const MAX_ENTRIES = 100
const MAX_MSG = 2000

type Entry = { level: "error" | "warn"; ts: string; msg: string }

if (DEV_HOSTS.includes(location.hostname) && !(window as any).__devConsoleLog) {
  const log: Entry[] = []
  ;(window as any).__devConsoleLog = log

  const push = (level: Entry["level"], msg: string) => {
    log.push({ level, ts: new Date().toISOString(), msg: msg.slice(0, MAX_MSG) })
    if (log.length > MAX_ENTRIES) log.splice(0, log.length - MAX_ENTRIES)
  }

  const render = (a: unknown): string => {
    if (typeof a === "string") return a
    if (a instanceof Error) return a.stack || a.message
    try {
      return JSON.stringify(a)
    } catch {
      return String(a) // circular / unserializable
    }
  }

  const tap = (level: Entry["level"]) => {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      try {
        push(level, args.map(render).join(" "))
      } catch {
        /* logging must never break the page */
      }
      original(...args)
    }
  }
  tap("error")
  tap("warn")

  window.addEventListener("error", (e) =>
    push("error", `${e.message} @${e.filename}:${e.lineno}:${e.colno}`),
  )
  window.addEventListener("unhandledrejection", (e) =>
    push("error", `unhandled rejection: ${render((e as PromiseRejectionEvent).reason)}`),
  )
}
