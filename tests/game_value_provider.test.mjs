import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { ngGameValueCreateProvider, ngGameValueRegistrationKey } from '../neural/src/game-value-provider.src.js';

// Real tiny identity code; override only the root path when importing these tests.
const nativeRoot = process.env.BJJ_MDP_SOURCE_ROOT || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const context = vm.createContext({ module: { exports: {} }, TextEncoder });
vm.runInContext(await readFile(nativeRoot + '/neural/src/mdp-identity.src.js', 'utf8'), context);
const M = context.module.exports;
const frozen = x => Object.freeze(x);
function fixture() {
  const reg = { verified: true, coverage: { status: 'COMPLETE' }, modelHash: 'm', mechanicsHash: 'c',
    graphHash: 'g', opponentPolicyHash: 'o', metadataHash: 'd', metadataUrl: 'https://test/variant.json',
    manifestHash: 'z', manifestUrl: 'https://test/manifest.json', manifestBytes: 5,
    ruleset: 'gi', evFrame: 'nogi', evIndex: 1, lossAversion: 2 };
  let profile = frozen({ status: 'ready', fingerprint: 'p1', revision: 1 });
  let runtime = frozen({ residencyRevision: 1, deckReady: frozen({ 'Position|Top': true }) });
  const nodes = [{ id: 'pos', t: 'Position', ty: 'positions' }, { id: 'move', t: 'Move', ty: 'transitions' },
    { id: 'sub', t: 'Submission', ty: 'submissions', fromRole: 'top' }];
  const option = { node: nodes[1], idx: 1, res: 0 };
  const calls = [], client = {
    cancel(reason) { calls.push(['cancel', reason]); }, destroy() { calls.push(['destroy']); },
    async register(d) { calls.push(['register', d]); },
    async updateSnapshot(s) { calls.push(['snapshot', s]); return { snapshotId: s.id, snapshotHash: M.ngMdpDigest({ profile: s.profile, runtime: s.runtime }) }; },
    async evaluate(request) { calls.push(['evaluate', request]); return { requestId: request.requestId }; },
    async describeRoot() { calls.push(['describe']); return projection; },
  };
  let projection = { ...reg, registrationKey: ngGameValueRegistrationKey(reg, M.ngMdpStable), canonicalNodeId: 'pos',
    hand: [{ techniqueId: 'move', destinationId: 'pos', kind: 'transition', defense: null }] };
  const app = { nodes, currentPos: 0, playerRole: 'top', _giMode: 'gi', _evFrame: 'nogi', _evLamIdx: () => 1,
    _progressLoaded: true, _choiceHandId: 'hand-1', _optPick() {}, _decision: {}, _optList: [option],
    _optionCards: [{ opt: option, card: { isConnected: true } }], moveCount: 1, maxMoves: 9, aiSkill: 0.1,
    _gameValueRollRevision: 1, _gameValueContextRevision: 1, _posKey: 'Position|Top',
    canonicalState: () => 0, submissionNode: () => null, deckKeyFor: node => ({ key: node.t }),
    oppVal: () => 0, myVal: () => 0, moveChance: () => 0.5, escapeChance: () => 0.5,
    defendKeyFor: n => n.t + '|Defender', refreshChoiceValues() { calls.push(['refresh']); },
  };
  const K = { ngKnowledgeExplainMove(p, c) { calls.push(['explain', c.ruleset]); return { status: 'ready', chance: 0.5 }; },
    ngKnowledgeExplainEscape: () => ({ status: 'ready', chance: 0.5 }) };
  const deps = { instanceId: 'instance-1', mdp: M, knowledge: K, getRegistration: () => reg,
    getResidency: () => runtime, getProfile: () => profile, getRootMetadata: () => projection,
    createClient() { calls.push(['client']); return client; } };
  const provider = ngGameValueCreateProvider(deps); app._choiceValueSource = provider;
  return { app, provider, reg, nodes, option, calls, client, deps, get projection() { return projection; },
    setProjection(p) { projection = p; }, setProfile(p) { profile = frozen(p); }, setRuntime(r) { runtime = frozen(r); },
    capture() { return provider.capture(app, app._optList, app._choiceHandId); } };
}
test('capture is lazy, immutable, exact v2 identity and immediate gi probability', () => {
  const f = fixture(), c = f.capture();
  assert.equal(f.calls.some(x => x[0] === 'client'), false);
  assert.equal(c.request.contractHash, M.ngMdpContractHash(c.request));
  assert.equal(c.request.state.snapshot.arrivalAge, 0);
  assert.equal(c.request.state.snapshotHash, c.request.state.snapshotId);
  assert.equal(c.actions[0].immediateExecutionChance, 0.5);
  assert.ok(f.calls.some(x => x[0] === 'explain' && x[1] === 'gi'));
  assert.throws(() => { c.request.state.snapshot.role = 'bottom'; });
  assert.equal(f.capture(), c);
});
test('one registration and profile transfer across unchanged hands; new hand gets new request', async () => {
  const f = fixture(), a = f.capture();
  await f.provider.evaluate(a.request);
  f.app._choiceHandId = 'hand-2'; const b = f.capture();
  f.provider.cancel('superseded'); // actual consumer order is capture, then cancel prior token
  assert.equal(f.provider.isCurrent(f.app, b.request, 'hand-2'), true);
  await f.provider.evaluate(b.request);
  assert.notEqual(a.request.requestId, b.request.requestId);
  assert.equal(f.calls.filter(x => x[0] === 'register').length, 1);
  assert.equal(f.calls.filter(x => x[0] === 'snapshot').length, 1);
  assert.equal(f.calls.filter(x => x[0] === 'evaluate').length, 2);
});
test('live profile, residency, roll, modifiers and challenge reject an old response', () => {
  for (const mutate of [f => f.setProfile({ status: 'ready', fingerprint: 'p2', revision: 2 }),
    f => f.setRuntime({ residencyRevision: 2, deckReady: { 'Position|Top': false } }),
    f => f.app._gameValueRollRevision++, f => f.app._gameValueContextRevision++,
    f => f.app._qMod = -0.04, f => f.app._combo = 2, f => f.app.moveCount++,
    f => f.app.maxMoves++, f => f.app.aiSkill += 0.01, f => f.app._posKey = 'Other',
    f => f.app._beltTest = { names: ['X'], pointsWin: 3 }, f => f.app._giMode = 'nogi',
    f => f.app._evFrame = 'gi', f => f.app._optionCards[0].card.isConnected = false,
    f => f.app._execution = {}, f => f.app.__ngDestroyed = true]) {
    const f = fixture(), c = f.capture(); mutate(f);
    assert.equal(f.provider.isCurrent(f.app, c.request, 'hand-1'), false);
  }
});
test('caller cannot change requested support while reusing contract hash', () => {
  const f = fixture(), c = f.capture();
  assert.equal(f.provider.isCurrent(f.app, { ...c.request, requestedActionIds: [] }, 'hand-1'), false);
});
test('entry is deterministic and does not call finish explanation', () => {
  const f = fixture(); f.option.node = f.nodes[2]; f.option.action = 'enter';
  f.setProjection({ ...f.projection, hand: [{ techniqueId: 'sub', destinationId: 'pos', kind: 'entry', defense: null }] });
  const c = f.capture();
  assert.equal(c.actions[0].immediateExecutionChance, 1);
  assert.equal(c.actions[0].explanation, undefined);
  assert.equal(f.calls.some(x => x[0] === 'explain'), false);
});
test('two same-node escapes preserve distinct producer defense identities', () => {
  const f = fixture(); f.app._defendSub = 2;
  f.nodes[2]._defenseDetails = [{ title: 'First escape' }, { title: 'Second escape' }];
  const options = [0, 1].map(detail => ({ node: f.nodes[2], idx: 2, res: 0, action: 'escape', defense: { to: 'pos', detail } }));
  f.app._optList = options; f.app._optionCards = options.map(opt => ({ opt, card: { isConnected: true } }));
  f.setProjection({ ...f.projection, hand: options.map((opt, i) => ({ techniqueId: 'sub', destinationId: 'pos', kind: 'escape',
    defense: opt.defense, defenseId: M.ngMdpDefenseId(opt.defense, f.nodes[2]._defenseDetails[i]) })) });
  const c = f.capture(); assert.notEqual(c.actions[0].actionId, c.actions[1].actionId);
  f.setProjection({ ...f.projection, hand: [f.projection.hand[0], { ...f.projection.hand[0] }] });
  assert.throws(() => f.capture(), /ambiguous-action-identity/);
});
test('changed current defense content cannot reuse a same-offset producer action', () => {
  const f = fixture(); f.app._defendSub = 2; f.nodes[2]._defenseDetails = [{ title: 'Current escape' }];
  Object.assign(f.option, { node: f.nodes[2], action: 'escape', defense: { to: 'pos', detail: 0 } });
  f.setProjection({ ...f.projection, hand: [{ techniqueId: 'sub', destinationId: 'pos', kind: 'escape', defense: f.option.defense,
    defenseId: M.ngMdpDefenseId(f.option.defense, { title: 'Previous escape' }) }] });
  assert.throws(() => f.capture(), /unregistered-live-action/);
});
test('current exact odds must agree with shared explanation', () => {
  const f = fixture(); f.app.moveChance = () => 0.500000001;
  assert.throws(() => f.capture(), /live-knowledge-probability-mismatch/);
});
test('snapshot acknowledgement mismatch never evaluates', async () => {
  const f = fixture(), c = f.capture(); f.client.updateSnapshot = async () => ({ snapshotId: 'wrong', snapshotHash: 'wrong' });
  await assert.rejects(f.provider.evaluate(c.request), /snapshot-ack-mismatch/);
  assert.equal(f.calls.some(x => x[0] === 'evaluate'), false);
});
test('deferred root preparation is bounded and same-hand refreshes only after verified projection', async () => {
  const f = fixture(); delete f.deps.getRootMetadata;
  const p = ngGameValueCreateProvider(f.deps); f.app._choiceValueSource = p;
  assert.throws(() => p.capture(f.app, f.app._optList, 'hand-1'), /root-metadata-pending/);
  await p.prepare(f.app);
  assert.equal(f.calls.filter(x => x[0] === 'describe').length, 1);
  assert.equal(f.calls.filter(x => x[0] === 'refresh').length, 1);
  assert.ok(p.capture(f.app, f.app._optList, 'hand-1'));
});
test('termination reset retires old request and recreates transport lazily', async () => {
  const f = fixture(), c = f.capture(); await f.provider.evaluate(c.request);
  f.provider.resetClient('worker-computation-deadline');
  assert.equal(f.provider.isCurrent(f.app, c.request, 'hand-1'), false);
  assert.equal(f.calls.filter(x => x[0] === 'client').length, 1);
  const next = f.capture(); await f.provider.evaluate(next.request);
  assert.equal(f.calls.filter(x => x[0] === 'client').length, 2);
  assert.equal(f.calls.filter(x => x[0] === 'snapshot').length, 2);
  f.provider.destroy(); assert.throws(() => f.capture(), /no-current-playable-hand/);
});
test('late old-root preparation cannot overwrite the current root projection', async () => {
  const f = fixture(); delete f.deps.getRootMetadata;
  const pending = new Map(); f.client.describeRoot = query => new Promise(resolve => pending.set(query.nodeId, resolve));
  f.app.canonicalState = () => f.app.currentPos;
  const p = ngGameValueCreateProvider(f.deps); f.app._choiceValueSource = p;
  const a = p.prepare(f.app); await new Promise(resolve => setImmediate(resolve));
  f.app.currentPos = 1;
  const b = p.prepare(f.app); await new Promise(resolve => setImmediate(resolve));
  pending.get('move')({ ...f.projection, canonicalNodeId: 'move' }); await b;
  pending.get('pos')(f.projection); await a;
  const c = p.capture(f.app, f.app._optList, 'hand-1');
  assert.equal(c.request.state.snapshot.nodeId, 'move');
});
