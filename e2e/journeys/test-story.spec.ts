import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * CONTENT CAPSTONE STORY (one continuous gameplay journey).
 *
 * A player with White unit evidence takes the optional content capstone:
 * available capstone → focused roll → win by tap → restrained celebration → reload →
 * cleared proof persists while every other content track stays open.
 */

const CURRICULUM = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../source/public/static/neural/curriculum.json"),
    "utf8",
  ),
);
const WHITE = CURRICULUM.belts[0];
const BLUE = CURRICULUM.belts[1];

function whiteDoneBlob() {
  const prep: Record<string, number> = {};
  const units: Record<string, any> = {};
  for (const u of WHITE.units) {
    units[`${WHITE.id}/${u.id}`] = { checkpoint: true, t: 1 };
    for (const l of u.lessons) prep[l.deckKey] = 3;
  }
  return {
    v: 2,
    prep,
    rec: { ...prep },
    stage: {},
    units,
    belts: { won: {} },
    days: {},
    settings: {},
  };
}

async function playToTap(j: any, page: any, maxMoves = 8): Promise<boolean> {
  for (let m = 0; m < maxMoves; m++) {
    const sub = await page.evaluate(() => {
      const a = (window as any).__neural;
      const subs = (a.optionIdxs || [])
        .map((i: number) => a.nodes[i])
        .filter((n: any) => n.ty === "submissions");
      return subs.length ? subs[0].t : null;
    });
    await j.rig("resolve", [0.01]);
    await j.rig("outcome", [0.01]);
    if (sub) {
      await j.pick(sub);
      await j.advanceUntil("roll_end", 20000);
      return true;
    }
    const t = await page.evaluate(() => {
      const a = (window as any).__neural;
      let fallback = null;
      for (const i of a.optionIdxs || []) {
        const n = a.nodes[i];
        if (n.ty !== "transitions") continue;
        fallback = fallback || n.t;
        const res = a.resultPos(i, a.currentPos);
        if (
          res >= 0 &&
          a.adj[res].some((k: number) => a.nodes[k].ty === "submissions")
        )
          return n.t;
      }
      return fallback;
    });
    if (!t) return false;
    await j.pick(t);
    await j.nextHand(30000);
  }
  return false;
}

test("content capstone story: evidence → roll → tap → acknowledgement → proof persists", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/", { initialState: whiteDoneBlob() });
  await j.land("Mount Top");

  // ── the available capstone is the invitation ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer());
  // THE CORRIDOR FOLDS COMPLETED BELTS (v1.98.0/v1.99.2): with White done, the frontier is Blue,
  // so White's section body — and the capstone button in it — is display:none until its header
  // is clicked ("clicking a folded header selects AND opens"). The invitation is one unfold away.
  await page.locator(`.ng-track-card[data-track="${WHITE.id}"]`).click();
  const capstone = page.locator(`[data-capstone="${WHITE.id}"] button`);
  await expect(capstone).toBeEnabled();
  await capstone.click();
  await j.advanceUntil("belt_test_start", 20000);
  await j.nextHand(30000);
  await j.keyframe("content-capstone-start");

  // ── the boss battle: play to the tap ──
  expect(await playToTap(j, page)).toBe(true);

  // ── acknowledgement: capstone proof is ordered before the generic roll result ──
  const names = (await j.beats()).map((b: any) => b.beat);
  expect(names.indexOf("belt_test_won")).toBeGreaterThanOrEqual(0);
  expect(names.indexOf("belt_test_won")).toBeLessThan(
    names.indexOf("roll_end"),
  );
  expect(names).not.toContain("belt_unlocked");
  expect(names).toContain("victory_cascade");
  const sounds = await j.soundLog();
  expect(
    sounds.some(
      (s: any) => s.beat === "belt_test_won" && s.patch.includes("fanfare"),
    ),
  ).toBe(true);
  await j.keyframe("content-capstone-cleared");

  // ── reload: the proof is durable and other tracks remain independently open ──
  await j.boot("/", { preserveStorage: true });
  await j.land("Mount Top");
  await page.evaluate(() => (window as any).__neural.toggleExplorer());
  await page.locator(`.ng-track-card[data-track="${WHITE.id}"]`).click(); // unfold (see above)
  await expect(page.locator(`[data-capstone="${WHITE.id}"] button`)).toHaveText(
    "Capstone cleared",
  );
  await expect(page.locator(".ng-track-card")).toHaveCount(5);

  // ── Blue was never a reward; it remains genuinely playable on its own ──
  await page.locator(`.ng-track-card[data-track="${BLUE.id}"]`).click();
  const blueLesson = BLUE.units[0].lessons[0];
  await page
    .locator(`.ng-challenge-lesson[data-lesson="${blueLesson.deckKey}"]`)
    .click();
  await j.advance(1000);
  // v1.105.2: the row click reads INLINE now (no takeover) — this stays a REAL click because it
  // is the final proof the Blue row does something; the evidence is the inline deck + no takeover.
  expect(
    await page.evaluate((dk: string) => !!document.querySelector(`[data-mini-deck="${dk}"], [data-mini-deck-state]`), blueLesson.deckKey),
    "the inline Q&A opened",
  ).toBe(true);
  expect(
    await page.evaluate(() => (window as any).__neural._paneStudyActive()),
    "and the pane was not taken over",
  ).toBe(false);
});
