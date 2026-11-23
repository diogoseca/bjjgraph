import { test, expect, type Browser, type Page } from "@playwright/test";
import { journey } from "../dsl";
import { installNeuralAuthSDK, signInNeuralAuthSDK, waitNeuralAuthOwner } from "../fixtures/neural-auth-sdk";

/**
 * MOVING AN ITEM BETWEEN LISTS (LISTS-R, Slice 2). The owner, 19 Nov: "how can i rename a list? or move items between lists
 * like drag and drop?". Rename was Slice 1 (v1.293.5); this is the move, by the control a phone can use:
 *   · "Move to…" in the item's ⋮ menu ([data-list-item-menu] → [data-list-menu-item="move"]; the item menu, LISTS-MENU-2,
 *     took the row's last place, so the move's own ⇄ became this item) opens the star's own menu in its MOVE mode
 *     ([data-list-picker-move]), anchored to that ⋮: the list the item is in now is shown and cannot be chosen ("here"), a
 *     list that has it already can be (the move then only takes it out of here), a full one cannot be; "New list" makes a
 *     list and moves the item into it; by keys it opens on its first row that can be chosen, ↑ ↓ move, Esc closes;
 *   · a move adds to the target, then takes out of the source, one save, and writes two cells (`listItemAt`), so it stays a
 *     move on the account's other devices (tests/share_lists_store.test.mjs, tests/list_moves_sync.test.mjs);
 *   · its Undo is the delete's one slot, naming what it takes back ([data-list-undo-move]); it puts the item back at its
 *     place, and a list the move emptied comes back whole;
 *   · a reorder (Move up / Move down) writes the list's order record (`listOrderAt`), so the other browser takes the order;
 *   · on a phone the move menu's rows are 44px targets, whole on the screen (the item row's own ▶ and ⋮:
 *     lists-item-menu.spec.ts).
 * The Undo row sits at the top of Lists, where the delete's always sat: after a move deep in a long list it can be above
 * the pane's fold, so these journeys scroll to it as a player would (the open question is in the LISTS-R report).
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
const dotsSel = (node: string, list: string) => `[data-list-item-menu="${node}"][data-list-of="${list}"]`;
const moveItem = (node: string) => `[data-list-item-menu-open="${node}"] [data-list-menu-item="move"]`;
/** ⋮, then "Move to…", by mouse: the move menu, anchored to the ⋮. */
const openMove = async (page: Page, j: ReturnType<typeof journey>, node: string, list: string) => {
  await page.locator(dotsSel(node, list)).scrollIntoViewIfNeeded();
  await j.clickByMouse(dotsSel(node, list), "the item's ⋮");
  await j.clickByMouse(moveItem(node), "Move to…");
};
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

test("1440 by mouse: ⋮ then Move to… opens the menu in its move mode; the item lands in the target only, two cells record it, and Undo puts it back", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [S, T] = await seed(page, [{ name: "Monday fundamentals", n: 3 }, { name: "Guard", n: 1 }]);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  const x = S.items[1]; // the middle item: Undo must put it back at its place, not at the end
  await openMove(page, j, x, S.id);

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
  // the stored value is an envelope { format, owner, blob, savedAt }: the record is its `blob`
  const saved = await page.evaluate(() => { const k = Object.keys(localStorage).find((k) => k.endsWith(":progress")); return k ? (JSON.parse(localStorage.getItem(k) || "{}").blob || {}).listItemAt || null : null; });
  expect(saved && saved[S.id] && saved[S.id][x], "the cells are in the saved record (the owner's `:progress` key)").toEqual(c[S.id][x]);

  // Undo: the offer names what it takes back, and puts the item back where it was
  const undo = page.locator(`[data-list-undo-move="${x}"]`);
  await expect(undo, "an Undo for the move").toBeVisible();
  await expect(undo.locator("xpath=..")).toContainText("Moved");
  await undo.scrollIntoViewIfNeeded();
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
  await openMove(page, j, x, S.id);
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
  await openMove(page, j, y, S.id);
  await j.clickByMouse("[data-list-picker-move] [data-list-pick-new]", "New list");
  await page.locator("[data-list-pick-newname]").fill("Thursday open mat");
  await page.keyboard.press("Enter");
  now = await lists(page);
  const born = Object.keys(now).find((k) => now[k].name === "Thursday open mat")!;
  expect(born, "a list was made").toBeTruthy();
  expect(now[born].items).toEqual([y]);
  expect(now[S.id], "the source, emptied, is gone").toBeUndefined();
  // and its Undo brings the source back whole, and takes the newborn away (it held nothing else)
  await page.locator(`[data-list-undo-move="${y}"]`).scrollIntoViewIfNeeded();
  await j.clickByMouse(`[data-list-undo-move="${y}"]`, "Undo");
  now = await lists(page);
  expect(now[S.id] && now[S.id].items, "the source is back").toEqual([y]);
  expect(now[born], "the newborn list held only the moved item: it goes").toBeUndefined();
});

const active = (page: Page, attr: string) => page.evaluate((a) => (document.activeElement as HTMLElement | null)?.getAttribute(a) ?? null, attr);
/** ↓ until the focused element's `attr` is `want` (at most `n` presses); returns what holds focus then. */
const downTo = async (page: Page, attr: string, want: string, n = 8) => {
  for (let i = 0; i < n && (await active(page, attr)) !== want; i++) await page.keyboard.press("ArrowDown");
  return active(page, attr);
};

test("by keyboard: Enter on ⋮, ↓ to Move to…, Enter; the move menu opens on a row, ↓ to the target, Enter; focus follows the item; Esc closes", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [S, T] = await seed(page, [{ name: "Monday", n: 2 }, { name: "Guard", n: 1 }]);
  await page.locator(".ng-logo").click();
  await settleSystems(page);
  const x = S.items[0];
  await page.locator(dotsSel(x, S.id)).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-list-item-menu-open="${x}"]`)).toBeVisible();
  expect(await downTo(page, "data-list-menu-item", "move"), "Move to… is reached by ↓").toBe("move");
  await page.keyboard.press("Enter");
  const menu = page.locator(`[data-list-picker-move="${S.id}"]`);
  await expect(menu, "the move menu, by keys").toBeVisible();
  expect(await active(page, "data-list-pick"), "it opens on a row that can be chosen (not the list it is in)").not.toBe(S.id);
  expect(await menu.evaluate((m) => m.contains(document.activeElement)), "focus is in the move menu").toBe(true);
  expect(await downTo(page, "data-list-pick", T.id), "the target by ↓").toBe(T.id);
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  expect((await lists(page))[T.id].items).toEqual([T.items[0], x]);
  await expect.poll(() => page.evaluate(() => { const e = document.activeElement as HTMLElement | null; return e ? [e.getAttribute("data-list-item-menu"), e.getAttribute("data-list-of")] : null; }),
    { message: "focus is on the moved item's ⋮, in the list it went to" }).toEqual([x, T.id]);

  // Esc closes the move menu and gives the keys back to the ⋮ it hangs off; nothing moved
  await page.keyboard.press("Enter");
  expect(await downTo(page, "data-list-menu-item", "move")).toBe("move");
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-list-picker-move="${T.id}"]`)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-list-picker-move]")).toHaveCount(0);
  expect(await active(page, "data-list-item-menu"), "focus back on the ⋮").toBe(x);
  expect((await lists(page))[T.id].items, "Esc moved nothing").toEqual([T.items[0], x]);
});

test.describe("at 390x631 by touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } });

  test("⋮, Move to… and the move menu's rows are thumb targets, whole on the screen, for the last row of a long list too; a move and its Undo by touch", async ({ page }) => {
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
    const mv = moveItem(x);
    const mb = await boxOf(page, mv);
    expect(mb.height, "Move to… is a thumb tall").toBeGreaterThanOrEqual(44);
    expect(onScreen(await boxOf(page, `[data-list-item-menu-open="${x}"]`)), "the item menu is whole on the screen").toBe(true);
    await tapAt(page, mv);
    const menu = `[data-list-picker-move="${S.id}"]`;
    await expect(page.locator(menu)).toBeVisible();
    expect(onScreen(await boxOf(page, menu)), "the move menu is whole on the screen").toBe(true);
    const pick = `[data-list-picker-move] [data-list-pick="${T.id}"]`;
    const pb = await boxOf(page, pick);
    expect(pb.height, "the move menu's row is a thumb tall").toBeGreaterThanOrEqual(44);
    expect(await hitsAll(page, pick), "its whole box is its own (elementFromPoint)").toEqual([]);
    await tapAt(page, pick);
    let now = await lists(page);
    expect(now[S.id].items).toEqual(S.items.slice(0, -1));
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
/** The backend's copy of the account's record, or null (`cloudOf` gives the stored blob itself, not a `{ neural }` row). */
const cloudBlob = (page: Page) => page.evaluate((id) => (window as W).__authOwnerFixture.cloudOf(id), ACC);

test("two browsers, one account: a move in one stays a move in the other, and comes back intact; a reorder in the other is taken back", async ({ browser }) => {
  test.setTimeout(240_000);
  const X = await browserAt(browser), Y = await browserAt(browser);
  try {
    await signInNeuralAuthSDK(X.page, ACC);
    await X.j.land("Mount Top");
    const [S, T] = await seed(X.page, [{ name: "Monday", n: 2 }, { name: "Guard", n: 1 }]);
    await flush(X.page);
    // the backend holds the LISTS (the row written at sign-in, before the seed, is not enough)
    await expect.poll(async () => { const b = await cloudBlob(X.page); return !!(b && b.lists && b.lists[S.id] && b.lists[T.id]); },
      { message: "the backend holds both lists" }).toBe(true);
    // Y signs in to the same account and holds both lists as they were
    await share(X.page, Y.page);
    await signInNeuralAuthSDK(Y.page, ACC);
    await expect.poll(async () => sorted(await lists(Y.page))).toEqual({ Monday: S.items.slice().sort(), Guard: T.items.slice().sort() });

    // X moves Monday's first item to Guard, by mouse
    const x = S.items[0];
    await X.page.locator(".ng-logo").click();
    await settleSystems(X.page);
    await openMove(X.page, X.j, x, S.id);
    await X.j.clickByMouse(`[data-list-picker-move] [data-list-pick="${T.id}"]`, "Guard");
    await flush(X.page);
    await expect.poll(async () => {
      const b = await cloudBlob(X.page);
      return !!(b && b.listItemAt && b.listItemAt[S.id]);
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
    expect((await lists(X.page))[T.id].items, "X's own order of Guard: the move appended it").toEqual([T.items[0], x]);

    // Y moves it UP in Guard, by mouse: its order record goes to the backend, and X takes the order (its own copy
    // still says [T0, x], and the merge keeps a copy's own order unless a later record says otherwise)
    await Y.j.land("Mount Top");
    await Y.page.locator(".ng-logo").click();
    await settleSystems(Y.page);
    // lists that came from the backend arrive shut, and so does their section: "Your lists" is opened by its head and Guard
    // by its name, as a player opens them
    await expect(Y.page.locator(`[data-list-items="${T.id}"]`), "Guard arrives shut in the other browser").toHaveCount(0);
    await expect(Y.page.locator(`[data-list-name="${T.id}"]`), "…inside a shut section (session posture, lists-section-fold.spec.ts)").toHaveCount(0);
    await Y.j.clickByMouse('[data-explore-section="Your lists"]', "Your lists");
    await Y.page.locator(`[data-list-name="${T.id}"]`).scrollIntoViewIfNeeded({ timeout: 10_000 });
    await Y.j.clickByMouse(`[data-list-name="${T.id}"]`, "Guard's name");
    await Y.page.locator(dotsSel(x, T.id)).scrollIntoViewIfNeeded({ timeout: 10_000 });
    await Y.j.clickByMouse(dotsSel(x, T.id), "the item's ⋮ in Guard");
    await Y.j.clickByMouse(`[data-list-item-menu-open="${x}"] [data-list-menu-item="up"]`, "Move up");
    expect((await lists(Y.page))[T.id].items).toEqual([x, T.items[0]]);
    await flush(Y.page);
    await expect.poll(async () => { const b = await cloudBlob(Y.page); return b && b.listOrderAt && b.listOrderAt[T.id] ? b.listOrderAt[T.id][1] : null; },
      { message: "the backend holds Guard's order record" }).toEqual([x, T.items[0]]);
    await share(Y.page, X.page);
    expect(await pull(X.page)).toBe(true);
    expect((await lists(X.page))[T.id].items, "the first browser takes the other's order").toEqual([x, T.items[0]]);
    expect(sorted(await lists(X.page)), "…and nothing else moved").toEqual(want);
    for (const s of [X, Y]) expect(s.errors, "page errors").toEqual([]);
  } finally {
    for (const s of [X, Y]) await s.ctx.close();
  }
});
