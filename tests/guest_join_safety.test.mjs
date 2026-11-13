// GUEST PRACTICE JOINS THE ACCOUNT AT SIGN-IN, AND ONLY ADDS (v1.262.0, the owner U138 a, 11 Nov: "Always automatic").
// His standing rule for any change to stored progress: no account loses a %, a boost, gold or a belt. The join
// (progress-owner.src.js `joinGuest`, app.src.jsx `_joinGuestPractice`) adds the browser's guest copy to the account
// through ONE rule, `ngProgressGuestMerge`. These tests drive the REAL class with the bundle's prelude, as
// tests/moves_account_safety.test.mjs does, and claim:
//   1. FIGURES NEVER DROP, synthetic decks: over seeded random accounts and guest copies, every figure the account shows
//      (each deck's mastery, deckMastery and odds bonus, "Mastered N · X%", today's Practice count, the worn belt, every
//      challenge's progress, badges, coins, list items) is at least the account's AND at least the guest's.
//   2. KNOWN MOVES NEVER DROP, the real wire, both rulesets: a known move of the account stays known, every deck's
//      `mastery(key)` (the boost) and the "Moves known" line are at least the account's, and a guest's known move is
//      added unless the account's own answer on that move is the later one (then the account's answer stands, as on
//      its own two devices). CONTROL: the old Import's merge (the pull's, unchanged) lowers known moves on some of the
//      same accounts: the count is asserted non-zero, so the guard is not decoration.
//   3-9. THE JOIN, through the real sign-in path (`_applyUser`): only practice triggers it (3, 4); nothing is added
//      twice (5); practice done signed out later joins at the next sign-in (6); the guest copy stays byte for byte and
//      the account's settings stay its own (7); a SECOND ACCOUNT on the same browser receives it too, the owner's pick
//      (8); a failed or unverified sign-in adds nothing and marks nothing (9); the line, its words, once (10).
//   11-13. ORDER1 (the orchestrator's read of a0a8c6cfd, 12 Nov): the join runs only at the end of the account's first
//      SUCCESSFUL pull, so the rule meets the CLOUD's rows: a guest's later or same-day No never beats a Yes only the
//      cloud held (11, through join, pull, push and a second device's pull; red on a0a8c6cfd in 3 of its 4 cases);
//      an offline or failed first pull joins, marks and pushes nothing of the guest's (12, red on a0a8c6cfd); and a
//      guest's later srs miss meeting a cloud row lowers no figure, though the card comes due sooner (13, stated).
//   14-18. REVIEW375 (the second reader of PR #375): the reader's figure-level case on the real wire, both rulesets (14);
//      the roll ledger at its cap (6 then, 32 since v1.262.11) and below it (15); a re-join with the mark, then the local copy, lost (16);
//      an existing player restored at boot (17); the explicit legacy import through the same rule, the guest kind gone (18).
//   15, 19. FOLD2 (the reader's re-check of cb762c8b7): the first ledger fix folded the guest's rows into "the account's
//      newest partition", chosen again at every join, so when the newest changed between two joins of one guest copy the
//      same rolls were summed twice (6 read 11). Now a guest partition joins as itself (room, or already held) or not at
//      all (at the cap): the reader's case in 15, its adv_5_fold scenario in 19; both red on cb762c8b7's fold.
// MUTANTS (2026-11-12, rerun after FOLD2: all 21 run against this green file; each turned the tests named red):
//   ORDER1 fix reverted: the join in `_applyUser` before the pull, no not-pulled refusal  → 11, 12, 14, 15, 16, 19
//   ORDER1 call moved back to `_applyUser`, the host's refusal kept                      → 3-13, 15-17, 19 (nothing joins)
//   ORDER1 the join's not-pulled refusal removed (the call after the pull kept)           → 12 (a direct host call)
//   F1 the guest's ledger partition added regardless of the cap                          → 15, 19
//   FOLD2 the first fix's fold back (into the account's newest partition, cb762c8b7)      → 15, 19 ("6 real rolls read 11")
//   F2 prep summed in the merge instead of MAX                                           → 13, 16, 17, 19
//   F3 the join only after a sign-in in this tab, not on a restored session              → 9, 17
//   F5 confirmImport back to the plain merge                                             → 18
//   F5 the guest import kind restored                                                    → 18
//   F5 confirmImport without its not-pulled refusal                                       → 18
//   ngProgressGuestMoves returns `merged` unchanged                                       → 2, 11, 12, 14, 18
//   ngProgressGuestPart keeps `settings`                                                 → 1, 7, 18
//   ngProgressPracticeKey counts the trail (= the cloud key)                              → 3
//   NG_PROGRESS_TRAIL_CHALLENGES loses "white.coach3"                                     → 3, 4
//   joinGuest writes no mark                                                             → 5, 12, 17
//   the mark compared by presence, not by the copy's hash (`if (seen)`)                   → 6, 10
//   joinGuest also writes the joined blob back to the guest copy                           → 5, 7
//   the mark kept per browser, not per account                                           → 8, 12, 17
//   joinGuest without its refusal of an unverified (local-only) account                   → 9 (a direct call)
//   the mark written before the account's copy is saved                                   → 9
//   the line overwrites a held arrival sentence                                           → 10
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const rd = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const strip = (t) => t.replace(/^export (function|const|let|var|class) /gm, "$1 ");
const SOURCE = [
  knowledgeSource,
  strip(rd("neural/src/gameplan-debt.src.js")),
  strip(rd("neural/src/progress-owner.src.js")),
  strip(rd("neural/src/lists-codec.src.js")),
  strip(rd("neural/src/lists.src.js")),
  rd("neural/src/challenge-definitions.src.js"),
  rd("neural/src/challenge-engine.src.js"),
  rd("neural/src/app.src.jsx"),
  rd("neural/src/challenge-ui.src.js"),
  strip(rd("neural/src/flow.src.js")),
].join("\n");
const M = new Function("DCLogic", "React", SOURCE + "\nreturn { Component, ngProgressGuestMerge, ngProgressCreateHost, ngProgressOwner, ngProgressLocalKey, ngBeltRank, NG_PROGRESS_TRAIL_CHALLENGES, NG_WHITE_CHALLENGES };")(class DCLogic {}, { createRef: () => ({ current: null }) });

const DAY = 20402;
globalThis.window = globalThis.window || {};
globalThis.window.__NG_EPOCH_DAY__ = DAY;
const lcg = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) >>> 8) / (1 << 24);
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── 1. synthetic decks ───────────────────────────────────────────────────────────────────────────────────────────────
const DECKS = {};
for (const k of ["Mount|Top", "Closed Guard|Bottom", "Armbar from Mount|Attacker", "Kimura from Mount|Attacker", "Side Control|Top", "Triangle Choke|Attacker"]) {
  DECKS[k] = { n: 4, cards: [0, 1, 2, 3].map((i) => ({ q: k + " — question " + i, a: "answer " + i })) };
}
function boot(blob) {
  const a = Object.create(M.Component.prototype);
  Object.assign(a, { settings: {}, _settingsAt: {}, beats: [], viewToggleRef: { current: null }, explorerListRef: { current: null } });
  for (const k of ["_saveProgress", "_flushSave", "track", "renderTutorial", "setEvent", "setDeckOpen", "_applyLayers", "_gameValueChanged", "_rebuildRulesetMask"]) a[k] = () => {};
  a.weakSpots = () => null; a._progressCurrent = () => true;
  a._hydrateProgressBlob(clone(blob));
  a._progressLoaded = true;
  a.flashcards = { decks: clone(DECKS), manifest: true };
  a.curriculum = { belts: [], weights: Object.fromEntries(Object.keys(DECKS).map((k) => [k, 1])) };
  return a;
}
const CH = ["white-foundations", "blue-connections", "clean-checkpoint", "thirty-from-memory", "houdini", "frame-job"];
function randomBlob(a, r) {
  const b = { v: 2, prep: {}, rec: {}, stage: {}, srs: {}, days: {}, rollDays: {}, dayLog: {}, badges: {}, coins: {}, challenges: {}, lists: {}, belts: { won: {} }, explored: [] };
  for (const k of Object.keys(DECKS)) {
    if (r() < 0.7) b.prep[k] = (r() * 6) | 0;
    if (r() < 0.5) b.rec[k] = (r() * 5) | 0;
    DECKS[k].cards.forEach((c, i) => {
      const h = a.qhash(c.q);
      if (r() < 0.6) (b.stage[k] = b.stage[k] || {})[h] = 1 + ((r() * 4) | 0);
      if (r() < 0.5) { const last = DAY - ((r() * 3) | 0), ivl = 1 + ((r() * 9) | 0); (b.srs[k] = b.srs[k] || {})[h] = [last + ivl, ivl, last]; }
    });
  }
  if (r() < 0.6) b.belts.held = { id: ["white", "blue", "purple"][(r() * 3) | 0], t: 1762000000000 + ((r() * 1e6) | 0) };
  for (const c of CH) if (r() < 0.5) b.challenges[c] = { progress: (r() * 20) | 0, done: r() < 0.3, t: 1762000000000 };
  for (const id of ["first-sub", "houdini", "comeback"]) if (r() < 0.4) b.badges[id] = { t: 1762000000000 + ((r() * 1e6) | 0) };
  for (const id of ["c1", "c2", "c3"]) if (r() < 0.4) b.coins[id] = { t: 1762000000000 };
  if (r() < 0.5) { const id = "l" + ((r() * 3) | 0); b.lists[id] = { name: "List " + id, t: 1762000000000, items: ["Positions/Mount", "Transitions/Knee-Slice-Pass"].filter(() => r() < 0.7) }; }
  b.days["2026-11-11"] = (r() * 30) | 0;
  return b;
}
const figures = (a) => {
  const gs = a.gameScore();
  const ch = {}; for (const [id, e] of Object.entries(a.challenges || {})) ch[id] = (e && e.progress) || 0;
  return {
    menuMastered: a.masteredCount(), menuPct: Math.round((gs && gs.score ? gs.score : 0) * 100), today: a.practiceToday().done,
    decks: Object.fromEntries(Object.keys(DECKS).map((k) => [k, { mastery: a.mastery(k), deckMastery: a.deckMastery(k), bonus: a.stateBonus(k) }])),
    belt: M.ngBeltRank(a.belts && a.belts.held && a.belts.held.id), ch,
    badges: Object.keys(a.badges || {}), coins: Object.keys(a.coins || {}),
    items: Object.values(a.lists || {}).reduce((n, l) => n + ((l && l.items) || []).length, 0),
  };
};
function atLeast(after, before, label) {
  assert.ok(after.menuMastered >= before.menuMastered, label + ": Mastered " + after.menuMastered + " < " + before.menuMastered);
  assert.ok(after.menuPct >= before.menuPct, label + ": " + after.menuPct + "% < " + before.menuPct + "%");
  assert.ok(after.today >= before.today, label + ": today " + after.today + " < " + before.today);
  for (const k of Object.keys(DECKS)) for (const f of ["mastery", "deckMastery", "bonus"]) {
    assert.ok(after.decks[k][f] >= before.decks[k][f] - 1e-15, label + " " + k + " " + f + ": " + after.decks[k][f] + " < " + before.decks[k][f]);
  }
  assert.ok(after.belt >= before.belt, label + ": belt rank " + after.belt + " < " + before.belt);
  for (const [id, p] of Object.entries(before.ch)) assert.ok((after.ch[id] || 0) >= p, label + ": challenge " + id);
  for (const id of before.badges) assert.ok(after.badges.includes(id), label + ": badge " + id + " lost");
  for (const id of before.coins) assert.ok(after.coins.includes(id), label + ": coin " + id + " lost");
  assert.ok(after.items >= before.items, label + ": list items " + after.items + " < " + before.items);
}

test("1. figures never drop: seeded accounts and guest copies, every figure the account shows is >= the account's and the guest's", () => {
  const probe = boot({ v: 2 });
  let raised = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const r = lcg(seed * 104729), account = randomBlob(probe, r), guest = randomBlob(probe, r);
    account.settings = { emailMarketing: false, dailyGoal: 20 }; account.settingsAt = { emailMarketing: 5, dailyGoal: 5 };
    guest.settings = { emailMarketing: true, dailyGoal: 50 }; guest.settingsAt = { emailMarketing: 9e12, dailyGoal: 9e12 };
    const A = boot(account), G = boot(guest), fa = figures(A), fg = figures(G);
    const merged = M.ngProgressGuestMerge((l, i) => A._mergeProgressBlobs(l, i), A._progressBlob(), G._progressBlob());
    const after = figures(boot(merged));
    atLeast(after, fa, "seed " + seed + " vs the account");
    atLeast(after, fg, "seed " + seed + " vs the guest");
    assert.deepEqual(merged.settings, account.settings, "seed " + seed + ": the account's settings and consent are its own");
    if (after.menuPct > fa.menuPct || after.today > fa.today) raised++;
  }
  assert.ok(raised > 60, "the guest copies really added (" + raised + " of 120)");   // non-trivial
});

// ── 2. the real wire: known moves, both rulesets ──────────────────────────────────────────────────────────────────────
const WIRE = rd("source/quartz/static/neural/graph-data.json");
function wireBoot(blob, mode) {
  const a = Object.create(M.Component.prototype);
  Object.assign(a, { settings: {}, _settingsAt: {}, beats: [], viewToggleRef: { current: null }, explorerListRef: { current: null } });
  for (const k of ["_saveProgress", "_flushSave", "track", "renderTutorial", "setEvent", "setDeckOpen", "_applyLayers", "_gameValueChanged"]) a[k] = () => {};
  a._progressCurrent = () => true; a.get = (_k, d) => d; a.set = () => {};
  a.curriculum = { belts: [], weights: {} }; a._syncBelt = () => {};
  a.ingest(JSON.parse(WIRE));
  a._giMode = mode; a.playerRole = "top";
  a.currentPos = a.nodes.find((n) => n.id === "Positions/Mount").idx;
  a._hydrateProgressBlob(clone(blob));
  a._progressLoaded = true;
  return a;
}
function seatsOf(a) {
  const out = [], seen = new Set();
  for (const n of a.nodes) {
    const o = n.ty === "positions" ? a._ordById.get(a.siteIdOf(n.id)) : null;
    if (o != null) for (const role of ["top", "bottom"]) {
      if (seen.has(o + "/" + role)) continue; seen.add(o + "/" + role);
      const d = a._dealtOrds(n.idx, role);
      if (d.length) out.push({ st: o + "/" + role, key: a.posFamily(n.t) + "|" + (role === "bottom" ? "Bottom" : "Top"), dealt: d });
    }
  }
  return out;
}
const known = (moves) => { const s = new Set(); for (const st in moves || {}) for (const mv in moves[st]) if (moves[st][mv][3]) s.add(st + " " + mv); return s; };

test("2. known moves never drop, real wire, both rulesets; today's Import is the control that does drop them", (t) => {
  for (const mode of ["gi", "nogi"]) {
    const probe = wireBoot({ v: 2 }, mode), SEATS = seatsOf(probe);
    assert.ok(SEATS.length > 240, mode + ": seats found (" + SEATS.length + ")");
    const load = (blob) => { probe._hydrateProgressBlob(clone(blob)); return probe; };
    const look = (blob) => {
      const a = load(blob), line = a._movesKnownLine(), keys = new Set([...SEATS.map((s) => s.key), ...a._movesIdx().tech]);
      return { known: line ? line.known : -1, m: Object.fromEntries([...keys].map((k) => [k, a.mastery(k)])) };
    };
    let todayLowered = 0, added = 0, kept = 0, checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const r = lcg(seed * 7919 + (mode === "gi" ? 0 : 3)), acc = {}, gst = {};
      for (let s = 0; s < 6; s++) {
        const seat = SEATS[(r() * SEATS.length) | 0];
        for (const d of seat.dealt) {
          const both = r() < 0.5;
          const rowAt = (ok) => { const last = DAY - ((r() * 4) | 0); return [last + (ok ? 3 : 1), ok ? 3 : 1, last, ok ? 1 : 0]; };
          if (both || r() < 0.5) (acc[seat.st] = acc[seat.st] || {})[d] = rowAt(r() < 0.6);
          if (both || r() < 0.5) (gst[seat.st] = gst[seat.st] || {})[d] = rowAt(r() < 0.5);
        }
      }
      const account = { v: 2, moves: acc }, guest = { v: 2, moves: gst };
      const before = look(account), merge = (l, i) => probe._mergeProgressBlobs(l, i);
      const merged = M.ngProgressGuestMerge(merge, load(account)._progressBlob(), guest), after = look(merged);
      const todays = merge(load(account)._progressBlob(), guest);
      // the account side: nothing it knew is lost, no boost falls, the line never falls
      const kA = known(acc), kM = known(merged.moves), kG = known(gst);
      for (const c of kA) assert.ok(kM.has(c), mode + " seed " + seed + ": the account's known move " + c + " was lost");
      assert.ok(after.known >= before.known, mode + " seed " + seed + ": Moves known " + after.known + " < " + before.known);
      for (const [k, v] of Object.entries(before.m)) assert.ok(after.m[k] >= v, mode + " seed " + seed + " " + k + ": boost " + after.m[k] + " < " + v);
      // the guest side: a guest's known move is added unless the account's own answer is the later one (or the same day)
      for (const c of kG) {
        const [st, mv] = c.split(" "), a = acc[st] && acc[st][mv], g = gst[st][mv];
        if (kM.has(c)) { added++; continue; }
        assert.ok(a && !a[3] && a[2] >= g[2], mode + " seed " + seed + ": the guest's known move " + c + " was dropped without a later account answer");
        kept++;
      }
      if ([...kA].some((c) => !known(todays.moves).has(c))) todayLowered++;
      checked++;
    }
    assert.ok(added > 100 && kept > 0, mode + ": guest moves added " + added + ", account answers kept " + kept);
    assert.ok(todayLowered > 5, mode + ": today's Import lowers known moves on " + todayLowered + " of " + checked + " accounts");
    t.diagnostic(mode + ": " + checked + " accounts; guest moves added " + added + ", account answers kept " + kept + "; today's Import lowers known moves on " + todayLowered);
  }
});

// ── 3-10. the join, through the real sign-in path ───────────────────────────────────────────────────────────────────
function memory(failOn) {
  const rows = new Map();
  return { rows, getItem: (k) => rows.get(k) ?? null, setItem: (k, v) => { if (failOn && failOn(k)) throw new Error("quota"); rows.set(k, String(v)); } };
}
const GUEST = M.ngProgressOwner(), A = M.ngProgressOwner("A"), B = M.ngProgressOwner("B");
const guestKey = M.ngProgressLocalKey(GUEST), markOf = (o) => M.ngProgressLocalKey(o, "guest");
const LINE = "Your practice from before you signed in is saved";
// `cloud`: a Map user id -> blob, shared by two harnesses to stand for two devices of one account (ORDER1)
function harness(mem = memory(), cloud = new Map()) {
  let current, identity = null;
  const facade = { resolveNeuralUser: async () => identity, neuralSyncVersion: 2, isAuthenticated: () => true,
    pullNeural: async (id) => ({ userId: id, blob: cloud.has(id) ? clone(cloud.get(id)) : null }),
    pushNeural: async (b, id) => { pushes.push(id); cloud.set(id, clone(b)); return true; } };
  const pushes = [];
  const said = [];
  const host = M.ngProgressCreateHost({ storage: mem, resolveUser: () => facade.resolveNeuralUser(), hold: () => {}, mount(b) {
    const inst = new M.Component({}); current = inst; host.bind(inst, b);
    inst._publishKnowledge = () => {}; inst._applyLayers = () => {}; inst._refreshChallengeEvidence = () => {}; inst.updateAccountUI = () => {}; inst.track = () => {}; inst.fx = () => {};
    inst._auth = () => facade; inst.isTest = () => true;
    // the announcer: what the line would print, as the app's own `_announceArrival` holds it (the slot is kept real)
    const hold = inst._announceArrival.bind(inst);
    inst._announceArrival = (...args) => { said.push(args[1]); hold(...args); };
    inst.destroy = () => { if (inst.__ngDestroyed) return; inst.__ngDestroyed = true; inst._authDisposed = true; inst._invalidateCloudSync(); };
    inst._loadProgress();
  } });
  const get = () => current;
  // a verified sign-in IN THE REAL ORDER (`_initAuth`): the outgoing instance switches, the new one applies the user,
  // then its first pull is awaited
  const signIn = async (id) => { identity = { id, email: "player@example.com" }; get()._applyUser(identity); const a = get(); a._applyUser(identity); await a._pullAndMerge(); return get(); };
  const signOut = () => { identity = null; get()._clearAuthUser(); return get(); };
  const practise = (patch) => { const g = get(); Object.assign(g.prep, patch.prep || {}); if (patch.lists) g.lists = { ...g.lists, ...patch.lists }; g._flushSave(); };
  return { mem, host, facade, cloud, pushes, get, signIn, signOut, practise, said, setIdentity: (u) => { identity = u; }, boot: () => host.bootstrap() };
}
const accountBlob = (h, o) => h.host.store.read(o).blob;
// the trail a bare guest landing leaves, measured in the built app on 11 Nov (no answer, no roll)
const TRAIL = { explored: ["Positions/Mount"], tut: { done: { coach3: 1 } }, challenges: { "white.coach3": { progress: 1, done: true, t: 1794440051811 } }, belts: { won: {}, gf: 1794440051576 } };

test("3. an empty guest copy, or one holding only a bare visit's trail, joins nothing and says nothing", async () => {
  const h = harness(); await h.boot();
  await h.signIn("A");
  assert.ok(h.mem.rows.has(guestKey), "the sign-in itself wrote a guest copy, which is why every player saw the old row");
  assert.deepEqual(h.said, [], "an empty guest copy says nothing");
  // a guest who only looked: visited a state and met the first coach step
  const g = h.signOut(); Object.assign(g, { _exploredKeys: new Set(TRAIL.explored), tut: TRAIL.tut, challenges: TRAIL.challenges, belts: TRAIL.belts }); g._flushSave();
  const a = await h.signIn("A");
  assert.deepEqual(h.said, [], "a bare visit's trail says nothing");
  assert.ok(!accountBlob(h, A).challenges || !accountBlob(h, A).challenges["white.coach3"], "and joins nothing");
  assert.equal(h.host.joinGuest(a).status, "seen", "and is marked, so it is not looked at again");
});

test("4. the trail's coach steps are the white track's three coach challenges, and a coach step done WITH an answer joins", async () => {
  // two names for one set (CLAUDE.md §6.5): the white challenges mirrored from the three first-coach steps
  const coach = M.NG_WHITE_CHALLENGES.filter((c) => /^coach\d$/.test(c.legacyId)).map((c) => c.id);
  assert.equal(coach.length, 3, "the coach steps were found (" + coach.join(", ") + ")");
  assert.deepEqual([...M.NG_PROGRESS_TRAIL_CHALLENGES], coach);
  const h = harness(); await h.boot();
  const g = h.get(); Object.assign(g, { tut: TRAIL.tut, challenges: TRAIL.challenges }); h.practise({ prep: { "Mount|Top": 1 } });
  await h.signIn("A");
  assert.equal(accountBlob(h, A).prep["Mount|Top"], 1, "one answer is practice");
  assert.equal(accountBlob(h, A).challenges["white.coach3"].done, true, "and the trail rides along with it");
  assert.deepEqual(h.said, [LINE]);
});

test("5. nothing is added twice: the per-account mark keeps a deleted list deleted and the line unsaid", async () => {
  const h = harness(); await h.boot();
  h.practise({ prep: { "Mount|Top": 3 }, lists: { g1: { name: "Guest list", t: 1762000000000, items: ["Positions/Mount"] } } });
  let a = await h.signIn("A");
  assert.equal(accountBlob(h, A).lists.g1.name, "Guest list"); assert.deepEqual(h.said, [LINE]);
  delete a.lists.g1; a._flushSave();                       // the player deletes the list the guest copy brought
  h.signOut(); a = await h.signIn("A");
  assert.equal(accountBlob(h, A).lists.g1, undefined, "the same guest copy is never joined again (lists add, so it would come back)");
  assert.deepEqual(h.said, [LINE], "and the line is said once");
});

test("6. practice done signed out later joins at the next sign-in", async () => {
  const h = harness(); await h.boot();
  h.practise({ prep: { "Mount|Top": 3 } }); await h.signIn("A");
  h.signOut(); h.practise({ prep: { "Side Control|Top": 2 } });
  await h.signIn("A");
  assert.equal(accountBlob(h, A).prep["Side Control|Top"], 2, "the new practice joined");
  assert.deepEqual(h.said, [LINE, LINE], "a new guest copy, a new line");
});

test("7. the guest copy stays byte for byte, and the account's settings and email consent stay its own", async () => {
  const h = harness(); await h.boot();
  const g = h.get(); g.settings = { emailMarketing: true, dailyGoal: 50 }; g._settingsAt = { emailMarketing: 9e12, dailyGoal: 9e12 }; h.practise({ prep: { "Mount|Top": 4 } });
  h.mem.setItem(M.ngProgressLocalKey(A), JSON.stringify({ format: "bjj-progress-owner-v1", owner: A, blob: { v: 2, settings: { emailMarketing: false, dailyGoal: 20 }, settingsAt: { emailMarketing: 5, dailyGoal: 5 } }, savedAt: 1 }));
  // the sign-in re-saves the outgoing guest copy (savedAt moves); the JOIN must not touch it after that
  let raw = null; const host = h.host, join = host.joinGuest;
  host.joinGuest = (inst) => { raw = h.mem.rows.get(guestKey); return join(inst); };
  await h.signIn("A");
  assert.ok(raw, "the join ran"); assert.equal(h.mem.rows.get(guestKey), raw, "the guest copy is byte for byte what it was");
  assert.equal(accountBlob(h, A).prep["Mount|Top"], 4);
  assert.deepEqual(accountBlob(h, A).settings, { emailMarketing: false, dailyGoal: 20 }, "consent and goal stay the account's");
  assert.equal(h.signOut().prep["Mount|Top"], 4, "signing out still plays the guest copy");
});

test("8. a second account signing in on the same browser receives the guest practice too (owner U138 a, 11 Nov: his pick, not a leak to fix)", async () => {
  const h = harness(); await h.boot();
  h.practise({ prep: { "Mount|Top": 3 } });
  (await h.signIn("A")).prep["A|Top"] = 5; h.get()._flushSave();
  h.signOut(); await h.signIn("B");
  assert.equal(accountBlob(h, B).prep["Mount|Top"], 3, "B receives what was practised signed out on this browser");
  assert.equal(accountBlob(h, B).prep["A|Top"], undefined, "never A's own practice");
  assert.deepEqual(h.said, [LINE, LINE], "each account is told once");
});

test("9. a failed or unverified sign-in adds nothing and marks nothing", async () => {
  // (a) an unverified account: the SDK cannot load, so this device plays the stored account's copy locally
  const h = harness(); h.mem.setItem(guestKey, JSON.stringify({ format: "bjj-progress-owner-v1", owner: GUEST, blob: { v: 2, prep: { "Mount|Top": 3 } }, savedAt: 1 }));
  h.mem.setItem(M.ngProgressLocalKey(A), JSON.stringify({ format: "bjj-progress-owner-v1", owner: A, blob: { v: 2, prep: { "A|Top": 2 } }, savedAt: 1 }));
  h.facade.resolveNeuralUser = async () => { throw Object.assign(new Error("Account service unreachable"), { code: "sdk-unavailable", storedUserId: "A" }); };
  const r = await h.boot(); assert.equal(r.localOnly, true);
  const a = h.get(); await a._initAuth();
  assert.equal(a._progressLocalOnly, true);
  assert.equal(a.prep["Mount|Top"], undefined, "an unverified account joins nothing"); assert.equal(h.mem.rows.get(markOf(A)), undefined, "and marks nothing");
  assert.deepEqual(h.host.joinGuest(a), { status: "unavailable", reason: "identity-unverified" }, "the host refuses it outright, as unverified");
  // verified again: now it joins
  h.facade.resolveNeuralUser = async () => ({ id: "A", email: "player@example.com" }); await a._initAuth();
  assert.equal(h.get().prep["Mount|Top"], 3, "the verified sign-in joins"); assert.deepEqual(h.said, [LINE]);
  // (b) the account's copy cannot be written (storage full): nothing joins, nothing is marked, nothing is said
  const full = harness(memory((k) => k === M.ngProgressLocalKey(A))); await full.boot();
  full.practise({ prep: { "Mount|Top": 3 } }); await full.signIn("A");
  assert.equal(full.get().prep["Mount|Top"], undefined, "nothing joined"); assert.equal(full.mem.rows.get(markOf(A)), undefined, "nothing marked");
  assert.deepEqual(full.said, [], "nothing said");
});

test("10. the line: its words, held for the landing, once; it never overwrites another held sentence", async () => {
  const h = harness(); await h.boot();
  h.practise({ prep: { "Mount|Top": 3 } });
  const a = await h.signIn("A"), u = { id: "A", email: "player@example.com" };
  assert.deepEqual(h.said, [LINE]);
  assert.deepEqual([a._arrivalSay.k, a._arrivalSay.t, a._arrivalSay.whole], ["", LINE, true], "held for the landing: no kicker, printed whole");
  // new guest practice, and a shared link's sentence already held when the account mounts: the join stays silent
  h.signOut(); h.practise({ prep: { "Side Control|Top": 1 } });
  const keep = { k: "Shared list", t: "A coach's class", tone: "good" };
  h.setIdentity(u); h.get()._applyUser(u);              // the guest instance switches; the account instance mounts
  const acct = h.get(); acct._arrivalSay = keep; acct._applyUser(u); await acct._pullAndMerge();
  assert.equal(acct._arrivalSay, keep, "the held sentence is kept"); assert.equal(acct.prep["Side Control|Top"], 1, "the practice still joined");
  assert.deepEqual(h.said, [LINE], "nothing else was said");
});

// ── ORDER1 (the orchestrator's blocking read of a0a8c6cfd): the rule must hold against the CLOUD's rows ─────────────────
// The join ran in `_applyUser`, BEFORE the first pull, so `ngProgressGuestMoves` protected only the rows of the LOCAL
// account copy. On a browser that copy has never (or not lately) seen, a guest's later or same-day "No" went into the
// account's local copy unprotected, then beat the cloud's "Yes" in the pull's own order (later `last`; a same-day tie
// to the No) and was pushed. These tests run the real order: mount, `_applyUser`, the first pull, what is pushed, and a
// second device's pull of it.
const envelope = (owner, blob) => JSON.stringify({ format: "bjj-progress-owner-v1", owner, blob, savedAt: 1 });
const P = "76/top", X = "307", CLOUD_YES = [DAY + 5, 7, DAY - 2, 1];
const ORDER_CASES = [
  { name: "an empty local copy, the guest's No two days after the cloud's Yes", local: null, guest: [DAY + 1, 1, DAY, 0] },
  { name: "an empty local copy, the guest's No on the cloud's own day (the tie goes to the No)", local: null, guest: [DAY - 1, 1, DAY - 2, 0] },
  { name: "a stale local copy (an older Yes), the guest's No later", local: [DAY - 4, 3, DAY - 7, 1], guest: [DAY + 1, 1, DAY, 0] },
  { name: "a stale local copy (an older No), the guest's No later", local: [DAY - 6, 1, DAY - 7, 0], guest: [DAY + 1, 1, DAY, 0] },
];

test("11. ORDER1: a guest's later No never beats a Yes the CLOUD holds (join, pull, push, a second device's pull)", async () => {
  for (const c of ORDER_CASES) {
    const cloud = new Map([["A", { v: 2, moves: { [P]: { [X]: CLOUD_YES } } }]]);
    const h = harness(memory(), cloud);
    if (c.local) h.mem.setItem(M.ngProgressLocalKey(A), envelope(A, { v: 2, moves: { [P]: { [X]: c.local } } }));
    await h.boot();
    const g = h.get(); g.moves = { [P]: { [X]: c.guest } }; g.prep["Mount|Top"] = 2; g._flushSave();
    const a = await h.signIn("A");
    assert.equal(a.prep["Mount|Top"], 2, c.name + ": the guest's practice joined");
    assert.equal(a.moves[P][X][3], 1, c.name + ": the account still knows the move");
    const pushed = h.host.cloudSnapshot(a);                       // exactly what `_pushCloud` sends
    assert.equal(pushed.moves[P][X][3], 1, c.name + ": what is pushed still knows the move");
    // another device of the same account, holding the cloud's Yes, pulls what this one pushed
    cloud.set("A", clone(pushed));
    const d2 = harness(memory(), cloud);
    d2.mem.setItem(M.ngProgressLocalKey(A), envelope(A, { v: 2, moves: { [P]: { [X]: CLOUD_YES } } }));
    d2.setIdentity({ id: "A", email: "player@example.com" }); await d2.boot();
    const b = d2.get(); b._applyUser({ id: "A", email: "player@example.com" }); assert.equal(await b._pullAndMerge(), true);
    assert.equal(b.moves[P][X][3], 1, c.name + ": the second device still knows the move");
    assert.equal(b.prep["Mount|Top"], 2, c.name + ": and holds the joined practice");
  }
});

test("12. ORDER1: a failed or offline first pull joins nothing, marks nothing and pushes nothing of the guest's; the next successful pull joins", async () => {
  const cloud = new Map([["A", { v: 2, moves: { [P]: { [X]: CLOUD_YES } } }]]);
  const h = harness(memory(), cloud);
  await h.boot();
  const g = h.get(); g.moves = { [P]: { [X]: [DAY + 1, 1, DAY, 0] } }; g.prep["Mount|Top"] = 2; g._flushSave();
  const pull = h.facade.pullNeural; h.facade.pullNeural = async () => { throw new Error("offline"); };
  const a = await h.signIn("A");
  assert.equal(a._pulled, false, "the pull failed");
  assert.equal(a.prep["Mount|Top"], undefined, "nothing of the guest's joined before a pull succeeded");
  assert.equal(a.moves[P] && a.moves[P][X], undefined, "the guest's No is not in the account's copy");
  assert.equal(h.mem.rows.get(markOf(A)), undefined, "nothing is marked");
  assert.deepEqual(h.said, [], "nothing is said");
  assert.deepEqual(cloud.get("A"), { v: 2, moves: { [P]: { [X]: CLOUD_YES } } }, "nothing reached the cloud");
  assert.deepEqual(h.host.joinGuest(a), { status: "unavailable", reason: "not-pulled" }, "the host itself refuses an account that has not pulled");
  h.facade.pullNeural = pull;                                  // back online: the next pull succeeds
  assert.equal(await a._pullAndMerge(), true);
  assert.equal(a.prep["Mount|Top"], 2, "the join runs after the first successful pull");
  assert.equal(a.moves[P][X][3], 1, "against the cloud's Yes");
  assert.deepEqual(h.said, [LINE], "and says the line");
  assert.ok(h.mem.rows.get(markOf(A)), "and marks the guest copy");
});

test("13. ORDER1, srs: a guest's later miss meeting a cloud row the local copy lacked lowers no figure (the card may come due sooner)", async () => {
  const dk = "Mount|Top", q = "q-cloud";
  const CLOUD = { v: 2, stage: { [dk]: { [q]: 3 } }, rec: { [dk]: 3 }, prep: { [dk]: 4 }, srs: { [dk]: { [q]: [DAY + 7, 10, DAY - 3] } } };
  const cloud = new Map([["A", CLOUD]]);
  const h = harness(memory(), cloud);
  await h.boot();
  const g = h.get(); g.stage = { [dk]: { [q]: 1 } }; g.srs = { [dk]: { [q]: [DAY + 1, 1, DAY] } }; g.prep[dk] = 1; g.prep["Side Control|Top"] = 1; g._flushSave();
  const a = await h.signIn("A");
  assert.equal(a.stage[dk][q], 3, "the card's stage keeps the cloud's 3 (MAX): its deck's mastery does not drop");
  assert.equal(a.rec[dk], 3, "recall proof kept"); assert.equal(a.prep[dk], 4, "the deck's answer count kept (MAX)");
  assert.ok(a.practiceToday().done >= 0 + (a.srs[dk][q][2] === DAY ? 1 : 0), "today's count is a union: it can only rise");
  // STATED, not hidden: the schedule follows the pull's rule, so the guest's later miss brings the card back sooner
  assert.deepEqual(a.srs[dk][q], [DAY + 1, 1, DAY], "the later review's schedule wins: due again tomorrow, not in a week");
});

// ── REVIEW375 (the second reader of PR #375): the missing tests it named, and the two rules it asked for ─────────────────
const wait = (ms) => new Promise((r) => setTimeout(r, ms));          // `_pushCloud` pushes 500 ms after a save

test("14. REVIEW375 M1, figures on the real wire: a returning player's known moves and boost survive a guest's later No (both rulesets)", async () => {
  for (const mode of ["gi", "nogi"]) {
    const probe = wireBoot({ v: 2 }, mode), mount = probe.nodes.find((n) => n.id === "Positions/Mount");
    const st = probe._ordById.get(probe.siteIdOf(mount.id)) + "/top", dealt = probe._dealtOrds(mount.idx, "top"), key = probe.posFamily(mount.t) + "|Top";
    assert.ok(dealt.length > 5, mode + ": Mount/top deals a hand (" + dealt.length + ")");
    const yesAll = { [st]: Object.fromEntries(dealt.map((d) => [d, [DAY + 7, 7, DAY - 5, 1]])) };
    const noAll = { [st]: Object.fromEntries(dealt.map((d) => [d, [DAY + 1, 1, DAY - 1, 0]])) };
    const look = (moves) => { probe._hydrateProgressBlob({ v: 2, moves: clone(moves) }); const l = probe._movesKnownLine(); return { known: l && l.known, boost: probe.mastery(key) }; };
    const before = look(yesAll);
    assert.ok(before.known >= dealt.length && before.boost > 0, mode + ": the account knows the seat: " + JSON.stringify(before));
    const cloud = new Map([["A", { v: 2, moves: yesAll }]]);
    const h = harness(memory(), cloud);                                // a new phone: no account copy here
    await h.boot();
    const g = h.get(); g.moves = clone(noAll); g._flushSave();
    const a = await h.signIn("A");
    const after = look(h.host.cloudSnapshot(a).moves);                // exactly what is pushed
    assert.deepEqual(after, before, mode + ": Moves known and the deck boost are the account's own after join, pull and push");
  }
});

// minted roll-ledger ids (v1.262.11, `b` + 16 hex): the cap counts only these (progress-owner `ngFlowCapped`)
const ID = (i) => "b" + i.toString(16).padStart(16, "0"), GID = ID(0xfeed);

test("15. REVIEW375 F1 + FOLD2: the guest's roll ledger never evicts the account's and is never counted twice (at the cap it is not joined; below it, it joins as itself)", async () => {
  // v1.262.11 (FLOW2): the cap is 32 (was 6) and counts only partitions minted since then (`b` + 16 hex; an older id
  // joins outside it), so the fixtures use minted ids and the cap itself, and the claims are unchanged
  const CAP = M.Component.prototype.NG_FLOW_DEVICES;
  assert.equal(CAP, 32, "the rule's default cap is the app's NG_FLOW_DEVICES (NG_FLOW_CAP)");
  const rolls = (flow) => { let n = 0; for (const d in flow || {}) for (const pk in flow[d]) for (const o in flow[d][pk]) n += flow[d][pk][o][0]; return n; };
  const devices = (k) => Object.fromEntries(Array.from({ length: k }, (_, i) => [ID(i), { "Mount|Top": { "17": [10, 5, DAY - 10 - i] } }]));
  for (const k of [CAP, 2]) {                                           // at the cap, and with room
    const cloud = new Map([["A", { v: 2, flow: devices(k), prep: { "Side Control|Top": 1 } }]]);
    const h = harness(memory(), cloud);
    await h.boot();
    const g = h.get(); g.flow = { [GID]: { "Mount|Top": { "17": [3, 1, DAY], "23": [2, 2, DAY] } } }; g.prep["Mount|Top"] = 1; g._flushSave();
    const a = await h.signIn("A"), joined = h.host.cloudSnapshot(a).flow;
    for (let i = 0; i < k; i++) assert.deepEqual(joined[ID(i)], devices(k)[ID(i)], "k=" + k + ": the account's partition " + ID(i) + " is kept, unchanged");
    assert.ok(Object.keys(joined).length <= CAP, "k=" + k + ": within the cap");
    if (k === CAP) {
      assert.equal(joined[GID], undefined, "at the cap the guest's partition is not joined");
      assert.equal(rolls(joined), CAP * 10, "the account's " + CAP * 10 + " rolls stay, and the guest's are not counted (an undercount, never a double)");
    } else {
      assert.deepEqual(joined[GID], { "Mount|Top": { "17": [3, 1, DAY], "23": [2, 2, DAY] } }, "below the cap it joins as itself");
      assert.equal(rolls(joined), 20 + 5, "and the totals add exactly");
    }
    cloud.set("A", clone(h.host.cloudSnapshot(a)));                   // what was pushed
    // THE READER'S CASE: between two joins another device of the account rolls today, so the newest partition changes
    cloud.get("A").flow[ID(1)]["Mount|Top"]["17"] = [11, 6, DAY];
    h.mem.rows.delete(markOf(A)); h.signOut(); const b = await h.signIn("A");
    const again = h.host.cloudSnapshot(b).flow;
    assert.equal(rolls(again), rolls(joined) + 1, "k=" + k + ": a re-join adds only the other device's one new roll, never the guest's again");
    assert.ok(!again[GID] || JSON.stringify(again[GID]) === JSON.stringify(joined[GID]), "k=" + k + ": the guest's partition, if joined, is itself, once");
  }
});

test("16. REVIEW375 F2: a re-join with the mark lost (and with this browser's account copy lost too) changes no figure and pushes nothing new", async () => {
  const cloud = new Map([["A", { v: 2, prep: { "Side Control|Top": 6 }, rec: { "Side Control|Top": 4 }, days: { "2026-11-10": 3 } }]]);
  const h = harness(memory(), cloud);
  await h.boot();
  const g = h.get(); Object.assign(g.prep, { "Mount|Top": 4, "Closed Guard|Bottom": 2 }); g.rec = { "Mount|Top": 3 };
  g.flow = { dGUEST: { "Mount|Top": { "17": [5, 2, DAY - 1] } } }; g.lists = { gl: { name: "Guest", t: 5, items: ["Positions/Mount"] } }; g._flushSave();
  await h.signIn("A"); await wait(700);
  const figures = () => { const c = cloud.get("A"); return JSON.stringify({ prep: c.prep, rec: c.rec, days: c.days, flow: c.flow, lists: Object.keys(c.lists || {}) }); };
  const first = figures(), pushes = h.pushes.length;
  assert.equal(h.said.length, 1); assert.ok(pushes >= 1, "the join was pushed");
  for (const lose of [[markOf(A)], [markOf(A), M.ngProgressLocalKey(A)]]) {
    h.signOut(); for (const k of lose) h.mem.rows.delete(k);
    await h.signIn("A"); await wait(700);
    assert.equal(figures(), first, "lost " + lose.length + " key(s): every figure is the same");
  }
  assert.equal(h.said.length, 1, "the line is not said again (the account already holds the practice after the pull)");
  assert.equal(h.pushes.length, pushes, "nothing new is pushed");
});

test("17. REVIEW375 F3: an existing player restored at boot joins an unjoined guest copy once, and the next visit is silent", async () => {
  const mem = memory(), cloud = new Map([["A", { v: 2, prep: { "Side Control|Top": 6 }, settings: { emailMarketing: false }, settingsAt: { emailMarketing: 1 } }]]);
  mem.setItem(guestKey, envelope(GUEST, { v: 2, prep: { "Mount|Top": 4 } }));
  mem.setItem(M.ngProgressLocalKey(A), envelope(A, { v: 2, prep: { "Side Control|Top": 6 } }));
  const visit = async () => { const h = harness(mem, cloud); h.setIdentity({ id: "A", email: "player@example.com" }); await h.boot(); await h.get()._initAuth(); await wait(700); return h; };
  const first = await visit();
  assert.equal(cloud.get("A").prep["Mount|Top"], 4, "the guest practice reached the account (and the cloud)");
  assert.equal(cloud.get("A").settings.emailMarketing, false, "the account's consent stays");
  assert.deepEqual(first.said, [LINE], "the line, once"); assert.ok(mem.getItem(markOf(A)), "marked");
  const second = await visit();
  assert.deepEqual(second.said, [], "the next visit says nothing"); assert.equal(second.pushes.length, 0, "and pushes nothing");
});

test("18. REVIEW375 F5: the data layer's explicit legacy import goes through the same rule (a legacy No never takes the cloud's Yes; consent stays); the guest kind is gone", async () => {
  const cloud = new Map([["A", { v: 2, moves: { [P]: { [X]: CLOUD_YES } }, settings: { emailMarketing: false }, settingsAt: { emailMarketing: 1 } }]]);
  const h = harness(memory(), cloud);
  h.mem.setItem(guestKey, envelope(GUEST, { v: 2 }));                // an empty guest copy: the legacy copy is not adopted
  h.mem.setItem("bjj-neural-progress", JSON.stringify({ v: 2, prep: { "Mount|Top": 5 }, moves: { [P]: { [X]: [DAY + 1, 1, DAY, 0] } }, settings: { emailMarketing: true }, settingsAt: { emailMarketing: 9e12 } }));
  await h.boot();
  // like the join, the import needs the account's first pull: before it, it is refused
  h.setIdentity({ id: "A", email: "player@example.com" }); h.get()._applyUser({ id: "A", email: "player@example.com" });
  const early = h.get(); early._applyUser({ id: "A", email: "player@example.com" });
  assert.deepEqual(h.host.confirmImport(early, h.host.previewImport(early, "legacy")), { status: "unavailable", reason: "not-pulled" }, "no import before the pull");
  assert.equal(await early._pullAndMerge(), true);
  const a = h.get();
  assert.deepEqual(h.host.previewImport(a, "guest"), { status: "unavailable", reason: "unsupported-import-source" }, "the guest kind is gone");
  const preview = h.host.previewImport(a, "legacy"); assert.equal(preview.status, "preview");
  assert.equal(h.host.confirmImport(a, preview).status, "ready");
  const b = h.get();
  assert.equal(b.prep["Mount|Top"], 5, "the legacy practice joined");
  assert.equal(b.moves[P][X][3], 1, "the cloud's Yes stands against the legacy copy's later No");
  assert.equal(b.settings.emailMarketing, false, "consent stays the account's");
});

test("19. FOLD2 (the reader's adv_5_fold): at the ledger cap, whatever becomes the newest partition between two joins, the guest's rolls are never counted twice", async () => {
  const tally = (flow, pk, o) => { let n = 0, k = 0; for (const d in flow || {}) { const r = flow[d] && flow[d][pk] && flow[d][pk][o]; if (r) { n += r[0]; k += r[1]; } } return [n, k]; };
  const CAP = M.Component.prototype.NG_FLOW_DEVICES;   // v1.262.11: 32, and minted ids (see 15)
  const full = () => { const f = {}; for (let i = 0; i < CAP; i++) f[ID(i)] = { "Side|Top": { "9": [10, 5, DAY - 20 + (i === 0 ? 10 : 0) - i] } }; return f; };   // ID(0) newest
  const G1 = { v: 2, prep: { "Mount|Top": 1 }, flow: { [GID]: { "Mount|Top": { "17": [5, 2, DAY - 1] } } }, settings: { flowDevice: "dG" }, settingsAt: { flowDevice: 1 } };
  const G2flow = { [GID]: { "Mount|Top": { "17": [6, 2, DAY] } } };       // the guest played once more
  const cases = [
    { name: "A: another device becomes the newest; the guest plays once more", playMore: true },
    { name: "B: another device becomes the newest; the mark is lost (the same guest copy)", playMore: false },
  ];
  for (const c of cases) {
    const mem = memory(); mem.setItem(guestKey, envelope(GUEST, G1));
    const cloud = new Map([["A", { v: 2, flow: full(), prep: { "Side|Top": 3 } }]]);
    const h = harness(mem, cloud);
    await h.boot(); await h.signIn("A"); await wait(700);
    const t1 = tally(cloud.get("A").flow, "Mount|Top", "17");
    cloud.get("A").flow[ID(3)]["Side|Top"]["9"] = [11, 6, DAY];          // another device rolls today: it becomes the newest
    h.signOut();
    if (c.playMore) { const g = h.get(); g.flow = clone(G2flow); g._flowVer = (g._flowVer || 0) + 1; g._flushSave(); }
    else h.mem.rows.delete(markOf(A));
    await h.signIn("A"); await wait(700);
    const flow = cloud.get("A").flow, t2 = tally(flow, "Mount|Top", "17"), real = (c.playMore ? G2flow : G1.flow)[GID]["Mount|Top"]["17"];
    assert.ok(t1[0] <= 5 && t2[0] <= real[0], c.name + ": the guest's " + real[0] + " real rolls read " + t2[0] + " (after join 1: " + t1[0] + "): never more");
    for (let i = 0; i < CAP; i++) assert.ok(flow[ID(i)], c.name + ": the account's partition " + ID(i) + " is kept");
    assert.deepEqual(flow[ID(3)]["Side|Top"]["9"], [11, 6, DAY], c.name + ": the other device's tally is not lowered");
    assert.equal(h.said.length, 1, c.name + ": the line is said once (join 1 brought the guest's answers)");
  }
});

// ── 20-21. THE OPEN RULE'S VALUES (v1.270.0, U163 c): `openAt` and `recallCarry` at the join ──────────────────────────────
// PR #404's first build added `openAt` to every blob that saves and missed it in `ngProgressPracticeKey`, so a guest who
// only looked read as having practised and every new account was told its practice was saved (its CI: guest-join.spec.ts).
// This file's bare landing (3) was written by hand, so it could not see a key the build adds: 20 builds the copy through
// the app's own belt sync and save, so the next key a bare landing writes fails here, not in CI.
// Mutants: OPEN-M15 (the guest part keeps `openAt`) -> 20 "says nothing", 21 "stays its own"; OPEN-M16 (the guest part
// drops `recallCarry`) -> 21 "the guest's carry joins". Not built: the practice key keeping `recallCarry` (it implies
// `belts.held`, which counts as practice on its own, so no guest copy holds it alone).
test("20. a guest who only looked, as THIS build writes the copy (the app's own belt sync and save), joins nothing and says nothing", async () => {
  const h = harness(); await h.boot();
  const g = h.get();
  // the curriculum and the deck manifest land: the app's own belt sync writes what a bare landing writes
  g.curriculum = { belts: [{ id: "white", units: [] }] }; g.flashcards = { decks: clone(DECKS), manifest: true };
  g._syncBelt("curriculum");
  Object.assign(g, { _exploredKeys: new Set(TRAIL.explored), tut: clone(TRAIL.tut), challenges: clone(TRAIL.challenges) });
  g._flushSave();
  const copy = h.host.store.read(GUEST).blob;
  assert.ok(copy.openAt > 0 && copy.belts.gf > 0, "precondition: this build's bare landing writes the open rule's stamp and the grandfather's mark");
  await h.signIn("A");
  assert.deepEqual(h.said, [], "OPEN-M15: a bare visit's copy, as this build writes it, says nothing");
  assert.equal((accountBlob(h, A) || {}).openAt, undefined, "and the guest's stamp does not join: the account stamps its own");
});

// 21 until OPEN3 asserted "the account's stamp stays its own (a guest's earlier one neither lowers nor seeds it)" and "nor is
// a guest's stamp pushed": OPEN2B dropped the guest's `openAt` from the merge, and the guest's belt joined (MAX) only to be
// judged against the account's later or fresh stamp, so a guest who EARNED blue under the guest's own rule got timed recall
// switched on at sign-in (the delta read of PR #404, D1). The stamp now joins the merge as the EARLIER of the two; R1, R1b
// and R3 below pin what that decides. Mutants: OPEN-M17 (the guest merge without the stamp, OPEN2B's code) -> 21 and R1,
// R1b; OPEN-M18 (no freeze of the account's own carry before the join) -> R3.
test("21. at a join, the earlier open-rule stamp joins, and a guest's carried belt brings its carry", async () => {
  const guest = { v: 2, prep: { "Mount|Top": 1 }, openAt: 1000, recallCarry: true, belts: { won: {}, gf: 5, held: { id: "blue", t: 500 } } };
  for (const [name, accountStamp] of [["an account that ran the rule later", 9000], ["an account that never ran it", undefined]]) {
    const mem = memory(); mem.setItem(guestKey, envelope(GUEST, guest));
    const cloud = new Map([["A", { v: 2, prep: { "Side|Top": 3 }, belts: { won: {}, gf: 5 }, ...(accountStamp ? { openAt: accountStamp } : {}) }]]);
    const h = harness(mem, cloud); await h.boot(); await h.signIn("A"); await wait(700);
    const acc = accountBlob(h, A);
    assert.deepEqual(h.said, [LINE], name + ": real practice joins");
    assert.equal(acc.openAt, 1000, name + ": OPEN-M17: the earlier stamp joins (the guest's)");
    assert.equal(acc.recallCarry, true, name + ": OPEN-M16: the guest's carry joins with the belt it came from");
    assert.equal(acc.belts.held.id, "blue", name + ": and that belt joins (MAX)");
  }
});

// the app's own belt sync on the mounted instance (the harness stubs `_publishKnowledge`, so call it as the curriculum landing
// does), and what the player gets
const BELT_CUR = () => ({ belts: ["white", "blue", "purple", "brown", "black"].map((id) => ({ id, name: id, units: [{ id: "u1", lessons: [{ nodeId: "T/" + id, deckKey: id + "-a|Attacker" }], checkpoint: { cards: 2, pass: 2 } }] })), weights: {} });
const beltSync = (a) => { a.curriculum = BELT_CUR(); a.flashcards = { decks: clone(DECKS), manifest: true }; a._syncBelt("curriculum"); return a; };
const plays = (a) => ({ play: a._recallInPlayNow(), fact: a._recallCarry === true });

test("R1. a guest who EARNED blue under the guest's own rule gets no timed recall at sign-in (an account that never ran the rule)", async () => {
  const guest = { v: 2, prep: { "Mount|Top": 3 }, openAt: 1000, belts: { won: {}, gf: 5, held: { id: "blue", t: 2000 } } };
  const mem = memory(); mem.setItem(guestKey, envelope(GUEST, guest));
  const h = harness(mem, new Map([["A", { v: 2, prep: { "Side|Top": 3 }, belts: { won: {}, gf: 5 } }]])); await h.boot();
  assert.deepEqual(plays(beltSync(h.get())), { play: false, fact: false }, "precondition: multiple choice as a guest");
  await h.signIn("A"); await wait(700);
  const a = beltSync(h.get());
  assert.equal(a.belts.held.id, "blue", "the guest's belt joined");
  assert.deepEqual(plays(a), { play: false, fact: false }, "OPEN-M17: nothing is switched on behind the player's back at sign-in");
  assert.equal(a._openAt, 1000, "judged against the guest's earlier stamp");
});

test("R1b. the same guest, an account that ran the rule later (after the guest's blue): no timed recall either", async () => {
  const guest = { v: 2, prep: { "Mount|Top": 3 }, openAt: 1000, belts: { won: {}, gf: 5, held: { id: "blue", t: 2000 } } };
  const mem = memory(); mem.setItem(guestKey, envelope(GUEST, guest));
  const h = harness(mem, new Map([["A", { v: 2, prep: { "Side|Top": 3 }, openAt: 9000, belts: { won: {}, gf: 5 } }]])); await h.boot();
  await h.signIn("A"); await wait(700);
  assert.deepEqual(plays(beltSync(h.get())), { play: false, fact: false }, "OPEN-M17: the account's later stamp does not carry the guest's post-rule blue");
});

test("R3. the account's own pre-rule blue stays carried when a guest's earlier stamp joins before any belt sync", async () => {
  const guest = { v: 2, prep: { "Mount|Top": 3 }, openAt: 1000, belts: { won: {}, gf: 5 } };
  const mem = memory(); mem.setItem(guestKey, envelope(GUEST, guest));
  // the account's blue at 5000, never seen by a device running the rule (no `openAt`, no fact on the cloud)
  const h = harness(mem, new Map([["A", { v: 2, prep: { "Side|Top": 3 }, belts: { won: {}, gf: 5, held: { id: "blue", t: 5000 } } }]])); await h.boot();
  await h.signIn("A"); await wait(700);   // no belt sync between the pull and the join: the curriculum is still in flight
  const a = beltSync(h.get());
  assert.equal(a._openAt, 1000, "precondition: the guest's earlier stamp joined, earlier than the account's blue");
  assert.deepEqual(plays(a), { play: true, fact: true }, "OPEN-M18: the account's own carry was frozen before the join");
});
