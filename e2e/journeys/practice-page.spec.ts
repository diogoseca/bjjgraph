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
  // The deploy gate (@curated) runs ONE of these, 390×844 warm new: one quick test per surface (U147 a, v1.263.0).
  // Every case runs in e2e-full's core shards on each PR and each merge to dev; tests/artifacts/deploy_gate.json.
  for (const cold of [false, true]) test(`P1-A: ${viewport.width}×${viewport.height} ${cold ? "cold review" : "warm new"} opens on an operable question${viewport.width === 390 && viewport.height === 844 && !cold ? " @curated" : ""}`, async ({ page }) => {
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
      // Until v1.270.0: `[data-belt-locked]` x4, with no button or lesson in them (the white belt's four later sections were
      // locked). U163 c ("everything opens", owner, 13 Nov): all five sections are ordinary ones, each with its fold toggle.
      await expect(page.locator(".ng-belt-section [data-belt-toggle]")).toHaveCount(5);
      await expect(page.locator("[data-session] iframe, [data-session] video")).toHaveCount(0);
      if (process.env.PRACTICE_SCREENS) await page.screenshot({ path: `${process.env.PRACTICE_SCREENS}/${viewport.width}x${viewport.height}-${cold ? "cold" : "warm"}.png` });
    } finally { release(); }
  });
}

// Until v1.270.0 this was "P1-B: only earned belt sections open; earlier work is revealable; direct selection cannot unlock":
// on a blue belt it asserted three locked sections and that selecting Black and unfolding it were refused. U163 c (owner,
// 13 Nov, "everything opens") reverses that half: every later section is open, selectable and unfoldable. The other half
// stands as it was: Practice's corridor starts at the belt you wear, earlier belts are one press away, and a hidden lesson
// takes no input.
test("U163 c: every belt section is open; earlier work is revealable; a later belt can be selected and unfolded", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 1, 0, "blue"); await door(page, j);
  await expect(page.locator('[data-belt="white"]')).toHaveCount(0);
  await expect(page.locator('[data-belt="blue"] [data-track="blue"]')).toHaveCount(1);
  await expect(page.locator(".ng-belt-section [data-belt-toggle]"), "U163 c: blue and the three after it, every one open").toHaveCount(4);
  await page.locator('[data-belt-toggle="black"]').scrollIntoViewIfNeeded();
  await j.clickByMouse('[data-belt-toggle="black"]', "unfold Black");
  await expect(page.locator('[data-belt="black"]'), "U163 c: a later belt unfolds").toHaveAttribute("data-collapsed", "false");
  const guard = await page.evaluate(() => {
    const a = (window as any).__neural;
    a.selectChallengeTrack("black");
    return { after: a.selectedChallengeTrack(), open: a._beltSectionOpen("black"), worn: a.wornBelt().id };
  });
  expect(guard.after, "U163 c: a later belt can be selected").toBe("black");
  expect(guard.open).toBe(true); expect(guard.worn, "the belt itself is untouched").toBe("blue");
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

test("P1-C: explicit new practice reaches 21 before the due queue is cleared", async ({ page }) => {
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

test("P1-D: a late planner preserves a revealed answer and in-flight press, then appends new work", async ({ page }) => {
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

for (const paused of [false, true]) test(`P1-E: card arrows, Space, swipe and close preserve pause ownership (${paused})`, async ({ page }) => {
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

test("P1-E: detached card registry entries never receive input", async ({ page }) => {
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

test("P1-D: both real cold indexes preserve the Practice answer and keyboard focus", async ({ page }) => {
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

for (const viewport of [{ width: 390, height: 631 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) test(`P1-A/D: recognition at ${viewport.width}×${viewport.height} keeps options, selected answer and focus through the late planner`, async ({ page }) => {
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

test("P1-F: Practice retains comparison, rewards, Path and one deliberate visit event", async ({ page }) => {
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
  await expect(page.locator("[data-practice-keys]"), "P1-F: the key legend stays").toHaveText("←→ card·↑↓ technique·space flip");
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

test("P1-F: a Practice unit still starts its evidence-gated checkpoint", async ({ page }) => {
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

/** Open the card `qh` (of deck `deck`) the way a player reaches a later row: by its row's button in the session queue, then
 *  the deck's own arrows. The row is the plan's when the plan holds the card (filed under any deck that shares it), else the
 *  deck is appended through Practice's own append (the seam "Keep practising" and a Path lesson use). Since v1.278.0 the
 *  day's queue is what is worth most (U171 a), so a seeded card is no longer the first; the list is scrolled back to its top
 *  so a claim about scrolling after this still has to earn its scroll. */
async function openCard(page: any, j: any, deck: string, qh: string) {
  await expect.poll(() => page.evaluate(() => (window as any).__neural._session?.plan?.order || null), { message: "the worth plan lands" }).toBe("worth");
  const row = await page.evaluate(({ deck, qh }: any) => {
    const a = (window as any).__neural, s = a._session;
    const held = s.plan.due.concat(s.plan.fresh).find((r: any) => r.questions.includes(qh));
    if (held) return held.key;
    a._practiceAppend(s, s.plan, [{ key: deck, questions: [qh], pending: 0, reason: "The card under test." }]);
    return deck;
  }, { deck, qh });
  await page.locator("[data-practice-details] > summary").scrollIntoViewIfNeeded();
  await j.clickByMouse("[data-practice-details] > summary", "Practice details & session queue");
  await page.evaluate((k: string) => { document.querySelector("[data-open-card-jump]")?.removeAttribute("data-open-card-jump");
    const b = [...document.querySelectorAll("[data-practice-queue] button")].find((x) => x.textContent === k.replace("|", " \u00b7 ")); if (b) b.setAttribute("data-open-card-jump", "1"); }, row);
  await page.locator("[data-open-card-jump]").scrollIntoViewIfNeeded();
  await j.clickByMouse("[data-open-card-jump]", "the queue's button for the card's row");
  await expect(page.locator('[data-session-row][aria-expanded="true"]')).toHaveAttribute("data-session-row", row);
  const on = () => page.evaluate(({ row, qh }: any) => { const a = (window as any).__neural, q = document.querySelector('[data-session-row][aria-expanded="true"] + div [data-mini-q]');
    const c = (a._cardsOf(a.flashcards.decks[row]) || []).find((x: any) => a.qhash(x.q) === qh); return !!q && !!c && q.textContent!.includes(c.q.slice(0, 40)); }, { row, qh });
  for (let i = 0; i < 8 && !(await on()); i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(150); }
  expect(await on(), "the card under test is the open one").toBe(true);
  await page.evaluate(() => { (window as any).__neural.drillListRef.current.scrollTop = 0; });
}

test("P1-E: an unpoolable recognition card falls back to keyboard recall", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await seed(page, 0);
  await j.rig("practice-mc-pick", Array(100).fill(.31)); await j.rig("practice-mc-shuffle", Array(100).fill(.56));
  await page.evaluate(async () => {
    const a = (window as any).__neural;
    a.settings.mcMode = "mc";
    await a.hydrateDeck("Mount|Top");
    const c = a._cardsOf(a.flashcards.decks["Mount|Top"])[0], qh = a.qhash(c.q);
    // ANKI1: this question is shared (Mount|Bottom carries it too), and under the owner's Anki rule the plan asks this one
    // owed card first, filed under its home deck, the first of its decks: Mount|Bottom. Until then the order never asked it,
    // so `openCard` appended Mount|Top's row, and only Mount|Top's copy wore the controlled answer. Now EVERY copy does and
    // each is warmed, so whichever row holds the card, it is the unpoolable one
    const keys = (a._sharedQ && a._sharedQ.get(qh)) || ["Mount|Top"];
    for (const k of keys) {
      await a.hydrateDeck(k);
      for (const x of a._cardsOf(a.flashcards.decks[k]) || []) if (a.qhash(x.q) === qh) x.a = "Yes."; // controlled micro-answer: the real length-ratio guard rejects distractors
    }
    a.srs = { "Mount|Top": { [qh]: [a._epochDay() - 1, 3, a._epochDay() - 4] } };
    for (const k of keys) { const x = (a._cardsOf(a.flashcards.decks[k]) || []).find((y: any) => a.qhash(y.q) === qh); if (x) await a._warmMcPool(x, k, "practice"); }
    await a._ensureGameplanRuntime();
    (window as any).__unpoolable = a.qhash(c.q);
  });
  await door(page, j);
  // Until v1.278.0 the one owed card opened the queue (most overdue first); the day's queue is now what is worth most
  // (U171 a), so the card is opened the way a player reaches a later row (`openCard`)
  await openCard(page, j, "Mount|Top", await page.evaluate(() => (window as any).__unpoolable));
  await expect(page.locator('[data-mini-reveal]:visible')).toContainText("Reveal");
  await expect(page.locator('[data-mini-reveal]:visible')).toBeEnabled();
  await expect(page.locator('[data-practice-mc-opt]:visible')).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.locator('[data-mini-a]:visible'), "P1-E: fallback Space reveals").toHaveCount(1);
  expect(await page.evaluate(() => (window as any).__neural.practiceToday().done)).toBe(0);
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as any).__neural.practiceToday().done), "P1-E: fallback Enter grades once").toBe(1);
});

test("P1-E: Back restores the origin URL, title, selection and drawer focus", async ({ page }) => {
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

test("P1-A: long authored answers and enlarged text scroll to an operable grade", async ({ page }) => {
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
    (window as any).__longCard = { key: chosen.key, qh: a.qhash(chosen.q) };
    return chosen.a.length;
  });
  // Authored short answers top out at 160 characters in this corpus.
  expect(length, "P1-A: a long authored answer was selected").toBeGreaterThanOrEqual(150);
  await page.addStyleTag({ content: '[data-practice-page] [data-mini-q], [data-practice-page] [data-mini-a] { font-size: 30px !important; }' });
  await door(page, j);
  // until v1.278.0 the one owed card opened the queue; it is now opened as a player reaches a later row (U171 a)
  const long = await page.evaluate(() => (window as any).__longCard);
  await openCard(page, j, long.key, long.qh);
  await page.locator('[data-mini-reveal]:visible').scrollIntoViewIfNeeded();
  await j.clickByMouse('[data-session-row][aria-expanded="true"] + div [data-mini-reveal]', "reveal with enlarged text");
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
  await j.clickByMouse('[data-session-row][aria-expanded="true"] + div [data-mini-again]', "grade after reading a long answer");
  expect(await page.evaluate(() => (window as any).__neural.practiceToday().done)).toBe(1);
});

test("P1-E: Back restores keyboard focus to Path's maintenance opener", async ({ page }) => {
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

// ── The fix round on PR #336 (REV336). Each pin is killed by a named mutant in ladder_p1_mutants.md. ──

const lessonFixture = (page: any) => page.evaluate(async () => {
  const a = (window as any).__neural, u = a.curriculum.belts[0].units[0], live = u.lessons.filter((l: any) => a._lessonLive(l));
  for (const l of live) a.prep[l.deckKey] = 99;
  const last = live[live.length - 1].deckKey; a.prep[last] = a._deckGoal(last) - 1;
  await a.hydrateDecks([last]);
  return { unit: "white/" + u.id, last };
});

async function pressLesson(page: any, j: any, key: string) {
  const row = `[data-lesson="${key}"]`;
  await page.locator(row).evaluate((el: Element) => { (el.closest("details") as HTMLDetailsElement).open = true; });
  await page.locator(row).scrollIntoViewIfNeeded();
  await j.clickByMouse(row, "the corridor lesson");
  await expect(page.locator(`[data-mini-deck="${key}"] [data-mini-q]`), "P1-F: the lesson's card opens").toBeVisible({ timeout: 15_000 });
}

test("P1-F: a lesson finished in Practice opens its checkpoint without leaving the page", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime());
  await seed(page, 0);
  const { unit, last } = await lessonFixture(page);
  await door(page, j);
  const button = page.locator(`[data-checkpoint="${unit}"]`);
  await expect(button, "P1-F: the unit starts one lesson short").toBeDisabled();
  await pressLesson(page, j, last);
  const deck = `[data-mini-deck="${last}"]`;
  await page.locator(`${deck} [data-mini-reveal]`).scrollIntoViewIfNeeded();
  await j.clickByMouse(`${deck} [data-mini-reveal]`, "reveal the lesson's last card");
  await page.locator(`${deck} [data-mini-got]`).scrollIntoViewIfNeeded();
  await j.clickByMouse(`${deck} [data-mini-got]`, "grade the lesson's last card");
  expect(await page.evaluate((k: string) => (window as any).__neural.lessonDone(k), last), "P1-F: the grade finished the lesson").toBe(true);
  await expect(button, "P1-F: the finished lesson's checkpoint is live in place").toBeEnabled();
  await expect(button).toHaveText("Start checkpoint");
});

test("P1-E: the open card's title row never blanks the card", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime());
  await seed(page, 2); await door(page, j);
  await j.clickByMouse('[data-session-row][aria-expanded="true"]', "the card's own title row");
  await expect(page.locator('[data-mini-q]:visible'), "P1-E: the title row keeps the card").toHaveCount(1);
  await expect(page.locator('[data-session-row]:visible'), "P1-E: and its title").toHaveCount(1);
  await j.clickByMouse('[data-session-row][aria-expanded="true"] + div [data-mini-reveal]', "reveal under the same title");
  await expect(page.locator('[data-mini-a]:visible'), "P1-E: the card still answers").toHaveCount(1);
});

for (const viewport of [{ width: 390, height: 631 }, { width: 1440, height: 900 }]) test(`P1-C: finishing at ${viewport.width}×${viewport.height} puts the end card and Keep practising on screen`, async ({ page }) => {
  await page.setViewportSize(viewport);
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime());
  // Until v1.278.0: 20 answered today and one owed card, so grading that card finished the session. With the goal met,
  // Practice now deals another round by worth (U171 a: a goal, never a cap), so the day here has ONE card left of its
  // goal: the session is that card (until ANKI1 also the floor's one new card if it was a review), graded through its controls
  await seed(page, 1, 19); await door(page, j);
  await expect.poll(() => page.evaluate(() => (window as any).__neural._session?.plan?.order || null)).toBe("worth");
  const held = await page.evaluate(() => (window as any).__neural._session.plan.total);
  expect(held, "a card or two: what is left of the goal").toBeLessThanOrEqual(2);
  for (let i = 0; i < held; i++) {
    await expect(page.locator('[data-session-row][aria-expanded="true"] + div [data-mini-reveal]:visible')).toHaveCount(1, { timeout: 5_000 });
    await page.locator('[data-mini-reveal]:visible').scrollIntoViewIfNeeded();
    await j.clickByMouse('[data-session-row][aria-expanded="true"] + div [data-mini-reveal]', "reveal");
    await page.locator('[data-mini-got]:visible').scrollIntoViewIfNeeded();
    await page.evaluate(() => { (window as any).__endCard = document.querySelector('[data-session-row][aria-expanded="true"]'); });
    await j.clickByMouse('[data-session-row][aria-expanded="true"] + div [data-mini-got]', i === held - 1 ? "grade the last card" : "grade");
    if (i < held - 1) await page.waitForTimeout(700);
  }
  await expect(page.locator("[data-session-complete]")).toHaveCount(1);
  await page.locator("[data-session-complete]").evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));   // it rises in on a transform
  const view = await page.evaluate(() => {
    const list = (document.querySelector("[data-session]") as HTMLElement).parentElement as HTMLElement, box = list.getBoundingClientRect();
    const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const inside = (sel: string) => rect(sel).top >= box.top && rect(sel).bottom <= box.bottom + 1;
    return { end: inside("[data-session-complete]"), more: inside("[data-plan-more]"), kept: (window as any).__endCard.isConnected,
      gap: rect("[data-session-complete]").top - rect(".ng-practice-nav").bottom };
  });
  expect(view.kept, "P1-C: finishing never rebuilds the card").toBe(true);
  expect(view.gap, "P1-C: the end stands directly under the card").toBeLessThan(80);
  expect(view.end, "P1-C: the end card is on screen").toBe(true);
  expect(view.more, "P1-C: Keep practising is on screen").toBe(true);
  await j.clickByMouse("[data-plan-more]", "keep practising from the end card");
  await expect(page.locator("[data-session-complete]"), "P1-C: continuation reopens the session").toHaveCount(0);
});

test("P1-F: one owed card, one stripe and an unplanned visit read as plain counts", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  await page.route("**/app/gameplan.js*", async route => { await gate; await route.continue(); });
  await seed(page, 1);
  await page.evaluate(() => {
    const a = (window as any).__neural, b = a.curriculum.belts[0];
    for (const u of b.units.slice(0, Math.ceil(b.units.length / 4))) {
      a.units["white/" + u.id] = { checkpoint: true, t: 1 };
      for (const l of u.lessons) a.prep[l.deckKey] = 99;
    }
  });
  try {
    await door(page, j);
    const count = page.locator('[data-session-section="Practice"]');
    await expect(page.locator("[data-practice-section]")).toHaveText("Due reviews \u00b7 1 card");
    await expect(page.locator("[data-practice-belt]")).toHaveText("White belt \u00b7 1 stripe \u00b7 Gi");
    await expect(count, "P1-F: no plan means no claim about new work").toHaveText("1 card to review across 1 technique");
    release();
    // until v1.278.0 the landed plan read "1 card to review across 1 technique · N new across K techniques, weakest first";
    // the untouched queue now becomes the worth plan whole (U171 a), and its count line prints the plan's own figures
    await expect.poll(() => page.evaluate(() => (window as any).__neural._session?.plan?.order || null)).toBe("worth");
    const p = await page.evaluate(() => { const p = (window as any).__neural._session.plan; return { n: p.visits.length, due: p.dueCards, fresh: p.newCards }; });
    // ANKI1: new cards only when nothing is due (until then "N new, by how often they come up in your rolls and how close you are
    // to forgetting them")
    await expect(count).toHaveText(p.n + (p.n === 1 ? " position: " : " positions: ") + (p.due ? p.due + (p.due === 1 ? " card" : " cards") + " to review \u00b7 " : "") +
      (p.fresh ? p.fresh + " new, by how often they come up in your rolls" : "new cards come when nothing is due"));
  } finally { release(); }
});

test("P1-E: an answered recognition card offers Next card to the mouse", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime());
  await seed(page, 0);
  await j.rig("practice-mc-pick", Array(100).fill(.31)); await j.rig("practice-mc-shuffle", Array(100).fill(.56));
  await page.evaluate(async () => {
    const a = (window as any).__neural;
    a.settings.mcMode = "mc";
    await a.hydrateDeck("Mount|Top");
    const cards = a._cardsOf(a.flashcards.decks["Mount|Top"]).filter((c: any) => a.mcClip(c.a)).slice(0, 2);
    if (cards.length !== 2) throw Error("Need two authored recognition cards");
    a.srs = { "Mount|Top": Object.fromEntries(cards.map((c: any) => [a.qhash(c.q), [a._epochDay() - 1, 3, a._epochDay() - 3]])) };
    for (const c of cards) await a._warmMcPool(c, "Mount|Top", "practice");
  });
  await door(page, j);
  const question = await page.locator('[data-mini-q]:visible').textContent();
  await expect(page.locator('[data-practice-mc-opt]:visible')).toHaveCount(3);
  await expect(page.locator('[data-mini-reveal]:visible'), "P1-E: an unanswered card waits for a choice").toBeDisabled();
  await j.clickByMouse("[data-practice-mc-opt]", "answer the card");
  const next = page.locator('[data-mini-reveal]:visible');
  await expect(next, "P1-E: the answered card offers the next one").toHaveText("Next card");
  await expect(next).toBeEnabled();
  await j.clickByMouse('[data-session-row][aria-expanded="true"] + div [data-mini-reveal]', "Next card");
  await expect(page.locator('[data-mini-q]:visible'), "P1-E: Next card moves on").not.toHaveText(question!);
});

test("P1-F: with no planner a corridor lesson still opens, and the fallback says so", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await page.route("**/app/gameplan.js*", route => route.abort());
  await seed(page, 1);
  const { last } = await lessonFixture(page);
  await door(page, j);
  await expect.poll(() => page.evaluate(() => (window as any).__neural._gameplanLoadState)).toBe("failed");
  await pressLesson(page, j, last);
  const beats = await page.evaluate(() => (window as any).__neural.beats.filter((b: any) => b.beat === "practice_lesson_unplanned"));
  expect(beats.map((b: any) => [b.deckKey, b.planner]), "P1-F: the fallback names itself").toEqual([[last, false]]);
});

test("P1-F: the graph follows the queue beside the page, and rings it", async ({ page }) => {
  const j = journey(page); await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await j.land("Mount Top");   // a landed board: on a bare boot, advance() starts the roll that retires the session
  await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime());
  await seed(page, 2); await door(page, j);
  // §6.2: the node's measured place on the glass, through draw()'s own transform, never camTarget.
  const glass = () => page.evaluate(() => {
    const a = (window as any).__neural, s = a._session, idx = a.nodeForKey(s.keys[s.idx]), p = a.pairMid(a.nodes[idx]), k = a.W / a.cam.vw;
    return { key: s.keys[s.idx], x: a.W / 2 + (p.x - a.cam.cx) * k, y: a.H / 2 + (p.y - a.cam.cy) * k, W: a.W, H: a.H,
      edge: document.querySelector(".ng-drill")!.getBoundingClientRect().right, ringed: (a._sessionNodes || []).includes(idx) };
  });
  const beside = (g: any, what: string) => {
    expect(g.x, what + ": the open card's node sits beside the page").toBeGreaterThan(g.edge);
    expect(g.x, what + ": and on the glass").toBeLessThan(g.W);
    expect(g.y, what).toBeGreaterThan(0); expect(g.y, what).toBeLessThan(g.H);
    expect(g.ringed, what + ": the queue's rings include it").toBe(true);
  };
  await j.advance(3500);
  const first = await glass(); beside(first, "on arrival");
  await page.keyboard.press("ArrowDown");
  await j.advance(3500);
  const second = await glass();
  expect(second.key, "P1-F: ↓ moved the queue").not.toBe(first.key);
  beside(second, "after ↓");
});
