#!/usr/bin/env node
/**
 * HOW MANY ROLLS DOES LAST ROLLS ACTUALLY KEEP?
 *
 * The owner's report was "last rolls is not updating as i click outcomes and continue my roll …
 * it seems stuck". `_closeRoll`'s predicate used to demand `rollLog.length > 1`, so every roll
 * that ended on its FIRST exchange — you attack from the state you opened in and finish it, or
 * get caught there — was discarded with no row and no beat. This is the number that says how
 * often that happens, measured on the SHIPPED bundle in production mode (no `__NEURAL_TEST__`:
 * real timers, real rAF, the real opponent), because the answer is a property of the game's
 * pacing and not of the harness.
 *
 * THE SET, exactly: rolls that reached `roll_end` during the run. For each, whether it landed on
 * the shelf (`roll_archived`) and how many STATES its log held — `states === 1` is the roll the
 * old predicate threw away. Picking always takes the FIRST card in the hand, which is the
 * EDGE-ranked one a player is most likely to press, and it is what makes the run reproducible
 * without rigging (the tray order is frozen at deal time).
 *
 * Measured at v1.171.0 over three runs (PICKS=8, 10, 10): **9 rolls ended, 4 of them held exactly
 * one state (44%)** — pre-fix those 4 left no trace anywhere in the app. Run-to-run spread is
 * wide (1/2, 1/3, 2/4) because nothing is rigged, which is the point: this prices the real game,
 * not a scripted one. Re-derive before quoting; the shelf/rows equality below is the invariant.
 *
 *   npm run serve                                  # the dev server this reads (:8080)
 *   node tests/artifacts/_last_rolls_archive_probe.mjs
 *   PICKS=16 node tests/artifacts/_last_rolls_archive_probe.mjs
 */
import { chromium } from "playwright"

const BASE = process.env.SHOOT_BASE || "http://localhost:8080"
const PICKS = Number(process.env.PICKS || 8)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const app = (page, fn, arg) => page.evaluate(fn, arg)

async function waitFor(page, fn, capMs = 45000, stepMs = 400) {
  const t0 = Date.now()
  while (Date.now() - t0 < capMs) {
    if (await page.evaluate(fn)) return true
    await sleep(stepMs)
  }
  return false
}

const run = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on("pageerror", (e) => console.log("  ! page error:", e.message))
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })

  const booted = await waitFor(page, () => {
    const a = window.__neural
    return !!(a && a.nodes && a.nodes.length && (a.optionIdxs || []).length)
  })
  if (!booted) {
    console.log("FAILED: no hand was dealt — is `npm run serve` up at " + BASE + "?")
    await browser.close()
    process.exit(1)
  }

  // Last rolls open for the whole run: the pane is the surface under test, and a repaint that
  // only happens while nobody is looking is the defect this probe exists to price.
  await app(page, () => window.__neural.openPane("history"))

  for (let i = 0; i < PICKS; i++) {
    // the wait below compares against a mark the PAGE holds, so it is set before the click
    await app(page, () => {
      window.__probeDealt0 = (window.__neural.beats || []).filter((b) => b.beat === "options_dealt").length
    })
    const pressed = await app(page, () => {
      const card = document.querySelector("[data-tech]")
      if (!card) return false
      card.click() // the tray card opens the option sheet
      return true
    })
    if (!pressed) { await sleep(2000); continue }
    await sleep(350)
    await app(page, () => { const go = document.querySelector("[data-go]"); if (go) go.click() })
    // the exchange resolves, the opponent answers, and the NEXT hand is dealt — or the roll
    // ended and the restart sequence deals the next roll's hand. Either way: a fresh hand.
    const dealt = await waitFor(page, () => {
      const a = window.__neural
      return (a.beats || []).filter((b) => b.beat === "options_dealt").length > window.__probeDealt0 && (a.optionIdxs || []).length > 0
    }, 30000, 600)
    if (!dealt) console.log("  (pick " + (i + 1) + ": no fresh hand within 30s — counted as-is)")
  }

  const out = await app(page, () => {
    const a = window.__neural
    const beats = a.beats || []
    const ended = beats.filter((b) => b.beat === "roll_end")
    const archived = beats.filter((b) => b.beat === "roll_archived")
    const discarded = beats.filter((b) => b.beat === "roll_discarded")
    return {
      ended: ended.length,
      outcomes: ended.map((b) => b.outcome),
      archived: archived.length,
      oneState: archived.filter((b) => b.states === 1).length,
      states: archived.map((b) => b.states),
      discarded: discarded.length,
      shelf: (a._pastRolls || []).length,
      rowsOnScreen: document.querySelectorAll("[data-past-roll]").length,
      liveRows: document.querySelectorAll("[data-hist]").length,
    }
  })

  console.log("rolls that ENDED           :", out.ended, "(" + out.outcomes.join(", ") + ")")
  console.log("archived to the shelf      :", out.archived, "states:", out.states.join(","))
  console.log("  of those, ONE-STATE rolls:", out.oneState, "<- discarded outright before v1.171.0")
  console.log("discarded (never a roll)   :", out.discarded)
  console.log("_pastRolls / rows on screen:", out.shelf, "/", out.rowsOnScreen, "  (must be equal: the pane repaints when a roll is filed)")
  console.log("live rows in This roll     :", out.liveRows)
  if (out.shelf !== out.rowsOnScreen) console.log("MISMATCH: the shelf is not what the pane is showing")
  if (out.ended !== out.archived) console.log("NOTE: " + (out.ended - out.archived) + " ended roll(s) are not on the shelf")

  await browser.close()
}

run()
