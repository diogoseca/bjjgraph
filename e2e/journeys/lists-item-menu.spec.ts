import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * AN ITEM'S OWN MENU (LISTS-MENU-2 part 2). The owner, 23 Nov 2026: "tat x icon on the list items is very consufing too,
 * make it a 3 dots icon ads well which includes sharing, remove from list, move up, move down (the list order)".
 *   · Each item's × is a ⋮ ([data-list-item-menu]), 44px on a phone; ▶ stays on the row (44px on a phone too, its chip
 *     drawn inside). Its menu ([data-list-item-menu-open]): Share · Move up · Move down · Move to… · Remove from list
 *     (Move to… since the move step, LISTS-R Slice 2: lists-move.spec.ts presses it), Remove last in
 *     the warning ink, Move up and Move down disabled at the list's ends (shown, and skipped by the keys).
 *   · Share shares the technique's own page: `location.origin + _nodeUrlPath(idx)`.
 *   · Remove from list gains the Undo row ([data-list-undo-remove]), which puts the item back at its place.
 *   · Move up / Move down reorder the list and write its ORDER RECORD (`listOrderAt`, ORDER-OK, landed with the move step),
 *     so the order syncs; a reorder does not bump the list's `t` (the panel's recency order). (Until v1.298.0 it reordered on
 *     this device only.)
 * Every press is a player's: the mouse at 1440 (`clickByMouse`), a touch tap at 390x631 at a measured centre, or keys.
 * Lists are SEEDED through the app's own model (setup only).
 *
 * Mutants, each red here on a real rebuild, a neutral control green (the archive's v1.295.2 entry has the table): the
 * item's ⋮ opening nothing; Move up enabled at the top; Move down moving up; a reorder bumping the list's `t`; Remove
 * without its Undo; the Undo putting the item back at the end; Share sharing the list's link; the item's ⋮ at 24px on a
 * phone; ▶ without its thumb box on a phone; the keys landing on a disabled item; a key-made reorder dropping the focus.
 * NONE SURVIVED.
 */

type W = any;
type Box = { x: number; y: number; width: number; height: number };

const settleSystems = async (page: Page) => {
  await page.evaluate(() => (window as W).__neural._ensureSystems());
  await expect.poll(() => page.evaluate(() => !!(window as W).__neural.systems), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(80);
};
/** One OPEN list of `n` real techniques, through the app's own model. */
const seed = (page: Page, name: string, n: number) =>
  page.evaluate(({ name, n }) => {
    const a = (window as W).__neural;
    const pool = a.nodes.filter((x: W) => x.ty === "transitions" && typeof x.o === "number").sort((p: W, q: W) => p.o - q.o);
    const id = a.newList(name);
    const items: string[] = [];
    for (let i = 0; i < n; i++) { a.addToList(pool[i].id, id); items.push(pool[i].id); }
    return { id, items, t: a.lists[id].t };
  }, { name, n });
const list = (page: Page, id: string) => page.evaluate((lid) => JSON.parse(JSON.stringify((window as W).__neural.lists[lid] || null)), id);
const boxOf = async (page: Page, sel: string): Promise<Box> => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error("no box for " + sel);
  return b;
};
const hitsAll = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) return ["no element"];
    const r = el.getBoundingClientRect();
    const pts: [string, number, number][] = [["centre", r.left + r.width / 2, r.top + r.height / 2], ["left", r.left + 2, r.top + r.height / 2], ["right", r.right - 2, r.top + r.height / 2], ["top", r.left + r.width / 2, r.top + 2], ["bottom", r.left + r.width / 2, r.bottom - 2]];
    return pts.filter(([, x, y]) => { const at = document.elementFromPoint(x, y); return !at || !(at === el || el.contains(at)); }).map(([k]) => k);
  }, sel);
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const dotsSel = (node: string, lid: string) => `[data-list-item-menu="${node}"][data-list-of="${lid}"]`;
const itemSel = (node: string, k: string) => `[data-list-item-menu-open="${node}"] [data-list-menu-item="${k}"]`;

test("1440 by mouse: an item's ⋮ offers Share, Move up, Move down, Remove from list; each does its thing", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const S = await seed(page, "Monday fundamentals", 3);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  await page.mouse.move(700, 450);
  const [a, b, c] = S.items;
  await expect(page.locator(`[data-list-items="${S.id}"] [data-list-item-remove]`), "the × left the item rows").toHaveCount(0);
  await expect(page.locator(`[data-list-itemrow="${a}"] [data-play-from]`), "▶ stays").toHaveCount(1);
  await page.locator(dotsSel(a, S.id)).scrollIntoViewIfNeeded();
  expect(await hitsAll(page, dotsSel(a, S.id))).toEqual([]);

  // the menu, on the FIRST item: Move up cannot be chosen
  await j.clickByMouse(dotsSel(a, S.id), "the first item's ⋮");
  const open = page.locator(`[data-list-item-menu-open="${a}"]`);
  await expect(open).toBeVisible();
  expect(await open.locator("[data-list-menu-item]").allTextContents()).toEqual(["Share", "Move up", "Move down", "Move to…", "Remove from list"]);
  await expect(page.locator(itemSel(a, "up")), "the first item cannot move up").toBeDisabled();
  await expect(page.locator(itemSel(a, "down"))).toBeEnabled();
  // Move down: the order changes HERE, with no stamp and no new `t`
  await j.clickByMouse(itemSel(a, "down"), "Move down");
  let now = await list(page, S.id);
  expect(now.items, "it moved down one place").toEqual([b, a, c]);
  expect(now.t, "the list's recency is untouched (it does not jump in the panel)").toBe(S.t);
  const rec = await page.evaluate((lid) => ((window as W).__neural._progressBlob().listOrderAt || {})[lid] || null, S.id);
  expect(rec && rec[1], "the reorder is recorded, the list's whole order (it syncs)").toEqual([b, a, c]);
  expect(rec && rec[0] > S.t, "…stamped later than the list's last touch").toBe(true);
  await expect(page.locator(`[data-list-items="${S.id}"] [data-list-item]`).nth(1)).toHaveAttribute("data-list-item", a);
  // the LAST item cannot move down; Move up works
  await j.clickByMouse(dotsSel(c, S.id), "the last item's ⋮");
  await expect(page.locator(itemSel(c, "down")), "the last item cannot move down").toBeDisabled();
  await j.clickByMouse(itemSel(c, "up"), "Move up");
  expect((await list(page, S.id)).items).toEqual([b, c, a]);

  // Share: the technique's own page
  await j.clickByMouse(dotsSel(b, S.id), "an item's ⋮");
  await j.clickByMouse(itemSel(b, "share"), "Share");
  const shared = await page.evaluate((node) => {
    const a = (window as W).__neural, i = a._idIndex.get(node);
    return { url: a._lastItemShareUrl, want: location.origin + a._nodeUrlPath(i) };
  }, b);
  expect(shared.url, "the technique's own page").toBe(shared.want);
  expect(shared.url).toMatch(/^https?:\/\/[^/]+\/Transitions\//);

  // Remove from list, then Undo puts it back at its place
  await j.clickByMouse(dotsSel(c, S.id), "an item's ⋮");
  await j.clickByMouse(itemSel(c, "remove"), "Remove from list");
  expect((await list(page, S.id)).items, "removed").toEqual([b, a]);
  const undo = `[data-list-undo-remove="${c}"]`;
  await expect(page.locator(undo)).toBeVisible();
  await expect(page.locator(undo).locator("xpath=..")).toContainText("Removed");
  await j.clickByMouse(undo, "Undo");
  expect((await list(page, S.id)).items, "back at its place").toEqual([b, c, a]);
});

test("by keyboard: Enter on an item's ⋮ opens it on Share; the arrows skip a disabled item; a reorder keeps the keys on the item", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const S = await seed(page, "Monday", 3);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  const [a, b, c] = S.items;
  const focused = () => page.evaluate(() => { const e = document.activeElement as HTMLElement | null; return e ? e.getAttribute("data-list-menu-item") || (e.getAttribute("data-list-item-menu") ? "dots:" + e.getAttribute("data-list-item-menu") : e.tagName) : null; });
  await page.locator(dotsSel(a, S.id)).focus();
  await page.keyboard.press("Enter");
  expect(await focused(), "a key opens it on its first item").toBe("share");
  await page.keyboard.press("ArrowDown");
  expect(await focused(), "Move up is disabled on the first item: the keys skip it").toBe("down");
  await page.keyboard.press("Enter");
  expect((await list(page, S.id)).items).toEqual([b, a, c]);
  expect(await focused(), "focus follows the item to its new place").toBe("dots:" + a);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.locator(`[data-list-item-menu-open="${a}"]`), "Esc closes it").toHaveCount(0);
  expect(await focused(), "…focus back on its ⋮").toBe("dots:" + a);
  await expect(page.locator(".ng-drill"), "…and the pane stays").toBeVisible();
});

test.describe("at 390x631 by touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } });
  const tapAt = async (page: Page, sel: string) => {
    await page.locator(sel).first().scrollIntoViewIfNeeded();
    const b = await boxOf(page, sel);
    const own = await page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x as number, y as number), t = document.querySelector(s as string); return !!(e && t && (t === e || t.contains(e))); }, [b.x + b.width / 2, b.y + b.height / 2, sel]);
    expect(own, "the tap's point is " + sel).toBe(true);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  };

  test("▶ and ⋮ are 44px targets on an item row that overlap nothing; the menu is whole on screen; each item by touch", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const S = await seed(page, "Monday fundamentals: guard retention, passing and escapes", 4);
    await tapAt(page, ".ng-logo");
    await expect(page.locator(".ng-drill")).toBeVisible();
    await settleSystems(page);
    const [a, b, c, d] = S.items;
    const row = `[data-list-itemrow="${b}"]`;
    await page.locator(row).scrollIntoViewIfNeeded();
    const play = await boxOf(page, `${row} [data-play-from]`), dots = await boxOf(page, dotsSel(b, S.id)), name = await boxOf(page, `${row} [data-list-item]`);
    for (const [k, bx, s] of [["▶", play, `${row} [data-play-from]`], ["⋮", dots, dotsSel(b, S.id)]] as const) {
      expect(bx.width, k + " is a thumb wide").toBeGreaterThanOrEqual(44);
      expect(bx.height, k + " is a thumb tall").toBeGreaterThanOrEqual(44);
      expect(await hitsAll(page, s), k + ": its whole box is its own").toEqual([]);
    }
    expect(overlap(play, dots), "▶ and ⋮").toBe(0);
    expect(overlap(play, name), "▶ and the name").toBe(0);
    expect(dots.x + dots.width / 2 - (play.x + play.width / 2), "centres a thumb apart").toBeGreaterThanOrEqual(43.5);
    expect(await page.locator(`${row} [data-play-from]`).evaluate((el) => getComputedStyle(el, "::before").borderTopStyle), "▶'s chip is drawn inside").toBe("solid");

    // the LAST item's menu, whole on screen
    await page.locator(dotsSel(d, S.id)).evaluate((el) => el.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(150);
    await tapAt(page, dotsSel(d, S.id));
    const m = await boxOf(page, `[data-list-item-menu-open="${d}"]`);
    expect(m.x >= 0 && m.y >= 0 && m.x + m.width <= 390 && m.y + m.height <= 631, "the menu is whole on the screen: " + JSON.stringify(m)).toBe(true);
    for (const k of ["share", "up", "down", "move", "remove"]) expect((await boxOf(page, itemSel(d, k))).height, k + " is a thumb tall").toBeGreaterThanOrEqual(44);
    await tapAt(page, itemSel(d, "up"));
    expect((await list(page, S.id)).items).toEqual([a, b, d, c]);
    // Remove by touch, Undo by touch
    await tapAt(page, dotsSel(a, S.id));
    await tapAt(page, itemSel(a, "remove"));
    expect((await list(page, S.id)).items).toEqual([b, d, c]);
    const undo = `[data-list-undo-remove="${a}"]`;
    expect((await boxOf(page, undo)).height, "Undo is a thumb tall").toBeGreaterThanOrEqual(44);
    await tapAt(page, undo);
    expect((await list(page, S.id)).items, "back at its place").toEqual([a, b, d, c]);
  });
});
