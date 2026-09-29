// Edge lighting (`cal.ew` on position nodes) must light the technique each authored move TARGETS.
// The emitter used to join a move by its short display name, so "Kneebar" at backside-50-50/top
// (target: the submission Kneebar from Backside 50-50) and "Aoki Lock" at aoki-lock-control/top
// (target: Aoki Lock from Aoki Lock Control) lit the unrelated transitions "Kneebar" / "Aoki Lock".
// Mutation evidence (v1.204.5): restoring the name join in scripts/regenerate_neural_data.py makes
// both tests below fail. Reads the emitted wire, which CI emits before the unit suites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const wire = read('source/quartz/static/neural/graph-data.json');
const graph = read('graph.json');

// An independent join: graph.json's own entry for a move's target carries the display name its
// wire node has (non-position titles are unique on the wire).
const byTitle = new Map(wire.nodes.filter(node => node.ty !== 'positions').map(node => [node.ty + '|' + node.t, node]));
const targetNode = move => {
  const kind = move.isSubmission ? 'submissions' : 'transitions';
  return byTitle.get(kind + '|' + graph[kind][move.target]?.name);
};
// Python's round(): half to even, which is what the emitter writes.
const pyRound = x => { const f = Math.floor(x); return x - f === 0.5 ? f + (f % 2) : Math.round(x); };
const edges = node => new Map((node.cal?.ew || []).map(([index, weight]) => [wire.nodes[index].id, weight]));
const position = posId => wire.nodes.find(node => node.ty === 'positions' && node.posId === posId);

test('every position lights exactly its authored moves, joined by target, at attempt x success', () => {
  let moves = 0, lit = 0;
  for (const node of wire.nodes.filter(node => node.ty === 'positions')) {
    const best = new Map();
    for (const role of ['top', 'bottom']) for (const move of graph.positions[node.posId + '/' + role]?.transitions || []) {
      const target = targetNode(move);
      assert.ok(target, `${node.posId}/${role}: ${move.target} resolves`);
      moves++;
      const w = Math.max(0, (move.attemptProbability || 0) / 100) * Math.max(0, (move.successRate || 0) / 100);
      if (w > (best.get(target.id) || 0)) best.set(target.id, w);
    }
    const expected = new Map([...best].map(([id, w]) => [id, pyRound(w * 10000)]).filter(([, v]) => v > 0));
    assert.deepEqual(edges(node), expected, node.id);
    lit += expected.size;
  }
  assert.ok(moves > 2000 && lit > 2000, `${moves} authored moves, ${lit} lit edges compared`);
});

test('Kneebar and Aoki Lock light the submission the move leads to, not the transition that shares its name', () => {
  const backside = edges(position('backside-50-50'));
  assert.equal(backside.get('Submissions/Kneebar/from-Backside-50-50'), 520);
  assert.equal(backside.has('Transitions/Kneebar'), false);
  const aoki = edges(position('aoki-lock-control'));
  assert.ok(aoki.get('Submissions/Aoki-Lock/from-Aoki-Lock-Control') > 0);
  assert.equal(aoki.has('Transitions/Aoki-Lock'), false);
});
