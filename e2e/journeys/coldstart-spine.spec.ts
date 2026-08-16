import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * COLD-START SPINE — does the recorded funnel describe what actually happened?
 *
 * The v1.82.0 instrumentation documented one spine and the DEFAULT path records another. That is
 * worse than no instrumentation: an ordered PostHog funnel built on the documented order would
 * report a drop-off that never happened, and hide the one that did.
 *
 * v1.104.0: the 3-panel first-roll coach is DELETED (owner), so the default path is now simply
 * the landing card + the hand. What this file measures is unchanged and was never really about
 * the coach: a curious newcomer opens an option sheet, grades a flashcard inside it, and Executes.
 * Such a visitor commits their
 * first move having never been shown the landing question at all.
 *
 * These tests assert the RECORDED order, not the intended one.
 */

type Mark = {
  step: string;
  step_index: number;
  spine: boolean;
  ms_since_nav: number;
  reason?: string;
  out_of_order: boolean;
  skipped: string | null;
  late_after: string | null;
};

const marks = (page: any): Promise<Mark[]> =>
  page.evaluate(() =>
    ((window as any).__neural.csBeats || [])
      .filter((b: any) => b.beat === "funnel")
      .map((b: any) => ({
        step: b.step,
        step_index: b.step_index,
        spine: b.spine,
        ms_since_nav: b.ms_since_nav,
        reason: b.reason,
        out_of_order: b.out_of_order,
        skipped: b.skipped,
        late_after: b.late_after,
      })),
  );

const spineOf = (m: Mark[]) => m.filter((x) => x.spine).map((x) => x.step);

/** the app's own first hand — only the ambient draws are pinned.
 *
 *  `payloads` is how a test STATES THE CONDITION IT HOLDS UNDER. Every assertion in this file used to
 *  be written as if the funnel's shape were unconditional, when in fact it rested entirely on the
 *  harness serving flashcards.json out of an in-memory buffer, instantly — the one thing a Fast-4G
 *  cold start does not do (hand @7.0s, decks @25.3s). An unconditional claim that only holds with
 *  instant payloads is worse than no claim, so the condition is now declared AND asserted below. */
async function coldFirstHand(
  page: any,
  payloads?: Record<string, { afterSim?: number; never?: boolean }>,
) {
  const j = journey(page);
  await j.boot("/", { keepTutorial: true, ...(payloads ? { payloads } : {}) });
  expect(
    await page.evaluate(() => (window as any).__neural._cs.cold),
    "the app classifies this visitor as cold",
  ).toBe(true);
  await j.rig("start-pos", [0.42]);
  await j.rig("role", [0]);
  await j.rig("ai-skill", [0.5]);
  await j.rig("max-moves", [0.5]);
  for (let i = 0; i < 12; i++) {
    await j.advance(1000);
    if (
      (await page.evaluate(
        () => ((window as any).__neural.optionIdxs || []).length,
      )) > 0
    )
      break;
  }
  // (the coach assertion that used to sit here died with the coach in v1.104.0)
  // THE CONDITION, on the record: whether the comprehension payload is on the table when the first
  // decision is taken is the entire difference between the two funnel shapes asserted below.
  expect(
    await page.evaluate(() => !!(window as any).__neural.flashcards),
    payloads
      ? "the decks are STILL IN FLIGHT for this walk (the 4G cold start)"
      : "the decks are already cached for this walk (a warm reload / a fast link)",
  ).toBe(!payloads);
  return j;
}

/** the curious newcomer's own first commit: open a sheet, grade a flashcard in it, Execute.
 *  `grade` is false when the decks are still in flight — the card does not exist yet, which is
 *  itself part of the cold story. */
async function exploreThenCommit(j: any, page: any, grade = true) {
  const target = await page.evaluate(() => {
    const a = (window as any).__neural;
    for (const i of a.optionIdxs || [])
      if (a.nodes[i].ty === "transitions") return a.nodes[i].t;
    return a.nodes[(a.optionIdxs || [])[0]].t;
  });
  await page.locator(`[data-tech="${target}"]`).first().click(); // panel 2
  await expect(page.locator("[data-go]").first()).toBeVisible();
  if (grade) await j.drill(1); // panel 3, first half: grade a flashcard in the sheet
  await page.locator("[data-go]").first().click(); // panel 3, second half: Execute
  return j;
}

test("cold start: a newcomer who explores a sheet first still gets asked the landing question — decks already cached", async ({
  page,
}) => {
  const j = await coldFirstHand(page);

  // ── the curious path: tap a card to open its sheet, grade a flashcard inside it, Execute. ──
  await exploreThenCommit(j, page);

  // the landing question is the app's central comprehension mechanic. On the DEFAULT path it must
  // reach the visitor before they commit — or, if it genuinely cannot, the funnel must SAY SO.
  const m = await marks(page);
  const committedAt = m.findIndex((x) => x.step === "move_committed");
  expect(committedAt, "the move was committed").toBeGreaterThanOrEqual(0);
  const before = m.slice(0, committedAt).map((x) => x.step);
  // STRICT under this condition, and that strictness is the point. The decks are CACHED here
  // (asserted in coldFirstHand), so there is no legitimate reason for the question not to be
  // asked — accepting `question_skipped` as well would make this test unable to fail for the very
  // thing its name claims ("still gets asked the landing question"). The shown-or-explained
  // DISJUNCTION belongs only on the decks-in-flight walk below, where a skip is honest.
  expect(
    before,
    "with the decks already cached the question must be SHOWN before the first commit — no skip is legitimate here",
  ).toEqual(expect.arrayContaining(["question_shown"]));
  expect(
    m.find((x) => x.step === "question_skipped"),
    "nothing may be skipped on the cached path",
  ).toBeUndefined();
});

/** every recorded spine mark that did not arrive in its own position, and whether it says so */
const outOfPlace = (m: Mark[]) => {
  const sp = m.filter((x) => x.spine);
  return sp
    .map((x, i) => ({
      step: x.step,
      at: x.step_index,
      recordedAt: i,
      stamped: !!x.out_of_order,
      cause: (x as any).skipped || (x as any).late_after || null,
    }))
    .filter((r) => r.at !== r.recordedAt);
};

test("cold start: the recorded spine is contiguous — WHEN the comprehension payloads are already cached", async ({
  page,
}) => {
  // The condition is in the name and asserted in coldFirstHand, because it is doing all the work:
  // with flashcards.json in the harness's buffer the question is on the card before the first
  // decision, so the spine really is app_ready -> hand_dealt -> question_shown -> commit -> outcome.
  // Stated unconditionally (as this test was), it claimed a property of the app that only the
  // harness provided — see the companion test below for what the real cold path records.
  const j = await coldFirstHand(page);
  await exploreThenCommit(j, page);
  await j.advanceUntil("sweep_land", 20000);
  await j.advance(2500);

  const m = await marks(page);
  // A PostHog ordered funnel is built on `step` in spine order. For it to mean anything, every
  // spine mark that IS recorded must arrive with no earlier spine mark still missing — otherwise
  // the funnel reports a drop at a step the visitor sailed past.
  const sp = spineOf(m);
  expect(
    outOfPlace(m),
    `spine recorded as ${JSON.stringify(sp)} — with the decks cached, every recorded spine step must be contiguous from app_ready`,
  ).toEqual([]);
});

test("cold start: with the decks 25s out the spine is NOT contiguous — and every out-of-place mark says so", async ({
  page,
}) => {
  // THE SAME WALK ON THE REAL COLD PATH. Fast-4G: hand @7.0s, decks @25.3s. The question cannot be
  // asked before the first commit, so contiguity is physically unavailable — and asserting it (which
  // is what the unqualified version of the test above did) would only ever be green on a harness that
  // pretends the payload is instant. What IS unconditional, and what an ordered funnel actually needs,
  // is that a gap is never SILENT: every mark that arrives out of position carries `out_of_order` and
  // names its cause (`skipped` for a step still missing behind it, `late_after` for steps already
  // past), and a landing that could ask nothing emits `question_skipped` with a reason.
  const j = await coldFirstHand(page, { "flashcards/_index.json": { afterSim: 25 } });
  await exploreThenCommit(j, page, false); // panel 3 asks for a flashcard that does not exist yet
  await j.advanceUntil("sweep_land", 20000);

  const mid = await marks(page);
  expect(
    spineOf(mid),
    "the visitor committed and saw the outcome with no question in between",
  ).toEqual(expect.arrayContaining(["move_committed", "outcome_seen"]));
  expect(
    spineOf(mid),
    "which is a real hole in the ordered funnel",
  ).not.toContain("question_shown");
  const skip = await page.evaluate(() =>
    (window as any).__neural.csBeats
      .filter((b: any) => b.beat === "funnel" && b.step === "question_skipped")
      .pop(),
  );
  expect(
    skip && skip.reason,
    "and the hole has a NAMED cause, not a phantom drop-off",
  ).toBe("decks_in_flight");

  // ...then the payload lands (afterSim: 25, the measured arrival) and the question is backfilled
  // onto the state being played — arriving after the commit it belongs in front of.
  await j.advance(26000);
  await page.waitForFunction(
    () => !!(window as any).__neural.flashcards,
    null,
    {
      timeout: 30_000,
    },
  );
  await j.advance(600);

  const m = await marks(page);
  const off = outOfPlace(m);
  // RECORDED RED (v1.82.5): the previous version of this file asserted `outOfPlace(m) == []` with no
  // condition attached. Evaluated here, on the path it was silently excluding, it fails with
  //   spine ["app_ready","hand_dealt","move_committed","outcome_seen","roll_ended","question_shown"]
  // and four out-of-place marks (move_committed/outcome_seen/roll_ended each skipped:"question_shown";
  // question_shown late_after:"move_committed,outcome_seen,roll_ended"). All four stamped — which is
  // the property that IS unconditional, asserted below.
  expect(
    off.length,
    `the cold path really does record the spine out of order: ${JSON.stringify(spineOf(m))}`,
  ).toBeGreaterThan(0);
  const silent = off.filter((r) => !r.stamped || !r.cause);
  expect(
    silent,
    `every out-of-place spine mark must stamp itself and name a cause — these did not: ${JSON.stringify(silent)}`,
  ).toEqual([]);
});

test("cold start: an early bounce is recorded — the confusion window is covered", async ({
  page,
}) => {
  // The funnel exists to find the visitor who leaves confused. That happens EARLY: before the
  // first hand, staring at a jargon option under a clock. v1.82.0 registered
  // pagehide/visibilitychange at the very end of boot(), after the graph ingest and the loader
  // teardown — so the whole pre-hand window emitted nothing at all when the tab went away.
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });

  // a bounce BEFORE any hand: the visitor never even reached the first decision
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const bail = await page.evaluate(() =>
    (window as any).__neural.csBeats
      .filter((b: any) => b.beat === "funnel_abandon")
      .pop(),
  );
  expect(bail, "leaving before the first hand is reported").toBeTruthy();
  expect(bail.cold, "and attributed to a cold visitor").toBe(true);
  expect(bail.furthest_step, "naming how far they actually got").toBe(
    "app_ready",
  );
});

test("cold start: leaving while the loader is still up is recorded", async ({
  page,
}) => {
  // THE WINDOW THAT MATTERS. On the measured Fast-4G cold load the loader is up for ~2.5s before
  // app_ready and the first hand does not arrive until 7.0s. v1.82.0 registered the hide listeners
  // at the END of boot(), downstream of the graph ingest — so a visitor who gave up during that
  // whole stretch emitted nothing, and the earliest, most likely bounce was invisible to the very
  // funnel built to find it. Here the graph payload is held open so the app is mid-boot, exactly
  // as a slow link leaves it, and the tab goes away.
  const j = journey(page);
  // The graph payload never answers, so the app sits mid-boot exactly as a stalled link leaves it.
  // This used to need a THROWAWAY BOOT: the DSL registered its graph-data handler once, Playwright
  // matches routes last-first, so the only way to get above it was to let one boot install the
  // routes and register a competing handler afterwards. The DSL now owns a delay layer above every
  // handler (see PayloadRule), so the FIRST navigation can already be held. `unready` returns as
  // soon as the app instance exists — boot()'s readiness gate is downstream of everything here.
  await j.boot("/", {
    keepTutorial: true,
    unready: true,
    payloads: { "graph-data.json": { never: true } },
  });
  expect(
    await page.evaluate(() => !!(window as any).__neural?._cs),
    "the funnel is armed while the app is still booting",
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      ((window as any).__neural.csBeats || []).some(
        (b: any) => b.beat === "funnel" && b.step === "app_ready",
      ),
    ),
    "and app_ready has NOT fired yet — this is the pre-paint window",
  ).toBe(false);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  const bail = await page.evaluate(() =>
    ((window as any).__neural.csBeats || [])
      .filter((b: any) => b.beat === "funnel_abandon")
      .pop(),
  );
  expect(
    bail,
    "giving up on the loader is reported — the earliest bounce is measurable",
  ).toBeTruthy();
  expect(bail.cold, "as a cold visitor").toBe(true);
  expect(
    bail.furthest_step,
    "who got nowhere at all, and the event says exactly that",
  ).toBe("none");
  // the graph payload was still in flight the whole time — the harness says so, not the narrative
  const held = j.payloadTimeline().filter((p) => /graph-data/.test(p.url));
  expect(held.length, "the graph payload was requested").toBeGreaterThan(0);
  expect(
    held[held.length - 1].releasedAtMs,
    "and never answered while the visitor was staring at the loader",
  ).toBe(null);
  j.releasePayload("graph-data.json"); // let the boot finish so teardown is clean
});

test("cold start: the abandon listeners are armed before the graph is ingested", async ({
  page,
}) => {
  // Structural pin for the same gap: registration must not sit downstream of the heavy work.
  // A cold visitor on a slow link spends SECONDS in boot() before the loader comes down; if the
  // listeners are registered after it, that entire window is unmeasurable by construction.
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
  const order = await page.evaluate(
    () => (window as any).__neural._cs.armedBefore || null,
  );
  expect(
    order,
    "_cs records that the hide listeners were armed during _csInit, before ingest",
  ).toBe(true);
});
