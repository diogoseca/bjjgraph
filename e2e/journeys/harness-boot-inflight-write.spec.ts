import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * THE HARNESS ITSELF, UNDER TEST: `j.boot()` must leave NO in-flight progress write behind.
 *
 * Why this spec exists (v1.81.2). `corrupt-blob-settings-persist-cleanly-after-heal` passed in
 * isolation and failed as spec #7 of a 112-spec run, which reads like flake and is not: it is a
 * race against a DEFERRED PAYLOAD.
 *
 *   · `boot()`'s readiness predicate waits for graph + flashcards, NOT for curriculum.json.
 *   · The app finishes that fetch with `_onCurriculum() -> _refreshChallengeEvidence()`, and
 *     that pass calls `_saveProgress()` whenever it finds durable change.
 *   · `boot()` then completes the 20 White compatibility objectives (default).
 *   · So when curriculum lands AFTER that step, the evidence pass finds 20 completions plus a
 *     minted badge and WRITES — over whatever the spec had seeded into localStorage.
 *
 * Measured with the fetch delayed 2s: `_refreshChallengeEvidence -> noteChallenges ->
 * _saveProgress` wrote a 1,654-byte valid blob over a seeded corrupt one. Undelayed, no write
 * happened at all. A busy machine is the delay.
 *
 * This test forces the slow ordering on purpose and asserts the seeded bytes survive, so the
 * fix (boot waits for the curriculum payload BEFORE planting evidence) cannot be undone
 * silently. Every seeded-storage journey in e2e/gen depends on it.
 */

const KEY = "bjj-neural-progress";
const SENTINEL = '{"v":2,"prep":{{{ definitely-not-json';

test("boot() leaves no in-flight progress write, even when curriculum.json lands late @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");

  // one-shot seed + a spy on every write to the progress key, installed before the app boots
  await page.addInitScript((raw) => {
    try {
      if (!sessionStorage.getItem("__ng_seed_once")) {
        sessionStorage.setItem("__ng_seed_once", "1");
        localStorage.setItem("bjj-neural-progress", raw);
      }
      const proto = Object.getPrototypeOf(localStorage);
      const setItem = proto.setItem;
      (window as any).__progressWrites = [];
      proto.setItem = function (k: string, v: string) {
        if (k === "bjj-neural-progress")
          (window as any).__progressWrites.push({
            len: v.length,
            stack: new Error().stack?.split("\n").slice(1, 5).join(" | "),
          });
        return setItem.call(this, k, v);
      };
    } catch {}
  }, SENTINEL);

  // FORCE the slow ordering a contended run produces by itself. Registered after the DSL's own
  // handler, so it matches first (Playwright routes are last-first).
  const curriculum = readFileSync(
    resolve(__dirname, "../../source/public/static/neural/curriculum.json"),
  );
  await page.route("**/curriculum.json", async (r) => {
    await new Promise((res) => setTimeout(res, 2000));
    await r.fulfill({ body: curriculum, contentType: "application/json" });
  });

  await j.boot("/");

  const after = await page.evaluate((key) => ({
    raw: localStorage.getItem(key),
    writes: (window as any).__progressWrites,
    curriculum: !!(window as any).__neural.curriculum,
    tutDone: Object.keys((window as any).__neural.tut?.done || {}).length,
  }), KEY);

  expect(
    after.curriculum,
    "premise: boot() returned only after the (delayed) curriculum payload landed",
  ).toBe(true);
  expect(
    after.tutDone,
    "premise: boot() did complete the 20 White compatibility objectives, i.e. the evidence that " +
      "would make a challenge-evidence pass want to save",
  ).toBe(20);
  expect(
    after.writes,
    `boot() wrote progress ${after.writes.length}x — a seeded blob is not safe from the harness`,
  ).toEqual([]);
  expect(
    after.raw,
    "the seeded bytes are byte-identical after boot()",
  ).toBe(SENTINEL);

  // …and stay that way through REAL idle time: the risk is a deferred payload's callback, which
  // rides real time, not the sim clock. (Once a spec pumps the sim clock or plays, the app
  // legitimately writes its own state — that is not what this guards.)
  await page.waitForTimeout(1500);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), KEY),
    "and no late-landing payload writes behind the spec's back",
  ).toBe(SENTINEL);
  expect(
    await page.evaluate(() => (window as any).__progressWrites),
    "still zero writes",
  ).toEqual([]);
});
