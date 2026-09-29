// THREAT PROBES (v1.207.0; owner ruling 2026-09-29: a threat card shows YOUR win chance if the
// opponent tries that move). Real emitted corpus, real adapter and solver; no fixture stands in for a
// missing corpus and nothing is skipped. What this pins:
//   1. `threats()` values exactly the opponent's options from here, and says why it cannot otherwise;
//   2. a positional threat's rows ARE the forced opponent action's rows for that move, unscaled —
//      one implementation (`opponentPositionalRows`), so a threat card and the game cannot disagree;
//   3. seeding probes changes no root or card value (optimal values are per state), bit for bit;
//   4. every threat record is a proper outcome vector under the root's own selected future play.
// Mutants, run 2026-09-29 on a scratch copy: halving a threat's row weight in `threats()` -> KILLED
// (test 3: the compiler refuses a non-normalized probe). Starting the probe in phase 'user' instead
// of 'opponent' -> SURVIVES, and is EQUIVALENT: `arrive` and `defend` set the successor's phase, so
// the probe's incoming phase never reaches a row. Named here so nobody reads it as covered.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const M = new Function('module', 'require', read('neural/src/mdp-identity.src.js') + '\n' + read('neural/src/mdp-model.src.js')
  + '\nconst core=module.exports;\n' + read('neural/src/mdp-adapter.src.js') + '\nreturn {...core,...module.exports};')(
  { exports: {} }, createRequire(new URL('../neural/src/mdp-model.src.js', import.meta.url)));
const K = await import('data:text/javascript;base64,' + Buffer.from(read('neural/src/knowledge-profile.src.js')).toString('base64'));
const root = fileURLToPath(new URL('..', import.meta.url)), wire = resolve(root, 'source/quartz/static/neural');
const generated = mkdtempSync(resolve(tmpdir(), 'mdp-threats-'));
after(() => rmSync(generated, { recursive: true, force: true }));
execFileSync('python3', ['-B', resolve(root, 'scripts/regenerate_mdp_data.py'), '--source-root', root, '--data-root', wire,
  '--output', resolve(generated, 'transport'), '--decoded-output', resolve(generated, 'decoded')], { encoding: 'utf8', timeout: 60000 });
const graph = JSON.parse(readFileSync(resolve(generated, 'decoded/gi-lambda-2.json'), 'utf8'));
const digest = x => createHash('sha256').update(x).digest('hex');
const profile = K.ngKnowledgeBuildProfile({});
const adapter = M.ngMdpCreateGameAdapter(graph, profile, K, { deckReady: {} });
const nodes = new Map(graph.nodes.map(n => [n.id, n]));
const flip = r => r === 'top' ? 'bottom' : 'top';

function request(nodeId, role, cap, threatIds) {
  const snapshot = { nodeId, role, phase: 'user', moveCount: 0, arrivalAge: 0, qMod: 0, combo: 0, positionKey: nodes.get(nodeId).deckKey, panicKey: null };
  const r = { apiVersion: 2, requestId: 'threats', revision: 1, modelHash: 'threats', mechanicsHash: 'threats-law', graphHash: digest(read('neural/src/mdp-adapter.src.js')),
    profileHash: profile.fingerprint, opponentPolicyHash: 'threats-opponent', ruleset: graph.ruleset, state: { id: '', snapshot, aiSkill: .13 },
    horizon: { kind: 'actual-roll', episodeCap: cap, moveCount: 0 }, objective: 'max-win/min-loss/min-nontermination',
    futureStudyPolicy: 'no-additional-study-events', ...(threatIds ? { threatIds } : {}) };
  r.state.id = adapter.stateId(snapshot, r);
  return r;
}
const opponentOptions = (nodeId, role) => [...new Set((graph.hands[M.ngMdpStable([nodeId, flip(role)])] || []).map(a => a.techniqueId))];
const positions = [['Positions/Mount', 'top'], ['Positions/Closed-Guard/Bottom', 'bottom'], ['Positions/K-Guard', 'top']];

test('threat probes value exactly the opponent options, and say why they cannot otherwise', () => {
  let ready = 0;
  for (const [nodeId, role] of positions) {
    const ids = opponentOptions(nodeId, role), req = request(nodeId, role, 5);
    assert.ok(ids.length >= 2, nodeId + ' has real opponent options');
    const probes = adapter.threats(req.state.snapshot, req, [...ids, 'Transitions/Not-A-Real-Move']);
    assert.deepEqual(probes.map(p => p.techniqueId), [...ids, 'Transitions/Not-A-Real-Move']);
    for (const p of probes.slice(0, -1)) { assert.equal(p.status, 'ready', p.techniqueId); assert.ok(p.branches.length > 0); ready++; }
    assert.deepEqual({ status: probes.at(-1).status, reason: probes.at(-1).reason }, { status: 'unavailable', reason: 'not-an-opponent-option' });
  }
  const s = graph.nodes.find(n => n.ty === 'submissions' && n.t === 'Rear Naked Choke from Back Control' && n.role === 'defender');
  assert.ok(s, 'a real defended submission');
  const req = request(s.id, 'bottom', 5), probe = adapter.threats(req.state.snapshot, req, ['anything'])[0];
  assert.deepEqual({ status: probe.status, reason: probe.reason }, { status: 'unavailable', reason: 'defending-now' });
  assert.ok(ready > 10, 'positive coverage: ' + ready + ' ready probes');
});

test("a positional threat's rows are the forced opponent action's rows for that move, unscaled", () => {
  // At the opponent's turn on Mount (after a same-state miss, count unchanged) the forced action
  // mixes the policy's chosen positional moves with ONE equal weight each. Rows two moves share are
  // ambiguous, so only each threat's UNIQUE rows are compared: a chosen threat's unique rows must
  // all sit in the mixture at one common weight, the same weight for every chosen threat; an
  // unchosen threat's unique rows must all be absent. Destination, events and terminal are the key.
  const [nodeId, role] = positions[0];
  const req = request(nodeId, role, 5), s = { ...req.state.snapshot, phase: 'opponent' };
  const key = b => JSON.stringify([b.next ? adapter.stateId(b.next, req) : null, b.terminal || null, b.subtype || null, b.events]);
  const add = (m, k, p) => m.set(k, m.has(k) ? M.ngMdpAdd(m.get(k), p) : p);
  const pool = new Map();
  for (const b of adapter.enumerate(s, req).actions[0].branches) add(pool, key(b), M.ngMdpRat(b.probability));
  const probes = adapter.threats(req.state.snapshot, req, opponentOptions(nodeId, role))
    .filter(p => p.status === 'ready' && p.branches.every(b => b.events.includes('opponent-positional')))
    .map(p => { const m = new Map(); for (const b of p.branches) add(m, key(b), M.ngMdpRat(b.probability)); return { id: p.techniqueId, m }; });
  const owners = new Map();
  for (const p of probes) for (const k of p.m.keys()) owners.set(k, (owners.get(k) || 0) + 1);
  const same = (x, y) => x[0] * y[1] === y[0] * x[1]; // exact rational equality, [numerator, denominator]
  let weight = null, chosen = 0, unchosen = 0;
  for (const p of probes) {
    const unique = [...p.m.keys()].filter(k => owners.get(k) === 1);
    if (!unique.length) continue;
    const present = unique.filter(k => pool.has(k));
    if (!present.length) { unchosen++; continue; }
    assert.equal(present.length, unique.length, p.id + ': a threat is wholly in the mixture or wholly out');
    for (const k of unique) {
      const ratio = M.ngMdpDiv(pool.get(k), p.m.get(k));
      if (weight == null) weight = ratio;
      assert.ok(same(ratio, weight), p.id + ': one common weight across every chosen threat');
    }
    chosen++;
  }
  assert.ok(chosen >= 1 && unchosen >= 1, `both kinds exercised: ${chosen} chosen, ${unchosen} outside the policy's three`);
});

test('seeding threat probes changes no root or card value, and every threat is a proper vector', () => {
  for (const [nodeId, role] of positions) {
    const plain = request(nodeId, role, 5), probed = request(nodeId, role, 5, opponentOptions(nodeId, role));
    const limits = { maxStates: 40000, maxBranches: 400000, maxMilliseconds: 60000 };
    const a = M.ngMdpSolve(M.ngMdpExpand(adapter, plain, limits), plain, limits);
    const b = M.ngMdpSolve(M.ngMdpExpand(adapter, probed, limits), probed, limits);
    assert.deepEqual(b.root.outcomes, a.root.outcomes, nodeId + ' root');
    assert.deepEqual(b.actions.map(x => x.outcomes), a.actions.map(x => x.outcomes), nodeId + ' cards');
    assert.equal(a.threats, undefined);
    assert.equal(b.threats.length, probed.threatIds.length);
    for (const t of b.threats) {
      assert.ok(['ready', 'bounded'].includes(t.status), t.techniqueId + ' ' + t.reason);
      assert.equal(t.policyId, b.root.policyId);
      const o = t.outcomes, sum = o.win + o.loss + o.explicitNoResult + o.nontermination;
      assert.ok(Math.abs(sum - 1) < 1e-12 && o.win >= 0 && o.win <= 1, t.techniqueId + ' vector');
    }
  }
});
