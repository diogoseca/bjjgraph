import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

/**
 * ONE SUBJECT PER LABEL (v1.104.1).
 *
 * Owner, mid-roll: the announcer read "OPPONENT DEFENDS Crucifix Maintenance" while the graph
 * read "DEFENDING Crucifix Maintenance" — "wtf is this incoherence? also seems to me like
 * opponent tried to go for crucifix and we're defending right?" Right on all counts. Two labels
 * were describing one event with two different subjects, and one of them was picked by a
 * top/bottom test standing in for an offence/defence test — the same defect class as
 * roleIdx-vs-valIdx (v1.103.0), so a bottom-authored attack announced itself as a defence.
 *
 * The rule the owner set, and what this pins:
 *   opponent acts -> announcer "Opponent goes for X",  graph verb "Defending"
 *   you act       -> announcer "You go for Y",         graph verb "Attacking"
 *
 * The announcer names WHO IS INITIATING. The graph verb names YOUR posture toward that move.
 * They can never contradict, because they are no longer answering the same question.
 */

// setEvent writes STRAIGHT to the DOM (evKickerRef / evTextRef) — there is no state object to
// read, so the announcer is measured where the user reads it.
const announced = (page: any) =>
  page.evaluate(() => {
    const a: any = (window as any).__neural;
    const k = a.evKickerRef && a.evKickerRef.current;
    const t = a.evTextRef && a.evTextRef.current;
    return { label: k ? k.textContent : null, detail: t ? t.textContent : null };
  });

const graphVerb = (page: any) =>
  page.evaluate(() => {
    const a: any = (window as any).__neural;
    return a.activeMove ? { verb: a.activeMove.verb, idx: a.activeMove.idx } : null;
  });

test("when YOU act: announcer says you go for it, graph says attacking @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  const tech = await page.evaluate(() => {
    const a: any = (window as any).__neural;
    const i = (a.optionIdxs || [])[0];
    return i != null ? a.nodes[i].t : null;
  });
  expect(tech, "a hand to pick from").toBeTruthy();

  await j.pick(tech!);
  await page.waitForTimeout(150);

  const ev = await announced(page);
  const gv = await graphVerb(page);
  expect(ev.label, "the announcer names the actor: you").toBe("You go for");
  // the announce block renders splitName(): main, with the `from …` qualifier under it
  expect(tech!.startsWith(ev.detail!.split("from")[0].trim()), "and the move it is about").toBe(true);
  expect(gv!.verb, "your posture toward your own move").toBe("Attacking");
});

test("when the OPPONENT acts: announcer says they go for it, graph says defending @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  // drive the opponent's turn through the same seam the roll uses
  await page.evaluate(() => (window as any).__neural.opponentDefend());
  await page.waitForTimeout(150);

  const ev = await announced(page);
  const gv = await graphVerb(page);
  expect(ev.label, "the announcer names the actor: the opponent").toBe("Opponent goes for");
  expect(gv!.verb, "YOUR posture while they attack — never 'Attacking'").toBe("Defending");

  // THE COHERENCE ITSELF: the two labels are about the same move and cannot contradict.
  const sameMove = await page.evaluate(() => {
    const a: any = (window as any).__neural;
    return a.splitName(a.nodes[a.activeMove.idx].t).main;
  });
  expect(ev.detail!.startsWith(sameMove), "both labels describe one move").toBe(true);
});

test("BOTH opponent branches use the same verb — a submission attempt is not you attacking", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");

  // The two opponent branches (submission attempt vs positional move) used OPPOSITE graph verbs:
  // "Attacking" on one, "Defending" on the other, for the same actor. Walk enough opponent turns
  // to hit both and assert they never disagree.
  const verbs = new Set<string>();
  for (let n = 0; n < 12 && verbs.size < 2; n++) {
    await j.land("Mount Top");
    await page.evaluate(() => (window as any).__neural.opponentDefend());
    await page.waitForTimeout(60);
    const gv = await graphVerb(page);
    const ev = await announced(page);
    if (gv) verbs.add(gv.verb);
    if (ev.label) {
      expect(ev.label, "every opponent action names the opponent").toBe("Opponent goes for");
      expect(gv!.verb, "and leaves YOU defending, on every branch").toBe("Defending");
    }
  }
  expect(verbs.has("Attacking"), "no opponent branch may claim YOU are attacking").toBe(false);
});
