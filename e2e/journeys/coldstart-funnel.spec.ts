import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * COLD-START FUNNEL — the measurement gate for journey 3.
 *
 * The premise under test is a business one: a first-time visitor is dropped onto a graph of
 * 1,269 techniques and immediately asked a multiple-choice question about a position they may
 * never have heard of, with a decision clock running. Nobody knows whether that is a hook or a
 * bounce, because until now NOTHING measured it. This spec pins the instrumentation that will
 * answer it (app.src.jsx `_cs*`, riding the fx() beat stream) and, when run locally, dumps the
 * first three states a genuinely fresh visitor sees into tests/artifacts/coldstart/.
 *
 * Genuinely cold: boot() wipes storage, keepTutorial:true leaves the White objectives
 * incomplete, keepCoach leaves the first-run coach up, and the start position is the app's OWN
 * choice (only the ambient RNG is rigged) rather than a rigged test position.
 */

const OUT = resolve(__dirname, "../../tests/artifacts/coldstart"); // JSON dumps: TRACKED evidence
const SHOTS = resolve(__dirname, "../gallery"); // PNGs: gitignored (a 1MB canvas shot per state)

/**
 * The dumps under OUT are TRACKED, CITED evidence — the diagnosis quotes them — so they are a
 * deliberate fixture, refreshed on request and never as a side effect. v1.82.0 wrote them on every
 * non-CI run, which meant simply running the gate locally left `cold-start-beats.json` and
 * `cold-start-observation.json` modified: the tree was dirty after a green test, and no later diff
 * of that evidence could be trusted. Refresh them deliberately:
 *
 *     COLDSTART_CAPTURE=1 npx playwright test -c e2e/playwright.coldstart.config.ts coldstart-funnel
 */
const CAPTURE = !!process.env.COLDSTART_CAPTURE;

// "what does the user actually see" — every visible overlay's text, plus which known surfaces
// are mounted. Written next to a screenshot so a claim about confusion has evidence behind it.
const seen = (page: any, label: string) =>
  page.evaluate((l: string) => {
    const vis = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        r.width > 1 &&
        r.height > 1 &&
        s.visibility !== "hidden" &&
        s.display !== "none" &&
        parseFloat(s.opacity || "1") > 0.05
      );
    };
    const surfaces: Record<string, boolean> = {};
    for (const sel of [
      ".ng-loader",
      "[data-coach]",
      "[data-landcard]",
      "[data-land-id]",
      "[data-land-def]",
      "[data-land-film]",
      "[data-land-q]",
      "[data-land-count]",
      "[data-land-more]",
      ".ng-optionrow",
      ".ng-drilltab",
      ".ng-explorer",
      "[data-knowledge]", // the Explore-mounted knowledge belt (v1.96.0; header gone)
      "[data-tut-copy]",
      ".ng-status",
      ".ng-transport",
      ".ng-account",
      ".ng-momentum",
    ]) {
      const el = document.querySelector(sel);
      surfaces[sel] = !!el && vis(el);
    }
    // visible text, in DOM order, from the overlay layer only (canvas has no text nodes)
    const texts: string[] = [];
    document
      .querySelectorAll(
        ".ng-coach,.ng-landcard,.ng-optionrow,.ng-drilltab,.ng-status,.ng-ev,.ng-evcenter,[data-tut-copy]",
      )
      .forEach((el) => {
        if (!vis(el)) return;
        const t = (el as HTMLElement).innerText.replace(/\s+\n/g, "\n").trim();
        if (t) texts.push(`[${el.className || el.tagName}]\n${t}`);
      });
    const a = (window as any).__neural;
    return {
      label: l,
      ms_since_nav: Math.round(performance.now()),
      sim_t: a ? Math.round((a.now || 0) * 100) / 100 : null,
      position:
        a && a.nodes && a.currentPos != null ? a.nodes[a.currentPos]?.t : null,
      role: a && a.playerRole,
      options: a ? (a.optionIdxs || []).map((i: number) => a.nodes[i].t) : [],
      paused: a && a.paused,
      decision_left:
        a && a.decisionRemaining
          ? Math.round(a.decisionRemaining() * 10) / 10
          : null,
      funnel: a
        ? (a.csBeats || []).filter((b: any) => b.beat === "funnel")
        : [],
      surfaces,
      texts,
    };
  }, label);

test("cold start: the funnel spine emits in order, and the first question is about an unstudied node", async ({
  page,
}) => {
  const j = journey(page);
  const dumps: any[] = [];
  const capture = async (label: string) => {
    const d = await seen(page, label);
    dumps.push(d);
    if (CAPTURE) {
      mkdirSync(OUT, { recursive: true });
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({
        path: resolve(SHOTS, `coldstart-${dumps.length}-${label}.png`),
      });
      // written on EVERY capture, not at the end: a failing assertion mid-journey must still
      // leave the observation behind — that is the whole point of the dump
      writeFileSync(
        resolve(OUT, "cold-start-observation.json"),
        JSON.stringify(dumps, null, 2),
      );
      writeFileSync(
        resolve(OUT, "cold-start-beats.json"),
        JSON.stringify(
          // BOTH streams: gameplay beats, and the funnel marks that now live in their own array
          // (the observer must not be visible in the stream it observes — see _csInit).
          await page.evaluate(() => ({
            beats: ((window as any).__neural.beats || []).slice(),
            funnel: ((window as any).__neural.csBeats || []).slice(),
          })),
          null,
          2,
        ),
      );
    }
    return d;
  };

  // ── a genuinely fresh profile: no progress blob, no coach flag, no completed objectives ──
  await j.boot("/", { keepTutorial: true });
  expect(
    await page.evaluate(() => (window as any).__neural._cs.cold),
    "the app classifies this visitor as cold",
  ).toBe(true);

  // STATE 1 — the app has painted and ingested the graph; the intro camera has not run yet
  const s1 = await capture("app-ready");
  expect(
    s1.funnel.map((f: any) => f.step),
    "app_ready is the first funnel mark",
  ).toEqual(["app_ready"]);

  // the app's own first-roll choice, not a rigged position — only the ambient draws are pinned
  await j.rig("start-pos", [0.42]);
  await j.rig("role", [0]);
  await j.rig("ai-skill", [0.5]);
  await j.rig("max-moves", [0.5]);
  for (let i = 0; i < 12; i++) {
    await j.advance(1000);
    if (
      (await page.evaluate(
        () => ((window as any).__neural.optionIdxs || []).length,
      )) > 0
    )
      break;
  }

  // STATE 2 — the coach is talking; the decision clock is frozen behind it, and the landing card
  // is up alongside. The card fades in over .28s on the WALL clock and the dump's own visibility
  // check reads opacity, so let the entry animation finish before sampling (same reason as STATE 3).
  await page.waitForTimeout(400);
  const s2 = await capture("first-landing-coach");
  expect(
    s2.surfaces["[data-coach]"],
    "the coach greets a first-ever visitor",
  ).toBe(true);
  // v1.82.0 asserted the OPPOSITE here ("the coach owns the first landing — no stacked card"),
  // which pinned the blocker in place: because a cold visitor's first landing is ALWAYS coached,
  // suppressing the card deleted the landing question from the one decision the comprehension
  // mechanic exists for, and the funnel then recorded hand_dealt → move_committed with the two
  // question steps missing. The coach now docks at the top of the viewport and the card keeps its
  // own space below, so the newcomer reads WHERE THEY ARE while the coach explains the controls.
  expect(
    s2.surfaces["[data-landcard]"],
    "the card is up while the coach talks — the clock is frozen behind both",
  ).toBe(true);
  expect(
    await page.evaluate(() => {
      const c = document.querySelector(".ng-coach")!.getBoundingClientRect();
      const l = document.querySelector(".ng-landcard")!.getBoundingClientRect();
      return !(c.bottom <= l.top || l.bottom <= c.top);
    }),
    "and they do not overlap",
  ).toBe(false);

  // STATE 3 — the coach hands over: identity, definition, ONE question, the option hand.
  // NB the harness ABORTS technique-content.js (the 21MB dossier payload), so [data-land-def]
  // and [data-land-film] are absent here BY CONSTRUCTION — that is the harness, not a finding.
  await page.evaluate(() => (window as any).__neural.dismissCoach());
  await expect(page.locator("[data-landcard]")).toBeVisible();
  // the card fades in over the graph (.28s ngCardIn, opacity 0 -> 1 on WALL clock, not sim time),
  // and the dump's own visibility check reads opacity — so let the entry animation finish
  await page.waitForTimeout(400);
  const s3 = await capture("landing-card");
  expect(s3.surfaces["[data-landcard]"]).toBe(true);
  await expect(
    page.locator("[data-land-q]"),
    "exactly one question",
  ).toHaveCount(1);

  // ── the suspected confusion, now measured: the question is about a node with no study history ──
  const beats = await page.evaluate(() =>
    (window as any).__neural.beats.slice(),
  );
  const shown = beats.filter((b: any) => b.beat === "land_q_shown");
  expect(shown.length, "a landing question was asked").toBeGreaterThan(0);
  const unseen = beats.filter((b: any) => b.beat === "land_q_unseen");
  expect(
    unseen.length,
    "and it is about a node the player has never studied",
  ).toBeGreaterThan(0);
  expect(unseen[0].node, "the beat names the node").toBeTruthy();

  // ── answering: click a real MC option on the LANDING surface (its own handle) ──
  const opts = page.locator("[data-land-mc-opt]");
  expect(await opts.count(), "multiple choice, in play").toBeGreaterThan(1);
  await opts.first().click();
  await j.expectBeat("land_q_answered");

  // ── abandonment, measured where a real one happens: answer the question, then leave without
  // ever committing. This used to be asserted at the END of the journey, which made it depend on
  // whether the single committed move happened to FINISH the roll — and a finished roll correctly
  // reports nothing (see _csAbandon). Both halves of that rule are now pinned, here and below. ──
  await page.evaluate(() =>
    (window as any).__neural._csAbandon("test-midfunnel"),
  );
  const midBail = await page.evaluate(() =>
    (window as any).__neural.csBeats
      .filter((b: any) => b.beat === "funnel_abandon")
      .pop(),
  );
  expect(midBail?.furthest_step, "the drop-off point is named").toBe(
    "question_shown",
  );
  expect(midBail?.cold, "and attributed to a cold visitor").toBe(true);

  // ── committing to a move, and the needle resolving it ──
  const target = await page.evaluate(() => {
    const a = (window as any).__neural;
    for (const i of a.optionIdxs || [])
      if (a.nodes[i].ty === "transitions") return a.nodes[i].t;
    return a.nodes[(a.optionIdxs || [])[0]].t;
  });
  // Pin the exchange. `resolve`/`outcome` were left to Math.random, so whether this one move
  // FINISHED the roll was a coin flip — and a finished roll changes two things this journey
  // asserts: `roll_ended` joins the spine (step 5), and `_csAbandon` correctly reports nothing
  // (a visitor who completed the roll did not abandon). Success into the first outcome bucket of a
  // TRANSITION can never end a roll — only submissions reach `game-over` — so this both keeps the
  // journey walking the real cold path and makes its two end assertions deterministic.
  await j.rig("resolve", [0.01]); // < moveChance ⇒ success
  await j.rig("outcome", [0.01]); // first bucket = the success target
  await j.pick(target);
  await j.advanceUntil("sweep_land", 20000);
  await j.advance(2500);

  // ── the pane (manual-only) and a graded card ──
  await page.evaluate(() => (window as any).__neural.setDeckOpen(true));
  await j.drill(1);

  const funnel = await page.evaluate(() =>
    (window as any).__neural.csBeats.filter((b: any) => b.beat === "funnel"),
  );
  // The spine is what every cold visitor must physically walk. `question_answered` is NOT on it:
  // ignoring the question is a legitimate way to play on, so gating the funnel on it reported every
  // such visitor as a drop-off at a step they had sailed past. It is a side mark, next to
  // `question_ignored` — the two together say what happened at the question.
  const spine = funnel.filter((f: any) => f.spine).map((f: any) => f.step);
  // Once each, in order, CONTIGUOUS FROM THE START — the funnel contract, asserted as a prefix of
  // the documented spine rather than a fixed list. `resolve`/`outcome` are deliberately left to the
  // app (this journey walks the real cold path, only the ambient draws are pinned), so whether the
  // exchange happens to finish the roll inside the journey is not fixed — and `roll_ended` is spine
  // step 5. Pinning the exact five made this assertion a coin flip on that; it only ever passed
  // because the state the old uniform draw landed on had no roll-ending outcome within one move.
  const SPINE = [
    "app_ready",
    "hand_dealt",
    "question_shown",
    "move_committed",
    "outcome_seen",
    "roll_ended",
  ];
  expect(
    spine,
    "the spine emits once each, in order, contiguous from app_ready",
  ).toEqual(SPINE.slice(0, spine.length));
  expect(
    spine.length,
    "and the journey physically walked it as far as the outcome",
  ).toBeGreaterThanOrEqual(5);
  expect(
    funnel.filter((f: any) => f.out_of_order).map((f: any) => f.step),
    "and no spine step arrived with an earlier one missing",
  ).toEqual([]);
  const marks = funnel.map((f: any) => f.step);
  expect(marks, "the side marks are measured too").toEqual(
    expect.arrayContaining([
      "coach_seen",
      "question_answered",
      "unseen_question",
      "pane_opened",
      "deck_card_graded",
    ]),
  );
  // every mark carries the timing the funnel is FOR
  for (const f of funnel)
    expect(typeof f.ms_since_nav, `${f.step} is timed`).toBe("number");

  // ── and the other half of the rule: someone who walked the WHOLE spine did not abandon, so
  // leaving now reports nothing new (the rigged success above finishes the roll deterministically) ──
  const bailsBefore = await page.evaluate(
    () =>
      (window as any).__neural.csBeats.filter(
        (b: any) => b.beat === "funnel_abandon",
      ).length,
  );
  await page.evaluate(() =>
    (window as any).__neural._csAbandon("test-complete"),
  );
  const bailsAfter = await page.evaluate(
    () =>
      (window as any).__neural.csBeats.filter(
        (b: any) => b.beat === "funnel_abandon",
      ).length,
  );
  expect(spine[spine.length - 1], "the journey did walk the whole spine").toBe(
    "roll_ended",
  );
  expect(bailsAfter, "a completed roll is not an abandonment").toBe(
    bailsBefore,
  );

  if (CAPTURE) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(
      resolve(OUT, "cold-start-observation.json"),
      JSON.stringify(dumps, null, 2),
    );
    writeFileSync(
      resolve(OUT, "cold-start-beats.json"),
      JSON.stringify(
        await page.evaluate(() => ({
          beats: ((window as any).__neural.beats || []).slice(),
          funnel: ((window as any).__neural.csBeats || []).slice(),
        })),
        null,
        2,
      ),
    );
  }
});

test("cold start: ignoring the landing question is measured, not silent", async ({
  page,
}) => {
  // Regression pin for the real gap this instrumentation closed: _breakCombo is a no-op at combo
  // 0, so before land_q_ignored existed, a first-time visitor who executed straight past the
  // question left NO trace at all — the single most likely cold-start behavior was unmeasurable.
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
  await j.land("Mount Top");
  await expect(page.locator("[data-land-q]")).toHaveCount(1);
  expect(
    await page.evaluate(() => (window as any).__neural._combo || 0),
    "combo is cold, so the momentum break is silent",
  ).toBe(0);

  const target = await page.evaluate(() => {
    const a = (window as any).__neural;
    for (const i of a.optionIdxs || [])
      if (a.nodes[i].ty === "transitions") return a.nodes[i].t;
    return a.nodes[(a.optionIdxs || [])[0]].t;
  });
  await j.pick(target);
  await j.expectBeat("land_q_ignored");
  const mark = await page.evaluate(() =>
    (window as any).__neural.csBeats.find(
      (b: any) => b.beat === "funnel" && b.step === "question_ignored",
    ),
  );
  expect(mark, "and the funnel records it").toBeTruthy();
  expect(mark.spine, "as a side mark, not a spine step").toBe(false);
});
