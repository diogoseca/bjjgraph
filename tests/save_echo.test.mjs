// v1.255.2 (the Supabase check, 2026-11-10): every tab return answered auth-js's SIGNED_IN with a pull, a save and a push of the
// merged blob, changed or not (18% or more of all saves), and counted a sign-in each time. This file pins the two fixes on the real
// app class, the real progress host and a synthetic facade (the harness of progress_owner.integration.test.mjs):
//   - a push is skipped only when the blob, without its write stamp, equals what the cloud last held for this account;
//   - every kind of local change, a merge the cloud lacks, a failed push and an overlap still push;
//   - `neural_signin_completed` counts the sign-ins this browser started, once.
// Red-proof, run by hand on the source with each mutant applied and reverted (node --test tests/save_echo.test.mjs), each red at:
//   no-echo-guard ............ the echo          skip-while-in-flight ..... a list added, then removed (S1)
//   key-drops-moves .......... a move graded     key-content-blind ........ the key, every change, the merge
//   sets-in-order ............ two devices, one set, two orders (S2)
//   pull-records-merged ...... a merge the cloud lacks       overlap-trusted .......... two pushes overlap
//   fail-remembered .......... a failed push (false and thrown)
//   pull-trusts-overlap ...... a pull overlapping a push, P1's response first (the other order is ALSO caught by S1's rule)
//   signin-every-event ....... a tab return      intent-kept .............. counts once, two tabs
//   intent-ageless / create-window-30m ... the 30-minute and 24-hour windows (E4)
//   no-intent-at ............. counts once (E3)  lock-bypassed ............ the Web Lock (E3)
//   initauth-no-count ........ a verified identity at start-up (E2)
// EQUIVALENT, recorded: key-drops-settings (a setting also moves its `settingsAt` stamp, which the key keeps); either half of the
// failed-push guard alone (recorded only on success; a failure re-pulls); the account check on `_cloudSeen` and its clear in
// `_invalidateCloudSync` (an instance never changes account: any owner change mounts a new one); the pull's `_pushSeq` bump (a
// solo push records what its own write left in the cloud, which a pull meanwhile does not change; the pull itself records nothing
// when a push overlaps it). The two sign-in buttons' writes and failed-attempt clears are pinned by e2e/journeys/signin-intent.spec.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = text => text.replace(/^export (function|const|let|var|class) /gm, '$1 ');
const dependencies = ['lists-codec', 'lists', 'belt', 'challenge-definitions', 'challenge-engine'].map(name => strip(read('../neural/src/' + name + '.src.js'))).join('\n');
const ownerSource = strip(read('../neural/src/progress-owner.src.js'));
const source = read('../neural/src/app.src.jsx');
const Component = new Function('DCLogic', 'React', ownerSource + '\n' + dependencies + '\n' + source + '\nreturn { Component, ngProgressCreateHost, ngProgressCloudKey };')(class {}, { createRef: () => ({ current: null }) });
const { ngProgressCreateHost, ngProgressCloudKey } = Component;

function memory() { const rows = new Map(); return { rows, getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, String(v)), removeItem: k => rows.delete(k) }; }
function harness(mem = memory()) {
  let current, identity = null;
  const pushes = [], pulls = [], tracked = [], listeners = [];
  const facade = { resolveNeuralUser: async () => identity, neuralSyncVersion: 2, isAuthenticated: () => true,
    pullNeural: async id => { pulls.push(id); return { userId: id, blob: null }; },
    pushNeural: async (value, userId) => { pushes.push({ value: JSON.parse(JSON.stringify(value)), userId }); return true; },
    onAuthChange: cb => { listeners.push(cb); return () => {}; } };
  const host = ngProgressCreateHost({ storage: mem, resolveUser: () => facade.resolveNeuralUser(), hold: () => {}, mount(boot) {
    const inst = new Component.Component({}); current = inst; host.bind(inst, boot);
    inst._publishKnowledge = () => {}; inst._applyLayers = () => {}; inst._refreshChallengeEvidence = () => {}; inst.updateAccountUI = () => {};
    inst.track = (event, props) => tracked.push([event, props]); inst.fx = () => {}; inst._auth = () => facade; inst.isTest = () => true;
    inst.destroy = () => { if (inst.__ngDestroyed) return; inst.__ngDestroyed = true; inst._authDisposed = true; inst._invalidateCloudSync(); };
    inst._loadProgress();
  } });
  const get = () => current;
  const switchTo = id => { identity = { id, email: id + '@example.invalid' }; get()._applyUser(identity); get()._applyUser(identity); return get(); };
  return { mem, host, facade, get, switchTo, pushes, pulls, tracked, listeners, setIdentity: user => { identity = user; }, boot: () => host.bootstrap() };
}
async function fakeTimers(run) {
  const oldSet = globalThis.setTimeout, oldClear = globalThis.clearTimeout; let seq = 0; const q = new Map();
  globalThis.setTimeout = fn => { const id = ++seq; q.set(id, fn); return id; }; globalThis.clearTimeout = id => q.delete(id);
  const flush = async () => { for (let i = 0; i < 8 && q.size; i++) { const jobs = [...q.values()]; q.clear(); for (const fn of jobs) await fn(); } };
  // a pull started from inside a save resolves on its own: let it, then run what it queued, until both are quiet
  const settle = async () => { for (let i = 0; i < 6; i++) { await new Promise(r => setImmediate(r)); await flush(); } };
  try { await run({ q, flush: settle }); } finally { globalThis.setTimeout = oldSet; globalThis.clearTimeout = oldClear; }
}
// What the cloud hands back: JSONB reorders keys, so the pulled blob is the pushed one with its keys in another order.
const reordered = v => Array.isArray(v) ? v.map(reordered) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map(k => [k, reordered(v[k])])) : v;
async function synced(h) {
  await h.boot(); const a = h.switchTo('A'); a.prep.local = 3;
  await a._pullAndMerge();                                      // an empty account: the first push is needed
  return a;
}

test('the key leaves out exactly the write stamp and key order', () => {
  assert.equal(ngProgressCloudKey({ v: 2, updatedAt: 1, prep: { a: 1, b: 2 } }), ngProgressCloudKey({ prep: { b: 2, a: 1 }, updatedAt: 99, v: 2 }));
  assert.notEqual(ngProgressCloudKey({ v: 2, prep: { a: 1 } }), ngProgressCloudKey({ v: 2, prep: { a: 2 } }));
  assert.notEqual(ngProgressCloudKey({ v: 2, settingsAt: { x: 1 } }), ngProgressCloudKey({ v: 2, settingsAt: { x: 2 } }), 'per-key stamps are progress, not write stamps');
});

test('a pull that brings back what this tab pushed sends nothing (the echo)', () => fakeTimers(async ({ flush }) => {
  const h = harness(); const a = await synced(h); await flush();
  assert.equal(h.pushes.length, 1, 'premise: an empty account takes the first push');
  h.facade.pullNeural = async id => ({ userId: id, blob: reordered(h.pushes.at(-1).value) });
  // The first round trip may push once more: hydrating a cloud blob fills defaults the first local blob lacked (`belts.attempts`).
  await a._pullAndMerge(); await flush();
  const settled = h.pushes.length;
  assert.ok(settled <= 2, 'at most one shape-normalising push');
  await a._pullAndMerge(); await flush();                        // a tab return: SIGNED_IN pulls, the merge saves
  assert.equal(h.pushes.length, settled, 'nothing changed since the cloud last held this account\'s blob, so nothing is sent');
}));

test('every kind of local change still pushes', () => fakeTimers(async ({ flush }) => {
  const h = harness(); const a = await synced(h); await flush();
  const changes = {
    'a flashcard answer': () => { a.prep['Mount|Top'] = 1; a.srs['Mount|Top'] = { q1: [1, 1, 1] }; },
    'a move graded': () => { a.moves = { 'Mount|Top': { kimura: [1, 1, 1, 1] } }; },
    'a setting': () => { a.set('landFilm', false); return true; },
    'a list': () => { a.lists = { ...a.lists, l1: { name: 'Class', items: ['Positions/Mount'] } }; },
    // a roll dated today: since v1.262.8 a row its cell's window has passed is trimmed with its emptied partition (F2), which is no change
    'the roll ledger': () => { a.flow = { ...(a.flow || {}), dev1: { 'Mount|Top': { kimura: [1, 1, a._epochDay()] } } }; },
    'a belt': () => { a.belts = { won: { ...(a.belts?.won || {}), blue: 1 } }; },
  };
  for (const [what, change] of Object.entries(changes)) {
    const before = h.pushes.length;
    if (!change()) a._saveProgress();
    await flush();
    assert.equal(h.pushes.length, before + 1, what + ' pushes');
  }
}));

test('a merge the cloud lacks still pushes', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A'); a.prep.local = 3;
  h.facade.pullNeural = async id => ({ userId: id, blob: { v: 2, prep: { cloud: 5 }, updatedAt: 1 } });
  await a._pullAndMerge(); await flush();
  assert.equal(h.pushes.length, 1, 'the merged blob differs from what the cloud gave');
  assert.deepEqual(h.pushes[0].value.prep, { local: 3, cloud: 5 });
}));

test('a failed push is never remembered as pushed: the same blob goes again', () => fakeTimers(async ({ flush }) => {
  for (const failure of [async () => false, async () => { throw Error('offline'); }]) {
    const h = harness(); const a = await synced(h);
    const ok = h.facade.pushNeural; let failed = 0;
    h.facade.pushNeural = async (value, userId) => { failed++; return failure(value, userId); };
    await flush();
    assert.equal(failed, 1, 'premise: the first push failed');
    h.facade.pushNeural = ok;
    a._saveProgress(); await flush();                            // nothing changed locally; the cloud never got it
    assert.equal(h.pushes.length, 1, 'the unchanged blob is pushed again');
    assert.equal(h.pushes[0].value.prep.local, 3);
  }
}));

test('after two pushes overlap, nothing is trusted', () => fakeTimers(async ({ q, flush }) => {
  const h = harness(); const a = await synced(h);
  const take = () => { const jobs = [...q.values()]; q.clear(); return jobs; };
  const ok = h.facade.pushNeural, gates = [];
  h.facade.pushNeural = async (value, userId) => { await new Promise(r => gates.push(r)); return ok(value, userId); };
  const [one] = take(); const first = one();                    // push 1 starts and waits at the network
  await new Promise(r => setImmediate(r));
  a.prep.more = 1; a._saveProgress();
  const [two] = take(); const second = two();                   // push 2 starts while push 1 is in flight
  await new Promise(r => setImmediate(r));
  gates[0](); await first;                                      // push 1 resolves first...
  gates[1](); await second;                                     // ...push 2 last, though the server may have applied 1 last
  h.facade.pushNeural = ok;
  const before = h.pushes.length;
  assert.equal(before, 2, 'premise: both pushes went');
  a._saveProgress(); await flush();
  assert.equal(h.pushes.length, before + 1, 'either push may have landed last at the server, so the unchanged blob goes again');
}));

// #360's review (ART3R12B): a push in flight across a pull may land at the server after the read (the old last-writer race), so
// the pull's read is not what the cloud holds. Before this PR the save after the pull was the echo that repaired it; now that save
// must not be skipped. C is another device's newer write: everything the in-flight push P1 carries, and one card more.
async function raced(h, { q, flush }) {
  const a = await synced(h); await flush();
  h.facade.pullNeural = async id => ({ userId: id, blob: reordered(h.pushes.at(-1).value) });
  await a._pullAndMerge(); await flush();                       // one round trip, so hydration's defaults are already in
  const take = () => { const jobs = [...q.values()]; q.clear(); return jobs; };
  const calls = [], gates = [], ok = h.facade.pushNeural;
  h.facade.pushNeural = async (value, userId) => { calls.push(JSON.parse(JSON.stringify(value))); await new Promise(r => gates.push(r)); return ok(value, userId); };
  a.prep.x = 1; a._saveProgress();
  const [job] = take(); const p1 = job();                       // P1 in flight (the flush on hide, say)
  await new Promise(r => setImmediate(r));
  const C = JSON.parse(JSON.stringify(calls[0])); C.prep.other = 9; C.updatedAt = (C.updatedAt || 0) + 1;
  let readGate; const read = new Promise(r => { readGate = r; });
  h.facade.pullNeural = async id => { await read; return { userId: id, blob: reordered(C) }; };
  const pull = a._pullAndMerge();                               // SIGNED_IN on the return: the read sees C
  await new Promise(r => setImmediate(r));
  return { a, calls, gates, p1, pull, release: () => readGate(), take };
}

test('a pull overlapping a push in flight records nothing: P1\'s response first', () => fakeTimers(async ({ q, flush }) => {
  const h = harness(); const r = await raced(h, { q, flush });
  r.gates[0](); await r.p1;                                     // P1 lands (over C, at the server) and answers first
  r.release(); await r.pull;                                    // then the pull answers with C
  const before = r.calls.length;
  for (const job of r.take()) { const done = job(); await new Promise(x => setImmediate(x)); r.gates.at(-1)?.(); await done; }
  assert.equal(r.calls.length, before + 1, 'the save after the pull pushes, as the echo did: the cloud may hold P1, not C');
  assert.equal(r.calls.at(-1).prep.other, 9);
}));

test('a pull overlapping a push in flight records nothing: the pull\'s response first', () => fakeTimers(async ({ q, flush }) => {
  const h = harness(); const r = await raced(h, { q, flush });
  r.release(); await r.pull;                                    // the pull answers with C while P1 is still in flight
  const before = r.calls.length;
  for (const job of r.take()) { job(); await new Promise(x => setImmediate(x)); }
  assert.equal(r.calls.length, before + 1, 'the save after the pull pushes: P1 may still land over C');
  for (const g of r.gates) g(); await r.p1; await flush();
}));

test('another account starts with no record: the switch builds a new instance', () => fakeTimers(async ({ flush }) => {
  // #360's review: an instance never changes account (`_applyUser` returns early on any owner change, and the host mounts a new
  // instance), so the record cannot cross accounts. Clearing it in `_invalidateCloudSync` and the `seen.userId` check are defence
  // in depth: their mutants are EQUIVALENT here, recorded in the header.
  const h = harness(); const a = await synced(h); await flush();
  const b = h.switchTo('B');
  assert.notEqual(b, a, 'the switch mounts a new instance');
  assert.equal(b._cloudSeen ?? null, null);
  await b._pullAndMerge(); await flush();
  assert.equal(h.pushes.at(-1).userId, 'B', 'B\'s first save after its own pull pushes to B');
}));

test('no skip while a push is in flight: a list added, then removed before the first push lands', () => fakeTimers(async ({ q, flush }) => {
  const h = harness(); const a = await synced(h); await flush();
  h.facade.pullNeural = async id => ({ userId: id, blob: reordered(h.pushes.at(-1).value) });
  await a._pullAndMerge(); await flush();                        // settled: the record is the cloud's, without the list
  const take = () => { const jobs = [...q.values()]; q.clear(); return jobs; };
  const calls = [], gates = [], ok = h.facade.pushNeural;
  h.facade.pushNeural = async (value, userId) => { calls.push(JSON.parse(JSON.stringify(value))); await new Promise(r => gates.push(r)); return ok(value, userId); };
  a.lists = { ...(a.lists || {}), l1: { name: 'Class', items: ['Positions/Mount'], t: 1 } }; a._saveProgress();
  const [one] = take(); const first = one(); await new Promise(r => setImmediate(r));
  const { l1, ...rest } = a.lists; a.lists = rest; a._saveProgress();
  const [two] = take(); const second = two(); await new Promise(r => setImmediate(r));
  assert.equal(calls.length, 2, 'the removal goes too: the push in flight still carries the list');
  assert.equal('l1' in (calls[1].lists || {}), false);
  for (const g of gates) g(); await first; await second;
}));

test('two devices holding one set in two orders echo nothing; a real addition still pushes', () => fakeTimers(async ({ flush }) => {
  const h = harness(); const a = await synced(h);
  a._exploredKeys = new Set(['k1', 'k2', 'k3']); a.dayLog = { [a._dayKey()]: { s: 1, k: ['d1', 'd2', 'd3'], w: 0 } };
  a.lists = { l1: { name: 'Class', items: ['n1', 'n2', 'n3'], t: 1 } }; a._saveProgress(); await flush();
  h.facade.pullNeural = async id => ({ userId: id, blob: reordered(h.pushes.at(-1).value) });
  await a._pullAndMerge(); await flush();                        // settle hydration's defaults
  const other = JSON.parse(JSON.stringify(h.pushes.at(-1).value));   // the other device: the same sets, other orders
  other.explored.reverse(); for (const d of Object.values(other.dayLog)) d.k.reverse(); other.lists.l1.items.reverse();
  h.facade.pullNeural = async id => ({ userId: id, blob: other });
  const before = h.pushes.length;
  for (let i = 0; i < 10; i++) { await a._pullAndMerge(); await flush(); }
  assert.equal(h.pushes.length, before, 'ten no-change pulls, zero pushes');
  a._exploredKeys.add('k4'); a._saveProgress(); await flush();
  assert.equal(h.pushes.length, before + 1, 'a real addition still pushes');
}));

// ── neural_signin_completed ──
function withStorage(run) {
  const old = globalThis.localStorage; const mem = memory(); globalThis.localStorage = mem;
  return Promise.resolve(run(mem)).finally(() => { globalThis.localStorage = old; });
}
const completed = h => h.tracked.filter(([e]) => e === 'neural_signin_completed');
async function subscribed(h) { await h.boot(); const a = h.get(); await a._initAuth(); return a; }

test('a tab return counts no sign-in, and still pulls', () => withStorage(() => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A'); await a._initAuth(); await flush();   // a signed-in tab
  const pulls = h.pulls.length;
  for (let i = 0; i < 2; i++) { h.listeners.at(-1)('SIGNED_IN', { id: 'A', email: 'a@example.invalid' }); await flush(); }
  assert.equal(completed(h).length, 0, 'a page load or tab return with a stored session is not a sign-in');
  assert.equal(h.pulls.length, pulls + 2, 'each tab return still pulls: it is how another device\'s progress arrives');
})));

test('a sign-in this browser started counts once, with its method and mode', () => withStorage(mem => fakeTimers(async ({ flush }) => {
  const h = harness(); const a = await subscribed(h);
  a._signinIntent('google', 'create');
  h.listeners.at(-1)('SIGNED_IN', { id: 'A', email: 'a@example.invalid' }); await flush();
  h.listeners.at(-1)('SIGNED_IN', { id: 'A', email: 'a@example.invalid' }); await flush();
  const got = completed(h).map(([, p]) => p);
  assert.deepEqual(got.map(({ method, mode }) => ({ method, mode })), [{ method: 'google', mode: 'create' }]);
  assert.equal(typeof got[0].intent_at, 'number', 'the intent\'s own stamp rides the event, so a double count can be removed in analysis');
  assert.equal(mem.getItem('bjj-neural-signin-intent'), null, 'the intent is spent');
})));

test('two tabs of one browser count one sign-in', () => withStorage(() => fakeTimers(async ({ flush }) => {
  const one = harness(), two = harness(); const a = await subscribed(one); await subscribed(two);
  a._signinIntent('email', 'login');
  one.listeners.at(-1)('SIGNED_IN', { id: 'A', email: 'a@example.invalid' });
  two.listeners.at(-1)('SIGNED_IN', { id: 'A', email: 'a@example.invalid' });   // the BroadcastChannel copy
  await flush();
  assert.equal(completed(one).length + completed(two).length, 1);
})));

test('an intent older than 30 minutes counts nothing', () => withStorage(mem => fakeTimers(async ({ flush }) => {
  const h = harness(); await subscribed(h);
  mem.setItem('bjj-neural-signin-intent', JSON.stringify({ method: 'google', mode: 'login', at: Date.now() - 31 * 60 * 1000 }));
  h.listeners.at(-1)('SIGNED_IN', { id: 'A', email: 'a@example.invalid' }); await flush();
  assert.equal(completed(h).length, 0);
  assert.equal(mem.getItem('bjj-neural-signin-intent'), null, 'and the stale intent is cleared');
})));

test('a sign-up is honoured for 24 hours; a log-in for 30 minutes', () => withStorage(mem => fakeTimers(async ({ flush }) => {
  for (const [mode, ago, counts] of [['create', 2 * 3600e3, 1], ['create', 25 * 3600e3, 0], ['login', 31 * 60e3, 0]]) {
    const h = harness(); await subscribed(h);
    mem.setItem('bjj-neural-signin-intent', JSON.stringify({ method: 'email', mode, at: Date.now() - ago }));
    h.listeners.at(-1)('SIGNED_IN', { id: 'A', email: 'a@example.invalid' }); await flush();
    assert.equal(completed(h).length, counts, mode + ' after ' + Math.round(ago / 60e3) + ' minutes');
  }
})));

test('a verified identity at start-up spends the intent too (the tab back from Google may miss SIGNED_IN)', () => withStorage(() => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.get();
  a._signinIntent('google', 'login');
  h.setIdentity({ id: 'A', email: 'a@example.invalid' });
  await a._initAuth(); await flush();                            // no SIGNED_IN reaches this tab
  h.listeners.at(-1)('SIGNED_IN', { id: 'A', email: 'a@example.invalid' }); await flush();   // and if it does, later
  assert.equal(completed(h).length, 1, 'counted once, by whichever comes first');
})));

test('where the browser has Web Locks, the intent is read and removed under one', () => withStorage(() => fakeTimers(async ({ flush }) => {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'navigator'), held = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request: async (name, cb) => { held.push(name); return cb(); } } } });
  try {
    const h = harness(); const a = await subscribed(h);
    a._signinIntent('google', 'login');
    h.listeners.at(-1)('SIGNED_IN', { id: 'A', email: 'a@example.invalid' }); await flush();
    assert.deepEqual(held, ['bjj-neural-signin-intent'], 'one lock, named for the intent');
    assert.equal(completed(h).length, 1);
  } finally { if (old) Object.defineProperty(globalThis, 'navigator', old); else delete globalThis.navigator; }
})));
