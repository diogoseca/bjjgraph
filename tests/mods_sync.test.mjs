// THE PLAYER'S MODIFIERS, SAVED AND SYNCED (v1.301.0, MODS1: the owner's U212 a "Save them"; the orchestrator's MODS1-GO).
// "Your odds" are stored as SETTINGS, one key per technique (`settings["mod:" + name]` = [pct, on, cat, born], or 0 once
// removed), each stamped in `settingsAt` at the press; the shape, the bound and why settings are in progress-owner.src.js
// above NG_MOD_PREFIX. This file proves it where it runs: the real app class, the real progress host and a synthetic facade
// (tests/list_moves_sync.test.mjs's harness), against a cloud that HOLDS another device's record (an empty fake cloud proves
// nothing: the stored-key checklist, PR #375's lesson), with a clock the test moves, so no two presses tie by accident.
//   1. two devices, two techniques: both modifiers on both devices and in the cloud, and the devices go quiet;
//   2. two devices, one technique: the later press stands on both;
//   3. removed on A, then edited later on B (which never saw the removal): B's edit stands on both;
//   4. edited on B, then removed later on A (which never saw the edit): removed on both, through a reload of B;
//   5. a STALE device, holding the old value and pressing nothing about it, pulls and pushes after a removal: it stays removed;
//   6. paused on A, its odds changed later on B: B's whole row stands on both (the rule is per technique, not per field);
//   7. a reload keeps them, and the move's chance is the modifier's;
//   8. a press before this device's first pull: the save pulls first, and the other device's modifiers are kept;
//   9. a press beats a stamp from another device's clock that runs an hour ahead (`ngModStamp`), on both devices;
//  10. an account with no modifiers saves no `mod:` key: its record is the one it saved before;
//  11. what the app saves passes every captured older validator (tests/artifacts/progress_validators.json);
//  12. the bound: at NG_MOD_CAP keys, removed ones counted, a new name is refused; a removed name comes back; a live one is kept;
//  13. damaged keys never stop a load: skipped or clamped, and counted;
//  14. two tabs of one browser: each takes the other's press at its next save (the host's cross-tab merge);
//  15. another account on the same browser holds none of them, and the first account keeps its own;
//  16. a browser whose storage is full: the save fails as any save does, and the modifier still applies in this tab.
// What an OLDER build does with these keys is proved on that build's own source: tests/artifacts/_old_settings_carry.mjs
// (not collected: it reads git's own copy of each release, which a shallow CI checkout lacks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = text => text.replace(/^export (function|const|let|var|class) /gm, '$1 ');
const dependencies = ['lists-codec', 'lists', 'belt', 'knowledge-profile', 'rating', 'challenge-definitions', 'challenge-engine'].map(name => strip(read('../neural/src/' + name + '.src.js'))).join('\n');
const ownerSource = strip(read('../neural/src/progress-owner.src.js'));
const source = read('../neural/src/app.src.jsx');
const M = new Function('DCLogic', 'React', ownerSource + '\n' + dependencies + '\n' + source + '\nreturn { Component, ngProgressCreateHost, ngProgressOwner, ngModsRead, ngModStamp, NG_MOD_CAP };')(class {}, { createRef: () => ({ current: null }) });
globalThis.ngGameplanReviewed = globalThis.ngGameplanReviewed || (() => false);
globalThis.document = globalThis.document || { querySelectorAll: () => [], querySelector: () => null, body: null, activeElement: null };

const clone = x => JSON.parse(JSON.stringify(x));
// What the cloud hands back: JSONB reorders keys, so the pulled blob is the pushed one with its keys in another order.
const reordered = v => Array.isArray(v) ? v.map(reordered) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map(k => [k, reordered(v[k])])) : v;
function memory() { const rows = new Map(); return { rows, getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, String(v)), removeItem: k => rows.delete(k) }; }
// ONE DEVICE: its own browser storage, the account's one cloud row shared with every other device
function device(cloud, mem = memory()) {
  let current, identity = null;
  const pushes = [];
  const facade = { resolveNeuralUser: async () => identity, neuralSyncVersion: 2, isAuthenticated: () => true,
    pullNeural: async id => ({ userId: id, blob: cloud && cloud.has(id) ? reordered(clone(cloud.get(id))) : null }),
    pushNeural: async (value, id) => { pushes.push(clone(value)); if (cloud) cloud.set(id, clone(value)); return true; },
    onAuthChange: () => () => {} };
  const host = M.ngProgressCreateHost({ storage: mem, resolveUser: () => facade.resolveNeuralUser(), hold: () => {}, mount(boot) {
    const inst = new M.Component({}); current = inst; host.bind(inst, boot);
    inst._publishKnowledge = () => {}; inst._applyLayers = () => {}; inst._refreshChallengeEvidence = () => {}; inst.updateAccountUI = () => {};
    inst.track = () => {}; inst.fx = () => {}; inst._auth = () => facade; inst.isTest = () => true; inst.refreshOptionOdds = () => {};
    inst.destroy = () => { if (inst.__ngDestroyed) return; inst.__ngDestroyed = true; inst._authDisposed = true; inst._invalidateCloudSync(); };
    inst._loadProgress();
  } });
  const get = () => current;
  const switchTo = id => { identity = { id, email: id + '@example.invalid' }; get()._applyUser(identity); get()._applyUser(identity); return get(); };
  return { mem, host, facade, get, switchTo, pushes, boot: () => host.bootstrap(), setIdentity: u => { identity = u; } };
}
// THE CLOCK, moved by the test (setTimeout too: tests/list_moves_sync.test.mjs's fake timers)
async function run(fn) {
  const oldSet = globalThis.setTimeout, oldClear = globalThis.clearTimeout, oldNow = Date.now;
  let seq = 0, clock = 1795500000000; const q = new Map();
  globalThis.setTimeout = f => { const id = ++seq; q.set(id, f); return id; }; globalThis.clearTimeout = id => q.delete(id);
  Date.now = () => clock;
  const drain = async () => { for (let i = 0; i < 8 && q.size; i++) { const jobs = [...q.values()]; q.clear(); for (const f of jobs) await f(); } };
  const flush = async () => { for (let i = 0; i < 6; i++) { await new Promise(r => setImmediate(r)); await drain(); } };
  const tick = (ms = 1000) => { clock += ms; };
  try { await fn({ flush, tick, now: () => clock }); } finally { globalThis.setTimeout = oldSet; globalThis.clearTimeout = oldClear; Date.now = oldNow; }
}
const ACCOUNT = 'A';
async function signedIn(cloud, flush, mem) {
  const d = device(cloud, mem); await d.boot(); const a = d.switchTo(ACCOUNT); await a._pullAndMerge(); await flush(); return d;
}
const sync = async (d, flush) => { await d.get()._pullAndMerge(); await flush(); };
const shown = app => app.userMods.map(m => [m.name, m.pct, m.on]);
const cloudMods = (cloud) => Object.fromEntries(Object.entries((cloud.get(ACCOUNT) || {}).settings || {}).filter(([k]) => k.startsWith('mod:')).sort());
const stored = (mem, id = ACCOUNT) => { const v = mem.rows.get('bjj-neural-owner:account:' + id + ':progress'); return v ? JSON.parse(v).blob : null; };
const step = (app, name, d) => app._editMod(app.userMods.find(m => m.name === name), row => { row[0] = Math.max(0, Math.min(100, Math.round(row[0]) + d)); });
const pause = (app, name) => app._editMod(app.userMods.find(m => m.name === name), row => { row[1] = row[1] === 1 ? 0 : 1; });
const remove = (app, name) => app._writeMod(name, 0);
async function quiet(devices, flush) {
  const before = devices.map(d => d.pushes.length);
  for (const d of devices) await sync(d, flush);
  for (const d of devices) await sync(d, flush);
  assert.deepEqual(devices.map(d => d.pushes.length), before, 'quiet: nothing is pushed once they agree');
}

test('1. two devices, two techniques: both modifiers on both devices and in the cloud, and they go quiet', () => run(async ({ flush, tick }) => {
  const cloud = new Map(), A = await signedIn(cloud, flush), B = await signedIn(cloud, flush);
  tick(); assert.equal(A.get()._addMod('Armbar from Mount', 'Submission'), 'added'); await flush();
  tick(); assert.equal(B.get()._addMod('Knee Slice Pass', 'Transition'), 'added'); await flush();
  step(B.get(), 'Knee Slice Pass', 10); await flush();
  await sync(A, flush); await sync(B, flush); await sync(A, flush);
  const want = [['Armbar from Mount', 50, true], ['Knee Slice Pass', 60, true]];
  assert.deepEqual(shown(A.get()), want); assert.deepEqual(shown(B.get()), want);
  assert.deepEqual(Object.keys(cloudMods(cloud)), ['mod:Armbar from Mount', 'mod:Knee Slice Pass'], 'the cloud holds both');
  await quiet([A, B], flush);
}));

test('2. two devices, one technique: the later press stands on both', () => run(async ({ flush, tick }) => {
  const cloud = new Map(), A = await signedIn(cloud, flush);
  tick(); A.get()._addMod('Triangle Choke', 'Submission'); await flush();
  const B = await signedIn(cloud, flush);
  assert.deepEqual(shown(B.get()), [['Triangle Choke', 50, true]], 'premise: B pulled it');
  tick(); step(A.get(), 'Triangle Choke', 20); await flush();          // A: 70, not yet seen by B
  tick(); step(B.get(), 'Triangle Choke', -15); await flush();         // B, later: 35
  await sync(A, flush); await sync(B, flush);
  assert.deepEqual(shown(A.get()), [['Triangle Choke', 35, true]], 'the later press (B) stands on A');
  assert.deepEqual(shown(B.get()), [['Triangle Choke', 35, true]]);
  await quiet([A, B], flush);
}));

test('3. removed on A, then edited later on B, which never saw the removal: B\'s edit stands on both', () => run(async ({ flush, tick }) => {
  const cloud = new Map(), A = await signedIn(cloud, flush);
  tick(); A.get()._addMod('Kimura', 'Submission'); await flush();
  const B = await signedIn(cloud, flush);
  tick(); remove(A.get(), 'Kimura'); await flush();
  tick(); step(B.get(), 'Kimura', 5); await flush();
  await sync(A, flush); await sync(B, flush);
  assert.deepEqual(shown(A.get()), [['Kimura', 55, true]], 'a deliberate later press brings it back');
  assert.deepEqual(shown(B.get()), [['Kimura', 55, true]]);
  await quiet([A, B], flush);
}));

test('4. edited on B, then removed later on A, which never saw the edit: removed on both, through a reload of B', () => run(async ({ flush, tick }) => {
  const cloud = new Map(), A = await signedIn(cloud, flush);
  tick(); A.get()._addMod('Kimura', 'Submission'); await flush();
  const memB = memory(), B = await signedIn(cloud, flush, memB);
  tick(); step(B.get(), 'Kimura', 5); await flush();
  tick(); remove(A.get(), 'Kimura'); await flush();
  await sync(A, flush); await sync(B, flush); await sync(A, flush);
  assert.deepEqual(shown(A.get()), []); assert.deepEqual(shown(B.get()), []);
  assert.equal(cloudMods(cloud)['mod:Kimura'], 0, 'the cloud holds the removal, never a deleted key');
  const B2 = await signedIn(cloud, flush, memB);
  assert.deepEqual(shown(B2.get()), [], 'B reloaded: still removed');
  await quiet([A, B2], flush);
}));

test('5. a stale device holding the old value, pressing nothing about it, pulls and pushes after a removal: it stays removed', () => run(async ({ flush, tick }) => {
  const cloud = new Map(), A = await signedIn(cloud, flush);
  tick(); A.get()._addMod('Kimura', 'Submission'); A.get()._addMod('Omoplata', 'Submission'); await flush();
  const S = await signedIn(cloud, flush);                              // the stale device: it holds both, live
  tick(); remove(A.get(), 'Kimura'); await flush();
  // S has not pulled since. It practises (a real change of its own) and saves. It pulled at sign-in, so this save pushes its
  // whole record without pulling again, and the cloud row holds S's old Kimura for a moment: every field works that way
  // (the push replaces the row; the next pull of a device holding more heals it). What the stamp decides is what stands
  // once they meet: A holds the later stamped 0, so A's next pull keeps it and pushes it back, and S's next pull takes it.
  tick(); S.get().prep['Mount|Top'] = 4; S.get()._saveProgress(); await flush();
  assert.notEqual(cloudMods(cloud)['mod:Kimura'], 0, "premise: S's stale push landed over the removal");
  await sync(A, flush); await sync(S, flush);
  assert.equal(cloudMods(cloud)['mod:Kimura'], 0, 'the cloud holds the removal again');
  assert.deepEqual(shown(A.get()), [['Omoplata', 50, true]], 'A never showed Kimura again');
  assert.deepEqual(shown(S.get()), [['Omoplata', 50, true]], 'S shows the removal');
  assert.equal(A.get().prep['Mount|Top'], 4, "and S's practice joined as ever");
  await quiet([A, S], flush);
}));

test('6. paused on A, its odds changed later on B: B\'s whole row stands on both (per technique, not per field)', () => run(async ({ flush, tick }) => {
  const cloud = new Map(), A = await signedIn(cloud, flush);
  tick(); A.get()._addMod('Darce Choke', 'Submission'); await flush();
  const B = await signedIn(cloud, flush);
  tick(); pause(A.get(), 'Darce Choke'); await flush();
  tick(); step(B.get(), 'Darce Choke', 7); await flush();
  await sync(A, flush); await sync(B, flush);
  assert.deepEqual(shown(A.get()), [['Darce Choke', 57, true]], 'the later row, its "on" included');
  assert.deepEqual(shown(B.get()), [['Darce Choke', 57, true]]);
}));

test('7. a reload keeps them, and the move\'s chance is the modifier\'s', () => run(async ({ flush, tick }) => {
  const cloud = new Map(), mem = memory(), A = await signedIn(cloud, flush, mem);
  tick(); A.get()._addMod('Armbar from Mount', 'Submission'); step(A.get(), 'Armbar from Mount', 12); await flush();
  tick(); A.get()._addMod('Kimura', 'Submission'); pause(A.get(), 'Kimura'); await flush();
  const R = await signedIn(cloud, flush, mem);
  assert.notEqual(R.get(), A.get(), 'premise: a new instance, read from storage');
  assert.deepEqual(shown(R.get()), [['Armbar from Mount', 62, true], ['Kimura', 50, false]], 'both, in the order they were added');
  assert.equal(R.get().successOverride({ t: 'Armbar from Mount' }), 0.62, 'the roll reads it');
  assert.equal(R.get().successOverride({ t: 'Kimura' }), null, 'a paused one changes nothing');
  assert.equal(R.get().knowledgeProfile().userMods.length, 2, 'and the profile the solve reads holds them');
}));

test('8. a press before this device\'s first pull: the save pulls first, and the other device\'s modifiers are kept', () => run(async ({ flush, tick }) => {
  const cloud = new Map(), B = await signedIn(cloud, flush);
  tick(); B.get()._addMod('Knee Slice Pass', 'Transition'); await flush();
  const A = device(cloud); await A.boot(); const a = A.switchTo(ACCOUNT);
  assert.equal(a._pulled, false, 'premise: A has not pulled yet');
  const order = [], pull = A.facade.pullNeural, push = A.facade.pushNeural;
  A.facade.pullNeural = async id => { order.push('pull'); return pull(id); };
  A.facade.pushNeural = async (v, id) => { order.push('push'); return push(v, id); };
  tick(); a._addMod('Armbar from Mount', 'Submission'); await flush();
  assert.equal(order[0], 'pull', 'the first cloud call is the pull: ' + order.join(' → '));
  assert.deepEqual(Object.keys(cloudMods(cloud)), ['mod:Armbar from Mount', 'mod:Knee Slice Pass'], 'both in the cloud');
  assert.deepEqual(shown(A.get()).map(r => r[0]), ['Knee Slice Pass', 'Armbar from Mount']);
}));

test('9. a press beats a stamp from another device\'s clock an hour ahead, on both devices', () => run(async ({ flush, tick, now }) => {
  const cloud = new Map(), A = await signedIn(cloud, flush);
  tick(); A.get()._addMod('Kimura', 'Submission'); await flush();
  // another device, its clock an hour fast, set Kimura to 80
  const ahead = now() + 3600000, c = clone(cloud.get(ACCOUNT)); c.settings['mod:Kimura'] = [80, 1, 'S', c.settings['mod:Kimura'][3]]; c.settingsAt['mod:Kimura'] = ahead;
  cloud.set(ACCOUNT, c);
  const B = await signedIn(cloud, flush);
  await sync(A, flush); assert.deepEqual(shown(A.get()), [['Kimura', 80, true]], 'premise: A took it');
  tick(); step(A.get(), 'Kimura', -30); await flush();                 // A's press, by A's own (slower) clock
  assert.equal(A.get()._settingsAt['mod:Kimura'], ahead + 1, 'stamped just past the stamp it holds, not by its own clock');
  await sync(B, flush);
  assert.deepEqual(shown(B.get()), [['Kimura', 50, true]], 'A\'s press stands on B');
  assert.equal(M.ngModStamp(1e308, 5), 5, 'a damaged stamp is not built on');
  assert.equal(M.ngModStamp(2 ** 53 - 1, 5), 5);
  assert.equal(M.ngModStamp(10, 5), 11);
}));

test('10. an account with no modifiers saves no mod: key: its record is the one it saved before', () => run(async ({ flush, tick }) => {
  const cloud = new Map(), mem = memory();
  cloud.set(ACCOUNT, { v: 2, prep: { 'Mount|Top': 2 }, settings: { dailyGoal: 25, emailDigest: false }, settingsAt: { dailyGoal: 5, emailDigest: 6 }, updatedAt: 7 });
  const A = await signedIn(cloud, flush, mem);
  tick(); A.get().prep['Side Control|Top'] = 1; A.get()._saveProgress(); await flush();
  assert.deepEqual(A.get().userMods, []);
  for (const p of A.pushes) assert.equal(JSON.stringify(p).includes('mod:'), false, 'no push carries a mod: key');
  for (const v of mem.rows.values()) assert.equal(String(v).includes('"mod:'), false, 'nor does the stored record');
  assert.deepEqual(stored(mem).settings, { dailyGoal: 25, emailDigest: false }, 'settings as they were');
  assert.deepEqual(stored(mem).settingsAt, { dailyGoal: 5, emailDigest: 6 });
}));

test('11. what the app saves passes every captured older validator', () => run(async ({ flush, tick }) => {
  const captured = JSON.parse(read('./artifacts/progress_validators.json')).clients;
  assert.ok(Object.keys(captured).length >= 4, 'premise: the older clients were captured');
  const mem = memory(), A = await signedIn(new Map(), flush, mem);
  for (const [n, c] of [['Armbar from Mount', 'Submission'], ['__proto__', 'Position'], ['constructor', 'Transition'], ['Knee "Slice" <Pass>', 'Transition']]) { tick(); assert.equal(A.get()._addMod(n, c), 'added'); }
  tick(); remove(A.get(), 'Armbar from Mount'); pause(A.get(), 'constructor'); await flush();
  const blob = stored(mem);
  assert.equal(Object.keys(blob.settings).filter(k => k.startsWith('mod:')).length, 4, 'premise: four keys, one removed');
  let checked = 0;
  for (const [name, c] of Object.entries(captured)) {
    const validate = new Function(c.validator + '\nreturn ngProgressValidateBlob;')();
    assert.doesNotThrow(() => validate(clone(blob)), name + ' (' + c.rev + ') refuses what this build saves');
    checked++;
  }
  assert.equal(checked, Object.keys(captured).length);
}));

test('12. the bound: at NG_MOD_CAP keys, removed ones counted, a new name is refused; a removed name comes back; a live one is kept', () => run(async ({ flush, tick }) => {
  const A = await signedIn(new Map(), flush), a = A.get();
  assert.equal(M.NG_MOD_CAP, 200);
  for (let i = 0; i < M.NG_MOD_CAP; i++) { tick(1); assert.equal(a._addMod('Move ' + i, 'Transition'), 'added'); }
  for (let i = 0; i < M.NG_MOD_CAP; i += 2) remove(a, 'Move ' + i);
  assert.equal(a.userMods.length, M.NG_MOD_CAP / 2, 'premise: half removed');
  const before = JSON.stringify(a.settings);
  assert.equal(a._addMod('Move 999', 'Transition'), 'full', 'a new name past the bound is refused');
  assert.equal(JSON.stringify(a.settings), before, 'and writes nothing');
  assert.equal(a._addMod('Move 0', 'Transition'), 'added', 'a removed name comes back');
  step(a, 'Move 1', 9);
  assert.equal(a._addMod('Move 1', 'Transition'), 'kept', 'a live name is kept');
  assert.equal(a.userMods.find(m => m.name === 'Move 1').pct, 59, 'with its odds');
  assert.equal(a._addMod('   ', 'Transition'), 'invalid'); assert.equal(a._addMod('x'.repeat(81), 'Transition'), 'invalid');
  assert.equal(a._addMod('x'.repeat(80), 'Transition'), 'full', 'eighty characters is a name (the bound refuses it here)');
}));

test('13. damaged keys never stop a load: skipped or clamped, and counted', () => run(async ({ flush }) => {
  const cloud = new Map();
  cloud.set(ACCOUNT, { v: 2, prep: { 'Mount|Top': 1 }, updatedAt: 3,
    settings: { 'mod:': [50, 1, 'S', 1], ['mod:' + 'y'.repeat(500)]: [50, 1, 'S', 1], 'mod:Junk': 'junk', 'mod:Null': null, 'mod:Clamp': [400.6, 1, 'Z', -5],
      'mod:Low': [-3, 0, 'P', 2], 'mod:Gone': 0, 'mod:Text': ['50', 1, 'S', 3], 'mod:Long': [70, 1, 'T', 4, 'a later field'] },
    settingsAt: { 'mod:Clamp': 1e308 } });
  const A = await signedIn(cloud, flush), a = A.get();
  assert.deepEqual(a.userMods.map(m => [m.name, m.pct, m.on, m.cat, m.born]),
    [['Clamp', 100, true, 'Transition', 0], ['Low', 0, false, 'Position', 2], ['Long', 70, true, 'Transition', 4]]);
  assert.equal(a._modsBad, 5, 'the empty name, the long name, "junk", null and the text odds: counted, never thrown');
  assert.equal(a.prep['Mount|Top'], 1, 'and the rest of the record loaded');
  step(a, 'Long', 1);
  assert.deepEqual(a.settings['mod:Long'], [71, 1, 'T', 4, 'a later field'], 'a later build\'s longer row keeps its tail');
  assert.equal(M.ngModsRead(null).mods.length, 0); assert.equal(M.ngModsRead([1]).mods.length, 0);
}));

test('14. two tabs of one browser: each takes the other\'s press at its next save', () => run(async ({ flush, tick }) => {
  const mem = memory(), T1 = device(null, mem); await T1.boot();
  const T2 = device(null, mem); await T2.boot();
  const t1 = T1.get(), t2 = T2.get();
  assert.equal(t1._progressOwner.kind, 'guest'); assert.equal(t2._progressOwner.kind, 'guest');
  tick(); t1._addMod('Armbar from Mount', 'Submission'); await flush();
  tick(); t2._addMod('Kimura', 'Submission'); await flush();           // tab 2's save merges what tab 1 stored
  assert.deepEqual(shown(t2).map(r => r[0]), ['Armbar from Mount', 'Kimura']);
  tick(); remove(t2, 'Armbar from Mount'); await flush();
  tick(); step(t1, 'Armbar from Mount', 0); t1.prep['Mount|Top'] = 1; t1._saveProgress(); await flush();
  // tab 1's own row is older than tab 2's removal only if tab 1 pressed nothing since; here it did: its press is later
  assert.deepEqual(shown(t1).map(r => r[0]), ['Armbar from Mount', 'Kimura'], 'a later press in tab 1 stands');
  tick(); remove(t1, 'Kimura'); await flush();
  tick(); t2.prep['Side Control|Top'] = 1; t2._saveProgress(); await flush();
  assert.deepEqual(shown(t2).map(r => r[0]), ['Armbar from Mount'], 'tab 2 takes tab 1\'s removal at its next save');
}));

test('15. another account on the same browser holds none of them, and the first account keeps its own', () => run(async ({ flush, tick }) => {
  const mem = memory(), D = device(null, mem); await D.boot();
  const a = D.switchTo('A'); tick(); a._addMod('Armbar from Mount', 'Submission'); a._flushSave();
  const b = D.switchTo('B');
  assert.notEqual(b, a); assert.deepEqual(b.userMods, [], 'B shows none of A\'s');
  assert.equal(b.successOverride({ t: 'Armbar from Mount' }), null);
  b._flushSave();
  assert.equal(JSON.stringify(stored(mem, 'B') || {}).includes('mod:'), false, 'nor stores any');
  const back = D.switchTo('A');
  assert.deepEqual(shown(back), [['Armbar from Mount', 50, true]], 'A keeps its own');
}));

test('16. storage full: the save fails as any save does, and the modifier still applies in this tab', () => run(async ({ flush, tick }) => {
  const mem = memory(), A = await signedIn(new Map(), flush, mem), a = A.get();
  const set = mem.setItem; mem.setItem = () => { throw new Error('quota'); };
  tick(); assert.equal(a._addMod('Kimura', 'Submission'), 'added'); await flush();
  assert.ok(a._progressStorageError, 'the save failed, and says so');
  assert.equal(a.successOverride({ t: 'Kimura' }), 0.5, 'the modifier applies in this tab');
  mem.setItem = set;
  tick(); step(a, 'Kimura', 1); await flush();
  assert.equal(a._progressStorageError, null, 'the next save, with room, goes through');
  assert.deepEqual(stored(mem).settings['mod:Kimura'].slice(0, 2), [51, 1]);
}));
