import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

// Real mounted pane and grading. Recommendation fixtures test the consumer only:
// they are NOT production MDP or corpus evidence. No gameplay random branch used.
async function setup(page: any, recommendations = true, runtime = true) {
  const j = journey(page);
  await j.boot("/");
  const fixture = await page.evaluate(async ({ recommendations, runtime }: { recommendations: boolean, runtime: boolean }) => {
    const a = (window as any).__neural;
    if (runtime && !await a._ensureGameplanRuntime()) throw Error("Study runtime did not load");
    a.setPaused(true);
    const due = "Mount|Top", next = "Side Control|Top";
    await a.hydrateDecks([due, "Mount|Bottom", next]);
    a.srs = {}; a.prep = {}; a.stage = {}; a.rec = {}; a.cardDone = new Set(); a._miniGraded = new Set();
    const cards = a._cardsOf(a.flashcards.decks[due]);
    const day = a._epochDay();
    a.prep[due] = 5; // old lesson credit used to cause false completion
    a.srs[due] = Object.fromEntries(cards.slice(0, 2).map((c: any) => [a.qhash(c.q), [day - 1, 3, day - 4]]));
    a.settings.dailyGoal = recommendations ? 7 : 2;
    a._gameplanProvider = recommendations ? { status: "ready", kind: "learning-opportunity", stamp: a._gameplanStamp(),
      assumptions: ["Fixture: one declared Top start; gi; reoptimized model study scenario."],
      rows: [{ key: next, role: "Top", status: "ready", headroom: .15, exposure: .5, score: .03,
        reason: "Top practice credit has headroom at a modeled opportunity." }] } : null;
    a.setViewMode("explore"); a.openExplorer(); a.renderPaneAnchor();
    const plan = a.planSummary();
    return { due, next, day, dueCount: a.dueCount(), newCount: plan && plan.fresh.length, newCards: plan && plan.newCards, overrun: plan && plan.overrun };
  }, { recommendations, runtime });
  return { j, fixture };
}

// D2 (owner, 2026-09-30): the live due count is the pane HEADER ("N cards due today"); the polite
// `[data-gameplan-current]` line now carries only what the player must act on (a new day, new
// reviews, missing content). Read the header the app rendered, never a recomputed count.
async function dueHeader(page: any, text: string) {
  await expect.poll(() => page.evaluate(() => (window as any).__neural.drillHeadRef.current.innerText as string),
    { message: "the header reads " + text }).toContain(text);
}

async function hit(page: any, selector: string, touch: boolean) {
  // Scroll is deliberate here because the reader chose a section. The actual
  // hit still checks the measured centre, opacity and intercepting ancestors.
  const target = page.locator(selector).first();
  await expect(target).toBeVisible({ timeout: 10_000 });
  await target.scrollIntoViewIfNeeded();
  const point = await target.evaluate((el: HTMLElement) => {
    const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const top = document.elementFromPoint(x, y);
    let visible = true;
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
      const s = getComputedStyle(node); if (s.visibility === "hidden" || Number(s.opacity) === 0) visible = false;
    }
    return { x, y, visible, reachable: top === el || !!(top && el.contains(top)), height: r.height };
  });
  expect(point.visible).toBe(true); expect(point.reachable).toBe(true);
  if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
}

test("dashboard and opened plan share counts, target overrun and keyboard-accessible reasons @curated", async ({ page, isMobile }) => {
  const { fixture } = await setup(page);
  await expect(page.locator('[data-explore-stats] [data-b="new"]')).toHaveAttribute("data-new", String(fixture.newCount));
  await hit(page, '[data-explore-stats] [data-b="new"]', isMobile);
  // the plan's own section note repeats the cell's count, and says what ranked it
  await expect(page.locator('[data-session-section="Learn next"]')).toContainText(fixture.newCards + " new card");
  await expect(page.locator('[data-session-section="Learn next"]')).toContainText("across " + fixture.newCount + " technique");
  await expect(page.locator('[data-session-section="Learn next"]')).toContainText("ranked by your study comparison");
  expect(fixture.overrun, "the fixture's whole deck overruns the 7-card goal").toBeGreaterThan(0);
  await expect(page.locator('[data-gameplan-summary]')).toContainText(fixture.overrun + (fixture.overrun === 1 ? " card" : " cards") + " over the goal");
  await dueHeader(page, "2 cards due today");
  // The summary box holds TWO folds: "Why these decks?" (this test's keyboard-accessible
  // reasons) and the study panel's "Study comparison coverage" (_gameStudyPanel). A bare
  // `summary` / `details` selector matches both, so scope to the reasons fold by its own text
  // and assert it is there exactly once (CLAUDE.md §6.7).
  const reasons = page.locator('[data-gameplan-summary] details', { has: page.locator("summary", { hasText: /^Why these decks\?$/ }) });
  await expect(reasons, "exactly one reasons fold").toHaveCount(1);
  await expect(reasons).not.toHaveAttribute("open", "");
  const summary = reasons.locator("summary");
  await summary.focus(); await page.keyboard.press("Enter");
  await expect(reasons).toHaveAttribute("open", "");
  await expect(reasons, "opening it shows the reasons").toContainText("Reviews come back on your memory schedule");
  const geometry = await page.locator('[data-gameplan-summary]').evaluate((el) => {
    const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: innerWidth };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(geometry.width);
  expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(true);
});

test("capped due deck requires real reviews, one failure clears today's debt and completion emits once @curated", async ({ page, isMobile }) => {
  const { fixture } = await setup(page, false);
  await page.evaluate(() => {
    const a = (window as any).__neural, original = a.track.bind(a);
    (window as any).__gameplanCompleted = 0;
    a.track = (name: string, props: any) => { if (name === "neural_session_completed") (window as any).__gameplanCompleted++; original(name, props); };
  });
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await expect(page.locator('[data-session-complete]')).toHaveCount(0);
  await dueHeader(page, "2 cards due today");
  await hit(page, '[data-mini-reveal]', isMobile);
  await hit(page, '[data-mini-again]', isMobile);
  await dueHeader(page, "1 card due today");
  await hit(page, '[data-mini-deck] .mn', isMobile);
  await hit(page, '[data-mini-reveal]', isMobile);
  await hit(page, '[data-mini-got]', isMobile);
  await expect(page.locator('[data-session-complete]')).toBeVisible();
  await page.evaluate(() => { const a = (window as any).__neural; a.renderSession(); a.renderSession(); });
  expect(await page.evaluate(() => (window as any).__gameplanCompleted)).toBe(1);
  // A long-lived completed pane must stop claiming completion when tomorrow arrives.
  await page.evaluate((day: number) => {
    (window as any).__NG_EPOCH_DAY__ = day + 1;
    (window as any).__neural._refreshGameplanUI();
  }, fixture.day);
  await expect(page.locator('[data-session-complete]')).toHaveCount(0);
  await expect(page.locator('[data-gameplan-current]')).toContainText("A new day");
});

test("live debt changes without reranking; missing provider remains visible through refresh @curated", async ({ page, isMobile }) => {
  await setup(page, false);
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  // D1 (owner, 2026-09-30): with no comparison the plan is ranked by weak spots, and says so
  await expect(page.locator('[data-gameplan-summary]')).toContainText("weakest spots first");
  const order = await page.locator('[data-session-row]').evaluateAll((els) => els.map((el) => el.getAttribute("data-session-row")));
  await page.evaluate(() => {
    const a = (window as any).__neural, d = a._epochDay();
    a.srs["missing content|Defender"] = { ghost: [d - 1, 3, d - 4] };
    a._onGameplanKnowledgeChanged({ reason: "merge", revision: 5 });
  });
  await dueHeader(page, "3 cards due today");
  expect(await page.locator('[data-session-row]').evaluateAll((els) => els.map((el) => el.getAttribute("data-session-row")))).toEqual(order);
  await hit(page, '[data-gameplan-refresh]', isMobile);
  await expect(page.locator('[data-gameplan-current]')).toContainText("isn't available");
  await expect(page.locator('[data-session-complete]')).toHaveCount(0);
});

test("keyboard-only review advances real cards and earns completion through the shared grade path @curated", async ({ page, isMobile }) => {
  await setup(page, false);
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("Space");
  await expect(page.locator('[data-mini-a]')).toBeVisible();
  await page.keyboard.press("Enter");
  await dueHeader(page, "1 card due today");
  await page.keyboard.press("Space"); await page.keyboard.press("Enter");
  await expect(page.locator('[data-session-complete]')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__neural.dueCount())).toBe(0);
});

test("post-grade callback can complete a mounted plan through shared-question credit @curated", async ({ page, isMobile }) => {
  await setup(page, false);
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await page.evaluate(() => {
    const a = (window as any).__neural, questions = new Set(a._session.plan.dueQuestions);
    const cards = a._cardsOf(a.flashcards.decks["Mount|Bottom"]).filter((c: any) => questions.has(a.qhash(c.q)));
    if (cards.length !== questions.size) throw Error("Shared role fixture no longer covers debt");
    for (const card of cards) a.gradeRecall("Mount|Bottom", card, true);
    // The learning owner's post-transaction seam; no inline onGrade is called.
    a._onGameplanKnowledgeChanged({ reason: "grade", revision: a._knowledgeRevision });
  });
  await expect(page.locator('[data-session-complete]')).toBeVisible();
  await dueHeader(page, "No cards due today");
});

test("no-gi defender recommendations retain their actual role and reason @curated", async ({ page, isMobile }) => {
  await setup(page, false);
  const key = await page.evaluate(async () => {
    const a = (window as any).__neural;
    a._giMode = "nogi"; a.srs = {}; a.prep = {};
    const key = Object.keys(a.flashcards.decks).find((k) => k.endsWith("|Defender") &&
      a._deckCardCount(a.flashcards.decks[k]) > 0 && a.rsAllowsIdx(a.nodeForKey(k)));
    if (!key) throw new Error("No legal defender fixture");
    await a.hydrateDeck(key);
    a._gameplanProvider = { status: "ready", kind: "learning-opportunity", stamp: a._gameplanStamp(),
      assumptions: ["Fixture: no-gi; explicit defender exposure."], rows: [{ key, role: "Defender", status: "ready",
        headroom: .15, exposure: .2, score: .01, reason: "Remaining defense practice credit applies at the declared opportunity." }] };
    a.renderPaneAnchor(); return key;
  });
  await hit(page, '[data-explore-stats] [data-b="new"]', isMobile);
  await expect(page.locator('[data-gameplan-reason]')).toHaveAttribute("data-gameplan-reason", key);
  // one plain sentence per card (item 9): the role is the row's own subtitle, the reason the provider's
  await expect(page.locator(`[data-session-row="${key}"]`)).toContainText("Defender");
  await expect(page.locator('[data-gameplan-reason]')).toContainText("defense practice credit");
  await expect(page.locator('[data-session-complete]')).toHaveCount(0);
});

test("planner loads only on intent while eager reviews finish without queue replacement @curated", async ({ page, isMobile }) => {
  let requests = 0, release!: () => void;
  page.on("request", (request) => { if (request.url().includes("/app/gameplan.js")) requests++; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await setup(page, false, false);
  // Install after boot's generic routing, so that it cannot shadow this delay.
  await page.route("**/app/gameplan.js*", async (route) => { await gate; await route.continue(); });
  expect(requests).toBe(0);
  expect(await page.locator('[data-explore-stats] [data-b="new"]').getAttribute("data-new")).toBeNull();
  try {
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await expect(page.locator('[data-gameplan-loading]')).toContainText("Loading study suggestions");
  await page.evaluate(() => { (window as any).__dueQueue = (window as any).__neural._session; });
  await hit(page, '[data-mini-reveal]', isMobile); await hit(page, '[data-mini-again]', isMobile);
  await hit(page, '[data-mini-deck] .mn', isMobile);
  await hit(page, '[data-mini-reveal]', isMobile); await hit(page, '[data-mini-got]', isMobile);
  await expect(page.locator('[data-session-complete]')).toBeVisible();
  expect(requests).toBe(1); release();
  await expect(page.locator('[data-gameplan-loading]')).toContainText("suggestions are ready");
  expect(await page.evaluate(() => (window as any).__dueQueue === (window as any).__neural._session)).toBe(true);
  await hit(page, '[data-gameplan-load]', isMobile);
  await expect(page.locator('[data-gameplan-summary]')).toContainText("weakest spots first");
  } finally { release(); }
});

test("failed planner load keeps due cards actionable and retries on deliberate intent @curated", async ({ page, isMobile }) => {
  let requests = 0;
  await setup(page, false, false);
  await page.route("**/app/gameplan.js*", async (route) => { if (++requests === 1) await route.abort(); else await route.continue(); });
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await expect(page.locator('[data-gameplan-loading]')).toContainText("could not load");
  await dueHeader(page, "2 cards due today");
  await expect(page.locator('[data-mini-reveal]')).toBeVisible();
  expect(await page.locator('[data-explore-stats] [data-b="new"]').getAttribute("data-new")).toBeNull();
  await hit(page, '[data-gameplan-load]', isMobile);
  await expect(page.locator('[data-gameplan-loading]')).toContainText("suggestions are ready");
  expect(requests).toBe(2);
  await dueHeader(page, "2 cards due today");
});

// D1 (owner, 2026-09-30): "when no study comparison exists, fall back to the weak-spots ranking so
// every player, a new one included, always has a plan". A player with nothing due and no comparison
// opens a plan whose "Learn next" is dealt from the app's OWN weak-spots ranking, in its order.
// Mutant, recorded 2026-09-30: dropping the fallback in ngGameplanBuild leaves "Learn next" absent
// and turns this red at its first assertion.
test("D1: a new player with no comparison still gets a plan, dealt from the weak-spots ranking @curated", async ({ page, isMobile }) => {
  await setup(page, false);
  await page.evaluate(() => { const a = (window as any).__neural; a.srs = {}; a.prep = {}; a.settings.dailyGoal = 30; a.renderPaneAnchor(); });
  await hit(page, '[data-explore-stats] [data-b="new"]', isMobile);
  await expect(page.locator('[data-session-section="Learn next"]')).toContainText("weakest first");
  await expect(page.locator('[data-gameplan-summary]')).toContainText("weakest spots first");
  const got = await page.evaluate(() => {
    const a = (window as any).__neural, s = a._session;
    return { status: s.plan.status, comparison: s.plan.comparison, fresh: s.plan.fresh.map((r: any) => r.key),
      ranking: a.weakSpots().keys as string[], cell: document.querySelector('[data-explore-stats] [data-b="new"]')?.getAttribute("data-new") };
  });
  expect(got.status).toBe("weak-spots");
  expect(got.fresh.length, "a new player is dealt new techniques").toBeGreaterThan(0);
  // the plan's order IS the ranking's order: each dealt key appears later in the ranking than the last
  const at = got.fresh.map((k) => got.ranking.indexOf(k));
  expect(at.every((i) => i >= 0), "every dealt key comes from the weak-spots ranking").toBe(true);
  expect(at.every((i, n) => !n || i > at[n - 1]), "in the ranking's order").toBe(true);
  expect(got.cell, "the Explore cell counts the same plan").toBe(String(got.fresh.length));
  await expect(page.locator(`[data-gameplan-reason="${got.fresh[0]}"]`), "one plain sentence from the ranking's tier")
    .toHaveText(/^(One of the biggest leaks in your game right now\.|A loose spot in your game, worth tightening\.|Worth polishing once the bigger leaks are closed\.|You.+\.)$/);
});

// D2 (owner, 2026-09-30): the session list (due reviews plus the new-card budget) is headed "Finish
// these to unlock more" with its progress; the extra practice below it is LOCKED until that list is
// done, then shows as unlocked. The gate is the plan's extra list only: the same deck still opens as
// a study elsewhere. Every figure is read off the app's own session, never recomputed here.
// Mutants, recorded 2026-09-30: rendering the extra rows while locked (limit = s.shown) turns this red
// at the row count; never latching `s.unlocked` turns it red at "Unlocked"; dropping the unlock
// re-render in _paintGameplanProgress turns it red after the grades land.
test("D2: the plan's extra practice unlocks only when the session is finished @curated", async ({ page, isMobile }) => {
  await setup(page, false);
  await page.evaluate(() => { const a = (window as any).__neural; a.settings.dailyGoal = 5; a.renderPaneAnchor(); });
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  const s0 = await page.evaluate(() => {
    const s = (window as any).__neural._session;
    return { required: s.required, keys: s.keys.length, total: s.plan.total, locked: s.keys[s.required] };
  });
  const extra = s0.keys - s0.required;
  expect(s0.required, "the session holds the due deck and new work").toBeGreaterThan(1);
  expect(extra, "and there is extra practice to lock").toBeGreaterThan(0);
  const more = (n: number) => n.toLocaleString("en-US") + " more " + (n === 1 ? "technique" : "techniques");
  await expect(page.locator('[data-plan-goal-title]')).toHaveText("Finish these to unlock more");
  await expect(page.locator('[data-plan-goal-progress]')).toHaveText("0 of " + s0.total + " cards done");
  await expect(page.locator('[data-plan-locked]')).toHaveText(more(extra) + " unlock when you finish");
  await expect(page.locator('[data-session-row]'), "locked rows are not dealt").toHaveCount(s0.required);
  await expect(page.locator('[data-plan-unlocked]')).toHaveCount(0);
  await expect(page.locator('[data-session-more]'), "no paging while locked").toHaveCount(0);
  await dueHeader(page, "2 cards due today");
  // Finish the session through the shared grade path (every planned question, once).
  await page.evaluate(async () => {
    const a = (window as any).__neural, s = a._session;
    await a.hydrateDecks(s.keys.slice(0, s.required));
    a._gameplanProgress(s);
    for (const row of s.plan.due.concat(s.plan.fresh)) {
      const want = new Set(row.questions);
      for (const card of a._cardsOf(a.flashcards.decks[row.key]).filter((c: any) => want.has(a.qhash(c.q)))) a.gradeRecall(row.key, card, true);
    }
    a._onGameplanKnowledgeChanged({ reason: "grade", revision: a._knowledgeRevision });
  });
  await expect(page.locator('[data-plan-unlocked]')).toHaveText("Unlocked: " + more(extra));
  await expect(page.locator('[data-plan-locked]')).toHaveCount(0);
  await expect(page.locator('[data-plan-goal-title]')).toHaveText("Today's session is done");
  await expect(page.locator('[data-plan-goal-progress]')).toHaveText(s0.total + " of " + s0.total + " cards done");
  await expect(page.locator('[data-session-complete]')).toContainText("More practice is unlocked below");
  await expect(page.locator('[data-session-row]'), "the first page of extra rows is dealt").toHaveCount(Math.min(s0.keys, s0.required + 10));
  await dueHeader(page, "No cards due today");
  // an unlocked row answers the real mouse (or finger) and opens its deck
  await hit(page, `[data-session-row][data-session-idx="${s0.required}"]`, isMobile);
  await expect(page.locator(`[data-mini-deck="${s0.locked}"]`)).toBeVisible();
  // the unlock is earned once: a new day does not re-lock this plan
  await page.evaluate((day: number) => { (window as any).__NG_EPOCH_DAY__ = day + 1; (window as any).__neural._refreshGameplanUI(); }, await page.evaluate(() => (window as any).__neural._epochDay()));
  await expect(page.locator('[data-gameplan-current]')).toContainText("A new day");
  await expect(page.locator('[data-plan-unlocked]')).toHaveCount(1);
});

test("D2: the lock is the plan's extra list only; a locked deck still opens as a study @curated", async ({ page, isMobile }) => {
  await setup(page, false);
  await page.evaluate(() => { const a = (window as any).__neural; a.settings.dailyGoal = 5; a.renderPaneAnchor(); });
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await expect(page.locator('[data-plan-locked]')).toBeVisible();
  const key = await page.evaluate(() => { const s = (window as any).__neural._session; return s.keys[s.required] as string; });
  await page.evaluate((k: string) => (window as any).__neural.studyFromSession(k), key);
  await expect.poll(() => page.evaluate((k: string) => {
    const a = (window as any).__neural, e = a.drillEntries && a.drillEntries[0];
    return !!(a.isDrillOpen() && e && e.info.key === k && e.cards && e.cards.length);
  }, key), { timeout: 15_000 }).toBe(true);
});
