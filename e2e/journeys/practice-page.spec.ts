import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

/** P1-A..F. The production page and renderer, entered with measured pointer/touch
 * or native Tab/Enter. No locator click can scroll the first answer into view.
 * Real gameplan.js requests are held and counted in the cold/press cases.
 * Dossiers are the harness's empty stub; no claim here depends on their contents.
 * Named mutation receipts: tests/artifacts/ladder_p1_mutants.md. */
test.use({ hasTouch: true });

async function seed(page: any, due = 1, answered = 0, belt = "white") {
  return page.evaluate(async ({ due, answered, belt }: any) => {
    const a = (window as any).__neural;
    a.setPaused(true);
    a.srs = {}; a.prep = {}; a.stage = {}; a.rec = {}; a.units = {};
    a.belts = { held: { id: belt, t: 1 }, gf: 1, won: {} };
    a._gameplanProvider = null; a._miniGraded = new Set(); a.settings.dailyGoal = 20;
    const day = a._epochDay();
    const keys = a.curriculum.belts.find((b: any) => b.id === "black").units.flatMap((u: any) => u.lessons)
      .filter((l: any) => a._lessonLive(l)).map((l: any) => l.deckKey);
    const picked = [...new Set(keys)].slice(0, due) as string[];
    await a.hydrateDecks(picked);
    for (const key of picked) {
      const c = a._cardsOf(a.flashcards.decks[key])[0];
      a.srs[key] = { [a.qhash(c.q)]: [day - 1, 3, day - 4] };
    }
    if (answered) a.srs["Previous practice|Top"] = Object.fromEntries(Array.from({ length: answered }, (_, i) => ["prior" + i, [day + 1, 1, day]]));
    a.setViewMode("explore");
    return { dueKey: picked[0], day };
  }, { due, answered, belt });
}

async function door(page: any, j: any, keyboard = false, touch = false) {
  await j.clickByMouse(".ng-logo", "open the drawer");
  const selector = '[data-explore-stats] [data-b="due"]';
  if (keyboard) {
    await page.locator(".ng-drawer-brand").focus();
    let reached = false;
    for (let n = 0; n < 40; n++) {
      await page.keyboard.press("Tab");
      if (await page.locator(selector).evaluate((el: Element) => el === document.activeElement)) { reached = true; break; }
    }
    expect(reached, "P1-A: native Tab reaches Practice").toBe(true);
    await page.keyboard.press("Enter");
  } else if (touch) {
    const b = await page.locator(selector).boundingBox();
    expect(b).not.toBeNull();
    await page.touchscreen.tap(b!.x + b!.width / 2, b!.y + b!.height / 2);
  } else await j.clickByMouse(selector, "open Practice");
  await expect(page.locator("[data-practice-page]")).toHaveCount(1);
}

async function firstAnswer(page: any, j: any) {
  await expect(page.locator('[data-mini-q]:visible'), "P1-A: first question opens").toHaveCount(1);
  const geometry = await page.locator('[data-mini-reveal]:visible').evaluate((el: HTMLElement) => {
    const r = el.getBoundingClientRect(), q = document.querySelector('[data-session-row][aria-expanded="true"] + div [data-mini-q]')!.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2, hit = document.elementFromPoint(x, y);
    return { top: q.top, bottom: r.bottom, screen: innerHeight, left: r.left, right: r.right, width: innerWidth,
      hit: hit === el || !!hit && el.contains(hit), scroll: (window as any).__neural.drillListRef.current.scrollTop };
  });
  expect(await page.locator('[data-mini-q]:visible').evaluate(el => !!(el.compareDocumentPosition(document.querySelector("[data-gameplan-summary]")!) & Node.DOCUMENT_POSITION_FOLLOWING)),
    "P1-A: planning prose follows the question").toBe(true);
  expect(geometry.top, "P1-A: first question above the fold").toBeGreaterThanOrEqual(0);
  expect(geometry.bottom, "P1-A: primary response fits above the fold").toBeLessThanOrEqual(geometry.screen);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.width);
  expect(geometry.hit, "P1-A: primary response is hit-testable").toBe(true);
  expect(geometry.scroll, "P1-A: entry did not scroll to manufacture visibility").toBe(0);
  await j.clickByMouse('[data-session-row][aria-expanded="true"] + div [data-mini-reveal]', "reveal the first question");
  await expect(page.locator('[data-mini-a]:visible')).toHaveCount(1);
}

for (const viewport of [{ width: 390, height: 631 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  for (const cold of [false, true]) test(`P1-A: ${viewport.width}×${viewport.height} ${cold ? "cold review" : "warm new"} opens on an operable question @curated`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const j = journey(page); await j.boot("/");
    await page.waitForFunction(() => !!(window as any).__neural.curriculum);
    let held = 0, release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    if (cold) await page.route("**/app/gameplan.js*", async route => { held++; await gate; await route.continue(); });
    else await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime());
    const fixture = await seed(page, cold ? 1 : 0);
    try {
      await door(page, j, viewport.width === 1440, viewport.width === 390);
      if (cold) {
        await expect.poll(() => held, { message: "P1-D: the real planner request was held" }).toBe(1);
        await expect(page.locator('[data-session-row][aria-expanded="true"]'), "P1-F: due reviews ignore belt locks").toHaveAttribute("data-session-row", fixture.dueKey);
      }
      await firstAnswer(page, j);
      expect(await page.evaluate(() => (window as any).__neural.practiceToday().done), "P1-C: reveal earns no grade").toBe(0);
      await expect(page.locator("[data-belt-locked]")).toHaveCount(4);
      await expect(page.locator("[data-belt-locked] button, [data-belt-locked] [data-lesson]")).toHaveCount(0);
      await expect(page.locator("[data-session] iframe, [data-session] video")).toHaveCount(0);
      if (process.env.PRACTICE_SCREENS) await page.screenshot({ path: `${process.env.PRACTICE_SCREENS}/${viewport.width}x${viewport.height}-${cold ? "cold" : "warm"}.png` });
    } finally { release(); }
  });
}

test("P1-B: only earned belt sections open; earlier work is revealable; direct selection cannot unlock @curated", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 1, 0, "blue"); await door(page, j);
  await expect(page.locator('[data-belt="white"]')).toHaveCount(0);
  await expect(page.locator('[data-belt="blue"] [data-track="blue"]')).toHaveCount(1);
  await expect(page.locator('[data-belt-locked]')).toHaveCount(3);
  const guard = await page.evaluate(() => {
    const a = (window as any).__neural, before = a.selectedChallengeTrack();
    a.selectChallengeTrack("black"); a._setBeltSectionOpen("black", true);
    return { before, after: a.selectedChallengeTrack(), open: a._beltSectionOpen("black"), worn: a.wornBelt().id };
  });
  expect(guard.after, "P1-B: action-level unlock guard").toBe(guard.before);
  expect(guard.open).toBe(false); expect(guard.worn).toBe("blue");
  await page.locator("[data-earlier-belts]").scrollIntoViewIfNeeded();
  await j.clickByMouse("[data-earlier-belts]", "show earlier belts");
  await expect(page.locator('[data-belt="white"] [data-track="white"]')).toHaveCount(1);
  await page.locator("[data-earlier-belts]").scrollIntoViewIfNeeded();
  await page.locator("[data-earlier-belts]").focus(); await page.keyboard.press("Enter");
  await expect(page.locator('[data-belt="white"]')).toHaveCount(0);
  expect(await page.evaluate(() => {
    const a = (window as any).__neural; a._focusRow = "lesson:" + a.curriculum.belts[0].units[0].lessons[0].deckKey; return a._focusedMini();
  }), "P1-E: hidden lessons never receive input").toBeNull();
});

test("P1-C: explicit new practice reaches 21 before the due queue is cleared @curated", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime());
  await seed(page, 2, 20); await door(page, j);
  await page.evaluate(() => {
    const a = (window as any).__neural, track = a.track.bind(a);
    (window as any).__originalPractice = a._session; (window as any).__p1More = 0;
    a.track = (name: string, data: any) => { if (name === "neural_find_more_weaknesses") (window as any).__p1More++; track(name, data); };
  });
  await expect(page.locator("[data-plan-more]")).toBeEnabled();
  await page.locator("[data-plan-more]").scrollIntoViewIfNeeded();
  await j.clickByMouse("[data-plan-more]", "continue while reviews remain");
  expect(await page.evaluate(() => (window as any).__p1More), "P1-F: one continuation event per deliberate press").toBe(1);
  await expect(page.locator('[data-session-row][aria-expanded="true"]')).toHaveAttribute("data-practice-kind", "new");
  await page.locator('[data-mini-reveal]:visible').scrollIntoViewIfNeeded();
  await j.clickByMouse('[data-session-row][aria-expanded="true"] + div [data-mini-reveal]', "reveal new card after goal");
  await page.locator('[data-mini-again]:visible').scrollIntoViewIfNeeded();
  await j.clickByMouse('[data-session-row][aria-expanded="true"] + div [data-mini-again]', "a mistake still counts once");
  await expect(page.locator('[data-practice-goal]')).toHaveText("Daily goal: 21 of 20 today ✓");
  const state = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { same: a._session === (window as any).__originalPractice, due: a.dueCount(), done: a.practiceToday().done };
  });
  expect(state.same, "P1-C: continuation keeps the session").toBe(true);
  expect(state.due, "P1-C: continuation did not require clearing debt").toBe(2);
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as any).__neural.practiceToday().done), "P1-C: repeated/shared grade earns no second daily credit").toBe(21);
});

test("P1-D: a late planner preserves a revealed answer and in-flight press, then appends new work @curated", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  let held = 0, release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  await page.route("**/app/gameplan.js*", async route => { held++; await gate; await route.continue(); });
  await seed(page, 2); await door(page, j);
  try {
    await expect.poll(() => held).toBe(1);
    await j.clickByMouse('[data-session-row][aria-expanded="true"] + div [data-mini-reveal]', "reveal while planner is held");
    await page.evaluate(() => {
      (window as any).__practiceIdentity = { s: (window as any).__neural._session, answer: document.querySelector("[data-mini-a]"), button: document.querySelector("[data-mini-got]") };
    });
    const b = await page.locator('[data-mini-got]:visible').boundingBox(); expect(b).not.toBeNull();
    await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2); await page.mouse.down();
    release();
    await page.waitForFunction(() => !!(window as any).__neural._gameplanRuntime);
    expect(await page.evaluate(() => {
      const x = (window as any).__practiceIdentity;
      return x.s === (window as any).__neural._session && x.answer.isConnected && x.button.isConnected;
    }), "P1-D: the answer and pressed button survive arrival").toBe(true);
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => (window as any).__neural.practiceToday().done), { message: "P1-D: the press graded once" }).toBe(1);
    await expect.poll(() => page.locator('[data-session-row][data-practice-kind="new"]').count(), { message: "P1-D: new work joins even after engagement" }).toBeGreaterThan(0);
    expect(await page.evaluate(() => (window as any).__practiceIdentity.s === (window as any).__neural._session)).toBe(true);
  } finally { release(); await page.mouse.up(); }
});

for (const paused of [false, true]) test(`P1-E: card arrows, Space, swipe and close preserve pause ownership (${paused}) @curated`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 631 });
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 0);
  await page.evaluate((p) => (window as any).__neural.setPaused(p), paused);
  await door(page, j);
  const q = page.locator('[data-mini-q]:visible');
  await expect(q).toHaveCount(1);
  const first = await q.textContent();
  await page.keyboard.press("ArrowRight"); await expect(q).not.toHaveText(first!);
  await page.keyboard.press("ArrowLeft"); await expect(q).toHaveText(first!);
  await page.keyboard.press("Space"); await expect(page.locator('[data-mini-a]:visible')).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).__neural.paused), "P1-E: Space does not resume play during study").toBe(true);
  await page.keyboard.press("Space");
  const b = await q.boundingBox(); expect(b).not.toBeNull();
  const cdp = await page.context().newCDPSession(page), y = b!.y + b!.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: b!.x + b!.width - 15, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: b!.x + 15, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await expect(page.locator('[data-practice-page]'), "P1-E: a card swipe cannot dismiss Practice").toBeVisible();
  await expect(q, "P1-E: horizontal swipe pages the card").not.toHaveText(first!);
  await page.waitForTimeout(710); // the shared swipe guard suppresses synthetic clicks for 700 ms
  await j.clickByMouse(".ng-explorer-close", "close Practice");
  await expect(page.locator(".ng-drill"), "P1-E: Close actually dismissed the page").toBeHidden();
  expect(await page.evaluate(() => (window as any).__neural.paused), "P1-E: close restores only its own pause").toBe(paused);
});

test("P1-E: detached card registry entries never receive input @curated", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 1); await door(page, j);
  await expect(page.locator('[data-mini-q]:visible'), "P1-A: first question opens").toHaveCount(1);
  const state = await page.evaluate(() => {
    const a = (window as any).__neural, rid = a._focusRow;
    const registered = !!a._miniReg[rid];
    a._openMini.el.remove();
    return { registered, focused: a._focusedMini() };
  });
  expect(state.registered, "P1-E: the detached registry fixture was real").toBe(true);
  expect(state.focused, "P1-E: detached registry guard").toBeNull();
  await page.keyboard.press("Space"); await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as any).__neural.practiceToday().done)).toBe(0);
});

test("P1-D: both real cold indexes preserve the Practice answer and keyboard focus @curated", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 2);
  await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime());
  const releases: (() => void)[] = [], held: string[] = [];
  for (const name of ["systems-index", "concepts"]) {
    const gate = new Promise<void>(r => releases.push(r));
    await page.route(`**/${name}.json`, async route => { held.push(name); await gate; await route.continue(); });
  }
  try {
    await door(page, j);
    await expect.poll(() => held.slice().sort(), { message: "P1-D: both real indexes were held" }).toEqual(["concepts", "systems-index"]);
    await page.keyboard.press("Space");
    await expect(page.locator('[data-mini-a]:visible')).toHaveCount(1);
    await page.evaluate(() => { (window as any).__indexAnswer = { answer: document.querySelector('[data-mini-a]'), focus: document.activeElement, session: (window as any).__neural._session }; });
    for (const [i, field] of ["systems", "concepts"].entries()) {
      releases[i]();
      await expect.poll(() => page.evaluate(k => (window as any).__neural[k]?.length || 0, field)).toBeGreaterThan(0);
      expect(await page.evaluate(() => {
        const x = (window as any).__indexAnswer;
        return x.answer.isConnected && x.focus === document.activeElement && x.session === (window as any).__neural._session;
      }), `P1-D: ${field} preserves the active answer and focus`).toBe(true);
    }
  } finally { releases.forEach(r => r()); }
});

for (const viewport of [{ width: 390, height: 631 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) test(`P1-A/D: recognition at ${viewport.width}×${viewport.height} keeps options, selected answer and focus through the late planner @curated`, async ({ page }) => {
  await page.setViewportSize(viewport);
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 0);
  await j.rig("practice-mc-pick", Array(100).fill(.31)); await j.rig("practice-mc-shuffle", Array(100).fill(.56));
  await page.evaluate(async () => {
    const a = (window as any).__neural;
    a.settings.mcMode = "mc";
    await a.hydrateDeck("Mount|Top");
    const cards = a._cardsOf(a.flashcards.decks["Mount|Top"]).filter((c: any) => a.mcClip(c.a)).slice(0, 2), c = cards[0];
    if (cards.length !== 2) throw Error("Need two authored recognition cards");
    a.srs = { "Mount|Top": Object.fromEntries(cards.map((c: any) => [a.qhash(c.q), [a._epochDay() - 1, 3, a._epochDay() - 3]])) };
    await a._warmMcPool(c, "Mount|Top", "practice");
  });
  let held = 0, release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  await page.route("**/app/gameplan.js*", async route => { held++; await gate; await route.continue(); });
  try {
    await door(page, j);
    await expect.poll(() => held).toBe(1);
    const options = page.locator('[data-practice-mc-opt]:visible');
    await expect(options).toHaveCount(3);
    const b = await options.first().boundingBox(); expect(b).not.toBeNull();
    expect(b!.y + b!.height, "P1-A: first recognition response fits the short viewport").toBeLessThanOrEqual(viewport.height);
    expect(await options.first().evaluate(el => { const r = el.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return top === el || !!top && el.contains(top); })).toBe(true);
    const wrong = await page.evaluate(() => ((window as any).__neural._mc.correct + 1) % 3);
    await page.keyboard.press("abc"[wrong]);
    await expect.poll(() => page.evaluate(() => (window as any).__neural.practiceToday().done)).toBe(1);
    await options.nth(wrong).focus();
    await page.evaluate(() => { (window as any).__selectedPracticeOption = document.activeElement; });
    release();
    await page.waitForFunction(() => !!(window as any).__neural._session.plan);
    expect(await page.evaluate(() => document.activeElement === (window as any).__selectedPracticeOption), "P1-D: selected MC answer keeps focus").toBe(true);
    await expect(options.nth(wrong)).toHaveAttribute("data-mc-result", /wrong|plausible|trap/);
    await page.keyboard.press("abc"[wrong]);
    expect(await page.evaluate(() => (window as any).__neural.practiceToday().done), "P1-C: exploring an answered option earns no second grade").toBe(1);
  } finally { release(); }
});

test("P1-F: Practice retains comparison, rewards, Path and one deliberate visit event @curated", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 1);
  await page.evaluate(async () => {
    const a = (window as any).__neural;
    a.badges = { "clean-checkpoint": { t: 1 } }; a.coins = { houdini: { t: 1 } };
    const track = a.track.bind(a); (window as any).__p1Visits = [];
    a.track = (name: string, data: any) => { if (["neural_practice_opened", "neural_challenges_viewed"].includes(name)) (window as any).__p1Visits.push(name); track(name, data); };
    await a._ensureGameplanRuntime();
  });
  await door(page, j);
  await expect(page.locator('[data-rewards-shelf]'), "P1-F: earned rewards have a destination").toContainText("Clean Checkpoint");
  await expect(page.locator('[data-rewards-shelf]')).toContainText("Houdini");
  await page.locator('[data-practice-details] > summary').scrollIntoViewIfNeeded();
  await j.clickByMouse('[data-practice-details] > summary', "open Practice details");
  await expect(page.locator('[data-gameplan-study-controls]'), "P1-F: comparison controls survive").toHaveCount(1);
  await expect(page.locator('[data-gameplan-refresh]'), "P1-F: Refresh plan remains available").toHaveCount(1);
  await page.locator('[data-gameplan-refresh]').scrollIntoViewIfNeeded();
  await j.clickByMouse('[data-gameplan-refresh]', "request the comparison deliberately");
  await expect(page.locator('[data-game-study-controls]'), "P1-F: comparison form loads after Refresh").toHaveCount(1, { timeout: 30_000 });
  await j.clickByMouse('[data-pane-back]', "Back to the drawer");
  await expect(page.locator('[data-view="challenges"]'), "P1-F: temporary Path destination remains").toBeVisible();
  await j.clickByMouse('[data-view="challenges"]', "open Path deliberately");
  await page.evaluate(() => (window as any).__neural.renderExplorer());
  expect(await page.evaluate(() => (window as any).__p1Visits), "P1-F: one event per deliberate surface visit")
    .toEqual(["neural_practice_opened", "neural_challenges_viewed"]);
});

test("P1-F: a Practice unit still starts its evidence-gated checkpoint @curated", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 1);
  const unit = await page.evaluate(() => {
    const a = (window as any).__neural, u = a.curriculum.belts[0].units[0];
    for (const l of u.lessons) a.prep[l.deckKey] = 99;
    return "white/" + u.id;
  });
  await j.rig("checkpoint-pick", Array(30).fill(.5));
  await j.rig("mc-pick", Array(100).fill(.31)); await j.rig("mc-shuffle", Array(100).fill(.56));
  await door(page, j);
  const sel = `[data-checkpoint="${unit}"]`;
  await page.locator(sel).evaluate(el => { const d = el.closest("details") as HTMLDetailsElement; d.open = true; });
  await page.locator(sel).scrollIntoViewIfNeeded();
  await j.clickByMouse(sel, "start the ready unit checkpoint");
  await expect.poll(() => page.evaluate(() => (window as any).__neural._checkpoint?.picks.length || 0),
    { message: "P1-F: checkpoint action starts a real quiz" }).toBeGreaterThan(0);
});

test("P1-E: an unpoolable recognition card falls back to keyboard recall @curated", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 0);
  await j.rig("practice-mc-pick", Array(100).fill(.31)); await j.rig("practice-mc-shuffle", Array(100).fill(.56));
  await page.evaluate(async () => {
    const a = (window as any).__neural;
    a.settings.mcMode = "mc";
    await a.hydrateDeck("Mount|Top");
    const c = a._cardsOf(a.flashcards.decks["Mount|Top"])[0];
    c.a = "Yes."; // controlled micro-answer: the real length-ratio guard rejects distractors
    a.srs = { "Mount|Top": { [a.qhash(c.q)]: [a._epochDay() - 1, 3, a._epochDay() - 4] } };
    await a._warmMcPool(c, "Mount|Top", "practice");
    await a._ensureGameplanRuntime();
  });
  await door(page, j);
  await expect(page.locator('[data-mini-reveal]:visible')).toContainText("Reveal");
  await expect(page.locator('[data-mini-reveal]:visible')).toBeEnabled();
  await expect(page.locator('[data-practice-mc-opt]:visible')).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.locator('[data-mini-a]:visible'), "P1-E: fallback Space reveals").toHaveCount(1);
  expect(await page.evaluate(() => (window as any).__neural.practiceToday().done)).toBe(0);
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as any).__neural.practiceToday().done), "P1-E: fallback Enter grades once").toBe(1);
});

test("P1-E: Back restores the origin URL, title, selection and drawer focus @curated", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 1);
  await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime());
  const origin = { url: page.url(), title: await page.title(), node: await page.evaluate(() => (window as any).__neural.focusIdx) };
  await door(page, j);
  const key = await page.locator('[data-belt="white"] [data-lesson]').first().getAttribute("data-lesson");
  const selector = `[data-belt="white"] [data-lesson="${key}"]`;
  await page.locator(selector).scrollIntoViewIfNeeded();
  await j.clickByMouse(selector, "select a Practice lesson on the map");
  await expect.poll(() => page.url()).not.toBe(origin.url);
  await j.clickByMouse('[data-pane-back]', "Back to the original drawer");
  await expect(page).toHaveURL(origin.url);
  expect(await page.title(), "P1-E: original title restored").toBe(origin.title);
  expect(await page.evaluate(() => (window as any).__neural.focusIdx)).toBe(origin.node);
  await expect(page.locator('[data-explore-stats] [data-b="due"]'), "P1-E: Back restores the Practice opener").toBeFocused();
});

test("P1-A: long authored answers and enlarged text scroll to an operable grade @curated", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 631 });
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 0);
  const length = await page.evaluate(async () => {
    const a = (window as any).__neural;
    const keys = a.curriculum.belts[0].units.flatMap((u: any) => u.lessons).filter((l: any) => a._lessonLive(l)).map((l: any) => l.deckKey);
    await a.hydrateDecks(keys);
    const chosen = keys.flatMap((key: string) => (a._cardsOf(a.flashcards.decks[key]) || []).map((c: any) => ({ key, ...c })))
      .sort((x: any, y: any) => y.a.length - x.a.length)[0];
    a.srs = { [chosen.key]: { [a.qhash(chosen.q)]: [a._epochDay() - 1, 3, a._epochDay() - 4] } };
    await a._ensureGameplanRuntime();
    return chosen.a.length;
  });
  // Authored short answers top out at 160 characters in this corpus.
  expect(length, "P1-A: a long authored answer was selected").toBeGreaterThanOrEqual(150);
  await page.addStyleTag({ content: '[data-practice-page] [data-mini-q], [data-practice-page] [data-mini-a] { font-size: 30px !important; }' });
  await door(page, j);
  await page.locator('[data-mini-reveal]:visible').scrollIntoViewIfNeeded();
  await j.clickByMouse('[data-session] [data-mini-reveal]', "reveal with enlarged text");
  await expect(page.locator('[data-mini-a]:visible')).toHaveCSS("font-size", "30px");
  await page.locator('[data-mini-again]:visible').scrollIntoViewIfNeeded();
  const geometry = await page.locator('[data-mini-again]:visible').evaluate((el: HTMLElement) => {
    const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { top: r.top, bottom: r.bottom, hit: hit === el || !!hit && el.contains(hit), scroll: (window as any).__neural.drillListRef.current.scrollTop };
  });
  expect(geometry.scroll, "P1-A: long enlarged text scrolls naturally").toBeGreaterThan(0);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(631);
  expect(geometry.hit, "P1-A: no pinned chrome covers the long-answer grade").toBe(true);
  await j.clickByMouse('[data-session] [data-mini-again]', "grade after reading a long answer");
  expect(await page.evaluate(() => (window as any).__neural.practiceToday().done)).toBe(1);
});

test("P1-E: Back restores keyboard focus to Path's maintenance opener @curated", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 1);
  await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime());
  await j.clickByMouse('.ng-logo', "open the drawer");
  await j.clickByMouse('[data-view="challenges"]', "open Path");
  await j.clickByMouse('[data-maintenance]', "start Practice from Path");
  await expect(page.locator('[data-practice-page]')).toHaveCount(1);
  await j.clickByMouse('[data-pane-back]', "return to Path");
  await expect(page.locator('[data-maintenance]'), "P1-E: the rebuilt maintenance opener regains focus").toBeFocused();
});
