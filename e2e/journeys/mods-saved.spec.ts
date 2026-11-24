import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE PLAYER'S MODIFIERS ("YOUR ODDS") ARE STILL THERE AFTER A RELOAD (v1.301.0, MODS1: the owner's U212 a "Save them").
 *
 * Until v1.301.0 every modifier lived in memory and was gone on reload. They are now settings, one key per technique
 * (progress-owner.src.js above NG_MOD_PREFIX); tests/mods_sync.test.mjs proves the merge across devices, the guest join and
 * the older builds. This journey proves the panel a player presses, in a real browser:
 *  1. at 1440x900 by MOUSE (`j.clickByMouse`) and at 390x631 by TOUCH (a tap at the measured centre): Add, + and −, the dot
 *     and the bin each change what is STORED (the guest's own record, read back from storage), and a real reload brings
 *     back exactly what was left: the row, its odds and its pause, and the move's chance the roll reads (`successOverride`);
 *     a removal stays removed through a reload;
 *  2. the quiet line under the heading says where they are kept (a guest's words here; an account's are the unit's,
 *     tests/settings_presentation.test.mjs);
 *  3. THE TOUCH TARGETS: each of the row's four controls answers at every edge of its target (40 on a wide screen, 44 on a
 *     phone), sampled with `elementFromPoint` 1 px inside each edge, so a target that did not grow, or two that overlap
 *     (the bin was 35 px from "+", centre to centre), fails. Their drawn sizes are those of a control frame, the same row
 *     with the lift's classes taken off (asserted equal), and smaller than the target.
 * NOT covered here: two devices, a guest joining an account, an older build (the units above); the card's printed % (the
 * choice view re-solves in a worker; the roll's own chance is what is asserted).
 */

const NAME = "Armbar from Mount";
const ROW = `.ng-set-mods [data-mod="${NAME}"]`;
const GUEST_LINE = "Saved on this device. Sign in to have them on your other devices.";

/** A REAL reload with storage kept (the DSL wipes localStorage per navigation otherwise): lists-disclosure.spec.ts's. */
const reloadKeepingStorage = async (page: Page) => {
  await page.evaluate(() => sessionStorage.setItem("__ng_keep", "1"));
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__neural?.nodes?.length);
  await page.evaluate(() => (window as any).__neural.advance(1200));
};
const openOdds = async (page: Page) => {
  expect(await page.evaluate(() => (window as any).__neural.openSettings("modifiers"))).toBe(true);
  await expect(page.locator(".ng-set-mods")).toBeVisible();
};
/** what the guest's record holds for the technique, read from storage (the fixture reader the DSL installs) */
const stored = (page: Page) =>
  page.evaluate((n) => {
    const raw = (window as any).__ngGuestProgressRaw();
    const b = raw ? JSON.parse(raw) : {};
    return { row: (b.settings || {})["mod:" + n], at: (b.settingsAt || {})["mod:" + n] };
  }, NAME);
const chance = (page: Page) => page.evaluate((n) => (window as any).__neural.successOverride({ t: n }), NAME);

/** a touch at the visible centre of `sel`, after proving that centre lands on it (notifications-tab.spec.ts's `tap`) */
async function tap(page: Page, sel: string, what: string) {
  const p = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { ok: false, x: 0, y: 0, why: "no element matches" };
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
    const on = x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight;
    return { ok: on && !!top && (top === el || el.contains(top)), x, y, why: top ? top.outerHTML.slice(0, 100) : "nothing" };
  }, sel);
  expect(p.ok, `${what}: a touch at its centre lands on it (${p.why})`).toBe(true);
  await page.touchscreen.tap(p.x, p.y);
}

/** every edge of each control's target answers to that control: 1 px inside the target's four edges, at its centre lines */
async function targets(page: Page, size: number) {
  const out = await page.evaluate(
    ([row, size]) => {
      const sels = [".ng-mod-dot", '[data-mod-step="-1"]', '[data-mod-step="1"]', ".ng-mod-del"];
      const res: { sel: string; drawn: [number, number]; miss: string[] }[] = [];
      for (const s of sels) {
        const el = document.querySelector(`${row} ${s}`) as HTMLElement;
        const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, h = (size as number) / 2 - 1;
        const miss: string[] = [];
        for (const [x, y, side] of [[cx - h, cy, "left"], [cx + h, cy, "right"], [cx, cy - h, "top"], [cx, cy + h, "bottom"]] as [number, number, string][]) {
          const top = document.elementFromPoint(x, y);
          if (!top || !(top === el || el.contains(top))) miss.push(`${side} -> ${top ? top.className || top.tagName : "nothing"}`);
        }
        res.push({ sel: s, drawn: [Math.round(r.width), Math.round(r.height)], miss });
      }
      // THE CONTROL FRAME: the same controls with the lift's classes taken off (every rule of the lift keys on them), measured
      // again, then put back. The drawn size must not move: the lift is the hit area, never the control
      const rowEl = document.querySelector(row as string) as HTMLElement, all = [rowEl, ...rowEl.querySelectorAll("button")] as HTMLElement[];
      const kept = all.map((e) => e.className);
      all.forEach((e) => (e.className = ""));
      const bare = sels.map((s) => { const r = (document.querySelector(`${row} ${s.replace(/^\.ng-mod-dot$/, 'button[title]:first-child').replace(/^\.ng-mod-del$/, 'button[title="Remove"]')}`) as HTMLElement).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
      all.forEach((e, i) => (e.className = kept[i]));
      return res.map((t, i) => ({ ...t, bare: bare[i] }));
    },
    [ROW, size] as [string, number],
  );
  for (const t of out) {
    expect(t.miss, `${t.sel}: every edge of its ${size} px target is its own`).toEqual([]);
    expect(t.drawn, `${t.sel}: drawn the same with the lift and without it`).toEqual(t.bare);
    expect(Math.max(...t.drawn), `${t.sel}: drawn smaller than its target (so the target is the lift's)`).toBeLessThan(size);
  }
}

test("a modifier added, stepped, paused and removed by MOUSE at 1440 is stored at each press and survives a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const j = journey(page);
  await j.boot("/");
  await openOdds(page);
  await expect(page.locator(".ng-set-mods [data-mods-saved]")).toHaveText(GUEST_LINE);
  await j.clickByMouse(".ng-set-mods [data-mod-add]", "+ Add modifier");
  await j.clickByMouse(".ng-set-mods [data-mod-name]", "the name field");
  await page.keyboard.type(NAME);
  await j.clickByMouse(".ng-set-mods [data-mod-save]", "Add modifier");
  await expect(page.locator(ROW)).toContainText("50%");
  expect((await stored(page)).row.slice(0, 3), "the press is stored").toEqual([50, 1, "S"]);
  await j.clickByMouse(`${ROW} [data-mod-step="1"]`, "+");
  await j.clickByMouse(`${ROW} [data-mod-step="1"]`, "+");
  await j.clickByMouse(`${ROW} [data-mod-step="-1"]`, "−");
  await j.clickByMouse(`${ROW} .ng-mod-dot`, "the dot");
  expect((await stored(page)).row.slice(0, 2), "51%, paused, stored").toEqual([51, 0]);
  await targets(page, 40);
  await reloadKeepingStorage(page);
  await openOdds(page);
  await expect(page.locator(ROW)).toContainText("51%");
  await expect(page.locator(`${ROW} .ng-mod-dot`)).toHaveAttribute("title", "Paused");
  expect(await chance(page), "paused: the roll uses the move's own chance").toBeNull();
  await j.clickByMouse(`${ROW} .ng-mod-dot`, "the dot");
  expect(await chance(page), "on: the roll uses 51%").toBe(0.51);
  await j.clickByMouse(`${ROW} .ng-mod-del`, "the bin");
  await expect(page.locator(ROW)).toHaveCount(0);
  expect((await stored(page)).row, "a removal is a stored 0, never a deleted key").toBe(0);
  await reloadKeepingStorage(page);
  await openOdds(page);
  await expect(page.locator(ROW)).toHaveCount(0);
  await expect(page.locator(".ng-set-mods")).toContainText("No modifiers yet");
  expect(await chance(page)).toBeNull();
});

test("the same by TOUCH at 390x631: every press is stored, a reload brings it back, each target is 44 px and its own", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const j = journey(page);
  await j.boot("/");
  await openOdds(page);
  await expect(page.locator(".ng-set-mods [data-mods-saved]")).toHaveText(GUEST_LINE);
  await tap(page, ".ng-set-mods [data-mod-add]", "+ Add modifier");
  await tap(page, ".ng-set-mods [data-mod-name]", "the name field");
  await page.keyboard.type(NAME);
  await tap(page, ".ng-set-mods [data-mod-save]", "Add modifier");
  await expect(page.locator(ROW)).toContainText("50%");
  await page.locator(ROW).scrollIntoViewIfNeeded();
  await tap(page, `${ROW} [data-mod-step="-1"]`, "−");
  await tap(page, `${ROW} [data-mod-step="-1"]`, "−");
  expect((await stored(page)).row.slice(0, 2), "48%, stored").toEqual([48, 1]);
  await targets(page, 44);
  await reloadKeepingStorage(page);
  await openOdds(page);
  await page.locator(ROW).scrollIntoViewIfNeeded();
  await expect(page.locator(ROW)).toContainText("48%");
  expect(await chance(page)).toBe(0.48);
  await tap(page, `${ROW} .ng-mod-dot`, "the dot");
  expect((await stored(page)).row.slice(0, 2), "paused by touch, stored").toEqual([48, 0]);
  await tap(page, `${ROW} .ng-mod-del`, "the bin");
  expect((await stored(page)).row).toBe(0);
  await reloadKeepingStorage(page);
  await openOdds(page);
  await expect(page.locator(ROW)).toHaveCount(0);
  await ctx.close();
});
