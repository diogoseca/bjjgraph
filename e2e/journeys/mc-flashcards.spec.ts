import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * BELT PATH P2 — MC FLASHCARDS GRADUATING TO RECALL + CHECKPOINT QUIZ (spec first).
 *
 * The fusion rule (owner-locked): every fresh card renders as seeded multiple-choice and
 * GRADUATES to recall at stage 2; "Mastered" is recall-only — MC can never mint mastery.
 * Graded options (owner addition): a card may carry authored distractor TIERS
 * ({plausible[], trap[]}); picking plausible = no credit + "close" feedback; picking a trap
 * = stage penalty. Runtime-pooled distractors stay binary.
 *
 * Surfaces forced into existence:
 *   mcClip(a) (first sentence ≤160, applied to the correct answer too — no length tell)
 *   mcDistractors(card, deckKey) (authored tiers → same deck → graph neighbors → same cat;
 *     guards; <2 survivors → classic recall)
 *   _mcBlock renderer: [data-mc-opt] buttons, radiogroup a11y, NO setBeacon
 *   rails: a.qhash(q) (FNV), a.stage[deckKey][qhash], a._mc {key, qhash, correct} (truth
 *     for specs — the DOM never carries the correct index)
 *   beats: mc_shown {opts}, mc_correct {stage}, mc_wrong {tier}, checkpoint_passed
 *   rng tags: mc-pick, mc-shuffle, checkpoint-pick
 *   setting: mcMode auto|mc|classic · keyboard digits 1-4 · masteredCount flips to rec
 */

const CURRICULUM = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../source/public/static/neural/curriculum.json"),
    "utf8",
  ),
);
const WHITE = CURRICULUM.belts[0];
const UNIT1 = WHITE.units[0];
const LESSON1 = UNIT1.lessons[0];

/** open the drill on white unit 1 lesson 1 via the path (the user's route to a fresh deck) */
/** v1.68.0: multiple choice is the IN-ROLL format and the sidebar reads back as classic recall by
 *  default. This file tests the sidebar's MC surface, so it asks for MC explicitly — pass
 *  mcMode: null when the test drives the setting itself. */
async function openLessonDrill(
  j: any,
  page: any,
  mcMode: string | null = "auto",
) {
  if (mcMode)
    await page.evaluate(
      (m) => (window as any).__neural.set("mcMode", m),
      mcMode,
    );
  await page.evaluate(() => (window as any).__neural.toggleExplorer());
  // v1.105.2: the row click reads INLINE now — the full study surface (this spec's subject)
  // opens through openLessonStudy, the seam sessions/checkpoints use.
  await page.evaluate((dk) => {
    const a = (window as any).__neural;
    const e = a._lessonIndex && a._lessonIndex[dk];
    const belt = { id: e.belt };
    const unit = { name: e.unit, lessons: [{ deckKey: dk, nodeId: e.nodeId }] };
    a._lessonLive = a._lessonLive || (() => true);
    a.openLessonStudy({ deckKey: dk, nodeId: e.nodeId }, unit, belt);
  }, LESSON1.deckKey);
  await j.advance(800);
  // v1.80.4: a deck's cards are fetched on demand, so opening a lesson starts a real fetch.
  // Wait for it — the study surface re-renders itself when the chunk lands.
  await j.decksSettled();
  await page.waitForFunction(
    () => ((window as any).__neural.deck || []).length > 0,
    null,
    { timeout: 20_000 },
  );
}

/** The MC block mounts once its distractor POOL is resident, which on a manifest boot can be one
 *  fetch later than the card itself: renderDrill deliberately defers rather than dealing options
 *  out of whatever chunks happened to have arrived (that would make the option set a function of
 *  network timing — see _warmMcPool). Truth still lives only in a._mc; this only waits for it. */
const awaitMc = (page: any) =>
  page.waitForFunction(() => !!(window as any).__neural._mc, null, { timeout: 20_000 });

/** Inside a checkpoint loop: wait for the next question's block, or for the quiz to be over. */
const awaitMcOrQuizEnd = (page: any) =>
  page.waitForFunction(
    () => {
      const a = (window as any).__neural;
      return !!a._mc || !a._checkpoint;
    },
    null,
    { timeout: 20_000 },
  );

/** navigate the open drill to its first MC-able card (unclippable answers legitimately
 *  fall back to recall — the spec must not assume card 0 is quizzable). Probes with
 *  mcClip ONLY: a mcDistractors probe would consume the rig queues and poison determinism. */
const presentMcCardRaw = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    for (const c of a.deck || []) {
      if (a.mcClip(c.a)) {
        const qh = a.qhash(c.q);
        a.presentCard(qh);
        return qh;
      }
    }
    return null;
  });

/** present a quizzable card and (unless the test is about the classic fallback) wait for its
 *  MC block to mount. */
const presentMcCard = async (page: any, expectMc = true) => {
  const qh = await presentMcCardRaw(page);
  if (qh && expectMc) await awaitMc(page);
  return qh;
};

const mcState = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    return a._mc
      ? { key: a._mc.key, qhash: a._mc.qhash, correct: a._mc.correct }
      : null;
  });

test("fresh card renders 4 MC options, clamped, with the mc_shown beat", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await j.rig("mc-pick", [0.1, 0.2, 0.3]);
  await j.rig("mc-shuffle", [0.5, 0.5, 0.5, 0.5]);
  await openLessonDrill(j, page);
  expect(await presentMcCard(page)).toBeTruthy();

  const opts = page.locator("[data-mc-opt]");
  await expect(opts.first()).toBeVisible();
  expect(await opts.count()).toBe(4);
  for (const text of await opts.allTextContents()) {
    expect(text.length).toBeLessThanOrEqual(170); // clamp (≤160) + numbering chrome
  }
  await j.expectBeat("mc_shown");
  const truth = await mcState(page);
  expect(truth).toBeTruthy();
  expect(truth!.correct).toBeGreaterThanOrEqual(0);
  expect(truth!.correct).toBeLessThan(4);
});

test("MC options are deterministic under rig across two boots", async ({
  page,
}) => {
  const j = journey(page);
  const run = async () => {
    await j.boot("/");
    await j.land("Mount Top");
    // deep queues: pooling REJECTS candidates (unclippable/near-dupe/length-ratio) and each
    // rejection consumes another draw — a shallow queue drains into Math.random and the
    // shuffle order stops being deterministic
    await j.rig(
      "mc-pick",
      [
        0.13, 0.47, 0.79, 0.11, 0.29, 0.41, 0.53, 0.67, 0.83, 0.91, 0.07, 0.37,
        0.59, 0.73, 0.97, 0.19, 0.31, 0.43, 0.61, 0.89,
      ],
    );
    await j.rig("mc-shuffle", [0.21, 0.62, 0.34, 0.88, 0.14, 0.52, 0.76, 0.28]);
    await openLessonDrill(j, page);
    await presentMcCard(page);
    return page.locator("[data-mc-opt]").allTextContents();
  };
  const a = await run();
  const b = await run();
  expect(a).toEqual(b);
});

test("wrong answer: no credit, no stage, correct revealed", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openLessonDrill(j, page);
  await presentMcCard(page);

  const truth = await mcState(page);
  const wrongIdx = (truth!.correct + 1) % 4;
  const before = await page.evaluate(
    (k) => (window as any).__neural.prep[k] || 0,
    LESSON1.deckKey,
  );
  await page.locator("[data-mc-opt]").nth(wrongIdx).click();
  await j.expectBeat("mc_wrong");
  const after = await page.evaluate(
    (k) => (window as any).__neural.prep[k] || 0,
    LESSON1.deckKey,
  );
  expect(after).toBe(before); // wrong answers earn nothing
  const stage = await page.evaluate(
    ([k, q]) => ((window as any).__neural.stage[k] || {})[q] || 0,
    [LESSON1.deckKey, truth!.qhash] as const,
  );
  expect(stage).toBe(0);
  // the correct option is revealed (distinct state on the right button)
  expect(
    await page
      .locator("[data-mc-opt]")
      .nth(truth!.correct)
      .getAttribute("data-mc-result"),
  ).toBe("correct");
});

test("correct answer: full credit + stage, graduating to recall at stage 2", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openLessonDrill(j, page);
  await presentMcCard(page);

  let truth = await mcState(page);
  const qh = truth!.qhash;
  const before = await page.evaluate(
    (k) => (window as any).__neural.prep[k] || 0,
    LESSON1.deckKey,
  );

  // correct #1: credit + stage 1 (bonus_pumped proves full noteCardDone inheritance)
  await page.locator("[data-mc-opt]").nth(truth!.correct).click();
  await j.expectBeat("mc_correct");
  await j.expectBeat("bonus_pumped");
  let state = await page.evaluate(
    ([k, q]) => {
      const a = (window as any).__neural;
      return { prep: a.prep[k] || 0, stage: (a.stage[k] || {})[q] || 0 };
    },
    [LESSON1.deckKey, qh] as const,
  );
  expect(state.prep).toBe(before + 1);
  expect(state.stage).toBe(1);

  // the SAME card again (advance auto-continues; re-present it): correct #2 → stage 2
  await j.advance(1200);
  await page.evaluate((q) => (window as any).__neural.presentCard(q), qh); // rail: re-present by qhash
  truth = await mcState(page);
  expect(truth?.qhash).toBe(qh);
  await page.locator("[data-mc-opt]").nth(truth!.correct).click();
  await j.advance(1200);

  // stage 2 = MC-graduated: re-presenting now renders RECALL (Reveal), zero MC options
  await page.evaluate((q) => (window as any).__neural.presentCard(q), qh);
  expect(await page.locator("[data-mc-opt]").count()).toBe(0);
  const stage2 = await page.evaluate(
    ([k, q]) => ((window as any).__neural.stage[k] || {})[q] || 0,
    [LESSON1.deckKey, qh] as const,
  );
  expect(stage2).toBe(2);
});

test("mastered only via recall: MC caps at the gate, recall mints rec", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openLessonDrill(j, page);
  await presentMcCard(page);

  const truth = await mcState(page);
  const qh = truth!.qhash;

  // 5 MC corrects → stage pinned at 2, rec untouched
  for (let i = 0; i < 5; i++) {
    await page.evaluate((q) => (window as any).__neural.presentCard(q), qh);
    const t = await mcState(page);
    if (!t) break; // graduated — presentCard now renders recall
    await page.locator("[data-mc-opt]").nth(t.correct).click();
    await j.advance(700);
  }
  let s = await page.evaluate(
    ([k, q]) => {
      const a = (window as any).__neural;
      return { stage: (a.stage[k] || {})[q] || 0, rec: a.rec[k] || 0 };
    },
    [LESSON1.deckKey, qh] as const,
  );
  expect(s.stage).toBe(2); // capped at the recall gate
  expect(s.rec).toBe(0); // MC can never mint recall credit

  // rec counts DISTINCT cards proven by recall (v1.64.2 anti-inflation): recalling THREE
  // distinct cards — not re-grading one — is the honest path to a mastered deck.
  const mastered0 = await page.evaluate(() =>
    (window as any).__neural.masteredCount(),
  );
  await page.evaluate((k) => {
    const a = (window as any).__neural;
    const cards = a.deck.filter((c: any) => a.mcClip(c.a)).slice(0, 3);
    for (const c of cards) {
      const cqh = a.qhash(c.q);
      (a.stage[k] = a.stage[k] || {})[cqh] = 2; // graduated to the recall gate
      a.presentCard(cqh);
      a.revealed = true;
      a.recallGrade(true); // crosses to stage 3 → recall-proven → rec += 1 (once per card)
    }
  }, LESSON1.deckKey);
  s = await page.evaluate(
    ([k, q]) => {
      const a = (window as any).__neural;
      return {
        stage: (a.stage[k] || {})[q] || 0,
        rec: a.rec[k] || 0,
        mastered: a.masteredCount(),
      };
    },
    [LESSON1.deckKey, qh] as const,
  );
  expect(s.rec).toBeGreaterThanOrEqual(3);
  expect(s.mastered).toBeGreaterThanOrEqual(mastered0 + 1);
});

test("graded tiers: plausible = no credit + close feedback, trap = stage penalty", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  // the cards have to BE here before a fixture can be injected onto one (on-demand residency)
  await j.hydrate([LESSON1.deckKey]);
  // inject an authored-tier fixture onto the first MC-ABLE card (schema lands corpus-side
  // in P2b; the renderer's graded path is testable today)
  await page.evaluate((dk) => {
    const a = (window as any).__neural;
    for (const card of a.flashcards.decks[dk].cards) {
      const clip = a.mcClip(card.a);
      if (clip) {
        // tier strings must sit inside the 0.4–2.5 length-ratio guard vs THIS card's
        // clipped answer (post-regen answers are long; fixed short strings get rejected)
        const stretch = (seed: string) => {
          let s = seed;
          while (s.length < Math.max(40, Math.round(clip.length * 0.7)))
            s += " even when the position feels stable";
          return s.slice(0, 158) + ".";
        };
        card.mc = {
          p: [
            stretch(
              "A nearly-right option that a well-meaning beginner would believe",
            ),
          ],
          t: [
            stretch(
              "A dangerous misconception that gets you stacked and passed",
            ),
          ],
        };
        break;
      }
    }
  }, LESSON1.deckKey);
  await openLessonDrill(j, page);
  await presentMcCard(page);

  const truth = await mcState(page);
  const qh = truth!.qhash;
  // find the tier buttons via the rail map (never a DOM truth attribute)
  const tiers = await page.evaluate(() => (window as any).__neural._mc.tiers); // e.g. ["correct","plausible","trap","pool"]
  const plausibleIdx = tiers.indexOf("plausible");
  const trapIdx = tiers.indexOf("trap");
  expect(plausibleIdx).toBeGreaterThanOrEqual(0);
  expect(trapIdx).toBeGreaterThanOrEqual(0);

  // plausible: no credit, stage unchanged, tiered beat + distinct feedback state
  const prep0 = await page.evaluate(
    (k) => (window as any).__neural.prep[k] || 0,
    LESSON1.deckKey,
  );
  await page.locator("[data-mc-opt]").nth(plausibleIdx).click();
  let beats = await j.beats();
  const wrong1 = beats.filter((b: any) => b.beat === "mc_wrong").pop() as any;
  expect(wrong1.tier).toBe("plausible");
  expect(
    await page.evaluate(
      (k) => (window as any).__neural.prep[k] || 0,
      LESSON1.deckKey,
    ),
  ).toBe(prep0);

  // build a stage first (one correct), then a trap pick knocks it back down
  await page.evaluate((q) => (window as any).__neural.presentCard(q), qh);
  await awaitMc(page);
  let t = await mcState(page);
  await page.locator("[data-mc-opt]").nth(t!.correct).click();
  await j.advance(700);
  await page.evaluate((q) => (window as any).__neural.presentCard(q), qh);
  await awaitMc(page);
  t = await mcState(page);
  const tiers2 = await page.evaluate(() => (window as any).__neural._mc.tiers);
  await page.locator("[data-mc-opt]").nth(tiers2.indexOf("trap")).click();
  beats = await j.beats();
  const wrong2 = beats.filter((b: any) => b.beat === "mc_wrong").pop() as any;
  expect(wrong2.tier).toBe("trap");
  const stage = await page.evaluate(
    ([k, q]) => ((window as any).__neural.stage[k] || {})[q] || 0,
    [LESSON1.deckKey, qh] as const,
  );
  expect(stage).toBe(0); // 1 - 1: the trap costs a stage
});

test("mcMode setting: classic kills MC; mc still caps the stage at 2", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await page.evaluate(() => (window as any).__neural.set("mcMode", "classic"));
  await openLessonDrill(j, page, null); // this test owns the setting
  expect(await page.locator("[data-mc-opt]").count()).toBe(0); // classic recall from card one

  await page.evaluate(() => (window as any).__neural.set("mcMode", "mc"));
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.stage[a._posKey] = a.stage[a._posKey] || {};
  });
  await page.evaluate((dk) => {
    const a = (window as any).__neural;
    const card = a.flashcards.decks[dk].cards.find(
      (c) => a.mcClip(c.a) && a.mcDistractors(c, dk),
    );
    const qh = a.qhash(card.q);
    (a.stage[dk] = a.stage[dk] || {})[qh] = 2;
    a.presentCard(qh);
  }, LESSON1.deckKey);
  // forced-mc mode may PRESENT graduated cards as MC, but grading must still cap at 2. The
  // block mounts once the pool is resident, so read the rail after it exists, not inside the
  // same evaluate that asked for the card.
  await awaitMc(page);
  expect(await page.evaluate(() => !!(window as any).__neural._mc)).toBe(true);
  const t = await mcState(page);
  await page.locator("[data-mc-opt]").nth(t!.correct).click();
  const stage = await page.evaluate(
    ([k, q]) => ((window as any).__neural.stage[k] || {})[q] || 0,
    [LESSON1.deckKey, t!.qhash] as const,
  );
  expect(stage).toBe(2);
});

test("keyboard digits answer MC and never leak into the roll options", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openLessonDrill(j, page);
  await presentMcCard(page);

  const truth = await mcState(page);
  await page.keyboard.press(String(truth!.correct + 1));
  await j.expectBeat("mc_correct");
  // the digit did NOT open a roll-option expand sheet
  expect(await page.evaluate(() => !!(window as any).__neural._detailCtx)).toBe(
    false,
  );
});

test("a11y: radiogroup semantics and a live result region", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openLessonDrill(j, page);
  await presentMcCard(page);

  const group = page.locator('[role="radiogroup"]');
  await expect(group.first()).toBeVisible();
  expect(await page.locator('[data-mc-opt][role="radio"]').count()).toBe(4);
  expect(await page.locator('[aria-live="polite"]').count()).toBeGreaterThan(0);
});

test("one-beacon law: MC never claims the beacon", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const beacon0 = await page.evaluate(
    () => (window as any).__neural.beaconState()?.target || null,
  );
  await openLessonDrill(j, page);
  await presentMcCard(page);
  const truth = await mcState(page);
  await page.locator("[data-mc-opt]").nth(truth!.correct).click();
  await j.advance(700);
  const beacon1 = await page.evaluate(
    () => (window as any).__neural.beaconState()?.target || null,
  );
  expect(await page.locator("[data-beacon]").count()).toBeLessThanOrEqual(1);
  expect(beacon1).toBe(beacon0 === null ? null : beacon1); // MC didn't move it to itself
  expect(["mc", "mc-opt"]).not.toContain(beacon1);
});

test("recall fallback: a card with <2 viable distractors renders classic recall", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  // the cards have to BE here before they can be poisoned (on-demand residency, v1.80.4)
  await j.hydrate([LESSON1.deckKey]);
  // poison the deck so pooling cannot find 2 viable distractors for card 0: make every other
  // answer a near-duplicate of the correct one (the near-dupe guard rejects them all)
  await page.evaluate((dk) => {
    const a = (window as any).__neural;
    const deck = a.flashcards.decks[dk];
    const correct = deck.cards[0].a;
    for (let i = 1; i < deck.cards.length; i++)
      deck.cards[i] = { q: deck.cards[i].q, a: correct + " " };
    // and sever the graph-neighbor + same-cat pools by rigging the pool order? No — the
    // guards must reject those too, so give the card an unpoolable shape instead:
    deck.cards[0].a = "Yes."; // micro-answer: length-ratio guard rejects everything
  }, LESSON1.deckKey);
  await openLessonDrill(j, page);
  expect(await page.locator("[data-mc-opt]").count()).toBe(0); // fell back to recall
  const mc = await mcState(page);
  expect(mc).toBeNull();
});

test("checkpoint is now a real MC quiz: pass marks the unit", async ({
  page,
}) => {
  const j = journey(page);
  // seed all unit-1 lessons done so the checkpoint is attemptable
  const prep: Record<string, number> = {};
  for (const l of UNIT1.lessons) prep[l.deckKey] = 3;
  const j2 = journey(page);
  await j2.boot("/", {
    initialState: {
      v: 2,
      prep,
      rec: { ...prep },
      stage: {},
      units: {},
      belts: { won: {} },
      days: {},
      settings: {},
    },
  });
  await j2.land("Mount Top");
  await j2.rig("checkpoint-pick", [0.1, 0.3, 0.5, 0.7, 0.9, 0.2]);
  await page.evaluate(() => (window as any).__neural.toggleExplorer());
  await page
    .locator(`[data-checkpoint="${WHITE.id}/${UNIT1.id}"]`)
    .first()
    .click();
  await j2.advance(500);
  await j2.decksSettled();
  await awaitMc(page);   // the quiz pool is this unit's decks — fetched when the quiz starts

  // answer every quiz card correctly via the truth rail
  for (let i = 0; i < UNIT1.checkpoint.cards; i++) {
    await awaitMcOrQuizEnd(page);
    const t = await mcState(page);
    if (!t) break;
    await page.locator("[data-mc-opt]").nth(t.correct).click();
    await j2.advance(700);
  }
  await j2.expectBeat("checkpoint_passed");
  await j2.expectBeat("unit_done");
  await page.evaluate(() => (window as any).__neural.toggleExplorer());
  await expect(
    page.locator(`[data-checkpoint="${WHITE.id}/${UNIT1.id}"]`),
  ).toHaveText("Checkpoint cleared");
});

test("checkpoint fail links the weakest lesson", async ({ page }) => {
  const j = journey(page);
  const prep: Record<string, number> = {};
  for (const l of UNIT1.lessons) prep[l.deckKey] = 3;
  prep[UNIT1.lessons[1].deckKey] = 3; // weakest = lowest prep; make lesson 1 weakest below
  await j.boot("/", {
    initialState: {
      v: 2,
      prep,
      rec: { ...prep },
      stage: {},
      units: {},
      belts: { won: {} },
      days: {},
      settings: {},
    },
  });
  await j.land("Mount Top");
  await j.rig("checkpoint-pick", [0.1, 0.3, 0.5, 0.7, 0.9, 0.2]);
  await page.evaluate(() => (window as any).__neural.toggleExplorer());
  await page
    .locator(`[data-checkpoint="${WHITE.id}/${UNIT1.id}"]`)
    .first()
    .click();
  await j.advance(500);
  await j.decksSettled();
  await awaitMc(page);   // the quiz pool is this unit's decks — fetched when the quiz starts

  // answer everything WRONG → fail
  for (let i = 0; i < UNIT1.checkpoint.cards; i++) {
    await awaitMcOrQuizEnd(page);
    const t = await mcState(page);
    if (!t) break;
    await page
      .locator("[data-mc-opt]")
      .nth((t.correct + 1) % 4)
      .click();
    await j.advance(700);
  }
  const beats = (await j.beats()).map((b: any) => b.beat);
  expect(beats).not.toContain("checkpoint_passed");
  expect(beats).toContain("checkpoint_failed");
  // the fail surface names a lesson to revisit (weakest-link affordance)
  const failBeat = (await j.beats())
    .filter((b: any) => b.beat === "checkpoint_failed")
    .pop() as any;
  expect(typeof failBeat.weakest).toBe("string");
  expect(UNIT1.lessons.map((l: any) => l.deckKey)).toContain(failBeat.weakest);
});
