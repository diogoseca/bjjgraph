// EACH BROWSER KEEPS ITS OWN ROLL-LEDGER CODE (v1.262.11, FLOW1, 12 Nov). The roll ledger is a G-counter:
// `flow[code][state][move] = [tries, worked, lastDay]`, one partition per writer, merged per partition by MAX and read as
// the SUM (app.src.jsx `_noteFlow`, `_mergeProgressFields`, knowledge-profile `ngKnowledgeFlowCounts`). MAX is exact only
// when a partition has ONE writer. Until v1.262.10 the code was the setting `flowDevice`, and settings sync per key, last
// writer wins, so every browser of an account converged on one code and wrote ONE partition from many places: two
// browsers that rolled the same move between syncs kept only the larger of their two tallies (the found fault, M14).
// Now the code is kept in the browser, per owner (progress-owner `flowDevice`, local key `<owner>:device`), never in the
// progress blob, so it never syncs. FLOW2 (the second reader of PR #384, reports/review-pr384.md) added the rest of the
// rule: the window is the CELL's, the cap counts only partitions minted since v1.262.11 and is 32, ties go by id, empty
// partitions go, and a code that could not be stored is stored at the next good save (progress-owner `ngFlowTrim`,
// `ngFlowWindowView`, `ngFlowSlotted`, `NG_FLOW_CAP`). These tests drive the REAL class and the REAL owner host against a
// fake cloud that HOLDS an account's rolls already, filed under one shared code "L" (what each of production's 48 ledgers
// holds):
//   1. two browsers of one account, every order of roll / push / pull for each (6 x 6 x 20 interleavings, both sign-in
//      orders): two new partitions, exact tallies on both browsers and in the cloud, "L" byte for byte as it was;
//   2. the code never travels: the setting is never written, the stored `flowDevice` stays readable and unchanged, and an
//      account that never had one never gains one;
//   3. one browser keeps its code across a reload, a sign-out and a sign-in;
//   4. a new device adds its own partition and touches no other;
//   5. a second account on the same browser gets its own code;
//   6. the guest's code is not the account's on the same browser: the guest partition joins as itself, re-joins by MAX
//      with itself (never counted twice), and the account never writes into it (the rule of ngProgressGuestFlow);
//   7. a browser whose storage is cleared mints a new code; the old partition stays, frozen, and still counts (STATED:
//      one more slot);
//   8. a mint never takes a partition id the account already holds (a forced collision: the same clock and agent);
//   9. one cap, 32, from one source: the app's NG_FLOW_DEVICES and both guest-join defaults;
//  10. M1 (the reader's S2): a frozen partition's row counts, and is kept, past day +180 while another partition rolls that
//      move; a move nobody rolls for 180 days drops, as before;
//  11. M2: the shared partition is never evicted and takes no slot (it survives a 33rd minted partition);
//  12. the reader's S1b and S1c (a private window every time, with and without guest rolls first): every roll counts;
//      STATED, where the cap still bites (60 daily private sessions keep the last 32);
//  13. F1 (S5): ties at the cap go by id, the same partition evicted in every key order, in the pure trim and the app's;
//  14. F2: a partition whose rows all expired is deleted and takes no slot, in the trim or the guest join's room;
//  15. M2 at the join: the guest's room is the trim's (a join never adds what the next trim evicts), and an old guest
//      partition joins outside the cap;
//  16. F4 (S7b): a code whose storing failed is stored at the next good save (8 page loads, one partition), never over a
//      code another tab stored meanwhile;
//  17. STATED (S4): after an eviction a device whose older copy brings the partition back by MAX absorbs the newer roll;
//      never above the truth;
//  18. FLOW3 (A4b): the join's last slot goes to the guest partition rolled most recently, not to one whose rows all
//      expired (first by id, it took the slot and was trimmed away, and the live one stayed out).
// MUTANTS (2026-11-12, FLOW3 code; each run, in a scratch mirror, against this green file and
// tests/guest_join_safety.test.mjs, 37 of 37 green; each turned exactly the tests named red, the guest file's 19 green
// unless named):
//   MA `_flowDevice` back to the v1.262.10 rule (read and mint the `flowDevice` setting)   → 1-8, 10-12, 15, 16
//   MB one code per browser for every owner (a browser-wide key)                         → 5, 6, 15
//   MC the host never reads a stored code back (a new code every page)                   → 3, 6, 16
//   MC2 the host never stores the code                                                   → 1-8, 11, 15, 16
//   MD the mint skips its check against the partitions the account already holds          → 8
//   ME the mint also writes the code into settings (`this.set("flowDevice", d)`)          → 2
//   MF the mint adopts the stored `flowDevice` when there is one                          → 1-8, 10, 12, 16
//   MG the ledger merge SUMS a partition instead of MAX (a re-pull counts twice)          → 1, 3, 4, 6, 8, 10, 16, 17; guest 15, 16, 19
//   N1 the trim by the row's own day (M1 off in the trim)                                → 10
//   N2 the read by the row's own day (M1 off in the read)                                → 10
//   N3 pre-v1.262.11 partitions take slots (M2 off)                                        → 11, 12, 14, 15, 18
//   N4 the join's room counts every account partition                                    → 14, 15, 18
//   N5 an old guest partition needs room                                                 → 15
//   N6 no tie-break by id                                                                → 13
//   N7 an emptied partition is kept as {}                                                → 14
//   N8 an empty partition takes a slot in the join's room                                → 14
//   N9 NG_FLOW_CAP back to 6                                                             → 9, 12; guest 15
//   N10 ngProgressGuestFlow's default back to 6                                          → 9, 14
//   N11 ngProgressGuestMerge's default back to 6                                         → 9
//   N12 no retry of a failed store                                                       → 16
//   N13 the retry writes over another tab's stored code                                  → 16
//   N14 the join spends its room by id alone (FLOW3 off)                                  → 18
// THE OLD RULE'S COST, measured with this file's harness (1's orders, the old `_flowDevice`): 1,344 of the 1,440 orders
// lose one of the two rolls; 0 do under the new rule. Both browsers are signed in throughout: concurrent use, an upper
// bound, not a production rate.
// NOT CLAIMED: two TABS of one browser share the browser's code, as they share its local copy (the local store merges
// them by MAX, `mergeExternal`); that is unchanged by this rule (the reader's F5, known) and no test here says otherwise.
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
const M = new Function("DCLogic", "React", SOURCE + "\nreturn { Component, ngProgressCreateHost, ngProgressOwner, ngProgressLocalKey, ngProgressGuestFlow, ngProgressGuestMerge, NG_FLOW_CAP, ngFlowTrim, ngFlowCapped, ngFlowSlotted };")(class DCLogic {}, { createRef: () => ({ current: null }) });

const DAY = 20402;
globalThis.window = globalThis.window || {};
globalThis.window.__NG_EPOCH_DAY__ = DAY;
const clone = (x) => JSON.parse(JSON.stringify(x));
const PK = "Mount|Top", ORD = "17";

// what an account holds today: its rolls under ONE shared code "L", which every browser of it read from the setting
const L_ROWS = { [PK]: { [ORD]: [10, 4, DAY - 3] }, "Side Control|Top": { "9": [6, 2, DAY - 8] } };
const SET_AT = 1762000000000;
const sharedAccount = () => ({ v: 2, prep: { "Side Control|Top": 3 }, flow: { L: clone(L_ROWS) }, settings: { flowDevice: "L", dailyGoal: 20 }, settingsAt: { flowDevice: SET_AT, dailyGoal: SET_AT }, updatedAt: SET_AT });

function memory() {
  const rows = new Map();
  return { rows, getItem: (k) => rows.get(k) ?? null, setItem: (k, v) => { rows.set(k, String(v)); }, removeItem: (k) => { rows.delete(k); } };
}
// One BROWSER: its own storage, one owner host, the app instances it mounts. `cloud` (user id -> blob) is shared by the
// browsers of a test, so two of them stand for two devices of one account.
function browser(cloud, mem = memory()) {
  let current = null, identity = null;
  const beats = [];
  const facade = { resolveNeuralUser: async () => identity, neuralSyncVersion: 2, isAuthenticated: () => true,
    pullNeural: async (id) => ({ userId: id, blob: cloud.has(id) ? clone(cloud.get(id)) : null }),
    pushNeural: async (b, id) => { cloud.set(id, clone(b)); return true; } };
  const host = M.ngProgressCreateHost({ storage: mem, resolveUser: () => facade.resolveNeuralUser(), hold: () => {}, mount(b) {
    const inst = new M.Component({}); current = inst; host.bind(inst, b);
    inst._publishKnowledge = () => {}; inst._applyLayers = () => {}; inst._refreshChallengeEvidence = () => {}; inst.updateAccountUI = () => {};
    inst.track = () => {}; inst.fx = (name, data) => beats.push([name, data]); inst._announceArrival = () => {};
    inst._auth = () => facade; inst.isTest = () => true;
    inst._pushCloud = () => {};                    // a push goes out only when the test says so (`push` below)
    inst.destroy = () => { if (inst.__ngDestroyed) return; inst.__ngDestroyed = true; inst._authDisposed = true; inst._invalidateCloudSync(); };
    inst._loadProgress();
  } });
  const get = () => current;
  const boot = () => host.bootstrap();
  // a verified sign-in in the real order (`_initAuth`): the outgoing instance switches, the new one applies the user, then
  // its first pull is awaited (tests/guest_join_safety.test.mjs's harness)
  const signIn = async (id) => { identity = { id, email: "player@example.com" }; get()._applyUser(identity); const a = get(); a._applyUser(identity); await a._pullAndMerge(); return get(); };
  const signOut = () => { identity = null; get()._clearAuthUser(); return get(); };
  // ONE EXCHANGE through the real `_noteFlow` (and so the real `_flowDevice`): standing on `pk`, the move `ord`
  const roll = (pk = PK, ord = ORD, ok = true) => {
    const a = get();
    a.nodes = [{ ty: "positions", k: pk }]; a.currentPos = 0; a.deckKeyFor = (n) => ({ key: n.k });
    a._noteFlow({ o: +ord }, ok);
  };
  const pull = () => get()._pullAndMerge();
  // the REAL `_pushCloud`, its 500 ms timer run at once: what it sends is `cloudSnapshot`, as in the app
  const push = async () => {
    const a = get(), real = globalThis.setTimeout; let fn = null;
    globalThis.setTimeout = (f) => { fn = f; return 0; };
    try { M.Component.prototype._pushCloud.call(a); } finally { globalThis.setTimeout = real; }
    if (fn) await fn();
  };
  // this browser's code for an owner, as stored (null if none, or if this build has no such key)
  const code = (owner) => { try { return mem.getItem(M.ngProgressLocalKey(owner, "device")); } catch (e) { return null; } };
  return { mem, host, cloud, beats, get, boot, signIn, signOut, roll, pull, push, code, setIdentity: (u) => { identity = u; } };
}
const A = M.ngProgressOwner("A"), B = M.ngProgressOwner("B"), GUEST = M.ngProgressOwner();
const tally = (flow, pk = PK, ord = ORD) => { let n = 0, k = 0; for (const d in flow || {}) { const r = flow[d] && flow[d][pk] && flow[d][pk][ord]; if (r) { n += r[0]; k += r[1]; } } return [n, k]; };
// the figure the weak-spot ranking reads (`flowCounts`, summed across partitions, the 180-day window applied)
const seen = (inst, pk = PK, ord = ORD) => { const t = inst.flowCounts()[pk]; return t && t[ord] ? [t[ord][0], t[ord][1]] : [0, 0]; };
const newIds = (flow, before) => Object.keys(flow || {}).filter((d) => !(d in before));

const perms = (xs) => xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms(xs.slice(0, i).concat(xs.slice(i + 1))).map((p) => [x].concat(p)));
function interleavings(a, b) {
  if (!a.length) return [b.map((s) => ["B", s])];
  if (!b.length) return [a.map((s) => ["A", s])];
  return interleavings(a.slice(1), b).map((r) => [["A", a[0]]].concat(r)).concat(interleavings(a, b.slice(1)).map((r) => [["B", b[0]]].concat(r)));
}

test("1. two browsers of one account keep two partitions in every order of rolling, pulling and pushing: no roll is lost or counted twice, and the shared partition stays as it was", async (t) => {
  const scripts = perms(["roll", "push", "pull"]);
  let orders = 0;
  for (const first of ["A", "B"]) for (const sa of scripts) for (const sb of scripts) for (const order of interleavings(sa, sb)) {
    const cloud = new Map([["A", sharedAccount()]]);
    const dev = { A: browser(cloud), B: browser(cloud) };
    await dev.A.boot(); await dev.B.boot();
    for (const d of first === "A" ? ["A", "B"] : ["B", "A"]) await dev[d].signIn("A");
    for (const [d, step] of order) await dev[d][step]();
    // settle: each browser reads the cloud, then hands it what it holds (an unchanged blob is not pushed again since
    // v1.255.2, so a push without a pull first can be a no-op), and both read the result; then all of it once more:
    // a re-pull or a re-push must add nothing
    for (let i = 0; i < 2; i++) { await dev.A.pull(); await dev.A.push(); await dev.B.pull(); await dev.B.push(); await dev.A.pull(); await dev.B.pull(); }
    const label = first + " signs in first; " + order.map((s) => s.join(".")).join(" ");
    const flow = cloud.get("A").flow;
    assert.deepEqual(tally(flow), [12, 6], label + ": the cloud holds the 10 shared rolls plus each browser's one");
    assert.deepEqual(seen(dev.A.get()), [12, 6], label + ": browser A reads 12");
    assert.deepEqual(seen(dev.B.get()), [12, 6], label + ": browser B reads 12");
    assert.deepEqual(flow.L, L_ROWS, label + ": the shared partition is never written, renamed, merged or dropped");
    const ids = newIds(flow, { L: 1 });
    assert.equal(ids.length, 2, label + ": two new partitions, one per browser (" + ids + ")");
    assert.deepEqual(ids.slice().sort(), [dev.A.code(A), dev.B.code(A)].sort(), label + ": each is the code its browser keeps");
    orders++;
  }
  assert.equal(orders, 2 * 6 * 6 * 20, "every order ran");
  t.diagnostic(orders + " orders, every one exact");
});

test("2. the code never travels: no setting is written, the stored flowDevice stays readable and unchanged, and an account that never had one never gains one", async () => {
  for (const start of [sharedAccount(), { v: 2, prep: { "Side Control|Top": 1 } }]) {
    const cloud = new Map([["A", clone(start)]]);
    const x = browser(cloud), y = browser(cloud);
    await x.boot(); await y.boot(); await x.signIn("A"); await y.signIn("A");
    x.roll(); y.roll(PK, "23", false); await x.push(); await y.pull(); await y.push(); await x.pull();
    const c = cloud.get("A"), had = !!(start.settings && start.settings.flowDevice);
    for (const [who, inst] of [["the cloud", c], ["browser x", x.get()._progressBlob()], ["browser y", y.get()._progressBlob()]]) {
      const s = inst.settings || {}, at = inst.settingsAt || {};
      if (had) {
        assert.equal(s.flowDevice, "L", who + ": the stored flowDevice is still there, readable, its value unchanged");
        assert.equal(at.flowDevice, SET_AT, who + ": and its stamp unchanged (nothing wrote it)");
      } else assert.ok(!("flowDevice" in s) && !("flowDevice" in at), who + ": an account that never had the setting never gains it");
    }
    const codes = [x.code(A), y.code(A)];
    assert.ok(codes.every(Boolean) && codes[0] !== codes[1], "each browser keeps a code of its own: " + codes);
    const text = JSON.stringify({ ...c, flow: undefined });
    for (const k of codes) assert.ok(!text.includes(k), "the code " + k + " appears in the cloud blob only as a partition's name");
  }
});

test("3. one browser keeps its code across a reload, a sign-out and a sign-in", async () => {
  const cloud = new Map([["A", sharedAccount()]]);
  const x = browser(cloud);
  await x.boot(); await x.signIn("A"); x.roll(); await x.push();
  const first = x.code(A);
  assert.ok(first, "the first roll minted a code and stored it");
  const reload = browser(cloud, x.mem);                       // the same browser, a new page
  reload.setIdentity({ id: "A", email: "player@example.com" }); await reload.boot();
  assert.equal(reload.get()._progressOwner.id, "A", "the reload restored the account");
  await reload.signIn("A"); reload.roll(); await reload.push();
  reload.signOut(); await reload.signIn("A"); reload.roll(); await reload.push();
  const flow = cloud.get("A").flow;
  assert.equal(reload.code(A), first, "the code is the same after a reload and a second sign-in");
  assert.deepEqual(newIds(flow, { L: 1 }), [first], "one browser, one partition");
  assert.deepEqual(flow[first][PK][ORD], [3, 3, DAY], "its three rolls, in it");
  assert.deepEqual(tally(flow), [13, 7]);
});

test("4. a new device adds its own partition and touches no other", async () => {
  const cloud = new Map([["A", sharedAccount()]]);
  const x = browser(cloud), y = browser(cloud);
  await x.boot(); await y.boot(); await x.signIn("A"); await y.signIn("A");
  x.roll(); x.roll(); await x.push(); await y.pull(); y.roll(); await y.push();
  const before = clone(cloud.get("A").flow);
  const z = browser(cloud);
  await z.boot(); await z.signIn("A"); z.roll(PK, ORD, false); await z.push();
  const flow = cloud.get("A").flow, added = newIds(flow, before);
  assert.deepEqual(added, [z.code(A)], "the new device's one partition, under its own code");
  assert.ok(![x.code(A), y.code(A), "L"].includes(z.code(A)), "a code no other browser holds");
  for (const d in before) assert.deepEqual(flow[d], before[d], "partition " + d + " is untouched");
  assert.deepEqual(tally(flow), [14, 7]);
});

test("5. a second account on the same browser gets its own code", async () => {
  const cloud = new Map([["A", sharedAccount()], ["B", { v: 2, prep: { "Mount|Top": 1 } }]]);
  const x = browser(cloud);
  await x.boot(); await x.signIn("A"); x.roll(); await x.push();
  x.signOut(); await x.signIn("B"); x.roll(); await x.push();
  const a = x.code(A), b = x.code(B);
  assert.ok(a && b && a !== b, "two accounts on one browser, two codes: " + a + " / " + b);
  assert.deepEqual(newIds(cloud.get("A").flow, { L: 1 }), [a], "account A holds only its own new partition");
  assert.deepEqual(Object.keys(cloud.get("B").flow), [b], "account B holds only its own");
});

test("6. the guest's code is not the account's on the same browser: the guest partition joins as itself, re-joins by MAX with itself, and the account never writes into it", async () => {
  const cloud = new Map([["A", sharedAccount()]]);
  const x = browser(cloud);
  await x.boot(); x.roll(); x.roll(PK, ORD, false);           // two rolls as a guest
  const g = x.code(GUEST);
  assert.ok(g, "the guest minted its own code");
  await x.signIn("A");                                       // the guest copy joins at the first pull
  x.roll(); await x.push();                                  // the account rolls once on this browser
  const a = x.code(A);
  assert.ok(a && a !== g, "the account's code on this browser is not the guest's: " + a + " / " + g);
  let flow = cloud.get("A").flow;
  assert.deepEqual(flow[g][PK][ORD], [2, 1, DAY], "the guest's partition joined as itself");
  assert.deepEqual(flow[a][PK][ORD], [1, 1, DAY], "the account's roll is in its own partition, not the guest's");
  x.signOut(); x.roll();                                     // the guest plays once more: its copy changed, so it re-joins
  await x.signIn("A"); await x.push();
  flow = cloud.get("A").flow;
  assert.deepEqual(flow[g][PK][ORD], [3, 2, DAY], "the re-join merged the guest's partition with itself: 3 rolls, not 5");
  assert.deepEqual(flow[a][PK][ORD], [1, 1, DAY], "the account's own partition is untouched by the join");
  assert.deepEqual(flow.L, L_ROWS);
  assert.deepEqual(tally(flow), [14, 7], "10 shared + 3 guest + 1 account, each once");
});

test("7. a browser whose storage is cleared mints a new code: the old partition stays, frozen, and still counts (one more slot)", async () => {
  const cloud = new Map([["A", sharedAccount()]]);
  const x = browser(cloud);
  await x.boot(); await x.signIn("A"); x.roll(); x.roll(); await x.push();
  const old = x.code(A), before = clone(cloud.get("A").flow);
  x.mem.rows.clear();                                        // site data cleared (or a private window ended)
  const again = browser(cloud, x.mem);
  await again.boot(); await again.signIn("A"); again.roll(); await again.push();
  const flow = cloud.get("A").flow, fresh = again.code(A);
  assert.ok(fresh && fresh !== old, "a new code: " + old + " -> " + fresh);
  assert.deepEqual(flow[old], before[old], "the old partition stays exactly as it was");
  assert.deepEqual(newIds(flow, before), [fresh], "STATED: one more partition (a slot toward NG_FLOW_DEVICES)");
  assert.deepEqual(tally(flow), [13, 7], "every roll still counts once");
});

test("8. a mint never takes a partition id the account already holds (a forced collision: the same clock and agent on two browsers)", async () => {
  const realNow = Date.now, realPerf = performance.now;
  Date.now = () => 1762900000000; performance.now = () => 1234.5;
  try {
    const cloud = new Map([["A", sharedAccount()]]);
    const x = browser(cloud), y = browser(cloud);
    await x.boot(); await y.boot(); await x.signIn("A");
    x.roll(); await x.push();
    await y.signIn("A");                                     // y now holds x's partition
    y.roll(); await y.push(); await x.pull();
    const a = x.code(A), b = y.code(A);
    assert.ok(a && b && a !== b, "the second mint stepped past the id it found already held: " + a + " / " + b);
    x.roll(); y.roll(); await x.push(); await y.push(); await x.pull(); await y.pull(); await x.push(); await y.pull();   // the order that loses under one shared code
    assert.deepEqual(tally(cloud.get("A").flow), [14, 8], "and no roll is lost");
  } finally { Date.now = realNow; performance.now = realPerf; }
});


// ── FLOW2: the second reader of PR #384 (reports/review-pr384.md): the window, the cap and the trim ─────────────────────
const NEW = (i) => "b" + i.toString(16).padStart(16, "0");            // a partition id in the v1.262.11 form
const atDay = (d) => { globalThis.window.__NG_EPOCH_DAY__ = d; };

test("9. one cap, 32: the app's NG_FLOW_DEVICES, the blob module's NG_FLOW_CAP and both guest-join defaults are one number", () => {
  assert.equal(M.NG_FLOW_CAP, 32);
  assert.equal(M.Component.prototype.NG_FLOW_DEVICES, M.NG_FLOW_CAP, "the app reads the blob module's number");
  const guest = {};
  for (let i = 0; i < M.NG_FLOW_CAP + 3; i++) guest[NEW(1000 + i)] = { [PK]: { [ORD]: [1, 1, DAY] } };
  assert.equal(Object.keys(M.ngProgressGuestFlow({}, guest)).length, M.NG_FLOW_CAP, "ngProgressGuestFlow's default joins exactly the cap");
  const merged = M.ngProgressGuestMerge((live, part) => part, { v: 2 }, { v: 2, flow: guest });
  assert.equal(Object.keys(merged.flow).length, M.NG_FLOW_CAP, "and ngProgressGuestMerge's default (the legacy import's path) is the same cap");
});

test("10. M1, the reader's S2: the window is the cell's: a frozen partition's row still counts, and is kept, past day +180 while another partition rolls that move; a move nobody rolls for 180 days drops, as before", async () => {
  try {
    atDay(DAY);
    const cloud = new Map([["A", sharedAccount()]]);
    const x = browser(cloud), y = browser(cloud);
    await x.boot(); await y.boot(); await x.signIn("A"); await y.signIn("A");
    let rolls = 0;
    for (const d of [DAY, DAY + 90, DAY + 177, DAY + 178, DAY + 200]) {    // both browsers, one after the other
      atDay(d);
      await x.pull(); x.roll(); await x.push(); await y.pull(); y.roll(); await y.push(); await x.pull();
      rolls += 2;
      assert.deepEqual(seen(x.get()), [10 + rolls, 4 + rolls], "day +" + (d - DAY) + ": the read counts every roll, the frozen partition's 10 included");
      assert.deepEqual(tally(cloud.get("A").flow), [10 + rolls, 4 + rolls], "day +" + (d - DAY) + ": and the cloud keeps them (the trim kept the row)");
    }
    const L = cloud.get("A").flow.L;
    assert.deepEqual(L[PK][ORD], L_ROWS[PK][ORD], "the frozen row is unchanged, still dated three days before the switch: its cell keeps it");
    assert.ok(!L["Side Control|Top"], "the frozen partition's other move, which nobody rolled for 180 days, dropped (the old rule's own window)");
    assert.ok(x.beats.some(([n]) => n === "flow_trimmed"), "and the drop is named");
  } finally { atDay(DAY); }
});

test("11. M2: the account's shared partition is never evicted and takes no slot: with 32 partitions minted already, a 33rd evicts the least recently touched of THOSE, and the shared one, older than all, stays", async () => {
  const flow = { L: clone(L_ROWS) };
  for (let i = 0; i < M.NG_FLOW_CAP; i++) flow[NEW(i)] = { "Side Control|Top": { "9": [1, 1, DAY - 40 + i] } };   // NEW(0) the least recent
  const cloud = new Map([["A", { v: 2, flow }]]);
  const x = browser(cloud);
  await x.boot(); await x.signIn("A"); x.roll(); await x.push();
  const f = cloud.get("A").flow;
  assert.deepEqual(f.L, L_ROWS, "the shared partition stays, byte for byte, though it is older than every other");
  assert.ok(!f[NEW(0)] && f[x.code(A)], "the least recently touched minted partition went, and the new one stays");
  for (let i = 1; i < M.NG_FLOW_CAP; i++) assert.ok(f[NEW(i)], NEW(i) + " is kept");
  assert.equal(M.ngFlowSlotted(f).length, M.NG_FLOW_CAP, "32 slots, the shared partition not among them");
  assert.deepEqual(tally(f), [11, 5], "the shared 10 and the new roll");
  assert.ok(x.beats.some(([n, d]) => n === "flow_trimmed" && d.dropped === 1), "the one eviction is named");
});

test("12. the reader's S1b and S1c: a private window every time on an account with history: every session's rolls count, with or without rolls as a guest first; STATED, where the cap still bites (a daily private window, 60 sessions)", async () => {
  const history = () => ({ v: 2, flow: { L: { [PK]: { [ORD]: [100, 50, DAY - 3] } } }, settings: { flowDevice: "L" }, settingsAt: { flowDevice: SET_AT } });
  try {
    for (const [name, sessions, guestFirst, want] of [["S1b", 10, false, 150], ["S1c", 10, true, 150], ["60 daily sessions", 60, false, 100 + 5 * M.NG_FLOW_CAP]]) {
      const cloud = new Map([["A", history()]]);
      for (let s = 0; s < sessions; s++) {
        atDay(DAY + s);
        const w = browser(cloud);                                 // a private window: new storage each time
        await w.boot();
        if (guestFirst) { w.roll(); w.roll(); }                   // two rolls as a guest, then sign in
        await w.signIn("A");
        for (let r = guestFirst ? 2 : 0; r < 5; r++) w.roll();
        await w.push();
      }
      const f = cloud.get("A").flow;
      assert.deepEqual(f.L, history().flow.L, name + ": the history stays");
      assert.equal(tally(f)[0], want, name + ": reads " + tally(f)[0] + " of " + (100 + 5 * sessions));
    }
  } finally { atDay(DAY); }
});

test("13. F1, the reader's S5: a tie at the cap goes by id, so every device evicts the same partition whatever its key order", async () => {
  const ids = Array.from({ length: M.NG_FLOW_CAP + 2 }, (_, i) => i);
  const make = (order) => { const f = {}; for (const i of order) f[NEW(i)] = { [PK]: { [ORD]: [1, 1, DAY] } }; return f; };
  const orders = [ids, ids.slice().reverse(), ids.slice(7).concat(ids.slice(0, 7))];
  const pure = orders.map((o) => { const f = make(o); M.ngFlowTrim(f, DAY, 180, M.NG_FLOW_CAP); return Object.keys(f).sort().join(","); });
  assert.equal(new Set(pure).size, 1, "three key orders, one kept set");
  assert.equal(pure[0].split(",").length, M.NG_FLOW_CAP);
  const x = browser(new Map()); await x.boot();
  const app = orders.map((o) => Object.keys(x.get()._trimFlow(make(o))).sort().join(","));
  assert.deepEqual(app, pure, "the app's own trim keeps the same set");
});

test("14. F2: a partition whose rows have all expired is deleted, and takes no slot in the trim or in the guest join's room", () => {
  const f = { L: clone(L_ROWS) };
  for (let i = 0; i < M.NG_FLOW_CAP - 1; i++) f[NEW(i)] = { [PK]: { [ORD]: [1, 1, DAY - 1] } };
  f[NEW(99)] = { "Closed Guard|Bottom": { "5": [3, 1, DAY - 200] } };   // nobody rolled that move for 200 days
  M.ngFlowTrim(f, DAY, 180, M.NG_FLOW_CAP);
  assert.ok(!(NEW(99) in f), "its row expired, and the partition left empty is gone, not kept as {}");
  const shell = { ...clone(f), [NEW(98)]: {} };
  const joined = M.ngProgressGuestFlow(shell, { [NEW(500)]: { [PK]: { [ORD]: [2, 1, DAY] } } });
  assert.ok(joined[NEW(500)], "with 31 slotted partitions and an empty shell, the guest's partition finds the 32nd slot");
});

test("15. M2 at the guest join: the room is the trim's, so a join never adds what the next trim evicts; an old guest partition joins outside the cap", async () => {
  const flow = { L: clone(L_ROWS) };
  for (let i = 0; i < M.NG_FLOW_CAP - 1; i++) flow[NEW(i)] = { "Side Control|Top": { "9": [1, 1, DAY - 40 + i] } };
  const cloud = new Map([["A", { v: 2, flow }]]);
  const x = browser(cloud);
  await x.boot(); x.roll(); x.roll();                                  // the guest mints its new code
  const g = x.get();                                                   // and still holds its old code's partition from before the switch
  g.flow = { ...g.flow, dOLDGUEST: { [PK]: { [ORD]: [4, 2, DAY - 2] } } }; g._flowVer = (g._flowVer || 0) + 1; g._flushSave();
  await x.signIn("A"); await x.push();
  let f = cloud.get("A").flow;
  assert.ok(f[x.code(GUEST)], "the guest's new partition took the one slot left");
  assert.deepEqual(f.dOLDGUEST, { [PK]: { [ORD]: [4, 2, DAY - 2] } }, "its old partition joined too, outside the cap");
  assert.equal(M.ngFlowSlotted(f).length, M.NG_FLOW_CAP, "exactly at the cap, and the trim after the join evicted nothing");
  for (let i = 0; i < M.NG_FLOW_CAP - 1; i++) assert.ok(f[NEW(i)], NEW(i) + " is kept");
  assert.deepEqual(tally(f), [16, 8], "10 shared, 2 as the guest now, 4 as the guest before: each once");
  x.roll(); await x.push();                                            // the account's own first roll here: a 33rd slot
  f = cloud.get("A").flow;
  assert.ok(!f[NEW(0)] && f.L && f.dOLDGUEST && f[x.code(GUEST)] && f[x.code(A)], "the least recently touched minted partition goes, never a pre-v1.262.11 one");
});

test("16. F4, the reader's S7b: when storing the code fails, it is stored at the next good save, so eight page loads write ONE partition", async () => {
  const mem = memory(), set = mem.setItem;
  let fail = 1;
  mem.setItem = (k, v) => { if (k.endsWith(":device") && fail > 0) { fail--; throw new Error("quota"); } set(k, v); };
  const cloud = new Map([["A", sharedAccount()]]);
  for (let p = 0; p < 8; p++) {
    const page = browser(cloud, mem);
    if (p) page.setIdentity({ id: "A", email: "player@example.com" });
    await page.boot(); await page.signIn("A"); page.roll(); await page.push();
  }
  const f = cloud.get("A").flow, ids = newIds(f, { L: 1 });
  assert.equal(fail, 0, "the first write did fail");
  assert.deepEqual(ids, [mem.getItem(M.ngProgressLocalKey(A, "device"))], "one partition, under the code stored at the first page's save");
  assert.deepEqual(tally(f), [18, 12], "the shared 10 and the eight page loads' rolls");
  // and the retry never writes over a code another tab of this browser stored meanwhile: that one is the browser's now
  const mem2 = memory(), set2 = mem2.setItem, key = M.ngProgressLocalKey(A, "device"), theirs = "b" + "1".repeat(16);
  let fail2 = 1;
  mem2.setItem = (k, v) => { if (k.endsWith(":device") && fail2 > 0) { fail2--; throw new Error("quota"); } set2(k, v); };
  const tab = browser(new Map([["A", sharedAccount()]]), mem2);
  await tab.boot(); await tab.signIn("A");
  const mine = tab.get()._flowDevice();                                  // minted; storing it failed
  set2(key, theirs);                                                     // the other tab stores its own
  tab.roll(); await tab.push();
  assert.equal(mem2.getItem(key), theirs, "the other tab's code stays stored");
  assert.ok(mine !== theirs && tab.cloud.get("A").flow[mine], "this page's rolls stay under its own code");
});

test("17. STATED, the reader's S4: after an eviction a device whose copy predates it brings the partition back by MAX; the read then depends on the order of syncs, but is never above the truth", async () => {
  const T = NEW(777), flow = { [T]: { [PK]: { [ORD]: [20, 20, DAY - 50] } } };   // a tablet's 20 rolls, its least recent partition
  for (let i = 0; i < M.NG_FLOW_CAP - 1; i++) flow[NEW(i)] = { "Side Control|Top": { "9": [1, 1, DAY - 40 + i] } };
  const cloud = new Map([["A", { v: 2, flow }]]);
  const laptop = browser(cloud), tablet = browser(cloud), fresh = browser(cloud);
  tablet.mem.setItem(M.ngProgressLocalKey(A, "device"), T);
  for (const b of [laptop, tablet, fresh]) { await b.boot(); await b.signIn("A"); }
  let truth = 20;
  const check = (label) => { const n = tally(cloud.get("A").flow)[0]; assert.ok(n <= truth, label + ": the cloud reads " + n + " of " + truth); return n; };
  fresh.roll(); truth++; await fresh.push();
  assert.equal(check("a 33rd partition"), 1, "the tablet's partition is the one evicted (its 20 are gone from the cloud)");
  await tablet.pull(); tablet.roll(); truth++; await tablet.push();
  check("the tablet rolls again");
  await laptop.pull(); await laptop.push();
  const end = check("the laptop's older copy merges");
  assert.ok(end < truth, "STATED: " + end + " of " + truth + " (an eviction is a loss, and the copy that brings it back absorbs the newer roll)");
});

test("18. FLOW3, the reader's A4b: at the join's last slot the guest partition rolled most recently goes first, so one whose rows have all expired cannot take the slot from one still rolled (it did, first by id)", async () => {
  const dead = NEW(1), live = NEW(2);                                  // `dead` sorts first by id
  const flow = { L: clone(L_ROWS) };
  for (let i = 0; i < M.NG_FLOW_CAP - 1; i++) flow[NEW(100 + i)] = { "Side Control|Top": { "9": [1, 1, DAY - 40 + i] } };
  const cloud = new Map([["A", { v: 2, flow, prep: { "Side Control|Top": 1 } }]]);
  const mem = memory();
  // a guest copy as stored, never loaded since (an existing player restored at boot reads it raw): one partition whose
  // only move nobody has rolled for 200 days, one rolled today
  const guestBlob = { v: 2, prep: { "Mount|Top": 1 }, flow: { [dead]: { "Closed Guard|Bottom": { "5": [6, 3, DAY - 200] } }, [live]: { [PK]: { [ORD]: [5, 4, DAY] } } } };
  mem.setItem(M.ngProgressLocalKey(GUEST), JSON.stringify({ format: "bjj-progress-owner-v1", owner: GUEST, blob: guestBlob, savedAt: 1 }));
  const x = browser(cloud, mem);
  x.setIdentity({ id: "A", email: "player@example.com" });
  await x.boot(); await x.signIn("A"); await x.push();
  const f = cloud.get("A").flow;
  assert.deepEqual(f[live], guestBlob.flow[live], "the guest partition rolled today took the last slot");
  assert.ok(!(dead in f), "the one whose rows have all expired did not (and would have been trimmed away had it joined)");
  assert.equal(M.ngFlowSlotted(f).length, M.NG_FLOW_CAP, "at the cap, nothing of the account's evicted");
  assert.deepEqual(tally(f), [15, 8], "the shared 10 and the guest's 5, each once");
});
