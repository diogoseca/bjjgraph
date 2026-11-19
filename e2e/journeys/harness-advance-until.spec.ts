import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE HARNESS ITSELF, UNDER TEST: `j.advanceUntil(beat, cap, step)` (v1.262.7, GATE3).
 *
 * Why it changed: each step used to copy the whole beat log (up to 4,000 entries) back to Node to ask
 * one question, 31 ms a call against 4.3 ms for an empty evaluate on the dev box (reports/gatetime.md,
 * c2). Now `sawBeat()` asks it in the page. The steps, their order and the predicate are unchanged,
 * and these claims are the OLD body's semantics, so this spec is green on both (see MUTANTS):
 *   FIRST STEP  it returns right after the pumped step that brought the beat into the log, never a step later
 *   CAP         a beat that never comes throws at the cap, having pumped exactly the cap, no more
 *   SINCE BOOT  the log is read since boot, and it always pumps at least one step first: a beat that
 *               is already there ends it after exactly one step
 * WHAT THE HARNESS DOES NOT SERVE, beside these: dossier chunks (`{}`); nothing here reads content.
 *
 * MUTANTS (2026-11-12, each patched into e2e/dsl.ts alone, under the build lock on this green spec, then reverted). The OLD
 * body (`(await this.beats()).some(...)`) is the control: green, 3 of 3.
 *   sawBeat always false          → FIRST STEP and SINCE BOOT red (the beat "is not seen within" the cap)
 *   sawBeat always true           → "the beat is there, once" and "CAP: it throws"
 *   returns on the SECOND sighting (one step late) → "FIRST STEP: it returned right after the step that brought the
 *     beat, not a step later" and SINCE BOOT. The first version of FIRST STEP read the beat's age on the game clock
 *     (`a.now - t <= step`) and let this mutant through: a catch holds the game clock. It now counts the pump.
 *   checks BEFORE it advances      → SINCE BOOT only, by design: with the beat arriving mid-loop both orders stop on the
 *     same step, so only a beat already in the log can tell them apart.
 */

test("it stops on the first step that holds the beat", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  // the catch restart-hygiene.spec.ts rigs: a failed attempt, the opponent's finish, its submission
  const options = await j.optionTitles();
  await j.rig("resolve", [0.99]);
  await j.rig("outcome", [0.99]);
  await j.rig("opp-finish", [0.01]);
  await j.rig("opp-sub-pick", [0.01]);
  await j.pick(options[0]);
  await j.advance(3000);
  await j.pick(options[0]);
  const fresh = await page.evaluate(() => !((window as any).__neural.beats || []).some((b: any) => b.beat === "caught"));
  expect(fresh, "premise: nothing has caught the player yet").toBe(true);
  // Watch the PUMP, not the game clock (a catch can hold the game clock, so a beat's age in `a.now` cannot see an
  // extra step: the first version of this test measured that and let "one step late" through). Every pumped call is
  // counted; `stepOf` is the pumped total at the end of the step after which the beat is first in the log, whether
  // it was emitted inside that step or just after it (checked again at the start of the next call).
  await page.evaluate(() => {
    const a = (window as any).__neural, pump = a.advance;
    const seen = () => (a.beats || []).some((b: any) => b.beat === "caught");
    a.__pumped = 0; a.__stepOf = null;
    a.advance = function (m: number) {
      if (a.__stepOf === null && seen()) a.__stepOf = a.__pumped;
      const r = pump.call(this, m);
      a.__pumped += m;
      if (a.__stepOf === null && seen()) a.__stepOf = a.__pumped;
      return r;
    };
  });
  await j.advanceUntil("caught", 20000, 100);
  const at = await page.evaluate(() => {
    const a = (window as any).__neural;
    if (a.__stepOf === null && (a.beats || []).some((b: any) => b.beat === "caught")) a.__stepOf = a.__pumped; // seen only by the check
    return { n: a.beats.filter((b: any) => b.beat === "caught").length, pumped: a.__pumped as number, stepOf: a.__stepOf as number | null };
  });
  expect(at.n, "the beat is there, once").toBe(1);
  expect(at.stepOf, "premise: the beat arrived during the pumping").not.toBeNull();
  expect(at.pumped, "FIRST STEP: it returned right after the step that brought the beat, not a step later").toBe(at.stepOf);
  expect(at.pumped % 100, "it pumped whole steps").toBe(0);
  expect(at.pumped, "it pumped at all").toBeGreaterThan(0);
});

test("a beat that never comes throws at the cap, having pumped exactly the cap", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const before = j.simElapsed();
  await expect(j.advanceUntil("no-such-beat", 800, 400), "CAP: it throws").rejects.toThrow('beat "no-such-beat" not seen within 800ms of sim time');
  expect(j.simElapsed() - before, "CAP: it pumped the cap, no more").toBe(800);
});

test("the log is read since boot, after one step: a beat already there ends it after exactly one step", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const landed = await page.evaluate(() => ((window as any).__neural.beats || []).filter((b: any) => b.beat === "land").length);
  expect(landed, "premise: the landing's beat is already in the log").toBeGreaterThan(0);
  const before = j.simElapsed();
  await j.advanceUntil("land", 2000, 400);
  expect(j.simElapsed() - before, "SINCE BOOT: one step, then it saw the old beat").toBe(400);
});
