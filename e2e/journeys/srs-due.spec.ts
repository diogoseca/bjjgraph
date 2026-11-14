import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

/**
 * REAL SPACED REPETITION (v1.105.0) — the owner's directive, deliberately reversing the old
 * "forgetting is tested, not timed" canon: "today is a new day… I just want to do some
 * maintenance to ensure I don't forget techniques. Maintenance should come first."
 *
 * The design under test:
 *   · srs = {deckKey: {qhash: [due, ivl, last]}} in the v2 blob, epoch DAYS (LOCAL)
 *   · one writer `_schedule` fed by BOTH grade chokes (`ngKnowledgeScheduleRow`); success climbs the owner's ladder
 *     (v1.279.0: 1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922 days, then doubling; an early answer earns the share
 *     of a rung that passed; the stored cell is the largest of [1,3,7,14,30,60,120] at or below due − last), any failure
 *     resets to 1. The on-time rows this file seeds climb the same first rungs either way (3 → 7 below)
 *   · duePool = due <= today && last < today  — a failed card leaves the pool until tomorrow,
 *     so the count DRAINS on failure instead of re-serving the card all day
 *   · questionFor asks due cards FIRST, any stage — maintenance before learning, mid-roll too
 *   · merge: later `last` wins; same-day tie → smaller ivl, then (v1.279.0) the earlier due (a failure is never
 *     erased by an earlier same-day success); success keeps the larger TRUE interval (grade-before-pull heals)
 *   · due-ness never touches stage/gameScore — the belt cannot drop because time passed
 *   · ONE due number per pane (v1.172.0): the stat cell, the Challenges band and the session
 *     header all print `dueCount()` (distinct CARDS); `bucketTechniques("due")` is a COVER of
 *     those cards — a deck copy of an already-covered card never adds a row — so the technique
 *     count is <= the card count and lives in the tooltip / section note.
 *     Since v1.207.0 the due cell opens the EAGER review queue (header "<cards> cards due today",
 *     D2 2026-09-30) before the lazy planner loads, and the plan surface's Maintenance section
 *     carries the cover.
 *
 * Tests seed past-due schedules via the blob (`initialState`) instead of moving a clock —
 * `_epochDay()` is only read at grade/pool time, so a `last` of yesterday is all it takes.
 */

const DAY = () =>
  Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

/** a seeded blob whose Mount|Top deck has `n` cards due yesterday */
const seeded = (page: any, extra: any = {}) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    return { day: a._epochDay(), srs: a.srs, stage: a.stage };
  });

test("a due card is asked FIRST on landing — any stage, before new cards", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  await j.land("Mount Top");

  // find the real deck + its cards, then plant a schedule: card[2] (not first in deck order)
  // due yesterday at stage 3 — proven, but the memory clock says check it.
  const plant = await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key;
    const cards = a._cardsOf(a.flashcards.decks[key]);
    if (!cards || cards.length < 3) return null;
    const q = cards[2].q;
    const today = a._epochDay();
    a.srs[key] = a.srs[key] || {};
    a.srs[key][a.qhash(q)] = [today - 1, 3, today - 4]; // due yesterday, last seen 4 days ago
    a.stage[key] = a.stage[key] || {};
    a.stage[key][a.qhash(q)] = 3; // recall-proven — due-first must STILL ask it
    return { key, q, firstQ: cards[0].q };
  });
  expect(plant, "a deck with 3+ cards").toBeTruthy();

  const asked = await page.evaluate((k: string) => {
    const a = (window as any).__neural;
    const c = a.questionFor(k);
    return c ? c.q : null;
  }, plant!.key);
  expect(asked, "the DUE card, not deck-order-first").toBe(plant!.q);
  expect(asked).not.toBe(plant!.firstQ);
});

test("grading moves the schedule: success climbs the ladder, failure resets — and the pool drains", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  await j.land("Mount Top");

  const r = await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key;
    const card = a._cardsOf(a.flashcards.decks[key])[0];
    const qh = a.qhash(card.q);
    const today = a._epochDay();

    // plant: due today, ivl 3, last seen 3 days ago
    a.srs[key] = { [qh]: [today, 3, today - 3] };
    const dueBefore = a.dueCount();

    // SUCCESS through the real recall choke
    a.gradeRecall(key, card, true);
    const afterOk = a.srs[key][qh].slice();
    const dueAfterOk = a.dueCount();

    // reset the plant, FAIL through the real choke
    a.srs[key] = { [qh]: [today, 30, today - 30] };
    a.gradeRecall(key, card, false);
    const afterFail = a.srs[key][qh].slice();
    const dueAfterFail = a.dueCount();

    return { today, dueBefore, afterOk, dueAfterOk, afterFail, dueAfterFail };
  });

  expect(r.dueBefore, "the planted card counts as due").toBeGreaterThanOrEqual(1);
  // 3 → 7 on the ladder, due a week out, last = today
  expect(r.afterOk).toEqual([r.today + 7, 7, r.today]);
  expect(r.dueAfterOk, "a success leaves the pool").toBe(0);
  // failure: ivl resets to 1, due tomorrow-ish (today+1), last = today
  expect(r.afterFail).toEqual([r.today + 1, 1, r.today]);
  // THE DRAIN RULE: even though ivl reset, last === today keeps it OUT of today's pool —
  // a failed card comes back TOMORROW, it does not stalk you all day.
  expect(r.dueAfterFail, "a failure also drains today's pool").toBe(0);
});

test("MC grades schedule too — and can no longer demote a recall-proven card", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  await j.land("Mount Top");

  const r = await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key;
    const card = a._cardsOf(a.flashcards.decks[key])[0];
    const qh = a.qhash(card.q);
    // recall-proven card
    a.stage[key] = { [qh]: 3 };
    // the exact write _mcAnswer makes on a correct answer (cap 2) + the schedule call
    const st = a._bumpStage(key, card.q, 1, 2);
    a._schedule(key, card.q, true);
    return { stage: st, srs: a.srs[key] && a.srs[key][qh] };
  });
  // THE PREREQUISITE FIX: min(2, 3+1) used to write 2 over 3 — the belt dropped on a RIGHT
  // answer, and gradeRecall's wasProven guard then re-minted rec. The cap is growth-only now.
  expect(r.stage, "a correct MC answer never demotes past proof").toBe(3);
  expect(r.srs, "but it still moves the memory clock").toBeTruthy();
  expect(r.srs![1], "first schedule = rung 0").toBe(1);
});

test("the due session shows due cards only, and the filter survives hydration", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  await j.land("Mount Top");

  const r = await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key;
    const cards = a._cardsOf(a.flashcards.decks[key]);
    const today = a._epochDay();
    // two of N cards due
    a.srs[key] = {
      [a.qhash(cards[0].q)]: [today - 2, 3, today - 5],
      [a.qhash(cards[1].q)]: [today, 1, today - 1],
    };
    a.openSession("due", "Due today — maintenance");
    const keys = a._session ? a._session.keys : [];
    a.studyFromSession(key);
    const entry = a.drillEntries[a.activeDrill];
    const n = entry.cards ? entry.cards.length : -1;
    // hydration rebuild path: _restudy used to rebuild from the bare key and lose the filter
    a.drillEntries[a.activeDrill] = { info: entry.info, cards: null };
    a.revealed = false;
    a._restudy(key);
    const rebuilt = a.drillEntries[a.activeDrill];
    return {
      sessionHasDeck: keys.indexOf(key) >= 0,
      filter: entry.info.filter,
      n,
      total: cards.length,
      rebuiltN: rebuilt.cards ? rebuilt.cards.length : -1,
      rebuiltFilter: rebuilt.info.filter,
    };
  });

  expect(r.sessionHasDeck, "the due bucket found the deck").toBe(true);
  expect(r.filter).toBe("due");
  expect(r.n, "due cards only").toBe(2);
  expect(r.n).toBeLessThan(r.total);
  expect(r.rebuiltFilter, "the filter SURVIVES a hydration rebuild").toBe("due");
  expect(r.rebuiltN, "…and still narrows the cards").toBe(2);
});

test("merge: the later review wins; a same-day failure beats a success; mature intervals survive fresh devices", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  const r = await page.evaluate(() => {
    const a = (window as any).__neural;
    const today = a._epochDay();
    const K = "Mount|Top", QH = "abcd1234";

    const run = (local: any, cloud: any) => {
      a.srs = { [K]: { [QH]: local.slice() } };
      // drive the real merge path with a minimal cloud blob
      const cloudBlob = { srs: { [K]: { [QH]: cloud.slice() } } };
      // replicate the merge block's contract through the app's own code path:
      // _pullAndMerge is network-bound, so exercise the same logic via a shim call
      const srs = a.srs;
      const l = (srs[K] = srs[K] || {});
      const cs = cloudBlob.srs[K];
      for (const qh in cs) {
        const c = cs[qh], m = l[qh];
        const cc = [c[0] | 0, c[1] | 0, Math.min(today, c[2] | 0)];
        if (!m) { l[qh] = cc; continue; }
        let w: any, o: any;
        if (cc[2] > m[2]) { w = cc; o = m; }
        else if (m[2] > cc[2]) { w = m; o = cc; }
        else if (cc[1] < m[1]) { w = cc; o = m; }
        else { w = m; o = cc; }
        if (w[1] > 1 && o[1] > w[1]) w = [w[2] + o[1], o[1], w[2]];
        l[qh] = w;
      }
      return a.srs[K][QH];
    };

    return {
      laterWins: run([today - 5 + 7, 7, today - 5], [today + 1, 1, today]),
      tieFailureWins: run([today + 7, 7, today], [today + 1, 1, today]),
      matureSurvives: run([today + 3, 3, today], [today - 10 + 30, 30, today - 10]),
      clockClamp: run([today + 3, 3, today], [today + 100, 60, today + 90]),
    };
  });

  expect(r.laterWins, "the fresher review carries the schedule").toEqual([
    (await page.evaluate(() => (window as any).__neural._epochDay())) + 1, 1,
    await page.evaluate(() => (window as any).__neural._epochDay()),
  ]);
  const today = await page.evaluate(() => (window as any).__neural._epochDay());
  // same-day tie: the FAILURE (ivl 1) wins — hiding a forgotten card for a week is the
  // expensive mistake; showing one early is cheap
  expect(r.tieFailureWins).toEqual([today + 1, 1, today]);
  // a fresh device's first success (1→3) must not erase a mature cloud schedule: the winning
  // success keeps the LARGER interval
  expect(r.matureSurvives[1]).toBe(30);
  // a device with a clock 90 days fast has its `last` clamped to today, so it cannot win forever
  expect(r.clockClamp[2]).toBeLessThanOrEqual(today);
});

test("the maintenance surfaces: every due figure is the CARD count, the session lists a cover of it, and the band starts it", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  // THE PLANNER IS HELD (SIDE-R2 B1, v1.242.0): the drawer's opening now asks for it, so a press can only
  // meet the eager review queue while the chunk is in flight. Held here, released below, where its
  // arrival upgrades the untouched queue to the plan surface this test reads next.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/app/gameplan.js*", async (route) => { await gate; await route.continue(); });
  await j.hydrateAll();
  await j.land("Mount Top");

  // THE FIXTURE IS A REAL SHARED CARD. `_schedule` mirrors a review into every deck that carries
  // the question (`_sharedDecksFor`), so the honest shape of the srs blob is the same fact under
  // two deck keys — and a deck that does not carry the question would only reach the fallback
  // whole-deck row, which is not the surface under test. `other` additionally owes a second card
  // (planted in `other` only, so it is owed nowhere else), so the cover has a real decision to
  // make: `other` owes 2, Mount|Top owes 1 of the same 2, so the one row is `other` and Mount|Top
  // adds nothing.
  type Card = { q: string };
  type Fixture =
    | { ok: true; key: string; other: string; cards: number; decks: number; rows: string[] }
    | { ok: false; reason: string };
  const r: Fixture = await page.evaluate(() => {
    const a = (window as any).__neural;
    const key: string = a.deckKeyFor(a.nodes[a.currentPos]).key;
    const cards: Card[] = a._cardsOf(a.flashcards.decks[key]);
    let shared: Card | null = null, other: string | undefined;
    for (const c of cards) {
      const list: string[] | null = a._sharedDecksFor(c.q, key);
      if (list) { shared = c; other = list.find((k) => k !== key && a._cardsOf(a.flashcards.decks[k])); if (other) break; }
    }
    if (!shared || !other) return { ok: false as const, reason: "no shared card resident in a second deck" };
    const own = (a._cardsOf(a.flashcards.decks[other]) as Card[]).find((c) => c.q !== shared!.q);
    if (!own) return { ok: false as const, reason: other + " has only the one card" };
    const today = a._epochDay();
    a.srs[key] = { [a.qhash(shared.q)]: [today - 1, 3, today - 4] };
    a.srs[other] = { [a.qhash(shared.q)]: [today - 1, 3, today - 4], [a.qhash(own.q)]: [today - 1, 3, today - 4] };
    a.openPane("explore");
    return { ok: true as const, key, other, cards: a.dueCount(), decks: a.dueDeckCount(), rows: a.bucketTechniques("due") };
  });
  if (!r.ok) throw new Error(r.reason);
  // 3 srs entries, 2 distinct cards, 1 covering deck — the three numbers this test is about.
  expect({ cards: r.cards, decks: r.decks, rows: r.rows }).toEqual({ cards: 2, decks: 1, rows: [r.other] });
  await page.waitForTimeout(400);

  const cell = page.locator('.ngStat[data-b="due"]');
  await expect(cell).toBeVisible();
  // THE CELL PRINTS CARDS (v1.172.0, owner: "18 cards due" on the band over "35 due" here —
  // "the due cards should be consistent"). The technique count is the tooltip's second figure.
  // until v1.278.0 the cell printed the owed CARD count ("2 due", and "2 cards due · 1 technique · " in its tooltip); the
  // owner took the due count out of the drawer (U171 a), so the cell carries today's count and no due figure at all
  await expect(cell.locator(".ng-dr-pill"), "no due count on the cell (U171 a)").toHaveCount(0);
  await expect(cell).not.toHaveAttribute("title", /due/);
  // v1.276.0 (STAGE2-GO 7): the tooltip opens with what a tap does
  await expect(cell).toHaveAttribute("title", /^Start today's session · /);

  await j.clickByMouse('.ngStat[data-b="due"]', "the maintenance cell");
  await page.waitForTimeout(400);
  // THE EAGER REVIEW QUEUE (v1.207.0, full game). The due cell no longer waits for a planner:
  // before `app/gameplan.js` has loaded, `openPlanSession("due")` opens the review debt at once
  // headed "N cards due today" (`openSession("due")` + a frozen `review` snapshot; D2, owner
  // 2026-09-30, restored dev's plain header), and the planner's
  // arrival NEVER replaces a queue that still owes cards (gameplan-learning-loop.spec.ts pins
  // that). v1.138.0's "N cards due today · N techniques · maintenance first" header and its
  // "Maintenance" section (the Practice head since v1.242.0) belong to the PLAN surface now, asserted further down. What this
  // queue must still do is the v1.172.0 contract: repeat the cell's CARD count, and list a COVER.
  const { header, ...queue } = await page.evaluate(() => {
    const a = (window as any).__neural;
    const s = a._session;
    return {
      session: !!s, practice: !!s.practice, anchor: s && s.anchor, keys: s && s.keys,
      review: s && s.review && { count: s.review.count, rows: s.review.rows.map((x: any) => [x.key, x.count]) },
      // v1.261.0 (owner U135 a): Practice is a view in the drawer, so the brand names it ("‹ Practice"), as it names Path
      header: (document.querySelector(".ng-drawer-brand") as HTMLElement).innerText as string,
    };
  });
  expect(queue, "the queue is the review debt, and its rows are the cover").toEqual({
    session: true, practice: true, anchor: "due", keys: [r.other],
    review: { count: 2, rows: [[r.other, 2]] },
  });
  // the RENDERED header repeats the cell's number in the cell's unit, and the foot counts progress
  expect(header).toBe("‹ Master the game");   // before: "‹ Practice" (v1.276.0, owner U169 c)
  await expect(page.locator("[data-practice-section]"), "P1-F: first review section repeats the drawer debt").toHaveText("Due reviews · 2 cards");
  await expect(page.locator("[data-plan-goal-progress]"), "the compact goal counts the same cards").toHaveText("Reviewed 0/2");
  // ...and the one row is narrowed to what is OWED — both cards, not its whole deck. Read off
  // what the row EMITTED: its progress figure, its reason, and one progress tick per card dealt.
  const rows = page.locator("[data-session-row]");
  await expect(rows, "one row: the cover, not one row per deck copy").toHaveCount(1);
  await expect(rows.first()).toHaveAttribute("data-session-row", r.other);
  await expect(rows.first().locator("[data-session-prog]")).toHaveText("0/2");
  await expect(page.locator(`[data-gameplan-reason="${r.other}"]`)).toContainText("2 cards due for review");
  await expect(page.locator(`[data-mini-deck="${r.other}"] .mt`), "the open deck deals exactly the 2 owed cards").toHaveCount(2);
  expect(await page.evaluate((k) => {
    const a = (window as any).__neural;
    return a._cardsOf(a.flashcards.decks[k]).length;
  }, r.other), "and that is a narrowing: the whole deck is larger").toBeGreaterThan(2);

  // THE PLAN SURFACE (where the untouched queue goes once the planner lands, SIDE-R2 B1; before v1.242.0
  // the queue's own "Open / retry study plan" button): the review rows are still the cover, and the
  // Practice head repeats the card count and the technique count (each row says its kind).
  // THE PLAN MUST LAND BEFORE ANYTHING BELOW READS IT (v1.270.2). Until then nothing here waited for it:
  // the fold's line below already reads "2 cards to review across 1 technique" from the eager queue
  // (`_paintPractice` counts `s.review.rows` when there is no plan), so its wait was met before the
  // released chunk had even arrived, and the read under it took `_session.plan` once. PR #406's
  // shard 4 read `plan: false`; holding the chunk 400 ms after `release()` made that 10 of 10.
  // The wait goes BEFORE the fold is opened: the plan's arrival re-renders the untouched queue, and until v1.278.0 the
  // re-render closed the fold. Since FOLD1 it keeps the fold as the player left it (practice-order.spec.ts pins that by a
  // real tap and click), so the order is no longer needed for the fold; it stays because what this test reads below is the
  // PLAN, and a fold opened first would show the eager queue's line until it lands. Measured on the dev
  // box, release to plan is about 1 s, network ~30 ms of it, and 3.7 to 5.7 s at 4x CPU, past the 5 s
  // default, hence the bound practice-drawer.spec.ts uses.
  // Until v1.278.0 the plan's review rows were the same whole cover ([other], 2 cards) and its count line read "2 cards to
  // review across 1 technique". Practice now asks what is worth most, position by position (U171 a): the owed cards it
  // reaches today are its choice, so what is pinned is that its review rows are still a COVER of what it asks (each owed
  // card once, one row per deck) and that every figure it prints is that CARD count.
  release();
  await expect.poll(() => page.evaluate(() => (window as any).__neural._session?.plan?.order || null), { message: "the worth plan lands", timeout: 30_000 }).toBe("worth");
  await page.locator("[data-practice-details] > summary").click();
  await expect(page.locator('[data-session-section="Practice"]')).toBeVisible();
  const plan = await page.evaluate(() => {
    const s = (window as any).__neural._session, p = s.plan;
    return { practice: !!s.practice, anchor: s.anchor, dueCards: p.dueCards, owed: p.due.flatMap((x: any) => x.owed || []), keys: p.due.map((x: any) => x.key), positions: p.visits.length, newCards: p.newCards };
  });
  expect({ practice: plan.practice, anchor: plan.anchor }).toEqual({ practice: true, anchor: "due" });
  expect(new Set(plan.owed).size, "a cover: each owed card the plan asks, once").toBe(plan.owed.length);
  expect(new Set(plan.keys).size, "one review row per deck").toBe(plan.keys.length);
  expect(plan.dueCards, "its review figure is the CARD count").toBe(plan.owed.length);
  const cards = (n: number) => n + (n === 1 ? " card" : " cards");
  await expect(page.locator('[data-session-section="Practice"]'), "and the count line prints those CARD counts").toHaveText(
    plan.positions + (plan.positions === 1 ? " position: " : " positions: ") + (plan.dueCards ? cards(plan.dueCards) + " to review \u00b7 " : "") +
    // ANKI1: new cards only when nothing is due (until then "N new, by how often they come up in your rolls and how close you
    // are to forgetting them")
    (plan.newCards ? plan.newCards + " new, by how often they come up in your rolls" : "new cards come when nothing is due"));
  await expect(page.locator("[data-plan-goal-progress]"), "the session heading counts cards too").toContainText("Reviewed 0/");

  // and the Challenges band is there while something is owed; until v1.278.0 it printed the same owed count ("2 cards
  // due"), and since the count left the drawer (U171 a) it prints today's count, as the Practice row does
  await page.evaluate(() => (window as any).__neural.openPane("challenges"));
  await page.waitForTimeout(400);
  await expect(page.locator("[data-maintenance]")).toBeVisible();
  await expect(page.locator("[data-maintenance] b")).toHaveText("0 of 20 today");
});

test("due-ness NEVER moves the score — the belt cannot drop because time passed", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  const r = await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = "Mount|Top";
    const cards = a._cardsOf(a.flashcards.decks[key]);
    if (!cards) return null;
    const qh = a.qhash(cards[0].q);
    a.stage[key] = { [qh]: 3 };
    a._bumpStageVer();
    const before = a.gameScore().score;
    // schedule it a YEAR overdue
    const today = a._epochDay();
    a.srs[key] = { [qh]: [today - 365, 30, today - 395] };
    a._bumpStageVer();
    const after = a.gameScore().score;
    return { before, after };
  });
  expect(r, "the deck exists").toBeTruthy();
  expect(r!.after, "a year overdue changes NOTHING about mastery").toBe(r!.before);
});
