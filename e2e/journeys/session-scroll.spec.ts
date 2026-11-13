import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE OPEN INLINE DECK STAYS IN VIEW (v1.172.0). Owner: "when I click one that is below the fold
 * it doesn't seem to open right, like the scrolling position changes … it should make itself
 * visible above the fold, also the case if I go down the list and back up the list".
 *
 * The defect: `_scrollFocusedDeck` aimed at the FIRST `.mt` progress tick in the pane list. The
 * session keeps a collapsed row's built deck in the DOM (`display:none`), so once row 0 had been
 * opened — which `renderSession` does on arrival — every later click scrolled against a hidden
 * tick whose rect is all zeros, and the list jumped by the pane's own offset. The history home
 * never showed it because `renderDrillHome` rebuilds its rows.
 *
 * The contract, asserted on the RENDER (the open `[data-mini-deck]`'s rect against its scroller's
 * rect — never a recomputed target), after each of: a mouse click on a row below the fold, ↓
 * three times, ↑ three times:
 *   · the open deck is the row acted on;
 *   · its row header and its whole card, Reveal included, lie inside the scroller.
 *
 * Mutants: the old first-`.mt` target fails the click step (the list jumps up past the row);
 * dropping `_scrollFocusedDeck` from `sessionNav` fails the ↓ steps once a row leaves the fold.
 *
 * TWO SURFACES SINCE v1.248.0. Practice shows one card and hides every other row (`box.hidden`), so
 * no Practice row can start below the fold. The owner's sentence still holds in both places: an
 * inline session keeps its rows, and Practice's picker is the queue under the card, which sits far
 * below the deck it opens. Mutant: dropping `_scrollFocusedDeck` from the queue button's onclick
 * leaves the opened deck above the scroller and fails the second test's click step.
 */

type Fit = {
  key: string | null;
  rowTop: number;      // px of the row header below the scroller's top edge (>= 0 is visible)
  deckBottom: number;  // px of the scroller's bottom edge below the deck (>= 0 is visible)
  tall: boolean;       // the block is taller than the scroller: only its top can be promised
  scrollTop: number;
};

const fit = (page: Page): Promise<Fit> =>
  page.evaluate(() => {
    const wrap = document.querySelector("[data-session]") as HTMLElement | null;
    const list = wrap && (wrap.parentElement as HTMLElement | null);
    if (!list) return { key: null, rowTop: NaN, deckBottom: NaN, tall: false, scrollTop: NaN };
    const decks = Array.from(document.querySelectorAll("[data-mini-deck]")) as HTMLElement[];
    const deck = decks.find((el) => el.offsetParent !== null) || null;
    if (!deck) return { key: null, rowTop: NaN, deckBottom: NaN, tall: false, scrollTop: list.scrollTop };
    const row = (deck.parentElement as HTMLElement).previousElementSibling as HTMLElement;
    const lr = list.getBoundingClientRect(), rr = row.getBoundingClientRect(), dr = deck.getBoundingClientRect();
    return {
      key: deck.getAttribute("data-mini-deck"),
      rowTop: rr.top - lr.top,
      deckBottom: lr.bottom - dr.bottom,
      tall: dr.bottom - rr.top > lr.height,
      scrollTop: list.scrollTop,
    };
  });

const expectInView = (f: Fit, what: string) => {
  expect(f.key, what + ": a deck is open").toBeTruthy();
  expect(f.rowTop, what + ": the row header is below the scroller's top").toBeGreaterThanOrEqual(0);
  if (!f.tall) expect(f.deckBottom, what + ": the whole card, Reveal included, is above the scroller's bottom").toBeGreaterThanOrEqual(0);
};

// THE QUEUE'S ROWS ARE SEEDED AS REVIEW DEBT (v1.207.0). Until the full game, `openPlanSession
// ("new")` dealt a guest the whole FLOW ranking ("Learn next" + "More, in order"), so a fresh
// boot overflowed on its own. Since D2 (owner, 2026-09-30) a fresh plan deals only its budget.
// So: one card due yesterday in each of 30 decks (ONE row per covering deck), the planner loaded
// FIRST through the app's own seam so no deferred swap can rebuild the list mid-walk.
const plantReviews = () => {
  const a = (window as any).__neural;
  const today = a._epochDay();
  const decks = a.flashcards.decks;
  let planted = 0;
  for (const k of Object.keys(decks).sort()) {
    const cards = a._cardsOf(decks[k]);
    if (!cards || !cards.length || a._sharedDecksFor(cards[0].q, k)) continue;   // a shared card would be covered by ONE row
    const i = a.nodeForKey(k);
    if (i >= 0 && !a.rsAllowsIdx(i)) continue;
    a.srs[k] = { [a.qhash(cards[0].q)]: [today - 1, 3, today - 4] };
    a.prep[k] = 1;   // puts the deck in the "reviewing" bucket too
    if (++planted >= 30) break;
  }
  return planted;
};

test("a session row opened below the fold, then walked with ↓ and ↑, keeps its deck fully visible", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  await j.land("Mount Top");

  // An inline session, so every row is dealt and the list is certain to overflow its scroller. Row
  // 0 opens on arrival — that is the hidden tick the old code later aimed at. Practice no longer
  // has this surface (see the header); `renderSession`'s inline rows + `_scrollFocusedDeck` are the
  // same whatever fills them, and "reviewing" is a real door that requests no study comparison.
  expect(await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime()), "the planner loads").toBe(true);
  expect(await page.evaluate(plantReviews), "30 decks carry one owed card").toBe(30);
  const setup = await page.evaluate(() => {
    const a = (window as any).__neural;
    a.openSession("reviewing", "Reviewing");
    const s = a._session;
    if (!s) return { rows: 0, keys: [] as string[], practice: true };
    return { rows: s.keys.length, keys: s.keys as string[], practice: !!s.practice };
  });
  expect(setup.practice, "the inline surface, not Practice's one-card page").toBe(false);
  expect(setup.rows, "the queue has rows to walk").toBeGreaterThan(8);
  await page.waitForTimeout(400);

  // pick the first row that starts below the fold, scroll the LIST (as a finger would) until
  // that row is on screen, and click it with the real mouse
  const target = await page.evaluate(() => {
    const wrap = document.querySelector("[data-session]") as HTMLElement;
    const list = wrap.parentElement as HTMLElement;
    const lr = list.getBoundingClientRect();
    const rows = Array.from(list.querySelectorAll("[data-session-row]")) as HTMLElement[];
    const below = rows.find((r) => r.getBoundingClientRect().top > lr.bottom);
    if (!below) return null;
    list.scrollTop += below.getBoundingClientRect().top - lr.top - lr.height * 0.6;
    return { idx: Number(below.getAttribute("data-session-idx")), key: below.getAttribute("data-session-row") };
  });
  expect(target, "the list overflows: some row starts below the fold").toBeTruthy();
  await page.waitForTimeout(100);
  await j.clickByMouse('[data-session-row][data-session-idx="' + target!.idx + '"]', "a session row below the fold");
  await page.waitForTimeout(400);
  const clicked = await fit(page);
  expect(clicked.key, "the row clicked is the deck that opened").toBe(target!.key);
  expectInView(clicked, "after the click");

  // ↓ ↓ ↓ then ↑ ↑ ↑ — the open deck must be readable at every stop
  for (let step = 1; step <= 3; step++) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(400);
    const f = await fit(page);
    expect(f.key, "↓ ×" + step + " opens the next row").toBe(setup.keys[target!.idx + step]);
    expectInView(f, "after ↓ ×" + step);
  }
  for (let step = 1; step <= 3; step++) {
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(400);
    const f = await fit(page);
    expect(f.key, "↑ ×" + step + " reopens the row above").toBe(setup.keys[target!.idx + 3 - step]);
    expectInView(f, "after ↑ ×" + step);
  }
});

test("a Practice queue jump made far below the card, then walked with ↓ and ↑, keeps its deck fully visible", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  await j.land("Mount Top");
  expect(await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime()), "the planner loads").toBe(true);
  expect(await page.evaluate(plantReviews), "30 decks carry one owed card").toBe(30);
  const setup = await page.evaluate(() => {
    const a = (window as any).__neural;
    a.openPlanSession("due");
    const s = a._session;
    if (!s) return { rows: 0, keys: [] as string[], plan: false, practice: false };
    return { rows: s.keys.length, keys: s.keys as string[], plan: !!s.plan, practice: !!s.practice };
  });
  expect(setup.practice, "Practice's one-card page").toBe(true);
  expect(setup.plan, "the queue is the plan surface, not the pre-planner review list").toBe(true);
  expect(setup.rows, "the queue has rows to walk").toBeGreaterThan(8);
  await page.waitForTimeout(400);

  // Scroll the LIST (as a finger would) down to the queue and open it, then to one of its buttons.
  // That takes the open deck off the top, or this test would pass without the scroll it exists to pin.
  const scrollListTo = async (sel: string) => {
    await page.evaluate((target) => {
      const list = (document.querySelector("[data-session]") as HTMLElement).parentElement as HTMLElement;
      const b = (document.querySelector(target) as HTMLElement).getBoundingClientRect(), lr = list.getBoundingClientRect();
      list.scrollTop += b.top - lr.top - lr.height * 0.6;
    }, sel);
    await page.waitForTimeout(100);
  };
  await j.readerLayoutSettled();   // opening the pane moves the reader; clickByMouse measures, then presses (§6.3)
  await scrollListTo("[data-practice-details] > summary");
  await j.clickByMouse("[data-practice-details] > summary", "open the session queue");
  await page.waitForTimeout(200);
  const idx = 5;
  // nth-of-type, not nth-child: since v1.273.0 the queue names each position (a <p data-practice-visit>) before its decks
  const jump = "[data-practice-queue] button:nth-of-type(" + (idx + 1) + ")";
  await scrollListTo(jump);
  const away = await fit(page);
  expect(away.rowTop, "the open deck has left the top of the scroller").toBeLessThan(0);
  await j.clickByMouse(jump, "a queue button far below the card");
  await page.waitForTimeout(400);
  const clicked = await fit(page);
  expect(clicked.key, "the queue button opens its own deck").toBe(setup.keys[idx]);
  expectInView(clicked, "after the jump");

  for (let step = 1; step <= 3; step++) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(400);
    const f = await fit(page);
    expect(f.key, "↓ ×" + step + " opens the next deck").toBe(setup.keys[idx + step]);
    expectInView(f, "after ↓ ×" + step);
  }
  for (let step = 1; step <= 3; step++) {
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(400);
    const f = await fit(page);
    expect(f.key, "↑ ×" + step + " reopens the deck before").toBe(setup.keys[idx + 3 - step]);
    expectInView(f, "after ↑ ×" + step);
  }
});
