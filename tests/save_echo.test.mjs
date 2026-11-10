// v1.255.2 (the Supabase check, 2026-11-10): every tab return answered auth-js's SIGNED_IN with a pull, a save and a push of the
// merged blob, changed or not (18% or more of all saves), and counted a sign-in each time. This file pins the two fixes on the real
// app class, the real progress host and a synthetic facade (the harness of progress_owner.integration.test.mjs):
//   - a push is skipped only when the blob, without its write stamp, equals what the cloud last held for this account;
//   - every kind of local change, a merge the cloud lacks, a failed push and an overlap still push;
//   - `neural_signin_completed` counts the sign-ins this browser started, once.
// Red-proof, run by hand on the source with each mutant applied and reverted (node --test tests/save_echo.test.mjs):
//   no-echo-guard (the skip line removed) ........................ red: "a pull that brings back what this tab pushed sends nothing"
//   key-drops-moves (`moves` left out of the key too) ............ red: "every kind of local change still pushes" (a move graded)
//   key-content-blind (the key reads only `v`) ................... red: the key's own case, every change, the merge
//   pull-records-merged (the pull records the merged blob) ....... red: "a merge the cloud lacks still pushes"
//   overlap-trusted (`solo &&` removed) .......................... red: "after two pushes overlap, nothing is trusted"
//   fail-remembered (recorded before the await, no re-pull) ...... red: "a failed push is never remembered as pushed"
//   signin-every-event (count every SIGNED_IN, as before) ........ red: "a tab return counts no sign-in"
//   intent-kept (the intent not removed) ......................... red: "a sign-in this browser started counts once"
//   intent-ageless (the 30-minute bound removed) ................. red: "an intent older than 30 minutes counts nothing"
// EQUIVALENT, recorded: key-drops-settings (a setting also moves its `settingsAt` stamp, which the key keeps); either half of
// the failed-push guard alone (`_cloudSeen` set only on success; a failure forces a re-pull)
// is enough by itself, so a mutant of one half survives; `fail-remembered` breaks both. And the account check on `_cloudSeen`
// (`seen.userId === userId`) is defence in depth: every account pulls before its first push, and the pull replaces the record.
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
  return { mem, host, facade, get, switchTo, pushes, pulls, tracked, listeners, boot: () => host.bootstrap() };
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
    'the roll ledger': () => { a.flow = { ...(a.flow || {}), dev1: { 'Mount|Top': { kimura: [1, 1, 1] } } }; },
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

test('another account never compares against the previous one\'s blob', () => fakeTimers(async ({ flush }) => {
  const h = harness(); const a = await synced(h); await flush();
  assert.equal(h.pushes.length, 1);
  const b = h.switchTo('B');
  assert.equal(b._cloudSeen ?? null, null, 'the switch forgets what A\'s cloud held');
  await b._pullAndMerge(); await flush();
  assert.equal(h.pushes.at(-1).userId, 'B', 'B\'s first save after its own pull pushes to B');
  assert.ok(h.pushes.every((p, i) => i === 0 || p.userId === 'B'), 'nothing after the switch goes to A');
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
  assert.deepEqual(completed(h).map(([, p]) => p), [{ method: 'google', mode: 'create' }]);
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
