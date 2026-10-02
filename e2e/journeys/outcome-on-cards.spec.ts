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
 * on threats, a constant pop, a glint on an unmoved card, the reduced-motion rule deleted, the streak
 * not stacked or stacked on top, the expiry mis-named, the trap mis-named, a miss costing 5, the
 * announcer written again, no aria sentence, the countdown left pinned. Neutral control stays green.
 * CSS runs on the browser's wall clock regardless of the DSL's frame pump, so the motion checks use
 * real waits; the frame pump only drives the repaint that moves the numbers.
 */

const VIEWS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
];

type Card = { t: string; n: string; delta: string | null; hit: boolean };
const cards = (page: Page, group: "you" | "opponent") =>
  page.evaluate((g) => {
    const sel = g === "you" ? "[data-tech]" : "[data-threat-tech]";
    return Array.from(document.querySelectorAll(`[data-choice-group="${g}"] ${sel}`)).map((c: any) => ({
      t: c.getAttribute("data-tech") || c.getAttribute("data-threat-tech"),
      n: (c.querySelector(".ngodds")?.textContent || "").trim(),
      delta: c.getAttribute("data-hit-delta"),
      hit: c.classList.contains("ng-hit-bad") || c.classList.contains("ng-hit-good"),
    }));
  }, group) as Promise<Card[]>;
const pct = (s: string) => {
  const m = /^(\d+)%$/.exec(s);
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
      return { text: (e.textContent || "").trim(), d: e.getAttribute("data-hit-pop"), top: r.top, eats: !!(under && under.closest(".ng-hitpop")) };
    }),
  );
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
  expect(await j.landQuestion(), "the landing asks a question").not.toBeNull();
  await j.advance(200); // let the hand settle under the card
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
  await page.locator("[data-land-mc-opt]").nth(pick).click();
}

for (const vp of VIEWS) {
  test(`@curated a wrong answer hits every own card by its real delta, and no threat (${vp.name})`, async ({ page }) => {
    const j = await setup(page, vp.width, vp.height);
    const youBefore = await cards(page, "you");
    const themBefore = await cards(page, "opponent");
    expect(youBefore.length, "own options dealt").toBeGreaterThan(0);
    const label = await labelRect(page);
    expect(label, '"Your options" label measured').not.toBeNull();

    await answer(page, "wrong");
    await j.advance(100); // the repaint that moves the numbers
    const you = await cards(page, "you");
    const them = await cards(page, "opponent");
    const c0 = await causes(page);
    const p0 = await pops(page);

    // THE NUMBERS ARE UNCHANGED BY THIS WORK: each own card drops by exactly the −4 cost
    youBefore.forEach((b, i) => {
      const was = pct(b.n), now = pct(you[i].n);
      if (was == null || now == null || was <= 5) return; // a clamped or unprinted number cannot show −4
      expect(now - was, `${b.t}: printed odds drop by the cost`).toBe(-4);
      expect(you[i].delta, `${b.t}: the hit records the render's delta`).toBe(String(now - was));
      expect(you[i].hit, `${b.t}: takes the hit`).toBe(true);
    });
    them.forEach((c, i) => {
      expect(c.n, `${c.t}: a threat's number does not move`).toBe(themBefore[i].n);
      expect(c.hit || c.delta != null, `${c.t}: a threat takes no hit`).toBe(false);
    });
    const hitCount = you.filter((c) => c.hit).length;
    expect(p0.map((p) => p.text).sort(), "one pop per hit card, saying its real delta").toEqual(
      you.filter((c) => c.hit).map((c) => (Number(c.delta) > 0 ? "+" : "−") + Math.abs(Number(c.delta)) + "%").sort(),
    );
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

    // IT RISES, AND IT IS GONE: wall clock, not the game clock
    await page.waitForTimeout(450);
    const c1 = await causes(page);
    expect(c1[0].top, "the cause rises").toBeLessThan(c0[0].top - 4);
    await page.waitForTimeout(1150);
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
    const deltas = before.map((b, i) => (pct(after[i].n) ?? 0) - (pct(b.n) ?? 0)).filter((d, i) => (pct(before[i].n) ?? 0) > 8);
    expect(deltas.length, "printed numbers to compare").toBeGreaterThan(0);
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
    const rose = after.filter((x, i) => (pct(x.n) ?? 0) > (pct(before[i].n) ?? 0));
    expect(rose.length, "some printed number rose").toBeGreaterThan(0);
    after.forEach((x, i) => {
      const d = (pct(x.n) ?? 0) - (pct(before[i].n) ?? 0);
      expect(x.hit, `${x.t}: glints exactly when its number rose`).toBe(d > 0);
      if (x.hit) expect(Number(x.delta), `${x.t}: the glint carries the real +${d}`).toBe(d);
    });
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
      const oc = (a._optionCards || []).find((o: any) => !o.opt.threat && /^\d+%$/.test((o.card.querySelector(".ngodds")?.textContent || "").trim()));
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
    const rose = after.filter((x, i) => (pct(x.n) ?? 0) > (pct(before[i].n) ?? 0));
    expect(rose.length, "the others still rose").toBeGreaterThan(0);
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
    before.forEach((b, i) => {
      const was = pct(b.n), now = pct(after[i].n);
      if (was == null || now == null || was <= 5) return;
      expect(now - was, `${b.t}: −4 on expiry`).toBe(-4);
    });
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
    expect(parseFloat(c[1].delay), "and a beat after it").toBeGreaterThan(0);
  });

  test(`with the hand put away, the cause falls back to the landing card's measured top (${vp.name})`, async ({ page }) => {
    const j = await setup(page, vp.width, vp.height);
    await page.evaluate(() => (window as any).__neural.setLayer("hand", false, "test"));
    await j.advance(200);
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
