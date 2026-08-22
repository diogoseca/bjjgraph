import { test, expect } from "@playwright/test"

/**
 * LEGACY-VARIANT EXCISION GUARD (v1.80.0) — @curated
 *
 * The site used to ship two front-ends to every visitor: the Neural app (default) and the
 * old Quartz page UI, reachable only via `?variant=legacy`. Nobody opted in, yet every
 * page paid ~1.46MB for it. v1.80.0 deleted the legacy surface.
 *
 * THE POINT OF THIS FILE IS THE CONJUNCTION, NOT THE ABSENCE.
 *
 * Supabase auth is shared between the two front-ends through the `window.__bjjAuth` façade,
 * installed at module top-level in scripts/supabase.ts and reached only because
 * authUI.inline.ts statically imports it (Component.AuthUI() runs on every page). Delete
 * the legacy side carelessly and you take the façade with it: signed-in cloud sync silently
 * dies for real users while a pure absence-test stays green — it would be *happier*, since
 * there is even less legacy left.
 *
 * So test 1 asserts, in ONE test, that the legacy surface is gone AND that the auth seam is
 * still present and functional on the default variant. It cannot be satisfied by deleting
 * more; it can only be satisfied by deleting the right thing.
 *
 * These tests deliberately do NOT use the journey() DSL: the subject is the emitted page and
 * its script bundle, not the game loop. They run against the real built site.
 */

/** Every DOM handle that existed only to serve the legacy page UI. */
const LEGACY_SELECTORS = [
  "#background-graph", // full-viewport Pixi/D3 graph (backgroundGraph.inline.ts)
  "#graph-overlay", // legacy drawer/intro backdrop
  "#panel-toggle", // ContentPanel graph/content switcher
  "#fit-all-btn", // legacy graph fit-all control
  "#tree-toggle", // TreeDrawer toggle
  "#flashcards-header", // legacy training strip
  "#roll-session-btn", // legacy roll-session play/stop
  "#topbar-auth", // legacy top-bar avatar slot
  "#graph-positions", // per-page D3 layout blob (42.5% of emitted HTML bytes)
  "#home-roll-fab", // legacy homepage roll FAB
  ".move-cards-container", // MoveCards
  "#outcome-cards", // OutcomeCards
  "#flashcard-container", // Flashcard
]

test("@curated legacy surface is gone AND the __bjjAuth seam still works on the default variant", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(String(e)))

  // A content page: the archetype that carried the whole legacy stack.
  await page.goto("/Positions/Mount/Top", { waitUntil: "domcontentloaded" })

  // ── half 1: the legacy surface is gone from the emitted page ──────────────────
  for (const sel of LEGACY_SELECTORS) {
    expect(await page.locator(sel).count(), `legacy selector ${sel} still emitted`).toBe(0)
  }

  // The legacy globals the deleted stack installed must be gone too — a component can be
  // unregistered from the layout while its script is still bundled into postscript.js.
  const legacyGlobals = await page.evaluate(() => {
    const w = window as any
    return {
      openDecksModal: typeof w.__openDecksModal,
      openSettingsModal: typeof w.__openSettingsModal,
      loadQuestionBank: typeof w.loadQuestionBank,
      loadGraphAdjacency: typeof w.loadGraphAdjacency,
      contentStats: typeof w.__contentStats,
    }
  })
  expect(legacyGlobals).toEqual({
    openDecksModal: "undefined",
    openSettingsModal: "undefined",
    loadQuestionBank: "undefined",
    loadGraphAdjacency: "undefined",
    contentStats: "undefined",
  })

  // ── half 2: the auth seam is intact and FUNCTIONAL on the default variant ─────
  // Not just "the object exists": every function the Neural app reaches through
  // (neural/src/app.src.jsx _auth/_initAuth/_pullAndMerge and its sign-in UI) must still
  // be callable, or cloud sync is dead for signed-in users.
  const seam = await page.evaluate(() => {
    const A = (window as any).__bjjAuth
    if (!A) return null
    const shape: Record<string, string> = {}
    for (const k of [
      "ensureClientInitialized",
      "isAuthenticated",
      "getSession",
      "signIn",
      "signUp",
      "signInWithGoogle",
      "signOut",
      "onAuthChange",
      "resetPassword",
      "pullNeural",
      "pushNeural",
    ])
      shape[k] = typeof A[k]
    return shape
  })
  expect(seam, "window.__bjjAuth is missing — the legacy deletion took the auth seam with it")
    .not.toBeNull()
  for (const [k, ty] of Object.entries(seam!)) {
    expect(ty, `__bjjAuth.${k} is not callable`).toBe("function")
  }

  // …and it actually runs: a signed-out visitor must get a clean `false`, and the neural
  // pull must resolve (to null when unconfigured/signed out) rather than throw.
  const live = await page.evaluate(async () => {
    const A = (window as any).__bjjAuth
    const authed = A.isAuthenticated()
    let pulled: unknown = "threw"
    try {
      pulled = await A.pullNeural()
    } catch {
      /* leave the sentinel */
    }
    return { authed, pulled }
  })
  expect(live.authed).toBe(false)
  expect(live.pulled, "pullNeural threw — the cloud round-trip is broken").not.toBe("threw")

  expect(errors, `page errors on the default variant: ${errors.join(" | ")}`).toEqual([])
})

test("@curated the Neural app still boots and owns the screen after the excision", async ({
  page,
}) => {
  // The excision must not have cut the boot path (NeuralMount + variant.inline.ts). Without
  // this, test 1 could pass on a page that renders nothing at all.
  await page.goto("/Positions/Mount/Top", { waitUntil: "domcontentloaded" })
  await expect(page.locator("#neural-root")).toHaveCount(1, { timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => typeof (window as any).__mountNeural), {
    timeout: 30_000,
  }).toBe("function")
  expect(await page.evaluate(() => document.documentElement.dataset.variant)).toBe("neural")
})

test("@curated ?variant=legacy no longer resurrects the deleted UI", async ({ page }) => {
  // The escape hatch is gone, not merely hidden: the query param must not bring back a
  // second front-end (which is what shipping the bytes would mean).
  await page.goto("/Positions/Mount/Top?variant=legacy", { waitUntil: "domcontentloaded" })
  for (const sel of LEGACY_SELECTORS) {
    expect(await page.locator(sel).count(), `${sel} came back under ?variant=legacy`).toBe(0)
  }
  // The static article — the crawlable fallback — must still be there for this visitor.
  const chars = await page.locator("article").first().innerText()
  expect(chars.trim().length).toBeGreaterThan(400)
})
