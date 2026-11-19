import { test, expect, type Browser, type Page } from "@playwright/test";
import { journey } from "../dsl";
import { installNeuralAuthSDK, signInNeuralAuthSDK, waitNeuralAuthOwner } from "../fixtures/neural-auth-sdk";

/**
 * MOVING AN ITEM BETWEEN LISTS (LISTS-R, Slice 2). The owner, 19 Nov: "how can i rename a list? or move items between lists
 * like drag and drop?". Rename was Slice 1 (v1.293.5); this is the move, by the control a phone can use:
 *   · ⇄ on every item row ([data-list-item-move]) opens the star's own menu in its MOVE mode ([data-list-picker-move]):
 *     the list the item is in now is shown and cannot be chosen ("here"), a list that has it already can be (the move then
 *     only takes it out of here), a full one cannot be; "New list" makes a list and moves the item into it;
 *   · a move adds to the target, then takes out of the source, one save, and writes two cells (`listItemAt`), so it stays a
 *     move on the account's other devices (tests/share_lists_store.test.mjs, tests/list_moves_sync.test.mjs);
 *   · its Undo is the delete's one slot, naming what it takes back ([data-list-undo-move]); it puts the item back at its
 *     place, and a list the move emptied comes back whole;
 *   · on a phone the item row's ▶, ⇄ and × and the list row's count are 44px targets (ruling 5, carried from Slice 1).
 * Every press is a player's: the mouse at 1440 (`clickByMouse`), a touch tap at 390x631 at a measured centre, or keys.
 * Lists are SEEDED through the app's own model (setup only); the cells and lists are read back from the app's record.
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
const cells = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as W).__neural.listItemAt || {})));
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
const moveSel = (node: string, list: string) => `[data-list-item-move="${node}"][data-list-of="${list}"]`;
const itemIn = (node: string, list: string) => `[data-list-items="${list}"] [data-list-item="${node}"]`;
/** elementFromPoint at the centre and 2px inside each edge: the control or inside it. */
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

test("1440 by mouse: ⇄ opens the menu in its move mode; the item lands in the target only, two cells record it, and Undo puts it back", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [S, T] = await seed(page, [{ name: "Monday fundamentals", n: 3 }, { name: "Guard", n: 1 }]);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  const x = S.items[1]; // the middle item: Undo must put it back at its place, not at the end
  await page.locator(moveSel(x, S.id)).scrollIntoViewIfNeeded();
  await j.clickByMouse(moveSel(x, S.id), "the item's move control");

  const menu = page.locator(`[data-list-picker-move="${S.id}"]`);
  await expect(menu, "the star's menu, in its move mode").toBeVisible();
  await expect(menu.locator("[data-picker-head]")).toContainText("Move to list");
  await expect(menu.locator(`[data-list-pick="${S.id}"]`), "the list it is in now is shown").toHaveAttribute("data-list-pick-note", "here");
  await expect(menu.locator(`[data-list-pick="${S.id}"]`), "…and cannot be chosen").toBeDisabled();
  await j.clickByMouse(`[data-list-picker-move] [data-list-pick="${T.id}"]`, "the target list");
  await expect(menu).toHaveCount(0);

  const after = await lists(page);
  expect(after[S.id].items, "out of the source, the others in their order").toEqual([S.items[0], S.items[2]]);
  expect(after[T.id].items, "into the target, at its end").toEqual([T.items[0], x]);
  const c = await cells(page);
  expect(c[S.id][x][1], "a cell: it LEFT the source").toBe(0);
  expect(c[T.id][x][1], "a cell: it ENTERED the target").toBe(1);
  expect(c[S.id][x][0], "one stamp for both").toBe(c[T.id][x][0]);
  await expect(page.locator(itemIn(x, T.id)), "the target shows it").toHaveCount(1);
  await expect(page.locator(itemIn(x, S.id)), "the source does not").toHaveCount(0);
  await page.evaluate(() => (window as W).__neural._flushSave());
  const saved = await page.evaluate(() => { const k = Object.keys(localStorage).find((k) => k.endsWith(":progress")); return k ? JSON.parse(localStorage.getItem(k) || "{}").listItemAt || null : null; });
  expect(saved && saved[S.id] && saved[S.id][x], "the cells are in the saved record (the owner's `:progress` key)").toEqual(c[S.id][x]);

  // Undo: the offer names what it takes back, and puts the item back where it was
  const undo = page.locator(`[data-list-undo-move="${x}"]`);
  await expect(undo, "an Undo for the move").toBeVisible();
  await expect(undo.locator("xpath=..")).toContainText("Moved");
  await j.clickByMouse(`[data-list-undo-move="${x}"]`, "Undo");
  const back = await lists(page);
  expect(back[S.id].items, "back at its place").toEqual(S.items);
  expect(back[T.id].items, "out of the target again").toEqual(T.items);
  const c2 = await cells(page);
  expect(c2[S.id][x][1], "the undo's cells: in the source again").toBe(1);
  expect(c2[T.id][x][1], "…out of the target").toBe(0);
  expect(c2[S.id][x][0], "…later than the move's").toBeGreaterThan(c[S.id][x][0]);
});

test("the move menu's rows: a list that has it already, a full one, and New list moving it into a newborn list", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [S, H, F] = await seed(page, [{ name: "Monday", n: 2 }, { name: "Has it", n: 0 }, { name: "Full", n: 0 }]);
  const x = S.items[0];
  // setup: "Has it" holds x too; "Full" holds 60 others (the cap a share link can carry)
  await page.evaluate(([x, h, f]) => {
    const a = (window as W).__neural;
    a.addToList(x, h);
    const pool = a.nodes.filter((n: W) => n.ty === "submissions" && typeof n.o === "number").slice(0, 60);
    for (const n of pool) a.addToList(n.id, f);
  }, [x, H.id, F.id]);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  await page.locator(moveSel(x, S.id)).scrollIntoViewIfNeeded();
  await j.clickByMouse(moveSel(x, S.id), "the item's move control");
  const menu = page.locator(`[data-list-picker-move="${S.id}"]`);
  await expect(menu.locator(`[data-list-pick="${H.id}"]`)).toHaveAttribute("data-list-pick-note", "has it");
  await expect(menu.locator(`[data-list-pick="${H.id}"]`), "a list that has it can be chosen").toBeEnabled();
  await expect(menu.locator(`[data-list-pick="${F.id}"]`)).toHaveAttribute("data-list-pick-note", "full");
  await expect(menu.locator(`[data-list-pick="${F.id}"]`), "a full one cannot").toBeDisabled();
  await j.clickByMouse(`[data-list-picker-move] [data-list-pick="${H.id}"]`, "the list that has it");
  let now = await lists(page);
  expect(now[S.id].items, "out of here").toEqual([S.items[1]]);
  expect(now[H.id].items.filter((n: string) => n === x).length, "and still once there").toBe(1);

  // New list: made and the item moved into it, in one action
  const y = S.items[1];
  await page.locator(moveSel(y, S.id)).scrollIntoViewIfNeeded();
  await j.clickByMouse(moveSel(y, S.id), "the last item's move control");
  await j.clickByMouse("[data-list-picker-move] [data-list-pick-new]", "New list");
  await page.locator("[data-list-pick-newname]").fill("Thursday open mat");
  await page.keyboard.press("Enter");
  now = await lists(page);
  const born = Object.keys(now).find((k) => now[k].name === "Thursday open mat")!;
  expect(born, "a list was made").toBeTruthy();
  expect(now[born].items).toEqual([y]);
  expect(now[S.id], "the source, emptied, is gone").toBeUndefined();
  // and its Undo brings the source back whole, and takes the newborn away (it held nothing else)
  await j.clickByMouse(`[data-list-undo-move="${y}"]`, "Undo");
  now = await lists(page);
  expect(now[S.id] && now[S.id].items, "the source is back").toEqual([y]);
  expect(now[born], "the newborn list held only the moved item: it goes").toBeUndefined();
});

test("by keyboard: Enter on ⇄, the target by Tab and Enter; focus follows the item to its new list", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [S, T] = await seed(page, [{ name: "Monday", n: 2 }, { name: "Guard", n: 1 }]);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  const x = S.items[0];
  await page.locator(moveSel(x, S.id)).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-list-picker-move="${S.id}"]`)).toBeVisible();
  // the menu's rows are buttons in the page's order: Tab to the target's
  for (let i = 0; i < 8; i++) {
    if (await page.evaluate((t) => (document.activeElement as HTMLElement | null)?.getAttribute("data-list-pick") === t, T.id)) break;
    await page.keyboard.press("Tab");
  }
  expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute("data-list-pick"))).toBe(T.id);
  await page.keyboard.press("Enter");
  expect((await lists(page))[T.id].items).toEqual([T.items[0], x]);
  expect(
    await page.evaluate(() => { const e = document.activeElement as HTMLElement | null; return e ? [e.getAttribute("data-list-item-move"), e.getAttribute("data-list-of")] : null; }),
    "focus is on the moved item's ⇄, in the list it went to",
  ).toEqual([x, T.id]);
});

test.describe("at 390x631 by touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } });

  test("the item row's ▶, ⇄ and × and the list row's count are 44px targets that overlap nothing; a move and its Undo by touch", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const [S, T] = await seed(page, [{ name: "Monday fundamentals: guard retention, passing and escapes", n: 3 }, { name: "Guard", n: 1 }]);
    await tapAt(page, ".ng-logo");
    await expect(page.locator(".ng-drill")).toBeVisible();
    await settleSystems(page);
    const x = S.items[1];
    await page.locator(moveSel(x, S.id)).scrollIntoViewIfNeeded();

    // the item row: three 44px boxes at an even pitch, overlapping nothing (each other, the name)
    const row = `[data-list-itemrow="${x}"]`;
    const sels = { play: `${row} [data-play-from]`, move: moveSel(x, S.id), del: `[data-list-item-remove="${x}"][data-list-of="${S.id}"]` };
    const b: Record<string, Box> = {};
    for (const [k, s] of Object.entries(sels)) {
      b[k] = await boxOf(page, s);
      expect(b[k].width, k + " is a thumb wide").toBeGreaterThanOrEqual(44);
      expect(b[k].height, k + " is a thumb tall").toBeGreaterThanOrEqual(44);
      expect(await hitsAll(page, s), k + ": its whole box is its own (elementFromPoint)").toEqual([]);
    }
    const name = await boxOf(page, `${row} [data-list-item]`);
    const all: Record<string, Box> = { ...b, name };
    const keys = Object.keys(all);
    for (let i = 0; i < keys.length; i++) for (let k = i + 1; k < keys.length; k++) expect(overlap(all[keys[i]], all[keys[k]]), keys[i] + " and " + keys[k] + " overlap nowhere").toBe(0);
    const cx = (r: Box) => r.x + r.width / 2;
    expect(cx(b.move) - cx(b.play), "▶ and ⇄: centres a thumb apart").toBeGreaterThanOrEqual(43.5);
    expect(cx(b.del) - cx(b.move), "⇄ and ×: centres a thumb apart").toBeGreaterThanOrEqual(43.5);
    // the ▶'s look is its 24px chip, drawn inside the thumb's box
    expect(await page.locator(sels.play).evaluate((el) => getComputedStyle(el, "::before").borderTopStyle), "the chip is drawn inside").toBe("solid");

    // the list row's count: a thumb's box too, clear of the name and the pencil
    const count = await boxOf(page, `[data-list-open="${S.id}"]`);
    expect(count.width).toBeGreaterThanOrEqual(44);
    expect(count.height).toBeGreaterThanOrEqual(44);
    expect(await hitsAll(page, `[data-list-open="${S.id}"]`), "the count's whole box is its own").toEqual([]);
    expect(overlap(count, await boxOf(page, `[data-list-name="${S.id}"]`)), "count and name").toBe(0);
    expect(overlap(count, await boxOf(page, `[data-list-edit="${S.id}"]`)), "count and pencil").toBe(0);

    // a move by touch, and its Undo
    await tapAt(page, sels.move);
    await expect(page.locator(`[data-list-picker-move="${S.id}"]`)).toBeVisible();
    const pick = `[data-list-picker-move] [data-list-pick="${T.id}"]`;
    const pb = await boxOf(page, pick);
    expect(pb.height, "the menu's row is a thumb tall").toBeGreaterThanOrEqual(44);
    expect(pb.x >= 0 && pb.x + pb.width <= 390 && pb.y >= 0 && pb.y + pb.height <= 631, "and on the screen").toBe(true);
    await tapAt(page, pick);
    let now = await lists(page);
    expect(now[S.id].items).toEqual([S.items[0], S.items[2]]);
    expect(now[T.id].items).toEqual([T.items[0], x]);
    const undo = `[data-list-undo-move="${x}"]`;
    await page.locator(undo).scrollIntoViewIfNeeded();
    expect((await boxOf(page, undo)).height, "Undo is a thumb tall").toBeGreaterThanOrEqual(44);
    await tapAt(page, undo);
    now = await lists(page);
    expect(now[S.id].items, "back at its place").toEqual(S.items);
    expect(now[T.id].items).toEqual(T.items);
  });
});

// ─────────────────────────────────────────────── two browsers, one account
// `e2e/fixtures/neural-auth-sdk.ts` keeps a synthetic backend per browser context; one backend is modelled by copying the
// account's row from the browser that wrote it into the next one before that one reads (lists-two-browsers.spec.ts).
const ACC = "lists-move-a";
async function browserAt(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const j = journey(page);
  await j.boot("/", {
    keepTutorial: true,
    beforeNavigate: async (p) => {
      await installNeuralAuthSDK(p);
      await p.route(/\/app\/game-values\.js(?:\?|$)/, (route) => route.abort("failed"));
    },
  });
  await waitNeuralAuthOwner(page, null);
  return { ctx, page, j, errors };
}
const share = async (from: Page, to: Page) => {
  const row = await from.evaluate((id) => (window as W).__authOwnerFixture.cloudOf(id), ACC);
  expect(row, "the backend holds the account's row").not.toBeNull();
  await to.evaluate(([id, row]) => (window as W).__authOwnerFixture.seedCloud(id, row), [ACC, row] as const);
  return row;
};
const pull = (page: Page) => page.evaluate(() => (window as W).__neural._pullAndMerge());
const flush = (page: Page) => page.evaluate(() => (window as W).__neural._flushSave());
const sorted = (l: W) => Object.fromEntries(Object.keys(l).sort().map((k) => [l[k].name, l[k].items.slice().sort()]));

test("two browsers, one account: a move in one stays a move in the other, and comes back intact", async ({ browser }) => {
  test.setTimeout(240_000);
  const X = await browserAt(browser), Y = await browserAt(browser);
  try {
    await signInNeuralAuthSDK(X.page, ACC);
    await X.j.land("Mount Top");
    const [S, T] = await seed(X.page, [{ name: "Monday", n: 2 }, { name: "Guard", n: 1 }]);
    await flush(X.page);
    await expect.poll(async () => !!(await X.page.evaluate((id) => (window as W).__authOwnerFixture.cloudOf(id), ACC))).toBe(true);
    // Y signs in to the same account and holds both lists as they were
    await share(X.page, Y.page);
    await signInNeuralAuthSDK(Y.page, ACC);
    await expect.poll(async () => sorted(await lists(Y.page))).toEqual({ Monday: S.items.slice().sort(), Guard: T.items.slice().sort() });

    // X moves Monday's first item to Guard, by mouse
    const x = S.items[0];
    await X.page.locator(".ng-logo").click();
    await settleSystems(X.page);
    await X.page.locator(moveSel(x, S.id)).scrollIntoViewIfNeeded();
    await X.j.clickByMouse(moveSel(x, S.id), "the item's move control");
    await X.j.clickByMouse(`[data-list-picker-move] [data-list-pick="${T.id}"]`, "Guard");
    await flush(X.page);
    await expect.poll(async () => {
      const row = await X.page.evaluate((id) => (window as W).__authOwnerFixture.cloudOf(id), ACC);
      return !!(row && row.neural && row.neural.listItemAt && row.neural.listItemAt[S.id]);
    }, { message: "the backend holds the move's cells" }).toBe(true);

    // Y pulls: Y's own copy still has the item in Monday, and the move stays a move
    await share(X.page, Y.page);
    expect(await pull(Y.page)).toBe(true);
    const want = { Monday: [S.items[1]], Guard: [T.items[0], x].sort() };
    expect(sorted(await lists(Y.page)), "in the other browser: in Guard only").toEqual(want);
    await flush(Y.page);

    // and back: X pulls what Y holds now; nothing returns to Monday
    await share(Y.page, X.page);
    expect(await pull(X.page)).toBe(true);
    expect(sorted(await lists(X.page)), "back in the first browser: unchanged").toEqual(want);
    for (const s of [X, Y]) expect(s.errors, "page errors").toEqual([]);
  } finally {
    for (const s of [X, Y]) await s.ctx.close();
  }
});
