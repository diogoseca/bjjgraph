// EACH BROWSER KEEPS ITS OWN ROLL-LEDGER CODE (v1.262.5, FLOW1, 12 Nov). The roll ledger is a G-counter:
// `flow[code][state][move] = [tries, worked, lastDay]`, one partition per writer, merged per partition by MAX and read as
// the SUM (app.src.jsx `_noteFlow`, `_mergeProgressFields`, knowledge-profile `ngKnowledgeFlowCounts`). MAX is exact only
// when a partition has ONE writer. Until v1.262.4 the code was the setting `flowDevice`, and settings sync per key, last
// writer wins, so every browser of an account converged on one code and wrote ONE partition from many places: two
// browsers that rolled the same move between syncs kept only the larger of their two tallies (the found fault, M14).
// Now the code is kept in the browser, per owner (progress-owner `flowDevice`, local key `<owner>:device`), never in the
// progress blob, so it never syncs. These tests drive the REAL class and the REAL owner host against a fake cloud that
// HOLDS an account's rolls already, filed under one shared code "L" (what every one of production's 48 ledgers holds):
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
//      one more slot toward NG_FLOW_DEVICES);
//   8. a mint never takes a partition id the account already holds (a forced collision: the same clock and agent);
//   9. STATED, the cap: a seventh partition evicts the least recently touched one, named by the `flow_trimmed` beat.
// MUTANTS (2026-11-12; each run, in a scratch mirror, against this green file and tests/guest_join_safety.test.mjs; each
// turned exactly the tests named red, guest_join_safety's 19 staying green unless named):
//   MA `_flowDevice` back to the v1.262.4 rule (read and mint the `flowDevice` setting)          → 1-9 (1 on its tally: 11 for 12)
//   MB one code per browser for every owner (a browser-wide key, mirrored under each owner's)      → 5, 6
//   MC the host never reads a stored code back (a new code every page)                           → 3, 6
//   MC2 the host never stores the code                                                          → 1-9
//   MD the mint skips its check against the partitions the account already holds                 → 8
//   ME the mint also writes the code into settings (`this.set("flowDevice", d)`)                  → 2
//   MF the mint adopts the stored `flowDevice` when there is one (the tempting "keep the old code") → 1-8
//   MG the ledger merge SUMS a partition instead of MAX (a re-pull counts twice)                  → 1, 3, 4, 6, 8; guest 15, 16, 19
// THE OLD RULE'S COST, measured with this file's harness (1's orders, the old `_flowDevice`): 1,344 of the 1,440 orders
// lose one of the two rolls; 0 do under the new rule. Both browsers are signed in throughout: concurrent use, an upper
// bound, not a production rate.
// NOT CLAIMED: two TABS of one browser share the browser's code, as they share its local copy (the local store merges
// them by MAX, `mergeExternal`); that is unchanged by this rule and no test here says otherwise.
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
const M = new Function("DCLogic", "React", SOURCE + "\nreturn { Component, ngProgressCreateHost, ngProgressOwner, ngProgressLocalKey };")(class DCLogic {}, { createRef: () => ({ current: null }) });

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

test("9. STATED, the cap: a seventh partition (here a cleared browser's) evicts the least recently touched one, and the beat names the drop", async () => {
  assert.equal(M.Component.prototype.NG_FLOW_DEVICES, 6);
  const six = {};
  for (let i = 0; i < 6; i++) six["p" + i] = { [PK]: { [ORD]: [5, 2, DAY - 1 - i] } };   // p5 is the least recently touched
  const cloud = new Map([["A", { v: 2, flow: six }]]);
  const x = browser(cloud);
  await x.boot(); await x.signIn("A"); x.roll(); await x.push();
  const flow = cloud.get("A").flow;
  assert.equal(Object.keys(flow).length, 6, "the cap holds");
  assert.ok(flow[x.code(A)] && !flow.p5, "the new partition is kept and the least recently touched one (p5) went");
  for (let i = 0; i < 5; i++) assert.deepEqual(flow["p" + i], six["p" + i], "p" + i + " is kept as it was");
  assert.deepEqual(tally(flow), [26, 11], "30 rolls, less p5's 5, plus the new one: the eviction is a loss, and it is the cap's rule");
  assert.ok(x.beats.some(([n, d]) => n === "flow_trimmed" && d.dropped >= 1), "the drop is named (flow_trimmed)");
});
