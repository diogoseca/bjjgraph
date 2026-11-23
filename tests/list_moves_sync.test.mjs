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
//  10. an account that never reorders writes no `listOrderAt`;
//  11. THE GUEST JOIN, the third merge path (`ngProgressGuestMerge`; the guest part keeps both fields): a guest's move and
//      reorder join the account at sign-in, and an account's move survives a guest copy that holds the old lists.
//  12. a PLAIN LOAD heals an older build's saved re-union (the cells are applied at load, before any pull);
//  13. a star re-add after a move writes an "in" cell, so the item stays in that list through a reload and on another
//      device (MOVE-R1 F1: both were reader's mutants that every unit let through).
//  14. a delete's Undo UNIONS its snapshot into a list a merge brought back meanwhile (another device's adds and its move
//      into the list stay; MOVE-R1 F4, a loss dev already had).
//  15. a plain add into a list with an order record writes nothing, so another device's unseen Move up survives it; an add
//      that the id order would put elsewhere rewrites the record; two devices that each add after a reorder end with one
//      order (MOVE-R1 F2, MOVE-R2 R3: the record's, then what it does not name by id).
//  16. a move's Undo puts both lists' recency back (MOVE-R1 F6): a source the move emptied comes back with its own `t`, and
//      a source or a target it touched takes its `t` from before the move.
//  17. A HEAL-ONLY PUSH BACKS OFF (MOVE-R1 F3, MOVE-R2 R2): a cloud that keeps going back to a stale copy (what a build
//      older than v1.296.1 does) gets the first heal at once, then one only after 1 min, 2, 4 … up to an hour, then hourly;
//      a real change pushes at once and starts the waits over;
//  18. a move is stamped later than every cell this device holds, one stamped by a clock an hour ahead included (else the
//      move's "out" would lose to an older "in" at the next merge, and the move would come back as a copy);
//  19. A REAL CHANGE IS NEVER TAKEN FOR A HEAL (MOVE-R2 R1): a racing write that erased a technique this tab added, twice in
//      a row, is re-pushed at once both times (the cloud lacked more than the two list fields), with the clock stopped.
//  20. AND A BOUND (MOVE-R2, flagged): from the third re-push in a row an unchanged state backs off like a heal (that heal
//      at once, then the waits), so two devices that keep overwriting each other's view can never push for ever; a real
//      change resets the count;
//  21-23. THE READER'S THIRD READ (three mutants with no visible effect in 3,000 runs, pinned here): a cloud behind only in
//      the ORDER record is a heal (R1m2); a fields-only heal resets the run (B2); and a real change resets it, so a real
//      change erased twice right after the bound was hit is re-pushed at once both times (B4).
// NOT KILLED HERE, and why (MOVE-R1, the reader's mutants.py): M13, the source cell stamped one LATER than the target's,
// survives every unit. It is equivalent in effect: both cells are still later than everything this device holds, so the
// move stands either way. Nothing here covers it; nothing needs to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = text => text.replace(/^export (function|const|let|var|class) /gm, '$1 ');
// rating.src.js (v1.276.0) rides along: the merge's `belts.lvl` line calls it, and the bundle concatenates it too
const dependencies = ['lists-codec', 'lists', 'belt', 'rating', 'challenge-definitions', 'challenge-engine'].map(name => strip(read('../neural/src/' + name + '.src.js'))).join('\n');
const ownerSource = strip(read('../neural/src/progress-owner.src.js'));
const source = read('../neural/src/app.src.jsx');
const Component = new Function('DCLogic', 'React', ownerSource + '\n' + dependencies + '\n' + source + '\nreturn { Component, ngProgressCreateHost, ngProgressCloudKey, ngProgressGuestMerge };')(class {}, { createRef: () => ({ current: null }) });
const { ngProgressCreateHost, ngProgressCloudKey, ngProgressGuestMerge } = Component;

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

/** What a build older than v1.296.1 pushes over this tab: this tab's last push as that build merged it (every other field
 *  the same), its lists re-unioned (`lists`), and the two list fields it never took (its own, here none). */
const olderCopyOf = (pushed, lists) => { const b = JSON.parse(JSON.stringify(pushed)); delete b.listItemAt; delete b.listOrderAt; for (const k of Object.keys(lists)) b.lists[k].items = lists[k]; return b; };
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

test('11. the guest join: a guest\'s move and order join the account; an account\'s move survives a guest copy holding the old lists', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A');
  a.prep.local = 1; await a._pullAndMerge(); await flush();
  const merge = (l, i) => a._mergeProgressBlobs(l, i);
  const old = { S: L(['X', 'Y'], 100, 'Monday'), T: L(['Z'], 90, 'Guard') };
  const moved = { S: L(['Y'], 201, 'Monday'), T: L(['Z', 'X'], 202, 'Guard') };
  const cells = { S: { X: [201, 0] }, T: { X: [201, 1] } }, order = { T: [203, ['X', 'Z']] };
  // the guest moved X into Guard and put it first; the account still holds the old lists
  const joined = ngProgressGuestMerge(merge, blobOf(old), blobOf(moved, cells, order));
  assert.deepEqual(joined.lists.S.items, ['Y'], "the guest's move joins: out of Monday");
  assert.deepEqual(joined.lists.T.items, ['X', 'Z'], "…into Guard, in the guest's order");
  assert.deepEqual(joined.listItemAt, cells); assert.deepEqual(joined.listOrderAt, order);
  // the account moved it; a guest copy made before (the old lists, no records) does not bring it back
  const kept = ngProgressGuestMerge(merge, blobOf(moved, cells, order), blobOf(old));
  assert.deepEqual(kept.lists.S.items, ['Y'], "the account's move stands");
  assert.deepEqual(kept.lists.T.items, ['X', 'Z']);
}));

test('12. a plain load heals an older build\'s saved re-union: the cells are applied before any pull', () => fakeTimers(async ({ flush }) => {
  const mem = memory();
  // what an older build saved: X moved S -> T here earlier (the cells), then its own union put X back in S
  const blob = { v: 2, lists: { S: L(['X', 'Y'], 300, 'Monday'), T: L(['Z', 'X'], 300, 'Guard') }, listItemAt: { S: { X: [201, 0] }, T: { X: [201, 1] } }, updatedAt: 1 };
  mem.rows.set('bjj-neural-owner:account:A:progress', JSON.stringify({ format: 'bjj-progress-owner-v1', owner: { kind: 'account', id: 'A' }, blob, savedAt: 1 }));
  const h = harness(mem); await h.boot(); const a = h.switchTo('A');
  assert.deepEqual(itemsOf(a.lists), { S: ['Y'], T: ['X', 'Z'] }, 'at load: X is in Guard only, before any pull');
  await flush();
}));

test('13. a star re-add after a move writes an "in" cell: the item stays through a reload and on another device', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A');
  a.prep.local = 1; await a._pullAndMerge(); await flush();
  const ids = ['Transitions/X', 'Transitions/Y', 'Transitions/Z'];
  const graph = inst => { inst.nodes = ids.map(id => ({ id, t: id.slice(12), ty: 'transitions', rep: true })); inst._idIndex = new Map(ids.map((id, i) => [id, i])); };
  graph(a);
  const [X, Y, Z] = ids;
  a.lists = { S: L([X, Y], 100, 'Monday'), T: L([Z], 90, 'Guard') };
  assert.equal(a.moveListItem(X, 'S', 'T', 'menu').moved, true);              // X: out of Monday, into Guard
  assert.equal(a.addToList(X, 'S').added, true);                               // then the star puts it back in Monday
  assert.equal(a.listItemAt.S[X][1], 1, 'the re-add wrote "in", later than the move\'s "out"');
  a._flushSave(); await flush();
  const h2 = harness(h.mem); await h2.boot(); const r = h2.switchTo('A'); graph(r);
  assert.deepEqual(itemsOf(r.lists), { S: [X, Y].sort(), T: [X, Z].sort() }, 'after a reload, in both lists');
  // and on another device that still holds the move's cells only
  const other = blobOf({ S: L([Y], 101, 'Monday'), T: L([Z, X], 101, 'Guard') }, { S: { [X]: [a.listItemAt.S[X][0] - 1, 0] }, T: { [X]: [a.listItemAt.S[X][0] - 1, 1] } });
  const merged = a._mergeProgressBlobs(other, a._progressBlob());
  assert.deepEqual(itemsOf(merged.lists), { S: [X, Y].sort(), T: [X, Z].sort() }, 'on the other device, in both lists');
}));

test('14. a delete\'s Undo unions its snapshot into a list a merge brought back: the other device\'s adds and its move stay', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A');
  a.prep.local = 1; await a._pullAndMerge(); await flush();
  a.lists = { S: L(['B', 'E'], 100, 'Monday'), T: L(['A'], 100, 'Guard') };
  a._flushSave(); await flush();
  a.deleteList('T');                                                          // the Undo row holds the snapshot: Guard = [A]
  assert.equal(a.lists.T, undefined);
  // the other device still held Guard: it added C and D to it, and MOVED B into it from Monday
  h.facade.pullNeural = async id => ({ userId: id, blob: blobOf({ S: L(['E'], 300, 'Monday'), T: L(['A', 'C', 'D', 'B'], 300, 'Guard') }, { S: { B: [300, 0] }, T: { B: [300, 1] } }) });
  // (no flush before the Undo: these fake timers would run its 90-second expiry at once)
  assert.equal(await a._pullAndMerge(), true);
  assert.deepEqual(itemsOf(a.lists), { S: ['E'], T: ['A', 'B', 'C', 'D'] }, 'premise: the merge brought Guard back, with more in it');
  assert.equal(a.undoDeleteList(), true, 'premise: the Undo is still offered');
  assert.deepEqual(itemsOf(a.lists), { S: ['E'], T: ['A', 'B', 'C', 'D'] }, 'the Undo keeps every technique the list came back with');
  assert.deepEqual(a.lists.T.items.slice(0, 1), ['A'], "the snapshot's own items first");
  await flush();
  const pushed = h.pushes.at(-1).value;
  assert.deepEqual(itemsOf(pushed.lists), { S: ['E'], T: ['A', 'B', 'C', 'D'] }, 'and the push carries them all');
}));

test('15. a plain add writes no record, so an unseen Move up survives it; an add out of id order does write; one order for two adds', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A');
  a.prep.local = 1; await a._pullAndMerge(); await flush();
  const ids = ['Transitions/A', 'Transitions/B', 'Transitions/C', 'Transitions/D', 'Transitions/E', 'Transitions/F'];
  a.nodes = ids.map(id => ({ id, t: id.slice(12), ty: 'transitions', rep: true })); a._idIndex = new Map(ids.map((id, i) => [id, i]));
  const [A, B, C, D, E, F] = ids;
  // (a) both devices hold Guard = C A B under one record; the OTHER device moves B up (C B A), unseen here; this one adds F
  a.lists = { T: L([C, A], 100, 'Guard') };
  a.listOrderAt = { T: [200, [C, A, B]] }; a.lists.T.items.push(B);
  const before = JSON.stringify(a.listOrderAt);
  assert.equal(a.addToList(F, 'T').added, true);
  assert.equal(JSON.stringify(a.listOrderAt), before, 'a plain add that lands where the id order puts it writes no record');
  const theirs = blobOf({ T: L([C, B, A], 100, 'Guard') }, null, { T: [300, [C, B, A]] });
  const here = a._mergeProgressBlobs(a._progressBlob(), theirs), there = a._mergeProgressBlobs(theirs, a._progressBlob());
  assert.deepEqual(here.lists.T.items, [C, B, A, F], "the other device's Move up survives the add");
  assert.deepEqual(there.lists.T.items, here.lists.T.items, 'one order on both devices');
  // (b) an add among items the record does not name, out of id order: Guard = B A E under [B, A]; adding D shows B A E D,
  //     which [B, A] derives as B A D E: the record is rewritten to what is shown
  a.lists = { T: L([B, A, E], 100, 'Guard') }; a.listOrderAt = { T: [400, [B, A]] };
  assert.equal(a.addToList(D, 'T').added, true);
  assert.deepEqual(a.listOrderAt.T[1], [B, A, E, D], 'the record follows what is shown');
  assert.ok(a.listOrderAt.T[0] > 400);
  // (c) two devices each add one after the reorder, neither writing: one order, the record's then by id
  const mine = blobOf({ T: L([B, A, C], 100, 'Guard') }, null, { T: [500, [B, A]] }), other = blobOf({ T: L([B, A, F], 100, 'Guard') }, null, { T: [500, [B, A]] });
  assert.deepEqual(a._mergeProgressBlobs(mine, other).lists.T.items, [B, A, C, F]);
  assert.deepEqual(a._mergeProgressBlobs(other, mine).lists.T.items, [B, A, C, F]);
}));

test('16. a move\'s Undo puts both lists\' recency back: an emptied source, a touched source, and a target', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A');
  a.prep.local = 1; await a._pullAndMerge(); await flush();
  // an emptied source: Solo held only X
  a.lists = { Solo: L(['X'], 100, 'Solo'), T: L(['Z'], 90, 'Guard'), U: L(['W'], 95, 'Open mat') };
  assert.equal(a.moveListItem('X', 'Solo', 'T', 'menu').emptied, true);
  assert.equal(a.undoMoveListItem(), true);
  assert.equal(a.lists.Solo.t, 100, 'the emptied source comes back with its own t (not at the top)');
  assert.equal(a.lists.T.t, 90, "and the target's t is its own again");
  assert.deepEqual([a.listItemAt.Solo.X[1], a.listItemAt.T.X[1]], [1, 0], "the Undo's cells: in the source again, out of the target");
  // a source it did not empty, and a target that had the item already
  a.lists = { S: L(['X', 'Y'], 100, 'Monday'), T: L(['Z', 'X'], 90, 'Guard') };
  assert.equal(a.moveListItem('X', 'S', 'T', 'menu').already, true);
  assert.ok(a.lists.T.t > 100, 'premise: the move lifted the target to the top');
  assert.equal(a.undoMoveListItem(), true);
  assert.deepEqual([a.lists.S.t, a.lists.T.t], [100, 90], 'both back where recency had them');
  assert.deepEqual(itemsOf(a.lists), { S: ['X', 'Y'], T: ['X', 'Z'] });
}));

test('17. a heal-only push backs off: once at once, then after 1 min, 2 min …; a real change pushes at once and resets', () => fakeTimers(async ({ flush }) => {
  const realNow = Date.now; let now = 1795400000000; Date.now = () => now;
  try {
    const h = harness(); await h.boot(); const a = h.switchTo('A');
    a.prep.local = 1; await a._pullAndMerge(); await flush();
    a.lists = { S: L(['X', 'Y'], 100, 'Monday'), T: L(['Z'], 90, 'Guard') };
    assert.equal(a.moveListItem('X', 'S', 'T', 'menu').moved, true); await flush();
    // the cloud goes back, for good, to what an older build pushes on every pull: its union (X back in Monday, and in Guard,
    // where it pulled it from) without the move's cells, which it never took. Only the two list fields are behind.
    const stale = olderCopyOf(h.pushes.at(-1).value, { S: ['X', 'Y'], T: ['Z', 'X'] });
    h.facade.pullNeural = async id => ({ userId: id, blob: JSON.parse(JSON.stringify(stale)) });
    const pushesAfter = async (ms) => { now += ms; const n = h.pushes.length; assert.equal(await a._pullAndMerge(), true); await flush(); return h.pushes.length - n; };
    // the first pull after a change also settles `belts` (`_afterPullLevel`): its push carries something new, as it should
    await pushesAfter(1000);
    assert.equal(await pushesAfter(1000), 1, 'the first heal goes at once');
    assert.deepEqual(itemsOf(h.pushes.at(-1).value.lists), { S: ['Y'], T: ['X', 'Z'] }, 'and it carries the move');
    assert.equal(await pushesAfter(1000), 0, 'the next, 1 s later, waits');
    assert.equal(await pushesAfter(57000), 0, '…still inside the first minute');
    assert.equal(await pushesAfter(2000), 1, 'after 1 min: one heal');
    assert.equal(await pushesAfter(61000), 0, 'the wait is now 2 min');
    assert.equal(await pushesAfter(60000), 1, 'after 2 min: one heal');
    assert.equal(await pushesAfter(1000), 0);
    // the waits double up to an HOUR and stay there (MOVE-R2 R2: a day's cap left a fresh device wrong for up to a day)
    let since = 1000;                                                          // ms since the last heal
    for (const min of [4, 8, 16, 32, 60, 60]) {
      assert.equal(await pushesAfter(min * 60000 - since - 1000), 0, 'nothing before ' + min + ' min');
      assert.equal(await pushesAfter(1000), 1, 'one heal after ' + min + ' min');
      since = 0;
    }
    // a real change on this device pushes at once, and the waits start over
    a.lists.T.items.push('W'); a._saveProgress(); await flush();
    assert.ok(h.pushes.at(-1).value.lists.T.items.includes('W'), 'a real change goes at once');
    // the older build pulls that, re-unions it (W comes with it), and pushes its copy over it again
    const withW = olderCopyOf(h.pushes.at(-1).value, { S: ['X', 'Y'], T: h.pushes.at(-1).value.lists.T.items.concat(['X']).filter((v, i, a) => a.indexOf(v) === i) });
    h.facade.pullNeural = async id => ({ userId: id, blob: JSON.parse(JSON.stringify(withW)) });
    assert.equal(await pushesAfter(1000), 1, 'and the next heal is a first one again: at once');
    assert.equal(await pushesAfter(1000), 0, 'then it waits again');
    assert.deepEqual(itemsOf(a.lists), { S: ['Y'], T: ['W', 'X', 'Z'] }, 'nothing is lost on this device throughout');
  } finally { Date.now = realNow; }
}));

test('18. a move is stamped later than every cell held, one from a clock an hour ahead included', () => fakeTimers(async ({ flush }) => {
  const h = harness(); await h.boot(); const a = h.switchTo('A');
  a.prep.local = 1; await a._pullAndMerge(); await flush();
  const ahead = Date.now() + 3_600_000;
  // another device, its clock an hour ahead, moved X INTO Monday; this device then moves it out again
  a.lists = { S: L(['X', 'Y'], 100, 'Monday'), T: L(['Z'], 90, 'Guard') };
  a.listItemAt = { S: { X: [ahead, 1] } };
  assert.equal(a.moveListItem('X', 'S', 'T', 'menu').moved, true);
  assert.ok(a.listItemAt.S.X[0] > ahead, 'the move is later than the cell from the clock ahead');
  const back = a._mergeProgressBlobs(a._progressBlob(), blobOf({ S: L(['X', 'Y'], 100, 'Monday'), T: L(['Z'], 90, 'Guard') }, { S: { X: [ahead, 1] } }));
  assert.deepEqual(itemsOf(back.lists), { S: ['Y'], T: ['X', 'Z'] }, 'so the move stands against that copy');
}));

test('19. a real change is never taken for a heal: two racing overwrites in a row, each re-pushed at once, the clock stopped', () => fakeTimers(async ({ flush }) => {
  const realNow = Date.now; const now = 1795400000000; Date.now = () => now;   // the clock never moves: no wait can expire
  try {
    const h = harness(); await h.boot(); const a = h.switchTo('A');
    a.prep.local = 1; await a._pullAndMerge(); await flush();
    a.lists = { S: L(['X', 'Y'], 100, 'Monday'), T: L(['Z'], 90, 'Guard') };
    assert.equal(a.moveListItem('X', 'S', 'T', 'menu').moved, true); await flush();
    // first, a cloud that is behind ONLY in the two fields takes this tab's immediate heal (so the next would wait)
    const union = olderCopyOf(h.pushes.at(-1).value, { S: ['X', 'Y'], T: ['Z', 'X'] });
    h.facade.pullNeural = async id => ({ userId: id, blob: JSON.parse(JSON.stringify(union)) });
    await a._pullAndMerge(); await flush();                                     // (belts settle)
    let n = h.pushes.length; await a._pullAndMerge(); await flush();
    assert.equal(h.pushes.length - n, 1, 'premise: the first heal went at once');
    n = h.pushes.length; await a._pullAndMerge(); await flush();
    assert.equal(h.pushes.length - n, 0, 'premise: the next heal waits');
    // now a REAL change: H added to Guard, pushed
    a.lists.T.items.push('H'); a._saveProgress(); await flush();
    assert.ok(h.pushes.at(-1).value.lists.T.items.includes('H'));
    // an older build, from a read taken before H landed, pushes over it: the cloud lacks H (and the move's cells)
    for (const round of [1, 2]) {
      n = h.pushes.length; await a._pullAndMerge(); await flush();
      assert.equal(h.pushes.length - n, 1, 'overwrite ' + round + ': H is re-pushed at once, never held as a heal');
      assert.ok(h.pushes.at(-1).value.lists.T.items.includes('H'));
    }
    assert.deepEqual(itemsOf(a.lists), { S: ['Y'], T: ['H', 'X', 'Z'] }, 'nothing lost on this device');
  } finally { Date.now = realNow; }
}));

test('20. the bound: from the third re-push in a row an unchanged state backs off like a heal; a real change resets the count', () => fakeTimers(async ({ flush }) => {
  const realNow = Date.now; let now = 1795400000000; Date.now = () => now;
  try {
    const h = harness(); await h.boot(); const a = h.switchTo('A');
    a.prep.local = 1; await a._pullAndMerge(); await flush();
    a.lists = { S: L(['X', 'Y'], 100, 'Monday') }; a._saveProgress(); await flush();
    // a cloud that keeps holding a view without Y (another writer's, which this tab never merges away: more than the two
    // list fields behind, every time)
    const other = olderCopyOf(h.pushes.at(-1).value, { S: ['X'] });
    h.facade.pullNeural = async id => ({ userId: id, blob: JSON.parse(JSON.stringify(other)) });
    const pushesAfter = async (ms) => { now += ms; const n = h.pushes.length; await a._pullAndMerge(); await flush(); return h.pushes.length - n; };
    await pushesAfter(1000);                                                   // (belts settle)
    assert.equal(await pushesAfter(1000), 1, 'a re-push at once');
    assert.equal(await pushesAfter(1000), 1, 'a second in a row, at once');
    assert.equal(await pushesAfter(1000), 1, 'a third in a row is a heal now: the first heal goes at once');
    assert.equal(await pushesAfter(1000), 0, 'a fourth waits');
    assert.equal(await pushesAfter(60000), 1, 'and goes after the minute');
    // a real change resets it: the next re-push of the new state goes at once again
    a.lists.S.items.push('Z'); a._saveProgress(); await flush();
    assert.equal(await pushesAfter(1000), 1, 'after a real change, at once again');
    assert.deepEqual(itemsOf(a.lists), { S: ['X', 'Y', 'Z'] }, 'nothing lost on this device');
  } finally { Date.now = realNow; }
}));

// a tab whose pulls the test controls, its clock stepped by hand
async function scripted(fn) {
  const realNow = Date.now; let now = 1795400000000; Date.now = () => now;
  try {
    await fakeTimers(async ({ flush }) => {
      const h = harness(); await h.boot(); const a = h.switchTo('A');
      a.prep.local = 1; await a._pullAndMerge(); await flush();
      let cloud = null; h.facade.pullNeural = async id => ({ userId: id, blob: JSON.parse(JSON.stringify(cloud)) });
      const serve = blob => { cloud = blob; };
      const pushesAfter = async (ms) => { now += ms; const n = h.pushes.length; await a._pullAndMerge(); await flush(); return h.pushes.length - n; };
      await fn({ h, a, flush, serve, pushesAfter });
    });
  } finally { Date.now = realNow; }
}

test('21. a cloud behind only in the ORDER record is a heal: the first at once, the next waits (R1m2)', () => scripted(async ({ h, a, flush, serve, pushesAfter }) => {
  a.lists = { T: L(['X', 'Y', 'Z'], 90, 'Guard') }; a._saveProgress(); await flush();
  assert.equal(a.moveListItemBy('T', 'Z', -2), true); await flush();          // Guard: Z X Y, recorded
  assert.ok(h.pushes.at(-1).value.listOrderAt, 'premise: the record was pushed');
  // an older build's copy: this tab's push, its own order of the list, and no record (it never took one)
  serve(olderCopyOf(h.pushes.at(-1).value, { T: ['X', 'Y', 'Z'] }));
  await pushesAfter(1000);                                                     // (belts settle)
  assert.equal(await pushesAfter(1000), 1, 'the first heal goes at once');
  assert.equal(await pushesAfter(1000), 0, 'the next waits: behind only in the order record is a heal, not a real change');
  assert.deepEqual(a.lists.T.items, ['Z', 'X', 'Y'], "this tab's order stands");
}));

test('22. a fields-only heal resets the run: real, real, fields-only, then real goes at once as run 1 (B2)', () => scripted(async ({ h, a, flush, serve, pushesAfter }) => {
  a.lists = { S: L(['X', 'Y'], 100, 'Monday'), T: L(['Z'], 90, 'Guard'), U: L(['Q'], 80, 'Open mat') }; a._saveProgress(); await flush();
  assert.equal(a.moveListItem('X', 'S', 'T', 'menu').moved, true); await flush();
  const pushed = h.pushes.at(-1).value;
  const realBehind = JSON.parse(JSON.stringify(pushed)); delete realBehind.lists.U;   // lacks a list: a real difference
  const fieldsBehind = olderCopyOf(pushed, { S: ['X', 'Y'], T: ['Z', 'X'] });         // only the two fields behind
  serve(realBehind); await pushesAfter(1000);                                  // (belts settle)
  assert.equal(await pushesAfter(1000), 1, 'a real re-push, at once (run 1)');
  assert.equal(await pushesAfter(1000), 1, 'a real re-push, at once (run 2: one more would be a heal)');
  serve(fieldsBehind);
  assert.equal(await pushesAfter(1000), 1, 'a fields-only heal: the first heal at once, and it resets the run');
  serve(realBehind);
  assert.equal(await pushesAfter(1000), 1, 'so the next real re-push is run 1 again: at once');
}));

test('23. a real change resets the run: after the bound was hit, a real change erased twice is re-pushed at once both times (B4)', () => scripted(async ({ h, a, flush, serve, pushesAfter }) => {
  a.lists = { S: L(['X', 'Y'], 100, 'Monday'), U: L(['Q'], 80, 'Open mat') }; a._saveProgress(); await flush();
  let behind = JSON.parse(JSON.stringify(h.pushes.at(-1).value)); delete behind.lists.U;
  serve(behind); await pushesAfter(1000);                                      // (belts settle)
  assert.equal(await pushesAfter(1000), 1);
  assert.equal(await pushesAfter(1000), 1);
  assert.equal(await pushesAfter(1000), 1, 'the third in a row is a heal, its first at once');
  assert.equal(await pushesAfter(1000), 0, 'the bound holds the fourth');
  // a real change: a new technique in Open mat, pushed at once
  a.lists.U.items.push('R'); a._saveProgress(); await flush();
  assert.ok(h.pushes.at(-1).value.lists.U.items.includes('R'));
  // and a racing write erases it, twice in a row: both re-pushes go at once (the run started over)
  behind = JSON.parse(JSON.stringify(h.pushes.at(-1).value)); delete behind.lists.U; serve(behind);
  assert.equal(await pushesAfter(1000), 1, 'erased once: re-pushed at once');
  assert.equal(await pushesAfter(1000), 1, 'erased twice: re-pushed at once again');
  assert.deepEqual(a.lists.U.items, ['Q', 'R'], 'nothing lost here');
}));
