import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * EVERY FLASHCARD YOU ANSWER COUNTS, AND SHOWS IT (v1.219.0, owner 2026-10-05).
 *
 * "when the user answers that the animation on the choices and etc is kinda lost or delayed? does it
 * only work properly for the first default flashcard?" and "answering more flashcards should
 * increase/decrease choices proba further, it's not a 1 slot thing, but many".
 *
 * Measured first (real app, dev 9b7ce26eb): a FRESH landing that skips to card 3 and answers it already
 * got the same feedback as card 1. What was broken was the SECOND answer in one landing: the economy
 * latch sent it to a grade-only path that armed no outcome, so nothing hit, nothing popped and no cause
 * rose. A wrong second answer moved no number at all, and the paged card's clock, left to run out, cost
 * −4 and broke momentum with full feedback while a wrong answer on that same card was free.
 *
 * Pinned here, against what the render EMITTED (§6.3):
 *   - card 1, and card 3 reached by the NEXT chevron (by MOUSE, §6.1) in a fresh landing: the same
 *     cause, the same −4 hit on every own card, within the same one-frame bound;
 *   - the second answer in one landing: the hit again, one step smaller (−3), and no second momentum
 *     tick or challenge evidence (`land_q_answered` once, `land_q_extra` names k);
 *   - wrong answers stack down NG_LAND_ANSWER_STEPS (−4, −3, −2, −1) and stop at its cap (the 5th moves
 *     nothing and hits nothing, and says so); correct answers stack with never-growing steps;
 *   - a timeout on a paged card costs that card's wrong step (−3), never more, and keeps momentum;
 *   - a skip is free, and a card has ONE window per landing: paging away pauses it and paging back
 *     resumes it, never a fresh one.
 * The step numbers below are the owner's (`NG_LAND_ANSWER_STEPS` in knowledge-profile.src.js, pinned
 * again by tests/knowledge_profile.test.mjs); change them in both places.
 * No journey here commits a move, so no rng draw can end the exchange early (§6.3): the branch is
 * unreachable by construction, and each test asserts at its end that nothing was committed.
 * Mutants, each red here by name: the second answer routed back to the grade-only path; one step for
 * every card (no diminishing); no cap; momentum ticking per card; evidence emitted per card; the
 * paged timeout at the full −4 / breaking momentum; the clock re-armed full on a page back.
 */

const VIEWS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
];
const WRONG_STEPS = [-4, -3, -2, -1, 0]; // NG_LAND_ANSWER_STEPS[k-1].wrong × 100, then the cap

type Card = { t: string; n: string; word: string; delta: string | null; hit: boolean };
const cards = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-choice-group="you"] [data-tech]')).map((c: any) => ({
      t: c.getAttribute("data-tech"),
      n: (c.querySelector(".ngodds")?.textContent || "").trim(),
      word: (c.querySelector("[data-immediate-label]")?.textContent || "").trim().toLowerCase(),
      delta: c.getAttribute("data-hit-delta"),
      hit: c.classList.contains("ng-hit-bad") || c.classList.contains("ng-hit-good"),
    })),
  ) as Promise<Card[]>;
const pct = (s: string) => {
  const m = /^(\d+)%$/.exec(s);
  return m ? Number(m[1]) : null;
};
const causes = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll(".ng-cause")).map((e: any) => (e.textContent || "").trim()));
const pops = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll(".ng-hitpop")).map((e: any) => (e.textContent || "").trim()));
const said = (page: Page) => page.evaluate(() => document.querySelector("[data-outcome-live]")?.textContent || "");
const st = (page: Page) =>
  page.evaluate(() => {
    const a: any = (window as any).__neural;
    const d = a._decision;
    return { page: a._landPage, qMod: a._qMod || 0, combo: a._combo || 0, pos: a.currentPos, mc: !!(a._mc && a._mc.surface === "land"),
      remaining: d ? d.remaining : null, total: d ? d.total : null, q: a._landQ && a._landQ.card ? a._landQ.card.q : null };
  });
const named = async (page: Page, beat: string) =>
  page.evaluate((b) => ((window as any).__neural.beats || []).filter((x: any) => x.beat === b), beat) as Promise<any[]>;
// the printed own-card deltas from `before` to now, leaving out a clamped or unprinted number
const deltas = (before: Card[], after: Card[], room: number) =>
  before.map((b, i) => ({ t: b.t, was: pct(b.n), now: pct(after[i]?.n ?? "") })).filter((x) => x.was != null && x.now != null && x.was > 5 + room && x.was < 95 - room).map((x) => ({ t: x.t, d: (x.now as number) - (x.was as number) }));

async function setup(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  expect(await j.landQuestion(), "the landing asks a question").not.toBeNull();
  await j.advance(200); // let the hand settle under the card
  return j;
}
// a NEXT chevron click by MOUSE, then wait for the next card's block to mount (a cold distractor pool
// warms asynchronously before the paged card mounts)
async function next(page: Page, j: ReturnType<typeof journey>) {
  const p0 = (await st(page)).page;
  await j.clickByMouse("[data-land-next]", "the next-flashcard chevron");
  await expect.poll(async () => { await j.advance(16); const s = await st(page); return s.page; }, { timeout: 20_000 }).toBe(p0 + 1);
  await j.advance(50);
}
// answer the mounted card through its own MC buttons; which option is right/trap comes from the MC
// truth itself. False when this card cannot be answered that way (recall-only, or no such tier).
async function answer(page: Page, which: "wrong" | "trap" | "correct") {
  const pick = await page.evaluate((w) => {
    const m: any = (window as any).__neural._mc;
    if (!m || m.surface !== "land" || !document.querySelector("[data-land-q] [data-land-mc-opt]")) return -1;
    if (w === "correct") return m.correct;
    return m.tiers.findIndex((t: string, i: number) => i !== m.correct && (w === "trap" ? t === "trap" : t !== "trap"));
  }, which);
  if (pick < 0) return false;
  await page.locator("[data-land-q] [data-land-mc-opt]").nth(pick).click();
  return true;
}
// the next card that CAN be answered this way, skipping (free) any that cannot
async function answerable(page: Page, j: ReturnType<typeof journey>, which: "wrong" | "correct") {
  for (let i = 0; i < 6; i++) {
    const ok = await page.evaluate((w) => {
      const m: any = (window as any).__neural._mc;
      if (!m || m.surface !== "land" || !document.querySelector("[data-land-q] [data-land-mc-opt]")) return false;
      return w === "correct" || m.tiers.some((t: string, k: number) => k !== m.correct && t !== "trap");
    }, which);
    if (ok) return true;
    const s0 = await st(page);
    await next(page, j);
    const s1 = await st(page);
    expect(s1.qMod, "a skip is free: the exchange does not move").toBe(s0.qMod);
    expect(s1.combo, "a skip is free: momentum does not move").toBe(s0.combo);
  }
  return false;
}
const nothingCommitted = async (page: Page, pos: number) => {
  expect((await named(page, "commit")).length, "no move was committed, so no draw could end the exchange").toBe(0);
  expect((await st(page)).pos, "still on the landing").toBe(pos);
};

for (const vp of VIEWS) {
  test(`@curated card 1, and card 3 reached by the next chevron in a fresh landing, get the same hit in the same bound (${vp.name})`, async ({ page }) => {
    const seen: Array<{ page: number; causes: string[]; d: Array<{ t: string; d: number }>; hits: Card[]; pops: string[]; said: string }> = [];
    for (const skips of [0, 2]) {
      const j = await setup(page, vp.width, vp.height); // a fresh boot: a fresh landing, a fresh profile
      const pos = (await st(page)).pos;
      for (let i = 0; i < skips; i++) await next(page, j);
      const before = await cards(page);
      expect(await answer(page, "wrong"), `card ${skips + 1} can be answered wrong`).toBe(true);
      await j.advance(100); // THE BOUND: one 100 ms pump, for both cards
      const after = await cards(page);
      seen.push({ page: (await st(page)).page, causes: await causes(page), d: deltas(before, after, 4), hits: after.filter((c) => c.hit), pops: await pops(page), said: await said(page) });
      expect((await named(page, "land_q_answered")).length, "the card answered is the landing question").toBe(1);
      await nothingCommitted(page, pos);
    }
    const [one, three] = seen;
    expect(one.page, "the first card").toBe(0);
    expect(three.page, "card 3, reached by two chevron clicks").toBe(2);
    for (const [name, s] of [["card 1", one], ["card 3", three]] as const) {
      expect(s.causes, `${name}: the cause rises`).toEqual(["missed"]);
      expect(s.d.length, `${name}: printed numbers to compare`).toBeGreaterThan(0);
      expect(s.d.every((x) => x.d === -4), `${name}: the hand's numbers drop by the cost (${JSON.stringify(s.d)})`).toBe(true);
      expect(s.hits.length, `${name}: the cards take the hit`).toBeGreaterThan(0);
      expect(s.hits.every((c) => c.delta === "-4"), `${name}: each hit records the render's −4`).toBe(true);
      expect(s.pops.length, `${name}: one pop per hit card`).toBe(s.hits.length);
      expect(s.said, `${name}: one polite sentence`).toBe("Missed: your chances on these moves drop 4 points.");
    }
  });

  // FOUND RECORDING THE DEMO (real app, 1440, dev and this branch): a pair label drawn behind the next
  // chevron put its seat star exactly on it, and the star, on the ROOT plane at z:4, covered the whole
  // app wrap, so three mouse clicks in a row opened the list menu instead of paging (§6.1). The star is
  // placed under the chevron through the app's own seam, with no frame pumped before the click.
  test(`a seat star drawn behind the next chevron never takes its click (${vp.name})`, async ({ page }) => {
    const j = await setup(page, vp.width, vp.height);
    const placed = await page.evaluate(() => {
      const a: any = (window as any).__neural;
      const b = document.querySelector("[data-land-next]") as HTMLElement;
      const r = b.getBoundingClientRect(), cr = a.canvas.getBoundingClientRect();
      const idx = a.currentPos;
      a._syncSeatStars([{ idx, x: r.left + r.width / 2 - cr.left, y: r.top + r.height / 2 - cr.top, alpha: 1 }]);
      const s = document.querySelector(`[data-seat-star="${idx}"]`) as HTMLElement | null;
      const sr = s ? s.getBoundingClientRect() : null;
      return !!sr && Math.abs(sr.left + sr.width / 2 - (r.left + r.width / 2)) < 2 && Math.abs(sr.top + sr.height / 2 - (r.top + r.height / 2)) < 2;
    });
    expect(placed, "a seat star sits exactly under the chevron").toBe(true);
    const p0 = (await st(page)).page;
    await j.clickByMouse("[data-land-next]", "the next chevron, with a seat star behind it");
    await expect.poll(async () => (await st(page)).page, { timeout: 10_000 }).toBe(p0 + 1);
    expect(await page.evaluate(() => document.querySelector("[data-seat-star]")?.getAttribute("aria-expanded")), "the star's list menu did not open").toBe("false");
  });

  test(`the second card answered in one landing takes the hit again, one step smaller, with no second momentum or evidence (${vp.name})`, async ({ page }) => {
    const j = await setup(page, vp.width, vp.height);
    const pos = (await st(page)).pos;
    expect(await answer(page, "correct"), "card 1 answered").toBe(true);
    await j.advance(100);
    const afterFirst = await st(page);
    expect(afterFirst.combo, "the landing question ticked momentum").toBe(1);
    await page.waitForTimeout(1700); // the first outcome's floats are gone (wall clock)
    await next(page, j);
    expect(await answerable(page, j, "wrong"), "a later card that can be answered wrong").toBe(true);
    const before = await cards(page);
    expect(await answer(page, "wrong"), "the second answer").toBe(true);
    await j.advance(100);
    const after = await cards(page);
    const d = deltas(before, after, 3);
    expect(await causes(page), "the cause rises for the second answer too").toEqual(["missed"]);
    expect(d.length, "printed numbers to compare").toBeGreaterThan(0);
    expect(d.every((x) => x.d === WRONG_STEPS[1]), `the hand drops by the second step, −3 (${JSON.stringify(d)})`).toBe(true);
    const hits = after.filter((c) => c.hit);
    expect(hits.length, "the cards take the hit again").toBeGreaterThan(0);
    expect(hits.every((c) => c.delta === String(WRONG_STEPS[1])), "each hit records the render's −3").toBe(true);
    expect((await pops(page)).sort(), "each pop says −3 and its card's own word").toEqual(hits.map((c) => "−3%" + c.word).sort());
    expect(await said(page)).toBe("Missed: your chances on these moves drop 3 points.");
    const s = await st(page);
    expect(s.combo, "a later card neither ticks nor breaks momentum").toBe(afterFirst.combo);
    expect((await named(page, "land_q_answered")).length, "challenge evidence stays once per landing").toBe(1);
    const extra = await named(page, "land_q_extra");
    expect(extra.length, "the later answer is named").toBe(1);
    expect(extra[0].k, "…as the second card resolved").toBe(2);
    expect(extra[0].step, "…with its step").toBeCloseTo(WRONG_STEPS[1] / 100, 10);
    await nothingCommitted(page, pos);
  });
}

test(`wrong answers stack down the table, −4 −3 −2 −1, and stop at its cap`, async ({ page }) => {
  const j = await setup(page, 1440, 900);
  const pos = (await st(page)).pos;
  let total = 0;
  for (let k = 1; k <= WRONG_STEPS.length; k++) {
    if (k > 1) { await page.waitForTimeout(1700); await next(page, j); }
    expect(await answerable(page, j, "wrong"), `card for answer ${k}`).toBe(true);
    const before = await cards(page);
    expect(await answer(page, "wrong")).toBe(true);
    await j.advance(100);
    const after = await cards(page);
    const want = WRONG_STEPS[k - 1];
    total += want;
    const d = deltas(before, after, 4);
    expect(d.length, `answer ${k}: printed numbers to compare`).toBeGreaterThan(0);
    expect(d.every((x) => x.d === want), `answer ${k}: the hand moves by ${want} (${JSON.stringify(d)})`).toBe(true);
    expect(await causes(page), `answer ${k}: the cause rises every time`).toEqual(["missed"]);
    const hits = after.filter((c) => c.hit);
    if (want) expect(hits.length > 0 && hits.every((c) => c.delta === String(want)), `answer ${k}: hit by ${want}`).toBe(true);
    else {
      expect(hits.length, `answer ${k}: past the cap, nothing moves, so nothing is hit`).toBe(0);
      expect(await pops(page), `answer ${k}: and nothing pops`).toEqual([]);
      expect(await said(page), "and the sentence says why").toBe("Missed: no further cost on this exchange.");
    }
    expect(Math.round((await st(page)).qMod * 100), `answer ${k}: the exchange carries the sum`).toBe(total);
  }
  expect((await named(page, "land_q_answered")).length, "challenge evidence once per landing").toBe(1);
  expect((await named(page, "land_q_extra")).map((b) => b.k), "every later card named with its k").toEqual([2, 3, 4, 5]);
  await nothingCommitted(page, pos);
});

test(`correct answers stack with never-growing steps, and stop when there is nothing left to add`, async ({ page }) => {
  const j = await setup(page, 1440, 900);
  const pos = (await st(page)).pos;
  const seen: number[] = [];
  for (let k = 1; k <= 6; k++) {
    if (k > 1) { await page.waitForTimeout(1700); await next(page, j); }
    expect(await answerable(page, j, "correct"), `card for answer ${k}`).toBe(true);
    const before = await cards(page);
    expect(await answer(page, "correct")).toBe(true);
    await j.advance(100);
    const after = await cards(page);
    const d = deltas(before, after, 15);
    expect(d.length, `answer ${k}: printed numbers to compare`).toBeGreaterThan(0);
    const same = d.every((x) => x.d === d[0].d);
    expect(same, `answer ${k}: every own card moves together (${JSON.stringify(d)})`).toBe(true);
    seen.push(d[0].d);
    // every unclamped card glints by exactly its own change; a card near the 95% ceiling may move
    // less, and a card whose number did not move takes nothing
    const hitOf = (t: string) => after.find((c) => c.t === t)!;
    if (d[0].d > 0) expect(d.every((x) => hitOf(x.t).hit && hitOf(x.t).delta === String(x.d)), `answer ${k}: glints by its real +${d[0].d}`).toBe(true);
    else expect(after.filter((c) => c.hit).length, `answer ${k}: nothing moved, nothing glints`).toBe(0);
    after.forEach((c, i) => {
      const moved = pct(c.n) !== pct(before[i].n);
      expect(c.hit, `answer ${k}: ${c.t} glints exactly when its number moved`).toBe(moved);
    });
    expect(await causes(page), `answer ${k}: the cause`).toEqual(["correct"]);
    expect((await st(page)).combo, `answer ${k}: momentum ticked once per landing, never per card`).toBe(1);
  }
  // fresh profile: the landing question pays sharpness + practice; each later card adds its step plus
  // practice until the deck's practice cap (5 correct answers), then nothing
  expect(seen.slice(0, 5).every((x) => x > 0), `answers 1–5 all raise the hand (${seen})`).toBe(true);
  for (let i = 1; i < seen.length; i++) expect(seen[i], `answer ${i + 1} never adds more than answer ${i} (${seen})`).toBeLessThanOrEqual(seen[i - 1]);
  expect(seen[5], `the 6th adds nothing (${seen})`).toBe(0);
  await nothingCommitted(page, pos);
});

test(`a timeout on a card paged to costs that card's wrong step, never more, and keeps momentum`, async ({ page }) => {
  const j = await setup(page, 1440, 900);
  const pos = (await st(page)).pos;
  expect(await answer(page, "correct"), "card 1 answered").toBe(true);
  await j.advance(100);
  const combo = (await st(page)).combo;
  await page.waitForTimeout(1700);
  await next(page, j);
  expect((await st(page)).remaining, "the paged card's clock runs").not.toBeNull();
  const before = await cards(page);
  await j.advanceUntil("land_q_expired", 20000, 100);
  await j.advance(100);
  const after = await cards(page);
  const d = deltas(before, after, 3);
  expect(await causes(page), "the cause names the timeout").toEqual(["too slow"]);
  expect(d.length).toBeGreaterThan(0);
  expect(d.every((x) => x.d === WRONG_STEPS[1]), `the same −3 a wrong answer there costs, not −4 (${JSON.stringify(d)})`).toBe(true);
  expect(after.filter((c) => c.hit).every((c) => c.delta === String(WRONG_STEPS[1])), "hit by −3").toBe(true);
  expect((await st(page)).combo, "momentum kept, as a wrong answer there keeps it").toBe(combo);
  const exp = await named(page, "land_q_expired");
  expect(exp.length).toBe(1);
  expect(exp[0].k, "the second card resolved").toBe(2);
  expect(await said(page)).toBe("Too slow: the answer is revealed, and your chances on these moves drop 3 points.");
  // the timeout RESOLVED that card: the next answer is the third, not a second go at the second step
  await page.waitForTimeout(1700);
  await next(page, j);
  expect(await answerable(page, j, "wrong"), "a card after the timeout").toBe(true);
  const b3 = await cards(page);
  expect(await answer(page, "wrong")).toBe(true);
  await j.advance(100);
  const d3 = deltas(b3, await cards(page), 2);
  expect(d3.length > 0 && d3.every((x) => x.d === WRONG_STEPS[2]), `the card after it takes the third step, −2 (${JSON.stringify(d3)})`).toBe(true);
  expect((await named(page, "land_q_extra")).map((b) => b.k), "…named as the third card resolved").toEqual([3]);
  await nothingCommitted(page, pos);
});

// The one journey here that commits a move, so every draw that could end the exchange early is rigged
// (§6.3): the move lands (resolve, outcome on the success branch), and the opponent never finishes and
// picks deterministically. The landing that follows must start the table over.
test(`a new landing starts the table over: its first card is the landing question again`, async ({ page }) => {
  const j = await setup(page, 1440, 900);
  expect(await answer(page, "wrong"), "card 1").toBe(true);
  await j.advance(100);
  await page.waitForTimeout(1700);
  await next(page, j);
  expect(await answerable(page, j, "wrong")).toBe(true);
  expect(await answer(page, "wrong"), "card 2").toBe(true);
  await j.advance(100);
  expect(Math.round((await st(page)).qMod * 100), "two steps on this exchange").toBe(WRONG_STEPS[0] + WRONG_STEPS[1]);
  const tech = await page.evaluate(() => { const a: any = (window as any).__neural; return a.nodes[a.optionIdxs[0]].t; });
  await j.rig("resolve", [0.01]);
  await j.rig("outcome", [0.01]);
  await j.rig("opp-finish", [0.99, 0.99, 0.99]);
  await j.rig("opp-pick", [0, 0, 0]);
  await j.pick(tech);
  expect(await j.nextHand(), "the next landing asks a question").not.toBeNull();
  await j.advance(200);
  await page.waitForTimeout(1700);
  expect((await named(page, "roll_end")).length, "the roll did not end").toBe(0);
  expect((await st(page)).qMod, "the old exchange's steps are forgiven on arrival").toBe(0);
  const before = await cards(page);
  expect(await answer(page, "wrong"), "the new landing's first card").toBe(true);
  await j.advance(100);
  const d = deltas(before, await cards(page), 4);
  expect(d.length > 0 && d.every((x) => x.d === WRONG_STEPS[0]), `the first step again, −4 (${JSON.stringify(d)})`).toBe(true);
  expect((await named(page, "land_q_answered")).length, "one landing question per landing").toBe(2);
  expect((await named(page, "land_q_extra")).map((b) => b.k), "the new landing's card is not a later card").toEqual([2]);
});

test(`a skip is free, and a card has one window per landing: paging back resumes it`, async ({ page }) => {
  const j = await setup(page, 1440, 900);
  const pos = (await st(page)).pos;
  const s0 = await st(page);
  expect(s0.remaining, "card 1's window is running").not.toBeNull();
  expect(s0.remaining as number, "…from (nearly) full: only the settle pump has run").toBeGreaterThan((s0.total as number) - 500);
  await j.advance(4000);
  const left1 = (await st(page)).remaining as number;
  expect(left1, "4 s spent on card 1").toBeLessThan((s0.total as number) - 3500);
  const q1 = (await st(page)).q;
  await next(page, j);
  const s2 = await st(page);
  expect(s2.q, "a different card").not.toBe(q1);
  // (the paging helper itself pumps a few game frames, so "full" is within 300 ms of the window)
  expect(s2.remaining as number, "a card seen for the first time gets a full window").toBeGreaterThan((s2.total as number) - 300);
  expect(s2.qMod, "the skip cost nothing").toBe(s0.qMod);
  expect(s2.combo, "…and moved no momentum").toBe(s0.combo);
  expect(await causes(page), "…and drew no outcome").toEqual([]);
  await j.advance(2000);
  const left2 = (await st(page)).remaining as number;
  // back to card 1: ITS window resumes, it is not refilled
  await j.clickByMouse("[data-land-prev]", "the previous-flashcard chevron");
  await expect.poll(async () => (await st(page)).page, { timeout: 10_000 }).toBe(0);
  const back = await st(page);
  expect(back.q, "card 1 again").toBe(q1);
  expect(Math.abs((back.remaining as number) - left1), `card 1 resumes at ${left1} ms, not a fresh ${back.total} ms (got ${back.remaining})`).toBeLessThanOrEqual(250);
  const bar = await page.evaluate(() => ((window as any).__neural._landEl?.querySelector("[data-land-clock]") as HTMLElement | null)?.style.transform || "");
  const f = Number(/scaleX\(([\d.]+)\)/.exec(bar)?.[1]);
  expect(Math.abs(f - left1 / (back.total as number)), `the bar shows what is left (${bar})`).toBeLessThanOrEqual(0.05);
  await next(page, j);
  expect(Math.abs(((await st(page)).remaining as number) - left2), "card 2 resumes too").toBeLessThanOrEqual(250);
  const resolved = [...(await named(page, "land_q_answered")), ...(await named(page, "land_q_extra")), ...(await named(page, "land_q_expired"))];
  expect(resolved, "paging resolved nothing").toEqual([]);
  await nothingCommitted(page, pos);
});
