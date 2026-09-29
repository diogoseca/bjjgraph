import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * ── THE SEAT IS THE PLAYER'S TO CHOOSE WHEN THEY ROLL FROM A ROW ────────────────────────────────
 *
 * Owner, 2026-09-23: "when we click to play / roll from a technique we found in the side bar it says
 * we start on top, but what if i wanted to start on bottom?"
 *
 * `confirmPlayFrom` — the "Start a fresh roll" sheet every ▶ opens (an Explore or list row, the
 * option sheet's "Play from here", a Last-rolls row) — used to DECIDE the seat: the technique's
 * authored performer side, flipped by the global `_perspective`, printed inside the title
 * ("Roll from Half Guard, attacking?") with no per-roll way to take the other side. It now offers
 * both seats, the derived one preselected:
 *
 *   · a TECHNIQUE offers Attacker / Defender — Defender is the other side of the SAME origin
 *     position, and the sheet says so;
 *   · a POSITION offers Top / Bottom;
 *   · the title names the place and only the place ("Roll from Half Guard?") — the seat sits
 *     BESIDE the name, never inside it (CLAUDE.md §5 `graphName`);
 *   · Start passes an EXPLICIT role and seats you on the orb that plays it (`_seatMember`).
 *
 * FIXTURES, measured on the wire (not guessed): `Knee Slice Pass` is TOP-authored and `Deep Half
 * Entry` BOTTOM-authored, both from Half Guard. The pairing is deliberate — the non-default seat of
 * the first is BOTTOM and the default seat of the second is BOTTOM, so the historical failure (a
 * role that silently falls through to the title-derived constant `top`: every position title ends
 * "… Top") turns BOTH of the first two journeys red rather than neither.
 *
 * EVERY GAMEPLAY rng TAG ON THE PATH IS RIGGED (`rigQuiet`) — the roll's own draws (`max-moves`,
 * `ai-skill`, `role`) and everything that could end or move the exchange before the assertions
 * read it (`opp-*`, `outcome`, `resolve`, `escape`, the MC draws). CLAUDE.md §6.3.
 *
 * Every new control is driven by `j.clickByMouse`, never `locator.click()` (§6.1 / §6.3).
 *
 * RED FIRST: against the pre-change bundle all six went red — five on the seat claims, and "⏎ stays
 * inside" on the defect it pins: ⏎ with this sheet open over the option sheet COMMITTED that sheet's
 * move underneath (`commit` 0 -> 1).
 *
 * MUTANTS (v1.197.0 red-proof pass — each applied ALONE to app.src.jsx, bundle rebuilt, this file
 * run whole; "n red" = journeys that failed):
 *   M1  Start ignores the choice, plays the derived seat ...... 3 red (other seat, position, Last rolls)
 *   M2  preselection ignores the Defend perspective ........... 1 red (default path)
 *   M3  technique preselection = the title's constant "top" ... 1 red (default path)
 *   M4  role dropped AND the old unmapped seed ................ 4 red (the historical fall-through)
 *   M5  no `_seatMember` — the top orb plays bottom ........... 4 red
 *   M6  the seat back inside the title ........................ 4 red
 *   M7  Esc rung removed from the key ladder .................. 1 red (Esc)
 *   M8  Esc closes the sheet but falls through the ladder ..... 1 red (Esc: the pane closed too)
 *   M9  the sheet's keydown containment removed ............... 1 red (⏎ stays inside)
 *   M10 arrow keys removed .................................... 1 red (Esc/arrows)
 *   M11 focus-on-open removed ................................. 2 red (Esc/arrows, ⏎ stays inside)
 *   M12 seat buttons `pointer-events:none` inline ............. 3 red (every clickByMouse on a seat)
 *   M13 hosted inside the wrap, not the app root .............. 4 red
 *   M14 z-index 40, below the modal band ...................... 6 red — NB `readSheet` LOCATES the sheet
 *       by `z-index: 95`, so most of these are the locator missing it; the band assertion itself is
 *       the explicit `z >= 90` in the first journey.
 *   M15 the body's side word frozen at the first seat ......... 3 red
 *   M16 the old close (opacity 0 + remove after 160ms) ........ 2 red (a reopen/ Esc finds the dead one)
 *   M18 focus not returned to the ▶ on close .................. 1 red (Esc)
 *
 * NON-KILLS, recorded so nobody reads this spec as covering them:
 *   M4b the role dropped ALONE survives — EQUIVALENT on the paired graph: `_seatMember` still seats
 *       you on the member that plays the side, and `rollFromPosition` reads a member's own `role`
 *       when handed none. It would bite only on the pre-split graph (`j.boot("/", { noPairs: true })`),
 *       which exists for `dual-consumers.spec.ts` alone and is deliberately not borrowed here.
 *   M17 dropping replace-on-reopen (two sheets stacked) survives — no UI path can open a second sheet
 *       while one is up (its z:95 scrim covers every ▶), so it is defensive, and unpinned.
 *   The phone layout is eyeballed (390px: the seat row fits, no horizontal scroll), not asserted.
 */

const ORIGIN = "Half Guard";
const TOP_TECH = { name: "Knee Slice Pass", id: "Transitions/Knee-Slice-Pass" }; // fromRole top
const BOTTOM_TECH = { name: "Deep Half Entry", id: "Transitions/Deep-Half-Entry" }; // fromRole bottom

/** Every gameplay tag the path can draw, rigged to the branch that keeps the board still. */
async function rigQuiet(j: any) {
  const many = (v: number, n = 8) => Array(n).fill(v);
  await j.rig("max-moves", many(0.5, 4));
  await j.rig("ai-skill", many(0.5, 4));
  await j.rig("role", many(0, 4));
  await j.rig("start-pos", many(0, 4));
  await j.rig("opp-finish", many(0.999)); // the opponent never finishes — nothing ends the roll early
  await j.rig("opp-pick", many(0));
  await j.rig("opp-sub-pick", many(0));
  await j.rig("outcome", many(0.01));
  await j.rig("resolve", many(0.01));
  await j.rig("escape", many(0.99));
  await j.rig("checkpoint-pick", many(0));
  for (const t of ["mc-pick", "mc-shuffle", "land-mc-pick", "land-mc-shuffle"]) await j.rig(t, many(0));
}

/** Land a real roll (so there IS one to discard), then open Explore and search for `q`. */
async function exploreFor(j: any, page: Page, q: string) {
  await j.boot("/");
  await j.land("Mount Top");
  await rigQuiet(j);
  await page.evaluate(() => (window as any).__neural.openPane("explore"));
  await j.advance(300);
  // typed into the real input, like a user — the search renders its own ▶ rows
  await page.evaluate(() => (window as any).__neural.explorerSearchRef.current.focus());
  await page.keyboard.type(q);
  await page.waitForTimeout(400);
}

/** The sheet as a reader sees it. Located from its Start button, so it reads the pre-change
 *  sheet too (the RED-first run) rather than failing on a missing marker. */
function readSheet(page: Page) {
  return page.evaluate(() => {
    const a: any = (window as any).__neural;
    // the FIRST `.ng-cf-yes`, deliberately: a closed sheet must be GONE, not lingering inert in
    // front of a reopened one (the pre-change sheet did, for 160ms — the reopen below caught it)
    const yes = document.querySelector(".ng-cf-yes") as HTMLElement | null;
    const ov = yes && (yes.closest('div[style*="z-index: 95"]') as HTMLElement | null);
    if (!ov) return null;
    const card = ov.firstElementChild as HTMLElement;
    const title = [...card.children].find((d) => /^Roll from/.test((d as HTMLElement).innerText || "")) as HTMLElement | undefined;
    const radios = [...ov.querySelectorAll('[role="radio"]')] as HTMLElement[];
    const hint = ov.querySelector("[data-seat-hint]") as HTMLElement | null;
    return {
      title: title ? title.innerText.trim() : null,
      seats: radios.map((r) => r.innerText.trim()),
      checked: radios.filter((r) => r.getAttribute("aria-checked") === "true").map((r) => r.innerText.trim()),
      side: (ov.querySelector("[data-seat-side]") || { textContent: null }).textContent,
      hint: hint ? hint.innerText.trim() : null,
      body: card.innerText,
      focused: (document.activeElement as HTMLElement | null)?.getAttribute("data-seat") || null,
      // the Z LADDER contract: a deliberate screen, portalled to the app root, at the modal band
      z: Number(getComputedStyle(ov).zIndex),
      onRoot: ov.parentElement === a.__ngRoot,
      inWrap: !!(a.wrapRef.current && a.wrapRef.current.contains(ov)),
    };
  });
}

/** Gone means REMOVED — checked at once, not polled: a closing sheet has no exit animation, and
 *  a node that lingers for one is an invisible scrim over everything behind it (§6.1). */
const sheetGone = async (page: Page) =>
  expect(await page.locator(".ng-cf-yes").count(), "the sheet is gone from the DOM, not merely transparent").toBe(0);

/** Press Start by mouse and pump until the new roll's hand is dealt. */
async function startAndDeal(j: any, page: Page, sel = ".ng-cf-yes") {
  const dealt0 = await page.evaluate(() => ((window as any).__neural.beats || []).filter((b: any) => b.beat === "options_dealt").length);
  await j.clickByMouse(sel, "the sheet's Start button");
  for (let i = 0; i < 16; i++) {
    await j.advance(500);
    const ok = await page.evaluate((d0: number) => {
      const a: any = (window as any).__neural;
      return a.beats.filter((b: any) => b.beat === "options_dealt").length > d0 && (a.optionIdxs || []).length > 0;
    }, dealt0);
    if (ok) break;
  }
}

/** Where the roll actually is, read from the app — not recomputed. */
function seated(page: Page) {
  return page.evaluate(() => {
    const a: any = (window as any).__neural;
    const cur = a.nodes[a.currentPos];
    const hand = (a._optList || a.optionIdxs || []).map((o: any) => {
      const n = a.nodes[typeof o === "number" ? o : o.idx];
      return { t: n.t, fromRole: n.fromRole, relaxed: !!(o && o.relaxed) };
    });
    return {
      role: a.playerRole,
      member: cur && cur.role,
      posId: cur && cur.posId,
      url: decodeURI(location.pathname),
      hand,
      logRole: a.rollLog && a.rollLog[0] ? String(a.rollLog[0].role).toLowerCase() : null,
    };
  });
}

test("@curated ▶ on a technique: take the OTHER seat — you defend it, on the other side of the same position", async ({ page }) => {
  const j = journey(page);
  await exploreFor(j, page, TOP_TECH.name);
  await j.clickByMouse(`[data-play-from="${TOP_TECH.id}"]`, "the Explore row's ▶");

  const s0 = await readSheet(page);
  expect(s0, "the confirm sheet opened").not.toBeNull();
  expect(s0!.title, "the title names the place, and ONLY the place — the seat is beside it, never inside it").toBe(`Roll from ${ORIGIN}?`);
  expect(s0!.seats, "a technique offers both seats, by what you will BE").toEqual(["Attacker", "Defender"]);
  expect(s0!.checked, "the derived seat — the technique's own performer side — is preselected").toEqual(["Attacker"]);
  expect(s0!.side, "…which is the top: Knee Slice Pass is top-authored").toBe("top");
  expect(s0!.hint).toBe(`You play ${TOP_TECH.name}.`);
  expect(s0!.z, "a deliberate screen sits at the modal band (90-99)").toBeGreaterThanOrEqual(90);
  expect(s0!.onRoot && !s0!.inWrap, "…portalled to the app root, out of the wrap's stacking context").toBe(true);

  await j.clickByMouse('[data-seat="defender"]', "the Defender seat");
  const s1 = await readSheet(page);
  expect(s1!.checked, "the click moved the choice").toEqual(["Defender"]);
  expect(s1!.side, "…to the other side").toBe("bottom");
  expect(s1!.hint, "and the sheet says what the other seat MEANS").toBe(
    `You defend against ${TOP_TECH.name} — the other side of the same position.`,
  );
  expect(s1!.title, "choosing a seat never rewrites the name").toBe(`Roll from ${ORIGIN}?`);

  await startAndDeal(j, page);
  await sheetGone(page);
  const st = await seated(page);
  expect(st.role, "the roll starts in the seat that was CHOSEN").toBe("bottom");
  expect(st.posId, "…at the technique's own origin").toBe("half-guard");
  expect(st.member, "…on the orb that plays that side, so the focus is the orb you are playing").toBe("bottom");
  expect(st.url, "…and the address names it, so a reload re-seats you there").toBe("/Positions/Half-Guard/Bottom");
  expect(st.logRole, "the roll log records the side actually played (Last rolls replays it)").toBe("bottom");
  expect(st.hand.length, "a hand is dealt").toBeGreaterThan(0);
  const strict = st.hand.filter((c) => !c.relaxed);
  expect(strict.length, "premise: the hand is the role's own, not the origin-relaxed fallback").toBeGreaterThan(0);
  expect(strict.every((c) => c.fromRole === "bottom"), "every card is a BOTTOM move — the defender's hand").toBe(true);
  expect(
    st.hand.some((c) => c.t === TOP_TECH.name),
    "the technique is the OPPONENT's move now — it is not in your hand",
  ).toBe(false);
});

test("@curated the default path is unchanged — Start without touching the seat plays the technique's own side", async ({ page }) => {
  const j = journey(page);
  await exploreFor(j, page, BOTTOM_TECH.name);

  // THE GLOBAL PERSPECTIVE STILL STEERS THE DEFAULT. `_perspective` is the option sheet's own
  // Attacker/Defend toggle; a player who left it on Defend gets Defender preselected, as before —
  // now visibly, and one click from the other seat. Set directly: the toggle lives in a different
  // sheet, and this test is about what THIS sheet derives from it.
  await page.evaluate(() => ((window as any).__neural._perspective = "defender"));
  await j.clickByMouse(`[data-play-from="${BOTTOM_TECH.id}"]`, "the Explore row's ▶");
  const sd = await readSheet(page);
  expect(sd!.checked, "the Defend perspective preselects Defender").toEqual(["Defender"]);
  expect(sd!.side).toBe("top");
  await j.clickByMouse(".ng-cf-no", "Cancel");
  await sheetGone(page);

  await page.evaluate(() => ((window as any).__neural._perspective = "attacker"));
  await j.clickByMouse(`[data-play-from="${BOTTOM_TECH.id}"]`, "the Explore row's ▶");
  const s0 = await readSheet(page);
  expect(s0!.seats).toEqual(["Attacker", "Defender"]);
  expect(s0!.checked, "the performer side is preselected").toEqual(["Attacker"]);
  expect(s0!.side, "Deep Half Entry is BOTTOM-authored — the preselection is not the title's constant 'top'").toBe("bottom");
  expect(s0!.title).toBe(`Roll from ${ORIGIN}?`);

  await startAndDeal(j, page);
  const st = await seated(page);
  expect(st.role, "Start with the preselection plays the technique's own side, as it always did").toBe("bottom");
  expect(st.member).toBe("bottom");
  expect(st.posId).toBe("half-guard");
  expect(st.hand.some((c) => c.t === BOTTOM_TECH.name), "…and the technique you pressed ▶ on is in your hand").toBe(true);
});

test("a position row offers Top / Bottom, and Bottom seats you on the bottom orb", async ({ page }) => {
  const j = journey(page);
  await exploreFor(j, page, ORIGIN);
  // "Half Guard" matches dozens of "… from Half Guard" rows; the position's own row can sit under
  // the pane's bottom save stack, so bring it to the middle the way a user scrolls to it —
  // clickByMouse itself never scrolls.
  await page.evaluate(() => document.querySelector('[data-play-from="Positions/Half-Guard"]')!.scrollIntoView({ block: "center" }));
  await j.clickByMouse('[data-play-from="Positions/Half-Guard"]', "the position row's ▶");

  const s0 = await readSheet(page);
  expect(s0!.title).toBe(`Roll from ${ORIGIN}?`);
  expect(s0!.seats, "a position's seats are its sides").toEqual(["Top", "Bottom"]);
  expect(s0!.checked, "the row is the site's rep member, whose own side is top").toEqual(["Top"]);
  expect(s0!.hint, "no technique, so no Attacker/Defender gloss").toBeNull();

  await j.clickByMouse('[data-seat="bottom"]', "the Bottom seat");
  expect((await readSheet(page))!.side).toBe("bottom");
  await startAndDeal(j, page);
  const st = await seated(page);
  expect(st.role).toBe("bottom");
  expect(st.member, "seated on the BOTTOM orb, not the top orb playing bottom").toBe("bottom");
  expect(st.url).toBe("/Positions/Half-Guard/Bottom");
  const strict = st.hand.filter((c) => !c.relaxed);
  expect(strict.length).toBeGreaterThan(0);
  expect(strict.every((c) => c.fromRole === "bottom"), "the bottom hand").toBe(true);
});

test("@curated Esc closes the sheet — only the sheet — and the arrows move the seat", async ({ page }) => {
  const j = journey(page);
  await exploreFor(j, page, TOP_TECH.name);
  const before = await page.evaluate(() => {
    const a: any = (window as any).__neural;
    return { pos: a.currentPos, role: a.playerRole, log: (a.rollLog || []).length, pane: !!a.deckShown };
  });
  expect(before.pane, "premise: the pane is open under the sheet").toBe(true);
  await j.clickByMouse(`[data-play-from="${TOP_TECH.id}"]`, "the Explore row's ▶");

  const s0 = await readSheet(page);
  expect(s0!.focused, "focus lands ON the decision, at the chosen seat").toBe("attacker");
  await page.keyboard.press("ArrowRight");
  expect((await readSheet(page))!.checked, "an arrow moves the choice (a radio group)").toEqual(["Defender"]);
  expect((await readSheet(page))!.focused).toBe("defender");

  await page.keyboard.press("Escape");
  await sheetGone(page);
  const after = await page.evaluate(() => {
    const a: any = (window as any).__neural;
    return { pos: a.currentPos, role: a.playerRole, log: (a.rollLog || []).length, pane: !!a.deckShown };
  });
  expect(after, "Esc started nothing, and did NOT also close the pane in the same press").toEqual(before);
  expect(
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute("data-play-from") || null),
    "focus went back to the ▶ that opened the sheet, not to <body>",
  ).toBe(TOP_TECH.id);
});

test("⏎ inside the sheet stays inside it — it never executes the option sheet open underneath", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await rigQuiet(j);
  // the option sheet's own "Play from here" opens this confirm OVER it (setup click: the card's
  // reachability is not this test's subject)
  await page.locator("[data-tech]").first().locator("[data-choice-inspect]").click();
  await expect(page.locator(".ng-playfrom")).toBeVisible();
  // the sheet slides up on a wall-clock transition: measure only once the button has STOPPED, or
  // the mouse lands where it was a frame ago (measured: 2 premise misses in 4 runs without this, 0 in 6 with it)
  await expect
    .poll(async () => {
      const a = await page.locator(".ng-playfrom").boundingBox();
      await page.waitForTimeout(120);
      const b = await page.locator(".ng-playfrom").boundingBox();
      return !!a && !!b && a.x === b.x && a.y === b.y;
    }, { message: "the option sheet settles" })
    .toBe(true);
  await j.clickByMouse(".ng-playfrom", "the option sheet's Play from here");
  expect(await readSheet(page), "premise: the confirm is up").not.toBeNull();
  const commits0 = await page.evaluate(() => ((window as any).__neural.beats || []).filter((b: any) => b.beat === "commit").length);
  const log0 = await page.evaluate(() => ((window as any).__neural.rollLog || []).length);

  await page.keyboard.press("Enter");
  await j.advance(600);
  expect(
    await page.evaluate(() => ((window as any).__neural.beats || []).filter((b: any) => b.beat === "commit").length),
    "⏎ did not commit the move behind the sheet",
  ).toBe(commits0);
  expect(await page.evaluate(() => ((window as any).__neural.rollLog || []).length)).toBe(log0);
  expect(await readSheet(page), "the sheet is still up, waiting for its own answer").not.toBeNull();
});

test("Last rolls ▶ preselects the side you played, and the other seat is one click away", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await rigQuiet(j);
  // one real exchange, so the roll counts as played AND acted and is archived (`_closeRoll`)
  const titles = await j.optionTitles();
  expect(titles.length, "premise: a hand was dealt").toBeGreaterThan(0);
  await j.pick(titles[0]);
  await j.nextHand();
  await page.evaluate(() => {
    const a: any = (window as any).__neural;
    a.rollFromPosition(a.currentPos, true); // test rail: archives the played roll, stages a held board
  });
  await j.advance(1500);
  const past = await page.evaluate(() => {
    const r = ((window as any).__neural._pastRolls || [])[0];
    return r ? { ts: r.ts, role: String(r.log[0].role).toLowerCase(), posId: (window as any).__neural.nodes[r.log[0].idx].posId } : null;
  });
  expect(past, "premise: one roll is archived").not.toBeNull();
  expect(past!.role, "premise: Mount was played from the top (land() rigs role 0)").toBe("top");
  await page.evaluate(() => (window as any).__neural.openPane("history"));
  await j.advance(300);

  await j.clickByMouse(`[data-roll-from="${past!.ts}"]`, "the past roll's ▶");
  const s0 = await readSheet(page);
  expect(s0!.title).toBe("Roll from Mount?");
  expect(s0!.seats).toEqual(["Top", "Bottom"]);
  expect(s0!.checked, "the side the log recorded is preselected").toEqual(["Top"]);
  await j.clickByMouse('[data-seat="bottom"]', "the Bottom seat");
  await j.clickByMouse(".ng-cf-yes", "Set it up");
  await j.advance(1500); // the staged landing rides an ignorePause timer
  const st = await seated(page);
  expect(st.role, "the board is set on the seat that was CHOSEN").toBe("bottom");
  expect(st.member).toBe("bottom");
  expect(st.posId).toBe(past!.posId);
  expect(await page.evaluate(() => !!(window as any).__neural.paused), "and staged: the clock is held").toBe(true);
});
