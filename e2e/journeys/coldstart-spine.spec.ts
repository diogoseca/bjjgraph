import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * COLD-START SPINE — does the recorded funnel describe what actually happened?
 *
 * The v1.82.0 instrumentation documented one spine and the DEFAULT path records another. That is
 * worse than no instrumentation: an ordered PostHog funnel built on the documented order would
 * report a drop-off that never happened, and hide the one that did.
 *
 * The default path is COACHED. Every genuinely cold visitor gets the 3-panel coach on their first
 * landing (maybeStartCoach fires from enterLand(first) unless `bjj-neural-coached` is set), the
 * coach suppresses the landing card entirely (`renderLandCard` returns null while `_coach`), and
 * coach panels 2 and 3 tell the newcomer, in words, to open an option sheet, grade a flashcard
 * inside it, and Execute. A newcomer who does exactly what the coach says therefore commits their
 * first move having never been shown the landing question at all.
 *
 * These tests assert the RECORDED order, not the intended one.
 */

type Mark = {
  step: string;
  step_index: number;
  spine: boolean;
  ms_since_nav: number;
  coach_open: boolean;
  reason?: string;
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
        coach_open: b.coach_open,
        reason: b.reason,
      })),
  );

const spineOf = (m: Mark[]) => m.filter((x) => x.spine).map((x) => x.step);

/** the app's own first hand, coach intact — only the ambient draws are pinned */
async function coldFirstHand(page: any) {
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
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
  expect(
    await page.evaluate(() => !!(window as any).__neural._coach),
    "the coach owns the first landing (this IS the default path)",
  ).toBe(true);
  return j;
}

test("cold start: a newcomer who obeys the coach still gets asked the landing question", async ({
  page,
}) => {
  const j = await coldFirstHand(page);

  // ── do EXACTLY what the coach says. Panel 2: "Tap a card to open its sheet". Panel 3: "Inside
  // the sheet, grade a flashcard... Then Execute." No Next, no Skip — the copy never says to
  // dismiss anything, and a first-timer following instructions has no reason to. ──
  const target = await page.evaluate(() => {
    const a = (window as any).__neural;
    for (const i of a.optionIdxs || [])
      if (a.nodes[i].ty === "transitions") return a.nodes[i].t;
    return a.nodes[(a.optionIdxs || [])[0]].t;
  });
  await page.locator(`[data-tech="${target}"]`).first().click(); // panel 2
  await expect(page.locator("[data-go]").first()).toBeVisible();
  await j.drill(1); // panel 3, first half: grade a flashcard in the sheet
  await page.locator("[data-go]").first().click(); // panel 3, second half: Execute

  // the landing question is the app's central comprehension mechanic. On the DEFAULT path it must
  // reach the visitor before they commit — or, if it genuinely cannot, the funnel must SAY SO.
  const m = await marks(page);
  const committedAt = m.findIndex((x) => x.step === "move_committed");
  expect(committedAt, "the move was committed").toBeGreaterThanOrEqual(0);
  const before = m.slice(0, committedAt).map((x) => x.step);
  expect(
    before,
    "the funnel accounts for the question before the first commit: either it was shown, or a mark names why it was not",
  ).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^question_(shown|skipped)$/),
    ]),
  );

  // and if it was skipped, the mark carries the REASON — an unexplained gap is the phantom
  const skipped = m.find((x) => x.step === "question_skipped");
  if (skipped) expect(skipped.reason, "the skip names its cause").toBeTruthy();
});

test("cold start: the recorded spine is monotonic, so an ordered funnel cannot lie", async ({
  page,
}) => {
  const j = await coldFirstHand(page);
  const target = await page.evaluate(() => {
    const a = (window as any).__neural;
    for (const i of a.optionIdxs || [])
      if (a.nodes[i].ty === "transitions") return a.nodes[i].t;
    return a.nodes[(a.optionIdxs || [])[0]].t;
  });
  await page.locator(`[data-tech="${target}"]`).first().click();
  await expect(page.locator("[data-go]").first()).toBeVisible();
  await j.drill(1);
  await page.locator("[data-go]").first().click();
  await j.advanceUntil("sweep_land", 20000);
  await j.advance(2500);

  const m = await marks(page);
  // A PostHog ordered funnel is built on `step` in spine order. For it to mean anything, every
  // spine mark that IS recorded must arrive with no earlier spine mark still missing — otherwise
  // the funnel reports a drop at a step the visitor sailed past.
  const sp = spineOf(m);
  const idx = m.filter((x) => x.spine).map((x) => x.step_index);
  const gaps: string[] = [];
  for (let i = 0; i < idx.length; i++)
    if (idx[i] !== i)
      gaps.push(`${sp[i]}@index${idx[i]}(recorded position ${i})`);
  expect(
    gaps,
    `spine recorded as ${JSON.stringify(sp)} — every recorded spine step must be contiguous from app_ready`,
  ).toEqual([]);
});

test("cold start: an early bounce is recorded — the confusion window is covered", async ({
  page,
}) => {
  // The funnel exists to find the visitor who leaves confused. That happens EARLY: before the
  // first hand, during the coach, staring at a jargon option under a clock. v1.82.0 registered
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
