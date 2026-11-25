import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * THE OPPONENT'S "OFF" IS A STUDY (OFF1, v1.302.0; the owner's U218 b, 25 Nov 2026: "Two choices: Normal · Off (new)").
 * It used to be a weaker opponent (skill 0: moves still missed and the opponent's turn ran after every miss). With the stored value
 * `difficulty` "off" (the same key and value, nothing migrated), a roll is a study (`_studyRoll`, app.src.jsx):
 *  1. every move the player picks lands at its own success destination, with no dice, and the opponent never takes a turn;
 *     there is no move budget; no Win % anywhere (card, status line, win bar) and no threats row; nothing in Last rolls and
 *     no challenge progress from the roll, while the hand read still counts;
 *  2. a finish lands, its card stays, the banner says "You finish with X", and the roll ends quietly: no verdict, no
 *     countdown, no restart, one New roll press in the hand's place (a fold claim at 390x631, by touch);
 *  3. a roll staged from the map is a study too (rollFromPosition's latch);
 *  4. a belt test plays the opponent at a sampled skill whatever the setting (it ran at skill 0 under "off" before);
 *  5. Settings' "Opponent" row is two choice cards, Normal (Recommended) and Off, each writing `difficulty` and nothing else.
 * Every miss is RIGGED to happen (`resolve` 0.999, above any move's chance): the Normal control proves the rig bites, so a
 * study that rolled dice would miss here, deterministically (§6.3: rig every draw that could decide the branch).
 * Presses are a real mouse (`clickByMouse`) at 1440x900 and a touch tap at a measured, owned point at 390x631.
 * NOT covered here: the harness serves `{}` for dossiers, so no film strip (the film's Win % row is the app's own branch, read
 * in the report's pictures on a real server); what Normal does draw for draw is the seeded proof in reports/oppoff.md.
 * MUTANTS (OFF1, each alone on a clean tree, against a green control): "commit" dropped from NG_STUDY_UNCOUNTED (a study's
 * move completes "Execute a move") -> "a new guest's first study move" red (OFF1-R2); `tensionSweep`'s study branch removed (a move rolls
 * dice in Off) -> "every move lands" red; rollFromPosition's latch set to false (a staged roll plays the opponent) -> "a roll
 * staged from the map" red; the belt-test exemption removed from that latch (a capstone at skill 0) -> "a belt test" red.
 */

const CURRICULUM = JSON.parse(readFileSync(resolve(__dirname, "../../source/public/static/neural/curriculum.json"), "utf8"));
const WHITE = CURRICULUM.belts[0];
const OFF = { v: 2, settings: { difficulty: "off" }, settingsAt: { difficulty: 5 } };
const W = (page: Page) => page.evaluate.bind(page);
const OPPONENT_BEATS = ["impact_fail", "opponent_move", "opponent_attack", "defend_start", "caught", "sweep_start"];

/** Press as a player does: the real mouse, or a touch tap at the control's measured centre, which must be its own. */
async function press(page: Page, j: ReturnType<typeof journey>, sel: string, touch: boolean, what: string) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  if (!touch) return j.clickByMouse(sel, what);
  const b = (await page.locator(sel).first().boundingBox())!;
  const vp = page.viewportSize()!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  expect(x >= 0 && x <= vp.width && y >= 0 && y <= vp.height, `${what}: its centre is on screen (${x.toFixed(0)}, ${y.toFixed(0)})`).toBe(true);
  const own = await page.evaluate(([px, py, s]) => {
    const e = document.elementFromPoint(px as number, py as number), t = document.querySelector(s as string);
    return !!e && !!t && (e === t || t.contains(e));
  }, [x, y, sel] as [number, number, string]);
  expect(own, `${what}: the control owns its centre`).toBe(true);
  await page.touchscreen.tap(x, y);
}

/** The first dealt move of a kind (a transition, or a submission's entry), by its title, with where its success rows go. */
const dealt = (page: Page, kind: "transitions" | "submissions") => page.evaluate((k) => {
  const a = (window as any).__neural;
  const opt = (a._optList || []).find((o: any) => o.node.ty === k && o.action !== "finish");
  if (!opt) return null;
  const act = a._actOf(opt);
  const to = ((act.cal && act.cal.outcomes) || []).filter((o: any) => o.result === "success" && o.to !== "game-over")
    .map((o: any) => { const r = a.resolveOutcomeTo(o.to); return r.idx >= 0 ? a.siteIdOf(a.nodes[a.canonicalState(r.idx, r.role || a.playerRole)].id) : null; });
  return { t: opt.node.t, to };
}, kind);

const beatsSince = (page: Page, n: number) => page.evaluate((k) => ((window as any).__neural.beats || []).slice(k).map((b: any) => b.beat), n);
const beatCount = (page: Page) => page.evaluate(() => ((window as any).__neural.beats || []).length);

for (const [w, h, touch] of [[1440, 900, false], [390, 631, true]] as [number, number, boolean][])
  test.describe(`${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });

    test(`at ${w}x${h}: Normal control: the rigged miss hands the opponent a turn`, async ({ page }) => {
      const j = journey(page);
      await j.boot("/");
      await j.land("Mount Top");
      const move = (await dealt(page, "transitions"))!;
      expect(move, "a transition is dealt at Mount, top").not.toBeNull();
      await j.rig("resolve", [0.999]);
      const n = await beatCount(page);
      await press(page, j, `[data-tech="${move.t}"] .ng-choice-title-button`, touch, "Choose " + move.t);
      await j.advanceUntil("opponent_move", 16000).catch(() => j.advanceUntil("opponent_attack", 8000));
      const seen = await beatsSince(page, n);
      expect(seen, "the move missed").toContain("impact_fail");
      expect(seen.some((b) => b === "opponent_move" || b === "opponent_attack"), "and the opponent took a turn").toBe(true);
      expect(await W(page)(() => (window as any).__neural._studyRoll), "a Normal roll is not a study").toBe(false);
    });

    test(`at ${w}x${h}: Off: every move lands, the opponent never moves, no Win % or threats, nothing counted, no budget`, async ({ page }) => {
      const j = journey(page);
      await j.boot("/", { initialState: OFF, keepTutorial: true });
      await j.land("Mount Top");
      const s0 = await W(page)(() => { const a = (window as any).__neural; return { study: a._studyRoll, ai: a.aiSkill }; });
      expect(s0, "the stored 'off' plays the new Off: a study, with no opponent skill").toEqual({ study: true, ai: 0 });
      // the hand: its move % and no Win % anywhere, no threats row, the value line empty, the win bar away
      await expect(page.locator('[data-choice-group="you"] [data-tech]').first(), "a hand is dealt").toBeVisible();
      await expect(page.locator('[data-choice-group="opponent"]'), "no threats row").toHaveCount(0);
      await expect(page.locator("[data-choice-win]"), "no Win % on any card").toHaveCount(0);
      // every card prints a number: a move its own odds, an entry ("Works") its finish's own chance (on Normal that one waits
      // for the solve and reads "—" until then; a study asks no solve)
      const odds = await page.locator('[data-choice-group="you"] .ngodds').allTextContents();
      expect(odds.length, "the hand's cards").toBeGreaterThan(3);
      expect(odds.filter((t) => !/^(\d+|<1|>99)$/.test(t)), "every card keeps its own %").toEqual([]);
      await expect(page.locator("[data-choice-value-status]"), "the value line says nothing").toHaveText("");
      await j.advance(200);
      await expect(page.locator(".ng-winbar"), "the win bar is away").toHaveAttribute("data-away", "");
      // FOLD (390x631): the first card's move % is on screen, under the fold line
      if (touch) {
        const r = (await page.locator('[data-choice-group="you"] .ngodds').first().boundingBox())!;
        expect(r.y + r.height <= h && r.y >= 0, `the move % is on screen at ${w}x${h} (${r.y.toFixed(0)}..${(r.y + r.height).toFixed(0)})`).toBe(true);
      }
      // a budget of two, then three moves, each rigged to miss: every one lands at one of its own success places
      await W(page)(() => { (window as any).__neural.maxMoves = 2; });
      const start = await beatCount(page);
      for (let i = 0; i < 3; i++) {
        const move = (await dealt(page, "transitions"))!;
        expect(move && move.to.length, `move ${i + 1}: a transition with a success place is dealt`).toBeTruthy();
        await j.rig("resolve", [0.999]);
        await j.rig("outcome", [0.999]);
        const n = await beatCount(page);
        await press(page, j, `[data-tech="${move.t}"] .ng-choice-title-button`, touch, "Choose " + move.t);
        await j.nextHand(20000);
        const seen = await beatsSince(page, n);
        expect(seen.filter((b) => OPPONENT_BEATS.includes(b)), `move ${i + 1} (${move.t}): no dice, no miss, no opponent`).toEqual([]);
        expect(seen, `move ${i + 1}: it lands`).toContain("study_land");
        const at = await W(page)(() => { const a = (window as any).__neural; return a.siteIdOf(a.nodes[a.currentPos].id); });
        expect(move.to, `move ${i + 1}: ${move.t} lands at one of its success places (at ${at})`).toContain(at);
        const left = await W(page)(() => ((window as any).__neural._rig || {}).resolve?.length || 0);
        expect(left, `move ${i + 1}: the rigged dice were never drawn`).toBeGreaterThan(0);
      }
      const seen = await beatsSince(page, start);
      expect(seen, "no budget: three moves on a budget of two, and the roll goes on").not.toContain("roll_end");
      // nothing counted: no Last rolls entry, no roll challenge; the hand read counts as ever
      const counted = await W(page)(() => {
        const a = (window as any).__neural, box = document.createElement("div");
        a.renderRollHistory(box);
        const c = a.challenges || {};
        return { past: (a._pastRolls || []).length, empty: !!box.querySelector("[data-hist-empty]"), commit: !!c["white.commit"]?.done,
          win1: !!c["white.win1"]?.done, read: !!c["white.coach1"]?.done };
      });
      expect(counted, "Last rolls holds nothing; no roll challenge ticked; reading the hand did").toEqual({ past: 0, empty: true, commit: false, win1: false, read: true });
      // OFF1-R1: and the badge's "Today: … rolls" does not count the study running now
      const badge = await W(page)(() => { const a = (window as any).__neural; a._paintBadge(); return document.querySelector("[data-badge-today]")?.textContent || null; });
      expect(badge, "the badge counts no study").toMatch(/· 0 rolls$/);
    });

    test(`at ${w}x${h}: Off: a finish lands, its card stays, and the roll ends quietly with New roll`, async ({ page }) => {
      const j = journey(page);
      await j.boot("/", { initialState: OFF });
      await j.land("Mount Top");
      const sub = (await dealt(page, "submissions"))!;
      expect(sub, "a submission is dealt at Mount, top").not.toBeNull();
      await j.rig("resolve", [0.999, 0.999]);
      await press(page, j, `[data-tech="${sub.t}"] .ng-choice-title-button`, touch, "Enter " + sub.t);
      await j.nextHand(20000);   // standing in the submission: its one Finish
      const n = await beatCount(page);
      await press(page, j, `[data-choice-action="finish"] .ng-choice-title-button`, touch, "Finish " + sub.t);
      await j.advanceUntil("study_finish", 16000);
      await j.advance(10000);   // a verdict's hold, a countdown and a restart would all have run by now
      const seen = await beatsSince(page, n);
      for (const b of ["roll_end", "finish", "victory_cascade", "ladder_up", "roll_archived", ...OPPONENT_BEATS])
        expect(seen, `no ${b} in a study's finish`).not.toContain(b);
      expect(seen.filter((b) => b === "land" || b === "options_dealt"), "no new roll began").toEqual([]);
      const st = await W(page)(() => { const a = (window as any).__neural; return { out: a._lastOutcome, at: a.nodes[a.focusIdx]?.t, past: (a._pastRolls || []).length }; });
      expect(st, "the study is over, on the submission, filed nowhere").toEqual({ out: "study", at: sub.t, past: 0 });
      expect(await page.evaluate(() => (window as any).__neural.evKickerRef.current?.textContent), "the banner").toBe("You finish with");
      await expect(page.locator(".ng-landcard").first(), "its card stays").toBeVisible();
      const nr = page.locator("[data-study-new-roll]");
      await expect(nr, "one New roll press").toHaveCount(1);
      await expect(nr).toBeVisible();
      expect(await page.evaluate(() => { const x = (window as any).__neural._handCloseEl; return !x || getComputedStyle(x).visibility === "hidden"; }), "no hand ✕ beside it: there is no hand to put away").toBe(true);
      // OFF1-R1: it wears the app's own type (an invalid `font` shorthand fell back to the button default), and putting the
      // hand away never takes it: it is the only way on
      expect(await page.evaluate(() => { const b = document.querySelector("[data-study-new-roll]")!; return [getComputedStyle(b).fontFamily === getComputedStyle(b.parentElement!).fontFamily, getComputedStyle(b).fontWeight]; }), "New roll's type").toEqual([true, "600"]);
      await W(page)(() => (window as any).__neural.setLayer("hand", false, "settings"));
      await j.advance(200);
      await expect(nr, "with the hand put away, New roll stays").toBeVisible();
      await W(page)(() => (window as any).__neural.setLayer("hand", true, "settings"));
      await j.advance(200);
      // FOLD: New roll is wholly on screen and owns its centre, at 390x631 by touch (press() measures both)
      const r = (await nr.boundingBox())!;
      expect(r.y >= 0 && r.y + r.height <= h && r.x >= 0 && r.x + r.width <= w, `New roll is wholly on screen at ${w}x${h}`).toBe(true);
      const m = await beatCount(page);
      await press(page, j, "[data-study-new-roll]", touch, "New roll");
      await j.nextHand(30000);
      const after = await page.evaluate((k) => ((window as any).__neural.beats || []).slice(k), m);
      const closed = after.find((b: any) => b.beat === "roll_discarded");
      expect(closed && closed.study, "New roll closes the study, filed nowhere").toBe(true);
      expect(await W(page)(() => { const a = (window as any).__neural; return [a._studyRoll, (a._pastRolls || []).length]; }), "the next roll is a study too").toEqual([true, 0]);
    });

    test(`at ${w}x${h}: Off: a roll staged from the map is a study too`, async ({ page }) => {
      const j = journey(page);
      await j.boot("/", { initialState: OFF });
      await j.land("Mount Top");
      await W(page)(() => {
        const a = (window as any).__neural, at = a.nodes.findIndex((n: any) => n.ty === "positions" && n.t === "Side Control Top" && n.role === "top");
        a.stageRollAt(at, "top");
      });
      await j.nextHand(20000).catch(() => null);
      const s = await W(page)(() => { const a = (window as any).__neural; return { study: a._studyRoll, ai: a.aiSkill, staged: a.paused }; });
      const move = (await dealt(page, "transitions"))!;
      await j.rig("resolve", [0.999]);
      const n = await beatCount(page);
      await press(page, j, `[data-tech="${move.t}"] .ng-choice-title-button`, touch, "Choose " + move.t);
      await j.nextHand(20000);
      const seen = await beatsSince(page, n);
      expect(seen.filter((b) => OPPONENT_BEATS.includes(b)), `the staged roll's move (${move.t}): no dice, no opponent`).toEqual([]);
      expect(seen).toContain("study_land");
      expect([s.study, s.ai], "a staged roll in Off is a study").toEqual([true, 0]);
    });
  });

test("Off: a belt test plays the opponent at a sampled skill, whatever the setting", async ({ page }) => {
  const prep: Record<string, number> = {}, units: Record<string, any> = {};
  for (const unit of WHITE.units) { units[`${WHITE.id}/${unit.id}`] = { checkpoint: true, t: 1 }; for (const l of unit.lessons) prep[l.deckKey] = 3; }
  const j = journey(page);
  await j.boot("/", { initialState: { v: 2, prep, rec: { ...prep }, stage: {}, units, belts: { won: {}, held: { id: WHITE.id, t: 1 }, gf: 1 },
    tut: { done: {} }, challenges: {}, badges: {}, coins: {}, days: {}, settings: { difficulty: "off" }, settingsAt: { difficulty: 5 }, updatedAt: 1 } });
  await j.land("Mount Top");
  expect(await W(page)(() => (window as any).__neural._studyRoll), "premise: the ordinary roll is a study").toBe(true);
  await page.evaluate((id) => { (window as any).__neural.settings.challengeSelectedTrack = id; }, WHITE.id);
  await j.openCorridor();
  await page.locator(`.ng-track-card[data-track="${WHITE.id}"]`).click();
  await j.rig("ai-skill", [0.5]);
  await press(page, j, `[data-capstone="${WHITE.id}"] button`, false, "Start the White capstone");
  await expect.poll(() => W(page)(() => !!(window as any).__neural._beltTest), { message: "the capstone runs" }).toBe(true);
  const s = await W(page)(() => { const a = (window as any).__neural; return { study: a._studyRoll, ai: a.aiSkill }; });
  expect(s.study, "a belt test is never a study").toBe(false);
  expect(s.ai, "and its opponent has a sampled skill, never 0").toBeCloseTo(0.06 + 0.5 * 0.14, 6);
});

for (const [w, h, touch] of [[1074, 796, false], [390, 631, true]] as [number, number, boolean][])
  test.describe(`settings ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    test(`at ${w}x${h}: Settings' Opponent row: two choice cards, each writing difficulty and nothing else`, async ({ page }) => {
      const j = journey(page);
      await j.boot("/");
      await page.evaluate(() => (window as any).__neural.openSettings("rolling"));
      const row = page.locator("[data-settings-opponent]");
      await expect(row, "the row is drawn once").toHaveCount(1);
      await j.settingsAtRest();
      await expect(row.locator("[data-opponent-pick] [data-choice-name]"), "two choices, Normal first").toHaveText(["Normal", "Off"]);
      await expect(row.locator('[data-opponent-pick="normal"] .ng-set-tag'), "Normal is recommended").toHaveText("Recommended");
      await expect(row, "nothing stored: Normal").toHaveAttribute("data-settings-opponent", "normal");
      await expect(row.locator('[data-opponent-pick="normal"]')).toHaveAttribute("aria-checked", "true");
      for (const v of ["off", "normal", "off"]) {
        const before = await W(page)(() => ({ ...((window as any).__neural._settingsAt || {}) }));
        const sel = `[data-opponent-pick="${v}"]`;
        for (let i = 0; i < 30; i++) {
          await j.scrollSettled(sel);
          const r = await page.locator(sel).boundingBox(), p = (await page.locator('[role="tabpanel"]').boundingBox())!;
          if (r && r.y >= p.y && r.y + r.height <= p.y + p.height) break;
          await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
          await page.mouse.wheel(0, r && r.y < p.y ? -160 : 160);
        }
        await press(page, j, sel, touch, `Opponent: ${v}`);
        await expect.poll(() => W(page)(() => (window as any).__neural.get("difficulty", "normal")), { message: `pressed ${v}` }).toBe(v);
        await expect(page.locator("[data-settings-opponent]")).toHaveAttribute("data-settings-opponent", v);
        await expect(page.locator(`[data-opponent-pick="${v}"]`)).toHaveAttribute("aria-checked", "true");
        const after = await W(page)(() => ({ ...((window as any).__neural._settingsAt || {}) }));
        const written = Object.keys(after).filter((k) => after[k] !== before[k]);
        expect(written, `pressed ${v}: only difficulty is written`).toEqual(["difficulty"]);
      }
    });
  });

// OFF1-R2 (the orchestrator's press on b527e314d, 390x631, touch: a NEW guest, Off picked in Settings, a reload, a tap on Kimura
// from Mount; after the tap: engaged, land_q_ignored, commit, land, options_dealt, challenge_completed, tut_step, ...). The
// journeys above start from a seeded state; this one is a guest with nothing stored, through the real press and a reload.
test.describe("new guest 390x631", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true });
  test("a new guest's first study move completes no roll step: what it completes is a study step, named", async ({ page }) => {
    const j = journey(page);
    await j.boot("/Positions/Mount/Top", { keepTutorial: true });
    await page.evaluate(() => (window as any).__neural.openSettings("rolling"));
    await j.settingsAtRest();
    const sel = '[data-opponent-pick="off"]';
    for (let i = 0; i < 30; i++) {
      await j.scrollSettled(sel);
      const r = await page.locator(sel).boundingBox(), p = (await page.locator('[role="tabpanel"]').boundingBox())!;
      if (r && r.y >= p.y && r.y + r.height <= p.y + p.height) break;
      await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
      await page.mouse.wheel(0, r && r.y < p.y ? -160 : 160);
    }
    await press(page, j, sel, true, "Opponent: Off");
    await expect.poll(() => W(page)(() => (window as any).__neural.get("difficulty", "normal"))).toBe("off");
    await j.boot("/Positions/Mount/Top", { preserveStorage: true, keepTutorial: true });   // the reload
    for (let i = 0; i < 40; i++) {
      if (await W(page)(() => { const a = (window as any).__neural; return !!(a._optList || []).find((o: any) => o.node.t === "Kimura from Mount") && !a._execution; })) break;
      await j.advance(500);
    }
    const n = await beatCount(page);
    const before = await W(page)(() => { const a = (window as any).__neural; return { study: a._studyRoll, done: Object.keys(a.challenges || {}).filter((k) => a.challenges[k].done).sort() }; });
    await press(page, j, '[data-tech="Kimura from Mount"] .ng-choice-title-button', true, "Kimura from Mount");
    await j.advanceUntil("options_dealt", 16000);
    await j.advance(1500);
    const after = await page.evaluate((k) => { const a = (window as any).__neural; return { beats: (a.beats || []).slice(k).map((b: any) => ({ beat: b.beat, id: b.id })), done: Object.keys(a.challenges || {}).filter((x) => a.challenges[x].done).sort() }; }, n);
    expect(before.study, "the reloaded roll (a page arrival) is a study").toBe(true);
    // The tap played a move (its `commit` beat fired), and the one challenge it completed is a STUDY step: "Read your hand"
    // (white.coach1, tutorial step coach1), from `options_dealt`, the hand dealt after the move. A page arrival's own hand
    // emits no `options_dealt` (the reader's arrival holds it), which is why a new guest meets this step on the first move.
    const beats = after.beats.map((b: any) => b.beat);
    expect(beats, "the tap played a move").toContain("commit");
    const completed = after.beats.filter((b: any) => b.beat === "challenge_completed").map((b: any) => b.id);
    expect(completed, "the one challenge the first move completed").toEqual(["white.coach1"]);
    const at = beats.indexOf("challenge_completed");
    expect(beats.slice(0, at).filter((b: string) => b !== "tut_step").pop(), "and the beat that completed it").toBe("options_dealt");
    expect(after.beats.filter((b: any) => b.beat === "tut_step").map((b: any) => b.id), "the tutorial step it ticked").toEqual(["coach1"]);
    // no roll step, before the tap or after it
    for (const id of ["white.commit", "white.sweep", "white.win1", "white.defend", "white.escape", "white.roll"])
      expect(after.done, `${id} (a roll step) is not done in a study`).not.toContain(id);
  });
});
