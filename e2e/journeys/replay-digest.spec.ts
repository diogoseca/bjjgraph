import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { resolve } from "node:path"

/**
 * REPLAY DIGEST — the observable of a scripted roll, written to disk so consecutive runs can be
 * compared byte for byte. @curated
 *
 * The four determinism journeys (golden-path, jit-loop, mc-flashcards, landing-card) assert on
 * exact values, so a drift fails them. This spec adds the thing those assertions cannot give:
 * a single artifact that IS the run, so "three runs are identical" is a checkable fact rather
 * than three green ticks.
 *
 * It matters because v1.80.4 made deck residency a TIMELINE (chunks arrive over the network)
 * where it used to be an invariant (one 16.4MB monolith). One extra RNG draw in the distractor
 * pooler — the kind a "whatever has arrived so far" pool would cause — would shift every
 * subsequent draw. The digest below would change; nothing else might.
 *
 * The digest is: the fx beat stream (names + the props journeys assert on) plus the live MC
 * option texts. Wall-clock and sim-time are excluded on purpose: a clock is not behaviour.
 */

const DIR = resolve(__dirname, "../../tests/artifacts/replay")
const RUN = process.env.REPLAY_RUN || "1"

test("@curated a scripted roll produces a byte-identical replay digest", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  // rig every draw the scripted sequence can reach, so only RESIDENCY can vary between runs
  await j.rig("mc-pick", [0.11, 0.29, 0.53, 0.71, 0.37, 0.83, 0.17, 0.61])
  await j.rig("mc-shuffle", [0.5, 0.25, 0.75, 0.5])
  await j.rig("land-mc-pick", [0.13, 0.31, 0.57, 0.79, 0.41, 0.89, 0.19, 0.67])
  await j.rig("land-mc-shuffle", [0.5, 0.75, 0.25, 0.5])
  // and every gameplay draw the sequence reaches. Without these the sweep resolves off
  // Math.random and the digest differs run to run for a reason that has nothing to do with
  // residency — which is exactly the kind of false signal this artifact must not produce.
  await j.rig("resolve", [0.01, 0.01, 0.01]) // < moveChance ⇒ success
  await j.rig("outcome", [0.01, 0.01, 0.01]) // first outcome bucket
  await j.rig("escape", [0.99, 0.99])
  await j.rig("ai-skill", [0.5, 0.5, 0.5])
  await j.rig("role", [0, 0])
  await j.rig("max-moves", [0.5, 0.5])
  await j.rig("opp-pick", [0.3, 0.3])
  await j.rig("opp-sub-pick", [0.3, 0.3])
  await j.rig("opp-finish", [0.99, 0.99])
  await j.rig("auto-pick", [0.2, 0.2])
  await j.advance(2_000)

  // the landing question, if this state has one (identity + film always render)
  const landOpts = await page.locator(".ng-landcard [data-mc-opt]").allTextContents()
  if (landOpts.length) await page.locator(".ng-landcard [data-mc-opt]").first().click()
  await j.advance(1_500)

  // commit the first option and watch the sweep resolve
  const tech = await page.locator("[data-tech]").first().getAttribute("data-tech")
  await j.pick(tech!)
  await j.advance(6_000)

  const beats = (await j.beats()).map((b: any) =>
    [b.beat, b.deckKey ?? "", b.result ?? "", b.count ?? "", b.n ?? "", b.reason ?? ""].join("|"),
  )
  const digest = { landOpts, tech, beats }
  const body = JSON.stringify(digest, null, 1) + "\n"
  mkdirSync(DIR, { recursive: true })
  writeFileSync(resolve(DIR, `run-${RUN}.json`), body)
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 16)
  console.log(`[replay] run ${RUN}: ${beats.length} beats · ${landOpts.length} land options · ${hash}`)

  // if run 1 exists and this is a later run, they must match exactly
  const first = resolve(DIR, "run-1.json")
  if (RUN !== "1" && existsSync(first)) {
    expect(body, `replay run ${RUN} diverged from run 1`).toBe(readFileSync(first, "utf8"))
  }
  expect(beats.length).toBeGreaterThan(3)
})
