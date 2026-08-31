import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

/**
 * SETTINGS GETS A NOTIFICATIONS TAB (owner, 2026-08-31: "a notifications tab would do great").
 *
 * The training-day email toggle shipped in v1.105.7 inside Settings → FLASHCARDS, which is
 * where nobody looks for an email preference — the tab is about daily goal, answer mode and
 * study format. It moves here, alone. One row is the whole tab and that is fine: the honest
 * empty state is a real answer, and filler invented to make a tab look full would be worse
 * than the misfiling it replaces.
 *
 * What this pins, and why each one can actually break:
 *  1. The tab exists, is reachable by click (not only by `openSettings("notifications")`), and
 *     carries the row.
 *  2. The row MOVED — it is not on Flashcards any more. A copy left behind is the §6.5 shape
 *     ("one question answered in two places, one of them is already wrong"), and for a consent
 *     control that is the version that actually hurts.
 *  3. The setting key is still `emailDigest`. The digest Worker selects on
 *     `neural->settings->>emailDigest=eq.true`; renaming the key while moving the row would
 *     read to every opted-in user as a silent unsubscribe, with nothing going red.
 *  4. Signed out, the tab explains itself instead of rendering a dead toggle or a blank body.
 *     The digest needs an address, so the control genuinely cannot apply — saying so in one
 *     line is the honest empty state, and `[data-digest-setting]` must NOT be there to click.
 *
 * NOT covered here: that the Worker actually reads the key (that is
 * tests/digest_suppress_sync.test.mjs, against a PostgREST double) and anything about sending.
 */

/** The app renders the toggle only for a signed-in user; the façade is absent in a hermetic
 *  run, so seat an identity the way `_applyUser` would and re-render. */
const signIn = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    a.user = { name: "Tester", initial: "T", email: "tester@example.test" };
    a.renderSettings();
  });

const openTab = (page: any, tab: string) =>
  page.evaluate((t: string) => (window as any).__neural.openSettings(t), tab);

test("the training-day email row lives on Notifications, and only there @curated", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");

  await openTab(page, "notifications");
  await signIn(page);

  // 1. the tab is real and carries the row
  await expect(page.locator("[data-digest-setting]")).toBeVisible();

  // 1b. and it is reachable the way a user reaches it — by clicking the tab, not by calling in
  await openTab(page, "flashcards");
  await signIn(page);
  await j.clickByMouse(".t-nt");
  await expect(page.locator("[data-digest-setting]")).toBeVisible();

  // 3. the key the Worker queries is unchanged — asserted by DRIVING THE RENDERED CONTROL, not
  //    by round-tripping set/get, which is a second implementation that agrees with any key at
  //    all (§6.3). The first cut of this test did exactly that and the rename mutant survived it.
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.set("emailDigest", false);
    a.renderSettings();
  });
  await page.locator('[data-digest-setting] button', { hasText: /^On$/ }).click();
  expect(await page.evaluate(() => (window as any).__neural.get("emailDigest", false))).toBe(true);
  await page.evaluate(() => { (window as any).__neural.set("emailDigest", false); });

  // 2. it MOVED — Flashcards must not still carry it
  await openTab(page, "flashcards");
  await signIn(page);
  await expect(page.locator("[data-digest-setting]")).toHaveCount(0);
});

test("signed out, Notifications explains itself instead of showing a dead toggle @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");

  await page.evaluate(() => { (window as any).__neural.user = null; });
  await openTab(page, "notifications");

  // no control that cannot work
  await expect(page.locator("[data-digest-setting]")).toHaveCount(0);
  // but not a blank tab either — one honest line saying why
  const note = page.locator("[data-notif-signedout]");
  await expect(note).toBeVisible();
  expect((await note.innerText()).trim().length).toBeGreaterThan(20);
});
