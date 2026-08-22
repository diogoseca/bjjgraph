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

/**
 * "DECIDE 1…" IS THE HAND'S SENTENCE AND CANNOT OUTLIVE THE HAND (v1.128.1). @curated
 *
 * Owner: "when i click another node amid a 'Decide 3/2/1' the Decide number (in this case '1...')
 * gets stuck there, even tho i navigated to another node and the time bars are now back full at
 * 100% and the game is correctly paused. (the 'Decide 1...' makes no sense in this UX gameplay
 * state)."
 *
 * ROOT CAUSE, and it is a guard doing more than it says. `enterLand` DOES drop a stale announcer —
 * but only `if (!first)`, and clicking a node stages a fresh board whose landing IS a roll's
 * opening state, so it passes `first` and skipped the clear. Flipping that guard would wipe
 * legitimate arrival copy, so instead the countdown sentence now OWNS ITS OWN LIFETIME:
 * `_tickDecision` stamps `_evCountdown = d` when it writes the line, any other `setEvent` clears
 * the stamp (so "Time's up" is untouched — it reaches `setEvent` too), and `clearOptions` drops
 * the line if the stamp is still standing when the hand is torn down.
 */
test("@curated a Decide countdown does not survive staging another node", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.advance(6000);

  // burn the live window down into the <=3s warning band, where the countdown is written
  for (let i = 0; i < 40; i++) {
    await j.advance(500);
    if ((await announced(page)).label === "Decide") break;
  }
  const hot = await announced(page);
  expect(hot.label, "the countdown really is on screen").toBe("Decide");
  const shown = await page.evaluate(
    () => (window as any).__neural.evRef.current.style.opacity,
  );
  expect(shown, "and visible").toBe("1");

  // click a node we are NOT standing on — the owner's gesture
  const target = await page.evaluate(() => {
    const a: any = (window as any).__neural;
    const scale = a.W / a.cam.vw;
    for (const n of a.nodes) {
      if (n.idx === a.focusIdx || n.ty !== "positions") continue;
      const sx = (n.x - a.cam.cx) * scale + a.W / 2;
      const sy = (a._LY(n) - a.cam.cy) * scale + a.H / 2;
      if (sx > 120 && sx < a.W - 320 && sy > 90 && sy < a.H - 340) return { sx, sy };
    }
    return null;
  });
  expect(target, "there is another node to click").not.toBeNull();
  await page.mouse.click(target!.sx, target!.sy);
  await j.advance(1500);

  const after = await page.evaluate(() => {
    const a: any = (window as any).__neural;
    const k = a.evKickerRef.current;
    return {
      opacity: a.evRef.current ? a.evRef.current.style.opacity : null,
      kicker: k ? k.textContent : null,
      paused: !!a.paused,
      // the three facts the owner listed as contradicting the sentence
      remaining: a._decision ? a._decision.remaining : null,
      total: a._decision ? a._decision.total : null,
      stamp: a._evCountdown == null,
    };
  });
  // THE CLAIM IS "THE COUNTDOWN IS NOT WHAT YOU ARE LOOKING AT", not "the announcer is blank".
  // A first version asserted `opacity === "0"` and failed once in a full-suite run at opacity "1" —
  // on a build with the fix in — because the staged landing had legitimately said something ELSE
  // by the time it read. Standing the announcer down and REPLACING the sentence are both correct
  // outcomes; leaving "Decide 1…" up is the only wrong one.
  const orphaned = after.opacity !== "0" && after.kicker === "Decide";
  expect(
    orphaned,
    `the stuck countdown is gone (opacity ${after.opacity}, kicker "${after.kicker}")`,
  ).toBe(false);
  expect(after.paused, "the game is paused, as the owner observed").toBe(true);
  expect(after.remaining, "and the bars really are back to full").toBe(after.total);
  expect(after.stamp, "the ownership stamp was released with it").toBe(true);
});

/**
 * ...AND THE NEXT REAL SENTENCE IS NOT COLLATERAL.
 *
 * `clearOptions` runs on the way into EVERY landing, so a naive "clear the announcer when the hand
 * goes" would eat whatever the roll said next. The stamp is what keeps them apart: every other
 * `setEvent` releases it, so only an orphaned countdown is ever dropped. This walks a real roll
 * through an expiry and asserts the sentences after it reach the screen and stay.
 *
 * DISCLOSED, PRE-EXISTING, NOT FIXED: **"Time's up" never reaches the screen at all.**
 * `_tickDecision` writes it and then calls `pick(chosen)` on the very next line, and that runs
 * `enterAttempt` -> `setEvent("You go for", ...)` SYNCHRONOUSLY, so the expiry's own explanation is
 * overwritten before a single frame renders. Measured on HEAD's bundle as well as this one: the
 * visible sequence is `Decide -> You go for -> Failed -> Opponent goes for`, with no "Time's up"
 * in it on either build. So the one message that explains why the position moved without the
 * player choosing is dead copy. It is left alone here because fixing it is a gameplay-copy change
 * the owner has not asked for, and this commit is about a stuck countdown.
 */
test("the sentences after an expiry survive the hand being torn down", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.advance(6000);

  const seen: string[] = [];
  for (let i = 0; i < 220; i++) {
    await j.advance(100);
    const s = await page.evaluate(() => {
      const n: any = (window as any).__neural;
      const k = n.evKickerRef.current;
      return {
        label: k ? k.textContent : null,
        opacity: n.evRef.current ? n.evRef.current.style.opacity : null,
        stamp: n._evCountdown == null,
      };
    });
    if (s.label && s.opacity === "1") {
      seen.push(s.label);
      // anything that is NOT the countdown must have released the stamp — that release is the
      // whole reason `clearOptions` can drop an orphan without touching a live sentence.
      if (s.label !== "Decide") expect(s.stamp, `"${s.label}" released the countdown stamp`).toBe(true);
    }
  }
  const uniq = [...new Set(seen)];
  expect(uniq, `the countdown was reached (saw: ${JSON.stringify(uniq)})`).toContain("Decide");
  expect(
    uniq.filter((l) => l !== "Decide").length,
    `the roll went on speaking after it (saw: ${JSON.stringify(uniq)})`,
  ).toBeGreaterThan(0);
});

/**
 * FREEZING HANDS OVER THE INITIATIVE (v1.129.0). @curated
 *
 * The dead-copy finding above turned out to sit on top of a gameplay problem, and the owner asked
 * for the gameplay answer rather than a copy fix.
 *
 * WHAT THE CLOCK RUNNING OUT USED TO DO was play your hand FOR you: a weighted draw over your own
 * options with `w = max(0.12, 0.5 + dom)` — biased toward your DOMINANT moves. So hesitating was
 * rewarded with a decent move, and the sentence explaining it was overwritten synchronously before
 * a frame rendered. The player watched their own hand play itself, well, for no stated reason.
 *
 * WHAT IT DOES NOW: in BJJ, freezing in a live exchange means THEY move first. It is the same
 * currency the rest of the engine is priced in — the asymmetric-initiative rule behind EDGE says a
 * success returns the turn to you and a miss hands it over, so hesitation costing you the turn is
 * consistent rather than novel.
 *
 * AND IT CANNOT SPIRAL, BY CONSTRUCTION: `opponentDefend` always ends in `enterLand(false)` (or
 * `enterDefense`, or `endRound`), so the opponent never keeps initiative. You freeze, they take
 * ONE exchange, the board comes back. A player who never presses anything is not locked out of the
 * game — they are just losing it, correctly.
 */
test("@curated the clock running out gives the opponent the exchange, and says so first", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.advance(6000);

  // walk the announcer at 100ms so the ORDER of the sentences is observed, not inferred
  const said: string[] = [];
  for (let i = 0; i < 240; i++) {
    await j.advance(100);
    const s = await page.evaluate(() => {
      const n: any = (window as any).__neural;
      const k = n.evKickerRef.current;
      return { label: k ? k.textContent : null, opacity: n.evRef.current?.style.opacity };
    });
    if (s.label && s.opacity === "1" && said[said.length - 1] !== s.label) said.push(s.label);
    if (said.indexOf("Opponent goes for") >= 0) break;
  }

  // THE CAUSE IS READ BEFORE THE EFFECT. This is the half a synchronous hand-over would fail: the
  // announcer has ONE slot, so without the hold "Time's up" would be overwritten unseen — which is
  // exactly the pre-existing defect this replaces.
  const iUp = said.indexOf("Time's up");
  const iOpp = said.indexOf("Opponent goes for");
  expect(iUp, `the expiry announced itself (saw ${JSON.stringify(said)})`).toBeGreaterThanOrEqual(0);
  expect(iOpp, "and the opponent then took the exchange").toBeGreaterThan(iUp);

  // ...AND IT REALLY IS THE OPPONENT ACTING, not your own hand being auto-played.
  const beats = (await j.beats()).map((b) => b.beat);
  expect(beats, "the hesitation is a named beat").toContain("hesitated");
  expect(beats, "the old auto-pick is retired from this path").not.toContain("auto_pick");
  expect(
    beats.filter((b) => b === "opponent_move" || b === "opponent_attack").length,
    "the opponent moved",
  ).toBeGreaterThan(0);
});

/**
 * ...AND IT HANDS BACK. The bound is what makes this safe to ship rather than a death spiral, so
 * it is asserted rather than argued: after the opponent's one exchange the player is dealt a hand
 * again (or is in a defence, which is also theirs to answer). Nothing here can leave a player with
 * no move to make.
 */
test("hesitating costs one exchange, not the game", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.advance(6000);
  for (let i = 0; i < 240; i++) {
    await j.advance(100);
    const b = (await j.beats()).map((x) => x.beat);
    if (b.indexOf("hesitated") >= 0) break;
  }
  expect((await j.beats()).map((b) => b.beat), "we really hesitated").toContain("hesitated");

  // let the opponent's exchange play out
  let back = false;
  for (let i = 0; i < 200; i++) {
    await j.advance(100);
    back = await page.evaluate(() => {
      const a: any = (window as any).__neural;
      // a hand to play, a defence to answer, or the round is over — any of the three is "the game
      // gave me something to do". A frozen board with none of them is the spiral this rules out.
      return (a.optionIdxs || []).length > 0 || !!a._defense || !!a._roundOver;
    });
    if (back) break;
  }
  expect(back, "the board came back to the player within one exchange").toBe(true);
});
