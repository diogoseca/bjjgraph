import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * DRAG AN ITEM ONTO ANOTHER LIST, ON A DESKTOP (LISTS-R Slice 3). The owner, 19 Nov: "how can i rename a list? or move
 * items between lists like drag and drop?"; ruled in prompts/lists-2.md (ruling 4): native drag, a lease against a
 * rebuild, Esc the browser's own, no phone drag. It calls the same `moveListItem` as "Move to…" (lists-move.spec.ts), so
 * the cells, the Undo row and the sync are the move's, proven there and in tests/list_moves_sync.test.mjs.
 *   · a desktop's item row is draggable ([data-list-itemrow].ng-dragrow); hovered, a six-dot grip takes its glyph's place;
 *   · the drop target is another list's row, folded or open (its open items are inside the row): outlined,
 *     [data-list-drop-target], one at a time; never the list the item is in, never a full list;
 *   · Esc cancels (the browser's own), and nothing moves;
 *   · a rebuild of the drawer while an item is in the hand is HELD (the lease), so the row and the targets survive it,
 *     and it runs once the drag ends;
 *   · a phone has no drag: its rows are not draggable ("Move to…" in the ⋮ is its way, and the keyboard's).
 * Every drag is a real mouse: `page.mouse` down, moved in steps, up, at measured centres. Lists are SEEDED through the app's
 * own model (setup only); the lists and cells are read back from the app's record.
 */

type W = any;
type Box = { x: number; y: number; width: number; height: number };

const settleSystems = async (page: Page) => {
  await page.evaluate(() => (window as W).__neural._ensureSystems());
  await expect.poll(() => page.evaluate(() => !!(window as W).__neural.systems), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(80);
};
const seed = (page: Page, spec: { name: string; n: number; from?: string }[]) =>
  page.evaluate((spec) => {
    const a = (window as W).__neural;
    const out: { id: string; items: string[] }[] = [];
    let k = 0;
    for (const s of spec) {
      const pool = a.nodes.filter((x: W) => x.ty === (s.from || "transitions") && typeof x.o === "number").sort((p: W, q: W) => p.o - q.o);
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
const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const itemRow = (node: string, list: string) => `[data-list-items="${list}"] [data-list-itemrow="${node}"]`;
const listHead = (list: string) => `[data-list-row="${list}"] [data-list-name="${list}"]`;
/** The point a player presses to pick the item up: the row's left part, its glyph (the grip, once hovered). */
const gripPoint = async (page: Page, node: string, list: string) => {
  const r = await boxOf(page, itemRow(node, list));
  return { x: r.x + 14, y: r.y + r.height / 2 };
};
/** A real mouse drag, held at the target until `mid` has run, then released (or not, if `release` is false). */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, mid?: () => Promise<void>, release = true) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 4, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 14 });
  if (mid) await mid();
  if (release) await page.mouse.up();
}
const targets = (page: Page) => page.evaluate(() => [...document.querySelectorAll("[data-list-drop-target]")].map((e) => e.getAttribute("data-list-row")));

async function atLists(page: Page, spec: { name: string; n: number; from?: string }[]) {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const made = await seed(page, spec);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  return { j, made };
}

test("1440 by mouse: an item dragged onto another list's folded row lands there only; one Undo puts it back", async ({ page }) => {
  const { j, made: [S, T] } = await atLists(page, [{ name: "Monday fundamentals", n: 3 }, { name: "Guard", n: 1 }]);
  // fold Guard, by its name, as a player does
  await page.locator(listHead(T.id)).scrollIntoViewIfNeeded();
  await j.clickByMouse(listHead(T.id), "Guard's name");
  await expect(page.locator(`[data-list-items="${T.id}"]`), "Guard folded").toHaveCount(0);
  const x = S.items[1];
  await page.locator(itemRow(x, S.id)).scrollIntoViewIfNeeded();
  // hovered, the row shows its grip where its glyph was, and it is draggable
  const row = page.locator(itemRow(x, S.id));
  await expect(row).toHaveAttribute("draggable", "true");
  await page.mouse.move(...Object.values(await gripPoint(page, x, S.id)) as [number, number]);
  await expect(row.locator(".ng-grip"), "the grip shows on hover").toBeVisible();
  await expect(row.locator(".ng-gl"), "…in the glyph's place").toBeHidden();
  const to = centre(await boxOf(page, `[data-list-row="${T.id}"]`));
  await drag(page, await gripPoint(page, x, S.id), to, async () => {
    expect(await targets(page), "held over Guard: Guard is the one target").toEqual([T.id]);
  });
  const after = await lists(page);
  expect(after[S.id].items, "out of the source, the others in order").toEqual([S.items[0], S.items[2]]);
  expect(after[T.id].items, "into Guard, at its end").toEqual([T.items[0], x]);
  const c = await cells(page);
  expect([c[S.id][x][1], c[T.id][x][1]], "two cells: out of Monday, into Guard").toEqual([0, 1]);
  expect(await targets(page), "no outline left").toEqual([]);
  const undo = `[data-list-undo-move="${x}"]`;
  await expect(page.locator(undo).locator("xpath=.."), "the move's own Undo").toContainText("Moved");
  await page.locator(undo).scrollIntoViewIfNeeded();
  await j.clickByMouse(undo, "Undo");
  const back = await lists(page);
  expect(back[S.id].items, "back at its place").toEqual(S.items);
  expect(back[T.id].items).toEqual(T.items);
});

test("onto an open list: its items take the drop; the list it is in and a full list are never targets", async ({ page }) => {
  const { made: [S, T, F] } = await atLists(page, [{ name: "Monday", n: 2 }, { name: "Guard", n: 2 }, { name: "Full", n: 0 }]);
  await page.evaluate((f) => { const a = (window as W).__neural; for (const n of a.nodes.filter((n: W) => n.ty === "submissions" && typeof n.o === "number").slice(0, 60)) a.addToList(n.id, f); }, F.id);
  // fold the full list, by its name, so all three fit the drawer's view at 1440x900 (a drag cannot scroll a hidden target in)
  await page.locator(listHead(F.id)).scrollIntoViewIfNeeded();
  await journey(page).clickByMouse(listHead(F.id), "Full's name");
  await expect(page.locator(`[data-list-items="${F.id}"]`)).toHaveCount(0);
  const x = S.items[0];
  await page.locator(itemRow(x, S.id)).scrollIntoViewIfNeeded();
  // held over its own list's other item: no target, and let go there, nothing moves. (Each drag is checked where it ends:
  // in this harness a second move inside a held drag sends no drag events, so one drag, one destination.)
  await drag(page, await gripPoint(page, x, S.id), centre(await boxOf(page, itemRow(S.items[1], S.id))), async () => {
    expect(await targets(page), "its own list is never a target").toEqual([]);
  });
  expect((await lists(page))[S.id].items, "nothing moved").toEqual(S.items);
  // held over Guard's open items: Guard is the target, and the drop lands there
  await drag(page, await gripPoint(page, x, S.id), centre(await boxOf(page, itemRow(T.items[1], T.id))), async () => {
    expect(await targets(page), "over Guard's open items, Guard").toEqual([T.id]);
  });
  let now = await lists(page);
  expect(now[S.id].items).toEqual([S.items[1]]);
  expect(now[T.id].items).toEqual([...T.items, x]);
  // a full list: held over it, no target; let go there, nothing moves
  const y = S.items[1];
  await page.locator(`[data-list-row="${F.id}"]`).scrollIntoViewIfNeeded();
  await page.locator(itemRow(y, S.id)).scrollIntoViewIfNeeded();
  const fb = await boxOf(page, `[data-list-row="${F.id}"] [data-list-name="${F.id}"]`);
  await drag(page, await gripPoint(page, y, S.id), centre(fb), async () => {
    expect(await targets(page), "a full list is never a target").toEqual([]);
  });
  now = await lists(page);
  expect(now[S.id].items, "nothing moved").toEqual([y]);
  expect(now[F.id].items.length).toBe(60);
});

test("Esc while an item is in the hand cancels: nothing moves, and the drawer is as it was", async ({ page }) => {
  const { made: [S, T] } = await atLists(page, [{ name: "Monday", n: 2 }, { name: "Guard", n: 1 }]);
  const x = S.items[0];
  await page.locator(itemRow(x, S.id)).scrollIntoViewIfNeeded();
  const before = await lists(page);
  await drag(page, await gripPoint(page, x, S.id), centre(await boxOf(page, `[data-list-row="${T.id}"]`)), async () => {
    expect(await targets(page)).toEqual([T.id]);
    await page.keyboard.press("Escape");
  });
  expect(await lists(page), "nothing moved").toEqual(before);
  expect(await targets(page), "no outline left").toEqual([]);
  expect(await page.evaluate(() => (window as W).__neural._listDrag), "the drag is over").toBeNull();
  await expect(page.locator(".ng-drill"), "the drawer is still open (the browser's own Esc took it)").toBeVisible();
});

test("the lease: a rebuild while the item is in the hand is held, the targets survive it, and it runs once the drop is made", async ({ page }) => {
  const { made: [S, T] } = await atLists(page, [{ name: "Monday", n: 2 }, { name: "Guard", n: 1 }]);
  const x = S.items[0];
  await page.locator(itemRow(x, S.id)).scrollIntoViewIfNeeded();
  await drag(page, await gripPoint(page, x, S.id), centre(await boxOf(page, `[data-list-row="${T.id}"]`)), async () => {
    // late data arrives mid-drag: the drawer is asked to rebuild (what the alias index, a pull or a timer does)
    const kept = await page.evaluate((t) => {
      const a = (window as W).__neural, row = document.querySelector('[data-list-row="' + t + '"]');
      (row as W).__mark = 1;
      a.renderExplorer();
      const same = document.querySelector('[data-list-row="' + t + '"]');
      return { same: same === row && !!(same as W).__mark, held: !!a._listDragHeld };
    }, T.id);
    expect(kept, "the row in the hand's way is the same element: the rebuild was held").toEqual({ same: true, held: true });
    expect(await targets(page), "and the target is still marked").toEqual([T.id]);
  });
  const now = await lists(page);
  expect(now[T.id].items, "the drop landed").toEqual([T.items[0], x]);
  expect(await page.evaluate((t) => { const r = document.querySelector('[data-list-row="' + t + '"]'); return !!r && !(r as W).__mark; }, T.id),
    "and the held rebuild ran afterwards (a fresh row)").toBe(true);
  expect(await page.evaluate(() => !!(window as W).__neural._listDragHeld), "nothing still held").toBe(false);
});

test("every lifter of the lease ends a held drag and runs the held rebuild: the view changing, the page hidden, the drawer closing", async ({ page }) => {
  const { made: [S, T] } = await atLists(page, [{ name: "Monday", n: 2 }, { name: "Guard", n: 1 }]);
  const x = S.items[0];
  const lifters: [string, string][] = [
    ["the view changing", "a.setViewMode('explore')"],
    ["the page hidden", "Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden"],
    ["the drawer closing", "a.setDeckOpen(false)"],
  ];
  for (const [what, code] of lifters) {
    if (!(await page.locator(".ng-drill").isVisible())) { await page.locator(".ng-logo").click(); await settleSystems(page); }
    await page.locator(itemRow(x, S.id)).scrollIntoViewIfNeeded();
    const before = await lists(page);
    await drag(page, await gripPoint(page, x, S.id), centre(await boxOf(page, `[data-list-row="${T.id}"]`)), async () => {
      const r = await page.evaluate(([code, t]) => {
        const a = (window as W).__neural, row = document.querySelector('[data-list-row="' + t + '"]');
        a.renderExplorer();                                    // a rebuild arrives and is held
        const heldBefore = !!a._listDragHeld;
        (row as W).__mark = 1;
        new Function("a", code)(a);                            // then the lifter
        return { heldBefore, inHand: !!a._listDrag, held: !!a._listDragHeld };
      }, [code, T.id] as const);
      expect(r, what + ": the drag is over, and the held rebuild ran").toEqual({ heldBefore: true, inHand: false, held: false });
    });
    expect(await lists(page), what + ": and the release dropped nothing").toEqual(before);
  }
});

test.describe("at 390x631 by touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } });
  test("a phone has no drag: its item rows are not draggable and carry no grip (Move to… in the ⋮ is its way)", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const [S] = await seed(page, [{ name: "Monday", n: 2 }, { name: "Guard", n: 1 }]);
    await page.locator(".ng-logo").tap();
    await expect(page.locator(".ng-drill")).toBeVisible();
    await settleSystems(page);
    const row = page.locator(itemRow(S.items[0], S.id));
    await expect(row).toHaveCount(1);
    expect(await row.getAttribute("draggable"), "not draggable").not.toBe("true");
    await expect(row.locator(".ng-grip"), "no grip").toHaveCount(0);
  });
});
