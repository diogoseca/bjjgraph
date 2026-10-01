/* @hyperspace {"theme":"lifetime-journeys","L":"legacy-corrupt-blob","F":"drill-recall","B":"persistence-reload"} @invariant "Malformed unknown-owner legacy bytes remain unchanged; the first real action writes a separate owned guest profile whose evidence/settings survive reload without importing legacy data." */
import { test, expect } from "@playwright/test";
import { journey } from "../dsl";
import { CORRUPT_BLOB_RAW, CURRICULUM } from "./personas";

/**
 * Unknown-owner legacy corruption stays byte-identical. Real grading writes a
 * separate guest-owned v2 profile which survives preserveStorage reload. The
 * one-shot raw seed runs after the DSL registration boot and is not replayed on
 * preserving reloads. No implicit legacy import and no production auth bypass.
 * Owned-cache corruption is a separate fail-closed recovery case.
 */

const LESSON1: any = CURRICULUM.belts?.[0]?.units?.[0]?.lessons?.[0] ?? null;
const KEY = "bjj-neural-progress";

test("corrupt legacy bytes stay unchanged; first guest grade persists separately across reload", async ({
  page,
}) => {
  test.skip(
    !LESSON1?.deckKey,
    "curriculum lost white unit-1 lesson-1 — the drill premise is gone",
  );
  expect(
    () => JSON.parse(CORRUPT_BLOB_RAW),
    "persona premise: the corrupt blob must not parse",
  ).toThrow();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const j = journey(page);

  // ── Boot 1 (throwaway): registers the DSL wipe/ngseed init scripts AHEAD of our seed ──
  await j.boot("/", { keepTutorial: true });

  // ── One-shot poison seed: runs AFTER the DSL wipe on every later boot, writes only once —
  //    the wiping boot 2 seeds it; the preserving boot 3 must NOT re-seed ──
  await page.addInitScript((raw) => {
    try {
      if (!sessionStorage.getItem("__ng_corrupt_once")) {
        sessionStorage.setItem("__ng_corrupt_once", "1");
        localStorage.setItem("bjj-neural-progress", raw);
      }
    } catch {}
  }, CORRUPT_BLOB_RAW);

  // ── Boot 2: pagehide flush (dying boot-1 app) → wipe → our poison → app preserves the unknown-owner poison ──
  await j.boot("/", { keepTutorial: true });
  const fallback = await page.evaluate((key) => {
    const a = (window as any).__neural;
    return {
      raw: localStorage.getItem(key),
      blobV: a._progressBlob().v,
      prepKeys: Object.keys(a.prep || {}).length,
      recKeys: Object.keys(a.rec || {}).length,
    };
  }, KEY);
  expect(
    fallback.raw,
    "seed-order proof: the poison survived boot 2's flush+wipe gauntlet",
  ).toBe(CORRUPT_BLOB_RAW);
  expect(fallback.blobV, "fallback profile re-serializes as v2 in memory").toBe(
    2,
  );
  expect(
    fallback.prepKeys,
    "fresh fallback: zero prep keys ingested from the poison",
  ).toBe(0);
  expect(
    fallback.recKeys,
    "fresh fallback: zero rec keys ingested from the poison",
  ).toBe(0);

  // ── Quarantine: byte-identical through boot (no default-setting write) ──
  expect(
    await page.evaluate((key) => localStorage.getItem(key), KEY),
    "corrupt string byte-identical in storage before the first grade",
  ).toBe(CORRUPT_BLOB_RAW);

  // ── First grade: the heal ──
  await j.drill(1, LESSON1.deckKey);
  await j.expectBeat("bonus_pumped");

  const healed = await page.evaluate(
    ([key, dk]) => {
      const a = (window as any).__neural;
      a._flushSave(); // explicit pin (the grade's _saveProgress already wrote synchronously in test mode)
      const raw = window.__ngGuestProgressRaw();
      let parsed: any = null;
      let parseOk = false;
      try {
        parsed = JSON.parse(raw || "");
        parseOk = true;
      } catch {}
      return {
        raw,
        parseOk,
        v: parsed?.v,
        prepAtKey: parsed?.prep?.[dk],
        memPrep: a.prep[dk] || 0,
      };
    },
    [KEY, LESSON1.deckKey as string] as const,
  );
  expect(healed.raw, "the first grade created separate owned guest progress").not.toBe(
    CORRUPT_BLOB_RAW,
  );
  expect(healed.parseOk, "stored blob parses again").toBe(true);
  expect(healed.v, "stored blob is v2").toBe(2);
  expect(
    healed.prepAtKey,
    "stored prep carries the graded deckKey (>=1)",
  ).toBeGreaterThanOrEqual(1);
  expect(
    healed.memPrep,
    "in-memory prep for the graded deckKey (>=1)",
  ).toBeGreaterThanOrEqual(1);

  // ── Boot 3 (preserveStorage): the healed blob — not the poison — is what loads ──
  await j.boot("/", { preserveStorage: true, keepTutorial: true });

  const post = await page.evaluate(
    ([key, dk]) => {
      const a = (window as any).__neural;
      const raw = window.__ngGuestProgressRaw();
      let parsed: any = null;
      let parseOk = false;
      try {
        parsed = JSON.parse(raw || "");
        parseOk = true;
      } catch {}
      return {
        raw,
        parseOk,
        storedV: parsed?.v,
        storedPrep: parsed?.prep?.[dk],
        memV: a._progressBlob().v,
        memPrep: a.prep[dk] || 0,
      };
    },
    [KEY, LESSON1.deckKey as string] as const,
  );
  expect(
    post.parseOk,
    "post-reload JSON.parse of stored progress succeeds",
  ).toBe(true);
  expect(
    post.raw,
    "the poison never resurrects (one-shot seed did not refire)",
  ).not.toBe(CORRUPT_BLOB_RAW);
  expect(post.storedV, "post-reload stored blob is v2").toBe(2);
  expect(
    post.storedPrep,
    "graded prep key persisted in storage across the reload",
  ).toBeGreaterThanOrEqual(1);
  expect(post.memV, "post-reload _progressBlob().v === 2").toBe(2);
  expect(
    post.memPrep,
    "graded prep key re-ingested in memory across the reload",
  ).toBeGreaterThanOrEqual(1);

  // ── Crash guard: corrupt read, heal, and reload all ran with zero page errors ──
  expect(await page.evaluate(() => localStorage.getItem("bjj-neural-progress")),
    "unknown-owner legacy bytes remain preserved after guest writes and reload").toBe(CORRUPT_BLOB_RAW);
  expect(errors, "no pageerror across poison boot + heal + reload").toEqual([]);
});
