import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";
import { beforeNeuralAuthNavigate, signInNeuralAuthSDK, waitNeuralAuthOwner } from "../fixtures/neural-auth-sdk";

/**
 * SETTINGS → NOTIFICATIONS, AND THE TRAINING-DAY EMAIL WHILE IT IS NOT LIVE.
 *
 * History: the email switch shipped inside Flashcards (v1.105.7) and moved, alone, to its own
 * Notifications tab (owner, 2026-08-31: "a notifications tab would do great"). On 12 Nov 2026 the
 * owner answered U139 a: "Hide it while the digest is off." The digest cannot send (its two tables
 * are not in production, supabase/schema.sql's header), so turning the switch on sent nothing and
 * only started recording a day log. `NG_DIGEST_LIVE` (neural/src/app.src.jsx) is false, and while it
 * is false `openSettings` decides, once per opening:
 *
 *  1. Signed in with the setting off: no Notifications tab and no row. A link to it (and the arrow
 *     keys) never land on it; the link opens the first tab. Nothing stored changes: opening Settings
 *     and pressing every tab writes no `emailDigest`, locally or to the account.
 *  2. Signed in with the setting STORED ON (seeded in the account's cloud blob, the real case): the
 *     tab and the row stay, so the account can turn it off; the row says no email is being sent yet.
 *     Off stores false (the key the digest worker reads), the row stays for the rest of this opening,
 *     and the tab is gone from the next opening on. Pressed by mouse at 1440 and by a real touch tap
 *     at 390.
 *  3. Signed out: as in v1.259.1. The tab is there, with its one line and no switch.
 *  4. Flipped (the constant true, served by rewriting the built bundle): v1.259.1's Settings. Five
 *     tabs for a signed-in player with the setting off, the row without the not-sent sentence, and On
 *     stores true. The rewrite must match exactly once, or the test fails naming it.
 *
 * The same rules over the real app and Settings code, without a browser, are in
 * tests/settings_presentation.test.mjs (the U139 a and "flipped" tests), including a check that the
 * flipped row's words are v1.259.1's to the letter.
 *
 * MUTANTS (v1.262.1, each killed a named test here; exact patches and the run in
 * docs/Changelog-Archive.md, DIGEST1): see that entry. Non-kills, so nobody reads them as coverage:
 * none recorded.
 *
 * NOT covered here: anything about sending (the worker's own tests), the cloud merge of the setting
 * across devices (per-key LWW, unchanged), and the visual placement of the "Beta" badge.
 */

const SETTINGS_TABS = '[role="tablist"][data-settings-tabs] [role="tab"]';
const ROW = "[data-digest-setting]";
const OFF = "[data-digest-setting] button:nth-of-type(2)";
const ON = "[data-digest-setting] button:nth-of-type(1)";
const UNSENT = "No email is being sent yet.";
// v1.259.1's own words for the row, for the flipped test's "to the letter".
const V1259_ROW =
  "After a day you reviewed something: your techniques, your Game Knowledge, your streak — mailed to player@example.com.";

const tabIds = (page: Page) =>
  page.locator(SETTINGS_TABS).evaluateAll((els) => els.map((e) => e.getAttribute("data-settings-tab")));
/** The selected tab's id, or null when none is (read at once, so a missing selection is a red, not a wait). */
const selected = (page: Page) =>
  page.evaluate(() => {
    const t = document.querySelector('[role="tablist"][data-settings-tabs] [role="tab"][aria-selected="true"]');
    return t ? t.getAttribute("data-settings-tab") : null;
  });
const stored = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    return { value: (a.settings || {}).emailDigest, at: (a._settingsAt || {}).emailDigest };
  });
/** Every write the account received, reduced to what it said about the switch. */
const cloudWrites = (page: Page) =>
  page.evaluate(() =>
    (window as any).__authOwnerFixture.snapshot().writes.map((w: any) => (w.neural && w.neural.settings ? w.neural.settings.emailDigest : undefined)),
  );

async function bootSignedIn(page: Page, id: string, cloudSetting?: boolean, before?: (page: Page) => Promise<void>) {
  const j = journey(page);
  await j.boot("/", {
    beforeNavigate: async (p) => {
      await beforeNeuralAuthNavigate(p);
      if (before) await before(p);
    },
  });
  await waitNeuralAuthOwner(page, null);
  if (cloudSetting !== undefined)
    await page.evaluate(
      ([id, on]) =>
        (window as any).__authOwnerFixture.seedCloud(id, { v: 2, settings: { emailDigest: on }, settingsAt: { emailDigest: 1000 }, updatedAt: 1000 }),
      [id, cloudSetting] as [string, boolean],
    );
  await signInNeuralAuthSDK(page, id, { email: "player@example.com", name: "Player" });
  await j.land("Mount Top");
  return j;
}

/** Settings the way a player opens it: the badge, then its Settings row, by mouse. Settings is a
 *  deferred chunk, so nothing is read until its tab row is drawn. */
async function openSettingsFromMenu(page: Page, j: ReturnType<typeof journey>, badge = "the signed-in badge") {
  await j.openAccountMenu(badge);
  await j.clickByMouse("[data-menu-settings]", "Settings");
  await expect(page.locator('[role="tablist"][data-settings-tabs]')).toBeVisible();
}

/** Esc closes Settings (the modal is hidden, its last render stays in the DOM until the next one). */
async function closeSettings(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator('[role="tablist"][data-settings-tabs]')).toBeHidden();
}

/**
 * A REAL TOUCH TAP at the centre of the part of `sel` that is on screen and inside `within` (a tab
 * can sit half under the row's fade at 390). The point is proven to be the target's own first, so a
 * tap that would miss fails here instead of proving nothing.
 */
async function tap(page: Page, sel: string, what: string, within?: string) {
  const p = await page.evaluate(
    ([sel, within]) => {
      const el = document.querySelector(sel as string);
      if (!el) return { ok: false, x: 0, y: 0, why: "no element matches" };
      const r = el.getBoundingClientRect();
      let l = Math.max(r.left, 0), rt = Math.min(r.right, innerWidth), t = Math.max(r.top, 0), b = Math.min(r.bottom, innerHeight);
      if (within) {
        const w = document.querySelector(within as string)!.getBoundingClientRect();
        l = Math.max(l, w.left); rt = Math.min(rt, w.right); t = Math.max(t, w.top); b = Math.min(b, w.bottom);
      }
      if (rt - l < 4 || b - t < 4) return { ok: false, x: 0, y: 0, why: `only ${(rt - l).toFixed(1)}x${(b - t).toFixed(1)}px of it is on screen` };
      const x = (l + rt) / 2, y = (t + b) / 2, top = document.elementFromPoint(x, y);
      return { ok: !!top && (top === el || el.contains(top)), x, y, why: top ? top.outerHTML.slice(0, 120) : "nothing" };
    },
    [sel, within || ""],
  );
  expect(p.ok, `${what}: a touch at its visible centre lands on it (${p.why})`).toBe(true);
  await page.touchscreen.tap(p.x, p.y);
}

test("U139 a: signed in with the email off, Settings has no Notifications tab and nothing is written @curated", async ({ page }) => {
  const j = await bootSignedIn(page, "digest-off-user");
  expect(await stored(page), "a fresh account has never stored the switch").toEqual({ value: undefined, at: undefined });
  await openSettingsFromMenu(page, j);

  expect(await tabIds(page), "four tabs: Notifications is not drawn").toEqual(["flashcards", "rolling", "modifiers", "shortcuts"]);
  await expect(page.locator("#ng-stab-notifications")).toHaveCount(0);
  await expect(page.locator(ROW)).toHaveCount(0);
  // every drawn tab, pressed by mouse: none of them carries the switch
  for (const t of ["rolling", "modifiers", "shortcuts", "flashcards"]) {
    await j.clickByMouse(`#ng-stab-${t}`, t);
    expect(await selected(page)).toBe(t);
    await expect(page.locator(ROW), t).toHaveCount(0);
  }
  // the arrow keys walk the four drawn tabs: Modifiers → Shortcuts, never the hidden one
  await j.clickByMouse("#ng-stab-modifiers", "Modifiers");
  await page.keyboard.press("ArrowRight");
  expect(await selected(page), "ArrowRight from Modifiers skips the hidden tab").toBe("shortcuts");
  await page.keyboard.press("ArrowRight");
  expect(await selected(page), "and wraps over four").toBe("flashcards");
  await closeSettings(page);

  // a link to the hidden tab opens the first tab, with its own panel
  await page.evaluate(() => (window as any).__neural.openSettings("notifications"));
  await expect(page.locator('[role="tablist"][data-settings-tabs]')).toBeVisible();
  expect(await selected(page)).toBe("flashcards");
  await expect(page.locator('[role="tabpanel"]')).toHaveAttribute("aria-labelledby", "ng-stab-flashcards");
  await expect(page.locator(ROW)).toHaveCount(0);
  await expect(page.locator("[data-notif-signedout]")).toHaveCount(0);
  await closeSettings(page);

  // NOTHING STORED CHANGES: no key, no timestamp, and no write to the account ever named it
  await page.evaluate(() => (window as any).__neural._flushSave());
  expect(await stored(page)).toEqual({ value: undefined, at: undefined });
  expect((await cloudWrites(page)).filter((v: unknown) => v !== undefined), "no account write carries emailDigest").toEqual([]);
});

test("U139 a: an account with the email stored on keeps the tab and row to turn it off, and Off hides them from the next opening @curated", async ({ page }) => {
  const j = await bootSignedIn(page, "digest-on-user", true);
  expect(await stored(page), "the account's stored setting arrived").toMatchObject({ value: true });
  const before = await stored(page);
  await openSettingsFromMenu(page, j);

  expect(await tabIds(page), "five tabs while it is stored on").toEqual(["flashcards", "rolling", "modifiers", "notifications", "shortcuts"]);
  await expect(page.locator(ROW), "the switch is not on Flashcards").toHaveCount(0);
  await j.clickByMouse("#ng-stab-notifications", "Notifications");
  await expect(page.locator(ROW)).toBeVisible();
  await expect(page.locator(ROW)).toContainText("mailed to player@example.com.");
  await expect(page.locator(ROW), "the row says no email is sent yet").toContainText(UNSENT);
  expect(await stored(page), "opening and choosing the tab write nothing").toEqual(before);
  expect((await cloudWrites(page)).filter((v: unknown) => v === false), "no write turned it off for the player").toEqual([]);

  await expect(page.locator(OFF)).toHaveText("Off");
  await j.clickByMouse(OFF, "Off");
  expect((await stored(page)).value, "Off stores false under the key the worker reads").toBe(false);
  await expect(page.locator(ROW), "the row stays for the rest of this opening").toBeVisible();
  expect(await tabIds(page)).toContain("notifications");
  await closeSettings(page);

  await openSettingsFromMenu(page, j);
  expect(await tabIds(page), "reopened: the tab is gone").toEqual(["flashcards", "rolling", "modifiers", "shortcuts"]);
  await expect(page.locator(ROW)).toHaveCount(0);
});

test.describe("at 390, by touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("U139 a: a phone with the email stored on taps Notifications and Off; the next opening has no tab @curated", async ({ page }) => {
    const j = await bootSignedIn(page, "digest-on-phone", true);
    await openSettingsFromMenu(page, j);
    expect(await tabIds(page)).toEqual(["flashcards", "rolling", "modifiers", "notifications", "shortcuts"]);
    await tap(page, "#ng-stab-notifications", "the Notifications tab", '[role="tablist"][data-settings-tabs]');
    await expect.poll(() => selected(page)).toBe("notifications");
    await expect(page.locator(ROW)).toBeVisible();
    await expect(page.locator(ROW)).toContainText(UNSENT);
    await expect(page.locator(OFF)).toHaveText("Off");
    await tap(page, OFF, "Off");
    await expect.poll(async () => (await stored(page)).value, { message: "the tap stored false" }).toBe(false);
    await expect(page.locator(ROW)).toBeVisible();
    await closeSettings(page);
    await openSettingsFromMenu(page, j);
    expect(await tabIds(page), "reopened on the phone: no tab").toEqual(["flashcards", "rolling", "modifiers", "shortcuts"]);
  });

  test("U139 a: a phone signed in with the email off sees four tabs and no switch @curated", async ({ page }) => {
    const j = await bootSignedIn(page, "digest-off-phone");
    await openSettingsFromMenu(page, j);
    expect(await tabIds(page)).toEqual(["flashcards", "rolling", "modifiers", "shortcuts"]);
    await tap(page, "#ng-stab-modifiers", "the Modifiers tab", '[role="tablist"][data-settings-tabs]');
    await expect.poll(() => selected(page)).toBe("modifiers");
    await expect(page.locator(ROW)).toHaveCount(0);
  });
});

test("signed out, Notifications is as before: the one line and no switch @curated", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openSettingsFromMenu(page, j, "the guest badge");
  expect(await tabIds(page), "a guest keeps all five tabs").toEqual(["flashcards", "rolling", "modifiers", "notifications", "shortcuts"]);
  await j.clickByMouse("#ng-stab-notifications", "Notifications");
  // no control that cannot work
  await expect(page.locator(ROW)).toHaveCount(0);
  // but not a blank tab either: one honest line saying why
  const note = page.locator("[data-notif-signedout]");
  await expect(note).toBeVisible();
  expect((await note.innerText()).trim().length).toBeGreaterThan(20);
});

test("flipped: with NG_DIGEST_LIVE true, a signed-in player's Settings are v1.259.1's @curated", async ({ page }) => {
  // Serve this build's own bundle with the one constant flipped. The pattern is the minified
  // `NG_DIGEST_LIVE = false` that follows the tab list; it must match exactly once, or this test is
  // about the shipped constant and would pass on nothing.
  const swaps: number[] = [];
  const j = await bootSignedIn(page, "digest-live-user", undefined, async (p) => {
    await p.route(/\/app\/neural\.js(?:\?|$)/, async (route) => {
      const res = await route.fetch();
      const body = await res.text();
      const re = /(\["shortcuts","Shortcuts"\]\],)([\w$]+)=!1([,;])/g;
      const n = (body.match(re) || []).length;
      swaps.push(n);
      await route.fulfill({ response: res, body: n === 1 ? body.replace(re, "$1$2=!0$3") : body });
    });
  });
  expect(swaps, "the bundle was served once, with the constant flipped exactly once").toEqual([1]);
  await openSettingsFromMenu(page, j);
  expect(await tabIds(page), "five tabs, setting off").toEqual(["flashcards", "rolling", "modifiers", "notifications", "shortcuts"]);
  await j.clickByMouse("#ng-stab-notifications", "Notifications");
  await expect(page.locator(ROW)).toBeVisible();
  const sub = await page.locator(ROW).evaluate((el) => (el.firstElementChild!.children[1] as HTMLElement).textContent);
  expect(sub, "the row's words are v1.259.1's, with no not-sent sentence").toBe(V1259_ROW);
  await expect(page.locator(ON)).toHaveText("On");
  await j.clickByMouse(ON, "On");
  expect((await stored(page)).value, "On stores true under the key the worker reads").toBe(true);
});
