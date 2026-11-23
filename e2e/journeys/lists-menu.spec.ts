import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * A LIST'S OWN MENU (LISTS-MENU). The owner, 23 Nov 2026, after trying the pencil: "the pencil edit isn't ideal, maybe a
 * cogwheel or what do you suggest?, i may want to delete it and the pencil edit just gives me that option. what about 3
 * vertical dots? i think that's more like list options for this, which is like CRUD, so duplicate, share, rename, delete".
 *   · ONE control on a list's row, ⋮ ([data-list-menu]), always visible; 44px on a phone, 24px on a desktop. The pencil,
 *     the Share icon and the two-step × are gone from the row.
 *   · Its menu ([data-list-menu-open], the star's picker's kind and slot): Rename · Duplicate · Share link · Delete.
 *     Delete is one press, then the 90-second Undo (ruling 1). Duplicate makes "<name> copy" with the same techniques in
 *     the same order and opens its name editor (ruling 2: no cap on lists).
 *   · A press on the NAME, or anywhere on the row's line but ⋮, OPENS OR SHUTS the list, as its chevron does (the owner,
 *     LISTS-MENU-2: "pressing the list name is the same as pressing the expand colpase icon"); an open list is lit on the
 *     map and shutting it puts the light out (the orchestrator's ruling; with several open, the last one opened is lit).
 *   · The chevron sits at the row's RIGHT edge, in the section heads' column (25px in from the panel's edge), pointing
 *     right shut and down open, as Explore's do; ⋮ is the control just left of it; on a phone both are 44px boxes. The
 *     count is text beside the name.
 *   · The menu ends whole on screen at 390x631, for a long list's LAST row and in a scrolled drawer (ruling 5); it closes
 *     by Esc, a press outside, a second press of ⋮ and a choice; its keys are ↑ ↓ Home End, Enter, Esc, Tab.
 * Every press is a player's: the mouse at 1440 (`clickByMouse`), a touch tap at 390x631 at a measured centre, or keys.
 * Lists are SEEDED through the app's own model (setup only).
 *
 * Mutants, each red against these tests on a real rebuild, a neutral control green (the archive's v1.295.1 entry has the
 * table): the name renaming again; Delete without its Undo; Duplicate losing an item; Duplicate reordering; a press
 * outside not closing the menu; the arrow keys dead; ⋮ at 24px on a phone; the menu placed under ⋮ unclamped (red at the
 * last row at the drawer's foot); the count at 30px on a phone; a second press of ⋮ not shutting it; Esc also closing the
 * pane; Rename's Enter leaving focus nowhere. NONE SURVIVED.
 * LISTS-MENU-2 (the row opens and shuts; the chevron in Explore's column), each red here, a control green: the name
 * renaming again; the row's press lighting only (the first build); opening not lighting; shutting leaving the light on;
 * the chevron off the section heads' column; a press among an open list's items shutting it; the chevron at 24px on a
 * phone; the first list opened keeping the light; ⋮ at 24px on a phone. SURVIVED, recorded: the editor's just-closed
 * latch removed (lists-rename.spec.ts's "while editing…" stays green: in Chromium the editor's commit re-renders the row
 * between the press's down and up, so the click never reaches a row; the latch is a second guard this test cannot reach).
 */

type W = any;
type Box = { x: number; y: number; width: number; height: number };

const settleSystems = async (page: Page) => {
  await page.evaluate(() => (window as W).__neural._ensureSystems());
  await expect.poll(() => page.evaluate(() => !!(window as W).__neural.systems), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(80);
};
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
    a._listExpand().clear();   // each row its one header line
    return out;
  }, spec);
const lists = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as W).__neural.lists)));
const lit = (page: Page) => page.evaluate(() => (window as W).__neural._listFocusId);
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
const menuSel = (id: string) => `[data-list-menu-open="${id}"]`;
const itemSel = (id: string, k: string) => `${menuSel(id)} [data-list-menu-item="${k}"]`;
/** The open menu, whole on the screen, every item a thumb tall when `thumb`. */
const menuWhole = async (page: Page, id: string, vw: number, vh: number, thumb: boolean, how: string) => {
  const m = await boxOf(page, menuSel(id));
  expect(m.x >= 0 && m.y >= 0 && m.x + m.width <= vw && m.y + m.height <= vh, `the menu is whole on the screen (${how}): ${JSON.stringify(m)}`).toBe(true);
  for (const k of ["rename", "duplicate", "share", "delete"]) {
    const b = await boxOf(page, itemSel(id, k));
    if (thumb) expect(b.height, k + " is a thumb tall").toBeGreaterThanOrEqual(44);
    expect(await hitsAll(page, itemSel(id, k)), k + ": its whole box is its own").toEqual([]);
  }
  // never over the hand: no dealt card under it
  const cards = await page.evaluate(() => [...document.querySelectorAll("[data-tech]")].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => ({ x: r.left, y: r.top, width: r.width, height: r.height })));
  for (const c of cards) expect(overlap(m, c), "the menu covers no card of the hand").toBe(0);
};

test("1440 by mouse: ⋮ is the row's one control; its menu's Rename, Duplicate, Share link and Delete each do their thing", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [S] = await seed(page, [{ name: "Monday fundamentals", n: 3 }, { name: "Guard", n: 1 }]);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  await page.mouse.move(700, 450);
  const row = `[data-list-row="${S.id}"]`;
  await page.locator(row).scrollIntoViewIfNeeded();
  for (const gone of ["[data-list-edit]", "[data-list-share]", "[data-list-delete]"]) await expect(page.locator(`${row} ${gone}`), gone + " left the row").toHaveCount(0);
  const dots = `[data-list-menu="${S.id}"]`;
  await expect(page.locator(dots), "the row's one control").toHaveCount(1);
  expect(await page.locator(dots).evaluate((el) => { let o = 1; for (let e: HTMLElement | null = el as HTMLElement; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; }), "visible at rest").toBe(1);
  expect(await hitsAll(page, dots)).toEqual([]);

  // the menu: its four items, in his order
  await j.clickByMouse(dots, "⋮");
  await expect(page.locator(menuSel(S.id))).toBeVisible();
  await expect(page.locator(dots)).toHaveAttribute("aria-expanded", "true");
  expect(await page.locator(`${menuSel(S.id)} [data-list-menu-item]`).allTextContents()).toEqual(["Rename", "Duplicate", "Share link", "Delete"]);
  await menuWhole(page, S.id, 1440, 900, false, "1440");

  // Rename: today's editor, focused and selected; Enter saves; focus back on ⋮
  await j.clickByMouse(itemSel(S.id, "rename"), "Rename");
  await expect(page.locator(menuSel(S.id)), "a choice closes the menu").toHaveCount(0);
  const inp = page.locator(`[data-list-rename="${S.id}"]`);
  await expect(inp).toBeVisible();
  expect(await inp.evaluate((el: HTMLInputElement) => document.activeElement === el && el.selectionStart === 0 && el.selectionEnd === el.value.length)).toBe(true);
  await page.keyboard.type("Thursday drills");
  await page.keyboard.press("Enter");
  expect((await lists(page))[S.id].name).toBe("Thursday drills");
  expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute("data-list-menu")), "focus is back on ⋮").toBe(S.id);

  // Duplicate: "<name> copy", the same techniques in the same order, its name editor open
  await j.clickByMouse(dots, "⋮");
  await j.clickByMouse(itemSel(S.id, "duplicate"), "Duplicate");
  let now = await lists(page);
  const copy = Object.keys(now).find((k) => now[k].name === "Thursday drills copy")!;
  expect(copy, "a copy was made").toBeTruthy();
  expect(now[copy].items, "the same techniques, in the same order").toEqual(now[S.id].items);
  await expect(page.locator(`[data-list-rename="${copy}"]`), "the copy opens in its name editor").toBeFocused();
  await page.keyboard.press("Escape");
  expect((await lists(page))[copy].name, "its name is offered, never demanded").toBe("Thursday drills copy");

  // Share link: exactly what the Share icon did (the link of this list)
  await j.clickByMouse(dots, "⋮");
  await j.clickByMouse(itemSel(S.id, "share"), "Share link");
  await expect.poll(() => page.evaluate(() => (window as W).__neural._lastShareUrl || "")).toMatch(/\/l\/[A-Za-z0-9_-]+$/);
  expect(await page.evaluate((id) => { const a = (window as W).__neural; return a._lastShareUrl.endsWith("/l/" + a.listShareCode(id)); }, S.id), "the link is this list's").toBe(true);

  // Delete: one press, then Undo brings it back exactly
  const before = (await lists(page))[S.id];
  await j.clickByMouse(dots, "⋮");
  await j.clickByMouse(itemSel(S.id, "delete"), "Delete");
  expect((await lists(page))[S.id], "one press deletes").toBeUndefined();
  await j.clickByMouse(`[data-list-undo="${S.id}"]`, "Undo");
  expect((await lists(page))[S.id], "Undo puts it back exactly").toEqual(before);
});

test("a press on the name, or anywhere on the row but ⋮, opens and shuts the list; open is lit; the chevron in Explore's column (1440 by mouse)", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [S] = await seed(page, [{ name: "Monday fundamentals: guard retention and passing", n: 2 }]);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  await page.mouse.move(700, 450);
  await page.locator(`[data-list-row="${S.id}"]`).scrollIntoViewIfNeeded();
  await rowOpensEverywhere(page, S.id, (x, y) => page.mouse.click(x, y), "1440, mouse");
  await chevronsAligned(page, S.id, "1440");
});

test("with several lists open, the last one opened is the lit one; shutting it puts the light out", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [A, B] = await seed(page, [{ name: "Monday", n: 2 }, { name: "Guard", n: 1 }]);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  await j.clickByMouse(`[data-list-name="${A.id}"]`, "Monday");
  expect(await lit(page)).toBe(A.id);
  await j.clickByMouse(`[data-list-name="${B.id}"]`, "Guard");
  expect(await lit(page), "the last one opened").toBe(B.id);
  await expect(page.locator(`[data-list-items="${A.id}"]`), "the first stays open").toHaveCount(1);
  await j.clickByMouse(`[data-list-name="${A.id}"]`, "Monday again");
  expect(await lit(page), "shutting a list that is not the lit one leaves the light").toBe(B.id);
  await j.clickByMouse(`[data-list-name="${B.id}"]`, "Guard again");
  expect(await lit(page), "shutting the lit one puts it out").toBe(null);
  // a press inside an open list's items (between their controls) does not shut it
  await j.clickByMouse(`[data-list-name="${A.id}"]`, "Monday, open again");
  const item = await boxOf(page, `[data-list-items="${A.id}"] [data-list-itemrow]`);
  await page.mouse.click(item.x + 4, item.y + item.height / 2);
  await expect(page.locator(`[data-list-items="${A.id}"]`), "a press among its items keeps it open").toHaveCount(1);
});

/** The row's press, measured as the orchestrator's probe measures it, then pressed: on the name it opens and lights, again
 *  it shuts and puts the light out; the chevron does the same. The list starts SHUT (one line). */
async function rowOpensEverywhere(page: Page, id: string, press: (x: number, y: number) => Promise<void>, how: string) {
  const map = await page.evaluate((lid) => {
    const row = document.querySelector(`[data-list-row="${lid}"]`) as HTMLElement, R = row.getBoundingClientRect();
    const dots = (row.querySelector("[data-list-menu]") as HTMLElement).getBoundingClientRect();
    let n = 0, opens = 0, stolen = 0, outside = 0;
    for (let y = R.top + 1; y < R.bottom; y += 2) for (let x = R.left + 1; x < R.right; x += 2) {
      n++;
      const el = document.elementFromPoint(x, y), inRow = !!el && row.contains(el);
      if (!inRow) { outside++; continue; }
      const ctl = el!.closest("button,input");
      const isOpen = !ctl || !!el!.closest("[data-list-open]");
      if (isOpen) opens++;
      const inDots = x >= dots.left - 1 && x <= dots.right + 1 && y >= dots.top - 1 && y <= dots.bottom + 1;
      if (!inDots && !isOpen) stolen++;
    }
    const nm = row.querySelector("[data-list-name]") as HTMLElement;
    return { opens: Math.round((1000 * opens) / n) / 10, outside: Math.round((1000 * outside) / n) / 10, stolen, nameIsControl: !!nm.closest("button,input") };
  }, id);
  const say = `${how}: a press opens or shuts the list on ${map.opens}% of its row (its rounded corners ${map.outside}%)`;
  expect(map.nameIsControl, "the name is not a control").toBe(false);
  expect(map.stolen, say + " — nothing but ⋮ answers a point of the row otherwise").toBe(0);
  const pressName = async () => { const nm = await boxOf(page, `[data-list-name="${id}"]`); await press(nm.x + Math.min(30, nm.width / 2), nm.y + nm.height / 2); };
  await pressName();
  await expect(page.locator(`[data-list-items="${id}"]`), "a press on the name opens the list (" + how + ")").toHaveCount(1);
  await expect.poll(() => lit(page), { message: "…and an open list is lit" }).toBe(id);
  await expect(page.locator(`[data-list-rename="${id}"]`), "…and renames nothing").toHaveCount(0);
  await pressName();
  await expect(page.locator(`[data-list-items="${id}"]`), "again: it shuts").toHaveCount(0);
  expect(await lit(page), "…and the light is out").toBe(null);
  const chev = await boxOf(page, `[data-list-open="${id}"]`);
  await press(chev.x + chev.width / 2, chev.y + chev.height / 2);
  await expect(page.locator(`[data-list-items="${id}"]`), "the chevron opens it the same").toHaveCount(1);
  expect(await lit(page)).toBe(id);
  await press(chev.x + chev.width / 2, chev.y + chev.height / 2);
  await expect(page.locator(`[data-list-items="${id}"]`)).toHaveCount(0);
  expect(await lit(page)).toBe(null);
}
/** The list row's chevron and Explore's section heads': the same column (the glyph's right edge), the same glyph. */
async function chevronsAligned(page: Page, id: string, how: string) {
  // setup: Explore's fold open, so its section heads are drawn beside Your lists
  await page.evaluate(() => { const a = (window as W).__neural; if (!a._exploreSectionOpen("Explore")) a._toggleExploreSection("Explore"); });
  await page.waitForTimeout(200);
  const g = await page.evaluate((lid) => {
    const pane = (document.querySelector(".ng-drill") as HTMLElement).getBoundingClientRect();
    const right = (el: Element | null) => { const s = el && (el.querySelector("svg") || el); return s ? Math.round((pane.right - (s as Element).getBoundingClientRect().right) * 10) / 10 : null; };
    const heads = [...document.querySelectorAll("[data-explore-section] .ng-caret")].filter((c) => (c as HTMLElement).getBoundingClientRect().width > 0);
    const mine = document.querySelector(`[data-list-row="${lid}"] [data-list-open] .ng-caret`);
    return { heads: heads.map(right), mine: right(mine), open: mine && mine.getAttribute("data-open") };
  }, id);
  expect(g.heads.length, "premise: section heads with chevrons are on screen (" + how + ")").toBeGreaterThan(0);
  for (const h of g.heads) expect(Math.abs((g.mine as number) - (h as number)), `${how}: the list's chevron (${g.mine}px from the panel's edge) is in the section heads' column (${h}px)`).toBeLessThanOrEqual(1);
  expect(g.open, "shut, it points right as theirs do").toBe("0");
}

test("the menu's keys: Enter opens it on its first item, ↑ ↓ Home End move, Esc and Tab close it, focus back on ⋮", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [S] = await seed(page, [{ name: "Monday", n: 1 }]);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  const dots = `[data-list-menu="${S.id}"]`;
  const focused = () => page.evaluate(() => { const e = document.activeElement as HTMLElement | null; return e ? e.getAttribute("data-list-menu-item") || (e.getAttribute("data-list-menu") ? "dots" : e.tagName) : null; });
  await page.locator(dots).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(menuSel(S.id))).toBeVisible();
  expect(await focused(), "a key opens it on its first item").toBe("rename");
  await page.keyboard.press("ArrowDown"); expect(await focused()).toBe("duplicate");
  await page.keyboard.press("End"); expect(await focused()).toBe("delete");
  await page.keyboard.press("ArrowDown"); expect(await focused(), "↓ wraps").toBe("rename");
  await page.keyboard.press("ArrowUp"); expect(await focused(), "↑ wraps").toBe("delete");
  await page.keyboard.press("Home"); expect(await focused()).toBe("rename");
  await page.keyboard.press("Escape");
  await expect(page.locator(menuSel(S.id)), "Esc closes it").toHaveCount(0);
  expect(await focused(), "…focus back on ⋮").toBe("dots");
  await expect(page.locator(".ng-drill"), "…and Esc did not close the pane").toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator(menuSel(S.id))).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(menuSel(S.id)), "Tab closes it").toHaveCount(0);
  // by mouse: a second press of ⋮ shuts it; a press outside shuts it
  await j.clickByMouse(dots, "⋮");
  await expect(page.locator(menuSel(S.id))).toBeVisible();
  await j.clickByMouse(dots, "⋮ again");
  await expect(page.locator(menuSel(S.id)), "a second press of ⋮ shuts it").toHaveCount(0);
  await j.clickByMouse(dots, "⋮");
  const head = await boxOf(page, "[data-lists-head]");
  await page.mouse.click(head.x + 20, head.y + head.height / 2);
  await expect(page.locator(menuSel(S.id)), "a press outside shuts it").toHaveCount(0);
});

test("Duplicate at the name's 60-character limit: the copy's name ends in ' copy' and fits", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const sixty = "Monday fundamentals: guard retention, passing, escapes, back";   // 60 characters
  expect(sixty.length).toBe(60);
  const [S] = await seed(page, [{ name: sixty, n: 2 }]);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  await j.clickByMouse(`[data-list-menu="${S.id}"]`, "⋮");
  await j.clickByMouse(itemSel(S.id, "duplicate"), "Duplicate");
  await page.keyboard.press("Escape");
  const now = await lists(page);
  const copy = Object.keys(now).find((k) => k !== S.id)!;
  expect(now[copy].name.length).toBeLessThanOrEqual(60);
  expect(now[copy].name.endsWith(" copy")).toBe(true);
  expect(now[copy].items).toEqual(now[S.id].items);
});

test.describe("at 390x631 by touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } });
  const tapAt = async (page: Page, sel: string) => {
    const b = await boxOf(page, sel);
    const own = await page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x as number, y as number), t = document.querySelector(s as string); return !!(e && t && (t === e || t.contains(e))); }, [b.x + b.width / 2, b.y + b.height / 2, sel]);
    expect(own, "the tap's point is " + sel).toBe(true);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  };
  const openByTouch = async (page: Page) => {
    await tapAt(page, ".ng-logo");
    await expect(page.locator(".ng-drill")).toBeVisible();
    await settleSystems(page);
  };

  test("⋮ and the chevron are 44px targets that overlap nothing; the name's press opens and shuts; each item by touch", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const [S] = await seed(page, [{ name: "Monday fundamentals: guard retention, passing and escapes", n: 3 }]);
    await openByTouch(page);
    await page.locator(`[data-list-row="${S.id}"]`).scrollIntoViewIfNeeded();
    const dots = `[data-list-menu="${S.id}"]`, chev = `[data-list-open="${S.id}"]`;
    const d = await boxOf(page, dots), c = await boxOf(page, chev), n = await boxOf(page, `[data-list-name="${S.id}"]`);
    for (const [k, b, s] of [["⋮", d, dots], ["the chevron", c, chev]] as const) {
      expect(b.width, k + " is a thumb wide").toBeGreaterThanOrEqual(44);
      expect(b.height, k + " is a thumb tall").toBeGreaterThanOrEqual(44);
      expect(await hitsAll(page, s), k + ": its whole box is its own").toEqual([]);
    }
    expect(overlap(d, c), "⋮ and the chevron").toBe(0);
    expect(overlap(d, n), "⋮ and the name").toBe(0);
    expect(c.x + c.width / 2 - (d.x + d.width / 2), "⋮ and the chevron: centres a thumb apart").toBeGreaterThanOrEqual(43.5);
    expect(c.x > d.x, "⋮ is just left of the chevron").toBe(true);
    const row = await boxOf(page, `[data-list-row="${S.id}"]`);
    expect(row.height, "the row is one line").toBeLessThanOrEqual(Math.max(d.height, c.height) + 1);
    await rowOpensEverywhere(page, S.id, (x, y) => page.touchscreen.tap(x, y), "390x631, touch");
    await chevronsAligned(page, S.id, "390");

    // each item, by touch
    await tapAt(page, dots);
    await expect(page.locator(menuSel(S.id))).toBeVisible();
    await menuWhole(page, S.id, 390, 631, true, "390, the row");
    await tapAt(page, itemSel(S.id, "duplicate"));
    let now = await lists(page);
    const copy = Object.keys(now).find((k) => k !== S.id)!;
    expect(now[copy].items).toEqual(now[S.id].items);
    await page.keyboard.press("Escape");
    await page.locator(dots).scrollIntoViewIfNeeded();
    await tapAt(page, dots);
    await tapAt(page, itemSel(S.id, "rename"));
    await expect(page.locator(`[data-list-rename="${S.id}"]`)).toBeFocused();
    await page.keyboard.press("Escape");
    await page.locator(dots).scrollIntoViewIfNeeded();
    await tapAt(page, dots);
    await tapAt(page, itemSel(S.id, "delete"));
    expect((await lists(page))[S.id], "deleted by one tap").toBeUndefined();
    const undo = `[data-list-undo="${S.id}"]`;
    await page.locator(undo).scrollIntoViewIfNeeded();
    await tapAt(page, undo);
    now = await lists(page);
    expect(now[S.id] && now[S.id].items.length, "Undo by touch").toBe(3);
  });

  test("the menu ends whole on screen for a long list's LAST row, at the drawer's foot and in a scrolled drawer", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const many = await seed(page, Array.from({ length: 9 }, (_, i) => ({ name: "Class " + (i + 1) + ": a longer name for the row", n: 1 })));
    const last = (await page.evaluate(() => (window as W).__neural.listsArray())).slice(-1)[0] as string;
    expect(many.map((m) => m.id)).toContain(last);
    await openByTouch(page);
    const dots = `[data-list-menu="${last}"]`;
    // (1) the last row at the very foot of the drawer's visible list
    await page.locator(`[data-list-row="${last}"]`).evaluate((el) => el.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(150);
    await tapAt(page, dots);
    await expect(page.locator(menuSel(last))).toBeVisible();
    await menuWhole(page, last, 390, 631, true, "390, the last row at the drawer's foot");
    await page.keyboard.press("Escape");
    // (2) the drawer scrolled, the last row mid-screen
    await page.locator(`[data-list-row="${last}"]`).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => { const s = document.querySelector(".ng-learning-list") as HTMLElement | null; return s ? s.scrollTop : -1; }), "premise: the drawer is scrolled").toBeGreaterThan(0);
    await tapAt(page, dots);
    await menuWhole(page, last, 390, 631, true, "390, a scrolled drawer");
  });
});
