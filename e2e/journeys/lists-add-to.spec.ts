import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * "ADD TO…" BESIDE "MOVE TO…" (ADD1, v1.299.0). The owner, 23 Nov: "i was hoping to see in the lists also Add to.. beside Move
 * to... option makesesense?". The item stays in its list AND is put in another. The orchestrator's rulings:
 *   1. the item's ⋮: Share · Move up · Move down · Add to… · Move to… · Remove from list ("Add to…" directly above);
 *   2. the picker is the star's own, in an ADD mode ([data-list-picker-add], headed "Add to list"): the list it is in now is
 *      shown and off ("here"), a list that holds it already is shown and off ("already there"), a full one is off; "New
 *      list" makes a list with the item in it, the list it stays in keeping it;
 *   3. after it, the Undo row Move uses: "Added “<item>” to “<list>” · Undo" ([data-list-undo-add]); Undo takes it out of the
 *      target only (and a list the add made, still as made, goes);
 *   4. the write is the star's own add on the target and NOTHING on the list it stays in (proved field for field against a
 *      plain add in tests/list_moves_sync.test.mjs, 24 and 25; here: the list it stays in, read back, is unchanged);
 *   6. phone and desktop alike: 44px targets, the item menu (one row longer) still whole on the screen at 390x631.
 * Every press is a player's: the mouse at 1440 (`clickByMouse`), a touch tap at 390x631 at a measured centre. Lists are
 * SEEDED through the app's own model (setup only) and read back from the app's record.
 *
 * MUTANTS, each built alone into the served bundle after a neutral control, each RED at the step named (the table and its
 * date: docs/Changelog-Archive.md, v1.299.0):
 *   D1 "already there" not off (the row takes the press)        → "1440 by mouse…" at "…a list that holds it already is off"
 *   D2 the source rewritten by the add (its `t` bumped)          → "1440 by mouse…" at "the list it stays in is untouched"
 *   D3 the Undo taking the item out of the source too            → "1440 by mouse…" at "Undo: out of Guard only"
 *   D4 "Add to…" missing from the item's ⋮                        → both, at "the item's ⋮ in its ruled order"
 *   D5 (ADD1-R1, the lists reader's surviving mutant) the add mode without its keys → "by keyboard…" at "focus is in the add
 *      menu"
 *   K1 (ADD1-R1) the kept line missing from the Undo row → "an add's Undo that would leave…" at "the row says it was kept"
 *   K2 (ADD1-R1) the kept line held for the Undo's 90 s → the same test at "it goes after a few seconds"
 */

type W = any;
type Box = { x: number; y: number; width: number; height: number };

const settleSystems = async (page: Page) => {
  await page.evaluate(() => (window as W).__neural._ensureSystems());
  await expect.poll(() => page.evaluate(() => !!(window as W).__neural.systems), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(80);
};
/** Lists of real techniques, through the app's own model; returns their ids and the node ids, in order. */
const seed = (page: Page, spec: { name: string; n: number }[]) =>
  page.evaluate((spec) => {
    const a = (window as W).__neural;
    const pool = a.nodes.filter((x: W) => x.ty === "transitions" && typeof x.o === "number").sort((p: W, q: W) => p.o - q.o);
    let k = 0;
    const out: { id: string; items: string[] }[] = [];
    for (const s of spec) {
      const id = a.newList(s.name);
      const items: string[] = [];
      for (let i = 0; i < s.n; i++) { const n = pool[k++]; a.addToList(n.id, id); items.push(n.id); }
      out.push({ id, items });
    }
    return out;
  }, spec);
const lists = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as W).__neural.lists)));
/** the list it stays in, as stored: its items, its `t`, its cell and its order record (ruling 4: untouched by an add) */
const sourceOf = (page: Page, id: string) => page.evaluate((id) => {
  const a = (window as W).__neural;
  return JSON.stringify([a.lists[id] || null, (a.listItemAt || {})[id] || null, (a.listOrderAt || {})[id] || null]);
}, id);
const boxOf = async (page: Page, sel: string): Promise<Box> => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error("no box for " + sel);
  return b;
};
const tapAt = async (page: Page, sel: string) => {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const b = await boxOf(page, sel);
  const at = await page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x as number, y as number), t = document.querySelector(s as string); return !!(e && t && (t === e || t.contains(e))); }, [b.x + b.width / 2, b.y + b.height / 2, sel]);
  expect(at, "the tap's point is " + sel + " (elementFromPoint)").toBe(true);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
};
const dotsSel = (node: string, list: string) => `[data-list-item-menu="${node}"][data-list-of="${list}"]`;
const menuItem = (node: string, k: string) => `[data-list-item-menu-open="${node}"] [data-list-menu-item="${k}"]`;
const menuKeys = (page: Page, node: string) => page.evaluate((n) => [...document.querySelectorAll(`[data-list-item-menu-open="${n}"] [data-list-menu-item]`)].map((e) => e.getAttribute("data-list-menu-item")), node);
const RULED = ["share", "up", "down", "addto", "move", "remove"];
/** ⋮, then "Add to…", by mouse: the add menu, anchored to the ⋮. */
const openAdd = async (page: Page, j: ReturnType<typeof journey>, node: string, list: string) => {
  await page.locator(dotsSel(node, list)).scrollIntoViewIfNeeded();
  await j.clickByMouse(dotsSel(node, list), "the item's ⋮");
  expect(await menuKeys(page, node), "the item's ⋮ in its ruled order: Share · Move up · Move down · Add to… · Move to… · Remove (D4)").toEqual(RULED);
  await j.clickByMouse(menuItem(node, "addto"), "Add to…");
};
/** A REAL reload with storage kept (the DSL wipes localStorage per navigation otherwise; lists-rename.spec.ts's way). */
const reloadKeepingStorage = async (page: Page) => {
  await page.evaluate(() => (window as W).__neural._flushSave());
  await page.evaluate(() => sessionStorage.setItem("__ng_keep", "1"));
  await page.reload();
  await page.waitForFunction(() => !!(window as W).__neural?.nodes?.length);
  await page.evaluate(() => (window as W).__neural.advance(1200));
};

test("1440 by mouse: ⋮ then Add to… opens the menu in its add mode; the item is put in the target and stays in its list; Undo takes it out of the target only; a reload keeps it", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [S, T, H, F] = await seed(page, [{ name: "Monday fundamentals", n: 3 }, { name: "Guard", n: 1 }, { name: "Has it", n: 0 }, { name: "Full", n: 0 }]);
  const x = S.items[1];
  // setup: "Has it" holds x too; "Full" holds 60 others (the cap a share link can carry)
  await page.evaluate(([x, h, f]) => {
    const a = (window as W).__neural;
    a.addToList(x, h);
    const pool = a.nodes.filter((n: W) => n.ty === "submissions" && typeof n.o === "number").slice(0, 60);
    for (const n of pool) a.addToList(n.id, f);
  }, [x, H.id, F.id]);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  const source0 = await sourceOf(page, S.id);
  await openAdd(page, j, x, S.id);

  const menu = page.locator(`[data-list-picker-add="${S.id}"]`);
  await expect(menu, "the star's menu, in its add mode").toBeVisible();
  await expect(menu.locator("[data-picker-head]")).toContainText("Add to list");
  await expect(menu.locator(`[data-list-pick="${S.id}"]`), "the list it is in now is shown").toHaveAttribute("data-list-pick-note", "here");
  await expect(menu.locator(`[data-list-pick="${S.id}"]`), "…and off").toBeDisabled();
  await expect(menu.locator(`[data-list-pick="${H.id}"]`), "a list that holds it already is shown").toHaveAttribute("data-list-pick-note", "already there");
  await expect(menu.locator(`[data-list-pick="${H.id}"]`), "…a list that holds it already is off (D1)").toBeDisabled();
  await expect(menu.locator(`[data-list-pick="${F.id}"]`)).toHaveAttribute("data-list-pick-note", "full");
  await expect(menu.locator(`[data-list-pick="${F.id}"]`), "a full one is off").toBeDisabled();
  await expect(menu.locator(`[data-list-pick="${T.id}"]`), "another list takes it").toBeEnabled();
  // a press on the off row does nothing (the mouse at its measured centre)
  await page.locator(`[data-list-picker-add] [data-list-pick="${H.id}"]`).click({ force: true });
  expect((await lists(page))[H.id].items.filter((n: string) => n === x).length, "still once in Has it").toBe(1);
  await j.clickByMouse(`[data-list-picker-add] [data-list-pick="${T.id}"]`, "the target list");
  await expect(menu).toHaveCount(0);

  let now = await lists(page);
  expect(now[T.id].items, "into the target, at its end").toEqual([T.items[0], x]);
  expect(now[S.id].items, "and still in its own list, in its place").toEqual(S.items);
  expect(await sourceOf(page, S.id), "the list it stays in is untouched: items, t, cell, order record (D2)").toBe(source0);
  await expect(page.locator(`[data-list-items="${T.id}"] [data-list-item="${x}"]`), "the target shows it").toHaveCount(1);

  // the Undo row Move uses, naming what it takes back
  const undo = page.locator(`[data-list-undo-add="${x}"]`);
  await expect(undo, "an Undo for the add").toBeVisible();
  await expect(undo.locator("xpath=..")).toContainText("Added");
  await expect(undo.locator("xpath=..")).toContainText("Guard");
  await undo.scrollIntoViewIfNeeded();
  await j.clickByMouse(`[data-list-undo-add="${x}"]`, "Undo");
  now = await lists(page);
  expect([now[T.id].items, now[S.id].items], "Undo: out of Guard only, still in its own list (D3)").toEqual([T.items, S.items]);
  expect(await sourceOf(page, S.id), "and the list it stays in still untouched").toBe(source0);

  // added again, and a reload keeps it (the same device coming back)
  await openAdd(page, j, x, S.id);
  await j.clickByMouse(`[data-list-picker-add] [data-list-pick="${T.id}"]`, "the target list");
  await reloadKeepingStorage(page);
  now = await lists(page);
  expect([now[T.id].items, now[S.id].items], "a reload keeps it in both").toEqual([[T.items[0], x], S.items]);
});

test("New list: made with the item in it, the list it stays in keeping it; its Undo takes the new list away while it is as made", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [S] = await seed(page, [{ name: "Monday", n: 2 }]);
  const y = S.items[0];
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  const source0 = await sourceOf(page, S.id);
  await openAdd(page, j, y, S.id);
  await j.clickByMouse("[data-list-picker-add] [data-list-pick-new]", "New list");
  await page.locator("[data-list-pick-newname]").fill("Thursday open mat");
  await page.keyboard.press("Enter");
  let now = await lists(page);
  const born = Object.keys(now).find((k) => now[k].name === "Thursday open mat")!;
  expect(born, "a list was made").toBeTruthy();
  expect(now[born].items, "with the item in it").toEqual([y]);
  expect(now[S.id].items, "and the list it stays in keeps it").toEqual(S.items);
  expect(await sourceOf(page, S.id), "untouched").toBe(source0);
  await page.locator(`[data-list-undo-add="${y}"]`).scrollIntoViewIfNeeded();
  await j.clickByMouse(`[data-list-undo-add="${y}"]`, "Undo");
  now = await lists(page);
  expect(now[born], "the new list held only this item, as made: it goes").toBeUndefined();
  expect(now[S.id].items, "the list it stayed in is as it was").toEqual(S.items);
});

const active = (page: Page, attr: string) => page.evaluate((a) => (document.activeElement as HTMLElement | null)?.getAttribute(a) ?? null, attr);
/** ↓ until the focused element's `attr` is `want` (at most `n` presses); returns what holds focus then. */
const downTo = async (page: Page, attr: string, want: string, n = 8) => {
  for (let i = 0; i < n && (await active(page, attr)) !== want; i++) await page.keyboard.press("ArrowDown");
  return active(page, attr);
};

// ADD1-R1 (the lists reader: the add mode's keys were unpinned; its mutant survived every journey): the twin of
// lists-move.spec.ts's key journey, for "Add to…"
test("by keyboard: Enter on ⋮, ↓ to Add to…, Enter; the add menu opens on a row that can be chosen, ↓ to the target, Enter; focus back on the item's ⋮ in its own list; Esc closes", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [S, T, H] = await seed(page, [{ name: "Monday", n: 2 }, { name: "Guard", n: 1 }, { name: "Has it", n: 0 }]);
  const x = S.items[0];
  await page.evaluate(([x, h]) => (window as W).__neural.addToList(x, h), [x, H.id]);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  await page.locator(dotsSel(x, S.id)).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-list-item-menu-open="${x}"]`)).toBeVisible();
  expect(await downTo(page, "data-list-menu-item", "addto"), "Add to… is reached by ↓").toBe("addto");
  await page.keyboard.press("Enter");
  const menu = page.locator(`[data-list-picker-add="${S.id}"]`);
  await expect(menu, "the add menu, by keys").toBeVisible();
  expect(await menu.evaluate((m) => m.contains(document.activeElement)), "focus is in the add menu (D5)").toBe(true);
  expect([S.id, H.id], "it opens on a row that can be chosen (not here, not already there)").not.toContain(await active(page, "data-list-pick"));
  expect(await downTo(page, "data-list-pick", T.id), "the target by ↓").toBe(T.id);
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  const now = await lists(page);
  expect([now[T.id].items, now[S.id].items], "in the target, and still in its own list").toEqual([[T.items[0], x], S.items]);
  await expect.poll(() => page.evaluate(() => { const e = document.activeElement as HTMLElement | null; return e ? [e.getAttribute("data-list-item-menu"), e.getAttribute("data-list-of")] : null; }),
    { message: "focus is back on the item's ⋮, in the list it stays in" }).toEqual([x, S.id]);

  // Esc closes the add menu and gives the keys back to the ⋮ it hangs off; nothing added
  await page.keyboard.press("Enter");
  expect(await downTo(page, "data-list-menu-item", "addto")).toBe("addto");
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-list-picker-add="${S.id}"]`)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-list-picker-add]")).toHaveCount(0);
  expect(await active(page, "data-list-item-menu"), "focus back on the ⋮").toBe(x);
  expect((await lists(page))[T.id].items, "Esc added nothing").toEqual([T.items[0], x]);
});

test.describe("at 390x631 by touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } });

  test("the item's ⋮, one row longer, and the add menu are whole on the screen for the last row of a long list; 44px rows; an add and its Undo by touch", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const [S, T] = await seed(page, [{ name: "Monday fundamentals: guard retention, passing and escapes", n: 12 }, { name: "Guard", n: 1 }]);
    await tapAt(page, ".ng-logo");
    await expect(page.locator(".ng-drill")).toBeVisible();
    await settleSystems(page);
    const x = S.items[S.items.length - 1]; // the LAST row of a long list: the menus must still end whole on the screen
    const onScreen = (r: Box) => r.x >= 0 && r.x + r.width <= 390 && r.y >= 0 && r.y + r.height <= 631;
    await tapAt(page, dotsSel(x, S.id));
    expect(await menuKeys(page, x), "the item's ⋮ in its ruled order (D4)").toEqual(RULED);
    const ad = menuItem(x, "addto");
    const ab = await boxOf(page, ad);
    expect(ab.height, "Add to… is a thumb tall").toBeGreaterThanOrEqual(44);
    expect(onScreen(await boxOf(page, `[data-list-item-menu-open="${x}"]`)), "the item menu, one row longer, is whole on the screen").toBe(true);
    await tapAt(page, ad);
    const menu = `[data-list-picker-add="${S.id}"]`;
    await expect(page.locator(menu)).toBeVisible();
    expect(onScreen(await boxOf(page, menu)), "the add menu is whole on the screen").toBe(true);
    const pick = `[data-list-picker-add] [data-list-pick="${T.id}"]`;
    expect((await boxOf(page, pick)).height, "its row is a thumb tall").toBeGreaterThanOrEqual(44);
    await tapAt(page, pick);
    let now = await lists(page);
    expect([now[T.id].items, now[S.id].items], "in the target, and still in its own list").toEqual([[T.items[0], x], S.items]);
    const undo = `[data-list-undo-add="${x}"]`;
    await page.locator(undo).scrollIntoViewIfNeeded();
    expect((await boxOf(page, undo)).height, "Undo is a thumb tall").toBeGreaterThanOrEqual(44);
    await tapAt(page, undo);
    now = await lists(page);
    expect([now[T.id].items, now[S.id].items], "Undo by touch: out of the target only").toEqual([T.items, S.items]);
  });

  // ADD1-R1 (the lists reader's fault 1): an Undo that would leave the item in no list is not taken; the row says so in one
  // line for a few seconds, whole at 390 for a list name at its longest. The other device's move, pulled, is stood in for by
  // one call: `removeFromList` takes the item out of the list it was added FROM, which is what that pull leaves on this
  // device (the two devices themselves are units 28 to 28c, tests/list_moves_sync.test.mjs); it arms no Undo of its own.
  test("an add's Undo that would leave the item in no list is not taken: one line in the row's place, whole at 390, for a few seconds", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const long = "Guard retention, passing, escapes and the back: a full class".slice(0, 60);
    const [S, T] = await seed(page, [{ name: "Monday", n: 2 }, { name: long, n: 1 }]);
    await tapAt(page, ".ng-logo");
    await expect(page.locator(".ng-drill")).toBeVisible();
    await settleSystems(page);
    const x = S.items[0];
    await tapAt(page, dotsSel(x, S.id));
    await tapAt(page, menuItem(x, "addto"));
    await tapAt(page, `[data-list-picker-add] [data-list-pick="${T.id}"]`);
    expect(await page.evaluate(([x, s]) => (window as W).__neural.removeFromList(x, s), [x, S.id]), "premise: the item now stands in the target alone").toBe(true);
    const undo = `[data-list-undo-add="${x}"]`;
    await page.locator(undo).scrollIntoViewIfNeeded();
    await tapAt(page, undo);
    const kept = page.locator(`[data-list-undo-kept="${x}"]`);
    await expect(kept, "the row says it was kept (K1)").toHaveText("Kept in “" + long + "”: it is in no other list now.");
    expect((await lists(page))[T.id].items, "and it is still in the target").toEqual([T.items[0], x]);
    await expect(page.locator(undo), "no Undo in its place").toHaveCount(0);
    const fit = await kept.evaluate((e) => { const r = e.getBoundingClientRect(), row = (e.parentElement as HTMLElement).getBoundingClientRect(); return { clipped: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1, l: row.left, r: row.right }; });
    expect(fit.clipped, "the line is whole, nothing cut").toBe(false);
    expect(fit.l >= 0 && fit.r <= 390, "the row is on the screen").toBe(true);
    await expect(kept, "it goes after a few seconds (K2)").toHaveCount(0, { timeout: 8000 });
  });
});
