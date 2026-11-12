import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

type W = Window & { __neural: any };

/**
 * SEARCH SHOWS THE BEST MATCH FIRST (v1.257.0, owner's pick U132 c).
 *
 * Owner, 11 Nov: "when i search for something like Side Control i was expecting to see matches according to their
 * relevance, like Side Control Top and Side Control (Top and Bottom) should appear as the first(+second) option(s).
 * instead they apear like as item n20 ... when i search guillotine, the guillotine choke should show first, and only
 * the the Guillotine Setup". He picked c: one ranked list, each submission family folded into one row, Top and Bottom
 * presses on every position row, one typo forgiven, the first 40 rows drawn and the rest on scroll, arrows that walk.
 *
 * Every assertion reads what the app DREW after real input (the icon pressed where it sits, the query typed), never a
 * second copy of the ranking (CLAUDE.md §6.3). The order itself is pinned against the wire in both rulesets by
 * tests/search_rank.test.mjs; this file pins what a player sees and presses.
 *
 * THE SPEED BUDGET IS THIS BOX'S, STATED AS SUCH. Measured 2026-11-11 on the orchestrator host with nine seats working
 * (load ~10), 390x844, CPU throttled 4x through CDP, the same 20 keystrokes, same session, alternating: the unranked
 * v1.256.2 search drew up to 120 rows at a median 191 ms a keystroke (p90 341); this one draws 40 at a median 100 ms
 * (p90 191), the ranking itself 11-30 ms of it. The budget below is 2.5x that median. It exists to catch a list that
 * draws everything again (the "e" query has 1,300+ results); the exact page size is pinned by the row count.
 *
 * MUTANTS (v1.257.0), run under the build lock on the merged v1.257.0 build: 10 of 10 killed, each by the test named
 * (the Playwright titles, shortened):
 *   S1 seats appended beside the name, not under it        -> "Side Control is row 1 … on one line" (390), and the
 *                                                              40-row page (the extra row height moves the page)
 *   S2 the Top press opens the hub page, not the seat's     -> "the seats open their own pages" and the 390 Top press
 *   S3 families not folded                                   -> "the row a person means is row 1", "a folded family
 *                                                              opens by mouse", "one typo is forgiven"
 *   S4 the top family not open by default                    -> "the row a person means is row 1", "a folded family …"
 *   S5 "All N starts" draws nothing more                     -> "a folded family opens by mouse …"
 *   S6 the typo band off in the renderer                     -> "one typo is forgiven, and its near-miss stays last"
 *   S7 NG_SEARCH_PAGE = 100000 (draw everything)             -> "forty rows first …" and "the arrows walk the list …"
 *   S8 no sentinel (nothing draws on scroll)                 -> "forty rows first, the rest on scroll …"
 *   S9 ↓ past the last drawn row does not draw more          -> "the arrows walk the list in the order shown …"
 *   S10 Enter in the box does nothing                        -> "the arrows walk the list in the order shown …"
 * And D1, searchRank without its `rep` filter (every site doubled), is red in dual-consumers.spec.ts's hub test.
 * After the independent review (D1-D3 fixed), run again with S1-S10 on the merged build: 7 of 7 more killed:
 *   R1 Enter presses the family header (shuts it)           -> "Enter on a family-first result …"
 *   R2 a stale page still draws                              -> "a stale page draws nothing …"
 *   R3 a cleared query keeps its pager                       -> "a stale page draws nothing …"
 *   R4 scrolling draws one extra page only                   -> "forty rows first … " (every result reachable)
 *   R5 the "N starts" label miscounts                        -> "a folded family opens by mouse …"
 *   R6 seats on the first position row only                  -> "the seats open their own pages …" (second position)
 *   R7 the ruleset filter dropped                            -> "a ruleset switch with a query on screen …"
 * NOT COVERED here: the ruleset filter and the order in no-gi (tests/search_rank.test.mjs, both rulesets); the
 * escape of the query (explore-search-escape.spec.ts).
 */

const LIST = ".ng-learning-list";
const INPUT = ".ng-explorer-search input";

/** Every result item the app drew, in order: a row, a family row or an "All N starts". */
const drawn = (page: Page) =>
  page.evaluate((sel) => Array.from(document.querySelectorAll(sel + " [data-search-row]," + sel + " [data-search-fam]," + sel + " [data-search-more]"))
    .map((el) => ({ row: el.getAttribute("data-search-row"), fam: el.getAttribute("data-search-fam"), more: el.getAttribute("data-search-more"),
      open: el.getAttribute("aria-expanded"), member: parseInt((el as HTMLElement).style.paddingLeft || "12", 10) > 20 })), LIST);

/** Open the drawer's search the way a player does, then wait for the deferred aliases and Systems to land. */
async function openSearch(page: Page, touch = false) {
  const j = journey(page);
  await j.boot();
  if (touch) {
    const p = await page.evaluate(() => { const r = document.querySelector(".ng-search")!.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] as [number, number]; });
    await page.touchscreen.tap(...p);
  } else await j.clickByMouse(".ng-search", "the search icon");
  await expect(page.locator(INPUT), "the icon hands the keys to the search box").toBeFocused();
  await page.keyboard.type("a");
  await expect.poll(() => page.evaluate(() => { const a = (window as unknown as W).__neural; return !!a._aliasesReady && (a.systems || []).length > 0; }),
    { timeout: 30_000, message: "aliases and Systems landed" }).toBe(true);
  return j;
}
async function search(page: Page, q: string) {
  await page.locator(INPUT).focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.type(q);
  await expect(page.locator(LIST), `"${q}" drew its results`).toContainText(/\d+ results?/);
}
const pathOf = (page: Page) => page.evaluate(() => decodeURIComponent(location.pathname));

const FIRST: Array<[string, { row?: string; fam?: string; sys?: RegExp }]> = [
  ["side control", { row: "Positions/Side-Control" }], ["control side", { row: "Positions/Side-Control" }],
  ["guillotine", { fam: "Guillotine-Choke" }], ["armbar", { fam: "Armbar" }], ["arm bar", { fam: "Armbar" }],
  ["triangle", { fam: "Triangle-Choke" }], ["kimura", { fam: "Kimura" }], ["rnc", { fam: "Rear-Naked-Choke" }],
  ["mount", { row: "Positions/Mount" }], ["half", { row: "Positions/Half-Guard" }], ["back", { row: "Positions/Back-Control" }],
  ["guard", { row: "Positions/Half-Guard" }], ["knee slice", { row: "Transitions/Knee-Slice-Pass" }],
  ["kob", { row: "Positions/Knee-on-Belly" }], ["x guard", { row: "Positions/X-Guard" }],
  ["50/50", { row: "Positions/Ashi-Garami/50-50-Guard" }], ["dlr", { row: "Positions/De-La-Riva-Guard" }],
  ["danaher", { sys: /Danaher/ }],
];

test.describe("search, 1440x900 by mouse and keys", () => {
  test("the row a person means is row 1, for his two examples and a spread of queries", async ({ page }) => {
    await openSearch(page);
    let checked = 0;
    for (const [q, want] of FIRST) {
      await search(page, q);
      const first = (await drawn(page))[0];
      if (want.row) expect(first.row, `"${q}": row 1`).toBe(want.row);
      if (want.fam) expect(first.fam, `"${q}": row 1 is the family`).toBe(want.fam);
      if (want.sys) expect(await page.locator(LIST + " [data-search-row]").first().getAttribute("data-system-row"), `"${q}": row 1 is a System`).toMatch(/^Systems\//);
      checked++;
    }
    expect(checked, "every query was checked").toBe(FIRST.length);

    // guillotine: the choke first, open on its starts, and only then the Guillotine Setup (his words)
    await search(page, "guillotine");
    const g = await drawn(page);
    expect(g[0], "the choke family is row 1 and open").toMatchObject({ fam: "Guillotine-Choke", open: "true" });
    const starts = g.slice(1).filter((x) => x.member);
    expect(starts.length, "its starts are drawn under it").toBeGreaterThan(1);
    for (const s of starts.slice(0, 5)) expect(s.row, "the open family's starts are the choke's").toMatch(/^Submissions\/Guillotine-Choke\//);
    const setup = g.findIndex((x) => x.row === "Transitions/Guillotine-Setup");
    const lastGuillotine = g.map((x, i) => (x.fam || (x.row || "").startsWith("Submissions/")) ? i : -1).filter((i) => i >= 0).pop()!;
    expect(setup, "Guillotine Setup is drawn").toBeGreaterThan(0);
    expect(setup, "…after every guillotine finish").toBeGreaterThan(lastGuillotine);
  });

  test("the seats open their own pages, pressed by mouse where they sit", async ({ page }) => {
    const j = await openSearch(page);
    await search(page, "side control");
    const seat = (s: string) => `div:has(> [data-search-row="Positions/Side-Control"]) [data-seat-press="${s}"]`;
    await j.clickByMouse(seat("bottom"), "Side Control's Bottom press");
    await expect.poll(() => pathOf(page), { message: "Bottom opens the bottom seat's page" }).toBe("/Positions/Side-Control/Bottom");
    await j.clickByMouse(".ng-search", "the search icon");
    await search(page, "side control");
    await j.clickByMouse(seat("top"), "Side Control's Top press");
    await expect.poll(() => pathOf(page), { message: "Top opens the top seat's page" }).toBe("/Positions/Side-Control/Top");
    // …and on a second position row, not only the first (review: the seats were pinned on one row only)
    await j.clickByMouse(".ng-search", "the search icon");
    await search(page, "side control");
    await j.clickByMouse('div:has(> [data-search-row="Positions/Twister-Control/Twister-Side-Control"]) [data-seat-press="bottom"]', "Twister Side Control's Bottom press");
    await expect.poll(() => pathOf(page), { message: "a second position's Bottom opens its own bottom seat" }).toBe("/Positions/Twister-Control/Twister-Side-Control/Bottom");
  });

  test("a folded family opens by mouse, and an open one shows all its starts on a press", async ({ page }) => {
    const j = await openSearch(page);
    await search(page, "guillotine");
    const fam = '[data-search-fam="High-Elbow-Guillotine"]';
    await expect(page.locator(fam), "a lower family is folded").toHaveAttribute("aria-expanded", "false");
    expect((await drawn(page)).filter((x) => (x.row || "").startsWith("Submissions/High-Elbow-Guillotine/")).length, "its starts are not drawn").toBe(0);
    await j.clickByMouse(fam, "the High Elbow Guillotine family");
    await expect(page.locator(fam), "it opens").toHaveAttribute("aria-expanded", "true");
    expect((await drawn(page)).filter((x) => (x.row || "").startsWith("Submissions/High-Elbow-Guillotine/")).length, "its starts are drawn").toBeGreaterThan(1);

    await search(page, "armbar");
    const before = (await drawn(page)).filter((x) => (x.row || "").startsWith("Submissions/Armbar/")).length;
    expect(before, "the top family opens on its five most-travelled starts").toBe(5);
    await j.clickByMouse('[data-search-more="mArmbar"]', "All 15 starts");
    await expect.poll(async () => (await drawn(page)).filter((x) => (x.row || "").startsWith("Submissions/Armbar/")).length, { message: "every start drawn" }).toBeGreaterThan(5);
    await expect(page.locator(INPUT), "the query survives").toHaveValue("armbar");

    // the "N starts" label counts what "All N starts" then draws (review: the label text had no pin)
    await search(page, "rnc");
    const label = Number(((await page.locator('[data-search-fam="Rear-Naked-Choke"]').textContent()) || "").match(/(\d+) starts/)![1]);
    expect(label, "premise: more starts than the five drawn").toBeGreaterThan(5);
    await j.clickByMouse('[data-search-more="mRear-Naked-Choke"]', "All N starts");
    await expect.poll(async () => (await drawn(page)).filter((x) => (x.row || "").startsWith("Submissions/Rear-Naked-Choke/")).length,
      { message: "the label's count is the number of starts drawn" }).toBe(label);
  });

  test("the arrows walk the list in the order shown, and Enter opens the first result", async ({ page }) => {
    await openSearch(page);
    await search(page, "side control");
    const order = await drawn(page);
    const focused = () => page.evaluate(() => { const e = document.activeElement as HTMLElement; return e.getAttribute("data-search-row") || e.getAttribute("data-search-fam") || e.getAttribute("data-search-more") || e.tagName; });
    await page.keyboard.press("ArrowDown");
    expect(await focused(), "↓ from the box enters row 1").toBe(order[0].row);
    await page.keyboard.press("ArrowDown");
    expect(await focused(), "↓ again is row 2, as drawn").toBe(order[1].row || order[1].fam);
    await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp");
    await expect(page.locator(INPUT), "↑ from row 1 returns to the box").toBeFocused();
    // ↓ past the last drawn row draws the next page and moves on
    await search(page, "e");
    const n0 = (await drawn(page)).length;
    await page.evaluate((sel) => { const it = document.querySelectorAll(sel + " [data-search-row]," + sel + " [data-search-fam]," + sel + " [data-search-more]"); (it[it.length - 1] as HTMLElement).focus(); }, LIST);
    await page.keyboard.press("ArrowDown");
    expect((await drawn(page)).length, "the next page was drawn").toBeGreaterThan(n0);
    expect(await focused(), "focus moved past the old end").toBe((await drawn(page))[n0].row || (await drawn(page))[n0].fam || (await drawn(page))[n0].more);
    await search(page, "side control");
    await page.keyboard.press("Enter");
    await expect.poll(() => pathOf(page), { message: "Enter in the box opens row 1" }).toBe("/Positions/Side-Control/Top");
  });

  test("Enter on a family-first result opens its best start and leaves the family open (review D1)", async ({ page }) => {
    await openSearch(page);
    await search(page, "guillotine");
    const d = await drawn(page);
    expect(d[0], "premise: the first result is the open choke family").toMatchObject({ fam: "Guillotine-Choke", open: "true" });
    const best = d.find((x) => x.member)!.row!;
    expect(best, "its best start is drawn first under it").toMatch(/^Submissions\/Guillotine-Choke\//);
    await page.locator(INPUT).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => pathOf(page), { message: "Enter opens the best start" }).toBe("/" + best);
    const fam = page.locator('[data-search-fam="Guillotine-Choke"]');
    if (await fam.count()) await expect(fam, "…and did not shut the family").toHaveAttribute("aria-expanded", "true");
  });

  test("a ruleset switch with a query on screen leaves no stale rows", async ({ page }) => {
    await openSearch(page);
    await search(page, "lapel");
    const gi = await drawn(page);
    expect(gi.length, "premise: gi lists lapel results").toBeGreaterThan(3);
    await page.evaluate(() => (window as unknown as W).__neural.setGiMode("nogi"));
    const switched = await drawn(page);
    const stale = await page.evaluate((ids) => { const a = (window as unknown as W).__neural; return ids.filter((id) => { const i = a._idIndex.get(id); return i != null && !a.rsAllowsIdx(i); }); }, switched.map((x) => x.row).filter(Boolean) as string[]);
    expect(stale, "no row the no-gi ruleset excludes").toEqual([]);
    await search(page, "lapel");
    expect(await drawn(page), "the switched list is exactly what a fresh no-gi search draws").toEqual(switched);
    await page.evaluate(() => (window as unknown as W).__neural.setGiMode("gi"));
  });

  test("a stale page draws nothing, and clearing the query stops the pager (review D3)", async ({ page }) => {
    await openSearch(page);
    await search(page, "e");
    await page.evaluate(() => { (window as any).__oldPage = (window as unknown as W).__neural._searchPage; });
    expect(await page.evaluate(() => !!(window as any).__oldPage && (window as any).__oldPage.left() > 0), "premise: the old page had more to draw").toBe(true);
    await search(page, "side control");
    const before = await drawn(page);
    expect(await page.evaluate(() => (window as any).__oldPage.more()), "the old page draws nothing").toBe(0);
    expect(await drawn(page), "the new list is untouched").toEqual(before);
    await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace");
    expect(await page.evaluate(() => (window as unknown as W).__neural._searchPage), "no query, no pager").toBeNull();
  });

  test("one typo is forgiven, and its near-miss stays last", async ({ page }) => {
    await openSearch(page);
    await search(page, "guilotine");
    expect((await drawn(page))[0].fam, '"guilotine" still finds the choke first').toBe("Guillotine-Choke");
    await search(page, "knee slice");
    const rows = (await drawn(page)).map((x) => x.row || x.fam || "");
    const slide = rows.map((r, i) => (/^Transitions\/Knee-Slide-/.test(r) ? i : -1)).filter((i) => i >= 0);
    expect(slide.length, "the known near-miss (Knee Slide) is listed").toBeGreaterThan(0);
    expect(Math.min(...slide), "…after every real Knee Slice").toBeGreaterThan(Math.max(...rows.map((r, i) => (/^Transitions\/Knee-Slice-/.test(r) ? i : -1))));
  });

  test("forty rows first, the rest on scroll, inside the keystroke budget", async ({ page }) => {
    await openSearch(page);
    await search(page, "e");
    const total = Number(((await page.locator(LIST).textContent()) || "").match(/(\d+) results?/)![1]); // textContent: the header is uppercased by CSS
    expect(total, "premise: a query with far more than one page").toBeGreaterThan(200);
    const first = (await drawn(page)).length;
    // 40 rows, and a family block is drawn whole, so one block can carry it a few rows past
    expect(first, "the first page").toBeGreaterThanOrEqual(40);
    expect(first, "the first page").toBeLessThanOrEqual(47);
    await page.evaluate((sel) => { const l = document.querySelector(sel)!; l.scrollTop = l.scrollHeight; }, LIST);
    await expect.poll(async () => (await drawn(page)).length, { message: "scrolling to the end draws the next page" }).toBeGreaterThan(first);
    // EVERY RESULT IS REACHABLE (review): keep scrolling until nothing is left to draw, then the rows drawn plus each
    // family's "N starts" add up to the header's count, so no result is cut off however far down it ranks
    for (let i = 0; i < 80 && await page.locator(LIST + " [data-search-sentinel]").count(); i++) {
      await page.evaluate((sel) => { const l = document.querySelector(sel)!; l.scrollTop = l.scrollHeight; }, LIST);
      await page.waitForTimeout(60);
    }
    expect(await page.locator(LIST + " [data-search-sentinel]").count(), "the last page was drawn").toBe(0);
    const reach = await page.evaluate((sel) => {
      const solo = [...document.querySelectorAll(sel + " [data-search-row]")].filter((el) => parseInt((el as HTMLElement).style.paddingLeft || "12", 10) <= 20).length;
      const fams = [...document.querySelectorAll(sel + " [data-search-fam]")].map((el) => Number((el.textContent || "").match(/(\d+) starts/)![1]));
      return { solo, inFamilies: fams.reduce((x, y) => x + y, 0), families: fams.length };
    }, LIST);
    expect(reach.families, "premise: families are folded in this list").toBeGreaterThan(1);
    expect(reach.solo + reach.inFamilies, "every result is drawn or counted in its family's row").toBe(total);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t = await page.evaluate(() => {
      const inp = document.querySelector(".ng-explorer-search input") as HTMLInputElement, list = document.querySelector(".ng-learning-list") as HTMLElement, out: number[] = [];
      const seq = ["s", "si", "sid", "side", "side ", "side c", "side co", "side con", "side cont", "side contr", "side contro", "side control", "e", "a", "g", "gu", "gua", "guar", "guard", "guillotine"];
      for (let rep = 0; rep < 3; rep++) for (const q of seq) {
        const t0 = performance.now(); inp.value = q; inp.dispatchEvent(new Event("input", { bubbles: true })); void list.offsetHeight; void list.scrollHeight; out.push(performance.now() - t0);
      }
      return out.sort((x, y) => x - y);
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const median = t[Math.floor(t.length / 2)];
    console.log(`[search-rank] keystroke at 4x CPU: median ${median.toFixed(1)} ms, p90 ${t[Math.floor(t.length * 0.9)].toFixed(1)} ms over ${t.length}`);
    expect(median, "median keystroke at 4x CPU, budget 2.5x this box's measured 100 ms").toBeLessThan(250);
  });
});

test.describe("search, 390x844 by touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("@curated Side Control is row 1 with its name on one line, and its Top press opens the top seat", async ({ page }) => {
    await openSearch(page, true);
    await search(page, "side control");
    expect((await drawn(page))[0].row).toBe("Positions/Side-Control");
    // THE SEATS ARE ON A LINE OF THEIR OWN: beside the name they squeezed "Side Control" onto two lines at 390.
    // Differential against a control row that carries no seats: the two names are the same height.
    const h = await page.evaluate(() => {
      const nameH = (sel: string) => (document.querySelector(sel)!.querySelector("span[style*='font-size:13px']") as HTMLElement).getBoundingClientRect().height;
      return { pos: nameH('[data-search-row="Positions/Side-Control"]'), ctl: nameH('[data-search-row="Transitions/Side-Control-to-Mount"]') };
    });
    expect(h.pos, `Side Control's name is one line (${h.pos}px against a plain row's ${h.ctl}px)`).toBeLessThanOrEqual(h.ctl + 1);
    // the Top press, by a finger, at its measured centre, and nothing else owns that point
    const p = await page.evaluate(() => {
      const el = document.querySelector('div:has(> [data-search-row="Positions/Side-Control"]) [data-seat-press="top"]') as HTMLElement;
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
      return { x, y, ok: !!top && (top === el || el.contains(top)), inView: y > 0 && y < innerHeight };
    });
    expect(p.inView && p.ok, "the Top press is reachable by a finger where it sits").toBe(true);
    await page.touchscreen.tap(p.x, p.y);
    await expect.poll(() => pathOf(page), { message: "Top opens the top seat's page" }).toBe("/Positions/Side-Control/Top");
  });
});
