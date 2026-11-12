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
// MUTANTS (2026-11-12, each run against this green file; every one turned the tests named red):
//   ngProgressGuestMoves returns `merged` unchanged                    → 2 (known moves never drop)
//   ngProgressGuestPart keeps `settings`                              → 1, 7
//   ngProgressPracticeKey counts the trail (= the cloud key)           → 3
//   NG_PROGRESS_TRAIL_CHALLENGES loses "white.coach3"                  → 3, 4
//   joinGuest writes no mark                                          → 5
//   the mark compared by presence, not by the copy's hash (`if (seen)`) → 6, 10
//   joinGuest also writes the joined blob back to the guest copy        → 5, 7
//   the mark kept per browser, not per account                        → 8 (the owner's pick: a second account receives)
//   joinGuest without its refusal of an unverified (local-only) account → 9
//   the join also run at mount (`_loadProgress`), the host's refusal kept → 10 (the line is said at mount, before a
//     shared link's sentence is held). Joining an UNVERIFIED account this way is still stopped by that refusal, a
//     second guard: the mutant above removes it.
//   the mark written before the account's copy is saved               → 9 (storage full: "nothing marked")
//   the line overwrites a held arrival sentence                        → 10
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
function harness(mem = memory()) {
  let current, identity = null;
  const facade = { resolveNeuralUser: async () => identity, neuralSyncVersion: 2, isAuthenticated: () => true, pullNeural: async (id) => ({ userId: id, blob: null }), pushNeural: async () => true };
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
  // a verified sign-in, as the facade's SIGNED_IN reaches the app: the outgoing instance switches, the new one applies
  const signIn = (id) => { identity = { id, email: "player@example.com" }; get()._applyUser(identity); get()._applyUser(identity); return get(); };
  const signOut = () => { identity = null; get()._clearAuthUser(); return get(); };
  const practise = (patch) => { const g = get(); Object.assign(g.prep, patch.prep || {}); if (patch.lists) g.lists = { ...g.lists, ...patch.lists }; g._flushSave(); };
  return { mem, host, facade, get, signIn, signOut, practise, said, setIdentity: (u) => { identity = u; }, boot: () => host.bootstrap() };
}
const accountBlob = (h, o) => h.host.store.read(o).blob;
// the trail a bare guest landing leaves, measured in the built app on 11 Nov (no answer, no roll)
const TRAIL = { explored: ["Positions/Mount"], tut: { done: { coach3: 1 } }, challenges: { "white.coach3": { progress: 1, done: true, t: 1794440051811 } }, belts: { won: {}, gf: 1794440051576 } };

test("3. an empty guest copy, or one holding only a bare visit's trail, joins nothing and says nothing", async () => {
  const h = harness(); await h.boot();
  h.signIn("A");
  assert.ok(h.mem.rows.has(guestKey), "the sign-in itself wrote a guest copy, which is why every player saw the old row");
  assert.deepEqual(h.said, [], "an empty guest copy says nothing");
  // a guest who only looked: visited a state and met the first coach step
  const g = h.signOut(); Object.assign(g, { _exploredKeys: new Set(TRAIL.explored), tut: TRAIL.tut, challenges: TRAIL.challenges, belts: TRAIL.belts }); g._flushSave();
  const a = h.signIn("A");
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
  h.signIn("A");
  assert.equal(accountBlob(h, A).prep["Mount|Top"], 1, "one answer is practice");
  assert.equal(accountBlob(h, A).challenges["white.coach3"].done, true, "and the trail rides along with it");
  assert.deepEqual(h.said, [LINE]);
});

test("5. nothing is added twice: the per-account mark keeps a deleted list deleted and the line unsaid", async () => {
  const h = harness(); await h.boot();
  h.practise({ prep: { "Mount|Top": 3 }, lists: { g1: { name: "Guest list", t: 1762000000000, items: ["Positions/Mount"] } } });
  let a = h.signIn("A");
  assert.equal(accountBlob(h, A).lists.g1.name, "Guest list"); assert.deepEqual(h.said, [LINE]);
  delete a.lists.g1; a._flushSave();                       // the player deletes the list the guest copy brought
  h.signOut(); a = h.signIn("A");
  assert.equal(accountBlob(h, A).lists.g1, undefined, "the same guest copy is never joined again (lists add, so it would come back)");
  assert.deepEqual(h.said, [LINE], "and the line is said once");
});

test("6. practice done signed out later joins at the next sign-in", async () => {
  const h = harness(); await h.boot();
  h.practise({ prep: { "Mount|Top": 3 } }); h.signIn("A");
  h.signOut(); h.practise({ prep: { "Side Control|Top": 2 } });
  h.signIn("A");
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
  h.signIn("A");
  assert.ok(raw, "the join ran"); assert.equal(h.mem.rows.get(guestKey), raw, "the guest copy is byte for byte what it was");
  assert.equal(accountBlob(h, A).prep["Mount|Top"], 4);
  assert.deepEqual(accountBlob(h, A).settings, { emailMarketing: false, dailyGoal: 20 }, "consent and goal stay the account's");
  assert.equal(h.signOut().prep["Mount|Top"], 4, "signing out still plays the guest copy");
});

test("8. a second account signing in on the same browser receives the guest practice too (owner U138 a, 11 Nov: his pick, not a leak to fix)", async () => {
  const h = harness(); await h.boot();
  h.practise({ prep: { "Mount|Top": 3 } });
  h.signIn("A").prep["A|Top"] = 5; h.get()._flushSave();
  h.signOut(); h.signIn("B");
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
  assert.equal(h.host.joinGuest(a).status, "unavailable", "the host refuses it outright");
  // verified again: now it joins
  h.facade.resolveNeuralUser = async () => ({ id: "A", email: "player@example.com" }); await a._initAuth();
  assert.equal(h.get().prep["Mount|Top"], 3, "the verified sign-in joins"); assert.deepEqual(h.said, [LINE]);
  // (b) the account's copy cannot be written (storage full): nothing joins, nothing is marked, nothing is said
  const full = harness(memory((k) => k === M.ngProgressLocalKey(A))); await full.boot();
  full.practise({ prep: { "Mount|Top": 3 } }); full.signIn("A");
  assert.equal(full.get().prep["Mount|Top"], undefined, "nothing joined"); assert.equal(full.mem.rows.get(markOf(A)), undefined, "nothing marked");
  assert.deepEqual(full.said, [], "nothing said");
});

test("10. the line: its words, held for the landing, once; it never overwrites another held sentence", async () => {
  const h = harness(); await h.boot();
  h.practise({ prep: { "Mount|Top": 3 } });
  const a = h.signIn("A"), u = { id: "A", email: "player@example.com" };
  assert.deepEqual(h.said, [LINE]);
  assert.deepEqual([a._arrivalSay.k, a._arrivalSay.t, a._arrivalSay.whole], ["", LINE, true], "held for the landing: no kicker, printed whole");
  // new guest practice, and a shared link's sentence already held when the account mounts: the join stays silent
  h.signOut(); h.practise({ prep: { "Side Control|Top": 1 } });
  const keep = { k: "Shared list", t: "A coach's class", tone: "good" };
  h.setIdentity(u); h.get()._applyUser(u);              // the guest instance switches; the account instance mounts
  const acct = h.get(); acct._arrivalSay = keep; acct._applyUser(u);
  assert.equal(acct._arrivalSay, keep, "the held sentence is kept"); assert.equal(acct.prep["Side Control|Top"], 1, "the practice still joined");
  assert.deepEqual(h.said, [LINE], "nothing else was said");
});
