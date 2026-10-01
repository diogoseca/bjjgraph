var ngMdpIdentity = typeof module !== 'undefined' && module.exports ? require('./mdp-identity.src.js') : { NG_MDP_API_VERSION, NG_MDP_OBJECTIVE, ngMdpStable, ngMdpDigest, ngMdpContractHash, ngMdpActionId, ngMdpStateId, ngMdpEnvelope };
/* Game-model contract, v2. No DOM, storage, RNG or authored-attempt policy.
 * All branches are conditional on choosing ONE action. A row must sum to exactly
 * one; rational strings ("1/3") allow adapters to preserve normalized raw weights.
 * A missing row is unavailable, never an implicit loss/reset. The model owns ALL
 * mechanical clocks: the solver neither decrements moves nor invents a deadline.
 *
 * States: {id, actions:[{id, branches:[{probability,to} | {probability,
 * terminal:'win'|'loss'|'explicitNoResult'|'nontermination',subtype?}],
 * immediateExecutionChance?, status?, reason?}], rank?}. Positive branches define
 * support. rank is advisory until independently verified by the Q comparator.
 * modelHash/mechanicsHash/graphHash/profileHash/opponentPolicyHash/ruleset bind
 * this instantiated kernel to a request. Hubs need an explicit decision context.
 *
 * Small kernels use exact lexicographic policy iteration. Larger kernels use the
 * separately certified MEC quotient route (bounded primary regret and explicit
 * unresolved secondary ties). The independent exact reference solves the SCC DAG
 * from its sinks. Acyclic components need one
 * backup. Within a cyclic component enumerate deterministic stationary policies,
 * classify each policy's closed classes, and solve its transient equations over
 * rational numbers. Choose the lexicographically optimal vector at EVERY state:
 * max win, min loss, min nontermination. Enumeration (unlike arbitrary Bellman
 * equality tie breaks) rejects nonprogress policies. Terminal events are mutually
 * exclusive, so a deterministic stationary policy attaining these finite-MDP
 * lexicographic objectives simultaneously exists. Verify that property explicitly.
 * Exhausting a computation limit returns unavailable, not a shortened horizon.
 * This algorithm is an exact, bounded reference, not a corpus performance claim.
 */
var NG_MDP_OUTCOMES = ['win', 'loss', 'explicitNoResult', 'nontermination'];
var NG_MDP_RATIONAL_BITS = 16384;
var NG_MDP_ACTIVE_RATIONAL_BITS = NG_MDP_RATIONAL_BITS;

function ngMdpGcd(a, b) { a = a < 0n ? -a : a; while (b) { const t = a % b; a = b; b = t; } return a; }
function ngMdpRational(n, d) {
  if (n.toString(2).length + d.toString(2).length > NG_MDP_ACTIVE_RATIONAL_BITS) throw new Error('rational-size-budget');
  if (d === 0n) throw new Error('zero-denominator');
  if (!n) return [0n, 1n];
  if (d < 0n) { n = -n; d = -d; }
  const g = ngMdpGcd(n, d); return [n / g, d / g];
}
function ngMdpRat(value) {
  if (Array.isArray(value) && typeof value[0] === 'bigint') return ngMdpRational(value[0], value[1]);
  if (!['string', 'number'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value)))
    throw new Error('invalid-probability');
  let s = String(value);
  // Reject adversarial/raw oversized strings BEFORE regex, BigInt parsing or pow.
  const decimalBudget = Math.min(4096, Math.ceil(NG_MDP_ACTIVE_RATIONAL_BITS / Math.log2(10)) + 6);
  if (s.length > decimalBudget) throw new Error('rational-input-budget');
  s = s.replace(/^(-?)\./, (_match, sign) => sign + '0.');
  if (/^-?\d+\/\d+$/.test(s)) { const [n, d] = s.split('/'); return ngMdpRational(BigInt(n), BigInt(d)); }
  const m = /^(-?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s);
  if (!m) throw new Error('invalid-probability');
  const e = +(m[4] || 0) - (m[3] || '').length;
  if (Math.abs(e) + m[2].length + (m[3] || '').length > decimalBudget) throw new Error('rational-input-budget');
  let n = BigInt(m[2] + (m[3] || '')) * (m[1] ? -1n : 1n), d = 1n;
  if (e >= 0) n *= 10n ** BigInt(e); else d = 10n ** BigInt(-e);
  return ngMdpRational(n, d);
}
function ngMdpProducts(a, b) {
  if (a[0].toString(2).length + a[1].toString(2).length + b[0].toString(2).length + b[1].toString(2).length + 2 > NG_MDP_ACTIVE_RATIONAL_BITS)
    throw new Error('rational-intermediate-budget');
}
function ngMdpAdd(a, b) {
  if (!a[0]) return b; if (!b[0]) return a;
  ngMdpProducts(a,b);
  const g=ngMdpGcd(a[1],b[1]),left=a[1]/g,right=b[1]/g;
  return ngMdpRational(a[0]*right+b[0]*left,left*b[1]);
}
function ngMdpSub(a, b) { return ngMdpAdd(a,[-b[0],b[1]]); }
function ngMdpMul(a, b) {
  if (!a[0] || !b[0]) return [0n,1n];
  ngMdpProducts(a,b);
  const g=ngMdpGcd(a[0],b[1]),h=ngMdpGcd(b[0],a[1]);
  return ngMdpRational((a[0]/g)*(b[0]/h),(a[1]/h)*(b[1]/g));
}
function ngMdpDiv(a, b) { if(!b[0])throw new Error('zero-denominator');return ngMdpMul(a,ngMdpRational(b[1],b[0])); }
function ngMdpCmp(a, b) { if(a[0]===b[0]&&a[1]===b[1])return 0;const v = a[0] * b[1] - b[0] * a[1]; return v > 0n ? 1 : v < 0n ? -1 : 0; }
function ngMdpProbability(value) { const a = ngMdpRat(value); if (a[0] < 0n || a[0] > a[1]) throw new Error('probability-out-of-range'); return a; }
function ngMdpFraction(a) { return a[0] + '/' + a[1]; }
function ngMdpNumber(a) {
  if (!a[0]) return 0;
  const sign = a[0] < 0n ? -1 : 1, n = a[0] < 0n ? -a[0] : a[0], d = a[1];
  let exponent = n.toString(2).length - d.toString(2).length;
  if (exponent >= 0 ? n < (d << BigInt(exponent)) : (n << BigInt(-exponent)) < d) exponent--;
  // Round once, in integer arithmetic, to nearest binary64, ties to even.
  // Subnormal spacing is fixed at 2^-1074. No truncated decimal prefixes and
  // no Infinity/Infinity intermediary, even for enormous exact fractions.
  if (exponent > 1023) return sign * Infinity;
  const shift = exponent < -1022 ? 1074 : 52 - exponent;
  const numerator = shift >= 0 ? n << BigInt(shift) : n;
  const denominator = shift < 0 ? d << BigInt(-shift) : d;
  let quotient = numerator / denominator;
  const remainder = numerator % denominator, twice = remainder * 2n;
  if (twice > denominator || (twice === denominator && (quotient & 1n))) quotient++;
  return sign * Number(quotient) * 2 ** (-shift);
}
function ngMdpZero(size) { return Array.from({ length: size }, () => [0n, 1n]); }
function ngMdpLex(a, b) {
  for (const [i, direction] of [[0, 1], [1, -1], [3, -1]]) {
    const c = ngMdpCmp(a[i], b[i]); if (c) return c * direction;
  }
  return 0;
}
function ngMdpAccumulate(target, p, v) { for (let i = 0; i < target.length; i++) target[i] = ngMdpAdd(target[i], ngMdpMul(p, v[i])); }
function* ngMdpSupportHashSteps(states, check) {
  // Canonical sorted indices losslessly replace repeated, often long state IDs.
  // The dictionary is part of the digest; no string namespace is reserved.
  const ids = [...states.keys()].sort(), index = new Map(ids.map((id,i) => [id,i])), hashes = [];
  for (const id of ids) {
    check();
    hashes.push(ngMdpIdentity.ngMdpDigest(states.get(id).actions.map(a => [a.id,
      a.branches.map(b => [ngMdpFraction(b.p), b.to ? index.get(b.to) : null, b.terminal || null,
        b.subtype || null, b.duration == null ? null : b.duration, b.events || []])])));
    yield;
  }
  const hash = ngMdpIdentity.ngMdpDigest(['indexed-support-v1',ids,hashes]); check(); return hash;
}
function ngMdpPolicyHash(states, policy, supportHash) {
  // Action indices are bound to the complete ordered kernel above. This avoids
  // serializing the same state and action strings a second time just for policyId.
  return 'policy:' + ngMdpIdentity.ngMdpDigest(['support-policy-v1', supportHash,
    [...states.keys()].sort().map(id => states.get(id).actions.indexOf(policy.get(id)))]);
}

// Iterative Kosaraju: no JS recursion ceiling on corpus-length paths. Sinks first.
function ngMdpComponents(ids, neighbors) {
  const allowed = new Set(ids), reverse = new Map(ids.map(id => [id, []]));
  const edges = new Map(ids.map(id => [id, [...new Set(neighbors(id))].filter(x => allowed.has(x))]));
  for (const [id, next] of edges) for (const n of next) reverse.get(n).push(id);
  const seen = new Set(), finish = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id); const stack = [[id, 0]];
    while (stack.length) {
      const top = stack[stack.length - 1], list = edges.get(top[0]);
      if (top[1] === list.length) { finish.push(top[0]); stack.pop(); }
      else { const next = list[top[1]++]; if (!seen.has(next)) { seen.add(next); stack.push([next, 0]); } }
    }
  }
  seen.clear(); const components = [];
  for (const id of finish.reverse()) {
    if (seen.has(id)) continue;
    const component = [], stack = [id]; seen.add(id);
    while (stack.length) { const x = stack.pop(); component.push(x); for (const n of reverse.get(x)) if (!seen.has(n)) { seen.add(n); stack.push(n); } }
    components.push(component.sort());
  }
  return components.reverse();
}
function ngMdpLinear(matrix, rhs, check) {
  const n = matrix.length, width = rhs[0] ? rhs[0].length : 0;
  for (let k = 0; k < n; k++) {
    check(); let pivot = k; while (pivot < n && !matrix[pivot][k][0]) pivot++;
    if (pivot === n) throw new Error('singular-transient-system');
    [matrix[k], matrix[pivot]] = [matrix[pivot], matrix[k]];
    [rhs[k], rhs[pivot]] = [rhs[pivot], rhs[k]];
    const p = matrix[k][k];
    for (let j = k; j < n; j++) matrix[k][j] = ngMdpDiv(matrix[k][j], p);
    for (let j = 0; j < width; j++) rhs[k][j] = ngMdpDiv(rhs[k][j], p);
    for (let i = 0; i < n; i++) {
      if (i === k || !matrix[i][k][0]) continue;
      const q = matrix[i][k];
      for (let j = k; j < n; j++) matrix[i][j] = ngMdpSub(matrix[i][j], ngMdpMul(q, matrix[k][j]));
      for (let j = 0; j < width; j++) rhs[i][j] = ngMdpSub(rhs[i][j], ngMdpMul(q, rhs[k][j]));
    }
  }
  return rhs;
}
// Sparse forward elimination and back substitution. The dense SCC-size shortcut
// was an artificial 64-state limitation even for a simple leaky ring. Guard actual
// fill and rational work instead, yielding once per pivot for worker cancellation.
function* ngMdpSparseLinearSteps(rows, rhs, limits, check) {
  const n = rows.length, width = rhs[0] ? rhs[0].length : 0;
  let terms = rows.reduce((sum, row) => sum + row.size, 0);
  if (terms > limits.maxLinearTerms) throw new Error('linear-fill-budget');
  for (let k = 0; k < n; k++) {
    check(); let pivot = -1;
    for (let i = k; i < n; i++) if (rows[i].has(k) && (pivot < 0 || rows[i].size < rows[pivot].size)) pivot = i;
    if (pivot < 0) throw new Error('singular-transient-system');
    [rows[k], rows[pivot]] = [rows[pivot], rows[k]]; [rhs[k], rhs[pivot]] = [rhs[pivot], rhs[k]];
    const p = rows[k].get(k);
    for (const [j, v] of rows[k]) rows[k].set(j, ngMdpDiv(v, p));
    for (let c = 0; c < width; c++) rhs[k][c] = ngMdpDiv(rhs[k][c], p);
    for (let i = k + 1; i < n; i++) {
      const q = rows[i].get(k); if (!q) continue;
      rows[i].delete(k); terms--;
      for (const [j, v] of rows[k]) {
        if (j === k) continue;
        const old = rows[i].get(j), updated = ngMdpSub(old || ngMdpRat(0), ngMdpMul(q, v));
        if (!updated[0]) { if (old) { rows[i].delete(j); terms--; } }
        else { if (!old) terms++; rows[i].set(j, updated); }
      }
      if (terms > limits.maxLinearTerms) throw new Error('linear-fill-budget');
      for (let c = 0; c < width; c++) rhs[i][c] = ngMdpSub(rhs[i][c], ngMdpMul(q, rhs[k][c]));
    }
    yield;
  }
  for (let i = n - 1; i >= 0; i--) {
    check(); for (const [j, p] of rows[i]) if (j > i) for (let c = 0; c < width; c++) rhs[i][c] = ngMdpSub(rhs[i][c], ngMdpMul(p, rhs[j][c]));
    yield;
  }
  return rhs;
}
function ngMdpCompile(model, request, limits) {
  if (request.apiVersion !== 2 || request.objective !== ngMdpIdentity.NG_MDP_OBJECTIVE || request.futureStudyPolicy !== 'no-additional-study-events') throw new Error('unsupported-contract');
  if (!request.requestId || !Number.isSafeInteger(request.revision) || !['gi', 'nogi'].includes(request.ruleset)) throw new Error('invalid-request');
  if (!request.horizon || !['actual-roll', 'eventual'].includes(request.horizon.kind)) throw new Error('invalid-horizon');
  if (request.horizon.kind === 'actual-roll' && (!Number.isSafeInteger(request.horizon.episodeCap) || request.horizon.episodeCap <= 0 || !Number.isSafeInteger(request.horizon.moveCount) || request.horizon.moveCount < 0)) throw new Error('missing-live-clock');
  for (const key of ['modelHash', 'mechanicsHash', 'graphHash', 'profileHash', 'opponentPolicyHash', 'ruleset'])
    if (!request[key] || model[key] !== request[key]) throw new Error('stale-' + key);
  if (model.contractHash !== ngMdpIdentity.ngMdpContractHash(request) || (request.contractHash && request.contractHash !== model.contractHash)) throw new Error('stale-contract');
  const states = new Map();
  for (const state of model.states || []) {
    if (typeof state.id !== 'string' || !state.id || states.has(state.id)) throw new Error('duplicate-or-invalid-state');
    states.set(state.id, state);
  }
  const rootId = request.state && request.state.id;
  if (!rootId || !states.has(rootId)) throw new Error('requires-context');
  const compiled = new Map(), pending = [rootId], queued = new Set(pending), subtypeSet = new Set(['nontermination:closed-class']),probabilities=new Map();
  const coverage = { states: 0, actions: 0, branches: 0, excludedActions: 0, unknownActions: 0, zeroDurationBranches: 0 };
  const reasons = [];
  // Every row list compiles through here: action branches and threat-probe rows alike.
  const rows = list => {
    let sum = [0n, 1n]; const branches = [];
    for (const row of list) {
      if(!probabilities.has(row.probability))probabilities.set(row.probability,ngMdpProbability(row.probability));
      const p = probabilities.get(row.probability); sum = ngMdpAdd(sum, p);
      if (!!row.to === !!row.terminal || (row.terminal && !NG_MDP_OUTCOMES.includes(row.terminal))) throw new Error('invalid-destination');
      if (row.duration != null && (!Number.isFinite(row.duration) || row.duration < 0)) throw new Error('invalid-duration');
      if (!p[0]) continue;
      coverage.branches++; if (coverage.branches > limits.maxBranches) throw new Error('branch-budget');
      if (row.duration === 0) coverage.zeroDurationBranches++;
      if (row.to && !queued.has(row.to)) { queued.add(row.to); pending.push(row.to); }
      const subtype = row.terminal ? row.subtype || 'unspecified' : null;
      if (row.terminal) subtypeSet.add(row.terminal + ':' + subtype);
      branches.push({ ...row, subtype, p });
    }
    return { branches, sum };
  };
  // THREAT PROBES (adapter `threats`): each ready probe is a normalized row list like an action's;
  // its targets are compiled and solved with everything else. An unavailable probe keeps its reason.
  const probes = (Array.isArray(model.probes) ? model.probes : []).map(probe => {
    if (probe.status !== 'ready') return { techniqueId: probe.techniqueId, status: 'unavailable', reason: probe.reason || 'unavailable-threat' };
    const { branches, sum } = rows(probe.branches || []);
    if (ngMdpCmp(sum, [1n, 1n])) throw new Error('non-normalized-threat:' + probe.techniqueId);
    return { techniqueId: probe.techniqueId, status: 'ready', id: 'threat:' + probe.techniqueId, branches };
  });
  for (let i = 0; i < pending.length; i++) {
    if (pending.length > limits.maxStates) throw new Error('state-budget');
    const id = pending[i], s = states.get(id);
    if (!s || s.status === 'unavailable') { reasons.push('unknown-state:' + id); continue; }
    const actions = [], actionIds = new Set();
    for (const a of s.actions || []) {
      if (a.legal === false || (a.rulesets && !a.rulesets.includes(request.ruleset))) { coverage.excludedActions++; continue; }
      if (typeof a.id !== 'string' || !a.id || actionIds.has(a.id)) throw new Error('duplicate-or-invalid-action');
      actionIds.add(a.id); coverage.actions++;
      if (a.status === 'unavailable' || !a.branches || !a.branches.length) { coverage.unknownActions++; reasons.push(a.reason || 'unknown-action:' + a.id); continue; }
      const { branches, sum } = rows(a.branches);
      if (ngMdpCmp(sum, [1n, 1n])) throw new Error('non-normalized-row:' + a.id);
      if (a.immediateExecutionChance != null) ngMdpProbability(a.immediateExecutionChance);
      if (a.followUp != null) ngMdpProbability(a.followUp.chance);
      actions.push({ ...a, branches });
    }
    if (!actions.length) reasons.push('no-defined-actions:' + id);
    actions.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    compiled.set(id, { ...s, actions }); coverage.states++;
  }
  return { states: compiled, rootId, probes, coverage, reasons, subtypes: [...subtypeSet].sort(),stateEquivalence:model.stateEquivalence || null };
}
function ngMdpTerminal(row, subtypes) {
  const v = ngMdpZero(4 + subtypes.length); v[NG_MDP_OUTCOMES.indexOf(row.terminal)] = [1n, 1n];
  if (row.subtype) v[4 + subtypes.indexOf(row.terminal + ':' + row.subtype)] = [1n, 1n];
  return v;
}
function ngMdpBackup(action, values, subtypes) {
  const out = ngMdpZero(4 + subtypes.length);
  for (const row of action.branches) ngMdpAccumulate(out, row.p, row.to ? values.get(row.to) : ngMdpTerminal(row, subtypes));
  return out;
}
// THE CARD TOOLTIP'S DECOMPOSITION (v1.207.0, owner 2026-09-29). A card's Win chance is
// `ngMdpBackup`: the sum over the move's outcome rows of P(row) x the win value of where that row
// leaves you, under the same selected future play. Grouping those SAME rows by the adapter's own
// event label (did the move land, or miss) is an exact regrouping, not a second model:
//   Win chance = P(lands) x [win | lands] + P(misses) x [win | misses].
// A row carrying neither label makes the split null — never guessed into a group (CLAUDE.md §6.6).
const NG_MDP_LANDED_EVENTS = ['success', 'escape', 'entry'];
const NG_MDP_MISSED_EVENTS = ['same-state-miss', 'changed-state-miss', 'failed-escape'];
// An ENTRY's follow-up finish (adapter `followUp`): the chance the landed state's Finish row rolls,
// with that row's knowledge explanation. Reported beside the card; no branch or value reads it.
function ngMdpFollowUp(a) {
  const f = a.followUp;
  return f == null ? {} : { followUp: { kind: f.kind, chance: ngMdpNumber(ngMdpProbability(f.chance)), explanation: f.explanation } };
}
function ngMdpSplit(action, values, subtypes) {
  const group = () => ({ p: ngMdpRat(0), v: ngMdpZero(4 + subtypes.length) });
  const lands = group(), misses = group();
  for (const row of action.branches) {
    const events = row.events || [];
    const g = events.some(e => NG_MDP_LANDED_EVENTS.includes(e)) ? lands : events.some(e => NG_MDP_MISSED_EVENTS.includes(e)) ? misses : null;
    if (!g) return null;
    g.p = ngMdpAdd(g.p, row.p);
    ngMdpAccumulate(g.v, row.p, row.to ? values.get(row.to) : ngMdpTerminal(row, subtypes));
  }
  const win = g => g.p[0] ? ngMdpNumber(ngMdpDiv(g.v[0], g.p)) : null;
  return { lands: ngMdpNumber(lands.p), winIfLands: win(lands), winIfMisses: win(misses) };
}
function* ngMdpEvaluateComponentSteps(ids, choices, outside, subtypes, limits, check) {
  const values = new Map(), size = 4 + subtypes.length;
  const recurrent = new Set();
  for (const component of ngMdpComponents(ids, id => choices.get(id).branches.filter(b => b.to).map(b => b.to))) {
    const members = new Set(component);
    if (component.every(id => choices.get(id).branches.every(b => b.to && members.has(b.to))))
      for (const id of component) { const v = ngMdpZero(size); v[3] = [1n, 1n]; v[4 + subtypes.indexOf('nontermination:closed-class')] = [1n, 1n]; values.set(id, v); recurrent.add(id); }
  }
  const transient = ids.filter(id => !recurrent.has(id));
  if (transient.length > limits.maxLinearStates) throw new Error('linear-system-budget');
  const index = new Map(transient.map((id, i) => [id, i]));
  const matrix = transient.map((id, i) => new Map([[i, [1n, 1n]]]));
  const rhs = transient.map(() => ngMdpZero(size));
  for (const [i, id] of transient.entries()) for (const row of choices.get(id).branches) {
    if (row.to && index.has(row.to)) { const j = index.get(row.to), v = ngMdpSub(matrix[i].get(j) || ngMdpRat(0), row.p); if (v[0]) matrix[i].set(j, v); else matrix[i].delete(j); }
    else ngMdpAccumulate(rhs[i], row.p, row.to ? (values.get(row.to) || outside.get(row.to)) : ngMdpTerminal(row, subtypes));
  }
  yield* ngMdpSparseLinearSteps(matrix, rhs, limits, check);
  for (const [i, id] of transient.entries()) values.set(id, rhs[i]);
  return values;
}
function ngMdpEvaluateComponent(ids, choices, outside, subtypes, limits, check) {
  const it = ngMdpEvaluateComponentSteps(ids, choices, outside, subtypes, limits, check); let x;
  do { x = it.next(); } while (!x.done); return x.value;
}
function ngMdpExportVector(v, subtypes) {
  const out = { subtypes: {} };
  for (let i = 0; i < 4; i++) out[NG_MDP_OUTCOMES[i]] = ngMdpNumber(v[i]);
  for (let i = 0; i < subtypes.length; i++) out.subtypes[subtypes[i]] = ngMdpNumber(v[4 + i]);
  return out;
}
function ngMdpUnavailable(request, reasons, coverage, diagnostics) {
  const status = reasons.includes('requires-context') ? 'requires-context' : 'unavailable';
  const record = { stateId: request.state && request.state.id, status, reason: reasons.join('; ') };
  return { ...ngMdpIdentity.ngMdpEnvelope(request), root: record,
    actions: (request.requestedActionIds || []).map(actionId => ({ ...record, actionId })),
    quality: { numericalStatus: 'incomplete', actionCoverage: 0, coverage: coverage || {}, unresolvedReasons: reasons }, diagnostics };
}
// Maximal end components of a restricted action set. SCCs alone are insufficient:
// remove every state with no action whose ENTIRE positive support stays inside,
// then decompose/prune again. Returned components have a closed internal policy.
function ngMdpEndComponents(ids, actions) {
  // Every end component is contained in an all-action SCC. Decompose first so
  // pruning an acyclic count/age layer cannot rescan the entire layered graph.
  const pending = ngMdpComponents(ids,id=>actions.get(id).flatMap(a=>a.branches.filter(b=>b.to).map(b=>b.to))), result = [];
  while (pending.length) {
    const group = pending.pop(), members = new Set(group);
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of members) if (!actions.get(id).some(a => a.branches.every(b => b.to && members.has(b.to)))) { members.delete(id); changed = true; }
    }
    if (!members.size) continue;
    const components = ngMdpComponents([...members], id => actions.get(id).filter(a => a.branches.every(b => b.to && members.has(b.to))).flatMap(a => a.branches.map(b => b.to)));
    if (components.length === 1) result.push(components[0]); else pending.push(...components);
  }
  return result;
}
function* ngMdpPolicyValuesSteps(kernel, policy, limits, diagnostics, check) {
  const values = new Map();
  const components = ngMdpComponents([...kernel.states.keys()].sort(), id => policy.get(id).branches.filter(b => b.to).map(b => b.to));
  for (const ids of components) {
    check(); diagnostics.policyComponents = (diagnostics.policyComponents || 0) + 1;
    diagnostics.largestPolicyComponent = Math.max(diagnostics.largestPolicyComponent || 0, ids.length);
    const v = ids.length === 1 && !policy.get(ids[0]).branches.some(b => b.to === ids[0])
      ? new Map([[ids[0], ngMdpBackup(policy.get(ids[0]), values, kernel.subtypes)]])
      : yield* ngMdpEvaluateComponentSteps(ids, policy, values, kernel.subtypes, limits, check);
    for (const [id, value] of v) values.set(id, value);
    yield diagnostics;
  }
  diagnostics.policiesEvaluated++; return values;
}
/* Production route, separate from the enumeration reference.
 * 1. Exact reachability policy iteration: switch ONLY strict win improvements;
 *    retain ties, so a Bellman-equal stay never replaces a progress-making exit.
 *    The evaluated policy is a lower bound. Bellman super-solution inequalities
 *    provide the matching upper bound, including end components.
 * 2. Restrict to win-preserving actions. Any optimal policy's recurrent class
 *    must have win=0. Identify all zero-win MECs and initialize a closed policy
 *    there (loss=0), then strictly improve loss. A Bellman loss sub-solution is a
 *    valid lower bound because its boundary value is ZERO on every admissible
 *    recurrent class. Positive-win recurrent classes are not win-optimal.
 * 3. Restrict to win/loss-preserving actions and strictly reduce nontermination.
 *    For 0<=n<=1, n<=P*n+r_nontermination is a valid lower bound on eventual
 *    nontermination (on recurrent paths its limiting contribution is <=1).
 *    Evaluated policy + those inequalities certifies attainment of all objectives.
 * Every prior objective is checked after each switch. No epsilon equality,
 * discount, iteration-delta stopping, or unverified floating inverse is used.
 * Cost depends on evaluated-policy SCCs, not an exponential action product.
 */
function* ngMdpPolicyOptimizeSteps(kernel, limits, diagnostics, check) {
  const ids = [...kernel.states.keys()].sort(), actions = new Map(ids.map(id => [id, kernel.states.get(id).actions]));
  const policy = new Map(ids.map(id => [id, actions.get(id)[0]]));
  let values = yield* ngMdpPolicyValuesSteps(kernel, policy, limits, diagnostics, check);
  const optimum = [], allowed = new Map(actions);
  for (const [phase, direction] of [[0, 1], [1, -1], [3, -1]]) {
    if (phase === 1) {
      const zeroWin = ids.filter(id => !values.get(id)[0][0]);
      const mecs = ngMdpEndComponents(zeroWin, allowed); diagnostics.zeroWinEndComponents = mecs.length;
      for (const component of mecs) {
        const members = new Set(component);
        for (const id of component) policy.set(id, allowed.get(id).find(a => a.branches.every(b => b.to && members.has(b.to))));
      }
      if (mecs.length) values = yield* ngMdpPolicyValuesSteps(kernel, policy, limits, diagnostics, check);
    }
    for (let iteration = 0; ; iteration++) {
      check(); if (iteration >= limits.maxPolicyIterations) throw new Error('policy-iteration-budget');
      let changed = false;
      for (const id of ids) {
        for (const [index, previous] of optimum) if (ngMdpCmp(values.get(id)[index], previous.get(id))) throw new Error('prior-objective-not-preserved');
        let best = values.get(id)[phase], chosen = policy.get(id);
        for (const a of allowed.get(id)) {
          const q = ngMdpBackup(a, values, kernel.subtypes)[phase];
          if (ngMdpCmp(q, best) * direction > 0) { best = q; chosen = a; }
        }
        if (chosen !== policy.get(id)) { policy.set(id, chosen); changed = true; }
      }
      if (!changed) break;
      values = yield* ngMdpPolicyValuesSteps(kernel, policy, limits, diagnostics, check);
    }
    optimum.push([phase, new Map(ids.map(id => [id, values.get(id)[phase]]))]);
    for (const id of ids) allowed.set(id, allowed.get(id).filter(a => ngMdpCmp(ngMdpBackup(a, values, kernel.subtypes)[phase], values.get(id)[phase]) === 0));
    // The loss lower-bound certificate must cover ALL zero-win end components,
    // not merely the classes of the chosen policy.
    if (phase === 1) {
      const primary = new Map(ids.map(id => [id, actions.get(id).filter(a => ngMdpCmp(ngMdpBackup(a, values, kernel.subtypes)[0], values.get(id)[0]) === 0)]));
      for (const component of ngMdpEndComponents(ids.filter(id => !values.get(id)[0][0]), primary))
        for (const id of component) if (values.get(id)[1][0]) throw new Error('loss-recurrence-certificate-failed');
    }
    yield diagnostics;
  }
  diagnostics.certificate = 'exact-policy-evaluation+lexicographic-bellman+zero-win-MEC-boundaries';
  return { values, policy };
}
function* ngMdpSolveStepsRaw(model, request, options) {
  const limits = { maxStates: 20000, maxBranches: 200000, maxPolicies: 32768, maxLinearStates: 4096, maxLinearTerms: 250000,
    maxMilliseconds: 30000, maxRationalBits: 16384, maxPolicyIterations: 2048, algorithm: 'auto', ...(options || {}) };
  const started = Date.now(), diagnostics = { algorithm: limits.algorithm === 'policy-iteration' ? 'rational-lexicographic-policy-iteration' : 'rational-scc-policy-enumeration', components: 0, policiesEvaluated: 0, largestComponent: 0 };
  let kernel;
  const check = () => {
    if (limits.cancelled && limits.cancelled()) throw new Error('cancelled');
    if (Date.now() - started > limits.maxMilliseconds) throw new Error('computation-budget');
  };
  try {
    ngMdpValidateLimits(limits);
    if (!['auto','policy-iteration','enumeration','certified'].includes(limits.algorithm)) throw new Error('unsupported-solver-algorithm');
    check(); kernel = ngMdpCompile(model, request, limits); diagnostics.compileMilliseconds=Date.now()-started;
    if (kernel.reasons.length) return ngMdpUnavailable(request, kernel.reasons, kernel.coverage, diagnostics);
    if (limits.algorithm === 'certified' || (limits.algorithm === 'auto' && kernel.states.size > 128)) {
      const production = typeof ngMdpCertifiedSteps === 'function' ? ngMdpCertifiedSteps
        : typeof module !== 'undefined' && module.exports ? require('./mdp-certified.src.js').ngMdpCertifiedSteps : null;
      if (!production) throw new Error('missing-certified-worker-module');
      const result = yield* production(kernel,request,limits,diagnostics,check,{
        rat:ngMdpRat,add:ngMdpAdd,sub:ngMdpSub,mul:ngMdpMul,div:ngMdpDiv,cmp:ngMdpCmp,number:ngMdpNumber,
        components:ngMdpComponents,endComponents:ngMdpEndComponents,zero:ngMdpZero,terminal:ngMdpTerminal,
        backup:ngMdpBackup,split:ngMdpSplit,followUp:ngMdpFollowUp,exportVector:ngMdpExportVector,lex:ngMdpLex,digest:ngMdpIdentity.ngMdpDigest,
        envelope:ngMdpIdentity.ngMdpEnvelope,unavailable:ngMdpUnavailable,supportHashSteps:ngMdpSupportHashSteps,policyHash:ngMdpPolicyHash
      });
      check(); diagnostics.elapsedMilliseconds = Date.now()-started; return result;
    }
    const { states, subtypes } = kernel; let values = new Map(), policy = new Map();
    if (limits.algorithm === 'policy-iteration' || limits.algorithm === 'auto') {
      diagnostics.algorithm = 'rational-lexicographic-policy-iteration';
      ({ values, policy } = yield* ngMdpPolicyOptimizeSteps(kernel, limits, diagnostics, check));
    } else {
    const components = ngMdpComponents([...states.keys()].sort(), id => states.get(id).actions.flatMap(a => a.branches.filter(b => b.to).map(b => b.to)));
    for (const ids of components) {
      check(); diagnostics.components++; diagnostics.largestComponent = Math.max(diagnostics.largestComponent, ids.length);
      const cyclic = ids.length > 1 || states.get(ids[0]).actions.some(a => a.branches.some(b => b.to === ids[0]));
      if (!cyclic) {
        const id = ids[0]; let best, action;
        for (const a of states.get(id).actions) { const v = ngMdpBackup(a, values, subtypes); if (!best || ngMdpLex(v, best) > 0) { best = v; action = a; } }
        values.set(id, best); policy.set(id, action);
      } else {
        let count = 1; for (const id of ids) count *= states.get(id).actions.length;
        if (count > limits.maxPolicies) throw new Error('policy-enumeration-budget');
        const indices = ids.map(() => 0), maxima = new Map(); let bestValues, bestChoices;
        for (let iteration = 0; iteration < count; iteration++) {
          check(); const choices = new Map(ids.map((id, i) => [id, states.get(id).actions[indices[i]]]));
          const candidate = ngMdpEvaluateComponent(ids, choices, values, subtypes, limits, check);
          diagnostics.policiesEvaluated++;
          let better = !bestValues;
          if (bestValues) for (const id of ids) { const c = ngMdpLex(candidate.get(id), bestValues.get(id)); if (c) { better = c > 0; break; } }
          for (const id of ids) if (!maxima.has(id) || ngMdpLex(candidate.get(id), maxima.get(id)) > 0) maxima.set(id, candidate.get(id));
          if (better) { bestValues = candidate; bestChoices = choices; }
          for (let i = indices.length - 1; i >= 0; i--) { if (++indices[i] < states.get(ids[i]).actions.length) break; indices[i] = 0; }
          yield diagnostics;
        }
        for (const id of ids) {
          if (ngMdpLex(bestValues.get(id), maxima.get(id))) throw new Error('no-common-optimal-policy');
          values.set(id, bestValues.get(id)); policy.set(id, bestChoices.get(id));
        }
      }
      for (const id of ids) for (const p of values.get(id)) if (p[0].toString(2).length + p[1].toString(2).length > limits.maxRationalBits) throw new Error('rational-size-budget');
      yield diagnostics;
    }
    }
    const supportHash = yield* ngMdpSupportHashSteps(states,check);
    const policyEntries = [...policy].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([stateId, a]) => [stateId, a.id]);
    const policyId = ngMdpPolicyHash(states,policy,supportHash);
    const record = (stateId, v) => ({ stateId, status: 'ready', outcomes: ngMdpExportVector(v, subtypes), policyId });
    const allActions = states.get(kernel.rootId).actions.map(a => ({ ...record(kernel.rootId, ngMdpBackup(a, values, subtypes)), actionId: a.id,
      split: ngMdpSplit(a, values, subtypes),
      ...(a.immediateExecutionChance == null ? {} : { immediateExecutionChance: ngMdpNumber(ngMdpProbability(a.immediateExecutionChance)), immediateExecutionKind: a.immediateExecutionKind || 'execution' }), ...ngMdpFollowUp(a) }));
    const exactQ = new Map(states.get(kernel.rootId).actions.map(a => [a.id, ngMdpBackup(a, values, subtypes)]));
    // Threat cards: YOUR outcome vector if the opponent tries that move now — the same backup over
    // the probe's rows, under the same selected future play (adapter `threats`).
    const threats = (kernel.probes || []).map(pr => pr.status === 'ready'
      ? { ...record(kernel.rootId, ngMdpBackup(pr, values, subtypes)), techniqueId: pr.techniqueId }
      : { stateId: kernel.rootId, techniqueId: pr.techniqueId, status: 'unavailable', reason: pr.reason });
    const ranking = allActions.map(a => a.actionId).sort((a, b) => -ngMdpLex(exactQ.get(a), exactQ.get(b)) || (a < b ? -1 : a > b ? 1 : 0));
    for (const a of allActions) { a.rank = ranking.indexOf(a.actionId) + 1; a.selected = policy.get(kernel.rootId).id === a.actionId; }
    const lookup = new Map(allActions.map(a => [a.actionId, a]));
    const actions = (request.requestedActionIds || allActions.map(a => a.actionId)).map(actionId => lookup.get(actionId) || { stateId: kernel.rootId, actionId, status: 'unavailable', reason: 'unknown-or-illegal-action' });
    const result = { ...ngMdpIdentity.ngMdpEnvelope(request), root: { ...record(kernel.rootId, values.get(kernel.rootId)), selectedActionId: policy.get(kernel.rootId).id }, actions, ranking,
      ...(threats.length ? { threats } : {}),
      policy: policyEntries, ...(limits.includeStateValues ? { states: [...values].map(([id, v]) => ({ ...record(id, v), selectedActionId: policy.get(id).id })) } : {}),
      ...(limits.includeActionValues ? { actionValues: [...states].flatMap(([id, s]) => s.actions.map(a => ({ ...record(id, ngMdpBackup(a, values, subtypes)), actionId: a.id }))) } : {}),
      quality: { numericalStatus: 'exact-rational', maxWinError: 4 * Number.EPSILON, coordinateErrorBound: 4 * Number.EPSILON, policyRegretBound: 0,
        supportHash,
        actionCoverage: kernel.coverage.actions, coverage: kernel.coverage, stateEquivalence:kernel.stateEquivalence, unresolvedReasons: [],
        certification: 'Exact for supplied rational kernel; public Number conversion only. Not empirical calibration.' }, diagnostics };
    check(); diagnostics.elapsedMilliseconds = Date.now() - started; return result;
  } catch (error) {
    diagnostics.elapsedMilliseconds = Date.now() - started;
    return ngMdpUnavailable(request, [error.message], kernel && kernel.coverage, diagnostics);
  }
}
// Arithmetic limits apply to parsing, every candidate and every intermediate,
// including policy iteration. Scope them to a single synchronous next() call:
// concurrent async solver generators cannot leak their budgets into each other.
function ngMdpSolveSteps(model, request, options) {
  const it = ngMdpSolveStepsRaw(model, request, options);
  const bits = options && options.maxRationalBits == null ? NG_MDP_RATIONAL_BITS : options && options.maxRationalBits;
  return { next() {
    const previous = NG_MDP_ACTIVE_RATIONAL_BITS;
    NG_MDP_ACTIVE_RATIONAL_BITS = bits == null || !Number.isFinite(bits) || bits <= 0 ? NG_MDP_RATIONAL_BITS : Math.min(NG_MDP_RATIONAL_BITS, bits);
    try { return it.next(); } finally { NG_MDP_ACTIVE_RATIONAL_BITS = previous; }
  } };
}
function ngMdpValidateLimits(limits) {
  for (const key of Object.keys(limits)) if (key.startsWith('max') && (typeof limits[key] !== 'number' || !Number.isFinite(limits[key]) || limits[key] <= 0 || !Number.isSafeInteger(limits[key]))) throw new Error('invalid-budget:' + key);
}
function ngMdpSolve(model, request, options) { const it = ngMdpSolveSteps(model, request, options); let x; do { x = it.next(); } while (!x.done); return x.value; }
function ngMdpSolveReference(model, request, options) { return ngMdpSolve(model, request, { ...options, algorithm: 'enumeration' }); }
async function ngMdpSolveAsync(model, request, options) {
  const it = ngMdpSolveSteps(model, request, options); let x, checkpoint = Date.now();
  do { x = it.next(); if (!x.done && Date.now() - checkpoint >= 8) { await new Promise(resolve => setTimeout(resolve, 0)); checkpoint = Date.now(); } } while (!x.done);
  return x.value;
}
function ngMdpEvaluatePolicy(model, request, suppliedPolicy, options) {
  const limits = { maxStates: 20000, maxBranches: 200000, maxLinearStates: 4096, maxLinearTerms: 250000, maxMilliseconds: 30000, ...options };
  const started = Date.now(), diagnostics = { algorithm: 'fixed-policy-rational-scc', policiesEvaluated: 0 };
  const check = () => { if (Date.now() - started > limits.maxMilliseconds) throw new Error('computation-budget'); if (limits.cancelled && limits.cancelled()) throw new Error('cancelled'); };
  const previousBits = NG_MDP_ACTIVE_RATIONAL_BITS;
  NG_MDP_ACTIVE_RATIONAL_BITS = Math.min(NG_MDP_RATIONAL_BITS, limits.maxRationalBits || NG_MDP_RATIONAL_BITS);
  try {
    ngMdpValidateLimits(limits);
    const kernel = ngMdpCompile(model, request, limits);
    if (kernel.reasons.length) return ngMdpUnavailable(request, kernel.reasons, kernel.coverage, diagnostics);
    const entries = Array.isArray(suppliedPolicy) ? suppliedPolicy : Object.entries(suppliedPolicy);
    const input = new Map(entries), policy = new Map();
    for (const [id, s] of kernel.states) {
      const item = input.get(id), choices = typeof item === 'string' ? [{ actionId: item, probability: 1 }] : item;
      if (!Array.isArray(choices) || !choices.length) throw new Error('missing-policy-state:' + id);
      let total = ngMdpRat(0); const branches = [];
      for (const choice of choices) {
        const p = ngMdpProbability(choice.probability), action = s.actions.find(a => a.id === choice.actionId);
        if (!action) throw new Error('illegal-policy-action'); total = ngMdpAdd(total, p);
        for (const row of action.branches) { const mass = ngMdpMul(p, row.p); if (mass[0]) branches.push({ ...row, p: mass }); }
      }
      if (ngMdpCmp(total, ngMdpRat(1))) throw new Error('non-normalized-policy');
      policy.set(id, { id: 'fixed-policy', branches });
    }
    const it = ngMdpPolicyValuesSteps(kernel, policy, limits, diagnostics, check); let step;
    do { step = it.next(); } while (!step.done); const values = step.value;
    const policyId = 'policy:' + ngMdpIdentity.ngMdpDigest(entries.slice().sort((a,b) => a[0] < b[0] ? -1 : 1));
    const record = (id, v) => ({ stateId: id, status: 'ready', policyId, outcomes: ngMdpExportVector(v, kernel.subtypes) });
    const actions = kernel.states.get(kernel.rootId).actions.map(a => ({ ...record(kernel.rootId, ngMdpBackup(a, values, kernel.subtypes)), actionId: a.id }));
    return { ...ngMdpIdentity.ngMdpEnvelope(request), root: record(kernel.rootId, values.get(kernel.rootId)), actions,
      states: [...values].map(([id,v]) => record(id,v)), policyId,
      quality: { numericalStatus: 'exact-rational', maxWinError: 4 * Number.EPSILON, coordinateErrorBound: 4 * Number.EPSILON, policySemantics: 'fixed', actionCoverage: kernel.coverage.actions, coverage: kernel.coverage, stateEquivalence:kernel.stateEquivalence, unresolvedReasons: [] }, diagnostics };
  } catch (error) { return ngMdpUnavailable(request, [error.message], null, diagnostics); }
  finally { NG_MDP_ACTIVE_RATIONAL_BITS = previousBits; }
}

if (typeof module !== 'undefined' && module.exports) module.exports = {
  NG_MDP_API_VERSION: ngMdpIdentity.NG_MDP_API_VERSION, NG_MDP_OBJECTIVE: ngMdpIdentity.NG_MDP_OBJECTIVE, ngMdpStable: ngMdpIdentity.ngMdpStable, ngMdpDigest: ngMdpIdentity.ngMdpDigest, ngMdpContractHash: ngMdpIdentity.ngMdpContractHash, ngMdpActionId: ngMdpIdentity.ngMdpActionId, ngMdpStateId: ngMdpIdentity.ngMdpStateId,
  ngMdpDefenseId:ngMdpIdentity.ngMdpDefenseId,ngMdpNormalizeRootSnapshot:ngMdpIdentity.ngMdpNormalizeRootSnapshot,
  ngMdpEnvelope: ngMdpIdentity.ngMdpEnvelope, ngMdpSolve, ngMdpSolveReference, ngMdpSolveAsync, ngMdpSolveSteps, ngMdpEvaluatePolicy, ngMdpCompile, ngMdpRat, ngMdpAdd, ngMdpSub, ngMdpMul,
  ngMdpDiv, ngMdpFraction, ngMdpNumber, ngMdpComponents, ngMdpBackup, ngMdpEvaluateComponent, ngMdpEndComponents
};
