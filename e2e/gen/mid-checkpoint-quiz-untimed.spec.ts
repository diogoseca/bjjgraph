/* @hyperspace {"theme":"lifetime-journeys","L":"curriculum-mid","F":"decision-timer","B":"cross-feature"} @invariant "The checkpoint quiz is untimed: with a quiz open, pumping far past the decision window produces zero expiry_warning and zero auto_pick beats and leaves _checkpoint.i unchanged — time pressure is a roll-only economy that can never expire into a quiz answer." */
import { test, expect } from "@playwright/test";
import { journey } from "../dsl";
import { curriculumMid, CURRICULUM } from "../gen/personas";

/**
 * QUARANTINED RED SPEC — Q002 (see ISSUES.md). Goes GREEN when the checkpoint quiz stops the
 * roll's decision clock; then promote to e2e/gen/.
 *
 * THE BUG: every reading surface freezes the decision clock (expand sheet pauses :1497,
 * explorer auto-pauses :2610, dossier :2807, coach :4317) — except the checkpoint quiz.
 * startCheckpoint (app.src.jsx:3480) closes the explorer to show the quiz, toggleExplorer
 * (:2597) releases the explorer's auto-pause, and _tickDecision (:4315) has no _checkpoint
 * guard — so the pre-quiz hand's window keeps draining UNDER the quiz. ~12s in it narrates
 * 3-2-1 (expiry_warning), ~16s in it auto_picks a roll move, the background land calls
 * buildDrillPanel (:4281) which renderDrillHome()s over the live quiz card ([data-mc-opt]
 * count → 0, _drillView → "home") while _checkpoint stays truthy at i=1 — an unanswerable
 * zombie quiz that setDeckOpen(false) would then cancel as "abandoned" (:942).
 *
 * Probe evidence (wave 4, 2 runs, deterministic through baseline): quiz opens with
 * paused:false, decision remaining ≈15.8s of a 16.2s Mount-Top window; 45s pump → warn 6-7,
 * auto_pick 2, commits 2, mcOptCount 0 (run 2 even cascaded into opponent_attack →
 * defend_start → caught → panic_drill_opened beneath the quiz). _checkpoint.i stayed 1 both
 * runs — the narrow "never expires into a quiz ANSWER" half holds; the clock running at all
 * is the breakage.
 *
 * Determinism: the pump loop BREAKS at the first violating beat, before auto_pick and before
 * any background-cascade rng — so the red path consumes only rigged draws (checkpoint-pick 6,
 * mc-pick/mc-shuffle card renders, auto-pick rigged defensively). On the FIXED app the loop
 * runs the full 45s with an idle (frozen/parked) roll — no draws — then proves liveness by
 * answering the next card (rigged mc queues, checkpoint onDone is synchronous: :3406 skips
 * the 600ms auto-advance when _checkpoint). Assertions are structural (beat counts, i,
 * [data-mc-opt] presence, deckKeys from curriculum.json) — never card/answer text.
 */

const WHITE = CURRICULUM.belts[0];
const U2 = WHITE.units[1];
const UK = `${WHITE.id}/${U2.id}`;

/** deterministic rig-queue filler (LCG) — pre-sized, never Math.random */
const seq = (seed: number, n: number): number[] => {
  const out: number[] = [];
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out.push(s / 4294967296);
  }
  return out;
};

test("checkpoint quiz is untimed: 45s pump fires no expiry beats, i moves only on answers, quiz stays live", async ({
  page,
}) => {
  // curriculum facts the arc leans on
  expect(
    U2.checkpoint && U2.checkpoint.cards,
    "unit 2 defines a checkpoint quiz",
  ).toBeGreaterThan(1);

  const j = journey(page);
  await j.boot("/", { initialState: curriculumMid() });
  await j.land("Mount Top"); // land() dismisses the coach → the decision clock is genuinely RUNNING

  // rig every tagged draw on the arc (quiz picks + card renders; auto-pick defensively — on
  // the broken app the expiry path must still never fall through to Math.random)
  await j.rig("checkpoint-pick", seq(7, 10));
  await j.rig("mc-pick", seq(13, 400));
  await j.rig("mc-shuffle", seq(29, 80));
  await j.rig("auto-pick", [0, 0]);

  // ── finish unit 2's remaining lessons via the drill rail (persona seeded the first half) ──
  for (const l of U2.lessons.slice(Math.ceil(U2.lessons.length / 2)))
    await j.drill(3, l.deckKey);

  // pre-quiz: a live unpicked hand with an unfrozen clock — the time pressure is real
  const pre = await page.evaluate(() => {
    const a = (window as any).__neural;
    return {
      hasDecision: !!a._decision,
      total: a._decision ? a._decision.total : 0,
      optPick: !!a._optPick,
      coach: !!a._coach,
      paused: !!a.paused,
    };
  });
  expect(pre.hasDecision, "a decision window is armed before the quiz").toBe(
    true,
  );
  expect(pre.optPick, "the hand is unpicked").toBe(true);
  expect(pre.coach, "coach dismissed — nothing else freezes the clock").toBe(
    false,
  );
  expect(pre.paused, "game unpaused pre-explorer").toBe(false);
  expect(
    pre.total,
    "the window is finite (expiry is reachable well within the pump)",
  ).toBeLessThan(30000);

  // ── start unit 2's checkpoint through the same engine method as its Challenge button ──
  await page.evaluate(
    ([beltId, unitId]) => {
      const app = (window as any).__neural;
      const belt = app.curriculum.belts.find((item: any) => item.id === beltId);
      const unit = belt.units.find((item: any) => item.id === unitId);
      app.startCheckpoint(beltId, unit);
    },
    [WHITE.id, U2.id] as const,
  );
  await j.advance(400);
  await j.decksSettled(); // quiz pool decks hydrate async (v1.80.4) - settle before the one-shot beat check
  await j.expectBeat("checkpoint_start");
  const start = (await j.beats())
    .filter((b: any) => b.beat === "checkpoint_start")
    .pop() as any;
  expect(start.unit, "quiz targets unit 2").toBe(UK);

  // ── answer ONE card correct via the truth rail so i >= 1 (a mid-quiz user, not a fresh one) ──
  const mc1 = await page.evaluate(() => {
    const m = (window as any).__neural._mc;
    return m ? { correct: m.correct, opts: m.tiers.length } : null;
  });
  expect(mc1, "card 1 presents as MC").toBeTruthy();
  await page.locator("[data-mc-opt]").nth(mc1!.correct).click();
  await j.advance(300);

  // baseline: quiz mid-flight at i=1, expiry beat counts frozen here
  const snap = await page.evaluate(() => {
    const a = (window as any).__neural;
    const names = (a.beats || []).map((b: any) => b.beat);
    return {
      i: a._checkpoint ? a._checkpoint.i : null,
      warn: names.filter((n: string) => n === "expiry_warning").length,
      auto: names.filter((n: string) => n === "auto_pick").length,
    };
  });
  expect(snap.i, "one correct answer advanced the quiz to card 2").toBe(1);

  // ── THE LAW: pump 45s (≫ any decision window) with the quiz open ──
  // Break at the first violating beat: on the broken app that is the FIRST expiry_warning
  // (~12s in, before auto_pick, before any unrigged background cascade); on the fixed app
  // the loop runs the full 45s against an idle roll.
  let seen = { warn: 0, auto: 0 };
  for (let k = 0; k < 45; k++) {
    await j.advance(1000);
    seen = await page.evaluate((base) => {
      const names = (((window as any).__neural || {}).beats || []).map(
        (b: any) => b.beat,
      );
      return {
        warn:
          names.filter((n: string) => n === "expiry_warning").length -
          base.warn,
        auto: names.filter((n: string) => n === "auto_pick").length - base.auto,
      };
    }, snap);
    if (seen.warn || seen.auto) break;
  }

  const after = await page.evaluate(() => {
    const a = (window as any).__neural;
    return {
      ckptTruthy: !!a._checkpoint,
      i: a._checkpoint ? a._checkpoint.i : null,
      mcOptCount: document.querySelectorAll("[data-mc-opt]").length,
    };
  });

  // the invariant, verbatim — RED today: the roll clock keeps draining under the quiz
  expect(
    seen.warn,
    "zero expiry_warning while the checkpoint quiz is open",
  ).toBe(0);
  expect(seen.auto, "zero auto_pick while the checkpoint quiz is open").toBe(0);
  expect(after.ckptTruthy, "the quiz survives the pump").toBe(true);
  expect(
    after.i,
    "_checkpoint.i unchanged by time — only answers move it",
  ).toBe(snap.i);

  // liveness: the quiz card is still answerable — the NEXT correct answer advances i
  expect(
    after.mcOptCount,
    "quiz MC options still on screen after the pump",
  ).toBeGreaterThanOrEqual(2);
  const mc2 = await page.evaluate(() => {
    const m = (window as any).__neural._mc;
    return m ? { correct: m.correct, opts: m.tiers.length } : null;
  });
  expect(mc2, "card 2 still presents as MC").toBeTruthy();
  await page.locator("[data-mc-opt]").nth(mc2!.correct).click();
  await j.advance(300);
  const i2 = await page.evaluate(
    () => ((window as any).__neural._checkpoint || {}).i ?? null,
  );
  expect(
    i2,
    "answering still advances the quiz — the card the user left is the card they resume",
  ).toBe((snap.i as number) + 1);
});
