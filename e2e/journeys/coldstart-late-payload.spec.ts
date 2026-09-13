import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * COLD START WITH THE PAYLOAD ACTUALLY LATE.
 *
 * Every other cold-start spec serves flashcards.json and curriculum.json from an in-memory buffer,
 * instantly. That is right for a gate — but it deleted the ONE fact the whole journey is about. On
 * the measured Fast-4G cold load of the real build
 * (tests/artifacts/coldstart/probe-throttled-timeline.json):
 *
 *      app_ready @ 2.5s -> hand_dealt @ 7.0s -> decks @ 25.3s -> dossier @ 27.0s
 *
 * an 18-second stretch in which the visitor plays their opening decision with no question, no
 * definition and no film. Held on an instant harness, that window does not exist, so a spec written
 * against it can only ever confirm the fast path. Two rounds of green tests said nothing about the
 * slow one, which is why every cold-start claim had to be taken on faith.
 *
 * These tests declare the skew (`boot({ payloads: { "flashcards/_index.json": { afterSim: 25 } } })`, see
 * PayloadRule in ../dsl) and then read the app's own instrumentation across it. No throttling, no
 * wall-clock assertions: sim time is pumped by the spec, so the ordering is exact on any machine.
 *
 * MIND THE ORIGIN. `afterSim` counts from BOOT, the same origin as the timeline above — so the
 * silence between the hand and the decks is `afterSim: 25`, and the assertion that pins it
 * measures `releasedAtSim - (sim clock when the hand was dealt)`, not lateness from boot.
 * Declared as 18 and measured from boot, this spec once modelled 13 of the 18 seconds it quoted.
 *
 * v1.168.0 MOVED ONE OF THE TWO EVENTS. The deck payload's 25.3s is a NETWORK fact and did not
 * change; the hand is a UI fact and did — the staged arrival deals it at ~10.2s (intro 3.2 +
 * arrival 6.2 + the deal), where the probe's build dealt at 7.0. The window this spec exists to
 * pin — the visitor playing their opening decision with no question, no definition, no film —
 * is therefore now ~15s, and the floor below is 25 − 10.2, minus the 1s the sim pump quantizes
 * by: 14. A mutant serving the decks instantly still goes red by ~24s.
 */

type Mark = {
  step: string;
  step_index: number;
  spine: boolean;
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
        out_of_order: b.out_of_order,
        skipped: b.skipped,
        late_after: b.late_after,
      })),
  );

/** the app's own first hand on a cold profile, ambient draws pinned, coach intact (the default) */
async function firstHand(j: any, page: any) {
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
  return j;
}

const firstTransition = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    for (const i of a.optionIdxs || [])
      if (a.nodes[i].ty === "transitions") return a.nodes[i].t;
    return a.nodes[(a.optionIdxs || [])[0]].t;
  });

test("cold start: the harness can hold a payload back, and the app plays its first hand without it", async ({
  page,
}) => {
  // THE CAPABILITY, USED. This is the state a 4G visitor's opening decision is actually taken in,
  // reached without stubbing anything on the app: the real fetch is simply still in flight.
  const j = journey(page);
  // afterSim is measured from BOOT, the same origin as the measured timeline — so the production skew
  // (decks @25.3s from boot; the hand @~10.2s since v1.167.0) is `afterSim: 25`, not the gap.
  // Declared as 18, with the harness dealing this hand at sim 5.0s, it modelled 13 of those 18
  // seconds — which is why the assertion at the bottom measures the gap FROM THE HAND, not from boot.
  await j.boot("/", {
    keepTutorial: true,
    payloads: { "flashcards/_index.json": { afterSim: 25 } },
  });
  expect(
    await page.evaluate(() => !!(window as any).__neural.flashcards),
    "the decks really have not landed — boot() did not wait for them either",
  ).toBe(false);

  await firstHand(j, page);
  const handAtSim = j.simElapsed(); // when the visitor's opening decision was actually put to them
  const atHand = await page.evaluate(() => ({
    options: ((window as any).__neural.optionIdxs || []).length,
    decks: !!(window as any).__neural.flashcards,
    hasQ: !!document.querySelector("[data-land-q]"),
    hasCard: !!document.querySelector("[data-landcard]"),
  }));
  expect(
    atHand.options,
    "a full playable hand is on the table",
  ).toBeGreaterThan(1);
  expect(atHand.hasCard, "and the identity card is up").toBe(true);
  expect(atHand.decks, "with the deck payload still outstanding").toBe(false);
  expect(
    atHand.hasQ,
    "so there is no question to answer — the skew, visible to a test for the first time",
  ).toBe(false);
  const skip = await page.evaluate(() =>
    (window as any).__neural.beats
      .filter((b: any) => b.beat === "land_q_skipped")
      .pop(),
  );
  expect(
    skip && skip.reason,
    "and the funnel names why, rather than leaving a phantom gap",
  ).toBe("decks_in_flight");

  // ── the payload lands, for real, through the app's own fetch().then() ──
  // THE FIRST LANDING MUST STILL BE LIVE when it does — the claim below is "the card the visitor
  // is STILL looking at". The 25s release sits past the decision window, so unpaused, auto-pick
  // plays on and roughly 1 run in 15 the roll ENDS before the release, leaving no landing to
  // backfill. Pausing is the visitor waiting, deterministically.
  await page.evaluate(() => (window as any).__neural.setPaused(true));
  // Pumped in SMALL steps on purpose: the delay layer polls the sim clock between advance() calls, so
  // one giant advance() would have the harness notice the release 27 seconds late and any measurement
  // of WHEN it landed would be an artefact of the pump size rather than the declared rule.
  for (let spent = 0; spent < 40000; spent += 500) {
    await j.advance(500);
    if (await page.evaluate(() => !!(window as any).__neural.flashcards)) break;
  }
  await page.waitForFunction(
    () => !!(window as any).__neural.flashcards,
    null,
    {
      timeout: 30_000,
    },
  );
  await j.advance(200); // one pump so the backfill's render is on the page
  // manifest → chunk → distractor pool is a WALL-clock fetch chain (no sim timers) — wait for
  // the dock, bounded; the assertion below still makes the claim.
  await page
    .waitForFunction(() => !!document.querySelector("[data-land-q]"), null, { timeout: 15_000 })
    .catch(() => {});
  expect(
    await page.locator("[data-land-q]").count(),
    "the card the visitor is STILL looking at gains its question",
  ).toBe(1);

  // the timeline is the evidence: requested near sim-zero, served ~25 simulated seconds later
  const tl = j.payloadTimeline().filter((p) => /flashcards\/_index\.json/.test(p.url));
  expect(tl.length, "the deck payload was requested exactly once").toBe(1);
  expect(
    tl[0].requestedAtSim,
    "asked for during boot, before any sim time was pumped",
  ).toBe(0);
  // THE SKEW IS A GAP BETWEEN TWO EVENTS, so it is measured between them. Asserting only
  // `releasedAtSim >= 18000` measured lateness from BOOT and quietly counted the seconds the
  // visitor spent waiting for the hand as part of the silence they endured WITH it.
  expect(
    tl[0].releasedAtSim! - handAtSim,
    `the decks land at least 14 simulated seconds AFTER the hand was dealt — the production skew ` +
      `(decks @25.3s from boot, hand @~10.2s under the v1.168.0 staged arrival). ` +
      `hand at ${handAtSim}ms, payload ${JSON.stringify(tl[0])}`,
  ).toBeGreaterThanOrEqual(14000);
});

test("cold start: a spine step that arrives too EARLY is stamped out of order", async ({
  page,
}) => {
  // ITEM 5. The self-describing stamp was added so "this failure mode can never recur silently" —
  // but it only scanned EARLIER spine steps for absence. The cold path produces the opposite shape:
  // with the decks 18s late, `question_shown` (spine 2) is backfilled AFTER `move_committed` (3) and
  // `outcome_seen` (4). Every earlier step is present, so a one-way check calls that clean, and an
  // ordered PostHog funnel then reads a 2-after-4 arrival as a fresh visitor entering at step 2 —
  // exactly the class of lie the stamp exists to prevent.
  // `never` + an explicit release rather than `afterSim` here: the claim is about ORDER, not about
  // how many seconds late, and holding until the spec says so makes the ordering exact regardless of
  // how long the travel and sweep legs happen to take.
  const j = journey(page);
  await j.boot("/", {
    keepTutorial: true,
    payloads: { "flashcards/_index.json": { never: true } },
  });
  await firstHand(j, page);

  // play the hand with no question available (the 4G visitor's opening decision)
  await j.rig("resolve", [0.01]);
  await j.rig("outcome", [0.01]);
  const target = await firstTransition(page);
  await page.locator(`[data-tech="${target}"]`).first().click();
  await expect(page.locator("[data-go]").first()).toBeVisible();
  await page.locator("[data-go]").first().click();
  await j.advanceUntil("sweep_land", 20000);
  // ...and on into the NEXT hand, which is where the backfill can land: `_landBackfill` requires a
  // live decision (a card whose turn is over must never be rewritten under the next state), so the
  // question the visitor is owed arrives on the state they are standing on NOW — with the commit and
  // its outcome already in the funnel behind it. That is precisely the too-early shape. nextHand()
  // rather than a fixed advance: the travel and sweep legs vary, and the roll may even end and
  // restart here — either way it pumps until a fresh hand is genuinely on the table.
  await j.nextHand();

  const before = (await marks(page)).map((m) => m.step);
  expect(before, "the commit and its outcome are already recorded").toEqual(
    expect.arrayContaining(["move_committed", "outcome_seen"]),
  );
  expect(
    before,
    "and the question has not been asked at all yet",
  ).not.toContain("question_shown");

  // ...and NOW the decks land, so the question is asked for the first time, out of turn
  j.releasePayload("flashcards/_index.json");
  await page.waitForFunction(
    () => !!(window as any).__neural.flashcards,
    null,
    {
      timeout: 30_000,
    },
  );
  await j.advance(400);
  // same wall-clock chain as above: manifest landed, but the chunk + pool hops resolve on real
  // time — wait for the shown mark, bounded, then assert.
  await page
    .waitForFunction(
      () =>
        ((window as any).__neural.csBeats || []).some(
          (b: any) => b.beat === "funnel" && b.step === "question_shown",
        ),
      null,
      { timeout: 15_000 },
    )
    .catch(() => {});

  const m = await marks(page);
  const q = m.find((x) => x.step === "question_shown");
  expect(q, "the question was eventually shown").toBeTruthy();
  expect(
    q!.skipped,
    "nothing EARLIER was missing — which is why a one-way check passed it",
  ).toBe(null);
  expect(
    q!.late_after,
    "the event names the later steps that had already happened",
  ).toContain("move_committed");
  expect(
    q!.out_of_order,
    "so the mark is stamped out of order in the direction that actually broke",
  ).toBe(true);
});

test("cold start: a slow link does not latch the newcomer into the uniform lottery for ever", async ({
  page,
}) => {
  // ITEM 6. WIN 1 biases the first-ever opening state toward one a beginner can NAME, using
  // curriculum.json's traffic weights. That file is a separate background fetch, so on a slow link it
  // can still be in flight at the very first draw — `_weightedStart` then degrades to the old uniform
  // pick, which is fine. What was NOT fine: `bjj-neural-firstroll` was written at the draw either way,
  // so the visitor whose connection is worst was marked "returning" while holding the OLD experience,
  // permanently. Held for the whole first roll here, the way a stalled request behaves.
  const j = journey(page);
  await j.boot("/", {
    keepTutorial: true,
    payloads: { "curriculum.json": { never: true } },
  });
  expect(
    await page.evaluate(() => !!(window as any).__neural.curriculum),
    "the traffic weights are not there yet",
  ).toBe(false);

  const degraded = await page.evaluate(() => {
    const a = (window as any).__neural;
    a.rig("start-pos", [0.42]);
    a.rig("role", [0]);
    a.startRoll();
    return {
      pos: a.nodes[a.currentPos].t,
      marked: localStorage.getItem("bjj-neural-firstroll"),
      firstRollDone: !!a._firstRollDone,
      returning: a._returningVisitor(),
    };
  });
  expect(
    degraded.marked,
    `a draw that could not be weighted must not spend the first impression — the marker may record that one is still OWED, never that it was given (opened on ${degraded.pos})`,
  ).not.toBe("1");
  expect(
    degraded.firstRollDone,
    "and the first-ever branch stays armed, so it can still be given",
  ).toBe(false);

  // the connection comes back mid-session: the next roll takes the biased draw it was owed
  j.releasePayload("curriculum.json");
  await page.waitForFunction(
    () => !!(window as any).__neural.curriculum,
    null,
    { timeout: 30_000 },
  );
  const recovered = await page.evaluate(() => {
    const a = (window as any).__neural;
    const NAMES = [
      "Closed Guard Top",
      "Standing Position Top",
      "Side Control Top",
      "Half Guard Top",
      "Open Guard Top",
      "Mount Top",
    ];
    // sweep the whole draw so this is a statement about the distribution, not one lucky u
    let nameable = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      a._firstRollDone = false;
      a.rig("start-pos", [(i + 0.5) / N]);
      a.startRoll();
      if (NAMES.indexOf(a.nodes[a.currentPos].t) >= 0) nameable++;
    }
    return {
      share: nameable / N,
      marked: localStorage.getItem("bjj-neural-firstroll"),
    };
  });
  expect(
    recovered.share,
    `once the weights land, the biased draw is back (uniform would be 0.044); got ${recovered.share.toFixed(3)}`,
  ).toBeGreaterThan(0.4);
  expect(
    recovered.marked,
    "and NOW the first impression is recorded as GIVEN, not merely owed",
  ).toBe("1");
});

/**
 * ...AND THE OTHER TWO WAYS THE SAME IMPRESSION WAS SPENT.
 *
 * `bjj-neural-firstroll` is now withheld when the draw could not be weighted. But it is only ONE of
 * the three markers `_returningVisitor()` reads, and the other two are written by ordinary play in
 * the very visit whose draw degraded: `bjj-neural-coached` when the newcomer finishes the 3-panel
 * coach, and `bjj-neural-progress` on the first save (grading a card is enough). Within the session
 * that is harmless — `_returningVisitor` is latched once per app life — but the visitor RELOADS, or
 * comes back tomorrow, and now the profile says "been here before" while the biased opening they were
 * owed has never been given. The newcomer on the worst connection keeps the ~95%-unnameable opening
 * for ever: exactly the defect the firstroll fix was for, reached by a different door.
 *
 * So the rule is the rule, whichever marker is involved: a first impression that could not be made
 * properly has not been spent. The degraded draw records that it is still OWED, durably, and that
 * outranks any evidence of ordinary play.
 */
// v1.104.0: the "finishing the coach" case is GONE with the coach — finishCoach() no longer
// exists and `bjj-neural-coached` has no writer. The RULE it exercised is unchanged and is still
// covered by the progress-save case below: a marker written by ordinary play must not be read as
// evidence that a first impression was given. If a third marker is ever added, it belongs here.
for (const [what, spend] of [
  [
    "the first progress save",
    () => {
      const a = (window as any).__neural;
      a.prep = a.prep || {};
      a.prep["Mount|Top"] = 1;
      a._flushSave(); // writes bjj-neural-progress
    },
  ],
] as const) {
  test(`cold start: ${what} does not spend a first impression that was never given`, async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", {
      keepTutorial: true,
      payloads: { "curriculum.json": { never: true } },
    });

    // the degraded first draw: the weights are not there, so the opening is the old uniform pick
    const degraded = await page.evaluate(() => {
      const a = (window as any).__neural;
      a.rig("start-pos", [0.42]);
      a.rig("role", [0]);
      a.startRoll();
      return {
        weights: !!a.curriculum,
        marker: localStorage.getItem("bjj-neural-firstroll"),
      };
    });
    expect(degraded.weights, "the traffic weights never landed").toBe(false);
    expect(
      degraded.marker,
      "so the impression is not recorded as GIVEN (v1.82.4 already fixed that much)",
    ).not.toBe("1");

    // ...and now the visitor does the most ordinary thing there is, which writes the other marker
    await page.evaluate(spend);

    // they come back. The connection is fine this time, so the bias is available — the only question
    // is whether the app still believes it owes them an opening.
    await j.boot("/", { keepTutorial: true, preserveStorage: true });
    expect(
      await page.evaluate(() => !!(window as any).__neural.curriculum),
      "the weights are there on this visit",
    ).toBe(true);

    const NAMES = [
      "Closed Guard Top",
      "Standing Position Top",
      "Side Control Top",
      "Half Guard Top",
      "Open Guard Top",
      "Mount Top",
    ];
    const now = await page.evaluate((names) => {
      const a = (window as any).__neural;
      let nameable = 0;
      const N = 200;
      const seen: Record<string, number> = {};
      for (let i = 0; i < N; i++) {
        a._firstRollDone = false; // re-arm the first-ever branch, as the sweeps above do
        a.rig("start-pos", [(i + 0.5) / N]);
        a.startRoll();
        const t = a.nodes[a.currentPos].t;
        seen[t] = (seen[t] || 0) + 1;
        if ((names as string[]).indexOf(t) >= 0) nameable++;
      }
      return {
        share: nameable / N,
        marker: localStorage.getItem("bjj-neural-firstroll"),
        top: Object.entries(seen)
          .sort((x, y) => (y[1] as number) - (x[1] as number))
          .slice(0, 4),
      };
    }, NAMES);

    expect(
      now.share,
      `the opening they were owed is finally given (uniform would be 0.044); got ${now.share.toFixed(3)} — top: ${JSON.stringify(now.top)}`,
    ).toBeGreaterThan(0.4);
    expect(
      now.marker,
      "and NOW it is recorded as spent, so it happens exactly once",
    ).toBe("1");
  });
}

test("cold start: a payload that never arrives leaves a playable app, not a broken one", async ({
  page,
}) => {
  // The `never` rule is not a 404: an aborted fetch takes the app's `.catch()` branch, a stalled one
  // leaves the promise pending for ever. This pins the pending case, which is the one a real mobile
  // radio produces and the one no spec could express before.
  const j = journey(page);
  await j.boot("/", {
    keepTutorial: true,
    payloads: { "flashcards/_index.json": { never: true } },
  });
  await firstHand(j, page);
  await j.rig("resolve", [0.01]);
  await j.rig("outcome", [0.01]);
  const target = await firstTransition(page);
  await page.locator(`[data-tech="${target}"]`).first().click();
  await expect(page.locator("[data-go]").first()).toBeVisible();
  await page.locator("[data-go]").first().click();
  await j.advanceUntil("sweep_land", 20000);
  await j.nextHand();

  expect(
    await page.evaluate(() => !!(window as any).__neural.flashcards),
    "the decks never came",
  ).toBe(false);
  const m = (await marks(page)).map((x) => x.step);
  expect(
    m,
    "and the visitor still got a whole exchange out of the app",
  ).toEqual(
    expect.arrayContaining(["hand_dealt", "move_committed", "outcome_seen"]),
  );
  // v1.101.1: the identity block left the card — the roll settles at ROLL_ZOOM and the GRAPH
  // names the state (inside the node until v1.114.0, beside it since). The DOM-visible half of
  // "they know where they are" is the landing card being up at all.
  expect(
    await page.locator("[data-landcard]").count(),
    "every landing still puts its card up",
  ).toBe(1);
  const skips = await page.evaluate(() =>
    (window as any).__neural.beats
      .filter((b: any) => b.beat === "land_q_skipped")
      .map((b: any) => b.reason),
  );
  expect(
    new Set(skips),
    "and every silent landing is accounted for by name, not by absence",
  ).toEqual(new Set(["decks_in_flight"]));
  const tl = j.payloadTimeline().filter((p) => /flashcards\/_index\.json/.test(p.url));
  expect(tl[0].releasedAtSim, "the request was still open at the end").toBe(
    null,
  );
});
