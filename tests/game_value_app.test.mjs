import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const appSource = readFileSync(new URL('../neural/src/app.src.jsx', import.meta.url), 'utf8');
function fixture() {
  const frames = new Map(), tasks = new Map(), microtasks = [], calls = [], imports = [], events = new Map(); let serial = 0;
  const document = { baseURI: 'https://example.test/page', visibilityState: 'visible',
    addEventListener(k, fn) { events.set(k, fn); }, removeEventListener(k) { events.delete(k); } };
  const row = { isConnected: true, contains: () => true }, card = { isConnected: true,
    getBoundingClientRect: () => ({ width: 150, height: 200, top: 500, bottom: 700, left: 100, right: 250 }) };
  const window = { innerHeight: 900, innerWidth: 1440, getComputedStyle: () => ({ display: 'flex', visibility: 'visible', opacity: '1', pointerEvents: 'auto' }) };
  const choice = {}, model = { ngGameValueInstallRuntime(app, deps) { calls.push(['install', deps]); return { changed: reason => calls.push(['changed', reason]), destroy: () => calls.push(['destroy']) }; } };
  const testImport = async url => { imports.push(url); return url.includes('/choice-values.js') ? choice : model; };
  // Only transport is injected in this test copy. Production patch retains real
  // native import(), real Worker, and the unchanged actual app method bodies.
  const source = appSource.replaceAll('import(url("app/game-values.js"))', 'testImport(url("app/game-values.js"))')
    .replaceAll('import(url("app/choice-values.js"))', 'testImport(url("app/choice-values.js"))');
  const names = ['DCLogic', 'React', 'NG_APP_VERSION', 'NG_GAME_VALUE_KNOWLEDGE', 'document', 'window', 'Worker',
    'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'performance', 'testImport'];
  const C = new Function(...names, source + '\nreturn Component;')(class {}, { createRef: () => ({ current: null }) }, '1.2.3', {}, document, window,
    class Worker { constructor(...args) { calls.push(['worker', args]); } },
    fn => { frames.set(++serial, fn); return serial; }, id => frames.delete(id),
    fn => { tasks.set(++serial, fn); return serial; }, id => tasks.delete(id), fn => microtasks.push(fn), { now: () => 100 }, testImport);
  const app = Object.create(C.prototype), opt = {};
  Object.assign(app, { _progressLoaded: true, _optPick() {}, _decision: {}, _optList: [opt], _optionCards: [{ opt, card }],
    optionsRef: { current: row }, modalRef: { current: null }, _handShown: () => true, _dataBase: () => '/static/neural/',
    refreshChoiceValues: () => calls.push(['refresh']), setChoiceValueRuntime(ns, state) { calls.push(['runtime', ns, state]); },
    renderTabSubtitles() {} });
  const runFrames = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  const runTasks = () => { const pending = [...tasks.values()]; tasks.clear(); pending.forEach(fn => fn()); };
  const runMicrotasks = () => { while (microtasks.length) microtasks.shift()(); };
  return { app, imports, frames, tasks, calls, document, window, card, row, events, runFrames, runTasks, runMicrotasks };
}
test('no imports until a mounted playable hand has a paint and a task; one activation only', async () => {
  const f = fixture(); f.app._ensureGameValues(); f.app._ensureGameValues();
  assert.equal(f.frames.size, 1); assert.equal(f.imports.length, 0);
  f.runFrames(); assert.equal(f.imports.length, 0); assert.equal(f.tasks.size, 1);
  f.runTasks(); await f.app._gameValueLoading;
  assert.equal(f.imports.length, 2); assert.equal(f.calls.filter(x => x[0] === 'install').length, 1);
  for (const url of f.imports) { assert.equal(new URL(url).searchParams.get('v'), '1.2.3'); assert.equal(new URL(url).searchParams.get('attempt'), '0'); }
  f.app._ensureGameValues(); assert.equal(f.frames.size, 0);
});
test('hidden, detached, loading-progress, checkpoint, execution and threat-only hands never import', () => {
  for (const block of [f => f.app._progressLoaded = false, f => f.app._checkpoint = {}, f => f.app._execution = {},
    f => f.app.__ngDestroyed = true, f => f.row.isConnected = false, f => f.card.isConnected = false,
    f => f.app._optPick = null, f => f.app._handShown = () => false, f => f.document.visibilityState = 'hidden',
    f => f.app._optionCards[0].opt.threat = true, f => f.window.getComputedStyle = () => ({ visibility: 'hidden' })]) {
    const f = fixture(); block(f); f.app._ensureGameValues(); f.runFrames(); f.runTasks(); assert.equal(f.imports.length, 0);
  }
});
test('retiring a hand or unmounting between frame and task cancels activation', () => {
  const f = fixture(); f.app._ensureGameValues(); f.runFrames(); f.app._optPick = null; f.runTasks(); assert.equal(f.imports.length, 0);
  const g = fixture(); g.app._ensureGameValues(); g.app.__ngDestroyed = true; g.app._stopGameValueActivation();
  g.runFrames(); g.runTasks(); assert.equal(g.imports.length, 0);
});
test('retry is explicit, increments attempt and destroys prior runtime', async () => {
  const f = fixture(); f.app._gameValueFailed = true; f.app._ensureGameValues(); assert.equal(f.frames.size, 0);
  f.app._gameValueRuntime = { destroy: () => f.calls.push(['destroy']) };
  assert.equal(f.app._retryGameValues(), true); f.runFrames(); f.runTasks(); await f.app._gameValueLoading;
  assert.equal(f.calls.filter(x => x[0] === 'destroy').length, 1);
  assert.ok(f.imports.every(url => new URL(url).searchParams.get('attempt') === '1'));
});
test('knowledge notifications coalesce after final qMod/combo mutation without replacing Gameplan observer', () => {
  const f = fixture(), observations = [];
  f.app._gameValueChanged = reason => observations.push([reason, f.app._qMod, f.app._combo]);
  f.app._onGameplanKnowledgeChanged = e => observations.push(['gameplan', e.revision]);
  f.app._publishKnowledge('grade-a'); f.app._publishKnowledge('grade-b');
  f.app._qMod = -0.04; f.app._combo = 2; assert.equal(observations.length, 0); f.runMicrotasks();
  assert.deepEqual(observations, [['knowledge:grade-b', -0.04, 2], ['gameplan', 2]]);
});
test('explicit provider installed during lazy import cannot be overwritten by its continuation', async () => {
  const f = fixture(); f.app._ensureGameValues(); f.runFrames(); f.runTasks();
  const loading = f.app._gameValueLoading, explicit = { capture() {}, destroy() {} };
  f.app.setChoiceValueSource(explicit);
  await loading;
  assert.equal(f.app._choiceValueSource, explicit);
  assert.equal(f.calls.filter(x => x[0] === 'install').length, 0);
  assert.equal(f.app._gameValueState, 'idle');
  f.app._ensureGameValues(); assert.equal(f.frames.size, 0);
});
test('source replacement cleans former source once and clears only its own runtime owner', () => {
  const f = fixture(); let destroyed = 0;
  const former = { destroy() { destroyed++; } }, newer = { capture() {} };
  f.app._choiceValueSource = former; f.app._gameValueRuntime = { provider: former };
  f.app.setChoiceValueSource(newer); f.app.setChoiceValueSource(newer);
  assert.equal(destroyed, 1); assert.equal(f.app._gameValueRuntime, null);
  assert.equal(f.app._choiceValueSource, newer);
});
