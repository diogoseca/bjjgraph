import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * WEAK SPOTS, ACCEPTANCE — the owner's 2026-09-30 rulings, end to end, through the surfaces a player
 * uses. Unit coverage lives in tests/flow.test.mjs; this file is the proof he asked for in his words.
 *
 *   Gi pricing:  "ideally fix weak spots now" — a gi player was being ranked on no-gi numbers.
 *   The start:   "it should match the starting point set by the app indeed".
 *
 * THE SURFACE. Explore's "N new" cell opens the study plan, and its "Learn next" rows ARE the weak-spots
 * ranking whenever no study comparison exists (D1, same day: "fall back to the weak-spots ranking so
 * every player, a new one included, always has a plan"). The section note says so in the plan itself
 * ("weakest first"), and every read below requires that note, so a comparison-ranked plan can never be
 * read as this ranking. Settings is where the player picks the uniform and where the roll starts. Every
 * click is a measured mouse click (`clickByMouse`); every assertion reads the rendered rows by their own
 * marker, `data-session-row` (the deck key), and pairs lists by that identity, never by position.
 *
 * WHY A 200-CARD DAILY GOAL. "Learn next" holds as many decks as the goal buys: 3 at the default 30, ~20
 * at the 200 maximum. The player sets it in Settings → Flashcards, here by mouse, so every list compared
 * holds at least ROWS_FLOOR rows (§6.6: three rows can agree by accident).
 *
 * WHY CLAIM 1 BOOTS TWICE. A gi player's plan differs from a no-gi player's even on no-gi numbers,
 * because the two rulesets reach different states: comparing the two plans cannot tell the gi numbers
 * apart from the gi state space (measured: pinning FLOW's frame to "nogi" left that comparison green).
 * The control is the SAME player on a wire whose gi hands (`cal.evGi`) are removed, which is what a
 * stale cached payload serves; the app then prices gi on no-gi hands, exactly as it did for everyone
 * before v1.209.0, and says so (`flow_frame_fallback`). One build, booted twice (§6.6).
 *
 * THE CLAIMS, each with the mutant of the BUILT bundle that turns it red:
 *   1. A gi player's weak spots come from gi numbers, and differ from no-gi where they must:
 *      a. the no-gi plan never shows a deck the wire rules out of no-gi (`cal.avail.nogi === false`);
 *      b. gi numbers move the gi plan: without the gi hands, the same gi player gets a different plan
 *         (the pre-v1.209.0 one), over at least SHARED_FLOOR shared spots;
 *      c. and never the no-gi plan: a no-gi player's plan is identical on both wires;
 *      d. gi → no-gi → gi gives back the first gi plan exactly (a recompute, and not noise);
 *      e. the full wire never announces `flow_frame_fallback`, and the stripped one does — the proof
 *         that the control really ran on no-gi hands.
 *   2. The ranking follows the start setting, and changes when it changes:
 *      a. where it must: from Standing every roll opens on Standing Position, so its deck ranks in the
 *         Standing plan, and higher than in the Anywhere plan (absent counts as below the last row);
 *      b. Standing and Anywhere are different rankings;
 *      c. back to Anywhere gives back the first Anywhere plan exactly;
 *      d. "My weak spots" ranks exactly as Anywhere. That is the SHIPPED READING (v1.209.0), not his
 *         words: that setting opens rolls on the spots this ranking names, so ranking from those
 *         openings would feed back on itself (`_flowStartSpec`'s own comment);
 *      e. the app never announced a start it could not honour (`flow_start_fallback`).
 *   The open plan does not re-rank when a setting changes (its order is frozen while the player works
 *   through it, D2), so 1 re-reads through ‹ Back → Explore → "N new", and 2 through the plan's own
 *   "Refresh plan": both of the player's ways back to it are exercised.
 *
 * THERE IS NO FIXED-POSITION START. His ruling says the ranking should match "the starting point set by
 * the app"; the app sets three — Standing, Anywhere and My weak spots — and this file covers all three.
 *
 * RNG. The ranking reads no draw, but the app boots a roll under the pane. Every gameplay tag is rigged
 * before the bundle loads (`__NEURAL_RIG`), and the journey counts every draw that finds its queue empty
 * and requires none (§6.3).
 *
 * WHAT THE HARNESS DOES NOT SERVE: dossier chunks (`{}`), so the inline deck under the first row shows
 * cards but no film. Nothing here reads either.
 *
 * MUTANTS (patched into the built neural.js, one at a time, each run against both journeys):
 *   M0  control: `_flowStartSpec` parenthesised, same behaviour                  → green (the patching is sound)
 *   M1  FLOW's frame pinned to "nogi" (the pre-v1.209.0 gi player)               → 1 red at 1b
 *   M2  FLOW's frame pinned to "gi" (a no-gi player on gi numbers)                → 1 red at 1c
 *   M3  the memo key loses the frame AND the ruleset flip stops releasing FLOW    → 1 red at 1c
 *   M4  the plan's fallback reads the pre-FLOW rule (`_weakSpotsLegacy`)          → 1 red at 1b, 2 red at 2a
 *   M6  `_flowStartSpec` returns null (the pre-v1.209.0 Standing player)         → 2 red at 2a
 *   M7  the memo key loses the start                                              → 2 red at 2a
 *   M8  "My weak spots" ranks from Standing                                       → 2 red at 2d
 *   M9  Standing ranks from Closed Guard instead                                  → 2 red at 2a
 *   S1  this spec leaves the daily goal at 30, so the plan holds 3 rows           → 1 and 2 red at the row floor
 * NON-KILLS, recorded so nobody reads this file as covering them:
 *   M3a the memo key alone loses the frame — survives: the ruleset flip releases FLOW's cache anyway.
 *   M3b the flip alone stops releasing FLOW — survives: the memo key carries the frame anyway.
 *       Each is a redundant guard for the other; only both together (M3) break the plan.
 *   M5  `weakSpots()` stops dropping decks the ruleset rules out — survives: a no-gi kernel never prices
 *       a gi-only deck, so 1a is held by FLOW's state space first, and this filter is the second layer.
 * And the measurement behind "WHY CLAIM 1 BOOTS TWICE": with only the gi-vs-no-gi comparison, M1 and M2
 * both stayed green.
 */

const ROWS_FLOOR = 15;
const SHARED_FLOOR = 10;
const DAILY_GOAL = 200;

// every gameplay tag the app draws (scripts/check_no_raw_random.sh's 13, plus the landing card's own
// MC pair), each with a queue far longer than one boot roll can spend
const RIG: Record<string, number[]> = Object.fromEntries(
  Object.entries({
    "start-pos": 0, role: 0, outcome: 0.5, resolve: 0.5, "max-moves": 0.5, "ai-skill": 0.5,
    "opp-pick": 0.5, "opp-sub-pick": 0.5, "opp-finish": 0.99, "mc-pick": 0.5, "mc-shuffle": 0.5,
    escape: 0.5, "checkpoint-pick": 0.5, "land-mc-pick": 0.5, "land-mc-shuffle": 0.5,
  }).map(([t, v]) => [t, new Array(400).fill(v)]),
);

type Plan = { keys: string[]; names: string[]; note: string };

/**
 * A new player, booted fresh, every draw rigged. `withoutGiHands` serves the wire with every node's
 * `cal.evGi` removed and COUNTS what it removed, so a pattern that stopped matching the request cannot
 * pass as a control (§6.4).
 */
async function bootPlayer(page: Page, opts: { withoutGiHands?: boolean } = {}) {
  if (!(page as any).__weakRig) { (page as any).__weakRig = true; await page.addInitScript((rig) => { (window as any).__NEURAL_RIG = rig; }, RIG); }
  const stripped = { wires: 0, blocks: 0 };
  const j = journey(page);
  await j.boot("/", !opts.withoutGiHands ? {} : {
    beforeNavigate: (p: Page) => p.route("**/graph-data.json*", async (route) => {
      const res = await route.fetch(), wire = await res.json();
      for (const n of wire.nodes || []) if (n.cal && n.cal.evGi) { delete n.cal.evGi; stripped.blocks++; }
      stripped.wires++;
      await route.fulfill({ response: res, json: wire });
    }),
  });
  await page.evaluate(() => {
    const a = (window as any).__neural, draw = a.rng.bind(a), unrigged: string[] = [];
    (window as any).__weakUnrigged = unrigged;
    a.rng = (tag: string) => { const q = a._rig && a._rig[tag]; if (!q || !q.length) unrigged.push(tag); return draw(tag); };
  });
  return { j, stripped };
}

/** Settings, by mouse: the account chip → Settings → a tab; act; Esc closes the modal (and only it). */
async function inSettings(j: any, page: Page, tab: string | null, act: () => Promise<void>) {
  await j.clickByMouse(".ngAcctChip", "the account chip");
  await j.clickByMouse("[data-menu-settings]", "Settings in the account menu");
  if (tab) await j.clickByMouse(`[data-settings-tab="${tab}"]`, `the ${tab} tab`);
  await act();
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => (window as any).__neural.modalRef.current.style.display),
    { message: "Esc closed the settings modal" }).toBe("none");
}

async function setDailyGoal(j: any, page: Page, n: number) {
  await inSettings(j, page, null, async () => {
    const input = page.locator('#ng-stab-panel input[type="number"]');
    await expect(input, "one number field in Settings → Flashcards: the daily goal").toHaveCount(1);
    await input.fill(String(n));
    await input.press("Tab"); // commit: the field writes on change
  });
  expect(await page.evaluate(() => (window as any).__neural.get("dailyGoal", 30))).toBe(n);
}

async function setUniform(j: any, page: Page, label: "Gi" | "No-gi") {
  await inSettings(j, page, "rolling", async () => {
    const nth = label === "Gi" ? 1 : 2, sel = `[data-settings-gi] > :nth-child(${nth})`;
    await expect(page.locator(sel), `the uniform row's ${label} button`).toHaveText(label);
    await j.clickByMouse(sel, `the ${label} button`);
  });
  expect(await page.evaluate(() => (window as any).__neural._giMode)).toBe(label === "Gi" ? "gi" : "nogi");
}

async function setStart(j: any, page: Page, v: "standing" | "random" | "weak") {
  await inSettings(j, page, "rolling", () => j.clickByMouse(`[data-start-pick="${v}"]`, `the ${v} start`));
  expect(await page.evaluate(() => (window as any).__neural.startFrom())).toBe(v);
}

/**
 * The rendered plan: its "Learn next" rows, read once the section's own count ("across N techniques")
 * matches the rows on screen. A fresh player owes no reviews, so no Maintenance section precedes them.
 */
async function readPlan(page: Page): Promise<Plan> {
  let plan: Plan & { sections: number; maint: number; across: number } = { keys: [], names: [], note: "", sections: 0, maint: 0, across: -1 };
  await expect.poll(async () => {
    plan = await page.evaluate(() => {
      const sec = document.querySelectorAll('[data-session-section="Learn next"]');
      const note = sec.length === 1 ? (sec[0] as HTMLElement).innerText.replace(/\s+/g, " ") : "";
      const m = note.match(/across (\d+) techniques?/);
      const rows = [...document.querySelectorAll("[data-session] [data-session-row]")] as HTMLElement[];
      return { keys: rows.map((r) => r.getAttribute("data-session-row") as string), names: rows.map((r) => r.innerText.split("\n")[0]),
        note, sections: sec.length, maint: document.querySelectorAll('[data-session-section="Maintenance"]').length, across: m ? +m[1] : -1 };
    });
    return plan.sections === 1 && plan.across === plan.keys.length && plan.keys.length > 0;
  }, { timeout: 30_000, message: "the plan mounts with its Learn next rows" }).toBe(true);
  expect(plan.maint, "a fresh player owes no reviews").toBe(0);
  expect(plan.note, "the rows are the weak-spots ranking, and the plan says so").toContain("weakest first");
  return { keys: plan.keys, names: plan.names, note: plan.note };
}

/** ‹ Back out of an open plan (or the logo, if the pane is shut), Explore, then "N new". */
async function openPlan(j: any, page: Page) {
  const at = await page.evaluate(() => {
    const back = document.querySelectorAll("[data-pane-back]");
    const r = back.length === 1 ? back[0].getBoundingClientRect() : null;
    return { open: !!(window as any).__neural.deckOpen, backs: back.length, back: !!r && r.width > 0 && r.height > 0 };
  });
  if (!at.open) await j.clickByMouse(".ng-logo", "the logo opens the pane");
  else if (at.back) await j.clickByMouse("[data-pane-back]", "‹ Back leaves the open plan");
  await j.clickByMouse("[data-view='explore']", "the Explore tab");
  await j.clickByMouse('[data-explore-stats] [data-b="new"]', 'the "N new" cell');
  return readPlan(page);
}

/**
 * The open plan's own "Refresh plan" — the player's way to re-plan without leaving it. It lives in the
 * pane's scroller, which the plan scrolls on its own when it opens the first row's card (on a later frame
 * than the rows mount), so the button can sit ~1,800px below the fold for a moment: measured once in 15
 * runs, `clickByMouse` refused a centre at y=2006 of 900. The player scrolls to it and clicks it once it is
 * still; so does this, and the click itself is still a measured mouse click.
 */
async function refreshPlan(j: any, page: Page) {
  const sel = "[data-gameplan-refresh]", button = page.locator(sel);
  await expect(button, "one Refresh plan button").toHaveCount(1);
  const height = page.viewportSize()?.height ?? 900;
  await expect.poll(async () => {
    await button.scrollIntoViewIfNeeded();
    const top = () => button.evaluate((el) => Math.round(el.getBoundingClientRect().top));
    const a = await top();
    await page.waitForTimeout(200);
    const b = await top();
    return a === b && b >= 0 && b < height;
  }, { timeout: 10_000, message: "Refresh plan comes to rest on screen" }).toBe(true);
  await j.clickByMouse(sel, "Refresh plan");
  return readPlan(page);
}

const shared = (a: string[], b: string[]) => a.filter((k) => b.includes(k));
/** Pairs of shared spots that the two lists put in opposite orders (0 = the same order). */
function discordant(a: string[], b: string[]) {
  const s = shared(a, b), ib = new Map(b.map((k, i) => [k, i]));
  let n = 0;
  for (let x = 0; x < s.length; x++) for (let y = x + 1; y < s.length; y++) if (ib.get(s[x])! > ib.get(s[y])!) n++;
  return n;
}
const family = (key: string) => key.split("|")[0];

/** The loud beats this boot emitted (the frame fallback is the control's own, see claim 1e), and the rig. */
async function beatsAndRig(j: any, page: Page, frameFallback: boolean) {
  const beats = (await j.beats()).map((b: any) => b.beat);
  for (const loud of ["flow_start_fallback", "flow_cold", "start_from_fallback"])
    expect(beats, `the app never announced ${loud}`).not.toContain(loud);
  if (frameFallback) expect(beats, "the control announced its no-gi hands").toContain("flow_frame_fallback");
  else expect(beats, "the app never announced flow_frame_fallback").not.toContain("flow_frame_fallback");
  expect(await page.evaluate(() => (window as any).__weakUnrigged), "every draw in the journey was rigged").toEqual([]);
}

const diff = (a: string[], b: string[]) =>
  `${shared(a, b).length} shared, ${discordant(a, b)} pairs of them re-ordered; only in the first: ${a.filter((k) => !b.includes(k)).join(", ") || "none"}; only in the second: ${b.filter((k) => !a.includes(k)).join(", ") || "none"}`;

test("a gi player's weak spots come from gi numbers, and differ from no-gi where they must", async ({ page }) => {
  // the full wire
  const { j } = await bootPlayer(page);
  await setDailyGoal(j, page, DAILY_GOAL);
  const gi = await openPlan(j, page);
  await setUniform(j, page, "No-gi");
  const nogi = await openPlan(j, page);
  await setUniform(j, page, "Gi");
  const giAgain = await openPlan(j, page);
  // the wire's own no-gi verdict for every no-gi row, read before the next boot replaces the page
  const verdicts: Array<{ key: string; nogi: unknown }> = await page.evaluate((keys) => keys.map((key: string) => {
    const a = (window as any).__neural, n = a.nodes[a.nodeForKey(key)];
    return { key, nogi: n && n.cal && n.cal.avail ? n.cal.avail.nogi : undefined };
  }), nogi.keys);
  await beatsAndRig(j, page, false);

  // the same new player on a wire without the gi hands
  const b = await bootPlayer(page, { withoutGiHands: true });
  await setDailyGoal(b.j, page, DAILY_GOAL);
  const giStale = await openPlan(b.j, page);
  await setUniform(b.j, page, "No-gi");
  const nogiStale = await openPlan(b.j, page);
  expect(b.stripped.wires, "the control's wire was served through the strip").toBeGreaterThanOrEqual(1);
  expect(b.stripped.blocks, "and lost gi hands").toBeGreaterThan(0);

  for (const [name, p] of [["gi", gi], ["no-gi", nogi], ["gi again", giAgain], ["gi on no-gi hands", giStale], ["no-gi, control wire", nogiStale]] as const)
    expect(p.keys.length, `the ${name} plan shows at least ${ROWS_FLOOR} weak spots`).toBeGreaterThanOrEqual(ROWS_FLOOR);
  test.info().annotations.push(
    { type: "gi vs no-gi", description: diff(gi.keys, nogi.keys) },
    { type: "gi, on gi hands vs on no-gi hands (before v1.209.0)", description: diff(gi.keys, giStale.keys) + ` (${b.stripped.blocks} gi hand blocks removed)` },
  );

  // 1a
  expect(verdicts.filter((v) => typeof v.nogi === "boolean").length, "every no-gi row carries the wire's verdict").toBe(nogi.keys.length);
  expect(verdicts.filter((v) => v.nogi === false).map((v) => v.key), "the no-gi plan shows nothing no-gi rules out").toEqual([]);
  // 1b
  expect(shared(gi.keys, giStale.keys).length, `the two gi plans share at least ${SHARED_FLOOR} spots`).toBeGreaterThanOrEqual(SHARED_FLOOR);
  expect(gi.keys, "gi numbers move the gi plan").not.toEqual(giStale.keys);
  // 1c
  expect(nogiStale.keys, "and never the no-gi plan").toEqual(nogi.keys);
  // 1d
  expect(giAgain.keys, "switching back to gi gives back the gi plan").toEqual(gi.keys);
  // 1e — last, so a mutant that breaks 1b-1d is caught there rather than by its side effect on the control
  await beatsAndRig(b.j, page, true);
});

test("the weak-spots ranking follows the start setting, and changes when it changes", async ({ page }) => {
  const { j } = await bootPlayer(page);
  await setDailyGoal(j, page, DAILY_GOAL);
  expect(await page.evaluate(() => (window as any).__neural.startFrom()), "a new player starts Anywhere").toBe("random");
  const anywhere = await openPlan(j, page);
  await setStart(j, page, "standing");
  const standing = await refreshPlan(j, page);
  await setStart(j, page, "weak");
  const weak = await refreshPlan(j, page);
  await setStart(j, page, "random");
  const anywhereAgain = await openPlan(j, page);

  for (const [name, p] of [["Anywhere", anywhere], ["Standing", standing], ["My weak spots", weak], ["Anywhere again", anywhereAgain]] as const)
    expect(p.keys.length, `the ${name} plan shows at least ${ROWS_FLOOR} weak spots`).toBeGreaterThanOrEqual(ROWS_FLOOR);
  test.info().annotations.push({ type: "Anywhere vs Standing", description: diff(anywhere.keys, standing.keys) });

  // 2a — where it must: every Standing roll opens on Standing Position
  const rank = (p: Plan) => { const i = p.keys.findIndex((k) => family(k) === "Standing Position"); return i < 0 ? p.keys.length : i; };
  expect(rank(standing), "Standing Position is in the Standing plan").toBeLessThan(standing.keys.length);
  expect(rank(standing), "and ranks higher there than in the Anywhere plan").toBeLessThan(rank(anywhere));
  // 2b
  expect(standing.keys, "Standing ranks the weak spots differently from Anywhere").not.toEqual(anywhere.keys);
  // 2c, 2d
  expect(anywhereAgain.keys, "back to Anywhere gives back the Anywhere plan").toEqual(anywhere.keys);
  expect(weak.keys, "My weak spots ranks as Anywhere (the shipped reading, see the header)").toEqual(anywhere.keys);
  // 2e
  await beatsAndRig(j, page, false);
});
