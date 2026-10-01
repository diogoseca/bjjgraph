/* @hyperspace {"theme":"challenges-and-belt-bar","L":"white-capstone-holder","F":"settings","B":"cross-feature"} @invariant "restartTutorial is scoped to the white drip: tut.done and the twenty white challenge entries reset to incomplete and bjj-neural-coached is removed, while advanced-track partial progress, earned badges, coins, belts.won, and gameScore().score stay identical." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder, CURRICULUM } from "./personas"

/**
 * RESTART IS A SCALPEL, NOT A WIPE — restartTutorial() (app.src.jsx:4635) must touch exactly
 * three stores: tut.done (→ {}), the twenty NG_WHITE_CHALLENGES entries (ngResetWhiteChallenges,
 * challenge-engine.src.js:244, deletes ONLY those ids), and the bjj-neural-coached flag.
 * Everything else a career-holder owns comes through bit-identical: advanced-track partial
 * progress, earned badges, coins, belts.won, and gameScore().score.
 *
 * SURFACE (line-verified): Settings → Rolling has NO Restart control anymore — the
 * [data-challenge-cue-toggle] row replaced the v1.68 "Tutorial: progress + Restart" row, and a
 * /restart/i button scan of the modal returns []. window.__neural.restartTutorial() is the
 * transitional test/API rail and the only invocation path, so this spec is authored on the
 * method choke, not a modal.
 *
 * SCORE SEAM: gameScore reads stage (per-question cardStage) — which personas cannot seed
 * (qhash is app-side) and which noteCardDone/j.drill never touch. The score is armed via
 * a._bumpStage(key, q, 3) on the first scoreWeights() deck holding >=3 cards — the weight is read
 * back and asserted > 0, so the survival assert cannot go vacuous. (Since v1.145.13 the table
 * scores positions and both seats too, so that deck is "Mount|Top" today, not a technique's
 * "|Attacker" deck as this note used to say.) _bumpStage persists through the
 * same _saveProgress choke the UI uses (synchronous in test mode), so the reload leg reads the
 * identical stage map and the float compares with toBe, not toBeCloseTo.
 *
 * SIDE-NOISE DESIGNED AROUND (probe-verified, 2x green):
 *  - boot reconciliation auto-earns white-foundations BEFORE the restart (whiteBeltHolder's
 *    track is complete at the first noteChallenges) — so badges/coins/belts are snapshotted
 *    AFTER land and compared pre<->post (badges are never revoked), never against the raw seed;
 *  - the reload's challenge_snapshot reconciliation may legally ADVANCE snapshot-rule entries
 *    (blue.recall-five sees the 3 bumped stages) — so surviving challenges are asserted BY
 *    ENTRY (blue.escape-three is event-driven: snapshots can never rewrite its progress or t),
 *    never as a whole-map equality;
 *  - all twenty white challenges are event-driven (no snapshot: rules), so the reload's
 *    reconciliation cannot re-complete any of them behind the reset.
 *
 * THE COACHED FLAG IS A LEGACY MARKER, SEEDED (gen-triage, v1.206.x). This spec used to read
 * `bjj-neural-coached` = "1" as a premise "stamped by coach dismissal" — but the first-roll coach
 * was DELETED in v1.104.0 (bb80a008c, owner: it "shows on top and is really nasty, grabbing the
 * attention") and the flag has had NO WRITER since; only pre-v1.104 profiles carry it. So the
 * premise is now set the way such a profile has it — written into localStorage before the act —
 * and the claim is unchanged: restartTutorial removes it (and the removal persists). Seeding it
 * after boot keeps it out of the boot-time `tut.done` migration, which this blob (it carries
 * `tut`) never takes anyway.
 *
 * THE DRIP STRIP IS RETIRED, THE DRIP IS NOT. "[data-tut] re-arms at step one" read a cue card
 * that v1.133.0 (e6f655a6a, owner: "remove the learning card") retired — `renderTutorial` is a
 * REMOVER now (challenge-feedback.src.js), so no [data-tut] ever mounts. The strip only ever
 * printed `tutCurrent().id` into `data-tut-step`; the spec reads that value from the app itself.
 *
 * RELOAD LEG boots {preserveStorage:true, keepTutorial:true}: the DSL's default tut-completion
 * would re-complete the twenty and mask a reset that never persisted.
 *
 * Determinism census: land-mc-pick/land-mc-shuffle pre-sized BEFORE land() (the landing
 * question mounts at coach handover inside land's pump and draws only these land-scoped tags);
 * land()'s built-ins cover ai-skill/role/max-moves; no commit ever happens, so no resolve or
 * outcome draws exist; the reload leg deals no hand at all.
 *
 * Red-proof seams: an over-broad reset fails the blue.escape-three/badges/coins/belts.won
 * deep-equals or the score toBe; a reset that misses a store fails 0/20, tut.done {}, or
 * coached-null; a non-persisted reset fails the entire reload leg; a restart that clears
 * stage fails score bit-equality on both legs.
 */

const WHITE_ID = CURRICULUM.belts[0].id
const BLUE_SEED = { progress: 2, done: false, t: 100 } // real id blue.escape-three, target 3, event "escape"

test("restartTutorial resets exactly the white drip — and the reset survives a reload", async ({ page }) => {
  const j = journey(page)
  const seed: any = whiteBeltHolder()
  seed.challenges = { "blue.escape-three": { ...BLUE_SEED } }
  seed.coins = { houdini: { t: 50 } }
  seed.badges = { "clean-checkpoint": { t: 60 } }
  await j.boot("/", { initialState: seed })

  // land-scoped MC rig BEFORE land(): pre-sized queues for the landing question's pool picks
  // and option shuffle — these tags never touch the sidebar's mc-* queues
  await j.rig("land-mc-pick", [
    0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 0.11, 0.91,
  ])
  await j.rig("land-mc-shuffle", [0.2, 0.5, 0.8, 0.35, 0.65, 0.95, 0.14, 0.42])
  await j.land("Mount Top")
  await page.waitForFunction(() => !!(window as any).__neural?.scoreWeights?.())
  // the pre-v1.104 coach marker — no writer exists since the coach's deletion (see header).
  // Owner-scoped since PR #231 (v1.208.x): the guest's copy is what restartTutorial clears.
  await page.evaluate(() => localStorage.setItem("bjj-neural-owner:guest:coached", "1"))

  // arm the score: recall-prove 3 cards of the first WEIGHTED deck (position or technique seat)
  const armed = await page.evaluate(() => {
    const a = (window as any).__neural
    const w = a.scoreWeights() // compact wire since v1.145.13; scoreWeights() is the one expander
    let key = ""
    for (const k of Object.keys(w)) {
      const d = a.flashcards.decks[k]
      if (d && d.cards && d.cards.length >= 3) { key = k; break }
    }
    if (!key) return { key: "", weight: 0 }
    for (let i = 0; i < 3; i++) a._bumpStage(key, a.flashcards.decks[key].cards[i].q, 3)
    return { key, weight: w[key] }
  })
  expect(armed.key, "a weighted technique deck with >=3 cards exists").toBeTruthy()
  expect(armed.key, "weights name role-split decks (Position|Seat), never bare hub keys").toContain("|")
  expect(armed.weight, "and the bumped deck genuinely carries score weight").toBeGreaterThan(0)

  const readState = () =>
    page.evaluate(() => {
      const a = (window as any).__neural
      return {
        white: a.challengeTrackProgress("white"),
        whiteKeys: Object.keys(a.challenges || {}).filter((k: string) => k.indexOf("white.") === 0).length,
        tutMap: JSON.parse(JSON.stringify((a.tut && a.tut.done) || null)),
        coached: localStorage.getItem("bjj-neural-owner:guest:coached"),
        blue: (a.challenges && a.challenges["blue.escape-three"]) || null,
        badges: JSON.parse(JSON.stringify(a.badges || {})),
        coins: JSON.parse(JSON.stringify(a.coins || {})),
        beltsWon: JSON.parse(JSON.stringify((a.belts && a.belts.won) || {})),
        score: a.gameScore().score,
      }
    })

  // ── pre-state: the DSL's tut-completion + coach dismissal put the holder at full drip ──
  const pre = await readState()
  expect(pre.white, "white track complete before the restart").toEqual({ done: 20, total: 20, complete: true })
  expect(pre.whiteKeys, "compatibility sync wrote all twenty white.* entries").toBe(20)
  expect(Object.keys(pre.tutMap).length, "all twenty drip steps done").toBe(20)
  expect(pre.coached, "the legacy coached marker is present before the restart (seeded — no writer since v1.104.0)").toBe("1")
  expect(pre.blue, "seeded advanced-track partial progress is live").toEqual(BLUE_SEED)
  expect(pre.coins.houdini, "seeded coin is live").toEqual({ t: 50 })
  expect(pre.badges["clean-checkpoint"], "seeded badge is live").toEqual({ t: 60 })
  expect(pre.badges["white-foundations"], "boot reconciliation earned the track badge pre-restart (expected side-noise)").toBeTruthy()
  expect(pre.beltsWon, "capstone record present").toEqual({ [WHITE_ID]: { moves: 14, dominance: 4, byPoints: false } })
  expect(pre.score, "the armed score is nonzero — the survival assert has teeth").toBeGreaterThan(0)

  // ── THE ACT: the method choke (no Settings Restart control exists anymore) ──
  await page.evaluate(() => (window as any).__neural.restartTutorial())

  const post = await readState()
  // the scalpel's cut: white drip stores reset...
  expect(post.white, "white track back to 0/20").toEqual({ done: 0, total: 20, complete: false })
  expect(post.whiteKeys, "every white.* challenge entry deleted").toBe(0)
  expect(post.tutMap, "tut.done wiped to empty").toEqual({})
  expect(post.coached, "the (owner-scoped) coached marker removed").toBeNull()
  // v1.133.0 retired the strip that printed this; the drip's own cursor is the same value
  expect(
    await page.evaluate(() => { const c = (window as any).__neural.tutCurrent(); return c ? c.id : null }),
    "the white drip re-arms at step one",
  ).toBe("coach1")
  // ...and nothing else moved: survivals deep-equal the pre snapshot, score to the bit
  expect(post.blue, "blue.escape-three untouched").toEqual(BLUE_SEED)
  expect(post.badges, "badges identical (never revoked)").toEqual(pre.badges)
  expect(post.coins, "coins identical").toEqual(pre.coins)
  expect(post.beltsWon, "belts.won identical").toEqual(pre.beltsWon)
  expect(post.score, "gameScore().score bit-identical").toBe(pre.score)

  // ── RELOAD LEG: keepTutorial, or the DSL would re-complete the twenty and mask the reset ──
  await j.boot("/", { preserveStorage: true, keepTutorial: true })
  await page.waitForFunction(() => !!(window as any).__neural?.scoreWeights?.())
  const back = await readState()
  expect(back.white, "persisted reset: still 0/20 after reload").toEqual({ done: 0, total: 20, complete: false })
  expect(back.whiteKeys, "no white.* entries resurrect (all twenty are event-driven)").toBe(0)
  expect(back.tutMap, "tut.done persisted empty").toEqual({})
  expect(back.coached, "coached flag stays removed").toBeNull()
  expect(back.blue, "blue.escape-three survives the round-trip verbatim").toEqual(BLUE_SEED)
  expect(back.badges, "badges identical across reload").toEqual(pre.badges)
  expect(back.coins, "coins identical across reload").toEqual(pre.coins)
  expect(back.beltsWon, "belts.won identical across reload").toEqual(pre.beltsWon)
  // KNOWN RED (gen-triage on dev 8d6ae5d01, REAL BREAK — not a spec defect): the reload reads 0.
  // gameScore() memoises on `_stageVer`; the deck MANIFEST's `_bumpStageVer` calls
  // renderTabSubtitles -> gameScore() BEFORE curriculum.json (the weights) lands, memoising
  // score 0 at that version, and `_onCurriculum` never bumps it — so the 0 sticks until a grade
  // or a deck hydration. Measured: memo {v:1, s:0} vs a fresh recompute 0.00585 (= pre); a probe
  // build adding `_bumpStageVer()` to `_onCurriculum` turns this whole spec green.
  expect(back.score, "score recomputed from persisted stage — bit-identical").toBe(pre.score)
})
