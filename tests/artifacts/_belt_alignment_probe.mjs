#!/usr/bin/env node
/**
 * WHAT A PLAYER'S BELT IS MADE OF, MEASURED ON THE APP'S OWN CODE (research, 2026-09-30).
 *
 * The app carries two ladders that both speak in belt colours, and nothing compared them:
 *
 *   GAME KNOWLEDGE   `gameScore()` — Σ weight·deckMastery over ~2,900 decks, weights from the
 *                    one-player damped walk (`build_score_weights`), banded by `BELT_SCORE`
 *                    (white .20 · blue .40 · purple .60 · brown .70 · black .80).
 *   CHALLENGES       `curriculum.json` belts → units → lessons → checkpoint → optional capstone;
 *                    `_frontierBeltId()` dyes the Challenges tab belt, `unitComplete` gives its
 *                    stripes, `belts.won` records capstones. Plus the objective tracks
 *                    (`NG_CHALLENGES`) whose completion mints patches.
 *
 * NOTHING HERE RE-IMPLEMENTS A RULE (CLAUDE.md §6.3). The probe loads the REAL class the way the
 * unit suite does (`new Function(src)` → `Component.prototype`, as tests/flow.test.mjs), with the
 * challenge definitions, engine and UI mixin in the same scope as the bundle concatenates them.
 * Each persona is written to a localStorage shim and read back by the real `_loadProgress`; the
 * deck manifest goes through the real `_ingestDeckManifest`; the curriculum through the real
 * `_onCurriculum`, which runs the boot evidence snapshot (`_refreshChallengeEvidence`). The tab
 * belt is read from what `renderTabSubtitles()` WROTE into a stub DOM node, not recomputed.
 *
 * THE PERSONAS ARE THE e2e ONES. `e2e/gen/personas.ts` is transpiled with the repo's esbuild and
 * run as-is; its payload reads are redirected from source/public to this tree's own emit. Every
 * persona there seeds `stage: {}`, and `deckMastery` reads ONLY `stage` — so as seeded, every
 * persona's Game Knowledge is exactly 0. That is a finding about the fixtures, and it is why each
 * persona is measured three ways:
 *   seeded   the blob exactly as the suite boots it;
 *   implied  plus the SMALLEST `stage` the app needs to have produced the blob's own evidence:
 *            rec[k]=r → r distinct cards at stage 3 (rec counts cards that crossed stage 3);
 *            prep[k]=p with no rec → one card at stage min(p,2) (p correct MC answers on one card);
 *            a checkpoint or capstone adds nothing (its answers may land on stage-2 cards).
 *            A LOWER BOUND on the score of a real player holding that evidence.
 *   full     every deck the blob touched at stage 3 on all of its cards — an UPPER BOUND for a
 *            player whose Challenges evidence came from fully recalling every lesson deck.
 * Synthetic score-first players (the reverse direction, which no fixture covers) master decks in
 * descending weight-per-card order until each band, answering every card, and take no checkpoint.
 * Real user data is never read.
 *
 * WHICH "TODAY" IT MEASURES. It reads the code it runs against. Written at 3f157a692 (pre-v1.210.0),
 * where `today_tab` was the lessons-based frontier and the readers used the Game Knowledge band;
 * from v1.210.0 the tab IS rule A2 behind the high-water mark (and each boot here runs the one-time
 * grandfather), so on a later tree the A2 column agrees with `today_tab` by construction. The
 * curriculum-share and persona tables stay meaningful on any tree.
 *
 * Run:   python3 scripts/regenerate_neural_data.py   # the emit this reads (~80 s)
 *        node tests/artifacts/_belt_alignment_probe.mjs [--json <out.json>]
 * Needs: source/node_modules (esbuild) — the repo's own install or the donor symlink.
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as nodePath from "node:path";
import { createRequire } from "node:module";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ngWireDecks, ngWireScoreWeights } from "../../neural/src/wire-keys.src.js";
import { knowledgeSource } from "../_knowledge_profile_harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EMIT = resolve(ROOT, "source/quartz/static/neural");
const rd = (p) => readFileSync(resolve(ROOT, p), "utf8");
const jsonOut = (() => { const i = process.argv.indexOf("--json"); return i > 0 ? process.argv[i + 1] : null; })();

// ── the real class, in the bundle's scope (the unit suite's prelude: tests/belt_worn.test.mjs) ──
const stripX = (t) => t.replace(/^export (function|const|let|var|class) /gm, "$1 ");
const bundle = [
  knowledgeSource,
  stripX(rd("neural/src/progress-owner.src.js")),
  stripX(rd("neural/src/lists-codec.src.js")),
  stripX(rd("neural/src/lists.src.js")),
  rd("neural/src/challenge-definitions.src.js"),
  rd("neural/src/challenge-engine.src.js"),
  rd("neural/src/app.src.jsx"),
  rd("neural/src/challenge-ui.src.js"),
].join("\n");
const M = new Function(
  "DCLogic", "React",
  `${bundle}\nreturn { Component, NG_CHALLENGES, NG_CHALLENGE_TRACKS, NG_BADGE_DEFINITIONS };`,
)(class DCLogic {}, { createRef: () => ({ current: null }) });

// ── the real personas ────────────────────────────────────────────────────────────────────────
const esbuild = createRequire(resolve(ROOT, "source/package.json"))("esbuild");
const PUBLIC_NEURAL = `${sep}source${sep}public${sep}static${sep}neural${sep}`;
const EMIT_NEURAL = `${sep}source${sep}quartz${sep}static${sep}neural${sep}`;
let redirected = 0;
const fsShim = {
  readFileSync: (p, enc) => {
    const s = String(p);
    if (s.includes(PUBLIC_NEURAL)) redirected++;
    return readFileSync(s.replace(PUBLIC_NEURAL, EMIT_NEURAL), enc);
  },
};
const personaReq = (id) => {
  if (id === "node:fs") return fsShim;
  if (id === "node:path") return nodePath;
  if (id.endsWith("wire-keys.src.js")) return { ngWireDecks, ngWireScoreWeights };
  throw new Error("probe: personas.ts imports something new: " + id);
};
const personaMod = { exports: {} };
new Function("require", "module", "exports", "__dirname",
  esbuild.transformSync(rd("e2e/gen/personas.ts"), { loader: "ts", format: "cjs" }).code,
)(personaReq, personaMod, personaMod.exports, resolve(ROOT, "e2e/gen"));
const P = personaMod.exports;
if (redirected !== 2) throw new Error(`probe: expected personas.ts to read 2 payload files, it read ${redirected}`);

// ── payloads ─────────────────────────────────────────────────────────────────────────────────
const GD = JSON.parse(readFileSync(`${EMIT}/graph-data.json`, "utf8"));
const CUR = JSON.parse(readFileSync(`${EMIT}/curriculum.json`, "utf8"));
const MAN = JSON.parse(readFileSync(`${EMIT}/flashcards/_index.json`, "utf8"));
const BELTS = CUR.belts.map((b) => b.id);
const BAND = { white: 0.2, blue: 0.4, purple: 0.6, brown: 0.7, black: 0.8 };
const rank = (belt) => (belt == null ? -1 : BELTS.indexOf(belt));

// ── one booted app per (blob, frame) ─────────────────────────────────────────────────────────
function boot(blob, frame, cur = CUR) {
  const a = Object.create(M.Component.prototype);
  a.nodes = GD.nodes;                 // ngWire* resolve ordinals from the wire nodes' `o`
  a.settings = {};
  a._giMode = frame === "nogi" ? "nogi" : "gi";
  a.viewToggleRef = { current: null };
  a.explorerListRef = { current: null };
  a.beats = [];
  a.fx = function (beat, props) { this.beats.push(beat); };
  a.track = () => {};
  a._saveProgress = () => {};
  a._flushSave = () => {};
  a.renderTutorial = () => {};
  a.renderChallengeCue = null;
  a._renderPaneBody = () => {};
  a._progressCurrent = () => true;
  a._ingestDeckManifest(MAN);
  a._hydrateProgressBlob(blob === undefined ? null : JSON.parse(JSON.stringify(blob)));   // the real loader's body
  a._progressLoaded = true;
  a.curriculum = cur;
  a._onCurriculum();                  // → _refreshChallengeEvidence(): the boot snapshot
  // a remapped score table is SKIPPED by the app and announced, never guessed (§6.6) — so a
  // lighter table cannot pass here as a real measurement
  if (a.beats.includes("wire_key_unresolved")) throw new Error("probe: the score table names an ordinal the wire nodes lack");
  return a;
}

/** What renderTabSubtitles() wrote: the tab belt's dye (→ track id), stripes and aria label. */
function tabBelt(a) {
  const ex = { textContent: "" };
  const btn = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const ch = { innerHTML: "", closest: () => btn };
  a.viewToggleRef = { current: { querySelector: (s) => (s.includes("explore") ? ex : s.includes("challenges") ? ch : null) } };
  a.renderTabSubtitles();
  a.viewToggleRef = { current: null };
  const stripes = Number((/data-tab-stripes="(\d+)"/.exec(ch.innerHTML) || [])[1]);
  const aria = btn.attrs["aria-label"] || "";
  const track = (/ on the (\w+) track/.exec(aria) || [])[1] || null;
  // a read that matched nothing must not print as a white belt with no stripes (§6.6)
  if (!BELTS.includes(track) || !Number.isFinite(stripes)) throw new Error(`probe: could not read the tab belt from ${JSON.stringify(aria)} / ${ch.innerHTML}`);
  return { track, stripes, aria, explore: ex.textContent };
}

function measure(blob, frame, cur = CUR) {
  const a = boot(blob, frame, cur);
  const gs = a.gameScore();
  const tab = tabBelt(a);
  const perBelt = {};
  for (const b of CUR.belts) {
    const ls = a._beltLessonSummary(b.id);
    let proven = 0;
    for (const u of b.units) if (a.unitComplete(b.id, u)) proven++;
    perBelt[b.id] = {
      lessons: `${ls.done}/${ls.total}`,
      lessonsAll: ls.total > 0 && ls.done >= ls.total,
      units: `${proven}/${b.units.length}`,
      cleared: proven === b.units.length,
      capstone: !!(a.belts && a.belts.won && a.belts.won[b.id]),
      track: a.challengeTrackProgress(b.id),
    };
  }
  // the highest belt whose predicate holds for it AND every belt below it
  const ladder = (pred) => { let r = -1; for (let i = 0; i < BELTS.length; i++) { if (pred(perBelt[BELTS[i]])) r = i; else break; } return r; };
  return {
    score: gs.score,
    kBelt: gs.belt,                        // null = below the white band
    kStripes: gs.stripes,
    recallInPlay: a._recallInPlayNow(),
    frontier: a._frontierBeltId(),
    tab,
    perBelt,
    clearedTo: ladder((x) => x.cleared),            // units proven (lessons + checkpoint)
    lessonsTo: ladder((x) => x.lessonsAll),         // live lessons only (what moves the frontier)
    capstoneTo: ladder((x) => x.capstone),
    tracksTo: ladder((x) => x.track.complete),
    badges: Object.keys(a.badges || {}).sort(),
  };
}

// ── realizations: the stage a real player holding this evidence must have ────────────────────
const deckN = (() => { const a = boot(undefined, "gi"); const out = {}; for (const k in a.flashcards.decks) out[k] = a.flashcards.decks[k].n || 0; return out; })();
{
  // COVERAGE, POSITIVE AND FLOORED: the manifest decoded, and every lesson's deck is a real deck
  const lessons = CUR.belts.flatMap((b) => b.units.flatMap((u) => u.lessons));
  const joined = lessons.filter((l) => deckN[l.deckKey] > 0).length;
  console.log(`coverage: ${Object.keys(deckN).length} decks decoded from the manifest · ${joined}/${lessons.length} lesson decks joined with cards`);
  if (Object.keys(deckN).length < 2800 || joined !== lessons.length) throw new Error("probe: the manifest or the lesson→deck join came back short");
}
const fullDeck = (k) => { const s = {}; for (let i = 0; i < (deckN[k] || 0); i++) s["p" + i] = 3; return s; };
function realize(blob, how) {
  if (!blob || how === "seeded") return blob;
  const b = JSON.parse(JSON.stringify(blob));
  b.stage = b.stage || {};
  const touched = new Set([...Object.keys(b.prep || {}), ...Object.keys(b.rec || {})]);
  for (const k of touched) {
    if (!deckN[k]) continue;
    if (how === "full") { b.stage[k] = fullDeck(k); continue; }
    const r = Math.min((b.rec || {})[k] || 0, deckN[k]);
    const s = {};
    if (r > 0) for (let i = 0; i < r; i++) s["r" + i] = 3;
    else if ((b.prep || {})[k] > 0) s.p0 = Math.min(2, b.prep[k]);
    b.stage[k] = Object.assign(s, b.stage[k] || {});
  }
  return b;
}

// ── the persona set ──────────────────────────────────────────────────────────────────────────
const personas = [
  ["freshVisitor", P.freshVisitor()],
  ["firstRollDay1", P.firstRollDay1()],
  ["casualWeek1", P.casualWeek1()],
  ["curriculumMid", P.curriculumMid()],
  ...CUR.belts.map((b) => [`beltReady(${b.id})`, P.beltReady(b)]),
  ["whiteBeltHolder", P.whiteBeltHolder()],
  ["srsVeteran(25)", P.srsVeteran()],
  ["lapsedReturner", P.lapsedReturner()],
  ["multiBeltEndgame", P.multiBeltEndgame()],
  ["legacyV1", P.legacyV1()],
];

// synthetic score-first players: whole decks by weight per card, answering every card
function scoreFirst(frame, target) {
  const w = boot(undefined, frame).scoreWeights(frame);
  const order = Object.keys(w).filter((k) => deckN[k] > 0).sort((x, y) => w[y] / deckN[y] - w[x] / deckN[x] || (x < y ? -1 : 1));
  const b = { v: 2, prep: {}, rec: {}, stage: {}, srs: {}, units: {}, belts: { won: {} }, tut: { done: {} }, challenges: {}, badges: {}, coins: {}, days: {}, settings: {}, settingsAt: {}, updatedAt: 0 };
  let acc = 0, total = 0, cards = 0, decks = 0;
  for (const k in w) total += w[k];
  for (const k of order) {
    if (acc / total >= target) break;
    b.stage[k] = fullDeck(k); b.prep[k] = 3 * deckN[k]; b.rec[k] = deckN[k];
    acc += w[k]; cards += deckN[k]; decks++;
  }
  return { blob: b, cards, decks };
}

// ── the curriculum's share of the score ──────────────────────────────────────────────────────
function share(frame) {
  const a = boot(undefined, frame);
  const w = a.scoreWeights(frame);
  let total = 0, allCards = 0;
  for (const k in w) { total += w[k]; allCards += deckN[k] || 0; }
  const rows = [];
  let cumW = 0, cumCards = 0, cumDecks = 0;
  const cumKeys = new Set();
  for (const b of CUR.belts) {
    let bw = 0, bc = 0, bd = 0, zero = 0;
    for (const u of b.units) for (const l of u.lessons) {
      if (!a._lessonLive(l)) continue;
      const lw = w[l.deckKey] || 0;
      if (!lw) zero++;
      if (cumKeys.has(l.deckKey)) continue;
      cumKeys.add(l.deckKey);
      bw += lw; bc += deckN[l.deckKey] || 0; bd++;
    }
    cumW += bw; cumCards += bc; cumDecks += bd;
    // the score if every lesson deck of this belt and all below is fully recalled (real gameScore)
    const stage = {};
    for (const k of cumKeys) stage[k] = fullDeck(k);
    const full = measure({ ...P.multiBeltEndgame(), prep: {}, rec: {}, units: {}, belts: { won: {} }, stage }, frame);
    const mc = {};
    for (const k of cumKeys) { const s = {}; for (let i = 0; i < (deckN[k] || 0); i++) s["p" + i] = 2; mc[k] = s; }
    const mcOnly = measure({ ...P.multiBeltEndgame(), prep: {}, rec: {}, units: {}, belts: { won: {} }, stage: mc }, frame);
    rows.push({ belt: b.id, decks: bd, zeroWeightLessons: zero, cards: bc, weight: bw / total, cumDecks, cumCards, cumWeight: cumW / total,
      cumScoreFullRecall: full.score, cumKBeltFullRecall: full.kBelt, cumScoreMCOnly: mcOnly.score, cumKBeltMCOnly: mcOnly.kBelt });
  }
  const bands = {};
  for (const [belt, t] of Object.entries(BAND)) { const s = scoreFirst(frame, t); const m = measure(s.blob, frame); bands[belt] = { cards: s.cards, decks: s.decks, score: m.score, kBelt: m.kBelt, lessonsTo: m.lessonsTo, clearedTo: m.clearedTo, frontier: m.frontier, tab: m.tab.track, recallInPlay: m.recallInPlay, lessonsDoneTotal: CUR.belts.reduce((n, b) => n + Number(m.perBelt[b.id].lessons.split("/")[0]), 0) }; }
  return { frame, scoredDecks: Object.keys(w).length, scoredCards: allCards, rows, bands };
}

// Option E's table: the SAME weights, restricted to the frame's live lesson decks and handed to
// the app through the flat `weights` shape it still reads (ngWireScoreWeights' last fallback).
const CUR_E = {};
for (const frame of ["gi", "nogi"]) {
  const a = boot(undefined, frame);
  const w = a.scoreWeights(frame), keep = {};
  for (const b of CUR.belts) for (const u of b.units) for (const l of u.lessons) if (a._lessonLive(l) && w[l.deckKey]) keep[l.deckKey] = w[l.deckKey];
  const { scoreWeightsByOrd, scoreWeightsByRuleset, scoreWeights, ...rest } = CUR;
  CUR_E[frame] = { ...rest, weights: keep };
}

// ── the candidate rules (phase 2), evaluated on what `measure` read from the app ─────────────
// Every rule answers "which belt do you WEAR", on one scale: everyone starts in white, clearing a
// belt's requirement promotes you to the next, and clearing black's leaves you in black.
const wear = (clearedRank) => BELTS[Math.min(BELTS.length - 1, clearedRank + 1)];
const kWear = (m) => (m.kBelt == null ? "white" : m.kBelt);   // the band you have EARNED; no band = the white you start in
const RULES = {
  today_tab: (m) => m.tab.track,                              // what the Challenges tab dyes today
  today_band: (m) => kWear(m),                                // what gates recall-in-play and the digest names
  A1_lessons: (m) => wear(m.lessonsTo),                       // today's frontier, with the all-done fallback fixed
  A2_units: (m) => wear(m.clearedTo),                         // promotion = every unit proven (lessons + checkpoint)
  B_capstone: (m) => wear(m.capstoneTo),                      // promotion = the belt's capstone won
  D_both: (m) => BELTS[Math.min(rank(wear(m.clearedTo)), rank(kWear(m)))],
  E_curriculumScore: (m) => (m.eBelt == null ? "white" : m.eBelt),   // today's bands on a curriculum-only score
};
// the migration: a one-time grandfather of every belt the player can see today, then a monotone
// high-water mark (never lower than what it held, whatever the rule later computes)
const migrate = (rule, m) => BELTS[Math.max(rank(RULES[rule](m)), rank(RULES.today_tab(m)), rank(RULES.today_band(m)))];

function disagreements(m) {
  // per belt: cleared its Challenges (every unit proven) but under its score band — and the reverse
  const t1 = [], t2 = [];
  for (const b of BELTS) {
    const cleared = m.perBelt[b].cleared, reached = m.score >= BAND[b];
    if (cleared && !reached) t1.push(b);
    if (reached && !cleared) t2.push(b);
  }
  return { challengesNotScore: t1, scoreNotChallenges: t2 };
}

// ── run ──────────────────────────────────────────────────────────────────────────────────────
const out = { emit: { nodes: GD.nodes.length, belts: CUR.belts.length, lessons: CUR.belts.reduce((n, b) => n + b.units.reduce((m, u) => m + u.lessons.length, 0), 0), decks: Object.keys(deckN).length }, share: {}, personas: {} };
for (const frame of ["gi", "nogi"]) out.share[frame] = share(frame);
for (const [belt, t] of Object.entries(BAND)) personas.push([`scoreFirst→${belt} (synthetic)`, scoreFirst("gi", t).blob]);
{
  const b = P.beltReady(CUR.belts[0]);
  b.prep = {}; b.rec = {}; b.units = {};
  const giApp = boot(undefined, "gi");
  for (const belt of CUR.belts.slice(0, 4)) for (const u of belt.units) {
    b.units[`${belt.id}/${u.id}`] = { checkpoint: true, t: 1 };
    for (const l of u.lessons) if (giApp._lessonLive(l)) { b.prep[l.deckKey] = 3; b.rec[l.deckKey] = 3; }
  }
  personas.push(["giOnly→brown (synthetic)", b]);
}
for (const [name, blob] of personas) {
  out.personas[name] = {};
  for (const how of ["seeded", "implied", "full"]) {
    out.personas[name][how] = {};
    for (const frame of ["gi", "nogi"]) {
      const m = measure(realize(blob, how), frame);
      const e = measure(realize(blob, how), frame, CUR_E[frame]);
      m.eScore = e.score; m.eBelt = e.kBelt;
      m.disagree = disagreements(m);
      m.rules = Object.fromEntries(Object.keys(RULES).map((r) => [r, RULES[r](m)]));
      m.migrated = Object.fromEntries(["A1_lessons", "A2_units", "B_capstone", "D_both", "E_curriculumScore"].map((r) => [r, migrate(r, m)]));
      out.personas[name][how][frame] = m;
    }
  }
}

// ── print ────────────────────────────────────────────────────────────────────────────────────
const pct = (x, d = 1) => (100 * x).toFixed(d) + "%";
const bn = (r) => (r < 0 ? "—" : BELTS[r]);
console.log(`emit: ${out.emit.nodes} nodes · ${out.emit.belts} belts · ${out.emit.lessons} lessons · ${out.emit.decks} decks in the manifest`);
for (const frame of ["gi", "nogi"]) {
  const s = out.share[frame];
  console.log(`\nCURRICULUM SHARE OF THE SCORE (${frame}) — ${s.scoredDecks} weighted decks, ${s.scoredCards} cards`);
  console.log("belt    live-lessons  zero-wt  cards  weight   cum-weight  cum-score(full recall)  K-belt  cum-score(MC only)  K-belt");
  for (const r of s.rows) console.log(`${r.belt.padEnd(7)} ${String(r.decks).padStart(6)}  ${String(r.zeroWeightLessons).padStart(9)}  ${String(r.cards).padStart(5)}  ${pct(r.weight, 2).padStart(6)}  ${pct(r.cumWeight, 2).padStart(9)}  ${pct(r.cumScoreFullRecall, 2).padStart(22)}  ${String(r.cumKBeltFullRecall).padStart(6)}  ${pct(r.cumScoreMCOnly, 2).padStart(18)}  ${String(r.cumKBeltMCOnly).padStart(6)}`);
  console.log("score-first player (whole decks by weight/card, every card recalled, no checkpoints):");
  for (const [belt, v] of Object.entries(s.bands)) console.log(`  to ${belt.padEnd(6)} ${String(v.cards).padStart(6)} cards in ${String(v.decks).padStart(4)} decks → score ${pct(v.score)} K=${v.kBelt} · lessons done ${v.lessonsDoneTotal}/174 · lessons-to ${bn(v.lessonsTo)} · units-cleared-to ${bn(v.clearedTo)} · tab belt ${v.tab} · recallInPlay ${v.recallInPlay}`);
}
console.log("\nPERSONAS (gi) — K = knowledge band from gameScore · tab = Challenges tab belt (frontier) · cleared = highest belt with every unit proven · cap = highest capstone won");
console.log("persona              how      score    K       recallInPlay  tab(stripes)   lessons-to  cleared-to  cap-to  tracks-to  badges");
for (const [name] of personas) for (const how of ["seeded", "implied", "full"]) {
  const m = out.personas[name][how].gi;
  console.log(`${name.padEnd(20)} ${how.padEnd(8)} ${pct(m.score, 2).padStart(6)} E${pct(m.eScore || 0, 1).padStart(6)}  ${String(m.kBelt).padEnd(6)}  ${String(m.recallInPlay).padEnd(12)}  ${(m.tab.track + "(" + m.tab.stripes + ")").padEnd(13)}  ${bn(m.lessonsTo).padEnd(10)}  ${bn(m.clearedTo).padEnd(10)}  ${bn(m.capstoneTo).padEnd(6)}  ${bn(m.tracksTo).padEnd(9)}  ${m.badges.join(",")}`);
}
const isSynth = (name) => name.includes("(synthetic)");
console.log("\nDISAGREEMENTS (gi), per belt — T1: every unit of the belt proven but the score is under its band · T2: the score is over the band but the belt's units are not all proven");
for (const how of ["seeded", "implied", "full"]) {
  for (const synth of [false, true]) {
    const names = personas.map(([n]) => n).filter((n) => isSynth(n) === synth);
    if (synth && how !== "seeded") continue;    // a synthetic blob already carries its stage: its realizations coincide
    const t1 = names.filter((n) => out.personas[n][how].gi.disagree.challengesNotScore.length);
    const t2 = names.filter((n) => out.personas[n][how].gi.disagree.scoreNotChallenges.length);
    console.log(`  ${(synth ? "synthetic" : "e2e").padEnd(9)} ${how.padEnd(8)} ${names.length} personas · T1 ${t1.length} · T2 ${t2.length}`);
    for (const n of t1) console.log(`      T1 ${n}: ${out.personas[n][how].gi.disagree.challengesNotScore.join(",")} (score ${pct(out.personas[n][how].gi.score, 2)})`);
    for (const n of t2) console.log(`      T2 ${n}: ${out.personas[n][how].gi.disagree.scoreNotChallenges.join(",")} (score ${pct(out.personas[n][how].gi.score, 2)})`);
  }
}
console.log("\nRULES (gi) — the belt each rule makes you WEAR; ↑/↓ against today's tab belt | today's band; [migrated] = after the grandfather + high-water mark");
const R = ["A1_lessons", "A2_units", "B_capstone", "D_both", "E_curriculumScore"];
const mv = (a, b) => (rank(a) > rank(b) ? "↑" : rank(a) < rank(b) ? "↓" : "=");
console.log("persona                      how      tab     band    " + R.map((r) => r.padEnd(22)).join(""));
for (const [name] of personas) for (const how of ["seeded", "implied", "full"]) {
  if (isSynth(name) && how !== "seeded") continue;
  const m = out.personas[name][how].gi, r = m.rules;
  console.log(`${name.padEnd(28)} ${how.padEnd(8)} ${r.today_tab.padEnd(7)} ${r.today_band.padEnd(7)} ` + R.map((k) => `${r[k]} ${mv(r[k], r.today_tab)}|${mv(r[k], r.today_band)} [${m.migrated[k]}]`.padEnd(22)).join(""));
}
const tally = {};
for (const k of R) tally[k] = { e2e: { upTab: 0, downTab: 0, upBand: 0, downBand: 0, rows: 0, movedAfterMigration: 0 }, synthetic: { upTab: 0, downTab: 0, upBand: 0, downBand: 0, rows: 0, movedAfterMigration: 0 } };
for (const [name] of personas) for (const how of ["seeded", "implied", "full"]) {
  if (isSynth(name) && how !== "seeded") continue;
  const m = out.personas[name][how].gi, r = m.rules;
  for (const k of R) {
    const t = tally[k][isSynth(name) ? "synthetic" : "e2e"];
    t.rows++;
    if (rank(r[k]) > rank(r.today_tab)) t.upTab++;
    if (rank(r[k]) < rank(r.today_tab)) t.downTab++;
    if (rank(r[k]) > rank(r.today_band)) t.upBand++;
    if (rank(r[k]) < rank(r.today_band)) t.downBand++;
    if (m.migrated[k] !== r.today_tab) t.movedAfterMigration++;
  }
}
console.log("\nTALLY (gi, persona×realization rows) — up/down vs today's tab belt and vs today's band; moved = the migrated belt differs from today's tab belt");
for (const k of R) for (const g of ["e2e", "synthetic"]) { const t = tally[k][g]; console.log(`  ${k.padEnd(11)} ${g.padEnd(9)} rows ${String(t.rows).padStart(2)} · vs tab ↑${t.upTab} ↓${t.downTab} · vs band ↑${t.upBand} ↓${t.downBand} · migrated ≠ tab ${t.movedAfterMigration}`); }
out.tally = tally;
const nogiDiff = [];
for (const [name] of personas) for (const how of ["seeded", "implied", "full"]) {
  const g = out.personas[name][how].gi, n = out.personas[name][how].nogi;
  if (g.kBelt !== n.kBelt || g.tab.track !== n.tab.track || g.clearedTo !== n.clearedTo || g.lessonsTo !== n.lessonsTo) nogiDiff.push(`${name}/${how}: gi K=${g.kBelt} tab=${g.tab.track} cleared=${bn(g.clearedTo)} · nogi K=${n.kBelt} tab=${n.tab.track} cleared=${bn(n.clearedTo)}`);
}
console.log(`\nno-gi differs from gi on ${nogiDiff.length} persona×realization rows${nogiDiff.length ? ":\n  " + nogiDiff.join("\n  ") : ""}`);
if (jsonOut) { writeFileSync(jsonOut, JSON.stringify(out, null, 1)); console.log(`\nwrote ${jsonOut}`); }
