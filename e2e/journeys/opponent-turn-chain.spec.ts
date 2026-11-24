import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * OPP1, S1 to S4 (v1.300.0): THE OPPONENT'S TURN, MADE READABLE. The owner, on his own play (24 Nov): "maybe it would be if
 * we, since the failed attempt keep the map zoomed out to keep the failed attempt node + every other node that follows the
 * opponent's decision and chances taken until the current node so the path is visible on the graph". The orchestrator's
 * rulings (prompts/mapshows-oppturn-go.md): the glide at the opponent's choice, the article stepped back, the light's one
 * exception scoped to the chain, each of the opponent's legs at most 1.0 s, the reward notice held through his turn, the
 * names and lines readable at the widest framing, the banner's two lines clear of the chain at 390.
 *
 *   S1 one framing for the whole chain (`_chainFrame`), the opponent's legs capped (NG_CHAIN.leg), the reward held
 *   S2 the path with direction (`_drawChain`, published `_lastChain`), the chain named (pass "chain"), the light's exception
 *   S3 the banner as one sentence (`_chainLine`)
 *   S4 the article stepped back (`_chainArticle`, reading.css)
 *
 * Positions are read where the frame published them (`_lastChain`'s rim points, `_lastNameBoxes`), never recomputed here
 * (CLAUDE.md §6.3); the camera through `cam`, the drawn transform, never `camTarget` (§6.2). Every draw that can end or
 * redirect the exchange is rigged (§6.3): `resolve`, `outcome` (his miss, then the opponent's own), `opp-finish`, `opp-pick`.
 * The harness serves no dossier chunks, so no film; nothing here reads one (§6.4).
 *
 * MUTANTS (each red after a green control; the run in reports/mapshows.md, OPP1-S1-4):
 *   C1 no framing at the opponent's choice                  → "S1 …" at "every place of the chain is in the visible map"
 *   C2 a framing per leg (the follow camera keeps the width) → "S1 …" at "one glide"
 *   C3 the opponent's legs uncapped                          → "S1 the opponent's legs…" at "at most 1.0 s"
 *   C4 the reward not held by the chain                      → "S1 the reward notice…" at "no notice during his turn"
 *   C5 no arrowheads                                         → "S2 …" at "an arrowhead at the destination"
 *   C6 the "chain" name pass dropped                         → "S2 …" at "the chain's places are named"
 *   C7 the light's exception taken away                      → "S2 …" at "lit from the opponent's choice"
 *   C8 the rule gone for every light (`running` never true)   → tests/map_light.test.mjs, "out at once when the game starts again…"
 *   C9 the sentence's result word fixed to "It lands"        → "S3 …" at "it fails: you stay"
 *   C10 the article not stepped back                         → "S4 …" at "the article steps back"
 * NOT A MUTANT HERE: the drill's window with his leg capped is a premise-checked measure (cold page, CPU x4, the shortest
 * leg); a mutant that made the deck late would be a mutant of the prefetch, which this change does not touch.
 */

type W = any;

const snap = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, n = a.nodes[a.currentPos] || {}, R = a._viewRect();
  const live = (a._optionCards || []).filter((c: W) => c.card && c.card.isConnected && c.card.offsetParent !== null);
  const ev = a.evRef.current ? a.evRef.current.getBoundingClientRect() : null, cv = a.canvas.getBoundingClientRect();
  return {
    now: a.now, cur: a.currentPos, t: n.t, role: a.playerRole, url: location.pathname, hist: history.length,
    hand: live.length, pulse: a.pulse && !a.pulse.done ? { path: a.pulse.path.slice(), seg: a.pulse.seg, cap: a.pulse.cap } : null,
    actor: a.activeMove ? a.activeMove.verb : null, kick: (a.evKickerRef.current || {}).textContent || "", text: (a.evTextRef.current || {}).textContent || "",
    vw: a.cam.vw, tvw: a.camTarget.vw, rest: a.graphW * a.ROLL_ZOOM, held: a.camHeld(),
    band: { l: R.left, t: R.top, r: R.left + R.width, b: R.top + R.height },
    chain: a._lastChain ? { k: a._lastChain.k, legs: a._lastChain.legs } : null,
    light: a._lastLight ? { chain: !!a._lastLight.chain, place: a._lastLight.place ? a._lastLight.place.idx ?? a._lastLight.place : null } : null,
    names: (a._lastNameBoxes || []).filter((b: W) => b.w === "chain").map((b: W) => ({ i: b.i, l: b.l, r: b.r, t: b.t, b: b.b })),
    banner: ev ? { b: ev.bottom - cv.top, clipped: !!a.evTextRef.current && a.evTextRef.current.scrollWidth > a.evTextRef.current.clientWidth + 1 } : null,
    stepBack: !!a._readerEl && a._readerEl.hasAttribute("data-ng-step-back"),
    articleOpacity: (() => { const e = document.querySelector(".ng-reader-article") as HTMLElement | null; return e ? +getComputedStyle(e).opacity : null; })(),
    reward: !!document.querySelector(".ng-challenge-reward"), defend: a._defendSub != null,
  };
});

/** From the press to the moment he can act again, a sample every 100 ms of game time. */
const playOut = async (page: Page, j: ReturnType<typeof journey>, max = 300) => {
  const frames: W[] = [];
  for (let k = 0; k < max; k++) {
    await j.advance(100);
    const s = await snap(page);
    frames.push(s);
    if (k > 3 && ((s.hand > 0 && !s.pulse && !s.actor) || s.defend)) return frames;
  }
  throw new Error("the player never got a hand back");
};

const rigAll = async (j: ReturnType<typeof journey>, missOutcome: number, oppPick: number, oppOutcome: number) => {
  await j.rig("resolve", [0.999]);
  await j.rig("outcome", [missOutcome, oppOutcome]);
  await j.rig("opp-finish", [0.99]);
  await j.rig("opp-pick", [oppPick]);
};

/** His case, as he played it: Arm Drag to Back from its page, misses and stays; Body Lock Pass fails and stays. */
const hisCase = async (page: Page, j: ReturnType<typeof journey>) => {
  await j.boot("/Transitions/Arm-Drag-to-Back");
  for (let i = 0; i < 20; i++) {
    await j.advance(1000);
    if (await page.evaluate(() => { const a = (window as W).__neural; return (a.optionIdxs || []).length > 0 && a._arriveGlideUntil == null && !a.pulse; })) break;
  }
  await j.engage();
  await rigAll(j, 0.55, 0.34, 0.5);
  const before = await snap(page);
  await j.pick("Arm Drag to Back");
  return before;
};

/** At Mount top: his Gift Wrap misses (stays at 0.55, is countered to Half Guard at 0.9); the opponent's Trap and Roll
 *  lands him in Closed Guard, bottom (0.2), or fails and stays (0.6). */
const mountCase = async (page: Page, j: ReturnType<typeof journey>, miss: number, opp: number) => {
  await j.boot("/");
  await j.land("Mount Top");
  await rigAll(j, miss, 0.0, opp);
  const before = await snap(page);
  await j.pick("Gift Wrap");
  return before;
};

const choiceAt = (frames: W[]) => frames.findIndex((f) => f.actor === "Defending" && f.pulse);
const inside = (p: { x: number; y: number }, B: W) => p.x >= B.l && p.x <= B.r && p.y >= B.t && p.y <= B.b;
const overlap = (a: W, b: W) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

for (const [w, h, touch] of [[1440, 900, false], [1048, 773, false], [390, 631, true]] as const) {
  test.describe(`${w}x${h}`, () => {
    test.use(touch ? { viewport: { width: w, height: h }, hasTouch: true, isMobile: true } : { viewport: { width: w, height: h } });

    test(`S1 one glide frames the whole chain at the opponent's choice and holds it to the hand; never closer than the roll's zoom (${w})`, async ({ page }) => {
      const j = journey(page);
      await hisCase(page, j);
      const frames = await playOut(page, j);
      const c = choiceAt(frames);
      expect(c, "premise: the opponent goes for a move").toBeGreaterThan(0);
      expect(frames[c].text, "premise: it is Body Lock Pass").toContain("Body Lock Pass");
      const end = frames.findIndex((f, i) => i > c && !f.pulse && !f.actor);   // the landing: the camera is his again there
      const turn = frames.slice(c, end > 0 ? end : undefined);
      // ONE GLIDE: from the choice to the landing the camera's width only grows, then holds (never a framing per leg)
      for (let i = 1; i < turn.length; i++) expect(turn[i].vw, `one glide: the width never closes in again during his turn (frame ${i})`).toBeGreaterThanOrEqual(turn[i - 1].vw - 0.5);
      expect(Math.min(...turn.map((f) => f.vw)), "never closer than the roll's zoom").toBeGreaterThanOrEqual(turn[0].rest - 0.5);
      // once the glide has settled, every place of the chain the frame drew is in the visible map, at every frame to the hand
      const settled = turn.filter((f, i) => i > 0 && Math.abs(f.vw - f.tvw) < 1 && f.chain);
      expect(settled.length, "premise: the glide settles while he travels").toBeGreaterThan(3);
      for (const f of settled) for (const L of f.chain.legs) {
        expect(inside({ x: L.x1, y: L.y1 }, f.band) && inside({ x: L.x2, y: L.y2 }, f.band), `every place of the chain is in the visible map (${JSON.stringify(L)})`).toBe(true);
      }
      const last = frames[frames.length - 1];
      expect(last.held, "the camera is his again when he can act").toBe(false);
    });

    test(`S2 the path drawn with direction, the chain named at the names' own size, the light from the opponent's choice to the hand (${w})`, async ({ page }) => {
      const j = journey(page);
      await mountCase(page, j, 0.55, 0.2);
      const frames = await playOut(page, j);
      const c = choiceAt(frames);
      expect(frames[c].text, "premise: the opponent goes for Trap and Roll").toContain("Trap and Roll");
      const mid = frames.filter((f, i) => i > c && f.pulse && f.actor === "Defending" && Math.abs(f.vw - f.tvw) < 1).slice(-1)[0];
      expect(mid, "premise: a settled frame of his travel").toBeTruthy();
      const opp = mid.chain.legs.filter((L: W) => L.who === "opp");
      expect(opp.length, "his two legs are drawn: to his move, and on to where it lands").toBe(2);
      // the arrowhead's ink: sampled where the frame drew it, inside its triangle, in the opponent's colour
      const ink = await page.evaluate((legs) => {
        const a = (window as W).__neural, ctx = a.canvas.getContext("2d"), dpr = a.canvas.width / a.canvas.getBoundingClientRect().width;
        return legs.map((L: W) => { const d = Math.hypot(L.x2 - L.x1, L.y2 - L.y1) || 1, ux = (L.x2 - L.x1) / d, uy = (L.y2 - L.y1) / d;
          const x = L.x2 - ux * 4, y = L.y2 - uy * 4, p = ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data; return [p[0], p[1], p[2]]; });
      }, opp);
      for (const [r, g, b] of ink) expect(r > 170 && r > b + 40 && g > 70, `an arrowhead at the destination, in the opponent's colour (${r},${g},${b})`).toBe(true);
      // named: the three places (where he stood, the opponent's move, where it lands), through the planner, never overlapping
      const P = frames[0].cur, [{ b: O }, { b: L }] = opp;
      const named = new Map(mid.names.map((b: W) => [b.i, b]));
      for (const i of [O, L]) expect(named.has(i), "the chain's places are named (" + i + ")").toBe(true);
      const boxes = [P, O, L].map((i) => named.get(i)).filter(Boolean) as W[];
      for (const b of boxes) expect(b.b - b.t, "at the names' own size").toBeGreaterThanOrEqual(9);
      for (let x = 0; x < boxes.length; x++) for (let y = x + 1; y < boxes.length; y++) expect(overlap(boxes[x], boxes[y]), "the chain's names never overlap").toBe(false);
      // the light: from the opponent's choice, the chain's, then nothing 0.6 s after the hand (the roll runs again)
      expect(mid.light, "lit from the opponent's choice: the chain's light, at where he stood").toEqual({ chain: true, place: P });
      expect(frames.slice(0, c).every((f) => !f.light), "no light before the opponent's choice").toBe(true);
      await j.advance(800);
      const after = await snap(page);
      expect([after.light, after.chain], "0.6 s after the hand, no light and no path").toEqual([null, null]);
    });

    test(`S3 the banner says the whole sentence in order and keeps the last line until his next press; at ${w} its two lines clear the chain`, async ({ page }) => {
      const j = journey(page);
      await mountCase(page, j, 0.55, 0.2);
      const frames = await playOut(page, j);
      const said = frames.map((f) => [f.kick, f.text]).filter((p, i, A) => i === 0 || p.join("|") !== A[i - 1].join("|"));
      expect(said, "the sentence, in order, the kicker keeping the line before").toEqual(expect.arrayContaining([
        ["You go for Gift Wrap", "Your Gift Wrap failed"],
        ["Your Gift Wrap failed", "Opponent goes for Trap and Roll from Mount"],
        ["Opponent goes for Trap and Roll from Mount", "It lands: you are in Closed Guard, bottom"],
      ]));
      const c = choiceAt(frames);
      for (const f of frames.slice(c).filter((f) => f.chain && Math.abs(f.vw - f.tvw) < 1)) {
        expect(f.banner.clipped, "the banner's line is whole").toBe(false);
        for (const L of f.chain.legs) expect(Math.min(L.y1, L.y2), "the banner's lines clear the chain").toBeGreaterThan(f.banner.b);
      }
      await j.advance(2000);
      expect((await snap(page)).text, "the last line stays while he looks").toBe("It lands: you are in Closed Guard, bottom");
    });
  });
}

test("S3 a move of his that fails and stays says so, and his countered miss says where it left him", async ({ page }) => {
  const j = journey(page);
  await mountCase(page, j, 0.55, 0.6);
  let frames = await playOut(page, j);
  expect(frames[frames.length - 1].text, "it fails: you stay").toBe("It fails: you stay in Mount, top");
  await mountCase(page, j, 0.9, 0.6);
  frames = await playOut(page, j);
  expect(frames.some((f) => f.text === "Your Gift Wrap was countered: you go to Half Guard"), "a countered miss says where it left him").toBe(true);
});

test("S1 the opponent's legs last at most 1.0 s each; his own are as before", async ({ page }) => {
  const j = journey(page);
  await hisCase(page, j);
  const frames = await playOut(page, j);
  const segs: W[] = [];
  for (let i = 1; i < frames.length; i++) {
    const p = frames[i].pulse; if (!p) continue;
    const key = p.path.join(">") + "#" + p.seg, last = segs[segs.length - 1];
    if (!last || last.key !== key) segs.push({ key, from: frames[i - 1].now, to: frames[i].now, cap: p.cap, first: p.seg === 0, opp: frames[i].actor === "Defending" });
    else last.to = frames[i].now;
  }
  const opp = segs.filter((s) => s.opp);
  expect(opp.length, "premise: his two legs, out to Body Lock Pass and back").toBe(2);
  for (const s of opp) expect(s.to - s.from, "at most 1.0 s a leg (the first waits 0.38 s more as the edge tenses)").toBeLessThanOrEqual((s.first ? 1.38 : 1.0) + 0.15);
  expect(opp.every((s) => s.cap === 1), "his pulse carries the cap").toBe(true);
  expect(segs.filter((s) => !s.opp).every((s) => s.cap === null), "the player's own pulse does not").toBe(true);
});

test("S1 the reward notice is held through the opponent's turn and shown when the hand comes", async ({ page }) => {
  const j = journey(page);
  await hisCase(page, j);
  let raised = false;
  const frames: W[] = [];
  for (let k = 0; k < 300; k++) {
    await j.advance(100);
    const s = await snap(page);
    if (!raised && s.actor === "Defending") { raised = true; await page.evaluate(() => (window as W).__neural.queueChallengeReward("patch", "white-foundations")); }
    frames.push(await snap(page));
    if (k > 3 && s.hand > 0 && !s.pulse && !s.actor) break;
  }
  expect(raised, "premise: a notice was raised during his turn").toBe(true);
  expect(frames.filter((f) => f.actor === "Defending").every((f) => !f.reward), "no notice during his turn").toBe(true);
  await expect(page.locator(".ng-challenge-reward"), "it shows when he can act").toBeVisible({ timeout: 3000 });
});

test("S4 the article steps back from his miss until he can act, never swapped, and the address writes no entry", async ({ page }) => {
  const j = journey(page);
  const before = await hisCase(page, j);
  const art = () => page.evaluate(() => [...document.querySelectorAll("article[data-source-path]")].filter((e: W) => e.offsetParent !== null).map((e: W) => e.dataset.sourcePath).join(","));
  const page0 = await art();
  const frames: W[] = [];
  let dimmed: number | null = null;
  for (let k = 0; k < 300; k++) {
    await j.advance(100);
    const s = await snap(page);
    frames.push(s);
    if (dimmed == null && s.actor === "Defending") {
      await page.waitForTimeout(450);   // the step back's 0.3 s transition runs on the page's own clock
      dimmed = (await snap(page)).articleOpacity;
      expect(await art(), "the same article, never swapped for the opponent's move's").toBe(page0);
    }
    if (k > 3 && s.hand > 0 && !s.pulse && !s.actor) break;
  }
  const c = choiceAt(frames);
  expect(frames.slice(c).filter((f) => f.actor === "Defending").every((f) => f.stepBack && f.url === before.url), "the article steps back all his turn, on the page he pressed from").toBe(true);
  expect(dimmed, "…dimmed to NG_CHAIN.dim").toBeCloseTo(0.22, 2);
  const last = frames[frames.length - 1];
  expect(last.stepBack, "and comes back when he can act").toBe(false);
  expect(last.hist, "no history entry for his turn").toBe(before.hist);
});

test("S1 under reduced motion the framing is set at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const j = journey(page);
  await hisCase(page, j);
  const frames = await playOut(page, j);
  const c = choiceAt(frames);
  expect(Math.abs(frames[c].vw - frames[c].tvw), "the camera is where the framing put it on the frame of his choice").toBeLessThan(1);
});

// THE DRILL'S WINDOW WITH HIS LEG CAPPED (the orchestrator's point 5: `_prefetchDefendDeck`'s "travel + 0.3 s is the
// window; the drill must not wait on it" must still hold). His finish at its SHORTEST leg (Loop Choke from Closed Guard: the
// 0.6 s least, plus the 0.38 s the edge tenses), on a FRESH page whose defend deck has not been asked for (the premise is
// read at his choice), with the CPU throttled 4x from the press on: the drill starts on its own defend deck, with cards,
// 0.3 s after the travel. The other nine finishes at Closed Guard, measured the same way, are in reports/mapshows.md.
test("S1 at the opponent's shortest finish leg, on a cold page with the CPU throttled 4x, the drill starts on its own defend deck", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Closed Guard Top");
  const t = await page.evaluate(() => { const a = (window as W).__neural; for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "transitions") return a.nodes[i].t as string; return null; });
  expect(t, "premise: the hand deals a transition").toBeTruthy();
  await j.rig("resolve", [0.999]); await j.rig("outcome", [0.01]); await j.rig("opp-finish", [0.0, 0.0]); await j.rig("opp-sub-pick", [0.9]);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await j.pick(t as string);
  let from: number | null = null, to: number | null = null, cold: boolean | null = null, out: W = null;
  for (let k = 0; k < 400 && !out; k++) {
    await j.advance(50);
    const s = await page.evaluate(() => { const a = (window as W).__neural, p = a.pulse;
      return { now: a.now, p: p && !p.done ? p.path.slice() : null, actor: a.activeMove ? a.activeMove.verb : null, d: a._defendSub } });
    if (s.p && s.actor === "Defending" && from == null) {
      from = s.now;
      cold = await page.evaluate((i) => { const a = (window as W).__neural; return !a._deckHasCards(a.defendKeyFor(a.nodes[i])); }, s.p[s.p.length - 1]);
    }
    if (from != null && to == null && !s.p) to = s.now;
    if (s.d != null) out = await page.evaluate((d) => { const a = (window as W).__neural, n = a.nodes[d], dk = a.defendKeyFor(n); return { sub: n.t, dk, panic: a._panicKey, cards: a._deckHasCards(dk), now: a.now }; }, s.d);
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  expect(out && out.sub, "premise: he goes for Loop Choke from Closed Guard").toBe("Loop Choke from Closed Guard");
  expect(cold, "premise: its defend deck was not in when he chose it (a cold page)").toBe(true);
  expect((to as number) - (from as number), "premise: his leg is the shortest there is (0.6 s, after the 0.38 s the edge tenses)").toBeLessThanOrEqual(1.0);
  expect([out.panic, out.cards], "the drill starts on its own defend deck, with its cards").toEqual([out.dk, true]);
  expect(out.now - (to as number), "…0.3 s after his travel, never waiting on the deck").toBeLessThanOrEqual(0.4);
});
