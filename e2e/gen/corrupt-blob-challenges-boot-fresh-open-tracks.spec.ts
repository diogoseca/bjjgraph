/* @hyperspace {"theme":"lifetime-journeys","L":"legacy-corrupt-blob","F":"challenges","B":"error-fallback"} @invariant "When bjj-neural-progress is malformed JSON, Challenges opens without crashing to a pristine profile: all five content tracks are visible and selectable, no capstone is available without checkpoint evidence, and Game Knowledge remains zero." */
import { test, expect } from "@playwright/test";
import { journey } from "../dsl";
import { CORRUPT_BLOB_RAW, CURRICULUM } from "./personas";

const KEY = "bjj-neural-progress";
const TRACKS: any[] = CURRICULUM.belts;

test("corrupt progress: Challenges recovers to five open tracks with no earned evidence", async ({
  page,
}) => {
  expect(() => JSON.parse(CORRUPT_BLOB_RAW)).toThrow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const j = journey(page);

  await j.boot("/", { keepTutorial: true });
  await page.addInitScript((raw) => {
    if (!sessionStorage.getItem("__ng_corrupt_once")) {
      sessionStorage.setItem("__ng_corrupt_once", "1");
      localStorage.setItem("bjj-neural-progress", raw);
    }
  }, CORRUPT_BLOB_RAW);
  await j.boot("/", { keepTutorial: true });

  const fresh = await page.evaluate((key) => {
    const app = (window as any).__neural;
    return {
      raw: localStorage.getItem(key),
      prep: Object.keys(app.prep || {}).length,
      rec: Object.keys(app.rec || {}).length,
      challenges: Object.keys(app.challenges || {}).length,
      badges: Object.keys(app.badges || {}).length,
      coins: Object.keys(app.coins || {}).length,
      score: app.gameScore().score,
      blobV: app._progressBlob().v,
    };
  }, KEY);
  expect(
    fresh.raw,
    "malformed bytes remain quarantined until a real progress write",
  ).toBe(CORRUPT_BLOB_RAW);
  expect(fresh.blobV, "the in-memory fallback is a valid v2 profile").toBe(2);
  expect({
    prep: fresh.prep,
    rec: fresh.rec,
    challenges: fresh.challenges,
    badges: fresh.badges,
    coins: fresh.coins,
    score: fresh.score,
  }).toEqual({
    prep: 0,
    rec: 0,
    challenges: 0,
    badges: 0,
    coins: 0,
    score: 0,
  });

  await j.land("Mount Top");
  await page.evaluate(() => (window as any).__neural.toggleExplorer());
  await expect(page.locator('[data-view="challenges"]')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__neural._viewMode)).toBe(
    "challenges",
  );
  expect(await page.locator(".ng-challenge-distinction").count()).toBe(1);
  expect(await page.locator(".ng-track-card").count()).toBe(TRACKS.length);
  expect(await page.locator(".ng-challenge-group").count()).toBeGreaterThan(0);

  for (const track of TRACKS) {
    const card = page.locator(`.ng-track-card[data-track="${track.id}"]`);
    await expect(card).toBeVisible();
    await card.click();
    expect(await card.getAttribute("aria-pressed")).toBe("true");
    const capstone = page.locator(`[data-capstone="${track.id}"] button`);
    await expect(capstone).toBeVisible();
    expect(
      await capstone.isDisabled(),
      `${track.id} capstone requires checkpoint evidence`,
    ).toBe(true);
  }

  expect(errors).toEqual([]);
});
