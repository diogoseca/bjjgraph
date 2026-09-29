import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * WINNING vs NOT LOSING IS RETIRED (v1.207.0; owner ruling 2026-09-29).
 *
 * The dial (v1.124.0: Sport / Slightly cautious / Self-defence) chose which EDGE block the app read.
 * The full game's card number is pure Win chance (the MDP's own objective: most wins, then fewer
 * losses) and the hand sorts itself by it once, so the dial only reordered the few seconds before
 * values arrived and nudged the opponent's tie-breaks. The owner retired it. CLAUDE.md §6.6: a
 * settings key can never be deleted, so the retirement is "never read it again": the stored
 * `lossAversion` stays in the blob, unread, and the wire ships only the default block (λ = 2).
 *
 * What these journeys pin, on the real app and the real emitted wire:
 *   1. Settings → Rolling has no row for it, and says nothing about it;
 *   2. the wire carries exactly one block, the owner's default;
 *   3. a stored "Self-defence" (4) changes neither any dealt hand's order nor what EDGE reads.
 *
 * NON-KILL, named so nobody reads this file as covering it (CLAUDE.md §6.3): re-reading the stored
 * key in `_evLamIdx` does NOT turn test 3 red here, because with a one-block wire `indexOf(4)` is -1
 * and the fallback lands on the same block. That mutant is killed by the unit gate instead:
 * tests/settings_presentation.test.mjs runs the real app against a THREE-block fixture wire and
 * asserts `_evLamIdx()` stays on the default with a stored 4.
 */

/** Every live role-hand: the dealt order, read with the app's own optionsFor. Fixed aiSkill, no user
 *  mods and a position key with no drilling bonus, so nothing depends on an earlier journey. */
const WALK = `(() => {
  const a = window.__neural;
  a.aiSkill = 0.13; a.userMods = null;
  const keepPos = a.currentPos, keepRole = a.playerRole, keepKey = a._posKey;
  a._posKey = "__lamwalk__";
  const out = [];
  for (let pi = 0; pi < a.nodes.length; pi++) {
    const p = a.nodes[pi];
    if (p.ty !== "positions" || !p.posId) continue;
    for (const role of ["top", "bottom"]) {
      a.currentPos = pi; a.playerRole = role;
      const dealt = a.optionsFor(pi);
      if (dealt.length >= 2) out.push({ st: p.posId + "/" + role, order: dealt.map((o) => o.node.t) });
    }
  }
  a.currentPos = keepPos; a.playerRole = keepRole; a._posKey = keepKey;
  return out;
})()`;

test("@curated the retired dial is gone from Settings, and the wire ships only the default block", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await page.evaluate(() => (window as any).__neural.openSettings("rolling"));
  const s = await page.evaluate(() => {
    const m = document.querySelector("[data-settings]") || document.querySelector(".ng-modal");
    return { text: m ? (m as HTMLElement).innerText : "", row: !!document.querySelector("[data-settings-loss]"),
      picks: document.querySelectorAll("[data-loss-pick]").length, gi: !!document.querySelector("[data-settings-gi]") };
  });
  expect(s.gi, "Settings → Rolling itself rendered (positive control)").toBe(true);
  expect(s.row, "no loss-aversion row").toBe(false);
  expect(s.picks, "no preset buttons").toBe(0);
  expect(s.text).not.toMatch(/Winning vs not losing|Self-defence|Slightly cautious/);
  expect(await page.evaluate(() => (window as any).__neural._evLam), "one EDGE block on the wire: the owner's default").toEqual([2]);
});

test("@curated a stored Self-defence choice changes no dealt hand and nothing EDGE reads", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  const before = await page.evaluate(WALK);
  expect(before.length, "positive coverage: every live role-hand walked").toBeGreaterThan(200);
  const idx = await page.evaluate(() => {
    const a = (window as any).__neural;
    const at2 = a._evLamIdx();
    a.set("lossAversion", 4);           // what an older device may still carry in its blob
    return { at2, at4: a._evLamIdx(), stored: a.get("lossAversion") };
  });
  expect(idx.stored, "the key is kept, never deleted (§6.6)").toBe(4);
  expect(idx.at4, "EDGE reads the default block whatever is stored").toBe(idx.at2);
  const after = await page.evaluate(WALK);
  expect(after, "every dealt hand keeps its order").toEqual(before);
});
