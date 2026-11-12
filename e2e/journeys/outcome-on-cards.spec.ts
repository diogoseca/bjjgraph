import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE OUTCOME LANDS ON YOUR CARDS (v1.218.0, owner 2026-10-02).
 *
 * "this toast is very distracting, and i'm like -4%? wait what? … like that animation that happens
 * in games for a character taking damage". A landing-question outcome is no longer an announcer
 * sentence; the cause is a word rising above "Your options", and every own card whose printed
 * success number moves takes the hit, with the real delta popping off its number.
 *
 * Pinned here, at 1440 and 390, against what the render EMITTED (§6.3), never a re-derivation:
 *   - the delta: each own card's number moves by exactly the cost (−4 expiry/wrong, −8 trap), the
 *     pop on that card says exactly that difference, and opponent threats neither move nor flash;
 *   - only what moved: a card whose printed number does not move takes no hit (one card is pinned at
 *     the view the real repaint reads, because this fixture otherwise moves every own card);
 *   - the cause: the right word per outcome, anchored just above the MEASURED "Your options" label,
 *     rising, removed by ~1.6 s of wall clock, and never intercepting the point under it;
 *   - the stack: a broken ×N streak adds a second cause, above and after the first;
 *   - reduced motion (page.emulateMedia — the fixture option is a no-op here, §6.4): nothing rises,
 *     nothing shakes; the colour and the number change only;
 *   - the announcer: no outcome writes it any more (the v1.138.0 expiry lease is retired with it).
 * Mutants, each red here by name (or in announcer-coherence.spec.ts): pointer-events auto, z out of
 * band, a constant top, the fallback deleted, no rise, never removed, removed on the game clock, hits
 * on threats, a constant pop, a pop without its card's word, a glint on an unmoved card, the
 * reduced-motion rule deleted, the streak not stacked, stacked on top, stacked at the old h×0.9 offset
 * or without the rise term (clear at creation, overlapping mid-flight), the expiry mis-named, the trap mis-named, a miss costing 5, the
 * announcer written again, no aria sentence, the countdown left pinned. Neutral control stays green.
 * WINLAT-RED2 (2026-10-05): cards pair by IDENTITY (`paired`), and every comparison asserts a floor on
 * what it compared. Mutants: the pairing returning nothing is red at each test's floor; an expiry
 * costing 5 (app `_qMod -= 0.05`) is red at "−4 on expiry".
 * CSS runs on the browser's wall clock regardless of the DSL's frame pump, so the motion checks use
 * real waits; the frame pump only drives the repaint that moves the numbers. FLAKY1 (v1.262.9): the
 * first test's rise is read on the animation's own clock and its removal by page timers, both from each
 * float's mount (`watchFloats`), not by Node sleeps after a late baseline. Its mutants, red by name: no rise and a 3 px rise ("the cause
 * rises"); the cause never removed, removed 500 ms late, removed on the game clock, and a pop never
 * removed or removed 600 ms late ("each float is gone 1.6 s after it mounted").
 */

const VIEWS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
];

type Card = { t: string; n: string; word: string; delta: string | null; hit: boolean; stale: boolean };
const cards = (page: Page, group: "you" | "opponent") =>
  page.evaluate((g) => {
    const sel = g === "you" ? "[data-tech]" : "[data-threat-tech]";
    return Array.from(document.querySelectorAll(`[data-choice-group="${g}"] ${sel}`)).map((c: any) => ({
      t: c.getAttribute("data-tech") || c.getAttribute("data-threat-tech"),
      n: (c.querySelector(".ngodds")?.textContent || "").trim(),
      word: (c.querySelector("[data-immediate-label]")?.textContent || "").trim().toLowerCase(),
      delta: c.getAttribute("data-hit-delta"),
      hit: c.classList.contains("ng-hit-bad") || c.classList.contains("ng-hit-good"),
      // a number the hand shows DIMMED while it re-solves is the previous result, not the current chance
      stale: !!c.querySelector(".ngodds[data-choice-stale]"),
    }));
  }, group) as Promise<Card[]>;
// PAIR BY IDENTITY, NEVER BY POSITION (WINLAT-RED1, 2026-10-05). The hand sorts itself ONCE when its
// first Win chances land (owner rule, v1.207), and since v1.218.4 those land within seconds, so they
// can land BETWEEN the two reads of a test. A position-paired read then compared one card's "before"
// with ANOTHER card's "after": measured, Gift Wrap's 45% against Loop Choke's dimmed "Works" 45%
// ("received 0") while Gift Wrap itself went 45% -> 41%. A card is its data-tech plus its occurrence
// (escapes share a data-tech). Every comparison below asserts a FLOOR on the pairs it compared, so a
// pairing that matches nothing, or a skip that skips everything, is red rather than vacuously green.
const paired = (before: Card[], after: Card[]) => {
  const key = (list: Card[]) => { const seen = new Map<string, number>(); return list.map((c) => { const k = c.t + "#" + (seen.get(c.t) ?? 0); seen.set(c.t, (seen.get(c.t) ?? 0) + 1); return k; }); };
  const kb = key(before), ka = key(after), at = new Map(ka.map((k, i) => [k, after[i]]));
  return before.flatMap((b, i) => (at.has(kb[i]) ? [{ b, a: at.get(kb[i])! }] : []));
};
// FLOORS, measured on the Mount Top hand (setup), 1440 and 390 alike: 8 transition move chances, all
// above the 5% and 8% clamps (its 8 entry cards print "Works", which a question outcome never moves),
// and 6 opponent threats. A count below a floor means the pairing or a skip stopped comparing.
const MOVES_FLOOR = 8, THREATS_FLOOR = 6;
const pct = (s: string) => {
  const m = /^(\d+)$/.exec(s);
  return m ? Number(m[1]) : null;
};
const causes = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll(".ng-cause")).map((e: any) => {
      const r = e.getBoundingClientRect();
      const under = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        text: (e.textContent || "").trim(),
        anchor: e.getAttribute("data-outcome-float"),
        top: r.top,
        bottom: r.bottom,
        delay: getComputedStyle(e).animationDelay,
        eats: !!(under && under.closest(".ng-cause,.ng-hitpop")),
        events: getComputedStyle(e).pointerEvents,
        z: Number(getComputedStyle(e).zIndex),
      };
    }),
  );
const pops = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll(".ng-hitpop")).map((e: any) => {
      const r = e.getBoundingClientRect();
      const under = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      // the pop is the delta (<b>) plus the card's own word for that number (<span>)
      return { text: (e.querySelector("b")?.textContent || "").trim(), word: (e.querySelector("span")?.textContent || "").trim(), d: e.getAttribute("data-hit-pop"), top: r.top, eats: !!(under && under.closest(".ng-hitpop")) };
    }),
  );
// EACH FLOAT IS TIMED BY THE PAGE, FROM ITS OWN MOUNT (FLAKY1, v1.262.9). The rise and the removal run
// on the browser's wall clock (CSS animation, setTimeout). The old checks raced them with Node sleeps
// after a baseline read several round trips late (a click, a frame pump and four evaluates). The rise
// runs on the compositor, so a main thread stalled 500 ms just after its first frame left the reads
// late and the rise early: the baseline landed late on the 1.3 s ease-out, where 450 ms more rises
// under 4 px (red 10 of 10 at "the cause rises"; 5 of 17 under a 6x CPU throttle). With the page's long
// timers 800 ms late the removal lost its ~150 ms margin (red 18 of 18 at "the cause is gone by
// ~1.6 s"). The app was untouched both times. Now a
// MutationObserver sees each .ng-cause / .ng-hitpop mount and measures it there, on two clocks:
//   - THE RISE, ON THE ANIMATION'S OWN CLOCK. A CSS animation starts at the first frame after its
//     element mounts, and a starved page can paint that frame late: under the same 6x throttle a
//     450 ms wall-clock timer from the mount found the cause not yet started (risen 0 px). So each
//     frame reads `ngRise`'s currentTime, and once it is 450 ms or more, how far the cause has risen
//     above the rect it mounted at (the 0% keyframe). The curve only climbs, so a late reading can
//     only show more rise. A cause removed before its animation reaches 450 ms says so, and is red.
//   - THE REMOVAL, ON THE PAGE'S TIMERS. At 1,600 ms a page timer checks the float is gone. Page
//     timers run in deadline order however late the page runs, so the app's own 1,450 ms (cause) and
//     1,250 ms (pop) removals always come before this check.
const watchFloats = (page: Page) =>
  page.evaluate(() => {
    const w = window as any, log: any[] = (w.__floats = []);
    new MutationObserver((recs) => {
      for (const r of recs) for (const n of Array.from(r.addedNodes)) {
        if (!(n instanceof HTMLElement) || !n.matches(".ng-cause,.ng-hitpop")) continue;
        const f: any = { kind: n.matches(".ng-cause") ? "cause" : "pop", text: (n.textContent || "").trim(), top0: n.getBoundingClientRect().top, rose: null, at: null, gone: null };
        log.push(f);
        if (f.kind === "cause") {
          const look = () => {
            const rise = n.getAnimations().find((a: any) => a.animationName === "ngRise");
            f.at = rise ? rise.currentTime : null;
            if (!n.isConnected) { f.rose = `removed at animation time ${f.at == null ? "none" : Math.round(f.at) + " ms"}`; return; }
            if (f.at != null && f.at >= 450) { f.rose = f.top0 - n.getBoundingClientRect().top; return; }
            requestAnimationFrame(look);
          };
          requestAnimationFrame(look);
        }
        setTimeout(() => { f.gone = !n.isConnected; }, 1600);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
const labelRect = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-choice-group="you"] > div');
    const r = el ? el.getBoundingClientRect() : null;
    return r ? { top: r.top, left: r.left } : null;
  });

async function setup(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await j.openQuestion() // U47 d: this journey deliberately answers/times the question.
  expect(await j.landQuestion(), "the landing asks a question").not.toBeNull();
  await j.advance(200); // let the hand settle under the card
  // D-338: Questions follows Videos and Moves and can start below the fold; bring it into view first.
  await page.locator("[data-landcard]").evaluate((e) => e.scrollIntoView({ block: "nearest" }));
  await j.readerLayoutSettled();
  return j;
}
// answer through the real MC buttons; which option is right/trap comes from the MC truth itself
async function answer(page: Page, which: "wrong" | "trap" | "correct") {
  const pick = await page.evaluate((w) => {
    const m: any = (window as any).__neural._mc;
    if (w === "correct") return m.correct;
    return m.tiers.findIndex((t: string, i: number) => i !== m.correct && (w === "trap" ? t === "trap" : t !== "trap"));
  }, which);
  expect(pick, `a ${which} option exists on this card`).toBeGreaterThanOrEqual(0);
  // A real mouse at the measured centre (D-338): locator.click()'s scroll-into-view retry would move the
  // reader, and the label measured before the answer, under the cause it anchors.
  const b = page.locator("[data-land-mc-opt]").nth(pick), r = (await b.boundingBox())!;
  const at = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  expect(await b.evaluate((el, p) => el.contains(document.elementFromPoint(p.x, p.y)), at), "the answer is reachable by mouse where it sits").toBe(true);
  await page.mouse.click(at.x, at.y);
}

for (const vp of VIEWS) {
  test(`@curated a wrong answer hits every own card by its real delta, and no threat (${vp.name})`, async ({ page }) => {
    const j = await setup(page, vp.width, vp.height);
    const youBefore = await cards(page, "you");
    const themBefore = await cards(page, "opponent");
    expect(youBefore.length, "own options dealt").toBeGreaterThan(0);
    const label = await labelRect(page);
    expect(label, '"Your options" label measured').not.toBeNull();

    await watchFloats(page); // before the answer, so every float is timed from its own mount
    await answer(page, "wrong");
    await j.advance(100); // the repaint that moves the numbers
    const you = await cards(page, "you");
    const them = await cards(page, "opponent");
    const c0 = await causes(page);
    const p0 = await pops(page);

    // THE NUMBERS ARE UNCHANGED BY THIS WORK: each own card drops by exactly the −4 cost
    let compared = 0;
    for (const { b, a } of paired(youBefore, you)) {
      const was = pct(b.n), now = pct(a.n);
      if (was == null || now == null || was <= 5 || a.stale) continue; // a clamped, unprinted or dimmed number cannot show −4
      compared++;
      expect(now - was, `${b.t}: printed odds drop by the cost`).toBe(-4);
      expect(a.delta, `${b.t}: the hit records the render's delta`).toBe(String(now - was));
      expect(a.hit, `${b.t}: takes the hit`).toBe(true);
    }
    expect(compared, "own move chances paired and compared").toBeGreaterThanOrEqual(MOVES_FLOOR);
    const threats = paired(themBefore, them);
    expect(threats.length, "every threat paired").toBe(themBefore.length);
    expect(threats.length, "threats paired and compared").toBeGreaterThanOrEqual(THREATS_FLOOR);
    for (const { b, a } of threats) {
      expect(a.n, `${a.t}: a threat's number does not move`).toBe(b.n);
      expect(a.hit || a.delta != null, `${a.t}: a threat takes no hit`).toBe(false);
    }
    const hitCount = you.filter((c) => c.hit).length;
    expect(p0.map((p) => p.text + " " + p.word).sort(), "one pop per hit card, saying its real delta and the card's own word for that number").toEqual(
      you.filter((c) => c.hit).map((c) => (Number(c.delta) > 0 ? "+" : "−") + Math.abs(Number(c.delta)) + "% " + c.word).sort(),
    );
    expect(p0.every((p) => p.word.length > 0), "every pop names its number (Move, Finish, Escape, Works), so it cannot read as Win chance").toBe(true);
    expect(hitCount, "at least one card took the hit").toBeGreaterThan(0);

    // THE CAUSE: one word, just above the measured label, never eating the click under it
    expect(c0.map((c) => c.text), "the cause is named once").toEqual(["missed"]);
    expect(c0[0].anchor, "anchored to the label").toBe("group");
    expect(c0[0].bottom, "sits above the label").toBeLessThanOrEqual(label!.top + 2);
    expect(c0[0].bottom, "…just above it").toBeGreaterThan(label!.top - 40);
    expect(c0[0].events, "pointer-events none").toBe("none");
    expect(c0[0].z >= 10 && c0[0].z <= 49, `z ${c0[0].z} sits in the ambient-fx band 10–49`).toBe(true);
    expect(c0[0].eats, "the point under the cause is not the cause").toBe(false);
    expect(p0.some((p) => p.eats), "the point under a pop is not the pop").toBe(false);
    expect(await page.evaluate(() => (window as any).__neural.evKickerRef.current?.textContent?.trim() || ""), "the announcer carries no outcome").not.toMatch(/too slow|not quite|missed|correct/i);
    expect(await page.evaluate(() => document.querySelector("[data-outcome-live]")?.textContent), "one polite sentence for screen readers").toBe(
      "Missed: your chances on these moves drop 4 points.",
    );

    // IT RISES, AND IT IS GONE: wall clock, not the game clock. Timed by the page from each float's
    // mount (watchFloats); nothing here advances the game clock, so a removal on it never comes.
    await expect.poll(() => page.evaluate(() => (window as any).__floats.filter((f: any) => f.gone === null).length),
      { message: "every float's 1.6 s check has run", timeout: 15_000 }).toBe(0);
    const floats: any[] = await page.evaluate(() => (window as any).__floats);
    const cause = floats.filter((f) => f.kind === "cause");
    expect(cause.map((f) => f.text), "the page watched the one cause").toEqual(["missed"]);
    expect(floats.filter((f) => f.kind === "pop").length, "…and every pop").toBeGreaterThanOrEqual(p0.length);
    expect(cause[0].rose, "the cause rises: more than 4 px above the rect it mounted at, 450 ms into its animation").toBeGreaterThan(4);
    expect(floats.filter((f) => !f.gone).map((f) => f.kind + " " + f.text), "each float is gone 1.6 s after it mounted, by the page's clock").toEqual([]);
    expect(await causes(page), "the cause is gone by ~1.6 s").toEqual([]);
    expect(await pops(page), "the pops are gone by ~1.6 s").toEqual([]);
  });

  test(`a trap pops its own −8, not a constant (${vp.name})`, async ({ page }) => {
    const j = await setup(page, vp.width, vp.height);
    const before = await cards(page, "you");
    await answer(page, "trap");
    await j.advance(100);
    const after = await cards(page, "you");
    const p = await pops(page);
    const deltas = paired(before, after).filter(({ b, a }) => (pct(b.n) ?? 0) > 8 && pct(a.n) != null && !a.stale).map(({ b, a }) => pct(a.n)! - pct(b.n)!);
    expect(deltas.length, "own move chances paired and compared").toBeGreaterThanOrEqual(MOVES_FLOOR);
    expect(deltas.every((d) => d === -8), `a trap costs −8 on every printed number (${deltas})`).toBe(true);
    expect(p.length, "pops present").toBeGreaterThan(0);
    expect(p.every((x) => x.text === "\u22128%"), "the pop says the real −8, not a constant −4").toBe(true);
    expect((await causes(page)).map((c) => c.text), "the trap names itself").toEqual(["that one hurts"]);
  });

  test(`a correct answer glints "+N" only where the number really rose (${vp.name})`, async ({ page }) => {
    const j = await setup(page, vp.width, vp.height);
    const before = await cards(page, "you");
    await answer(page, "correct");
    await j.advance(100);
    const after = await cards(page, "you");
    expect((await causes(page)).map((x) => x.text), "the cause says correct").toEqual(["correct"]);
    const pairs = paired(before, after);
    expect(pairs.length, "every own card paired").toBe(before.length);
    const rose = pairs.filter(({ b, a }) => (pct(a.n) ?? 0) > (pct(b.n) ?? 0)).map(({ a }) => a);
    expect(rose.length, "the move chances that rose").toBeGreaterThanOrEqual(MOVES_FLOOR);
    for (const { b, a: x } of pairs) {
      const d = (pct(x.n) ?? 0) - (pct(b.n) ?? 0);
      expect(x.hit, `${x.t}: glints exactly when its number rose`).toBe(d > 0);
      if (x.hit) expect(Number(x.delta), `${x.t}: the glint carries the real +${d}`).toBe(d);
    }
    const p = await pops(page);
    expect(p.map((x) => x.text).sort(), "a +N pop per risen card").toEqual(rose.map((x) => "+" + x.delta + "%").sort());
  });

  // The fixture moves EVERY own card, so "only where a number really moves" needs a card that does
  // not: one card's printed value is pinned at the view the real repaint reads (choiceValueView), the
  // pin is proven to hold, and that card must take nothing while the others still glint.
  test(`a card whose number does not move takes no hit (${vp.name})`, async ({ page }) => {
    const j = await setup(page, vp.width, vp.height);
    const pinned = await page.evaluate(() => {
      const a: any = (window as any).__neural;
      const oc = (a._optionCards || []).find((o: any) => !o.opt.threat && /^\d+$/.test((o.card.querySelector(".ngodds")?.textContent || "").trim()));
      if (!oc) return null;
      const keep = oc.card.querySelector(".ngodds").textContent;
      const tech = oc.card.getAttribute("data-tech");
      const orig = a.choiceValueView.bind(a);
      a.choiceValueView = (opt: any) => { const v = orig(opt); return opt === oc.opt ? { ...v, immediate: keep } : v; };
      return { tech, keep };
    });
    expect(pinned, "a printed own card to pin").not.toBeNull();
    const before = await cards(page, "you");
    await answer(page, "correct");
    await j.advance(100);
    const after = await cards(page, "you");
    const me = after.find((c) => c.t === pinned!.tech)!;
    expect(me.n, "the pin held: this card's number did not move").toBe(pinned!.keep);
    expect(me.hit || me.delta != null, "so it takes no hit").toBe(false);
    const pairs = paired(before, after);
    expect(pairs.length, "every own card paired").toBe(before.length);
    const rose = pairs.filter(({ b, a }) => (pct(a.n) ?? 0) > (pct(b.n) ?? 0)).map(({ a }) => a);
    expect(rose.length, "the others still rose (all move chances but the pinned one)").toBeGreaterThanOrEqual(MOVES_FLOOR - 1);
    expect(rose.every((x) => x.hit), "and each of them glints").toBe(true);
    expect((await pops(page)).length, "one pop per moved card, none for the pinned one").toBe(rose.length);
  });

  test(`the clock running out names it "too slow" and hits the same cards (${vp.name})`, async ({ page }) => {
    const j = await setup(page, vp.width, vp.height);
    const before = await cards(page, "you");
    await j.advanceUntil("land_q_expired", 20000, 100);
    await j.advance(100);
    const after = await cards(page, "you");
    expect((await causes(page)).map((c) => c.text), "the cause names the expiry").toEqual(["too slow"]);
    let compared = 0;
    for (const { b, a } of paired(before, after)) {
      const was = pct(b.n), now = pct(a.n);
      if (was == null || now == null || was <= 5 || a.stale) continue;
      compared++;
      expect(now - was, `${b.t}: −4 on expiry`).toBe(-4);
    }
    expect(compared, "own move chances paired and compared").toBeGreaterThanOrEqual(MOVES_FLOOR);
    expect(await page.evaluate(() => (window as any).__neural._evCountdown == null), "the countdown sentence is released, not left pinned").toBe(true);
  });

  test(`a broken streak stacks "momentum lost" above and after the cause (${vp.name})`, async ({ page }) => {
    const j = await setup(page, vp.width, vp.height);
    await page.evaluate(() => { (window as any).__neural._combo = 3; }); // a ×3 streak to lose
    await answer(page, "wrong");
    await j.advance(100);
    const c = await causes(page);
    expect(c.map((x) => x.text), "the cause, then the streak").toEqual(["missed", "×3 momentum lost"]);
    expect(c[1].top, "stacked above the first").toBeLessThan(c[0].top);
    expect(c[1].bottom, "clear of the first when they appear").toBeLessThanOrEqual(c[0].top + 1);
    expect(parseFloat(c[1].delay), "and a beat after it").toBeGreaterThan(0);
    // the second starts 0.18s later, so the first is already rising: they must not meet mid-flight
    await page.waitForTimeout(300);
    const m = await causes(page);
    expect(m[1].bottom, "still clear of the first mid-flight").toBeLessThanOrEqual(m[0].top + 1);
  });

  test(`with the hand put away, the cause falls back to the landing card's measured top (${vp.name})`, async ({ page }) => {
    const j = await setup(page, vp.width, vp.height);
    await page.evaluate(() => (window as any).__neural.setLayer("hand", false, "test"));
    await j.advance(200);
    // STALE TIMING (H61, 3 of 10 red, probe H62): putting the hand away moves the card up 140px on the
    // reader's next layout frame, which a pumped advance does not always include; measure after it.
    await j.readerLayoutSettled();
    const land = await page.evaluate(() => {
      const el: any = (window as any).__neural._landEl;
      const r = el ? el.getBoundingClientRect() : null;
      return r ? { top: r.top } : null;
    });
    expect(land, "the landing card is measured").not.toBeNull();
    await answer(page, "wrong");
    await j.advance(100);
    const c = await causes(page);
    expect(c.map((x) => x.text), "the cause is still named").toEqual(["missed"]);
    expect(c[0].anchor, "the NAMED fallback: the landing card").toBe("landcard");
    expect(await page.evaluate(() => (window as any).__neural._lastOutcomeAnchor)).toBe("landcard");
    expect(c[0].bottom, "just above the card's measured top").toBeLessThanOrEqual(land!.top + 2);
    expect(c[0].bottom, "…not somewhere else").toBeGreaterThan(land!.top - 40);
    expect(c[0].eats, "and it never eats the point under it").toBe(false);
  });

  test(`reduced motion: the cause holds still, cards flash without shaking (${vp.name})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const j = await setup(page, vp.width, vp.height);
    await answer(page, "wrong");
    await j.advance(100);
    const c0 = await causes(page);
    const anim = await page.evaluate(() => Array.from(document.querySelectorAll('[data-choice-group="you"] [data-tech].ng-hit-bad')).map((c: any) => getComputedStyle(c).animationName));
    expect(c0.length, "the cause still appears").toBe(1);
    expect(anim.length, "cards still take the hit").toBeGreaterThan(0);
    expect(anim.every((n) => n === "ngHitStill"), `no shake under reduced motion (${anim})`).toBe(true);
    await page.waitForTimeout(450);
    const c1 = await causes(page);
    expect(Math.abs(c1[0].top - c0[0].top), "the cause does not rise").toBeLessThanOrEqual(1);
  });
}
