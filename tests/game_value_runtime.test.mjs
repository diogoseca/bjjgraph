import test from 'node:test';
import assert from 'node:assert/strict';
import { ngGameValueInstallRuntime } from '../neural/src/game-value-runtime.src.js';
const hash = n => String(n).repeat(64);
function fixture() {
  const calls = [], cards = { A: { cards: [{}] }, Stub: { n: 3 }, Empty: { cards: [] } };
  const app = { _gameValueGraph: Object.freeze({ status: 'verified', hash: hash(2) }), _giMode: 'gi', _evFrame: 'nogi', _evLam: [1, 2, 4], _evLamIdx: () => 1,
    _gameValueResidencyRevision: 1, flashcards: { decks: cards }, _choiceHandId: 'hand-1',
    _deckHasCards(key) { return !!this.flashcards.decks[key]?.cards?.length; },
    knowledgeProfile: () => ({ status: 'ready', fingerprint: 'profile' }),
    paintChoiceValues() { calls.push('paint'); }, refreshChoiceValues() { calls.push('refresh'); },
    setChoiceValueRuntime(value) { this._choiceValueRuntime = value; return !!value; },
    setChoiceValueSource(value) { this._choiceValueSource = value; }, _optPick() {},
  };
  let config, clientOptions, ready = false, prepareError = null, prepareWait = null, resultStatus = 'bounded', provider;
  const model = { NG_GAME_VALUE_BUILD: { version: '1.2.3', manifestHash: hash(1), manifestBytes: 123,
    graphHash: hash(2), modelHash: hash(3), opponentPolicyHash: hash(4),
    variants: [{ ruleset: 'gi', evFrame: 'nogi', lossAversion: 2, status: 'COMPLETE', mechanicsHash: hash(5), sha256: hash(6), file: 'variant-' + hash(6) + '.json' }] },
    NG_GAME_VALUE_IDENTITY: { ngMdpStable: JSON.stringify },
    ngMdpCreateClient(worker, opts) { calls.push(['client', worker]); clientOptions = opts; return {}; },
    ngGameValueCreateProvider(deps) {
      config = deps;
      provider = { capture() {
        if (!ready) { void provider.prepare(app).catch(() => {}); const e = new Error('root-metadata-pending'); e.code = e.message; throw e; }
        return { request: { requestId: 'r' } };
      }, async prepare() { calls.push('prepare'); deps.createClient(); if (prepareError) throw prepareError; if (prepareWait) await prepareWait(app.currentPos); ready = true; },
      async evaluate() { return { root: { status: resultStatus } }; }, isCurrent: () => !app.__ngDestroyed,
      invalidate(reason) { calls.push(['invalidate', reason]); }, resetClient(reason) { ready = false; calls.push(['reset', reason]); },
      destroy() { calls.push('destroy'); } };
      return provider;
    } };
  const deps = { model, choice: {}, knowledge: {}, version: '1.2.3', attempt: 4,
    dataBase: '/static/neural', documentURL: 'https://example.test/x', now: () => 555,
    createWorker(url) { calls.push(['worker', url]); return { url }; } };
  return { app, calls, model, deps, get config() { return config; }, get clientOptions() { return clientOptions; },
    setResultStatus(value) { resultStatus = value; }, setPrepareError(error) { prepareError = error; }, setPrepareWait(fn) { prepareWait = fn; }, install() { return ngGameValueInstallRuntime(app, deps); } };
}
test('installer is lazy; descriptor uses effective lambda and independent EV frame', () => {
  const f = fixture(), control = f.install();
  assert.equal(f.calls.some(x => Array.isArray(x) && x[0] === 'worker'), false);
  const d = f.config.getRegistration(f.app);
  assert.equal(d.ruleset, 'gi'); assert.equal(d.evFrame, 'nogi'); assert.equal(d.lossAversion, 2); assert.equal(d.evIndex, 1);
  assert.equal(d.manifestUrl, 'https://example.test/static/neural/mdp/manifest-' + hash(1) + '.json');
  assert.equal(d.metadataUrl, 'https://example.test/static/neural/mdp/variant-' + hash(6) + '.json');
  assert.equal(f.app._choiceValueSource, control.provider);
  f.app._evFrame = 'gi'; assert.throws(() => f.config.getRegistration(), /unavailable-mechanics-variant/);
});
test('residency snapshot contains only immutable readiness and changes on revision', () => {
  const f = fixture(); f.install(); const a = f.config.getResidency();
  assert.deepEqual(Object.keys(a.deckReady), ['A']); assert.ok(Object.isFrozen(a.deckReady));
  assert.equal(f.config.getResidency(), a);
  f.app.flashcards.decks.Stub.cards = [{}]; f.app._gameValueResidencyRevision++;
  const b = f.config.getResidency(); assert.notEqual(b, a); assert.equal(b.deckReady.Stub, true); assert.equal(a.deckReady.Stub, undefined);
});
test('preparation is separate from ready values; classic worker URL binds version/content/attempt', async () => {
  const f = fixture(), c = f.install();
  assert.throws(() => c.provider.capture(), /root-metadata-pending/);
  assert.equal(f.app._gameValueState, 'preparing'); await c.provider.prepare(f.app);
  const url = new URL(f.calls.find(x => Array.isArray(x) && x[0] === 'worker')[1]);
  assert.equal(url.searchParams.get('v'), '1.2.3'); assert.equal(url.searchParams.get('attempt'), '4');
  assert.equal(url.searchParams.get('content'), hash(1)); assert.equal(f.app._gameValueFirstValuesAt, undefined);
  const request = c.provider.capture().request; await c.provider.evaluate(request);
  assert.equal(f.app._gameValueFirstValuesAt, 555);
});
test('failed preparation stays unavailable without automatic retry or loss of pick control', async () => {
  const f = fixture(), pick = f.app._optPick; f.setPrepareError(new Error('network down')); const c = f.install();
  assert.throws(() => c.provider.capture(), /root-metadata-pending/);
  await assert.rejects(c.provider.prepare(f.app), /network down/);
  assert.equal(f.app._gameValueState, 'unavailable'); assert.equal(f.app._gameValueRetryable, true);
  assert.throws(() => c.provider.capture(), /network down/); assert.equal(f.calls.filter(x => x === 'prepare').length, 1);
  assert.equal(f.app._optPick, pick);
});
// FGCANCEL1 reversed this contract on purpose. It used to read "hard termination retires provider
// and does not recreate a worker in a retry loop": every deadline was held for the session. A
// deadline now earns a replacement on the next request, bounded, so a loop is still impossible.
// Only a crash (and an exhausted bound) is held.
test('a deadline-killed worker is replaced on the next request, at most twice, then the failure is held', async () => {
  const f = fixture(), c = f.install(); await c.provider.prepare(f.app);
  const workers = () => f.calls.filter(x => Array.isArray(x) && x[0] === 'worker').length;
  assert.equal(workers(), 1);
  for (const [i, reason] of ['worker-cancellation-deadline', 'worker-computation-deadline'].entries()) {
    f.clientOptions.onTerminated(reason);
    assert.ok(f.calls.some(x => Array.isArray(x) && x[0] === 'reset' && x[1] === reason));
    assert.equal(f.app._gameValueState, 'preparing'); assert.equal(f.app._gameValueRecoveries, i + 1);
    assert.equal(workers(), i + 1, 'replaced lazily: nothing is created until the next request');
    assert.throws(() => c.provider.capture(), /root-metadata-pending/);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(workers(), i + 2, 'the next request created a fresh worker');
    assert.ok(c.provider.capture().request);
  }
  f.clientOptions.onTerminated('worker-cancellation-deadline');
  assert.equal(f.app._gameValueState, 'unavailable'); assert.equal(f.app._gameValueReason, 'worker-cancellation-deadline');
  assert.throws(() => c.provider.capture(), /worker-cancellation-deadline/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(workers(), 3, 'the bound is spent: no fourth worker');
  c.destroy(); c.destroy(); assert.equal(f.calls.filter(x => x === 'destroy').length, 1);
});
test('a crashed worker is held at once: only a deadline earns a replacement', async () => {
  const f = fixture(), c = f.install(); await c.provider.prepare(f.app);
  f.clientOptions.onTerminated('worker-error');
  assert.equal(f.app._gameValueState, 'unavailable'); assert.equal(f.app._gameValueReason, 'worker-error');
  assert.throws(() => c.provider.capture(), /worker-error/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.filter(x => Array.isArray(x) && x[0] === 'worker').length, 1);
});
test('mismatched build version and invalid choice namespace refuse installation', () => {
  const f = fixture(); f.deps.version = 'old'; assert.throws(() => f.install(), /incompatible-game-value-build/);
  const g = fixture(); g.app.setChoiceValueRuntime = () => false;
  assert.throws(() => g.install(), /invalid-choice-runtime/);
  assert.equal(g.calls.filter(x => x === 'destroy').length, 1);
});
test('retiring an old runtime destroys its provider once and never clears a newer source', () => {
  const f = fixture(), old = f.install(), newer = { capture() {} };
  old.provider.destroy(); // real app setChoiceValueSource does this on replacement
  f.app._choiceValueSource = newer;
  old.destroy(); old.destroy();
  assert.equal(f.app._choiceValueSource, newer);
  assert.equal(f.calls.filter(x => x === 'destroy').length, 1);
});
test('a replacement root prepares independently and an obsolete failure does not hold it', async () => {
  const f = fixture(), waiting = new Map();
  f.app.nodes = [{ id: 'first' }, { id: 'second' }]; f.app.currentPos = 0; f.app.playerRole = 'top';
  f.setPrepareWait(pos => new Promise((resolve, reject) => waiting.set(pos, { resolve, reject })));
  const c = f.install(), first = c.provider.prepare(f.app), rejected = assert.rejects(first, /obsolete/);
  await Promise.resolve(); f.app.currentPos = 1; const second = c.provider.prepare(f.app); await Promise.resolve();
  waiting.get(0).reject(new Error('obsolete')); waiting.get(1).resolve(); await Promise.all([rejected, second]);
  assert.equal(f.calls.filter(x => x === 'prepare').length, 2); assert.equal(f.app._gameValueState, 'prepared');
  assert.doesNotThrow(() => c.provider.capture());
});
test('pending live graph hashes wait without worker or metadata preparation and resume after verification', async () => {
  const f = fixture(); f.app._gameValueGraph = Object.freeze({ status: 'pending', hash: null });
  const c = f.install(), pick = f.app._optPick;
  assert.throws(() => c.provider.capture(), /live-graph-pending/);
  await assert.rejects(c.provider.prepare(f.app), /live-graph-pending/);
  assert.equal(f.app._gameValueState, 'preparing'); assert.equal(f.app._gameValueRetryable, false);
  assert.equal(f.calls.filter(x => x === 'prepare').length, 0);
  assert.equal(f.calls.some(x => Array.isArray(x) && x[0] === 'worker'), false);
  assert.equal(f.app._optPick, pick);
  f.app._gameValueGraph = Object.freeze({ status: 'verified', hash: hash(2) });
  await c.provider.prepare(f.app); assert.doesNotThrow(() => c.provider.capture());
});
test('missing, unverified, failed and mismatched graph evidence fails before even cached descriptors', async () => {
  for (const graph of [undefined, { status: 'unverified', hash: null },
    { status: 'unavailable', hash: null, reason: 'live-graph-hash-failed' },
    { status: 'verified', hash: hash(7) }]) {
    const f = fixture(), c = f.install(); const valid = f.config.getRegistration();
    assert.equal(valid.graphHash, hash(2));
    f.app._gameValueGraph = graph;
    assert.throws(() => f.config.getRegistration(), /live-graph-/);
    assert.throws(() => c.provider.capture(), /live-graph-/);
    await assert.rejects(c.provider.prepare(f.app), /live-graph-/);
    assert.equal(f.app._gameValueState, 'unavailable'); assert.equal(f.app._gameValueRetryable, false);
    assert.equal(f.calls.filter(x => x === 'prepare').length, 0);
  }
});
test('old graph preparation failure cannot hold a new ingest with the same node identity', async () => {
  const f = fixture(), waits = [];
  f.setPrepareWait(() => new Promise((resolve, reject) => waits.push({ resolve, reject })));
  const c = f.install(), old = c.provider.prepare(f.app), oldFailure = assert.rejects(old, /obsolete graph/);
  await Promise.resolve();
  f.app._gameValueGraph = Object.freeze({ status: 'verified', hash: hash(2) });
  const next = c.provider.prepare(f.app); await Promise.resolve();
  assert.equal(waits.length, 2);
  waits[0].reject(new Error('obsolete graph')); waits[1].resolve();
  await Promise.all([oldFailure, next]);
  assert.equal(f.app._gameValueState, 'prepared'); assert.doesNotThrow(() => c.provider.capture());
});
test('native root.status controls first-values timing and unavailable presentation', async () => {
  const f = fixture(), c = f.install(); await c.provider.prepare(f.app);
  const request = c.provider.capture().request;
  f.setResultStatus('unavailable'); const unavailable = await c.provider.evaluate(request);
  assert.equal(unavailable.status, undefined); assert.equal(unavailable.root.status, 'unavailable');
  assert.equal(f.app._gameValueFirstValuesAt, undefined); assert.equal(f.app._gameValueState, 'unavailable');
  f.setResultStatus('bounded'); await c.provider.evaluate(request);
  assert.equal(f.app._gameValueFirstValuesAt, 555); assert.equal(f.app._gameValueState, 'prepared');
});
test('the client is given the measured cancellation grace, not its 1 s default (FGCANCEL1)', async () => {
  const f = fixture(), c = f.install(); await c.provider.prepare(f.app);
  assert.equal(f.clientOptions.cancellationGraceMilliseconds, 10000);
});
