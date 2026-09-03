import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE OPEN INLINE DECK STAYS IN VIEW (v1.171.0). Owner: "when I click one that is below the fold
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

test("a session row opened below the fold, then walked with ↓ and ↑, keeps its deck fully visible", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  await j.land("Mount Top");

  // The plan queue, every row dealt (the "Show more" pages collapsed into one), so the list is
  // certain to overflow its scroller. Row 0 opens on arrival — that is the hidden tick the old
  // code later aimed at.
  const setup = await page.evaluate(() => {
    const a = (window as any).__neural;
    a.openPlanSession("new");
    const s = a._session;
    if (!s) return { rows: 0, keys: [] as string[] };
    s.shown = s.keys.length;
    a.renderSession();
    return { rows: s.keys.length, keys: s.keys as string[] };
  });
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
