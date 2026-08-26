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
  await j.engage(); // v1.137.0: the clock waits for the player — this journey plays one

  // burn the live window down into the <=3s warning band, where the countdown is written
  for (let i = 0; i < 40; i++) {
    await j.advance(500);
    if ((await announced(page)).label === "Answer") break;
  }
  const hot = await announced(page);
  expect(hot.label, "the countdown really is on screen").toBe("Answer");
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
  const orphaned = after.opacity !== "0" && after.kicker === "Answer";
  expect(
    orphaned,
    `the stuck countdown is gone (opacity ${after.opacity}, kicker "${after.kicker}")`,
  ).toBe(false);
  expect(after.paused, "the game is paused, as the owner observed").toBe(true);
  // v1.133.0: the window belongs to the QUESTION — after staging it is either a fresh window or
  // not yet armed; a drained orphan is the bug. v1.134.0 sharpened "fresh": the clock never
  // pauses ("that's our test to the user", owner), so the staged question's window is already
  // draining when we read it — fresh means WELL ABOVE the ≤3s band the orphan was stuck in,
  // not byte-equal to total.
  expect(after.remaining == null || after.remaining > 3000, "no drained orphan window").toBe(true);
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
  await j.engage(); // v1.137.0: the clock waits for the player — this journey plays one

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
      if (s.label !== "Answer") expect(s.stamp, `"${s.label}" released the countdown stamp`).toBe(true);
    }
  }
  const uniq = [...new Set(seen)];
  expect(uniq, `the countdown was reached (saw: ${JSON.stringify(uniq)})`).toContain("Answer");
  expect(
    uniq.filter((l) => l !== "Answer").length,
    `the roll went on speaking after it (saw: ${JSON.stringify(uniq)})`,
  ).toBeGreaterThan(0);
});

/**
 * THE CLOCK BELONGS TO THE QUESTION (v1.133.0, owner). @curated
 *
 * v1.129.0's hesitation branch ("you freeze, they move first") is retired with the hand clock it
 * rode on. "Pressure should not be on the choices … the choices are fun to click. When the clock
 * runs out, the algorithm doesn't choose for you. You still choose." What expiry does now is
 * REVEAL the landing question's answer as a miss — and the cause is still read before any
 * effect: "Too slow" owns the announcer slot when it happens, with the hand untouched below it.
 */
test("@curated the clock running out reveals the answer, says so, and steals nothing", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.advance(6000);
  await j.engage(); // v1.137.0: the clock waits for the player — this journey plays one

  const handBefore = await page.evaluate(() => ((window as any).__neural.optionIdxs || []).length);
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
    if (said.indexOf("Too slow") >= 0) break;
  }
  expect(said.indexOf("Too slow"), `the expiry announced itself (saw ${JSON.stringify(said)})`).toBeGreaterThanOrEqual(0);

  const beats = (await j.beats()).map((b) => b.beat);
  expect(beats, "the reveal is a named beat").toContain("land_q_expired");
  expect(beats, "the hesitation branch is retired").not.toContain("hesitated");
  expect(beats, "the old auto-pick stays retired").not.toContain("auto_pick");
  const after = await page.evaluate(() => {
    const a: any = (window as any).__neural;
    return { hand: (a.optionIdxs || []).length, revealed: !!document.querySelector("[data-land-q] [data-mc-result]") };
  });
  expect(after.hand, "the hand survives — nothing was played for the player").toBe(handBefore);
  expect(after.revealed, "and the answer is on the table").toBe(true);
});

/**
 * ...AND THE PENALTY IS THE QUESTION'S, NOT THE TURN'S. After an expiry the player still commits
 * whatever they like; the roll goes on exactly as if they had answered wrong.
 */
test("a timed-out question costs the answer, not the exchange", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.advance(6000);
  await j.engage(); // v1.137.0: the clock waits for the player — this journey plays one
  for (let i = 0; i < 240; i++) {
    await j.advance(100);
    const b = (await j.beats()).map((x) => x.beat);
    if (b.indexOf("land_q_expired") >= 0) break;
  }
  expect((await j.beats()).map((b) => b.beat), "the question really expired").toContain("land_q_expired");
  const penalty = await page.evaluate(() => ({ qMod: (window as any).__neural._qMod }));
  expect(penalty.qMod, "priced exactly like a wrong answer").toBeLessThan(0);
  // the player commits AFTER the expiry — their turn was never taken
  await page.evaluate(() => { const a: any = (window as any).__neural; a._optPick(a._optList[0]); });
  await j.advance(1500);
  expect((await j.beats()).map((b) => b.beat), "the commit is theirs").toContain("commit");
});

/**
 * THE ANNOUNCER NEVER OUTRANKS THE STATE IT DESCRIBES (v1.138.0). @curated
 *
 * Owner: "the announcement ... is larger than the current label of the current node, and it
 * shouldn't be the case. The current node is the fucking URL of the page ... it should be
 * absolutely the biggest text that's shown on this page, not the announcement."
 *
 * It was: the toast shipped at 22px from the original design import and the focused pair label at
 * 18px. That label is the ONLY place the current node is named during a roll — `renderLandCard`
 * carries no header BECAUSE "the graph names the focused node beside it" (v1.101.1) — so a
 * transient status line outranked the page's own subject, at 1.22x, at every viewport.
 *
 * WHAT THIS READS, AND WHY IT IS NOT A SECOND IMPLEMENTATION (CLAUDE.md 6.3). The announcer is
 * real DOM, so `getComputedStyle` IS the render's output — and it is the only oracle that sees
 * `_applyTypeScale`'s runtime write beating the template's first-frame guess, which is exactly
 * where a cascade mistake would hide. The canvas half has no DOM and its font lives in a
 * draw-local, so the frame PUBLISHES what it drew (`_lastPairLabel.namePx`, the `this._LY = LY`
 * pattern); re-deriving it spec-side would agree with a broken build by construction.
 *
 * Both viewports, because the two sides step independently: the phone label is pinned by
 * `dual-pair.spec.ts`'s width bound and cannot grow, so there the rank is restored by the
 * announcer alone. A gate that only checked desktop would have proved nothing about the device
 * the complaint's own sentence looks worst on.
 *
 * Companion gate: tests/neural_type_scale.test.mjs pins the ORDERING in pure node on every PR,
 * plus the draw/`_labelWidthPx` agreement this spec cannot see. Mutants that must die here:
 * announcer back to 22px; `NG_NAME_PX` back to 18; `_applyTypeScale` never called from `resize()`.
 *
 * KNOWN BLIND SPOTS, recorded so nobody reads this as more than it is (CLAUDE.md 6.3). It asserts
 * the RANK, not the absolute sizes. It says nothing about the round-end centre announcer
 * (`evcTextRef`, up to 68px) — that surface is still ungated, and three of its four callers do not
 * clear this toast. And one mutant SURVIVES it by construction: making `_lastPairLabel.namePx`
 * lie UPWARD (99) still passes, because a bigger reported name cannot falsify a "the announcer is
 * smaller" claim. What kills that one is tests/neural_type_scale.test.mjs, which pins that the
 * published field is the variable the draw actually used.
 */
for (const vp of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`@curated on ${vp.name} the state's name reads larger than the announcer`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const j = journey(page);
    await j.boot("/Positions/Mount/Top");
    await j.advance(6000);
    // the pair group only draws once the roll has settled at roll zoom — pump until it publishes
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() => document.body.getBoundingClientRect().top);
      await j.advance(400);
      if (await page.evaluate(() => !!(window as any).__neural._lastPairLabel)) break;
    }

    const m = await page.evaluate(() => {
      const a: any = (window as any).__neural;
      // the owner's literal sentence, from the `Too slow` branch that prompted this
      a.setEvent("Too slow", "Answer revealed · −4% on this exchange", "bad");
      const t = a.evTextRef && a.evTextRef.current;
      const box = a.evRef && a.evRef.current;
      const L = a._lastPairLabel;
      return {
        namePx: L ? L.namePx : null,
        name: L ? L.main : null,
        focused: L ? L.focused : null,
        toastPx: t ? parseFloat(getComputedStyle(t).fontSize) : null,
        toastText: t ? t.textContent : null,
        // the INLINE opacity, which is what `setEvent` writes and what the tests above already
        // read: the box carries a .45s CSS transition and the frame clock here is PUMPED, so a
        // computed alpha is still mid-fade and would report a lit toast as hidden. The size is
        // read computed (below) because that is where the runtime write has to be proved; the
        // liveness is read inline because that is where the app states its intent.
        toastLit: box ? box.style.opacity === "1" : false,
      };
    });

    // SELF-CHECK FIRST (CLAUDE.md 6.6): "no label was drawn" and "the label is big enough" must
    // never produce the same pass, and neither must a toast that is not actually on screen.
    expect(m.focused, "the FOCUSED pair group drew its label this frame").toBe(true);
    expect(m.namePx, `the frame published the size it drew "${m.name}" at`).toBeGreaterThan(0);
    expect(m.toastPx, "the announcer resolved a real computed size").toBeGreaterThan(0);
    expect(m.toastLit, "…and the announcer is actually lit").toBe(true);
    expect(m.toastText?.length ?? 0, "…with the sentence in it").toBeGreaterThan(10);

    expect(
      m.toastPx,
      `${vp.name}: the announcer (${m.toastPx}px) must read clearly below "${m.name}" (${m.namePx}px)`,
    ).toBeLessThanOrEqual(m.namePx! / 1.15);
  });
}

/**
 * THE EXPIRY SENTENCE IS A LEASE, NOT A RESIDENT (v1.138.0). Owner: "the 'Answer revealed ·
 * −4% on this exchange' banner stays pinned while exploring other cards/nodes — clear or fade
 * it when focus moves to another card (or after ~5s)." The penalty was paid at expiry; the
 * sentence lets go when attention moves (sheet, stage, roam, dossier, paging — one drop seam)
 * or ~5s after it was written. Any NEWER sentence releases the stamp on its way in (the
 * one-slot stamped-owner pattern), so a successor can never be faded by a stale lease.
 * Mutants that must die: the drop seam a no-op; the 5s fade removed; setEvent not releasing.
 */
test("@curated the expiry banner lets go — on focus move, by age, and never a successor", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/Positions/Side-Control/Bottom");
  await j.advance(7000);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top);
    await j.advance(400);
  }
  // forward-compatible engagement: real mouse moves (a no-op before the clock-gate PR, the
  // required first interaction after it)
  await page.mouse.move(4, 4);
  await page.mouse.move(6, 6);
  await j.advance(300);
  const armed = await page.evaluate(() => {
    const a: any = (window as any).__neural;
    return !!(a._decision && a._decision.remaining != null);
  });
  expect(armed, "a landing question armed the clock").toBe(true);

  await page.evaluate(() => ((window as any).__neural._decision.remaining = 30));
  await j.advance(400);
  const at = await page.evaluate(() => {
    const a: any = (window as any).__neural;
    return { kicker: a.evKickerRef.current.textContent, stamped: a._evExpiry != null };
  });
  expect(at.kicker, "the expiry announced itself").toBe("Too slow");
  expect(at.stamped, "and took its lease").toBe(true);

  // focus moves: opening an option sheet drops it at once
  const drop = await page.evaluate(() => {
    const a: any = (window as any).__neural;
    const opt = a._optList && a._optList[0];
    if (!opt) return null;
    a.expandOption(opt, () => {});
    return { opacity: a.evRef.current.style.opacity, stamped: a._evExpiry != null };
  });
  expect(drop, "an option to read").not.toBeNull();
  expect(drop!.opacity, "the banner let go the moment focus moved").toBe("0");
  expect(drop!.stamped).toBe(false);
  await page.evaluate(() => (window as any).__neural.closeOptionDetail());

  // by age: a 5s-old lease fades from the frame loop
  await page.evaluate(() => {
    const a: any = (window as any).__neural;
    a.setEvent("Too slow", "Answer revealed · −4% on this exchange", "bad");
    a._evExpiry = (a.now || 0) - 6;
  });
  await j.advance(300);
  expect(
    await page.evaluate(() => (window as any).__neural.evRef.current.style.opacity),
    "the aged banner faded on its own",
  ).toBe("0");

  // and never a successor: a newer sentence releases the lease on its way in
  const succ = await page.evaluate(async () => {
    const a: any = (window as any).__neural;
    a.setEvent("Too slow", "Answer revealed · −4% on this exchange", "bad");
    a._evExpiry = (a.now || 0) - 6;
    a.setEvent("Correct", "Odds up on this exchange", "good"); // the successor releases the stamp
    return { stamped: a._evExpiry != null };
  });
  expect(succ.stamped, "the successor took the slot clean").toBe(false);
  await j.advance(300);
  expect(
    await page.evaluate(() => (window as any).__neural.evRef.current.style.opacity),
    "and no stale lease fades it",
  ).toBe("1");
});
