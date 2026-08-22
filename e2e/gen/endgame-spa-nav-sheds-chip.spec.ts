/* @hyperspace {"theme":"momentum-and-economy","L":"multi-belt-endgame","F":"spa-nav","B":"interruption-abort"} @invariant "A Quartz soft navigation mid-streak tears the momentum HUD down with the app: the remounted instance has _combo 0, zero [data-momentum] and zero [data-combo-pop] elements anywhere in the document (no ghost fixed overlays from the old instance), and its beat stream contains no combo_break." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame } from "./personas"

/**
 * ENDGAME — SPA NAV SHEDS THE MOMENTUM HUD WITH THE APP LIFE.
 *
 * A multi-belt endgame player builds a live ×2 streak — heat chip up, DOUBLE COMBO!
 * announcer STILL in the DOM — and soft-navigates away mid-streak, twice. Both HUD
 * surfaces are fixed overlays; if they were appended to document.body they would ghost
 * across the teardown and haunt every later life. They must die with the instance.
 *
 * Mechanism under test (probe-verified 2x green, ~5.6s, deterministic):
 *   - chip AND announcer are appended to `(this.__ngRoot || document.body)`
 *     (app.src.jsx _comboPop :4366, _updateComboChip :4384) and __ngRoot resolves truthy
 *     in practice (probe logged `chip inside #neural-root: true`) — asserted as a premise
 *     below, because body-appended overlays are exactly the regression this spec exists
 *     to catch (destroy() would orphan them).
 *   - destroy() (neural/build/build.mjs:116) removes __ngRoot and clears timers, so the
 *     whole momentum HUD sheds with the instance; a fresh constructor starts _combo cold
 *     (per-match resets: app.src.jsx :3330/:4697/:4738 — none of them is even needed
 *     across a remount, the field simply never existed on the new instance).
 *   - the ×2 pop self-removes only after 1.2s of SIM time (after(), :4368); test mode
 *     freezes the loop, so navigating WITHOUT pumping keeps the pop alive in the DOM at
 *     nav time — the stronger teardown case, and why no advance() happens after answer 2.
 *
 * Recipe notes (all probe-proven):
 *   - multiBeltEndgame: stage:{} is EMPTY, so every landing asks despite prep/rec=3
 *     (questionFor gates on cardStage<2, not rec) — the streak is buildable at the
 *     endgame time-point.
 *   - answers go through the real keyboard surface (A/B/C/D); truth lives in this._mc
 *     (never a DOM attribute), gated on surface==="land" AND _landPending (the
 *     live-unanswered signal — _mc itself lingers after an answer).
 *   - between answers: rigged-successful hop (resolve 0.01 + outcome 0.01, first
 *     transition option), ≤4-hop loop until [data-land-q] shows — proven/unbuildable
 *     decks carry the streak silently (silence ≠ neglect), so a quiet landing just hops on.
 *   - land-mc-pick/land-mc-shuffle are surface-scoped RNG tags — pre-rigged DEEP (20/8)
 *     per life that renders a landing question, so no draw ever falls through.
 *   - CANONICAL slugs only ("/Positions/Mount", "/") — lowercase aliases are redirect
 *     stubs that HARD-navigate (fresh window, storage wiped by the harness); detected via
 *     the window-global __probeRefN, which only a same-document nav preserves.
 *   - remount awaited via __probeId !== prev + nodes + advance + flashcards.decks.
 */

const PICKQ = [0.13, 0.47, 0.79, 0.11, 0.29, 0.41, 0.53, 0.67, 0.83, 0.91, 0.07, 0.37, 0.59, 0.73, 0.97, 0.19, 0.31, 0.43, 0.61, 0.89]
const SHUFQ = [0.21, 0.62, 0.34, 0.88, 0.14, 0.52, 0.76, 0.28]

test("×2 streak (pop live in DOM) → two soft navs: each remount boots combo-cold with zero HUD ghosts, then a fresh landing asks anew", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.rig("land-mc-pick", PICKQ)
  await j.rig("land-mc-shuffle", SHUFQ)
  await j.land("Mount Top")

  // answer the live landing question correctly via the keyboard; gated on _landPending
  // because _mc lingers post-answer (the closure's answered flag is the only guard there)
  const answerLanding = async (): Promise<boolean> => {
    const mc = await page.evaluate(() => {
      const a = (window as any).__neural
      const m = a._mc
      return a._landPending && m && m.surface === "land" && typeof m.correct === "number"
        ? { correct: m.correct }
        : null
    })
    if (!mc) return false
    await page.keyboard.press("abcd"[mc.correct])
    return true
  }

  // ── build the streak: answer 1 at Mount Top (×1, silent tier), hop until a second
  // landing asks, answer 2 (×2 — announcer + chip). No advance after answer 2. ──
  expect(await answerLanding(), "Mount Top asked a landing question (empty stage map) and it was answered → ×1").toBe(true)
  let second = false
  for (let hop = 0; hop < 4 && !second; hop++) {
    const t = await page.evaluate(() => {
      const a = (window as any).__neural
      for (const o of a.optionIdxs || []) {
        const idx = typeof o === "number" ? o : o.idx
        if (a.nodes[idx] && a.nodes[idx].ty === "transitions") return a.nodes[idx].t
      }
      return null
    })
    expect(t, `hop ${hop + 1}: a transition option in the tray`).toBeTruthy()
    await j.rig("resolve", [0.01]) // success under any moveChance
    await j.rig("outcome", [0.01]) // first outcome cell (success) — deterministic destination
    await j.pick(t as string)
    await j.nextHand()
    if ((await page.locator("[data-land-q]").count()) > 0) second = await answerLanding()
    // silent landing (proven/unbuildable deck): the streak carries — go around
  }
  expect(second, "a second landing question asked within 4 hops and was answered → ×2").toBe(true)

  // ── mid-streak premise at nav time: ×2 hot, chip + pop BOTH live, both riding __ngRoot ──
  const hot = await page.evaluate(() => {
    const a = (window as any).__neural
    const root = document.querySelector("#neural-root")
    const chips = document.querySelectorAll("[data-momentum]")
    const pops = document.querySelectorAll("[data-combo-pop]")
    return {
      combo: a._combo || 0,
      mod: a.momentumMod(),
      chips: chips.length,
      pops: pops.length,
      chipInRoot: !!(root && chips[0] && root.contains(chips[0])),
      popInRoot: !!(root && pops[0] && root.contains(pops[0])),
    }
  })
  expect(hot.combo, "two straight rights = ×2 at nav time").toBe(2)
  expect(hot.mod, "+2.5% at ×2").toBeCloseTo(0.025, 6)
  expect(hot.chips, "exactly one heat chip in the document").toBe(1)
  expect(hot.pops, "exactly one announcer pop — nav happens BEFORE its 1.2s sim expiry").toBe(1)
  expect(hot.chipInRoot, "chip rides #neural-root (mechanism premise: destroy() sheds it)").toBe(true)
  expect(hot.popInRoot, "pop rides #neural-root (a body-appended pop would ghost the teardown)").toBe(true)
  await expect(page.locator('[data-momentum="2"]'), "heat chip reads ×2").toBeVisible()
  await expect(page.locator('[data-combo-pop="2"]'), "DOUBLE COMBO! pop live in the DOM").toBeVisible()
  const preBeats = (await j.beats()) as any[]
  const combos = preBeats.filter((b) => b.beat === "combo")
  expect(combos.length, "exactly one combo beat pre-nav (×1 is the silent tier)").toBe(1)
  expect(combos[0].n, "combo beat carries n:2").toBe(2)
  expect(preBeats.some((b) => b.beat === "combo_break"), "streak unbroken at nav time").toBe(false)

  // ── the shared post-remount census: the whole invariant, held on BOTH remounts ──
  const waitRemount = (prevId: number) =>
    page.waitForFunction(
      (pid) => {
        const a = (window as any).__neural
        return !!(a && a.__probeId !== pid && a.nodes && a.nodes.length > 0 && typeof a.advance === "function" && a.flashcards && a.flashcards.decks)
      },
      prevId,
      { timeout: 60_000 },
    )
  const census = (refName: string) =>
    page.evaluate((rn) => {
      const w = window as any
      const a = w.__neural
      const old = w[rn]
      return {
        sameDoc: !!old, // an alias-stub HARD nav would have wiped this window global
        sameRef: a === old,
        roots: document.querySelectorAll("#neural-root").length,
        combo: a._combo || 0,
        chips: document.querySelectorAll("[data-momentum]").length,
        pops: document.querySelectorAll("[data-combo-pop]").length,
        beats: ((a.beats || []) as any[]).map((b) => b.beat),
      }
    }, refName)
  const assertShed = (life: string, c: Awaited<ReturnType<typeof census>>) => {
    expect(c.sameDoc, `${life}: soft nav stayed same-document (canonical slug — the alias stub hard-navigates)`).toBe(true)
    expect(c.sameRef, `${life}: remount is a NEW instance, not the old ref`).toBe(false)
    expect(c.roots, `${life}: exactly one #neural-root — the old overlay root left with its life`).toBe(1)
    expect(c.combo, `${life}: (_combo||0) === 0 — the meter never existed on this instance`).toBe(0)
    expect(c.chips, `${life}: zero [data-momentum] anywhere in the document — no ghost chip`).toBe(0)
    expect(c.pops, `${life}: zero [data-combo-pop] anywhere in the document — the live pop died with __ngRoot`).toBe(0)
    expect(c.beats, `${life}: fresh beat stream is EMPTY (hence no combo_break)`).toEqual([])
  }

  // ── NAV 1 mid-streak → /Positions/Mount ──
  await page.evaluate(() => {
    const w = window as any
    w.__neural.__probeId = 1
    w.__probeRef1 = w.__neural
  })
  await page.evaluate(() => (window as any).spaNavigate(new URL("/Positions/Mount", location.origin)))
  await waitRemount(1)
  assertShed("life 2", await census("__probeRef1"))

  // ── NAV 2 back home → / ──
  await page.evaluate(() => {
    const w = window as any
    w.__neural.__probeId = 2
    w.__probeRef2 = w.__neural
  })
  await page.evaluate(() => (window as any).spaNavigate(new URL("/", location.origin)))
  await waitRemount(2)
  assertShed("life 3", await census("__probeRef2"))

  // ── non-vacuity: life 3 is first-class — a fresh land pumps a clean stream and a NEW
  // landing question asks (unanswered — no combo state is minted by merely asking) ──
  await j.rig("land-mc-pick", PICKQ)
  await j.rig("land-mc-shuffle", SHUFQ)
  await j.land("Mount Top")
  const stream = (await j.beats()).map((b) => b.beat)
  expect(stream, "life-3 stream: one clean question-first landing, no coach, no tut, no combo residue").toEqual([
    "stakes",
    "land",
    "options_dealt",
    "beacon_moved",
    "mc_shown",
    "land_q_shown",
  ])
  const post = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      pending: !!a._landPending,
      surface: a._mc && a._mc.surface,
      landQ: document.querySelectorAll("[data-land-q]").length,
      chips: document.querySelectorAll("[data-momentum]").length,
      pops: document.querySelectorAll("[data-combo-pop]").length,
      combo: a._combo || 0,
    }
  })
  expect(post.pending, "a NEW landing question is live and unanswered on life 3").toBe(true)
  expect(post.surface, "the live MC block is the landing surface").toBe("land")
  expect(post.landQ, "the question rendered in the landing card").toBeGreaterThan(0)
  expect(post.combo, "asking mints nothing — life 3 still combo-cold").toBe(0)
  expect(post.chips, "still zero [data-momentum] after real life-3 play").toBe(0)
  expect(post.pops, "still zero [data-combo-pop] after real life-3 play").toBe(0)
  expect(errors, "zero pageerror across the streak, both soft navs, and the fresh landing").toEqual([])
})
