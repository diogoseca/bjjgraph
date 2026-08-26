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
  j.releasePayload("flashcards/_index.json");
  await page.waitForFunction(
    () => !!(window as any).__neural.flashcards,
    null,
    {
      timeout: 30_000,
    },
  );
  await j.advance(200); // one pump so the backfilled render is on the page
  // The manifest is only the FIRST hop: the chain is manifest → this deck's chunk → the MC
  // distractor pool (neighbour chunks), each a real fetch resolving on the WALL clock, no sim
  // timers involved. The claim under test is "the payload landing mid-turn gives THIS landing
  // its question" — not "within one 200ms pump" — so wait for the dock, bounded; the .catch
  // leaves the reporting to the assertions that follow, which still make the claim.
  await page
    .waitForFunction(() => !!document.querySelector("[data-land-q]"), null, { timeout: 15_000 })
    .catch(() => {});
};

test("cold start: the deck payload landing mid-turn gives the CURRENT state its question", async ({
  page,
}) => {
  const j = journey(page);
  // genuinely fresh profile AND a genuinely outstanding payload: no progress, no objectives, and
  // flashcards.json still on the wire, exactly as a 4G visitor's first turn is played
  await j.boot("/", {
    keepTutorial: true,
    payloads: { "flashcards/_index.json": { never: true } },
  });
  await j.land("Mount Top"); // first roll, coach read and dismissed — the hand is on the table

  const before = await read(page);
  expect(
    before.hasQ,
    "no deck payload yet, so the state greets the visitor in silence",
  ).toBe(false);
  // v1.133.0: the clock times the QUESTION — a landing whose deck is still on the wire has no
  // question yet, so it has NO clock at all. Nothing drains while the payload is late.
  expect(
    before.decisionLeft,
    "no question on the table, no clock over it",
  ).toBe(0);
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

  // v1.101.x: the definition lives BEHIND `More ▸` (owner: "push the intro… to the content after
  // clicking More"), built lazily on first open. The backfilled render's job is to make `More`
  // APPEAR (the card had nothing to unfold before the payload); the definition is inside it.
  await expect(
    page.locator("[data-land-more]"),
    "the backfill gives the card its More affordance",
  ).toHaveCount(1);
  await page.evaluate(() => (window as any).__neural.expandLandCard());
  const after = await read(page);
  expect(after.hasDef, "the definition backfills onto the live card").toBe(
    true,
  );
  expect(
    await page.locator("[data-land-def]").first().innerText(),
    "in the page's own words",
  ).toContain("definition of where you are");
});

test("cold start: a payload arriving behind the expand sheet renders BEHIND it, visible", async ({
  page,
}) => {
  // v1.136.0 (owner): the sheet no longer hides the landing card — it maximizes IN FRONT of it
  // on the root plane (portalled, z:50 over the card's z:5). A backfilled card must therefore
  // arrive VISIBLE, and the paint order — not a z-index integer — must put the sheet on top
  // wherever the two overlap. elementFromPoint is the only honest oracle here (§6.3).
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

  await decksArrive(page); // the payload lands while the sheet is up
  await page.waitForTimeout(450); // the card's entry animation must finish before opacity means anything

  const stack = await page.evaluate(() => {
    const a = (window as any).__neural;
    const card = document.querySelector(".ng-landcard") as HTMLElement;
    const panel = a.optDetailRef.current as HTMLElement;
    if (!card || !panel) return null;
    const cs = getComputedStyle(card);
    const cr = card.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    // a point inside BOTH rects — the band where the sheet must win the paint
    const x = Math.max(cr.left, pr.left) + Math.min(cr.right, pr.right) > 2 * Math.max(cr.left, pr.left)
      ? (Math.max(cr.left, pr.left) + Math.min(cr.right, pr.right)) / 2 : -1;
    const y = (Math.max(cr.top, pr.top) + Math.min(cr.bottom, pr.bottom)) / 2;
    const overlap = x >= 0 && Math.min(cr.bottom, pr.bottom) > Math.max(cr.top, pr.top);
    const hit = overlap ? document.elementFromPoint(x, y) : null;
    return {
      cardVisible: cs.opacity !== "0" && cs.visibility === "visible",
      overlap,
      sheetWinsPaint: !!(hit && panel.contains(hit)),
    };
  });
  expect(stack, "card and sheet both mounted").not.toBeNull();
  expect(stack!.cardVisible, "the backfilled card arrives VISIBLE behind the sheet").toBe(true);
  if (stack!.overlap) expect(stack!.sheetWinsPaint, "the sheet wins the paint where they overlap").toBe(true);

  await page.evaluate(() => (window as any).__neural.closeOptionDetail());
  expect((await read(page)).hasQ, "carrying the question it was owed").toBe(
    true,
  );
});

test("cold start: the FIRST landing carries its question, and a late payload reaches it", async ({
  page,
}) => {
  // THE ONLY PATH THAT MATTERS — v1.104.0 form. The 3-panel first-roll coach is DELETED (owner),
  // so a cold visitor's default first landing is simply the card + the hand. What survives from
  // the v1.82.x adjudication is the substance: the FIRST landing a visitor ever sees must gain
  // its question when the deck payload lands mid-turn, and that question must be answerable BY
  // MOUSE at measured coordinates (the card is a fixed overlay over a hit-testing canvas).
  const j = journey(page);
  await j.boot("/", {
    keepTutorial: true,
    payloads: { "flashcards/_index.json": { never: true } }, // really in flight, not stubbed away
  });
  await j.land("Mount Top");

  expect(
    await page.locator("[data-landcard]").count(),
    "the card is up — the visitor can see the landing surface",
  ).toBe(1);
  expect(
    (await read(page)).hasQ,
    "no deck payload yet, so no question yet",
  ).toBe(false);

  // the deck payload lands while the first landing is still the live one
  await decksLandFor(j, page);
  const after = await read(page);
  expect(
    after.hasQ,
    "the first landing gains its question, so the first decision is a comprehension moment",
  ).toBe(true);
  expect(after.funnel, "and the funnel records it").toContain("question_shown");

  // BY MOUSE, at measured coordinates: `pointer-events:auto` has to be live on the card, and the
  // option has to be where the visitor can reach it WITHOUT scrolling — exactly the part
  // `locator.click()` cannot say (it scrolls first).
  await j.clickByMouse(
    "[data-land-mc-opt]",
    "the first landing's first MC option",
  );
  await j.expectBeat("land_q_answered");
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

  // v1.101.x: the definition unfolds behind `More ▸` — the backfill's visible effect on the card
  // face is the More affordance appearing; the words are one deliberate click lower.
  await expect(
    page.locator("[data-land-more]"),
    "the second payload gives the card its More affordance",
  ).toHaveCount(1);
  await page.evaluate(() => (window as any).__neural.expandLandCard());
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
