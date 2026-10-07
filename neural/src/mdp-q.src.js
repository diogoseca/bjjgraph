/* Matched sampled comparator, PRIMARY max-win only. It samples the very same
 * compiled conditional kernel and never consumes exact values during training.
 * gamma=1 is permitted ONLY after an independent full-support DAG/rank check.
 * Eventual cycles/zero-cost cycles are explicitly unsupported for this ordinary
 * Q-learning comparator, not truncated into a different task. Balanced generative
 * access to every legal pair is declared; this is not a trajectory/on-policy run.
 * Finite samples do not establish convergence, calibration or athlete improvement.
 */
function ngMdpSeedWords(seed) {
  let x = seed >>> 0;
  return () => { x = (x + 0x6d2b79f5) | 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return (t ^ (t >>> 14)) >>> 0; };
}
function ngMdpSamplingTable(action, options, check = () => {}) {
  const maxBits=options&&options.maxRationalBits!=null?options.maxRationalBits:NG_MDP_RATIONAL_BITS;
  if(!Number.isSafeInteger(maxBits)||maxBits<=0||maxBits>NG_MDP_RATIONAL_BITS)throw new Error('invalid-sampling-bit-budget');
  let denominator = 1n;
  for (const row of action.branches) {
    check();const reduced=denominator/ngMdpGcd(denominator,row.p[1]);
    if(reduced.toString(2).length+row.p[1].toString(2).length>maxBits)throw new Error('sampling-denominator-budget');
    denominator=reduced*row.p[1];
  }
  const cumulative = []; let sum = 0n;
  for (const row of action.branches) { check();sum += row.p[0] * (denominator / row.p[1]); cumulative.push(sum); }
  if (sum !== denominator) throw new Error('non-normalized-sampling-table');
  return { action, denominator, bits: denominator.toString(2).length, cumulative };
}
function ngMdpSampleIndex(table, word, check = () => {}) {
  // Integer rejection is exact GIVEN independent uniform words, avoiding the
  // additional binary64 cumulative grid. The seeded finite-state PRNG is a
  // reproducible comparator, not a proof every arbitrarily tiny event is sampled.
  let draw;
  do {
    check();
    draw = 0n; for (let bits = 0; bits < table.bits; bits += 32) draw = (draw << 32n) | BigInt(word());
    draw &= (1n << BigInt(table.bits)) - 1n;
  } while (draw >= table.denominator);
  return table.cumulative.findIndex(end => draw < end);
}
function ngMdpTrainQ(model, request, options) {
  const opts = { seed: 7, samplesPerPair: 512, maxStates: 4096, maxBranches: 60000, maxMilliseconds: 30000,maxRationalBits:NG_MDP_RATIONAL_BITS, ...options };
  const started = Date.now(),previousBits=NG_MDP_ACTIVE_RATIONAL_BITS;
  const check=()=>{if(Date.now()-started>opts.maxMilliseconds)throw new Error('q-computation-budget');if(opts.cancelled&&opts.cancelled())throw new Error('cancelled');};
  try {
    ngMdpValidateLimits(opts);
    NG_MDP_ACTIVE_RATIONAL_BITS=Math.min(NG_MDP_RATIONAL_BITS,opts.maxRationalBits);
    if(!Number.isSafeInteger(opts.seed)||opts.seed<0||opts.seed>4294967295)throw new Error('invalid-q-seed');
    check();
    const kernel = ngMdpCompile(model, request, opts);
    if (kernel.reasons.length) throw new Error(kernel.reasons.join('; '));
    const components = ngMdpComponents([...kernel.states.keys()].sort(), id => kernel.states.get(id).actions.flatMap(a => a.branches.filter(b => b.to).map(b => b.to)));
    if (components.some(c => c.length > 1 || kernel.states.get(c[0]).actions.some(a => a.branches.some(b => b.to === c[0])))) throw new Error('q-requires-proved-finite-rank');
    if (!Number.isSafeInteger(opts.samplesPerPair) || opts.samplesPerPair <= 0) throw new Error('invalid-sampling-budget');
    const ids = components.map(c => c[0]), q = new Map(ids.map(id => [id, new Map(kernel.states.get(id).actions.map(a => [a.id, 0]))]));
    const pairs = ids.flatMap(stateId => kernel.states.get(stateId).actions.map(a => ({ stateId, action: a, table: ngMdpSamplingTable(a,opts,check), counts: a.branches.map(() => 0) })));
    const word = ngMdpSeedWords(opts.seed); let updates = 0;
    for (let sample = 1; sample <= opts.samplesPerPair; sample++) {
      check();
      for (const pair of pairs) {
        check();const i = ngMdpSampleIndex(pair.table, word,check), branch = pair.action.branches[i]; pair.counts[i]++;
        const target = branch.to ? Math.max(...q.get(branch.to).values()) : branch.terminal === 'win' ? 1 : 0;
        const old = q.get(pair.stateId).get(pair.action.id);
        q.get(pair.stateId).set(pair.action.id, old + (target - old) / sample); updates++;
      }
    }
    const policy = ids.map(id => [id, [...q.get(id)].sort((a,b) => b[1]-a[1] || (a[0]<b[0]?-1:1))[0][0]]);
    return { ...ngMdpEnvelope(request), status: 'ready', method: 'tabular-Q-primary-only', sampling: 'balanced-generative-rational-rejection', seed: opts.seed,
      gamma: 1, reward: 'terminal-win-indicator', policy, q: pairs.map(p => ({ stateId: p.stateId, actionId: p.action.id, win: q.get(p.stateId).get(p.action.id), visits: opts.samplesPerPair, outcomeVisits: p.counts })),
      coverage: { states: ids.length, pairs: pairs.length, positiveBranches: pairs.reduce((n,p)=>n+p.counts.length,0), unseenPositiveBranches: pairs.reduce((n,p)=>n+p.counts.filter(c=>!c).length,0) },
      diagnostics: { updates, elapsedMilliseconds: Date.now() - started, convergenceClaim: false } };
  } catch (error) { return { ...ngMdpEnvelope(request), status: 'unavailable', reason: error.message, diagnostics: { elapsedMilliseconds: Date.now() - started } }; }
  finally{NG_MDP_ACTIVE_RATIONAL_BITS=previousBits;}
}
function ngMdpCompareQ(model, request, options) {
  const opts = options || {}, seeds = opts.seeds || [7, 23, 101];
  // Deliberately train ALL predeclared seeds before consulting the reference.
  const trained = seeds.map(seed => ngMdpTrainQ(model, request, { ...opts, seed }));
  if(!trained.some(run=>run.status==='ready'))return {status:'unavailable',reason:[...new Set(trained.map(run=>run.reason||'q-training-unavailable'))].join('; ')||'no-declared-seeds',seeds,trained};
  // Training admitted only a fully proved DAG. The independent exact reference
  // therefore uses one backward backup per state, even above the production
  // auto-route threshold. Never require "ready" from a bounded certificate.
  const reference = ngMdpSolveReference(model, request, { ...opts, includeStateValues: true, includeActionValues: true });
  if (reference.root.status !== 'ready') return { status: 'unavailable', reason: reference.root.reason||'q-exact-reference-unavailable', seeds, trained };
  const exact = new Map(reference.actionValues.map(a => [ngMdpStable([a.stateId,a.actionId]),a.outcomes.win]));
  const stateValues = new Map(reference.states.map(s=>[s.stateId,s.outcomes.win]));
  const runs = trained.map(run => {
    if (run.status !== 'ready') return run;
    const evaluation = ngMdpEvaluatePolicy(model, request, run.policy, opts);
    if (evaluation.root.status !== 'ready') return { ...run, status: 'unavailable', reason: evaluation.root.reason };
    const errors = run.q.map(q=>q.win-exact.get(ngMdpStable([q.stateId,q.actionId])));
    return { ...run, evaluation, metrics: { maxActionError: Math.max(...errors.map(Math.abs)), rmse: Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length),
      rootRegret: reference.root.outcomes.win-evaluation.root.outcomes.win,
      maxStatePolicyRegret: Math.max(...evaluation.states.map(s=>stateValues.get(s.stateId)-s.outcomes.win)) } };
  });
  return { status: runs.every(r=>r.status==='ready')?'ready':'partial', seeds, reference, runs, exportRule: 'all-predeclared-seeds-no-best-seed-selection' };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { ngMdpTrainQ, ngMdpCompareQ, ngMdpSeedWords, ngMdpSamplingTable, ngMdpSampleIndex };
