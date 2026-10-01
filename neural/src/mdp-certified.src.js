/* Worker-only production candidate/certificate route. See
 * /tmp/bjj-mdp-certified-algorithm.md for the proof obligations. Floating linear
 * solves propose values; exact rational inequalities certify every published
 * enclosure. This route claims bounded primary regret, not exact lexicographic
 * tie membership. The separate rational reference makes exact claims.
 */
function* ngMdpCertifiedSteps(kernel, request, limits, diagnostics, check, math) {
  const stageStart=Date.now();diagnostics.stage='quotient';
  const { rat, add, sub, mul, div, cmp, number, components, endComponents, zero,
    terminal, backup, split, followUp, exportVector, lex, digest, envelope, supportHashSteps, policyHash } = math;
  const ids = [...kernel.states.keys()].sort(), size = 4 + kernel.subtypes.length;
  const intervalWitness = limits.certificateArithmetic === 'interval' || (limits.certificateArithmetic == null && ids.length > 128);
  const all = new Map(ids.map(id => [id, kernel.states.get(id).actions]));
  const membersByGroup = new Map(), groupOf = new Map();
  const mecs = endComponents(ids, all);
  for (const members of mecs) {
    let group = '@mec:' + digest(members);
    while (all.has(group) || membersByGroup.has(group)) group += ':';
    membersByGroup.set(group, new Set(members));
    for (const id of members) groupOf.set(id, group);
  }
  for (const id of ids) if (!groupOf.has(id)) groupOf.set(id, id);
  const reduced = new Map(), origins = new Map();let nextActionId=0;
  const mapped = row => row.to ? { ...row, to: groupOf.get(row.to) } : { ...row };
  for (const id of ids) {
    const group = groupOf.get(id);
    if (!reduced.has(group)) reduced.set(group, { id: group, actions: [] });
    for (const action of all.get(id)) {
      const collapsed=membersByGroup.has(group);
      const external = collapsed ? action.branches.filter(b => !b.to || groupOf.get(b.to) !== group) : action.branches;
      if (!external.length) continue;
      const exitMass = collapsed ? external.reduce((p, b) => add(p, b.p), rat(0)) : null;
      // Quotient action IDs are private sequential identities. Public IDs stay
      // untouched in origins/lift; repeating their large strings here adds no law.
      const a = { id: 'qa:'+(nextActionId++), branches: external.map(b => ({ ...mapped(b), p: collapsed ? div(b.p, exitMass) : b.p })) };
      reduced.get(group).actions.push(a); origins.set(a.id, { id, action });
    }
  }
  for (const [group] of membersByGroup) reduced.get(group).actions.push({ id: 'qa:'+(nextActionId++), stay: true,
    branches: [{ p: rat(1), terminal: 'nontermination', subtype: 'closed-class' }] });
  const qids = [...reduced.keys()].sort(), qa = new Map(qids.map(id => [id, reduced.get(id).actions]));
  // A quotient closed class would invalidate the proper-policy certificate.
  if (endComponents(qids, qa).length) throw new Error('quotient-recurrence-proof-failed');
  diagnostics.algorithm = 'MEC-quotient-sparse-candidates+rational-certificates';
  diagnostics.quotientStates = qids.length; diagnostics.collapsedEndComponents = mecs.length;
  const terminalVectors=new Map();
  for (const s of reduced.values()) for (const a of s.actions) for (const b of a.branches) {
    b.f = number(b.p); if (b.terminal) {
      const key=JSON.stringify([b.terminal,b.subtype]);
      if(!terminalVectors.has(key))terminalVectors.set(key,terminal(b,kernel.subtypes).map(number));
      b.vector=terminalVectors.get(key);
    }
  }
  const view = new DataView(new ArrayBuffer(8));
  function floatRat(x) {
    if (!Number.isFinite(x)) throw new Error('nonfinite-numerical-candidate');
    if (!x) return rat(0);
    view.setFloat64(0, x); const high = view.getUint32(0), low = view.getUint32(4);
    const exp = (high >>> 20) & 2047;
    let numerator = (BigInt(high & 1048575) << 32n) + BigInt(low);
    if (exp) numerator += 1n << 52n;
    if (high >>> 31) numerator = -numerator;
    const power = exp ? exp - 1023 - 52 : -1074;
    return rat(power >= 0 ? [numerator << BigInt(power), 1n] : [numerator, 1n << BigInt(-power)]);
  }
  function nextNumber(x, up) {
    if (!Number.isFinite(x)) return x;
    if (!x) return up ? Number.MIN_VALUE : -Number.MIN_VALUE;
    view.setFloat64(0, x); let bits = view.getBigUint64(0);
    bits += (x > 0) === up ? 1n : -1n; view.setBigUint64(0, bits); return view.getFloat64(0);
  }
  function bound(x, up) {
    if (cmp(x, rat(0)) <= 0) return 0;
    if (cmp(x, rat(1)) >= 0) return 1;
    const v = number(x), c = cmp(floatRat(v), x);
    return (up ? c < 0 : c > 0) ? nextNumber(v, up) : v;
  }
  const abs = x => x[0] < 0n ? [-x[0], x[1]] : x;
  const max = (a,b) => cmp(a,b) >= 0 ? a : b;
  const min = (a,b) => cmp(a,b) <= 0 ? a : b;
  const upward=x=>{if(!Number.isFinite(x))throw new Error('interval-overflow');return nextNumber(x,true);};
  const downward=x=>{if(!Number.isFinite(x))throw new Error('interval-overflow');return nextNumber(x,false);};
  if(intervalWitness)for(const s of reduced.values())for(const a of s.actions)for(const b of a.branches){b.lower=bound(b.p,false);b.upper=bound(b.p,true);}
  // Each binary64 product and sum is rounded OUTWARD, even when the operation
  // happened to be exact. Input rational probabilities are already enclosed.
  // No numerical residual/tolerance is accepted without the positive drift.
  function rangeBackup(action,vector,c,cost){
    let lo=0,hi=0;
    for(const b of action.branches){
      const v=b.to?vector.get(b.to)[c]:cost?0:b.vector[c];if(v===0)continue;
      if(!(v>=0)||!Number.isFinite(v))throw new Error('invalid-interval-candidate');
      lo=downward(lo+Math.max(0,downward(b.lower*v)));hi=upward(hi+upward(b.upper*v));
    }
    return [Math.max(0,lo),hi];
  }
  function numericBackup(a, values, cost) {
    const out = Array(cost ? 1 : size).fill(cost ? 1 : 0);
    for (const b of a.branches) {
      const v = b.to ? values.get(b.to) : cost ? [0] : b.vector;
      for (let c = 0; c < out.length; c++) out[c] += b.f * v[c];
    }
    return out;
  }
  function* linear(rows, rhs) {
    let terms = rows.reduce((n,r) => n + r.size, 0);
    if (terms > limits.maxLinearTerms) throw new Error('linear-fill-budget');
    for (let k = 0; k < rows.length; k++) {
      check(); let pivot = -1;
      for (let i = k; i < rows.length; i++) if (rows[i].get(k) && (pivot < 0 || Math.abs(rows[i].get(k)) > Math.abs(rows[pivot].get(k)))) pivot = i;
      if (pivot < 0) throw new Error('numerical-singular-candidate');
      [rows[k],rows[pivot]] = [rows[pivot],rows[k]]; [rhs[k],rhs[pivot]] = [rhs[pivot],rhs[k]];
      const p = rows[k].get(k);
      for (const [j,v] of rows[k]) rows[k].set(j,v/p);
      for (let c = 0; c < rhs[k].length; c++) rhs[k][c] /= p;
      for (let i = k+1; i < rows.length; i++) {
        const q = rows[i].get(k); if (!q) continue; rows[i].delete(k); terms--;
        for (const [j,v] of rows[k]) if (j !== k) {
          const old = rows[i].get(j), updated = (old || 0) - q*v;
          if (!updated) { if (old) { rows[i].delete(j); terms--; } }
          else { if (!old) terms++; rows[i].set(j,updated); }
        }
        if (terms > limits.maxLinearTerms) throw new Error('linear-fill-budget');
        for (let c = 0; c < rhs[i].length; c++) rhs[i][c] -= q*rhs[k][c];
      }
      yield;
    }
    for (let i = rows.length-1; i >= 0; i--) {
      for (const [j,p] of rows[i]) if (j > i) for (let c = 0; c < rhs[i].length; c++) rhs[i][c] -= p*rhs[j][c];
      if (rhs[i].some(x => !Number.isFinite(x))) throw new Error('nonfinite-numerical-candidate');
      yield;
    }
    return rhs;
  }
  function* evaluate(policy, cost, region, values) {
    for (const part of components(region, id => policy.get(id).branches.filter(b => b.to).map(b => b.to))) {
      check(); diagnostics.policyComponents = (diagnostics.policyComponents || 0) + 1;
      diagnostics.largestPolicyComponent = Math.max(diagnostics.largestPolicyComponent || 0, part.length);
      if (part.length === 1 && !policy.get(part[0]).branches.some(b => b.to === part[0])) {
        values.set(part[0], numericBackup(policy.get(part[0]), values, cost)); continue;
      }
      if (part.length > limits.maxLinearStates) throw new Error('linear-system-budget');
      const index = new Map(part.map((id,i) => [id,i]));
      const rows = part.map((_,i) => new Map([[i,rat(1)]]));
      const rhs = part.map(() => Array(cost ? 1 : size).fill(cost ? 1 : 0));
      for (const [i,id] of part.entries()) for (const b of policy.get(id).branches) {
        if (b.to && index.has(b.to)) { const j = index.get(b.to); rows[i].set(j,sub(rows[i].get(j) || rat(0),b.p)); }
        else {
          const v = b.to ? values.get(b.to) : cost ? [0] : b.vector;
          for (let c = 0; c < rhs[i].length; c++) rhs[i][c] += b.f*v[c];
        }
      }
      // Convert exact matrix coefficients once: 1-(1-epsilon) must not first
      // round to zero for a near-absorbing self-loop.
      const matrix = rows.map(r => new Map([...r].filter(([,v]) => v[0]).map(([j,v]) => [j,number(v)])));
      yield* linear(matrix,rhs);
      for (const [i,id] of part.entries()) values.set(id,rhs[i]);
    }
    diagnostics.policiesEvaluated++; return values;
  }
  const policy = new Map(qids.map(id => [id,qa.get(id)[0]]));
  const values = new Map(),time = new Map(),durationPolicy = new Map(policy);
  const allowed = new Map(qa);
  const regions = components(qids,id=>qa.get(id).flatMap(a=>a.branches.filter(b=>b.to).map(b=>b.to)));
  diagnostics.quotientMilliseconds=Date.now()-stageStart;diagnostics.stage='numerical-candidates';
  diagnostics.components = regions.length; diagnostics.largestComponent = Math.max(...regions.map(r=>r.length));
  // Solve the all-action SCC DAG once from sinks. The many count/age layers are
  // acyclic; repeating global policy evaluation over them is unnecessary work.
  // Floating comparisons remain heuristics; the GLOBAL rational witness below
  // accounts for every downstream error and every action across SCC boundaries.
  for (const region of regions) {
    check(); const id = region[0];
    if (region.length===1 && !qa.get(id).some(a=>a.branches.some(b=>b.to===id))) {
      let chosen=qa.get(id)[0],best=numericBackup(chosen,values,false),longest=-Infinity;
      for (const a of qa.get(id)) {
        const v=numericBackup(a,values,false);let better=false;
        for(const [c,d] of [[0,1],[1,-1],[3,-1]])if(Math.abs(v[c]-best[c])>1e-12){better=(v[c]-best[c])*d>0;break;}
        if(better){chosen=a;best=v;}
        const cost=numericBackup(a,time,true)[0];if(cost>longest){longest=cost;durationPolicy.set(id,a);}
      }
      policy.set(id,chosen);values.set(id,best);time.set(id,[longest]);yield;continue;
    }
    yield* evaluate(policy,false,region,values);
    // Heuristic search only. Near-equality here is NEVER exported as exact tie.
    for (const [coordinate,direction] of [[0,1],[1,-1],[3,-1]]) {
      const visited = new Set();
      for (let iteration = 0; iteration < limits.maxPolicyIterations; iteration++) {
        check(); const signature = region.map(id => policy.get(id).id).join('\n');
        if (visited.has(signature)) { diagnostics.numericalPolicyCycle = true; break; } visited.add(signature);
        let changed = false;
        for (const id of region) {
          let best = values.get(id)[coordinate], chosen = policy.get(id);
          for (const a of allowed.get(id)) {
            const q = numericBackup(a,values,false)[coordinate];
            if ((q-best)*direction > 1e-12) { best = q; chosen = a; }
          }
          if (chosen !== policy.get(id)) { policy.set(id,chosen); changed = true; }
        }
        if (!changed) break;
        yield* evaluate(policy,false,region,values);
      }
      for (const id of region) allowed.set(id,allowed.get(id).filter(a => a === policy.get(id) || Math.abs(numericBackup(a,values,false)[coordinate]-values.get(id)[coordinate]) <= 1e-12));
      yield;
    }
    // Independent max-cost search proposes a witness valid for EVERY action.
    yield* evaluate(durationPolicy,true,region,time);
    for (let iteration = 0; iteration < limits.maxPolicyIterations; iteration++) {
      check(); let changed = false;
      for (const id of region) {
        let best = time.get(id)[0], chosen = durationPolicy.get(id);
        for (const a of qa.get(id)) {
          const q = numericBackup(a,time,true)[0];
          if (q-best > 1e-10*Math.max(1,Math.abs(best))) { best = q; chosen = a; }
        }
        if (chosen !== durationPolicy.get(id)) { durationPolicy.set(id,chosen); changed = true; }
      }
      if (!changed) break;
      yield* evaluate(durationPolicy,true,region,time);
    }
  }
  diagnostics.candidateMilliseconds=Date.now()-stageStart-diagnostics.quotientMilliseconds;diagnostics.stage='drift-witness';
  const t = new Map(qids.map(id => [id,floatRat(time.get(id)[0])])), x = new Map();
  let minimumDrift = null,driftLower=Infinity;
  for (const id of qids) {
    check(); if (cmp(t.get(id),rat(0)) <= 0) throw new Error('nonpositive-termination-witness');
    for (const a of qa.get(id)) {
      if(intervalWitness)driftLower=Math.min(driftLower,downward(time.get(id)[0]-rangeBackup(a,time,0,true)[1]));
      else {
        let drift = t.get(id); for (const b of a.branches) if (b.to) drift = sub(drift,mul(b.p,t.get(b.to)));
        minimumDrift = minimumDrift === null ? drift : min(minimumDrift,drift);
      }
    }
    // Normalize the DISPLAY candidate, then certify precisely that candidate.
    const v = values.get(id).slice(), total = v.slice(4).reduce((sum,p) => sum+Math.max(0,p),0);
    if (!(total > 0) || !Number.isFinite(total)) throw new Error('invalid-vector-candidate');
    v.fill(0,0,4);
    for (let j = 4; j < size; j++) {
      v[j] = Math.max(0,v[j])/total;
      const parent = ['win','loss','explicitNoResult','nontermination'].indexOf(kernel.subtypes[j-4].split(':')[0]);
      v[parent] += v[j];
    }
    for(let c=0;c<4;c++)v[c]=Math.max(0,Math.min(1,v[c]));
    values.set(id,v);x.set(id,v.map(floatRat)); yield;
  }
  if(intervalWitness)minimumDrift=floatRat(driftLower);
  if (cmp(minimumDrift,rat(0)) <= 0) throw new Error('termination-witness-not-verified');
  diagnostics.stage='residual-certificate';
  const w = new Map(qids.map(id => [id,div(t.get(id),minimumDrift)]));
  const residual = zero(size),residualUpper=Array(size).fill(0); let bellmanExcess = rat(0), maxWeight = rat(0),excessUpper=0;
  for (const id of qids) {
    check();const v=x.get(id);
    if(intervalWitness){
      for(let c=0;c<size;c++){
        const [lo,hi]=rangeBackup(policy.get(id),values,c,false),point=values.get(id)[c];
        residualUpper[c]=Math.max(residualUpper[c],upward(point-lo),upward(hi-point));
      }
      for(const a of qa.get(id))excessUpper=Math.max(excessUpper,upward(rangeBackup(a,values,0,false)[1]-values.get(id)[0]));
    }else{
      const y = backup(policy.get(id),x,kernel.subtypes);
      for (let c = 0; c < size; c++) residual[c] = max(residual[c],abs(sub(v[c],y[c])));
      for (const a of qa.get(id)) {
        let q=rat(0);for(const b of a.branches)q=add(q,mul(b.p,b.to?x.get(b.to)[0]:rat(b.terminal==='win'?1:0)));
        bellmanExcess = max(bellmanExcess,sub(q,v[0]));
      }
    }
    maxWeight = max(maxWeight,w.get(id)); yield;
  }
  if(intervalWitness){for(let c=0;c<size;c++)residual[c]=floatRat(residualUpper[c]);bellmanExcess=floatRat(excessUpper);}
  const regret = mul(add(bellmanExcess,residual[0]),maxWeight);
  const maxCoordinateError = residual.reduce((m,r) => max(m,mul(r,maxWeight)),rat(0));
  const coordinateError = add(maxCoordinateError,floatRat(4*Number.EPSILON));
  const precision = request.precision || { absoluteProbabilityError: 1e-4, policyRegret: 1e-4 };
  if (!(precision.absoluteProbabilityError > 0) || !Number.isFinite(precision.absoluteProbabilityError) || !(precision.policyRegret > 0) || !Number.isFinite(precision.policyRegret)) throw new Error('invalid-precision');
  diagnostics.witnessMinimumDrift = number(minimumDrift); diagnostics.witnessMaximumWeight = number(maxWeight);
  diagnostics.certificateMilliseconds=Date.now()-stageStart-diagnostics.quotientMilliseconds-diagnostics.candidateMilliseconds;
  diagnostics.certifiedRegret = number(regret); diagnostics.certifiedCoordinateError = number(maxCoordinateError);
  if (cmp(regret,rat(precision.policyRegret)) > 0 || cmp(coordinateError,rat(precision.absoluteProbabilityError)) > 0) throw new Error('requested-precision-not-certified');
  // Lift one stationary policy, including progress-correct navigation inside MECs.
  diagnostics.stage='policy-lift-export';const lifted = new Map(),exportStarted=Date.now();
  for (const [group,chosen] of policy) {
    check(); yield;
    const members = membersByGroup.get(group);
    if (!members) { lifted.set(group,origins.get(chosen.id).action); continue; }
    const internal = id => all.get(id).filter(a => a.branches.every(b => b.to && members.has(b.to)));
    if (chosen.stay) { for (const id of members) lifted.set(id,internal(id)[0]); continue; }
    const target = origins.get(chosen.id), distance = new Map([[target.id,0]]);
    while (distance.size < members.size) {
      check(); yield;
      let changed = false;
      for (const id of members) if (!distance.has(id)) {
        const neighbors = internal(id).flatMap(a => a.branches.filter(b => distance.has(b.to)).map(b => distance.get(b.to)));
        if (neighbors.length) { distance.set(id,1+Math.min(...neighbors)); changed = true; }
      }
      if (!changed) throw new Error('MEC-policy-lift-failed');
    }
    for (const id of members) lifted.set(id,id === target.id ? target.action : internal(id).find(a => a.branches.some(b => distance.get(b.to) < distance.get(id))));
  }
  // Normal card responses need only the root and its immediate successors. Do
  // not materialize three full state maps of repeated quotient values/bounds.
  const actual = { get:id=>x.get(groupOf.get(id)) };
  const errors = id=>residual.map(r=>mul(r,w.get(groupOf.get(id))));
  const upper = id=>add(actual.get(id)[0],mul(bellmanExcess,w.get(groupOf.get(id))));
  diagnostics.liftMilliseconds=Date.now()-exportStarted;diagnostics.stage='support-identity';
  const hashStarted=Date.now(),supportHash=yield* supportHashSteps(kernel.states,check);
  const policyId=policyHash(kernel.states,lifted,supportHash);
  diagnostics.identityMilliseconds=Date.now()-hashStarted;diagnostics.stage='record-export';
  const records = (id,v,e,optimalUpper) => {
    const bounds = {}, subtypeBounds = {};
    for (let c = 0; c < size; c++) {
      const pair = [bound(sub(v[c],e[c]),false),bound(add(v[c],e[c]),true)];
      if (c < 4) bounds[['win','loss','explicitNoResult','nontermination'][c]] = pair;
      else subtypeBounds[kernel.subtypes[c-4]] = pair;
    }
    return { stateId:id,status:'bounded',policyId,outcomes:exportVector(v,kernel.subtypes),outcomeBounds:bounds,subtypeBounds,
      winBounds:[bounds.win[0],bound(optimalUpper,true)],secondaryStatus:'unresolved-primary-ties',rankingStatus:'intervals-may-overlap' };
  };
  const actionRecord = (id,a,v=backup(a,actual,kernel.subtypes)) => {
    const e = zero(size); let u = rat(0);
    for (const b of a.branches) {
      if (b.to) { const error=errors(b.to);for (let c=0;c<size;c++) e[c]=add(e[c],mul(b.p,error[c])); u=add(u,mul(b.p,upper(b.to))); }
      else if (b.terminal==='win') u=add(u,b.p);
    }
    return { ...records(id,v,e,u),actionId:a.id,selected:lifted.get(id).id===a.id,split:split(a,actual,kernel.subtypes),
      ...(a.immediateExecutionChance == null ? {} : { immediateExecutionChance:number(rat(a.immediateExecutionChance)),immediateExecutionKind:a.immediateExecutionKind || 'execution' }),...followUp(a) };
  };
  const rootId = kernel.rootId, rootActions = kernel.states.get(rootId).actions;
  const exactQ = new Map(rootActions.map(a => [a.id,backup(a,actual,kernel.subtypes)]));
  const ranking = rootActions.map(a => a.id).sort((a,b) => -lex(exactQ.get(a),exactQ.get(b)) || (a<b?-1:a>b?1:0));
  const available = new Map(rootActions.map(a => [a.id,{...actionRecord(rootId,a,exactQ.get(a.id)),rank:ranking.indexOf(a.id)+1}]));
  const actions = (request.requestedActionIds || rootActions.map(a => a.id)).map(actionId => available.get(actionId) || {stateId:rootId,actionId,status:'unavailable',reason:'unknown-or-illegal-action'});
  // Threat cards: the same enclosure-carrying backup over each probe's rows (adapter `threats`).
  const threats = (kernel.probes || []).map(pr => {
    if (pr.status !== 'ready') return { stateId:rootId, techniqueId:pr.techniqueId, status:'unavailable', reason:pr.reason };
    const { actionId, selected, split: ignored, ...r } = actionRecord(rootId, pr);
    return { ...r, techniqueId:pr.techniqueId };
  });
  diagnostics.certificate = (intervalWitness?'outward-interval':'exact-rational')+'-all-action-drift+common-policy-residual+Bellman-supersolution';
  const extra={};
  if(limits.includePolicy || kernel.states.size<=128)extra.policy=ids.map(id=>[id,lifted.get(id).id]);
  if(limits.includeStateValues){extra.states=[];for(const id of ids){check();extra.states.push({...records(id,actual.get(id),errors(id),upper(id)),selectedActionId:lifted.get(id).id});yield;}}
  if(limits.includeActionValues){extra.actionValues=[];for(const id of ids){check();for(const a of all.get(id))extra.actionValues.push(actionRecord(id,a));yield;}}
  const result={ ...envelope(request),root:{...records(rootId,actual.get(rootId),errors(rootId),upper(rootId)),selectedActionId:lifted.get(rootId).id},actions,ranking,...extra,
    ...(threats.length ? { threats } : {}),
    quality:{numericalStatus:'certified',maxWinError:bound(add(max(regret,maxCoordinateError),floatRat(4*Number.EPSILON)),true),
      coordinateErrorBound:bound(coordinateError,true),policyRegretBound:bound(regret,true),secondaryStatus:'unresolved-primary-ties',tertiaryStatus:'unresolved-primary-loss-ties',
      supportHash,actionCoverage:kernel.coverage.actions,coverage:kernel.coverage,stateEquivalence:kernel.stateEquivalence,
      unresolvedReasons:['exact-secondary-and-tertiary-ties-not-certified'],
      certification:'Bounded primary regret and common-policy outcome enclosures for supplied rational kernel; exact secondary optimality unclaimed.'},diagnostics };
  check();diagnostics.exportMilliseconds=Date.now()-exportStarted;return result;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { ngMdpCertifiedSteps };
