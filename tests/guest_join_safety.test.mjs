// GUEST PRACTICE AT SIGN-IN ONLY ADDS (guestprog, 2026-11-11). The owner's two lines for any change here: no player loses
// progress on any path (a merge never lowers a figure, a boost, a gold mark or a belt), and he picks from real screens.
// The variants a/b/c (progress-owner.src.js `guestOffer` / `acceptGuest` / `declineGuest`, app.src.jsx
// `_joinGuestPractice`) all add a guest copy to an account through ONE rule, `ngProgressGuestMerge`. These tests drive
// the REAL class with the bundle's prelude, as tests/moves_account_safety.test.mjs does, and claim:
//   1. FIGURES NEVER DROP, synthetic decks: over seeded random accounts and guest copies, every figure the account shows
//      (each deck's mastery, deckMastery and odds bonus, "Mastered N · X%", today's Practice count, the worn belt, every
//      challenge's progress, badges, coins, list items) is at least the account's AND at least the guest's.
//   2. KNOWN MOVES NEVER DROP, the real wire, both rulesets: a known move of the account stays known, every deck's
//      `mastery(key)` (the boost) and the "Moves known" line are at least the account's, and a guest's known move is
//      added unless the account's own answer on that move is the later one (then the account's answer stands, as on
//      its own two devices). CONTROL: today's Import (the pull's merge, unchanged) lowers known moves on some of the
//      same accounts: the count is asserted non-zero, so the guard is not decoration.
//   3. THE HOST: an empty guest copy (every sign-in writes one) offers nothing; a practised one is offered once,
//      taken or declined once; the guest copy stays byte for byte; account settings and email consent stay the
//      account's; an offer cannot cross an account switch; "another account in this browser" is read from storage.
//   4. THE VARIANTS through `_applyUser`: today does nothing at sign-in; a adds and says one line; b asks; c adds on a
//      one-account browser and asks on a browser another account has used.
// MUTANTS (2026-11-11, each turned the named test red):
//   ngProgressGuestMoves returns `merged` unchanged          → 2 (known moves never drop: the account side)
//   ngProgressGuestPart keeps `settings`                    → 3 (settings and consent stay the account's)
//   guestOffer skips the "adds nothing" check               → 3 (an empty guest copy offers nothing)
//   acceptGuest does not write the marker                   → 3 (offered once)
//   otherAccount ignores other accounts' keys               → 4 (c asks on a shared browser)
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
const M = new Function("DCLogic", "React", SOURCE + "\nreturn { Component, ngProgressGuestMerge, ngProgressCreateHost, ngProgressOwner, ngProgressLocalKey, ngBeltRank };")(class DCLogic {}, { createRef: () => ({ current: null }) });

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

// ── 3 & 4. the host, and the variants through the real sign-in path ───────────────────────────────────────────────────
function memory() { const rows = new Map(); return { rows, getItem: (k) => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, String(v)), keys: () => [...rows.keys()] }; }
function harness(mem = memory()) {
  let current, identity = null;
  const facade = { resolveNeuralUser: async () => identity, neuralSyncVersion: 2, isAuthenticated: () => true, pullNeural: async (id) => ({ userId: id, blob: null }), pushNeural: async () => true };
  const host = M.ngProgressCreateHost({ storage: mem, resolveUser: () => facade.resolveNeuralUser(), hold: () => {}, mount(b) {
    const inst = new M.Component({}); current = inst; host.bind(inst, b);
    inst._publishKnowledge = () => {}; inst._applyLayers = () => {}; inst._refreshChallengeEvidence = () => {}; inst.updateAccountUI = () => {}; inst.track = () => {}; inst.fx = () => {};
    inst._auth = () => facade; inst.isTest = () => true;
    inst.destroy = () => { if (inst.__ngDestroyed) return; inst.__ngDestroyed = true; inst._authDisposed = true; inst._invalidateCloudSync(); };
    inst._loadProgress();
  } });
  const get = () => current;
  const signIn = (id) => { identity = { id, email: "player@example.com" }; get()._applyUser(identity); get()._applyUser(identity); return get(); };
  const signOut = () => { identity = null; get()._clearAuthUser(); return get(); };
  return { mem, host, get, signIn, signOut, boot: () => host.bootstrap() };
}
const guestKey = M.ngProgressLocalKey(M.ngProgressOwner(), "progress");
function withVariant(v, run) {
  const had = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  globalThis.localStorage = { getItem: (k) => (k === "bjj-guestprog-variant" ? v : null), setItem() {}, removeItem() {} };
  try { return run(); } finally { if (had) Object.defineProperty(globalThis, "localStorage", had); else delete globalThis.localStorage; }
}
function withModal(inst) {
  const el = (tag) => ({ tag, children: [], attrs: {}, style: {}, textContent: "", listeners: {}, setAttribute(k, v) { this.attrs[k] = v; }, append(...x) { this.children.push(...x); }, appendChild(x) { this.children.push(x); }, addEventListener(t, f) { this.listeners[t] = f; }, set innerHTML(_v) { this.children = []; } });
  globalThis.document = { createElement: el };
  inst.modalCardRef.current = el("div"); inst._modalOpen = 0; inst.openModal = () => { inst._modalOpen++; }; inst.closeModal = () => {};
  return () => inst.modalCardRef.current.children[0];
}

test("3. the host: an empty guest copy offers nothing; a practised one is offered once; the guest copy and the account's settings stay", async () => {
  const h = harness(); await h.boot();
  let a = h.signIn("A");
  assert.ok(h.mem.rows.has(guestKey), "the sign-in itself wrote an (empty) guest copy: why today's menu row shows for everyone");
  assert.equal(h.host.guestOffer(a).status, "nothing", "an empty guest copy offers nothing");
  assert.equal(h.host.previewImport(a, "guest").status, "preview", "while today's menu row is offered for it");
  // a guest practises, then the same browser signs in again
  h.signOut().prep["Mount|Top"] = 4; h.get().settings = { emailMarketing: true }; h.get()._settingsAt = { emailMarketing: 9e12 }; h.get()._flushSave();
  a = h.signIn("A"); a.settings = { emailMarketing: false }; a._settingsAt = { emailMarketing: 1 };
  const guestRaw = h.mem.rows.get(guestKey);   // after the sign-in, which itself re-saves the outgoing guest copy
  const offer = h.host.guestOffer(a);
  assert.equal(offer.status, "offer"); assert.equal(offer.otherAccount, false, "only A has used this browser");
  assert.equal(h.host.acceptGuest(a, offer).status, "ready");
  assert.equal(h.host.store.read(M.ngProgressOwner("A")).blob.prep["Mount|Top"], 4, "the account holds the guest's practice");
  assert.equal(h.host.store.read(M.ngProgressOwner("A")).blob.settings.emailMarketing, false, "email consent stays the account's");
  assert.equal(h.mem.rows.get(guestKey), guestRaw, "the guest copy is kept byte for byte");
  assert.equal(h.host.guestOffer(a).status, "seen", "offered once");
  // a decline is also once; new guest practice is a new offer
  h.signOut().prep["Side Control|Top"] = 2; h.get()._flushSave();
  a = h.signIn("A"); const o2 = h.host.guestOffer(a); assert.equal(o2.status, "offer", "new guest practice is offered");
  assert.equal(h.host.declineGuest(a, o2).status, "declined"); assert.equal(h.host.guestOffer(a).status, "seen", "declined once");
  assert.equal(h.host.store.read(M.ngProgressOwner("A")).blob.prep["Side Control|Top"], undefined, "a decline adds nothing");
  // an offer cannot cross an account switch; another account now shows on this browser
  h.signOut(); const b = h.signIn("B"), ob = h.host.guestOffer(b);
  assert.equal(ob.status, "offer"); assert.equal(ob.otherAccount, true, "A's copy is in this browser");
  const c = h.signIn("C");
  assert.equal(h.host.acceptGuest(c, ob).status, "unavailable", "B's offer cannot be taken by C");
});

test("4. the variants at sign-in: today nothing; a adds and says one line; b asks; c adds alone and asks when shared", async () => {
  const practised = async (variant, before) => {
    const h = harness(); await h.boot();
    if (before) { h.signIn(before); h.signOut(); }   // another account used this browser first
    h.get().prep["Mount|Top"] = 5; h.get()._flushSave();
    return withVariant(variant, () => {
      const g = h.get(); g._applyUser({ id: "A", email: "player@example.com" });
      const a = h.get(), modal = withModal(a), said = [];
      a._announceArrival = (k, t) => said.push(k + ": " + t);
      a._applyUser({ id: "A", email: "player@example.com" });
      return { h, a, modal: modal(), said, prep: () => h.host.store.read(M.ngProgressOwner("A")).blob?.prep?.["Mount|Top"] };
    });
  };
  let t = await practised("today");
  assert.equal(t.prep(), undefined, "today: nothing at sign-in"); assert.equal(t.modal, undefined); assert.deepEqual(t.said, []);
  t = await practised("a");
  assert.equal(t.prep(), 5, "a: added"); assert.equal(t.modal, undefined, "a: no question");
  assert.deepEqual(t.said, ["Practice saved: What you practised here before signing in is in your account now"], "a: one line");
  t = await practised("b");
  assert.equal(t.prep(), undefined, "b: nothing before the answer");
  assert.equal(t.modal.attrs["data-guest-join"], "1");
  assert.equal(t.modal.children[0].textContent, "Add the practice you did here before signing in to your account?");
  t.modal.children.find((x) => x.attrs["data-guest-join-yes"]).listeners.click();
  assert.equal(t.prep(), 5, "b: Add it adds");
  t = await practised("c");
  assert.equal(t.prep(), 5, "c, one-account browser: added"); assert.equal(t.modal, undefined);
  t = await practised("c", "B");
  assert.equal(t.prep(), undefined, "c, a browser B used: asks first"); assert.equal(t.modal.attrs["data-guest-join"], "1");
  t.modal.children.find((x) => x.attrs["data-guest-join-no"]).listeners.click();
  assert.equal(t.prep(), undefined, "c: No thanks adds nothing");
  delete globalThis.document;
});
