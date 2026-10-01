// Win-chance probe (not a gate; evidence for the owner screen and the archive, CLAUDE.md §6.9):
// real Win-chance solves at named states, with and without threat probes, on the checkout's own
// MDP sources, emitted wire and the decoded mechanics metadata. Every Win-chance figure quoted in
// docs/Changelog-Archive.md's full-game entry recomputes with it.
//
//   python3 -B scripts/regenerate_mdp_data.py --source-root . --data-root source/quartz/static/neural \
//     --output <tmp>/transport --decoded-output <tmp>/decoded
//   ROOT=. DECODED=<tmp>/decoded node tests/artifacts/_win_chance_probe.mjs
//   (FRAME=gi|nogi, CAP=<moves left>, AI=<opponent skill>, STATES='[[label,nodeId,role],…]' optional)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const ROOT = process.env.ROOT, DECODED = process.env.DECODED;
const read = p => readFileSync(resolve(ROOT, p), 'utf8');
const M = new Function('module', 'require', read('neural/src/mdp-identity.src.js') + '\n' + read('neural/src/mdp-model.src.js')
  + '\nconst core=module.exports;\n' + read('neural/src/mdp-adapter.src.js') + '\nreturn {...core,...module.exports};')(
  { exports: {} }, createRequire(resolve(ROOT, 'neural/src/mdp-model.src.js')));
const K = await import('data:text/javascript;base64,' + Buffer.from(read('neural/src/knowledge-profile.src.js')).toString('base64'));
const digest = x => createHash('sha256').update(x).digest('hex');
const raw = readFileSync(resolve(ROOT, 'source/quartz/static/neural/graph-data.json'));
const frame = process.env.FRAME || 'gi', cap = Number(process.env.CAP || 11), aiSkill = Number(process.env.AI || 0.13);
const graph = JSON.parse(readFileSync(resolve(DECODED, frame + '-lambda-2.json')));
const profile = K.ngKnowledgeBuildProfile({});
const adapter = M.ngMdpCreateGameAdapter(graph, profile, K, { deckReady: {} });
const byId = new Map(graph.nodes.map(n => [n.id, n]));
const title = id => (byId.get(id) || {}).t || id;
const flip = r => r === 'top' ? 'bottom' : 'top';
const pct = v => v == null ? '—' : (Math.round(v * 1000) / 10) + '%';

function request(nodeId, role, threatIds) {
  const n = byId.get(nodeId);
  const snapshot = { nodeId, role, phase: 'user', moveCount: 0, arrivalAge: 0, qMod: 0, combo: 0, positionKey: n.deckKey, panicKey: null };
  const r = { apiVersion: 2, requestId: 'probe', revision: 1, modelHash: 'probe:' + digest(JSON.stringify(graph)),
    mechanicsHash: 'probe-law:' + digest(read('neural/src/mdp-adapter.src.js')), graphHash: digest(raw), profileHash: profile.fingerprint,
    opponentPolicyHash: 'probe-source:' + digest(read('neural/src/app.src.jsx')), ruleset: graph.ruleset,
    state: { id: '', snapshot, aiSkill }, horizon: { kind: 'actual-roll', episodeCap: cap, moveCount: 0 },
    objective: 'max-win/min-loss/min-nontermination', futureStudyPolicy: 'no-additional-study-events', ...(threatIds ? { threatIds } : {}) };
  r.state.id = adapter.stateId(snapshot, r);
  return r;
}
const limits = { maxStates: 40000, maxBranches: 400000 };
function solve(nodeId, role, withThreats) {
  const hand = graph.hands[M.ngMdpStable([nodeId, flip(role)])] || [];
  const threatIds = withThreats ? [...new Set(hand.map(a => a.kind === 'escape' ? 'escape:' + a.techniqueId + '>' + a.destinationId : a.techniqueId))] : null;
  const req = request(nodeId, role, threatIds);
  const t0 = performance.now();
  const model = M.ngMdpExpand(adapter, req, { ...limits, maxMilliseconds: 60000 });
  const t1 = performance.now();
  const result = M.ngMdpSolve(model, req, { ...limits, maxMilliseconds: 120000 });
  const t2 = performance.now();
  return { req, model, result, states: model.states.length, expandMs: Math.round(t1 - t0), solveMs: Math.round(t2 - t1) };
}

const out = [];
for (const [label, nodeId, role] of (process.env.STATES ? JSON.parse(process.env.STATES) : [
  ['Mount, you on top', 'Positions/Mount', 'top'],
  ['Closed Guard, you on the bottom', 'Positions/Closed-Guard/Bottom', 'bottom'],
  ['Back Control, you on the back', 'Positions/Back-Control', 'top'],
  ['K-Guard, you on top', 'Positions/K-Guard', 'top'],
  ['Triangle Choke, you applying it', 'Submissions/Triangle-Choke/from-Triangle-Control', 'bottom'],
])) {
  if (!byId.has(nodeId)) { out.push({ label, nodeId, error: 'unknown-node' }); continue; }
  const base = solve(nodeId, role, false), probed = solve(nodeId, role, true);
  const r = probed.result;
  const actionName = id => { try { return title(JSON.parse(id)[1]); } catch { return id; } };
  const cards = (r.actions || []).map(a => ({ card: actionName(a.actionId), kind: a.immediateExecutionKind, immediate: pct(a.immediateExecutionChance),
    win: pct(a.outcomes?.win), loss: pct(a.outcomes?.loss), noTap: pct(a.outcomes && a.outcomes.explicitNoResult + a.outcomes.nontermination),
    split: a.split ? { lands: pct(a.split.lands), winIfLands: pct(a.split.winIfLands), winIfMisses: pct(a.split.winIfMisses) } : null,
    selected: !!a.selected, rawWin: a.outcomes?.win }))
    .sort((x, y) => y.rawWin - x.rawWin);
  const tname = id => id.startsWith('escape:') ? 'escape to ' + title(id.split('>')[1]) : title(id);
  const threats = (r.threats || []).map(t => ({ threat: tname(t.techniqueId), status: t.status, reason: t.reason,
    yourWin: pct(t.outcomes?.win), yourLoss: pct(t.outcomes?.loss), rawWin: t.outcomes?.win })).sort((x, y) => (x.rawWin ?? 2) - (y.rawWin ?? 2));
  const sameRoot = base.result.root?.outcomes?.win === r.root?.outcomes?.win;
  out.push({ label, nodeId, role, frame, cap, aiSkill,
    vs: pct(r.root?.outcomes?.win), vsBase: pct(base.result.root?.outcomes?.win), rootUnchangedByProbes: sameRoot,
    rootWinDelta: Math.abs((base.result.root?.outcomes?.win ?? 0) - (r.root?.outcomes?.win ?? 0)),
    quality: r.quality?.numericalStatus, maxWinError: r.quality?.maxWinError,
    cost: { withoutThreats: { states: base.states, expandMs: base.expandMs, solveMs: base.solveMs },
      withThreats: { states: probed.states, expandMs: probed.expandMs, solveMs: probed.solveMs } },
    cards, threats });
}
console.log(JSON.stringify(out, null, 1));
