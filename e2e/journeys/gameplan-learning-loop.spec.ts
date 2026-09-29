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
    return { due, next, day, dueCount: a.dueCount(), newCount: plan && plan.fresh.length, newCards: plan && plan.newCards };
  }, { recommendations, runtime });
  return { j, fixture };
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
  await expect(page.locator('[data-gameplan-summary]')).toContainText(fixture.newCount + " suggested decks");
  await expect(page.locator('[data-gameplan-summary]')).toContainText("exceed it by");
  await expect(page.locator('[data-gameplan-current]')).toContainText("2 cards due now");
  const summary = page.locator('[data-gameplan-summary] summary');
  await summary.focus(); await page.keyboard.press("Enter");
  await expect(page.locator('[data-gameplan-summary] details')).toHaveAttribute("open", "");
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
  await expect(page.locator('[data-gameplan-current]')).toContainText("2 cards due now");
  await hit(page, '[data-mini-reveal]', isMobile);
  await hit(page, '[data-mini-again]', isMobile);
  await expect(page.locator('[data-gameplan-current]')).toContainText("1 cards due now");
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
  await expect(page.locator('[data-gameplan-summary]')).toContainText("recommendations unavailable");
  const order = await page.locator('[data-session-row]').evaluateAll((els) => els.map((el) => el.getAttribute("data-session-row")));
  await page.evaluate(() => {
    const a = (window as any).__neural, d = a._epochDay();
    a.srs["missing content|Defender"] = { ghost: [d - 1, 3, d - 4] };
    a._onGameplanKnowledgeChanged({ reason: "merge", revision: 5 });
  });
  await expect(page.locator('[data-gameplan-current]')).toContainText("3 cards due now");
  expect(await page.locator('[data-session-row]').evaluateAll((els) => els.map((el) => el.getAttribute("data-session-row")))).toEqual(order);
  await hit(page, '[data-gameplan-refresh]', isMobile);
  await expect(page.locator('[data-gameplan-current]')).toContainText("unavailable content");
  await expect(page.locator('[data-session-complete]')).toHaveCount(0);
});

test("keyboard-only review advances real cards and earns completion through the shared grade path @curated", async ({ page, isMobile }) => {
  await setup(page, false);
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("Space");
  await expect(page.locator('[data-mini-a]')).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-gameplan-current]')).toContainText("1 cards due now");
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
  await expect(page.locator('[data-gameplan-current]')).toContainText("0 cards due now");
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
  await expect(page.locator('[data-gameplan-reason]')).toContainText("Defender");
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
  await expect(page.locator('[data-gameplan-summary]')).toContainText("recommendations unavailable");
  } finally { release(); }
});

test("failed planner load keeps due cards actionable and retries on deliberate intent @curated", async ({ page, isMobile }) => {
  let requests = 0;
  await setup(page, false, false);
  await page.route("**/app/gameplan.js*", async (route) => { if (++requests === 1) await route.abort(); else await route.continue(); });
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await expect(page.locator('[data-gameplan-loading]')).toContainText("could not load");
  await expect(page.locator('[data-gameplan-current]')).toContainText("2 cards due now");
  await expect(page.locator('[data-mini-reveal]')).toBeVisible();
  expect(await page.locator('[data-explore-stats] [data-b="new"]').getAttribute("data-new")).toBeNull();
  await hit(page, '[data-gameplan-load]', isMobile);
  await expect(page.locator('[data-gameplan-loading]')).toContainText("suggestions are ready");
  expect(requests).toBe(2);
  await expect(page.locator('[data-gameplan-current]')).toContainText("2 cards due now");
});
