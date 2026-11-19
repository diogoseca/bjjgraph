import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

// Transport fixtures exercise the production loader/renderers. Emitter/source parity belongs
// to the dossier unit contract; the DSL intentionally serves empty dossier chunks here.
const ALIASES = /\/aliases\.json(?:\?|$)/;
const fixture = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural;
  const entries = [
    ["Kosoto Gari", { aka: ["Minor Outer Reap <alias-canary>", "Ko Soto Gari"] }],
    ["Rear Naked Choke from Back Control", { aka: [], family: { name: "Rear Naked Choke", aka: ["Mata Leão", "RNC"] } }],
    ["Knee on Belly Top", { aka: ["Knee Mount", "Knee on Stomach", "Knee on Chest", "KOB", "Uki Gatame", "Joelho na Barriga"] }],
  ];
  return Object.fromEntries(entries.map(([name, meta]) => {
    const n = a.nodes.find((n: any) => n.rep && n.t === name);
    if (!n) throw new Error("Missing fixture site: " + name);
    return [n.id, meta];
  }));
});

// v1.254.1: the old search modal is retired (no control and no key opened it). These cases drive the one search a player reaches,
// the drawer's, by real input: the search icon pressed by mouse where it sits, and keys for the text and the caret.
const openSearch = async (page: Page, j: ReturnType<typeof journey>) => {
  await j.clickByMouse(".ng-search", "the search icon");
  await expect(page.locator(".ng-explorer-search input"), "the icon hands the keys to the drawer's search").toBeFocused();
};
const retype = async (page: Page, text: string) => { await page.keyboard.press("Control+A"); await page.keyboard.type(text); };

test("delayed aliases refresh the drawer's search without replacing its input", async ({ page }) => {
  let calls = 0;
  page.on("request", (r) => { if (ALIASES.test(r.url())) calls++; });
  const j = journey(page);
  await j.boot();
  expect(calls, "ordinary gameplay does not request aliases").toBe(0);
  const aliases = await fixture(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(ALIASES, async (route) => { await held; await route.fulfill({ json: aliases }); });

  await openSearch(page, j);
  const input = page.locator(".ng-explorer-search input"), list = page.locator(".ng-learning-list");
  await page.keyboard.type("MATA LEÃO");
  await page.keyboard.press("Home");
  for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowRight");
  await input.evaluate((el: HTMLInputElement) => { (window as any).__aliasInput = el; });
  await expect(list.locator("[data-alias-status]")).toHaveAttribute("data-alias-status", "loading");
  expect(calls, "one request for the session").toBe(1);
  release();

  await expect(list, "a family alias finds its site").toContainText("Rear Naked Choke");
  await expect(list).not.toContainText("Kosoto Gari");
  const focus = await input.evaluate((el: HTMLInputElement) => ({
    same: el === (window as any).__aliasInput, focused: document.activeElement === el,
    caret: [el.selectionStart, el.selectionEnd], value: el.value,
  }));
  expect(focus, "the alias arrival kept the input, its focus, caret and text").toEqual({ same: true, focused: true, caret: [2, 5], value: "MATA LEÃO" });
  await retype(page, "minor outer reap");
  await expect(list).toContainText("Kosoto Gari");
  await expect(list).toContainText("aka Minor Outer Reap <alias-canary>");
  await expect(list.locator("alias-canary")).toHaveCount(0);
  await retype(page, "rnc");
  await expect(list).toContainText("from Back Control");
  await expect(list.locator("[data-list-add]"), "a family alias names its site once").toHaveCount(1);
  expect(calls).toBe(1);
});

test("an alias response cannot reopen a closed search or replace a newer modal", async ({ page }) => {
  const j = journey(page);
  await j.boot();
  const aliases = await fixture(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(ALIASES, async (route) => { await held; await route.fulfill({ json: aliases }); });
  await openSearch(page, j);
  await page.keyboard.type("mata");
  await expect(page.locator(".ng-learning-list [data-alias-status]")).toHaveAttribute("data-alias-status", "loading");
  await j.clickByMouse(".ng-explorer-close", "the drawer's close");
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural.deckShown), { message: "premise: the search is closed" }).toBe(false);
  // Settings is a DEFERRED bundle since v1.207.0: `openSettings()` paints "Loading settings…"
  // synchronously and swaps in the real UI when `app/settings-ui.js` lands. That swap is the
  // modal's OWN legitimate repaint, so the snapshot is taken only after it settles (awaiting the
  // promise `openSettings` returns). The one async left in flight is then the held alias
  // response, which is what this test is about. (A late SETTINGS module vs a newer modal is
  // settings-lazy.spec.ts's claim, not this one's.)
  const modal = () => page.evaluate(() => {
    const a = (window as any).__neural;
    const card = a.modalCardRef.current;
    return { text: card.textContent, tabs: card.querySelectorAll("[data-settings-tab]").length, generation: a._modalGeneration };
  });
  const shown = await page.evaluate(async () => await (window as any).__neural.openSettings());
  expect(shown, "the real Settings UI rendered").toBe(true);
  const settings = await modal();
  expect(settings.tabs, "the snapshot is the loaded Settings, not its loading state").toBeGreaterThan(0);
  release();
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural._aliasesReady)).toBe(true);
  expect(await modal(), "the alias response left the newer modal exactly as it was").toEqual(settings);
  expect(await page.evaluate(() => !!(window as any).__neural.deckShown), "and did not reopen the closed search").toBe(false);
});

test("alias failures stop after three attempts and explicit Retry recovers", async ({ page }) => {
  const j = journey(page);
  await j.boot();
  const aliases = await fixture(page);
  let calls = 0, healthy = false;
  await page.route(ALIASES, async (route) => {
    calls++;
    await route.fulfill(healthy ? { json: aliases } : { status: 503, body: "Unavailable" });
  });
  await openSearch(page, j);
  const list = page.locator(".ng-learning-list");
  await expect(list.locator("[data-alias-status]")).toHaveAttribute("data-alias-status", "error");
  expect(calls).toBe(3);
  await page.keyboard.type("Mount");
  await expect(list).toContainText("Mount");
  await retype(page, "minor outer reap");
  await expect(list).toContainText("Alias search unavailable");
  expect(calls, "keystrokes do not retry a failed chain").toBe(3);
  healthy = true;
  await j.clickByMouse(".ng-learning-list [data-alias-retry]", "the alias Retry");
  // The drawer never re-renders its list under a resting pointer (`_afterPress`): the answer lands when the pointer leaves it.
  await page.mouse.move(1200, 400);
  await expect(list).toContainText("Kosoto Gari");
  await expect(list).toContainText("aka Minor Outer Reap <alias-canary>");
  await expect(list.locator("alias-canary")).toHaveCount(0);
  await expect(list.locator("[data-alias-status]")).toHaveCount(0);
  expect(calls).toBe(4);
});

test("singleton browsing fetches no dossiers and keeps its scroll and folds on alias arrival", async ({ page }) => {
  const j = journey(page);
  await j.boot();
  const aliases = await fixture(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(ALIASES, async (route) => { await held; await route.fulfill({ json: aliases }); });
  const requests: string[] = [];
  page.on("request", (r) => { if (/\/content\//.test(r.url())) requests.push(r.url()); });
  const browse = await page.evaluate(() => {
    const a = (window as any).__neural;
    a.setPaused(true);
    a._setExploreSectionOpen("Positions", true);
    const asked: string[] = [], read = a._ngc;
    a._ngc = function (key: string) { asked.push(key); return read.call(this, key); };
    try { a.openPane("explore"); } finally { a._ngc = read; }
    const solo = a.nodes.find((n: any) => n.rep && n.t === "Knee on Belly Top");
    return { asked, id: solo.id, idx: solo.idx, size: a.buildExplorer().groups.positions["Knee on Belly"].length };
  });
  expect(browse.asked, "rendering the category never even asks the dossier cache").toEqual([]);
  expect(browse.size, "the click exercises the singleton branch").toBe(1);
  const before = await page.evaluate(() => {
    const a = (window as any).__neural;
    const list = a.explorerListRef.current;
    list.scrollTop = 240;
    return list.scrollTop;
  });
  expect(before, "the browse tree is long enough to exercise scroll preservation").toBeGreaterThan(0);
  release();
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural._aliasesReady)).toBe(true);
  expect(await page.evaluate(() => (window as any).__neural.explorerListRef.current.scrollTop)).toBe(before);
  expect(await page.evaluate(() => (window as any).__neural._exploreSectionOpen("Positions"))).toBe(true);
  await expect(page.locator(".ng-learning-list")).toContainText("aka Knee Mount");
  expect(requests, "listing singleton sites never probes either role's dossier").toEqual([]);
  const row = page.locator(`.ng-learning-list [data-list-add="${browse.id}"]`).locator("..").locator("button").first();
  await row.scrollIntoViewIfNeeded();
  await row.evaluate(el => el.setAttribute("data-alias-singleton", ""));
  await j.clickByMouse("[data-alias-singleton]", "read the singleton position");
  await expect(page.locator('[data-reader-ready="true"]')).toContainText("Knee on Belly");
  expect(await page.evaluate(() => !!(window as any).__neural._readerIntent)).toBe(true);
});
