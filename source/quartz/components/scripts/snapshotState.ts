// Client-state collector for the dev snapshot button (see snapshotButton.inline.ts).
//
// Gathers everything a Claude Code session needs to understand "what the user was looking at":
// page identity, the live neural app's gameplay/training fields, both web storages, an auth
// summary, recent console errors, and the environment. Never throws — a snapshot of partial
// state beats no snapshot, so every section is guarded and failures are recorded in _errors.
//
// Two hard rules:
//   1. window.__neural is CIRCULAR (DOM + canvas refs). Never serialize it whole; pick fields.
//   2. Supabase storage keys hold the session JWT and the PKCE code verifier. Redact them —
//      identity still reaches the dump via the auth summary below.

const AUTH_TIMEOUT_MS = 1500
const PAGE_GRAPH_MAX = 200_000

type Section = Record<string, unknown>

function guard(out: Section, errors: string[], name: string, fn: () => unknown): void {
  try {
    out[name] = fn()
  } catch (e) {
    out[name] = null
    errors.push(`${name}: ${String((e as Error)?.message ?? e)}`)
  }
}

// Strips DOM/canvas refs and proves the value survives the POST body.
const jsonSafe = <T>(v: T): T | null => {
  try {
    return v === undefined ? null : (JSON.parse(JSON.stringify(v)) as T)
  } catch {
    return null
  }
}

function dumpStorage(store: Storage): Section {
  const out: Section = {}
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (!key) continue
    if (key.startsWith("sb-")) {
      out[key] = { redacted: true } // auth token + PKCE code verifier
      continue
    }
    const raw = store.getItem(key)
    try {
      out[key] = raw === null ? null : JSON.parse(raw)
    } catch {
      out[key] = raw // plain string value
    }
  }
  return out
}

function collectNeural(): Section | null {
  const n = (window as any).__neural
  if (!n) return null // legacy variant, or overlay torn down mid-nav
  const node = n.nodes?.[n.currentPos]
  return {
    currentPos: n.currentPos ?? null,
    // `t` is the display name and `ty` the category — the app has no `node.title` (see ingest()
    // in neural/src/app.src.jsx). Getting this wrong nulls the most useful field in the dump.
    node: node ? { id: node.id ?? null, name: node.t ?? null, type: node.ty ?? null } : null,
    playerRole: n.playerRole ?? null,
    moveCount: n.moveCount ?? null,
    maxMoves: n.maxMoves ?? null,
    aiSkill: n.aiSkill ?? null,
    lastActor: n._lastActor ?? null,
    lastOutcome: jsonSafe(n._lastOutcome),
    rollLog: jsonSafe(n.rollLog),
    pastRolls: jsonSafe(n._pastRolls?.slice(-20)),
    prep: jsonSafe(n.prep),
    days: jsonSafe(n._days),
    cardsToday: n.cardsToday ?? null,
    settings: jsonSafe(n.settings),
    giMode: n._giMode ?? null,
    deckShown: n.deckShown ?? null,
    drillView: jsonSafe(n._drillView),
    dossierIdx: n._dossierIdx ?? null,
    nodeCardOn: n._nodeCardOn ?? null,
    explored: jsonSafe(n.exploredSet ? Array.from(n.exploredSet) : null),
    cam: jsonSafe(
      n.cam ? { cx: n.cam.cx ?? null, cy: n.cam.cy ?? null, vw: n.cam.vw ?? null } : null,
    ),
    beats: jsonSafe(n.beats?.slice(-50)),
  }
}

async function collectAuth(): Promise<Section | null> {
  const auth = (window as any).__bjjAuth
  if (!auth?.getSession) return null
  const session: any = await Promise.race([
    auth.getSession(),
    new Promise((r) => setTimeout(() => r(null), AUTH_TIMEOUT_MS)),
  ])
  return {
    signedIn: !!session?.user,
    userId: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
  }
}

export async function collectSnapshotState(): Promise<Section> {
  const errors: string[] = []
  const out: Section = {}

  guard(out, errors, "page", () => ({
    href: location.href,
    title: document.title,
    slug: document.body?.dataset?.slug ?? null,
    currentRole: document.body?.dataset?.currentRole ?? null,
    variant: document.documentElement?.dataset?.variant ?? null,
  }))

  guard(out, errors, "pageGraph", () => {
    const raw = document.getElementById("page-graph-data")?.textContent
    if (!raw) return null
    if (raw.length > PAGE_GRAPH_MAX) return { truncated: true, bytes: raw.length }
    return JSON.parse(raw)
  })

  guard(out, errors, "neural", collectNeural)
  guard(out, errors, "localStorage", () => dumpStorage(localStorage))
  guard(out, errors, "sessionStorage", () => dumpStorage(sessionStorage))
  guard(out, errors, "console", () => (window as any).__devConsoleLog ?? [])
  guard(out, errors, "env", () => ({
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    screen: { width: screen.width, height: screen.height },
    capturedAt: new Date().toISOString(),
  }))

  try {
    out.auth = await collectAuth()
  } catch (e) {
    out.auth = null
    errors.push(`auth: ${String((e as Error)?.message ?? e)}`)
  }

  if (errors.length) out._errors = errors
  return out
}
