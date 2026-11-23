// A MOVE BETWEEN LISTS, THROUGH THE APP'S OWN SYNC (LISTS-R, Slice 2). tests/share_lists_store.test.mjs proves the pure
// rule (`ngMergeLists` with the cells); this file proves it where it runs: the real app class, the real progress host and a
// synthetic facade (save_echo's harness, copied as is), against a cloud that HOLDS another device's lists and cells. An empty
// fake cloud would prove nothing (the stored-key checklist; PR #375's lesson).
//   1. a move pulled into a device that still holds the old lists: the item is in the target only, and the cells come along;
//   2. a move made BEFORE this device's first pull: the push waits for the pull, and the merge keeps the other device's cells;
//   3. an older device pushed the union alone and a STALE copy of the cells: the next pull of a device that holds the cells
//      heals the lists and pushes the cells back (its merge differs from the cloud);
//   4. an account that never moves an item writes no `listItemAt`, so its blob is the one it saved before;
//   5. the cells and the order records pass every captured older validator (tests/artifacts/progress_validators.json);
// and the ORDER (ORDER-OK, `listOrderAt`, one record per list: [t, [ids]], the later stamp wins), the same way:
//   6. a reorder pulled into a device holding the old order: the list follows the record, and a reorder alone is pushed (the
//      no-echo key sees the record);
//   7. a reorder made before the first pull waits for it; an item the other device added meanwhile lands after the record's;
//   8. an older device pushed its own order of the lists and a STALE record: the next pull of a device holding the newer
//      record heals the order and pushes the record back;
//   9. an item added back to a list whose record still names it stays where it was added, through a reload and a merge
//      (`_keepListOrder`), and a delete's Undo takes the record's newer order rather than overwriting it;
//  10. an account that never reorders writes no `listOrderAt`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = text => text.replace(/^export (function|const|let|var|class) /gm, '$1 ');
// rating.src.js (v1.276.0) rides along: the merge's `belts.lvl` line calls it, and the bundle concatenates it too
const dependencies = ['lists-codec', 'lists', 'belt', 'rating', 'challenge-definitions', 'challenge-engine'].map(name => strip(read('../neural/src/' + name + '.src.js'))).join('\n');
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


// THE DOM, STUBBED (never the state): the fake timers below run a move's 90-second Undo expiry at once, and it repaints the
// list surfaces through `document`, which node has not. Nothing here reads a surface.
globalThis.document = globalThis.document || { querySelectorAll: () => [], querySelector: () => null, body: null, activeElement: null };

const blobOf = (lists, cells, order) => ({ v: 2, lists, ...(cells ? { listItemAt: cells } : {}), ...(order ? { listOrderAt: order } : {}), updatedAt: 1 });
/** The ACCOUNT's stored record (the envelope's `blob` under `…:account:<id>:progress`; the guest's row is another). */
const stored = (mem, id = 'A') => { const v = mem.rows.get('bjj-neural-owner:account:' + id + ':progress'); return v ? JSON.parse(v).blob : null; };
const L = (items, t, name = "L") => ({ name, items, t });
const itemsOf = lists => Object.fromEntries(Object.keys(lists).sort().map(k => [k, lists[k].items.slice().sort()]));

test('1. a move pulled into a device that still holds the old lists: the item is in the target only', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const b = h.switchTo('A');
  b.lists = { S: L(['X', 'Y'], 100, 'Monday'), T: L(['Z'], 90, 'Guard') };   // B never saw the move
  const cells = { S: { X: [201, 0] }, T: { X: [201, 1] } };
  h.facade.pullNeural = async id => ({ userId: id, blob: blobOf({ S: L(['Y'], 201, 'Monday'), T: L(['Z', 'X'], 202, 'Guard') }, cells) });
  assert.equal(await b._pullAndMerge(), true); await flush();
  assert.deepEqual(itemsOf(b.lists), { S: ['Y'], T: ['X', 'Z'] });
  assert.deepEqual(b.listItemAt, cells, 'the cells come along');
  const stored = JSON.parse([...h.mem.rows.values()].find(v => v.includes('"listItemAt"')) || 'null');
  assert.ok(stored, 'and they are saved with the record');
}));

test('2. a move made before the first pull waits for it, and the merge keeps the other device\'s cells', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const b = h.switchTo('A');
  b.lists = { S: L(['X', 'Y'], 100, 'Monday'), T: L(['Z'], 90, 'Guard'), U: L(['W'], 80, 'Open mat') };
  // the cloud: another device moved X from S to T
  const theirs = { S: { X: [201, 0] }, T: { X: [201, 1] } };
  let pulled = 0; const order = [];
  const push = h.facade.pushNeural; h.facade.pushNeural = async (v, u) => { order.push('push'); return push(v, u); };
  h.facade.pullNeural = async id => { pulled++; order.push('pull'); return { userId: id, blob: blobOf({ S: L(['Y'], 201, 'Monday'), T: L(['Z', 'X'], 202, 'Guard'), U: L(['W'], 80, 'Open mat') }, theirs) }; };
  assert.equal(b._pulled, false, 'premise: this device has not pulled yet');
  const pushedBefore = h.pushes.length;
  const r = b.moveListItem('Y', 'S', 'U', 'menu');
  assert.equal(r.moved, true);
  await flush();
  assert.ok(pulled >= 1, 'the save pulled');
  assert.equal(order[0], 'pull', 'before any push: ' + order.join(' → '));
  assert.ok(h.pushes.length > pushedBefore, 'and then pushed');
  const pushed = h.pushes.at(-1);
  assert.deepEqual(itemsOf(pushed.value.lists), { T: ['X', 'Z'], U: ['W', 'Y'] }, 'both moves stand; S, emptied by them, is gone');
  assert.deepEqual(pushed.value.listItemAt.S.X, [201, 0], "the other device's cells are kept");
  assert.deepEqual(pushed.value.listItemAt.T.X, [201, 1]);
  assert.equal(pushed.value.listItemAt.S.Y[1], 0, 'and this move\'s cells are there');
  assert.equal(pushed.value.listItemAt.U.Y[1], 1);
}));

test('3. an older device pushed the union and a STALE copy of the cells: the next pull of a device that holds them heals both', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A');
  a.prep.local = 1; await a._pullAndMerge(); await flush();          // synced against an empty account
  a.lists = { S: L(['X', 'Y'], 100, 'Monday'), T: L(['Z'], 90, 'Guard') };
  assert.equal(a.moveListItem('X', 'S', 'T', 'menu').moved, true);
  await flush();
  const mine = JSON.parse(JSON.stringify(a.listItemAt));
  // an older client pulled before the move, kept ITS cells (one old cell, no X cells: its extras merge keeps its own copy)
  // and its union (X back in S), and pushed both
  const stale = { Q: { R: [50, 0] } };
  h.facade.pullNeural = async id => ({ userId: id, blob: blobOf({ S: L(['X', 'Y'], 300, 'Monday'), T: L(['Z', 'X'], 300, 'Guard') }, stale) });
  const before = h.pushes.length;
  assert.equal(await a._pullAndMerge(), true); await flush();
  assert.deepEqual(itemsOf(a.lists), { S: ['Y'], T: ['X', 'Z'] }, 'X is out of S again');
  assert.ok(h.pushes.length > before, 'and the healed record is pushed back');
  const pushed = h.pushes.at(-1).value;
  assert.deepEqual(pushed.listItemAt.S.X, mine.S.X, 'with the cells the stale copy had lost');
  assert.deepEqual(pushed.listItemAt.Q, stale.Q, "and the older device's own cell kept");
}));

test('4. an account that never moves an item writes no listItemAt', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A');
  a.prep.local = 1; await a._pullAndMerge(); await flush();
  a.lists = { S: L(['X'], 100) }; a._saveProgress(); await flush();
  for (const p of h.pushes) assert.equal('listItemAt' in p.value, false);
  for (const v of h.mem.rows.values()) assert.equal(String(v).includes('listItemAt'), false);
}));

test('5. the cells and the order records pass every captured older validator', () => {
  const captured = JSON.parse(read('./artifacts/progress_validators.json')).clients;
  assert.ok(Object.keys(captured).length >= 2, 'premise: the older clients were captured');
  const blob = blobOf({ T: L(['Z', 'X'], 202, 'Guard') }, { S: { X: [201, 0] }, T: { X: [201, 1] } }, { T: [203, ['Z', 'X']] });
  for (const [name, c] of Object.entries(captured)) {
    const validate = new Function(c.validator + '\nreturn ngProgressValidateBlob;')();
    assert.doesNotThrow(() => validate(JSON.parse(JSON.stringify(blob))), name + ' accepts a record with cells and an order record');
  }
});

test('6. a reorder pulled into a device holding the old order: the list follows the record; a reorder alone is pushed', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const b = h.switchTo('A');
  b.lists = { T: L(['X', 'Y', 'Z'], 90, 'Guard') };                            // B holds the old order
  // stamped by a device whose clock runs an hour AHEAD: this device's next reorder must still be later than it, or the next
  // merge would put the old order back under the player's finger
  const ahead = Date.now() + 3_600_000;
  h.facade.pullNeural = async id => ({ userId: id, blob: reordered(blobOf({ T: L(['X', 'Y', 'Z'], 90, 'Guard') }, null, { T: [ahead, ['Z', 'X', 'Y']] })) });
  assert.equal(await b._pullAndMerge(), true); await flush();
  assert.deepEqual(b.lists.T.items, ['Z', 'X', 'Y'], 'the order of the record, not the copy');
  assert.deepEqual(b.listOrderAt.T, [ahead, ['Z', 'X', 'Y']], 'the record comes along');
  assert.deepEqual(stored(h.mem).listOrderAt.T, [ahead, ['Z', 'X', 'Y']], 'and is saved with the record');
  assert.equal(b.lists.T.t, 90, "a reorder never bumps the list's t");
  // a reorder alone, on a synced device: the no-echo key differs, so it is pushed
  const before = h.pushes.length, key0 = ngProgressCloudKey(b._progressBlob());
  assert.equal(b.moveListItemBy('T', 'Y', -1), true);
  assert.notEqual(ngProgressCloudKey(b._progressBlob()), key0, 'the key sees a reorder');
  await flush();
  assert.ok(h.pushes.length > before, 'and it is pushed');
  const pushed = h.pushes.at(-1).value.listOrderAt.T;
  assert.deepEqual(pushed[1], ['Z', 'Y', 'X']);
  assert.ok(pushed[0] > ahead, 'later than every record held, a clock ahead included');
  // the MERGE'S OWN OUTPUT carries the order in `lists` too: another tab of this browser stores it as it is
  // (`semanticMerge`), and an older build open there reads `lists` only
  const mine = blobOf({ T: L(['X', 'Y', 'Z'], 90, 'Guard') }, null, { T: [100, ['X', 'Y', 'Z']] });
  const theirs = blobOf({ T: L(['Z', 'X', 'Y'], 90, 'Guard') }, null, { T: [200, ['Z', 'X', 'Y']] });
  assert.deepEqual(b._mergeProgressBlobs(mine, theirs).lists.T.items, ['Z', 'X', 'Y'], "the merged record's lists are in the winning order");
}));

test('7. a reorder made before the first pull waits for it; what the other device added lands after the record', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const b = h.switchTo('A');
  b.lists = { T: L(['X', 'Y', 'Z'], 90, 'Guard'), U: L(['P', 'Q'], 80, 'Open mat') };
  const order = [];
  const push = h.facade.pushNeural; h.facade.pushNeural = async (v, u) => { order.push('push'); return push(v, u); };
  // the cloud: the other device added W to Guard (stamped before this device's reorder) and reordered Open mat
  h.facade.pullNeural = async id => { order.push('pull'); return { userId: id, blob: blobOf({ T: L(['X', 'Y', 'Z', 'W'], 95, 'Guard'), U: L(['P', 'Q'], 80, 'Open mat') }, null, { U: [100, ['Q', 'P']] }) }; };
  assert.equal(b._pulled, false, 'premise: this device has not pulled yet');
  assert.equal(b.moveListItemBy('T', 'Z', -2), true);                         // Guard: Z X Y
  await flush();
  assert.equal(order[0], 'pull', 'before any push: ' + order.join(' → '));
  const pushed = h.pushes.at(-1).value;
  assert.deepEqual(pushed.lists.T.items, ['Z', 'X', 'Y', 'W'], "this device's order, the other's add after it");
  assert.deepEqual(pushed.lists.U.items, ['Q', 'P'], "the other device's reorder of another list stands");
  assert.deepEqual(pushed.listOrderAt.U, [100, ['Q', 'P']]);
  assert.deepEqual(pushed.listOrderAt.T[1], ['Z', 'X', 'Y']);
}));

test('8. an older device pushed its own order and a STALE record: the next pull of a device holding the newer one heals both', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A');
  a.prep.local = 1; await a._pullAndMerge(); await flush();
  a.lists = { T: L(['X', 'Y', 'Z'], 90, 'Guard') };
  assert.equal(a.moveListItemBy('T', 'Z', -2), true); await flush();          // Z X Y, recorded
  const mine = a.listOrderAt.T.slice();
  // an older client pulled before the reorder: it kept ITS record (extras merge: its own copy wins) and its own order
  const stale = { T: [50, ['X', 'Y', 'Z']] };
  h.facade.pullNeural = async id => ({ userId: id, blob: blobOf({ T: L(['X', 'Y', 'Z'], 400, 'Guard') }, null, stale) });
  const before = h.pushes.length;
  assert.equal(await a._pullAndMerge(), true); await flush();
  assert.deepEqual(a.lists.T.items, ['Z', 'X', 'Y'], "the older device's order is not adopted");
  assert.ok(h.pushes.length > before, 'and the healed record is pushed back');
  assert.deepEqual(h.pushes.at(-1).value.listOrderAt.T, mine, 'with the newer record');
  // and a LOAD of what an older build saved (its own order of the list, the record kept untouched as an extra): the list
  // takes the record's order before anything merges
  const env = JSON.parse(h.mem.rows.get('bjj-neural-owner:account:A:progress'));
  env.blob.lists.T.items = ['X', 'Y', 'Z'];
  h.mem.rows.set('bjj-neural-owner:account:A:progress', JSON.stringify(env));
  const h2 = harness(h.mem); await h2.boot(); const r = h2.switchTo('A');
  assert.deepEqual(r.lists.T.items, ['Z', 'X', 'Y'], "an older build's saved order is not adopted at load either");
}));

test('9. an item added back to a list whose record names it stays where it was added, through a reload and a merge', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A');
  a.prep.local = 1; await a._pullAndMerge(); await flush();
  // a three-technique graph: addToList refuses a node the graph does not hold (graph data is input here, not state)
  const ids = ['Transitions/X', 'Transitions/Y', 'Transitions/Z'];
  const graph = inst => { inst.nodes = ids.map(id => ({ id, t: id.slice(12), ty: 'transitions', rep: true })); inst._idIndex = new Map(ids.map((id, i) => [id, i])); };
  graph(a);
  const [X, Y, Z] = ids;
  a.lists = { T: L([X, Y, Z], 90, 'Guard') };
  assert.equal(a.moveListItemBy('T', Z, -2), true);                           // Z X Y, recorded
  const old = a.listOrderAt.T.slice();
  assert.equal(a.removeListItem(X, 'T'), true);
  assert.equal(a.addToList(X, 'T').added, true);                              // Z Y X: added back at the end
  assert.deepEqual(a.lists.T.items, [Z, Y, X]);
  assert.deepEqual(a.listOrderAt.T[1], [Z, Y, X], 'the record follows what is shown');
  a._flushSave(); await flush();
  // a reload: the stored record is read again
  const h2 = harness(h.mem); await h2.boot(); const r = h2.switchTo('A'); graph(r);
  assert.deepEqual(r.lists.T.items, [Z, Y, X], 'after a reload, still at the end');
  // a merge with a cloud copy that holds the older record
  h2.facade.pullNeural = async id => ({ userId: id, blob: blobOf({ T: L([Z, X, Y], 90, 'Guard') }, null, { T: old }) });
  assert.equal(await r._pullAndMerge(), true); await flush();
  assert.deepEqual(r.lists.T.items, [Z, Y, X], 'after a merge with the older record, still at the end');
  // a MOVE back into the list (not its Undo) puts it at the end too, and the record follows
  r.lists.S = L([], 50, 'Monday');
  assert.equal(r.moveListItem(Y, 'T', 'S', 'menu').moved, true);              // T: Z X
  assert.equal(r.moveListItem(Y, 'S', 'T', 'menu').moved, true);              // T: Z X Y, at the end
  assert.deepEqual(r.lists.T.items, [Z, X, Y]);
  assert.deepEqual(r.listOrderAt.T[1], [Z, X, Y], 'the record follows a move in');
  // a delete's Undo takes the record's NEWER order (another device reordered the list meanwhile)
  r.deleteList('T');
  r.listOrderAt = { T: [r.listOrderAt.T[0] + 10, [X, Y, Z]] };
  assert.equal(r.undoDeleteList(), true);
  assert.deepEqual(r.lists.T.items, [X, Y, Z], "the delete's Undo shows the newer order");
  assert.deepEqual(r.listOrderAt.T[1], [X, Y, Z], 'and does not overwrite it');
}));

test('10. an account that never reorders writes no listOrderAt', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A');
  a.prep.local = 1; await a._pullAndMerge(); await flush();
  a.lists = { S: L(['X', 'Y'], 100), T: L(['Z'], 90) };
  assert.equal(a.moveListItem('X', 'S', 'T', 'menu').moved, true);            // a move writes cells, not an order
  a._saveProgress(); await flush();
  for (const p of h.pushes) assert.equal('listOrderAt' in p.value, false);
  for (const v of h.mem.rows.values()) assert.equal(String(v).includes('listOrderAt'), false);
}));
