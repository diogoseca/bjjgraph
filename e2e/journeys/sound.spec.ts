import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * BELT PATH P3 — SATISFYING SOUNDS ON THE fx() BEAT BUS (spec first).
 *
 * One WebAudio synth module (neural/src/sound.src.js, composed into the bundle) subscribes
 * to fx() — every present and future beat is audible for free; audio, journeys and animation
 * share one vocabulary. Under isTest() NO AudioContext is ever created: beats log to a ring
 * buffer (window.__neural.sound.soundLog) that journeys read exactly like the beats array.
 *
 * Surfaces forced into existence:
 *   NGSound {beat(name, props), soundLog, _ctxCreated} · this.sound wired in boot ·
 *   one-line hook in fx() · settings rows sound (on/off) + soundVolume · rate limits
 *   (≥40ms voice spacing, 100ms same-beat dedupe) · rng("sfx") only (check_no_raw_random
 *   covers the file with count 0).
 */

test("the ring buffer logs patches for gameplay beats", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const log0 = await j.soundLog()

  await j.drill(1) // grade a card → bonus_pumped
  const log = await j.soundLog()
  expect(log.length).toBeGreaterThan(log0.length)
  const entry = log.filter((s: any) => s.beat === "bonus_pumped").pop() as any
  expect(entry).toBeTruthy()
  expect(typeof entry.patch).toBe("string")
  expect(entry.patch.length).toBeGreaterThan(0)
})

test("a rigged win plays the victory fanfare", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const subName = await page.evaluate(() => {
    const a = (window as any).__neural
    const subs = (a.optionIdxs || []).map((i: number) => a.nodes[i]).filter((n: any) => n.ty === "submissions")
    return subs.length ? subs[0].t : null
  })
  test.skip(!subName, "no submission from the start position")
  await j.rig("resolve", [0.01])
  await j.pick(subName as string)
  await j.advanceUntil("roll_end", 20000)

  const log = await j.soundLog()
  const fanfare = log.filter((s: any) => s.beat === "victory_cascade").pop() as any
  expect(fanfare).toBeTruthy()
  expect(fanfare.patch).toContain("fanfare")
})

test("sound off: the log goes silent", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.set("sound", "off"))
  const n0 = (await j.soundLog()).length
  await j.drill(2)
  expect((await j.soundLog()).length).toBe(n0)
})

test("volume setting rides every logged voice", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.set("soundVolume", "0.8"))
  await j.drill(1)
  const entry = (await j.soundLog()).pop() as any
  expect(entry.volume).toBeCloseTo(0.8, 5)
})

test("same-beat dedupe: two identical beats within 100ms log one voice", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const n = await page.evaluate(() => {
    const a = (window as any).__neural
    const before = a.sound.soundLog.length
    a.fx("bonus_pumped", { deck_key: "x" })
    a.fx("bonus_pumped", { deck_key: "x" }) // immediate repeat → deduped
    return a.sound.soundLog.length - before
  })
  expect(n).toBe(1)
})

test("no AudioContext is ever created under test", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.drill(1)
  const state = await page.evaluate(() => {
    const s = (window as any).__neural.sound
    return { ctxCreated: s._ctxCreated, logNonEmpty: s.soundLog.length > 0 }
  })
  expect(state.ctxCreated).toBe(false)
  expect(state.logNonEmpty).toBe(true)
})
