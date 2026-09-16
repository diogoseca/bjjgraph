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

test("@curated delayed aliases refresh both live searches without replacing the input", async ({ page }) => {
  let calls = 0;
  page.on("request", (r) => { if (ALIASES.test(r.url())) calls++; });
  const j = journey(page);
  await j.boot();
  expect(calls, "ordinary gameplay does not request aliases").toBe(0);
  const aliases = await fixture(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(ALIASES, async (route) => { await held; await route.fulfill({ json: aliases }); });

  await page.evaluate(() => (window as any).__neural.openPane("explore"));
  await page.locator(".ng-explorer-search input").fill("minor outer reap");
  await page.evaluate(() => (window as any).__neural.openSearch());
  const input = page.locator("[data-search-input]");
  await input.fill("minor outer reap");
  await input.fill("MATA LEÃO");
  await input.evaluate((el: HTMLInputElement) => {
    (window as any).__aliasInput = el;
    el.focus(); el.setSelectionRange(2, 5);
  });
  await expect(page.locator("[data-search-results] [data-alias-status]")).toHaveAttribute("data-alias-status", "loading");
  expect(calls, "both search surfaces share one request").toBe(1);
  release();

  await expect(page.locator("[data-search-results]")).toContainText("Rear Naked Choke");
  await expect(page.locator("[data-search-results]")).not.toContainText("Kosoto Gari");
  await expect(page.locator(".ng-learning-list")).toContainText("Kosoto Gari");
  await expect(page.locator(".ng-learning-list")).toContainText("aka Minor Outer Reap <alias-canary>");
  await expect(page.locator(".ng-learning-list alias-canary")).toHaveCount(0);
  const focus = await input.evaluate((el: HTMLInputElement) => ({
    same: el === (window as any).__aliasInput, focused: document.activeElement === el,
    caret: [el.selectionStart, el.selectionEnd], value: el.value,
  }));
  expect(focus).toEqual({ same: true, focused: true, caret: [2, 5], value: "MATA LEÃO" });
  await input.fill("rnc");
  await expect(page.locator("[data-search-results]")).toContainText("from Back Control");
  await expect(page.locator("[data-search-results]").locator(":scope > div")).toHaveCount(1);
  expect(calls).toBe(1);
});

test("@curated an alias response cannot replace a newer modal or reopen closed search", async ({ page }) => {
  const j = journey(page);
  await j.boot();
  const aliases = await fixture(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(ALIASES, async (route) => { await held; await route.fulfill({ json: aliases }); });
  await page.evaluate(() => (window as any).__neural.openSearch());
  await expect(page.locator("[data-alias-status]")).toHaveAttribute("data-alias-status", "loading");
  const settings = await page.evaluate(() => {
    const a = (window as any).__neural;
    a.closeModal(); a.openSettings();
    return a.modalCardRef.current.textContent;
  });
  release();
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural._aliasesReady)).toBe(true);
  expect(await page.evaluate(() => (window as any).__neural.modalCardRef.current.textContent)).toBe(settings);
  await expect(page.locator("[data-search-input]")).toHaveCount(0);
});

test("@curated alias failures stop after three attempts and explicit Retry recovers", async ({ page }) => {
  const j = journey(page);
  await j.boot();
  const aliases = await fixture(page);
  let calls = 0, healthy = false;
  await page.route(ALIASES, async (route) => {
    calls++;
    await route.fulfill(healthy ? { json: aliases } : { status: 503, body: "Unavailable" });
  });
  await page.evaluate(() => (window as any).__neural.openSearch());
  const results = page.locator("[data-search-results]"), input = page.locator("[data-search-input]");
  await expect(results.locator("[data-alias-status]")).toHaveAttribute("data-alias-status", "error");
  expect(calls).toBe(3);
  await input.fill("Mount");
  await expect(results).toContainText("Mount");
  await input.fill("minor outer reap");
  await expect(results).toContainText("Alias search unavailable");
  expect(calls, "keystrokes do not retry a failed chain").toBe(3);
  healthy = true;
  await results.locator("[data-alias-retry]").click();
  await expect(results).toContainText("Kosoto Gari");
  await expect(results).toContainText("aka Minor Outer Reap <alias-canary>");
  await expect(results.locator("alias-canary")).toHaveCount(0);
  await expect(results.locator("[data-alias-status]")).toHaveCount(0);
  expect(calls).toBe(4);
});

test("@curated singleton browsing fetches no dossiers and keeps its scroll and folds on alias arrival", async ({ page }) => {
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
    const open = a.openDossier;
    a.openDossier = function (idx: number, skip: boolean) {
      (window as any).__aliasOpened = idx;
      return open.call(this, idx, skip);
    };
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
  await page.locator(`.ng-learning-list [data-list-add="${browse.id}"]`).locator("..").locator("button").first().click();
  expect(await page.evaluate(() => (window as any).__aliasOpened)).toBe(browse.idx);
});
