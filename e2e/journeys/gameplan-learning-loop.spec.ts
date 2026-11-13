import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

// Real mounted pane and grading. Recommendation fixtures test the consumer only:
// they are NOT production MDP or corpus evidence. No gameplay random branch used.
async function setup(page: any, recommendations = true, runtime = true, beforeOpen?: () => Promise<void>) {
  const j = journey(page);
  await j.boot("/");
  if (beforeOpen) await beforeOpen();
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
    a.setViewMode("explore"); a.openExplorer(); a.renderExplorer();
    const plan = a.planSummary();
    return { due, next, day, dueCount: a.dueCount(), newCount: plan && plan.fresh.length, newCards: plan && plan.newCards, overrun: plan && plan.overrun };
  }, { recommendations, runtime });
  return { j, fixture };
}

// PRACTICE MIXES NEW CARDS INTO A REVIEW DAY (owner U56 e, v1.242.0): two owed reviews now buy one
// new card, so with no comparison the weak-spots ranking adds a new deck and the session is not done
// until it is learned too (practice-mix.spec.ts pins that). The tests that use this are about the
// REVIEW half, so they take a comparison that offers nothing new: a real state ("partial", no rows),
// not a stub of the planner.
async function noNewMaterial(page: any) {
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a._gameplanProvider = { status: "ready", kind: "learning-opportunity", stamp: a._gameplanStamp(),
      assumptions: ["Fixture: a comparison with nothing new to add."], rows: [] };
    a.renderExplorer();
  });
}

// P1 moves the live review count to the queue details; the title stays compact.
async function dueHeader(page: any, text: string) {
  const count = text.match(/(\d+) reviews?/)![1];
  await expect(page.locator('[data-session-section="Practice"]'), "P1-F: live page debt matches the drawer")
    .toContainText(count + (count === "1" ? " card to review" : " cards to review"));
}
async function noDueHeader(page: any) {
  await expect(page.locator('[data-session-section="Practice"]')).not.toContainText("to review");
}

// WHAT IS WORTH MOST (v1.273.0, owner U171 a). The session a player with owed cards now opens is the worth plan: positions by
// how often they come up and how close each card is to forgotten, at most 6 a position, at least a fifth new. Until then the
// tests below read it as "the owed reviews, then new decks", with a count line "N cards to review across T techniques · M new
// across K techniques, <ranking>". They now read the plan the session HOLDS (the order's arithmetic is
// tests/practice_queue.test.mjs's) and walk it the way a player does.
async function worthPlan(page: any) {
  await expect.poll(() => page.evaluate(() => (window as any).__neural._session?.plan?.order || null), { message: "the worth plan lands" }).toBe("worth");
  return page.evaluate(() => { const p = (window as any).__neural._session.plan;
    return { queue: p.queue.slice(), dueCards: p.dueCards, newCards: p.newCards, total: p.total, overrun: p.overrun, positions: p.visits.length,
      due: p.due.map((r: any) => r.key), fresh: p.fresh.length, first: p.visits[0].seat } });
}
async function worthLine(page: any, plan: any) {
  const cards = (n: number) => n + (n === 1 ? " card" : " cards");
  await expect(page.locator('[data-session-section="Practice"]'), "the count line prints the plan's own figures").toHaveText(
    plan.positions + (plan.positions === 1 ? " position: " : " positions: ") + (plan.dueCards ? cards(plan.dueCards) + " to review \u00b7 " : "") +
    plan.newCards + " new, by how often they come up in your rolls and how close you are to forgetting them");
}
// answer every card the session holds, through its own controls: Reveal, then Got it (or Review again for the first, when
// `again`), the deck's next card, and the queue's own walk to the next unfinished row (`_sessionGraded`, 520 ms). ONE action
// per look at the card: a press that met a card mid-transition is simply pressed again on the next look, never awaited.
async function answerAll(page: any, touch: boolean, again = false) {
  // every lookup and press is scoped to what is VISIBLE: a deck a row closed stays in the DOM, hidden, with its own buttons
  const open = (x: string) => '[data-session-row][aria-expanded="true"] + div ' + x + ':visible';
  const shown = async (x: string) => (await page.locator(open(x)).count()) > 0;
  for (let i = 0; i < 120; i++) {
    if (await page.locator("[data-session-complete]").count()) return;
    // the card's own state: graded (a miss stays put for a re-read) → its next card; revealed → grade it; face down →
    // reveal it (`[data-mini-reveal]` is the Reveal / Hide answer toggle, present in every state)
    const grade = again ? "[data-mini-again]" : "[data-mini-got]";
    // a row whose every card is answered is left to the queue's own walk (520 ms): a press aimed at it in that window meets
    // a deck that is closing (measured: the walk hid the Reveal between the measure and the press, 2 of 3 runs)
    if (await page.evaluate(() => { const a = (window as any).__neural, s = a._session; return a._sessionRowDone(s, s.keys[s.idx]); })) { await page.waitForTimeout(400); continue; }
    await journey(page).scrollSettled('[data-session-row][aria-expanded="true"] + div');
    if (await shown("[data-mini-graded]")) await hit(page, open(".mn"), touch);
    else if (await shown(grade)) { await hit(page, open(grade), touch); again = false; }
    else if (!(await shown("[data-mini-a]")) && await shown("[data-mini-reveal]")) await hit(page, open("[data-mini-reveal]"), touch);
    await page.waitForTimeout(400);
  }
  throw new Error("the session never completed");
}

async function hit(page: any, selector: string, touch: boolean) {
  // Scroll is deliberate here because the reader chose a section. The actual
  // hit still checks the measured centre, opacity and intercepting ancestors.
  const target = page.locator(selector).first();
  const hiddenByDetails = await target.evaluate((el: Element) => {
    const d = el.closest("[data-practice-details]") as HTMLDetailsElement | null;
    return d && !d.open && d.firstElementChild !== el;
  });
  if (hiddenByDetails) await hit(page, "[data-practice-details] > summary", touch);
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

test("dashboard and opened plan share counts, target overrun and keyboard-accessible reasons", async ({ page, isMobile }) => {
  const { fixture } = await setup(page);
  await expect(page.locator('[data-explore-stats] [data-b="due"]')).toHaveAttribute("data-new", String(fixture.newCount));
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  // the Practice head repeats the cell's count and says what orders it (v1.242.0: one head, not two). Until v1.273.0 it
  // read "M new across K techniques, ranked by your study comparison" and a whole new deck overran the 7-card goal; the
  // worth plan (U171 a) deals cards, not whole decks, and orders them by how often they come up and how close to forgotten
  const plan = await worthPlan(page);
  expect(plan.fresh, "the drawer's new count is the opened plan's").toBe(fixture.newCount);
  expect(plan.newCards).toBe(fixture.newCards);
  await hit(page, "[data-practice-details] > summary", isMobile);
  await worthLine(page, plan);
  if (plan.overrun) await expect(page.locator('[data-gameplan-summary]')).toContainText(plan.overrun + (plan.overrun === 1 ? " card" : " cards") + " over the goal");
  else await expect(page.locator('[data-gameplan-summary]'), "no overrun, none claimed").not.toContainText("over the goal");
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
  // until v1.273.0: "Reviews come back on your memory schedule", the oldest-first order's reason
  await expect(reasons, "opening it shows the reasons").toContainText("Practice goes position by position, starting where it is worth most");
  // v1.248.0: the owner's plain copy (item 9) ends on what the ranking is NOT. A compaction once cut it
  // while the sentence above was the only pin, so the caveat carries its own. Mutant: drop that sentence.
  await expect(reasons, "the ranking's own caveat stays").toContainText("that is not a measure of real grappling");
  const geometry = await page.locator('[data-gameplan-summary]').evaluate((el) => {
    const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: innerWidth };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(geometry.width);
  expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(true);
});

test("capped due deck requires real reviews, one failure clears today's debt and completion emits once", async ({ page, isMobile }) => {
  const { fixture } = await setup(page, false);
  await noNewMaterial(page);
  await page.evaluate(() => {
    const a = (window as any).__neural, original = a.track.bind(a);
    (window as any).__gameplanCompleted = 0;
    a.track = (name: string, props: any) => { if (name === "neural_session_completed") (window as any).__gameplanCompleted++; original(name, props); };
  });
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await expect(page.locator('[data-session-complete]')).toHaveCount(0);
  // until v1.273.0: "2 cards to review", then "1" after a failure, then complete once the owed pile was clear; a worth
  // session (U171 a) is complete when what IT holds is answered, a failure counting as answered for today
  const plan = await worthPlan(page);
  expect(plan.total, "the session holds cards").toBeGreaterThan(1);
  // a revealed answer is not an answer
  await hit(page, '[data-mini-reveal]', isMobile);
  expect(await page.evaluate(() => (window as any).__neural.practiceToday().done), "revealing answers nothing").toBe(0);
  await hit(page, '[data-mini-again]', isMobile);
  await expect(page.locator('[data-session-complete]'), "one failure is not the whole session").toHaveCount(0);
  await answerAll(page, isMobile);
  await expect(page.locator('[data-session-complete]')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__neural.practiceToday().done), "every card it held, the failure included, answered once").toBe(plan.total);
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

test("live debt changes without reranking; missing provider remains visible through refresh", async ({ page, isMobile }) => {
  await setup(page, false);
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  // D1 (owner, 2026-09-30): the plan says what orders it. Until v1.273.0, with no comparison, "weakest spots first"; the
  // worth plan (U171 a) names its own order
  await worthPlan(page);
  await expect(page.locator('[data-gameplan-summary]')).toContainText("Positions come in order of what is worth most");
  const order = await page.locator('[data-session-row]').evaluateAll((els) => els.map((el) => el.getAttribute("data-session-row")));
  await page.evaluate(() => {
    const a = (window as any).__neural, d = a._epochDay();
    a.srs["missing content|Defender"] = { ghost: [d - 1, 3, d - 4] };
    a._onGameplanKnowledgeChanged({ reason: "merge", revision: 5 });
  });
  // until v1.273.0 the live line counted the whole owed pile ("3 cards to review"); a worth plan counts what it holds, so a
  // card that comes due after it was built is said in the polite line instead, and the rows do not move
  await expect(page.locator('[data-gameplan-current]')).toContainText("New reviews came due");
  expect(await page.locator('[data-session-row]').evaluateAll((els) => els.map((el) => el.getAttribute("data-session-row")))).toEqual(order);
  await hit(page, '[data-gameplan-refresh]', isMobile);
  await expect(page.locator('[data-gameplan-current]')).toContainText("isn't available");
  await expect(page.locator('[data-session-complete]')).toHaveCount(0);
});

test("keyboard-only review advances real cards and earns completion through the shared grade path", async ({ page, isMobile }) => {
  await setup(page, false);
  await noNewMaterial(page);
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  // until v1.273.0: two owed cards, Space/Enter twice, then no card owed at all; a worth session (U171 a) holds what is worth
  // most, so the keys walk all of it, and completion means every card it held is answered
  const plan = await worthPlan(page);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("Space");
  await expect(page.locator('[data-mini-a]')).toBeVisible();
  await page.keyboard.press("Enter");
  for (let i = 0; i < 40 && !(await page.locator('[data-session-complete]').count()); i++) {
    await page.waitForTimeout(650);
    if (await page.locator('[data-session-row][aria-expanded="true"] + div [data-mini-reveal]').count()) { await page.keyboard.press("Space"); await page.keyboard.press("Enter"); }
    else await page.keyboard.press("ArrowRight");
  }
  await expect(page.locator('[data-session-complete]')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__neural.practiceToday().done), "every card it held, by keys alone").toBe(plan.total);
});

test("post-grade callback can complete a mounted plan through shared-question credit", async ({ page, isMobile }) => {
  await setup(page, false);
  await noNewMaterial(page);
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  // until v1.273.0 the plan was the two owed Mount|Top cards, credited through Mount|Bottom, which shares them; a worth plan
  // (U171 a) holds what is worth most, so EVERY card it holds is credited, each through ANOTHER deck that shares it where
  // one does, and at least one is
  await worthPlan(page);
  const viaOther = await page.evaluate(async () => {
    const a = (window as any).__neural, p = a._session.plan, rows = p.due.concat(p.fresh);
    await a.hydrateDecks(rows.map((r: any) => r.key));
    let other = 0;
    for (const r of rows) for (const qh of r.questions) {
      const list: string[] = (a._sharedQ && a._sharedQ.get(qh)) || [r.key];
      const via = list.find((k) => k !== r.key && (a._cardsOf(a.flashcards.decks[k]) || []).some((c: any) => a.qhash(c.q) === qh)) || r.key;
      if (via !== r.key) { await a.hydrateDecks([via]); other++; }
      const card = (a._cardsOf(a.flashcards.decks[via]) || []).find((c: any) => a.qhash(c.q) === qh);
      if (!card) throw Error("no card for " + qh + " in " + via);
      a.gradeRecall(via, card, true);
    }
    // the placeholders a row still holds bind to the deck's first unanswered cards once it is loaded: answer those too
    a._paintGameplanProgress(a._session);
    for (const r of a._session.plan.due.concat(a._session.plan.fresh)) for (const qh of r.questions) {
      if (a.srs[r.key] && a.srs[r.key][qh] && a.srs[r.key][qh][2] === a._epochDay()) continue;
      const card = (a._cardsOf(a.flashcards.decks[r.key]) || []).find((c: any) => a.qhash(c.q) === qh);
      if (card) a.gradeRecall(r.key, card, true);
    }
    // The learning owner's post-transaction seam; no inline onGrade is called.
    a._onGameplanKnowledgeChanged({ reason: "grade", revision: a._knowledgeRevision });
    return other;
  });
  expect(viaOther, "at least one card is credited through another deck that shares it").toBeGreaterThan(0);
  await expect(page.locator('[data-session-complete]')).toBeVisible();
  await noDueHeader(page);
});

test("no-gi defender recommendations retain their actual role and reason", async ({ page, isMobile }) => {
  await setup(page, false);
  const key = await page.evaluate(async () => {
    const a = (window as any).__neural;
    a._giMode = "nogi"; a.srs = {}; a.prep = {};
    const key = Object.keys(a.flashcards.decks).find((k) => k.endsWith("|Defender") &&
      a._deckCardCount(a.flashcards.decks[k]) > 0 && a.rsAllowsIdx(a.nodeForKey(k)) && a.curriculum.belts.find((b: any) => b.id === a.wornBelt().id).units.some((u: any) => u.lessons.some((l: any) => l.deckKey.split("|")[0] === k.split("|")[0])));
    if (!key) throw new Error("No legal defender fixture");
    await a.hydrateDeck(key);
    a._gameplanProvider = { status: "ready", kind: "learning-opportunity", stamp: a._gameplanStamp(),
      assumptions: ["Fixture: no-gi; explicit defender exposure."], rows: [{ key, role: "Defender", status: "ready",
        headroom: .15, exposure: .2, score: .01, reason: "Remaining defense practice credit applies at the declared opportunity." }] };
    a.renderExplorer(); return key;
  });
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await expect(page.locator('[data-gameplan-reason]')).toHaveAttribute("data-gameplan-reason", key);
  // one plain sentence per card (item 9): the role is the row's own subtitle, the reason the provider's
  await expect(page.locator(`[data-session-row="${key}"]`)).toContainText("Defender");
  await expect(page.locator('[data-gameplan-reason]')).toContainText("defense practice credit");
  await expect(page.locator('[data-session-complete]')).toHaveCount(0);
});

// SIDE-R2 B1 (v1.242.0): the intent is now the drawer's OPENING — its Practice row is the one door — so
// the planner is asked for there, never at boot; a queue graded before it lands is still never replaced.
test("planner loads only on intent while eager reviews finish without queue replacement", async ({ page, isMobile }) => {
  let requests = 0, release!: () => void;
  page.on("request", (request) => { if (request.url().includes("/app/gameplan.js")) requests++; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await setup(page, false, false, async () => {
    expect(requests, "boot never asks for the planner").toBe(0);
    // Install after boot's generic routing, so that it cannot shadow this delay.
    await page.route("**/app/gameplan.js*", async (route) => { await gate; await route.continue(); });
  });
  await expect.poll(() => requests, { message: "the drawer's opening asked for it, once" }).toBe(1);
  expect(await page.locator('[data-explore-stats] [data-b="due"]').getAttribute("data-new")).toBeNull();
  try {
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await expect(page.locator('[data-gameplan-loading]')).toContainText("Loading study suggestions");
  await page.evaluate(() => { (window as any).__dueQueue = (window as any).__neural._session; });
  await hit(page, '[data-mini-reveal]', isMobile); await hit(page, '[data-mini-again]', isMobile);
  await hit(page, '[data-mini-deck] .mn', isMobile);
  await hit(page, '[data-mini-reveal]', isMobile); await hit(page, '[data-mini-got]', isMobile);
  await expect(page.locator('[data-session-complete]')).toBeVisible();
  expect(requests).toBe(1); release();
  await expect.poll(() => page.locator('[data-session-row][data-practice-kind="new"]').count(), { message: "P1-D: graded cold queue receives new work" }).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).__dueQueue === (window as any).__neural._session)).toBe(true);
  // until v1.273.0: "weakest spots first", the ranking that dealt new decks; the worth plan names its own order (U171 a)
  await expect(page.locator('[data-gameplan-summary]')).toContainText("Positions come in order of what is worth most");
  } finally { release(); }
});

// SIDE-R2 B1: the drawer's opening asks first, and the Practice press asks again when that failed, so
// both are aborted here; the retry under test is still the deliberate one, the button.
test("failed planner load keeps due cards actionable and retries on deliberate intent", async ({ page, isMobile }) => {
  let requests = 0;
  await setup(page, false, false, async () => {
    await page.route("**/app/gameplan.js*", async (route) => { if (++requests <= 2) await route.abort(); else await route.continue(); });
  });
  await expect.poll(() => requests, { message: "the drawer's opening asked, and failed" }).toBe(1);
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await expect(page.locator('[data-gameplan-loading]')).toContainText("could not load");
  // A plain read is sound HERE: the line above shows the press's own failure only after the route has
  // counted and aborted it. (The press first renders the drawer's older failure, but a 0 ms timer it
  // queues repaints that "Loading" before the press returns; with request 2 counted 300 ms late this
  // never lost, 40 of 40.)
  expect(requests, "the press asked again, and failed").toBe(2);
  await dueHeader(page, "Practice \u00b7 2 reviews");
  await expect(page.locator('[data-mini-reveal]')).toBeVisible();
  expect(await page.locator('[data-explore-stats] [data-b="due"]').getAttribute("data-new")).toBeNull();
  await page.evaluate(() => { (window as any).__retryQueue = (window as any).__neural._session; });
  expect(requests, "nothing retried on its own before the button").toBe(2);
  await hit(page, '[data-gameplan-load]', isMobile);
  // EACH LINE BELOW WAITS ON ITS OWN CLAIM (v1.262.2). They used to read `requests` straight after a
  // toBeVisible() on the Practice line, which hit() had just shown by opening its fold, so the wait
  // waited for nothing and the deploy of v1.261.1 read 2: the press's import had not reached the route
  // yet. That wait was also true only BEFORE the plan lands (until v1.273.0 landing re-rendered the fold closed; since FOLD1
  // it keeps the fold the player opened, asserted below), and
  // nothing proved the retry landed at all: with the third request aborted too, the old lines passed.
  // Control arms and mutants: docs/Changelog-Archive.md, v1.262.2.
  await expect.poll(() => requests, { message: "the retry is the deliberate one: the button asked a third time" }).toBe(3);
  // the retry lands: "Open study plan" becomes "Refresh plan", which _gameplanIntro builds only for a plan
  await expect(page.locator("[data-gameplan-refresh]"), "the retry lands: the plan is built").toHaveCount(1);
  await expect(page.locator("[data-gameplan-load], [data-gameplan-loading]"), "and the failure line is gone").toHaveCount(0);
  // and the queue it reopened, untouched, becomes the plan (SIDE-R2 B1): the same session, now planned
  expect(await page.evaluate(() => {
    const s = (window as any).__neural._session; return { same: s === (window as any).__retryQueue, plan: !!s.plan, review: !!s.review };
  }), "the reopened queue itself becomes the plan").toEqual({ same: true, plan: true, review: false });
  // until v1.273.0 the reviews led it ("Due reviews · 2 cards", the review the first row, "2 cards to review across 1
  // technique" first on the count line); the untouched queue now becomes the worth plan WHOLE (U171 a): its first row is the
  // plan's first, the open card is titled by its position, still answerable, and the count line is the plan's own
  const plan = await worthPlan(page);
  await expect(page.locator('[data-session-row][data-session-idx="0"]'), "the first row is the plan's first").toHaveAttribute("data-session-row", plan.queue[0]);
  const open = await page.evaluate(() => { const s = (window as any).__neural._session, r = s.plan.due.concat(s.plan.fresh).find((x: any) => x.key === s.keys[s.idx]);
    return (r.seat ? r.seat.replace("|", " \u00b7 ") : "Other cards") + " \u00b7 position " + (r.visit + 1) + " of " + s.plan.visits.length });
  await expect(page.locator("[data-practice-section]"), "the open card is titled by its position").toHaveText(open);
  await expect(page.locator('[data-mini-reveal]')).toBeVisible();
  // FOLD1 (v1.273.0): the player opened "Practice details & session queue" to press "Open study plan"; the plan's arrival
  // re-rendered the queue, and the fold is still open (until then it snapped shut, and this step had to open it again)
  await expect(page.locator("[data-practice-details]"), "FOLD1: the fold the player opened is still open").toHaveAttribute("open", "");
  await worthLine(page, plan);
});

// D1 (owner, 2026-09-30): "when no study comparison exists, fall back to the weak-spots ranking so
// every player, a new one included, always has a plan". A player with nothing due and no comparison
// opens a plan whose new rows are dealt from the app's OWN weak-spots ranking, in its order.
// Mutant, recorded 2026-09-30: dropping the fallback in ngGameplanBuild leaves the new rows absent
// and turns this red at its first assertion.
test("D1: a new player with no comparison still gets a plan, dealt from the weak-spots ranking", async ({ page, isMobile }) => {
  await setup(page, false);
  await page.evaluate(() => {
    const a = (window as any).__neural; a.srs = {}; a.prep = {}; a.settings.dailyGoal = 30;
    const rank = a._gameplanWeakFallback.bind(a);
    (window as any).__rankInputs = [];
    a._gameplanWeakFallback = () => { const r = rank(); (window as any).__rankInputs.push(r.rows.map((x: any) => x.key)); return r; };
    a.renderExplorer();
  });
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  await expect(page.locator('[data-session-section="Practice"]')).toContainText("weakest first");
  await expect(page.locator('[data-gameplan-summary]')).toContainText("weakest spots first");
  // item 9's caveat on the path every first session takes: Practice asks for no comparison
  await expect(page.locator('[data-gameplan-summary]'), "the ranking's own game caveat stays").toContainText("These are game effects; they don't measure improvement on the mat.");
  const got = await page.evaluate(() => {
    const a = (window as any).__neural, s = a._session;
    return { status: s.plan.status, comparison: s.plan.comparison, fresh: s.plan.fresh.map((r: any) => r.key),
      rankings: (window as any).__rankInputs as string[][], cell: document.querySelector('[data-explore-stats] [data-b="due"]')?.getAttribute("data-new") };
  });
  expect(got.status).toBe("weak-spots");
  expect(got.fresh.length, "a new player is dealt new techniques").toBeGreaterThan(0);
  // the plan's order IS the ranking's order: each dealt key appears later in the ranking than the last
  const ranking = got.rankings.find((keys) => got.fresh.every((k: string) => keys.includes(k)));
  expect(ranking, "P1-D: frozen queue uses an actual ranking received at deal time").toBeTruthy();
  const at = got.fresh.map((k: string) => ranking!.indexOf(k));
  expect(at.every((i) => i >= 0), "every dealt key comes from the weak-spots ranking").toBe(true);
  expect(at.every((i, n) => !n || i > at[n - 1]), "in the ranking's order").toBe(true);
  expect(got.cell, "the Explore cell counts the same plan").toBe(String(got.fresh.length));
  await expect(page.locator(`[data-gameplan-reason="${got.fresh[0]}"]`), "one plain sentence from the ranking's tier")
    .toHaveText(/^(One of the biggest leaks in your game right now\.|A loose spot in your game, worth tightening\.|Worth polishing once the bigger leaks are closed\.|You.+\.)$/);
});

// P1 deliberately replaces the old completion gate: more work belongs to the same visit.
test("P1-C: completion celebrates the real ledger and continuation appends to the same session", async ({ page, isMobile }) => {
  await setup(page, false);
  await page.evaluate(() => { const a = (window as any).__neural; a.settings.dailyGoal = 5; a.renderExplorer(); });
  await hit(page, '[data-explore-stats] [data-b="due"]', isMobile);
  const before = await page.evaluate(() => {
    const a = (window as any).__neural, s = a._session;
    (window as any).__originalSession = s;
    return { keys: s.keys.length, total: s.plan.total, more: s.plan.more.length };
  });
  expect(before.more, "P1-C: continuation fixture has eligible work").toBeGreaterThan(0);
  await expect(page.locator('[data-plan-more]'), "P1-C: no completion gate").toBeEnabled();
  await expect(page.locator('[data-plan-goal-progress]')).toHaveText("Reviewed 0/" + before.total);
  await page.evaluate(async () => {
    const a = (window as any).__neural, s = a._session;
    await a.hydrateDecks(s.keys); a._gameplanProgress(s);
    for (const row of s.plan.due.concat(s.plan.fresh)) {
      const want = new Set(row.questions);
      for (const c of a._cardsOf(a.flashcards.decks[row.key]).filter((c: any) => want.has(a.qhash(c.q)))) a.gradeRecall(row.key, c, true);
    }
    a._onGameplanKnowledgeChanged({ reason: "grade", revision: a._knowledgeRevision });
  });
  await expect(page.locator('[data-session-done-title]')).toHaveText("Session complete");
  await expect(page.locator('[data-session-complete]'), "P1-C: the end card states the real ledger").toContainText("You reviewed " + before.total + " of " + before.total + " cards today.");
  await expect(page.locator('[data-plan-goal-progress]')).toHaveText("Reviewed " + before.total + "/" + before.total);
  await noDueHeader(page);
  await hit(page, '[data-plan-more]', isMobile);
  expect(await page.evaluate(() => (window as any).__originalSession === (window as any).__neural._session), "P1-C: same session after continuation").toBe(true);
  await expect.poll(() => page.locator('[data-session-row]').count()).toBeGreaterThan(before.keys);
  await expect(page.locator('[data-mini-q]:visible')).toHaveCount(1);
  await expect(page.locator('[data-session-complete]')).toHaveCount(0);
});

test("P1-B: White can study an advanced deck (its section was locked until U163 c, v1.270.0; the study never was)", async ({ page }) => {
  const { j } = await setup(page, false);
  const key = await page.evaluate(() => {
    const a = (window as any).__neural;
    a.belts = { held: { id: "white", t: 1 }, gf: 1, won: {} };
    const lesson = a.curriculum.belts.find((b: any) => b.id === "black").units.flatMap((u: any) => u.lessons).find((l: any) => a._lessonLive(l));
    a.setDeckOpen(false); return lesson.deckKey;
  });
  await j.land(key.replace("|", " "));
  await page.evaluate((k: string) => (window as any).__neural.openStudy(k), key);
  await expect.poll(() => page.evaluate((k: string) => {
    const a = (window as any).__neural, e = a.drillEntries && a.drillEntries[0];
    return !!(a.isDrillOpen() && e && e.info.key === k && e.cards && e.cards.length);
  }, key), { message: "P1-B: advanced gameplay study is open", timeout: 15_000 }).toBe(true);
});
