import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

/** PD1-PD5. Practice is a view INSIDE the drawer, at the drawer's width, as Path is (owner U135 a, v1.261.0).
 * From v1.248.0 to v1.260.0 it was its own 760 px page centred over the map, which hid the map that follows each card.
 *
 *  PD1  the drawer keeps its width while Practice is open (the home list's, Path's), and a strip of map stays at the
 *       right on a phone
 *  PD2  at 1440x900 each card's technique is flown to the free map beside the drawer: on screen, right of the drawer,
 *       in the middle of the free map, and the topmost thing at its centre is the map itself; Next and Previous
 *       technique, by mouse, page the session
 *  PD3  "‹ Practice" (the brand) is Practice's one Back and carries the study Back's marker; a deck study's own ‹ Back
 *       keeps it; pressing it by mouse returns to the opener; Esc closes the drawer and gives the game back its pause
 *  PD4  every answer button is at least 44 px tall, inside the drawer and on screen with the corpus's longest answer
 *       (160 characters, the ceiling `mcClip` allows a choice) and its longest explanation, at 390x631 too; and the
 *       choices of a recognition card
 *  PD5  Practice keeps its own solid background, and the badge stays hidden while practising
 *
 * Presses are a player's: `j.clickByMouse` (measured centre, `elementFromPoint` names the target, no scrolling); a
 * control below the fold is first scrolled to as a player scrolls the drawer. The harness serves the real
 * gameplan.js and decks from this worktree's build; dossiers are its empty stub, and no claim here reads one.
 * Positions come from measured rects and from the frame's own transform and lift (`_LY`), never from constants.
 *
 * Named mutants, each red here against a green baseline (receipts: docs/Changelog-Archive.md, v1.261.0):
 *  M1 the 760 px centred page restored in challenge-ui.css → PD1 at all three sizes
 *  M2a the card's camera flight dropped (`locateNode` in the session row) → PD2
 *  M2b the camera ignores the drawer (`_paneLayout` inset 0) → PD2 (the middle of the free map)
 *  M3a the brand without the Back marker → PD3 (and practice-page's three Back presses)
 *  M4 Practice's 44 px floor lowered to 40 px → PD4
 *  M5 Practice's solid background dropped → PD5;  M6 the badge shown while practising → PD5
 * Not covered here: the brand's Back restoring a Path origin (practice-page "P1-E: Back restores keyboard focus to
 * Path's maintenance opener" kills that mutant, M3b), and the touch tap's plan (practice-tap-plan TAP1, M7). */
test.use({ hasTouch: true });

const PRACTICE = '[data-explore-stats] [data-b="due"]';
const OPEN = '[data-session-row][aria-expanded="true"] + div';

/** A guest at white belt owing reviews on `due` techniques (due reviews ignore belt locks), the planner warm. */
async function seed(page: Page, due: { key: string; q?: string }[] | number) {
  return page.evaluate(async (due: any) => {
    const a = (window as any).__neural;
    a.setPaused(true);
    a.srs = {}; a.prep = {}; a.stage = {}; a.rec = {}; a.units = {};
    a.belts = { held: { id: "white", t: 1 }, gf: 1, won: {} };
    a._gameplanProvider = null; a._miniGraded = new Set(); a.settings.dailyGoal = 20;
    const day = a._epochDay();
    const rows = typeof due === "number"
      ? [...new Set(a.curriculum.belts.find((b: any) => b.id === "black").units.flatMap((u: any) => u.lessons)
          .filter((l: any) => a._lessonLive(l)).map((l: any) => l.deckKey))].slice(0, due).map((key) => ({ key }))
      : due;
    await a.hydrateDecks(rows.map((r: any) => r.key));
    const out = rows.map((r: any, i: number) => {
      const cards = a._cardsOf(a.flashcards.decks[r.key]) || [];
      const c = r.q ? cards.find((x: any) => x.q.startsWith(r.q)) : cards[0];
      if (!c) throw Error("no card " + r.key + " " + r.q);
      // most overdue first, so the queue opens on the first row
      a.srs[r.key] = { [a.qhash(c.q)]: [day - 9 + i, 3, day - 12] };
      return { key: r.key, a: c.a.length, d: (c.d || "").length, node: a.nodeForKey(r.key) };
    });
    await a._ensureGameplanRuntime();
    a.setViewMode("explore");
    return out;
  }, due);
}

/** The drawer's rect, read once it has stopped moving (it slides in). */
async function drawer(page: Page) {
  let last = "", r: any = null;
  await expect.poll(async () => {
    r = await page.evaluate(() => {
      const b = document.querySelector(".ng-drill")!.getBoundingClientRect();
      return { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width) };
    });
    const now = JSON.stringify(r), same = now === last; last = now;
    return same;
  }, { intervals: [150], timeout: 10_000, message: "the drawer settles" }).toBe(true);
  return r as { left: number; right: number; width: number };
}

async function openPractice(page: Page, j: any) {
  await j.clickByMouse(PRACTICE, "Practice");
  await expect(page.locator("[data-practice-page]")).toHaveCount(1);
  await page.waitForFunction(() => !!(window as any).__neural._session?.plan, null, { timeout: 30_000 });
}

for (const vp of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`PD1: ${vp.width}×${vp.height} Practice opens inside the drawer, at the width Path and the list have`, async ({ page }) => {
    await page.setViewportSize(vp);
    const j = journey(page); await j.boot("/");
    await page.waitForFunction(() => !!(window as any).__neural.curriculum);
    await seed(page, 2);
    await j.clickByMouse(".ng-logo", "open the drawer");
    const home = await drawer(page);
    await j.clickByMouse('[data-explore-stats] [data-view="challenges"]', "Path");
    await expect(page.locator(".ng-drawer-brand")).toHaveText("‹ Path");
    const path = await drawer(page);
    await j.clickByMouse(".ng-drawer-brand", "‹ Path, home");
    await openPractice(page, j);
    await expect(page.locator(".ng-drawer-brand"), "the brand names Practice, as it names Path").toHaveText("‹ Practice");
    const practice = await drawer(page);
    await page.keyboard.press("ArrowDown"); // the next technique: the drawer does not move as the session pages
    await expect.poll(() => page.evaluate(() => (window as any).__neural._session.idx)).toBe(1);
    const paged = await drawer(page);
    expect(path, "Path is a view in the drawer at its width").toEqual(home);
    expect(practice, "PD1: Practice opens in the drawer at its width").toEqual(home);
    expect(paged, "PD1: and keeps it as the session pages").toEqual(home);
    expect(practice.left, "docked at the left edge").toBe(0);
    // what is left of the screen is map: on a phone a strip of it stays at the right, as in Path
    expect(vp.width - practice.right, "PD1: map beside the drawer").toBeGreaterThanOrEqual(vp.width <= 640 ? 40 : 300);
  });
}

test("PD2: 1440×900 each card's technique is flown to the free map beside the drawer, uncovered", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await j.land("Mount Top");   // a landed board: on a bare boot, advance() starts the roll that retires the session
  const due = await seed(page, 2);
  expect(due.every((d) => d.node >= 0), "both techniques are on the map").toBe(true);
  await j.clickByMouse(".ng-logo", "open the drawer");
  await openPractice(page, j);
  // §6.2: the orb's place on the glass through draw()'s own transform and lift (`_LY`), never camTarget; the game
  // clock is pumped here, so the camera's flight is given 3.5 s of it before each reading
  const glass = () => page.evaluate(() => {
    const a = (window as any).__neural, s = a._session, i = a.nodeForKey(s.keys[s.idx]), n = a.nodes[i];
    const k = a.W / a.cam.vw, ly = typeof a._LY === "function" ? a._LY(n) : a.pairMid(n).y;
    const x = Math.round(a.W / 2 + (n.x - a.cam.cx) * k), y = Math.round(a.H / 2 + (ly - a.cam.cy) * k);
    const d = document.querySelector(".ng-drill")!.getBoundingClientRect();
    const top = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? document.elementFromPoint(x, y) : null;
    return { key: s.keys[s.idx], idx: s.idx, x, y, W: innerWidth, H: innerHeight, right: Math.round(d.right),
      map: !!top && top === a.canvasRef.current, ringed: (a._sessionNodes || []).includes(i), node: i };
  });
  const seen: number[] = [];
  for (const step of [0, 1]) {
    if (step) {
      await page.locator(".ng-practice-nav button:last-child").scrollIntoViewIfNeeded();
      await j.clickByMouse(".ng-practice-nav button:last-child", "Next technique");
    }
    await j.advance(3500);
    const at = await glass(), where = JSON.stringify(at);
    expect(at.idx, "the card in view is the one paged to").toBe(step);
    if (step === 0) expect(at.key, "Practice opens on the most overdue review").toBe(due[0].key);
    else expect(at.node, "the next technique is another orb").not.toBe(seen[0]);
    seen.push(at.node);
    expect(at.y >= 0 && at.y <= at.H, `PD2: on screen vertically ${where}`).toBe(true);
    expect(at.x, `PD2: right of the drawer ${where}`).toBeGreaterThan(at.right);
    expect(at.x, `PD2: on screen ${where}`).toBeLessThan(at.W);
    const mid = (at.right + at.W) / 2, free = at.W - at.right;
    expect(Math.abs(at.x - mid), `PD2: in the middle of the free map (${Math.round(mid)}) ${where}`).toBeLessThanOrEqual(free * 0.1);
    expect(at.map, `PD2: the topmost thing at the orb is the map itself ${where}`).toBe(true);
    expect(at.ringed, "PD2: the technique carries the session's ring").toBe(true);
  }
  await page.locator(".ng-practice-nav button:first-child").scrollIntoViewIfNeeded();
  await j.clickByMouse(".ng-practice-nav button:first-child", "‹ Previous technique");
  await expect.poll(() => page.evaluate(() => (window as any).__neural._session.idx), { message: "Previous technique pages back" }).toBe(0);
});

test("PD3: ‹ Practice is Practice's one Back; a deck study keeps its own", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  const [deck] = await seed(page, 1);
  await j.clickByMouse(".ng-logo", "open the drawer");
  await openPractice(page, j);
  const backs = () => page.evaluate(() => [...document.querySelectorAll("[data-pane-back]")].map((e) => ({
    brand: e.classList.contains("ng-drawer-brand"), text: (e.textContent || "").trim(), shown: e.getClientRects().length > 0 })));
  expect(await backs(), "PD3: one Back on screen, and it is the brand").toEqual([{ brand: true, text: "‹ Practice", shown: true }]);
  await j.clickByMouse("[data-pane-back]", "‹ Practice");
  await expect(page.locator("[data-drawer-explore]"), "PD3: Back returns to the list it was opened from").toBeVisible();
  await expect(page.locator(PRACTICE), "PD3: the opener has the focus back").toBeFocused();
  await expect(page.locator(".ng-drawer-brand")).not.toHaveText("‹ Practice");
  expect(await backs(), "PD3: the brand gives the marker back").toEqual([]);
  await page.evaluate((key) => (window as any).__neural.openStudy(key), deck.key);
  await expect(page.locator("[data-drawer-explore]"), "a deck study owns the body").toBeHidden();
  expect(await backs(), "PD3: a deck study's ‹ Back is its own, in its head").toEqual([{ brand: false, text: "‹Back", shown: true }]);
  await j.clickByMouse("[data-pane-back]", "the deck's ‹ Back");
  await expect(page.locator("[data-drawer-explore]")).toBeVisible();
  // Esc closes the drawer from inside Practice, and the game gets back only the pause the drawer took
  await j.clickByMouse(".ng-explorer-close", "close the drawer");
  await expect(page.locator(".ng-drill")).toBeHidden();
  await page.evaluate(() => (window as any).__neural.setPaused(false));
  await j.clickByMouse(".ng-logo", "open the drawer, the game running");
  await openPractice(page, j);
  expect(await page.evaluate(() => (window as any).__neural.paused), "the open drawer stops the game").toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator(".ng-drill"), "PD3: Esc closes Practice with the drawer").toBeHidden();
  expect(await page.evaluate(() => (window as any).__neural.paused), "PD3: and the game resumes").toBe(false);
});

/** Every visible button of the open card: its box, whether it sits inside the drawer and the viewport, and whether a
 * press at its centre lands on it. */
const answers = (page: Page) => page.evaluate((sel) => {
  const open = document.querySelector(sel)!, d = document.querySelector(".ng-drill")!.getBoundingClientRect();
  return [...open.querySelectorAll("button, summary")].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== "hidden").map((b) => {
    const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
    return { t: (b.textContent || "").trim().slice(0, 24), h: Math.round(r.height * 10) / 10,
      inDrawer: r.left >= d.left - 0.5 && r.right <= d.right + 0.5, onScreen: r.top >= 0 && r.bottom <= innerHeight,
      hit: !!top && (top === b || b.contains(top)) };
  });
}, OPEN);

async function checkAnswers(page: Page, sel: string, what: string) {
  await page.locator(`${OPEN} ${sel}`).first().scrollIntoViewIfNeeded(); // a player scrolls the drawer to it
  const all = await answers(page);
  expect(all.length, `${what}: buttons measured (a positive count)`).toBeGreaterThan(0);
  for (const b of all) {
    expect(b.h, `PD4: ${what}: "${b.t}" is at least 44 px tall`).toBeGreaterThanOrEqual(44);
    expect(b.inDrawer, `PD4: ${what}: "${b.t}" sits inside the drawer`).toBe(true);
  }
  for (const b of all.filter((x) => x.onScreen)) expect(b.hit, `PD4: ${what}: a press on "${b.t}" lands on it`).toBe(true);
  const target = await page.locator(`${OPEN} ${sel}`).first().evaluate((el) => {
    const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, H: innerHeight };
  });
  expect(target.top >= 0 && target.bottom <= target.H, `PD4: ${what}: ${sel} on screen ${JSON.stringify(target)}`).toBe(true);
}

// The corpus's longest answer and its longest explanation (measured over all 21,269 cards in PRACT1).
const LONGEST = [
  { key: "Reverse Armbar from Mount|Attacker", q: "What are the three acceptable tap signals" },
  { key: "Front Headlock to Guillotine|Attacker", q: "What is the upper body sequence for the front headlock" },
];
for (const vp of [{ width: 390, height: 631 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`PD4: ${vp.width}×${vp.height} every answer button is 44 px, in the drawer and on screen with the longest cards`, async ({ page }) => {
    await page.setViewportSize(vp);
    const j = journey(page); await j.boot("/");
    await page.waitForFunction(() => !!(window as any).__neural.curriculum);
    const due = await seed(page, LONGEST);
    expect(due[0].a, "the longest authored answer (160 characters, mcClip's ceiling)").toBeGreaterThanOrEqual(160);
    expect(due[1].d, "the longest authored explanation").toBeGreaterThanOrEqual(1000);
    await j.clickByMouse(".ng-logo", "open the drawer");
    await openPractice(page, j);
    for (const [i, card] of due.entries()) {
      await expect(page.locator('[data-session-row][aria-expanded="true"]'), "the card in view").toHaveAttribute("data-session-row", card.key);
      await checkAnswers(page, "[data-mini-reveal]", `${card.key}, before Reveal`);
      await j.clickByMouse(`${OPEN} [data-mini-reveal]`, "Reveal");
      await expect(page.locator(`${OPEN} [data-mini-a]`)).toBeVisible();
      await checkAnswers(page, "[data-mini-got]", `${card.key}, answered`);
      await checkAnswers(page, "[data-mini-again]", `${card.key}, answered`);
      if (i === 0) {
        await j.clickByMouse(`${OPEN} [data-mini-got]`, "Got it");
        await expect.poll(() => page.evaluate(() => (window as any).__neural.practiceToday().done), { message: "graded once" }).toBe(1);
        // the next technique, by key, unless grading already moved the session on
        if (await page.evaluate(() => (window as any).__neural._session.idx) === 0) await page.keyboard.press("ArrowDown");
      }
    }
  });

  test(`PD4: ${vp.width}×${vp.height} a recognition card's choices are 44 px, in the drawer and on screen`, async ({ page }) => {
    await page.setViewportSize(vp);
    const j = journey(page); await j.boot("/");
    await page.waitForFunction(() => !!(window as any).__neural.curriculum);
    await seed(page, 0);
    await j.rig("practice-mc-pick", Array(100).fill(.31)); await j.rig("practice-mc-shuffle", Array(100).fill(.56));
    await page.evaluate(async () => {
      const a = (window as any).__neural;
      a.settings.mcMode = "mc";
      await a.hydrateDeck("Mount|Top");
      const c = a._cardsOf(a.flashcards.decks["Mount|Top"]).filter((x: any) => a.mcClip(x.a))[0];
      a.srs = { "Mount|Top": { [a.qhash(c.q)]: [a._epochDay() - 1, 3, a._epochDay() - 3] } };
      await a._warmMcPool(c, "Mount|Top", "practice");
      await a._ensureGameplanRuntime();
    });
    await j.clickByMouse(".ng-logo", "open the drawer");
    await openPractice(page, j);
    await expect(page.locator(`${OPEN} [data-practice-mc-opt]:visible`)).toHaveCount(3);
    await checkAnswers(page, "[data-practice-mc-opt]", "the choices");
  });
}

test("PD5: Practice keeps its own solid background, and the badge stays hidden while practising", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 1);
  await j.clickByMouse(".ng-logo", "open the drawer");
  const look = () => page.evaluate(() => ({
    bg: getComputedStyle(document.querySelector(".ng-drill")!).backgroundColor,
    badge: getComputedStyle(document.querySelector(".ng-acctwrap")!).display !== "none",
  }));
  const home = await look();
  expect(home.badge, "the badge shows at the foot of the list (control)").toBe(true);
  await openPractice(page, j);
  const practising = await look();
  expect(practising.bg, "PD5: Practice is opaque, so the paused game cannot show through").toBe("rgb(17, 21, 34)");
  expect(practising.badge, "PD5: the badge is hidden while practising").toBe(false);
  await j.clickByMouse("[data-pane-back]", "‹ Practice");
  expect((await look()).badge, "the badge is back with the list").toBe(true);
});
