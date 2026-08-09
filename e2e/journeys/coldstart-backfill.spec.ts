import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * COLD-START BACKFILL — journey 3, Phase 2: the worst thing the Phase 1 measurement found.
 *
 * The app's comprehension payloads are deferred on purpose (flashcards.json 4.3MB gz,
 * technique-content.js 5.3MB gz — first paint must not wait on them). On a Fast-4G cold load of
 * the real build, measured in tests/artifacts/coldstart/probe-throttled-timeline.json:
 *
 *      app_ready @ 2.5s → hand_dealt @ 7.0s (10 options) → decks @ 25.3s → content @ 27.0s
 *
 * So a first-time visitor's opening decision is taken with NO landing question, NO definition and
 * NO film: the card reads "X-Guard Top / Top / ○ / MORE ▸" over a jargon hand with a clock
 * running. That much is a payload-size problem (journey 1 owns it). What makes it a BUG is what
 * happens when the payload finally lands mid-turn: `onFlashcardsReady()` refreshes the drill
 * panel, the option odds and the drill tab — but never the landing card. The state that greeted
 * the visitor in silence stays silent for its ENTIRE turn, so the question-first landing (the
 * app's central comprehension mechanic) never happens for their first decision.
 * Evidence: tests/artifacts/coldstart/probe-late-payload.json — before and after
 * `onFlashcardsReady()`, `hasQ:false`.
 *
 * These are gate-quality tests: deterministic, hermetic, no throttling, no timing assertions.
 * The payload is stashed and handed back through the SAME hook production's `fetch().then()`
 * calls, because the harness cannot boot without decks (`boot()` waits for them).
 */

type Read = {
  hasQ: boolean;
  hasDef: boolean;
  mcOpts: number;
  pos: string | null;
  decisionLeft: number;
  qShown: number;
  funnel: string[];
};

const read = (page: any): Promise<Read> =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    return {
      hasQ: !!document.querySelector("[data-land-q]"),
      hasDef: !!document.querySelector("[data-land-def]"),
      mcOpts: document.querySelectorAll("[data-land-mc-opt]").length,
      pos: a && a.currentPos != null ? a.nodes[a.currentPos]?.t : null,
      decisionLeft: a.decisionRemaining ? a.decisionRemaining() : 0,
      qShown: (a.beats || []).filter((b: any) => b.beat === "land_q_shown")
        .length,
      funnel: (a.beats || [])
        .filter((b: any) => b.beat === "funnel")
        .map((b: any) => b.step),
    };
  });

// the deck payload is still in flight: neural.js and graph-data.json have landed (the app is
// playable), flashcards.json has not. This is the state a 4G visitor plays their first turn in.
const withoutDecks = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    (window as any).__ngDecks = a.flashcards;
    a.flashcards = null;
  });

// ...and now it lands, through the exact seam boot()'s fetch uses
const decksArrive = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    a.flashcards = (window as any).__ngDecks;
    a.onFlashcardsReady();
  });

test("cold start: the deck payload landing mid-turn gives the CURRENT state its question", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/", { keepTutorial: true }); // genuinely fresh profile: no progress, no objectives
  await withoutDecks(page);
  await j.land("Mount Top"); // first roll, coach read and dismissed — the hand is on the table

  const before = await read(page);
  expect(
    before.hasQ,
    "no deck payload yet, so the state greets the visitor in silence",
  ).toBe(false);
  expect(
    before.decisionLeft,
    "and it is still their turn — they have not committed yet",
  ).toBeGreaterThan(0);
  expect(
    before.funnel,
    "the funnel has nothing to report either",
  ).not.toContain("question_shown");

  // ── the payload arrives while they are still reading the same hand ──
  await decksArrive(page);

  const after = await read(page);
  expect(after.pos, "still the same state — the roll has not moved on").toBe(
    before.pos,
  );
  expect(
    after.hasQ,
    "the card the visitor is looking at gains its question",
  ).toBe(true);
  expect(after.mcOpts, "as real multiple choice").toBeGreaterThan(1);
  expect(after.funnel, "and the funnel records it").toContain("question_shown");

  // the fix is measurable, not just visible: the beat says this question was backfilled
  const shown = await page.evaluate(() =>
    (window as any).__neural.beats
      .filter((b: any) => b.beat === "land_q_shown")
      .pop(),
  );
  expect(shown.backfill, "the beat marks it as a late arrival").toBe(true);

  // it is a REAL surface, clicked by mouse: Playwright hit-tests, so this also pins the
  // pointer-events:auto trap (a fixed overlay that does not re-enable it is unclickable —
  // the canvas hit-tests above it — and keyboard-only tests mask that entirely)
  await page.locator("[data-land-mc-opt]").first().click();
  await j.expectBeat("land_q_answered");
  expect(
    (await read(page)).funnel,
    "the cold-start funnel reaches its answer step",
  ).toContain("question_answered");
});

test("cold start: the dossier payload landing mid-turn gives the current state its definition", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
  await withoutDecks(page); // both heavy payloads are outstanding
  await j.land("Mount Top");
  expect((await read(page)).hasDef, "no dossier payload, no definition").toBe(
    false,
  );

  // technique-content.js lands (the harness aborts the real 21MB file, so inject the shape it
  // defines for exactly the state being played) and calls its ready hook
  await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key;
    (window as any).NG_CONTENT = {
      decks: { [key]: { def: "A one-line definition of where you are." } },
    };
    a.onContentReady();
  });

  const after = await read(page);
  expect(after.hasDef, "the definition backfills onto the live card").toBe(
    true,
  );
  expect(
    await page.locator("[data-land-def]").first().innerText(),
    "in the page's own words",
  ).toContain("definition of where you are");
});

test("cold start: a payload arriving behind the expand sheet stays behind it", async ({
  page,
}) => {
  // The expand sheet owns the screen while it is up and hides the landing card with two inline
  // styles, restoring them on close. A backfilled card must inherit that hide — otherwise it pops
  // into view over the sheet the player is reading.
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
  await withoutDecks(page);
  await j.land("Mount Top");
  const target = await page.evaluate(() => {
    const a = (window as any).__neural;
    for (const i of a.optionIdxs || [])
      if (a.nodes[i].ty === "transitions") return a.nodes[i].t;
    return a.nodes[(a.optionIdxs || [])[0]].t;
  });
  await page.locator(`[data-tech="${target}"]`).first().click(); // open the sheet, do NOT execute
  await expect(page.locator("[data-go]").first()).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (document.querySelector(".ng-landcard") as HTMLElement).style.opacity,
    ),
    "the sheet owns the screen",
  ).toBe("0");

  await decksArrive(page); // the payload lands while the sheet is up

  expect(
    await page.evaluate(
      () =>
        (document.querySelector(".ng-landcard") as HTMLElement).style.opacity,
    ),
    "the backfilled card stays hidden behind the sheet",
  ).toBe("0");
  // back out of the sheet without executing (the ✕ / back buttons carry no data handle, so this
  // is their choke). NB until this journey found it, the animated collapse path never restored
  // the landing card at all — peeking at an option and backing out hid it for the rest of the turn.
  await page.evaluate(() => (window as any).__neural.closeOptionDetail());
  expect(
    await page.evaluate(
      () =>
        (document.querySelector(".ng-landcard") as HTMLElement).style.opacity,
    ),
    "and comes back when the sheet leaves",
  ).toBe("");
  expect((await read(page)).hasQ, "carrying the question it was owed").toBe(
    true,
  );
});

test("cold start: a payload arriving after the question was answered never re-asks it", async ({
  page,
}) => {
  // CANON GUARD. Mastery is recall-proven and an MC answer is scored once; re-mounting a card the
  // player has already answered would hand out a second attempt at the same credit. So the
  // backfill is only allowed to fill a card that has never shown a question — everything else is
  // frozen, including a question already on the table (reshuffling it mid-read would be worse
  // than the missing definition it would add).
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
  await j.land("Mount Top"); // decks present from the start: the question is there immediately
  await expect(page.locator("[data-land-q]")).toHaveCount(1);
  await page.evaluate(() =>
    document
      .querySelector("[data-land-q]")!
      .setAttribute("data-identity-probe", "1"),
  );
  await page.locator("[data-land-mc-opt]").first().click();
  await j.expectBeat("land_q_answered");
  const answered = await read(page);

  // a late payload event fires (in production: the dossier payload, or a re-entrant ready hook)
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.onFlashcardsReady();
    a.onContentReady();
  });

  expect(
    await page.locator("[data-land-q][data-identity-probe]").count(),
    "the answered question block is the SAME element — nothing re-mounted it",
  ).toBe(1);
  expect((await read(page)).qShown, "and no second question was shown").toBe(
    answered.qShown,
  );
  expect(
    await page.evaluate(
      () =>
        (window as any).__neural.beats.filter(
          (b: any) => b.beat === "land_q_answered",
        ).length,
    ),
    "so no second answer could be scored",
  ).toBe(1);
});
