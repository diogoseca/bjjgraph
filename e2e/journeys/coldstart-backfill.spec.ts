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
 *
 * THE TWO FLAGSHIP CLAIMS ARE NOW MADE AGAINST A REALLY-LATE PAYLOAD. They used to stash
 * `a.flashcards` and hand it back by calling `onFlashcardsReady()` directly, because `boot()` waited
 * for the decks and the DSL served them instantly — so the assertion was about a hook, not about a
 * cold start. The DSL can now hold a named payload back (`boot({ payloads: … })`, see PayloadRule),
 * which means the app's OWN `fetch().then()` delivers the decks mid-turn and nothing is stubbed. The
 * remaining tests keep the stash: they are about re-render mechanics (the sheet's hide, the freeze
 * guard, the entry animation) where the arrival mechanism is beside the point.
 * See also coldstart-late-payload.spec.ts for the skew measured end to end.
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
      funnel: (a.csBeats || [])
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

/** The deck payload is genuinely in flight — held by the harness, never stubbed on the app — and
 *  lands through the app's own `fetch().then()` when the spec lets it through. */
const decksLandFor = async (j: any, page: any) => {
  j.releasePayload("flashcards.json");
  await page.waitForFunction(
    () => !!(window as any).__neural.flashcards,
    null,
    {
      timeout: 30_000,
    },
  );
  await j.advance(200); // one pump so the backfilled render is on the page
};

test("cold start: the deck payload landing mid-turn gives the CURRENT state its question", async ({
  page,
}) => {
  const j = journey(page);
  // genuinely fresh profile AND a genuinely outstanding payload: no progress, no objectives, and
  // flashcards.json still on the wire, exactly as a 4G visitor's first turn is played
  await j.boot("/", {
    keepTutorial: true,
    payloads: { "flashcards.json": { never: true } },
  });
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
  await decksLandFor(j, page);

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

  // it is a REAL surface, clicked at MEASURED COORDINATES. `locator.click()` was used here and it
  // does not support this claim: it scrolls the element into view first, so it passes on a card whose
  // answers sit below the fold where the visitor actually is, and it retries through interception.
  // `clickByMouse` refuses to scroll, refuses an off-screen centre, and names whatever
  // `document.elementFromPoint` says is really under the cursor — which is what pins the
  // pointer-events:auto trap (a fixed overlay that does not re-enable it is unclickable, because the
  // canvas hit-tests above it, and a keyboard-driven assertion masks that entirely).
  await j.clickByMouse(
    "[data-land-mc-opt]",
    "the backfilled question's first MC option",
  );
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

test("cold start: the FIRST landing carries its question, and a late payload reaches it", async ({
  page,
}) => {
  // THE ONLY PATH THAT MATTERS. A genuinely cold visitor's first landing is ALWAYS coached, and
  // v1.82.1's backfill returned early on `this._coach` — so on the default path it delivered
  // nothing. Worse, coach panels 2 and 3 instruct the newcomer, in words, to open an option sheet
  // and Execute from inside it; a newcomer who obeys never reaches `finishCoach`, so the landing
  // card (and its question) was never rendered AT ALL before their first commit.
  const j = journey(page);
  await j.boot("/", {
    keepTutorial: true,
    payloads: { "flashcards.json": { never: true } }, // really in flight, not stubbed away
  });
  await j.land("Mount Top", { keepCoach: true }); // the coach stays up — this is the default

  expect(
    await page.evaluate(() => !!(window as any).__neural._coach),
    "the coach is talking (the default first landing)",
  ).toBe(true);
  expect(
    await page.locator("[data-landcard]").count(),
    "and the visitor can still see WHERE THEY ARE while it talks",
  ).toBe(1);
  expect(
    (await read(page)).hasQ,
    "no deck payload yet, so no question yet",
  ).toBe(false);

  // the deck payload lands while the coach is still up — the case v1.82.1 could not serve
  await decksLandFor(j, page);
  const after = await read(page);
  expect(
    after.hasQ,
    "the coached landing gains its question, so the first decision is a comprehension moment",
  ).toBe(true);
  expect(after.funnel, "and the funnel records it").toContain("question_shown");

  // the coach and the card must not fight for the same pixels: two stacked fixed overlays where
  // the higher z-index one is NARROWER would bury the question behind the coach copy
  const overlap = await page.evaluate(() => {
    const c = document.querySelector(".ng-coach")!.getBoundingClientRect();
    const l = document.querySelector(".ng-landcard")!.getBoundingClientRect();
    return !(c.bottom <= l.top || l.bottom <= c.top);
  });
  expect(overlap, "the coach does not cover the landing card").toBe(false);

  // BY MOUSE, at measured coordinates. Both are fixed overlays over a hit-testing canvas, so
  // `pointer-events:auto` has to be live on each — and each has to be where the visitor can reach it
  // WITHOUT scrolling, which is exactly the part `locator.click()` cannot say (it scrolls first).
  await j.clickByMouse(
    "[data-land-mc-opt]",
    "the coached landing's first MC option",
  );
  await j.expectBeat("land_q_answered");
  await j.clickByMouse("[data-coach-next]", "the coach's Next button");
  expect(
    await page.evaluate(() => (window as any).__neural._coach),
    "and the coach's own button still advances it",
  ).toBe(2);
});

test("cold start: the dossier payload backfills a definition onto a question not yet answered", async ({
  page,
}) => {
  // The measured production ordering is decks @25.3s then content @27.0s — 1.7s apart. v1.82.1's
  // guard froze the card as soon as a question MOUNTED, so that second payload was dropped and the
  // first card the visitor ever reads never gained its definition. The canon requirement is
  // narrower than the guard was: never re-mount after an ANSWER. An unanswered card may be
  // completed — provided the question itself is carried across verbatim, never reshuffled.
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
  await j.land("Mount Top"); // decks present: the question is on the table, unanswered
  await expect(page.locator("[data-land-q]")).toHaveCount(1);
  const before = await page.evaluate(() => ({
    q: document.querySelector("[data-land-q]")!.textContent,
    opts: Array.from(document.querySelectorAll("[data-land-mc-opt]")).map(
      (b) => (b as HTMLElement).innerText,
    ),
    shown: (window as any).__neural.beats.filter(
      (b: any) => b.beat === "land_q_shown",
    ).length,
  }));

  // ...and now the dossier lands, 1.7s later, exactly as it does in production
  await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key;
    (window as any).NG_CONTENT = {
      decks: { [key]: { def: "Knee-through pin; hips heavy, elbows in." } },
    };
    a.onContentReady();
  });

  expect(
    (await read(page)).hasDef,
    "the definition arrives on the card being read",
  ).toBe(true);
  const after = await page.evaluate(() => ({
    q: document.querySelector("[data-land-q]")!.textContent,
    opts: Array.from(document.querySelectorAll("[data-land-mc-opt]")).map(
      (b) => (b as HTMLElement).innerText,
    ),
    shown: (window as any).__neural.beats.filter(
      (b: any) => b.beat === "land_q_shown",
    ).length,
  }));
  expect(after.q, "the same question, word for word").toBe(before.q);
  expect(
    after.opts,
    "and the same options in the same order — nothing reshuffled mid-read",
  ).toEqual(before.opts);
  expect(after.shown, "so it was never re-asked").toBe(before.shown);
  // still answerable BY MOUSE, where it sits, after the in-place completion
  await j.clickByMouse(
    "[data-land-mc-opt]",
    "the carried-over question's first MC option",
  );
  await j.expectBeat("land_q_answered");
  expect(
    await page.evaluate(
      () =>
        (window as any).__neural.beats.filter(
          (b: any) => b.beat === "land_q_answered",
        ).length,
    ),
    "exactly one answer was scored",
  ).toBe(1);
});

test("cold start: the landing card stays centred through its entry animation", async ({
  page,
}) => {
  // `@keyframes ngCardIn` animates `transform`, and `.ng-landcard` uses `transform:translateX(-50%)`
  // to centre itself against `left:50%`. A keyframe that sets `transform` at all REPLACES that
  // translate, so the card entered half its own width to the right of centre and snapped left when
  // the animation ended. Invisible in a still screenshot; a visible jump every time the card
  // mounts — and the backfill mounts it again mid-turn, so a cold visitor sees it twice.
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
  await j.land("Mount Top");

  // Read the card's own resolved animation-name, then the keyframes it actually names. This is the
  // defect exactly: any keyframe that mentions `transform` must carry the centring translate, or
  // the browser drops it for the animation's whole duration.
  const anim = await page.evaluate(() => {
    const el = document.querySelector(".ng-landcard") as HTMLElement;
    const cs = getComputedStyle(el);
    const centring = cs.transform; // the resting transform the card is centred by
    const name = cs.animationName;
    const frames: Array<{ at: string; transform: string }> = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRule[] = [];
      try {
        rules = Array.from(sheet.cssRules || []);
      } catch {
        continue; // cross-origin sheet
      }
      for (const r of rules) {
        if ((r as any).type !== CSSRule.KEYFRAMES_RULE) continue;
        if ((r as CSSKeyframesRule).name !== name) continue;
        for (const kf of Array.from((r as CSSKeyframesRule).cssRules))
          frames.push({
            at: (kf as CSSKeyframeRule).keyText,
            transform: (kf as CSSKeyframeRule).style.transform || "",
          });
      }
    }
    return { name, centring, frames, width: el.getBoundingClientRect().width };
  });

  expect(anim.name, "the card animates on entry").not.toBe("none");
  expect(
    anim.frames.length,
    `@keyframes ${anim.name} was found`,
  ).toBeGreaterThan(0);
  expect(
    anim.centring,
    "the card is centred by a transform, which is why this matters",
  ).toContain("matrix");
  // every frame that touches transform must still shift the card half its width left
  const dropped = anim.frames.filter(
    (f) => f.transform && !/-50%/.test(f.transform),
  );
  expect(
    dropped,
    `@keyframes ${anim.name} frames drop the centring translateX(-50%): ${JSON.stringify(dropped)}`,
  ).toEqual([]);
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
