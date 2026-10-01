import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),M=require('../neural/src/mdp-model.src.js'),E=require('../neural/src/mdp-exposure.src.js');
const X={deckKey:'Deck X|Top',role:'Top'},Y={deckKey:'Deck Y|Defender',role:'Defender'};
const read=(...labels)=>({kind:'execution',labels}),clone=x=>JSON.parse(JSON.stringify(x));
const support=model=>{
  const k=M.ngMdpCompile(model,model._request,{maxStates:40000,maxBranches:400000}),ids=[...k.states.keys()].sort(),index=new Map(ids.map((id,i)=>[id,i]));
  return M.ngMdpDigest(['indexed-support-v1',ids,ids.map(id=>M.ngMdpDigest(k.states.get(id).actions.map(a=>[a.id,a.branches.map(b=>[M.ngMdpFraction(b.p),b.to?index.get(b.to):null,b.terminal||null,b.subtype||null,b.duration==null?null:b.duration,b.events||[]])])))]);
};
function fixture(spec,starts=[{state:'a',probability:1}],labels=[X],solver=false){
  const snapshots=Object.fromEntries(Object.entries(spec).map(([name,s])=>[name,{nodeId:s.nodeId||name,role:s.role||'top',phase:s.phase||'user',moveCount:9,arrivalAge:0,qMod:0,combo:0,positionKey:s.positionKey||name+'|Top',panicKey:s.panicKey||null}]));
  const ids=Object.fromEntries(Object.entries(snapshots).map(([k,v])=>[k,M.ngMdpStateId(v)]));
  const startDistribution=starts.map(s=>({stateId:ids[s.state]||s.state,probability:s.probability}));
  const positive=startDistribution.filter(s=>M.ngMdpRat(s.probability)[0]),rootId=positive.length===1&&M.ngMdpFraction(M.ngMdpRat(positive[0].probability))==='1/1'?positive[0].stateId:'@exposure-distribution';
  const request={apiVersion:2,requestId:'exposure-test',revision:1,modelHash:'model',mechanicsHash:'mechanics',graphHash:'graph',profileHash:'profile',opponentPolicyHash:'opponent',ruleset:'gi',objective:M.NG_MDP_OBJECTIVE,futureStudyPolicy:'no-additional-study-events',horizon:{kind:'actual-roll',episodeCap:9,moveCount:9},state:{id:rootId,snapshot:snapshots[starts.find(s=>M.ngMdpRat(s.probability)[0]).state],aiSkill:.07,challenge:null}};
  const states=Object.entries(spec).map(([name,s])=>({id:ids[name],snapshot:clone(snapshots[name]),actions:(s.actions||[{id:'take',reads:s.reads,branches:s.branches}]).map(a=>({id:a.id,studyReads:a.reads||[],branches:a.branches.map(b=>({probability:b.p,...(b.to?{to:ids[b.to]||b.to}:{terminal:b.terminal||'win'}),...(b.subtype?{subtype:b.subtype}:{}),studyReads:b.reads||[]}))}))}));
  const native={...Object.fromEntries(['modelHash','mechanicsHash','graphHash','profileHash','opponentPolicyHash','ruleset'].map(k=>[k,request[k]])),contractHash:M.ngMdpContractHash(request),stateEquivalence:{scope:'literal-state',exposureLabelsPreserved:true},states:clone(states)};
  if(rootId==='@exposure-distribution')native.states.push({id:rootId,actions:[{id:'distribution',kind:'forced',studyReads:[],branches:positive.map(s=>({probability:s.probability,to:s.stateId,duration:0}))}]});
  native._request=request;
  const k=M.ngMdpCompile(native,request,{maxStates:40000,maxBranches:400000}),sourceRows=[...k.states].map(([id])=>[id,id===rootId&&rootId==='@exposure-distribution'?'distribution':spec[Object.keys(ids).find(name=>ids[name]===id)].policy||'take']);
  const evaluation=solver?M.ngMdpSolve(native,request,{includePolicy:true}):M.ngMdpEvaluatePolicy(native,request,sourceRows);
  assert.ok(['ready','bounded'].includes(evaluation.root.status),evaluation.root.reason);
  const nativeRows=solver?evaluation.policy:sourceRows;
  const rows=nativeRows.filter(([id])=>id!=='@exposure-distribution').map(([stateId,choices])=>({stateId,actions:typeof choices==='string'?[{actionId:choices,probability:1}]:choices}));
  const startDistributionHash=M.ngMdpDigest(startDistribution.slice().sort((a,b)=>a.stateId<b.stateId?-1:1));
  const binding={kind:solver?'native-solver':'native-fixed-policy',request,model:native,evaluation,...(!solver?{actions:sourceRows,sourceSupportHash:support(native)}:{})};
  const input={request,startDistribution,startDistributionHash,policy:{id:evaluation.root.policyId,contractHash:M.ngMdpContractHash(request),startDistributionHash,rows,binding},labels,
    model:{version:1,behaviorCompression:false,exposureLabelsPreserved:true,convention:E.NG_MDP_EXPOSURE_CONVENTION,provenance:{contractHash:M.ngMdpContractHash(request),profileHash:request.profileHash},states}};
  // Independent offline source admission is deliberately injected separately
  // from the untrusted input. Native production exercises wrapper replay below.
  const supplied=new Map(rows.map(r=>[r.stateId,r.actions])),byId=new Map(states.map(s=>[s.id,s])),queue=positive.map(s=>s.stateId),seen=new Set(queue);
  for(let i=0;i<queue.length;i++)for(const c of supplied.get(queue[i])||[])if(M.ngMdpRat(c.probability)[0])for(const b of byId.get(queue[i]).actions.find(a=>a.id===c.actionId).branches)if(b.to&&M.ngMdpRat(b.probability)[0]&&!seen.has(b.to)){seen.add(b.to);queue.push(b.to);}
  const ordered=[...seen].sort(),parts=ordered.map(id=>M.ngMdpDigest([id,supplied.get(id).filter(c=>M.ngMdpRat(c.probability)[0]).map(c=>byId.get(id).actions.find(a=>a.id===c.actionId)).map(a=>[a.id,a.studyReads,a.branches.filter(b=>M.ngMdpRat(b.probability)[0]).map(b=>b.studyReads||[])])]));
  const deps={identity:M,math:M,labelSource:{kind:'trusted-labelled-source',labelHash:M.ngMdpDigest(['chosen-calculation-labels-v1',ordered,parts]),lawHashes:{fixture:'independent-labelled-fixture-v1'}}};
  return {input,ids,deps,run:options=>E.ngMdpEvaluateExposure(input,deps,options)};
}
function ready(f,options){const r=f.run(options);assert.equal(r.status,'ready',r.reason);return r;}

test('fixed policy is bound to the native kernel and zero exposure is proved',()=>{
  const f=fixture({a:{branches:[{p:1}]}}),before=JSON.stringify(f.input),r=ready(f);
  assert.equal(r.records[0].hittingProbability.exact,'0/1');assert.equal(r.records[0].expectedVisits.exact,'0/1');
  assert.equal(r.policyEvaluation.outcomes.win.exact,'1/1');assert.equal(r.provenance.sourceSupportHash,support(f.input.policy.binding.model));
  assert.equal(r.provenance.nativeBinding.stamp.contractHash,M.ngMdpContractHash(f.input.request));
  assert.equal(E.ngMdpExposureProviderRecord(r).records[0].value,0);assert.ok(Object.isFrozen(r));assert.equal(JSON.stringify(f.input),before);assert.equal(Object.isFrozen(f.input.request.horizon),false);
});
test('geometric finite revisits have hit one and expected four without a clock truncation',()=>{
  const r=ready(fixture({a:{reads:[read(X)],branches:[{p:'3/4',to:'a'},{p:'1/4'}]}}));
  assert.equal(r.records[0].hittingProbability.exact,'1/1');assert.equal(r.records[0].expectedVisits.exact,'4/1');assert.equal(r.policyEvaluation.outcomes.win.exact,'1/1');
});
test('rewarded recurrence has finite hitting and separately infinite counts',()=>{
  const f=fixture({a:{branches:[{p:'1/4',to:'b'},{p:'3/4',terminal:'loss'}]},b:{reads:[read(X)],branches:[{p:1,to:'b'}]}}),r=ready(f);
  assert.equal(r.records[0].hittingProbability.exact,'1/4');assert.equal(r.records[0].expectedVisits.exact,'infinity');assert.equal(r.policyEvaluation.outcomes.nontermination.exact,'1/4');
  assert.equal(E.ngMdpExposureProviderRecord(r).status,'ready');assert.equal(E.ngMdpExposureProviderRecord(r,'expected-visits').records[0].reason,'infinite-exposure');
});
test('one read before an avoiding closed class stays finite; a missing label is exact zero',()=>{
  const r=ready(fixture({a:{reads:[read(X)],branches:[{p:1,to:'b'}]},b:{branches:[{p:1,to:'b'}]}},undefined,[X,Y]));
  assert.equal(r.records[0].expectedVisits.exact,'1/1');assert.equal(r.records[1].hittingProbability.exactZero,true);assert.equal(r.policyEvaluation.outcomes.nontermination.exact,'1/1');
});
test('separate branch calculations count twice, co-read labels do not multiply an event',()=>{
  const r=ready(fixture({a:{reads:[read(X,X,Y)],branches:[{p:'1/3',reads:[read(X)]},{p:'2/3'}]}},undefined,[X,Y]));
  assert.equal(r.records[0].expectedVisits.exact,'4/3');assert.equal(r.records[1].expectedVisits.exact,'1/1');assert.equal(r.records[0].hittingProbability.exact,'1/1');
});
test('exact positive-start union preserves equal-valued but differently labelled contexts',()=>{
  const f=fixture({a:{nodeId:'same',positionKey:X.deckKey,reads:[read(X)],branches:[{p:1}]},b:{nodeId:'same',positionKey:Y.deckKey,reads:[read(Y)],branches:[{p:1}]}},[{state:'a',probability:'1/2'},{state:'b',probability:'1/2'}],[X,Y]);
  const r=ready(f);assert.equal(r.records[0].hittingProbability.exact,'1/2');assert.equal(r.records[1].expectedVisits.exact,'1/2');assert.equal(r.coverage.positiveStarts,2);assert.equal(r.coverage.states,2);assert.ok(r.provenance.nativeBinding.distributionRoot);
  f.input.policy.rows.pop();assert.match(f.run().reason,/incomplete-labelled-positive-support/);
});
test('two-state transient recurrence and roles give independent analytic occupancies',()=>{
  const r=ready(fixture({a:{reads:[read(X)],branches:[{p:'1/2',to:'b'},{p:'1/2'}]},b:{role:'bottom',reads:[read(Y)],branches:[{p:'1/2',to:'a'},{p:'1/2',terminal:'loss'}]}},undefined,[X,Y]));
  assert.equal(r.records[0].expectedVisits.exact,'4/3');assert.equal(r.records[1].expectedVisits.exact,'2/3');assert.equal(r.records[1].hittingProbability.exact,'1/2');assert.equal(r.policyEvaluation.outcomes.win.exact,'2/3');
});
test('all-closed starts need no transient witness, with both rewarded and avoiding classes',()=>{
  const r=ready(fixture({a:{branches:[{p:1,to:'a'}]},b:{reads:[read(Y)],branches:[{p:1,to:'b'}]}},[{state:'a',probability:'2/3'},{state:'b',probability:'1/3'}],[X,Y]),{algorithm:'certified'});
  assert.equal(r.quality.certificate.transientStates,0);assert.equal(r.records[0].hittingProbability.value,0);assert.ok(r.records[1].hittingProbability.bounds[0]<=1/3&&r.records[1].hittingProbability.bounds[1]>=1/3);assert.equal(r.records[1].expectedVisits.reason,'infinite-exposure');
});
test('randomized policy reads only the chosen calculation',()=>{
  const f=fixture({a:{actions:[{id:'one',reads:[read(X)],branches:[{p:1}]},{id:'two',reads:[read(Y)],branches:[{p:1,terminal:'loss'}]}],policy:[{actionId:'one',probability:'1/4'},{actionId:'two',probability:'3/4'}]}},undefined,[X,Y]),r=ready(f);
  assert.equal(r.records[0].hittingProbability.exact,'1/4');assert.equal(r.policyEvaluation.outcomes.loss.exact,'3/4');
});
test('zero start is excluded and positive underflow remains unavailable to numeric consumers',()=>{
  const r=ready(fixture({a:{branches:[{p:1}]},b:{reads:[read(X)],branches:[{p:1,to:'b'}]}},[{state:'a',probability:1},{state:'b',probability:0}]));assert.equal(r.coverage.states,1);assert.equal(r.records[0].expectedVisits.exact,'0/1');
  const d=10n**324n,t=ready(fixture({a:{branches:[{p:'1/'+d,reads:[read(X)]},{p:(d-1n)+'/'+d}]}}));
  assert.equal(t.records[0].hittingProbability.exactZero,false);assert.equal(t.records[0].hittingProbability.roundedToZero,true);assert.equal(E.ngMdpExposureProviderRecord(t).records[0].reason,'positive-exposure-number-underflow');
});
test('a finite count above binary64 range remains distinct from infinite recurrence',()=>{
  const d=10n**310n,r=ready(fixture({a:{reads:[read(X)],branches:[{p:(d-1n)+'/'+d,to:'a'},{p:'1/'+d}]}}));
  assert.equal(r.records[0].expectedVisits.reason,'finite-exposure-number-overflow');assert.equal(r.records[0].expectedVisits.exact,d+'/1');assert.equal(r.records[0].hittingProbability.value,1);
});
test('solver policy support binding rejects unselected-law changes and missing policy artifacts',()=>{
  const f=fixture({a:{actions:[{id:'take',branches:[{p:1}]},{id:'unused',branches:[{p:1,terminal:'loss'}]}]}},undefined,[X],true);ready(f);
  f.input.policy.binding.model.states[0].actions[1].branches[0].terminal='explicitNoResult';assert.match(f.run().reason,/support-hash/);
  const g=fixture({a:{branches:[{p:1}]}},undefined,[X],true);delete g.input.policy.binding.evaluation.policy;assert.match(g.run().reason,/policy-budget/);
});
test('native fixed identity preserves raw action spelling and requires separate kernel admission',()=>{
  const f=fixture({a:{branches:[{p:1}]}});delete f.input.policy.binding.sourceSupportHash;assert.match(f.run().reason,/kernel-admission/);
  const g=fixture({a:{branches:[{p:1}]}});g.input.policy.binding.actions[0][1]=[{actionId:'take',probability:'1/1'}];assert.match(g.run().reason,/policy-identity/);
});
test('native receipt root must equal the exact bound request root for both binding kinds',()=>{
  for(const solver of [false,true]){const f=fixture({a:{branches:[{p:1}]}},undefined,[X],solver);f.input.policy.binding.evaluation.root.stateId='different-root';assert.equal(f.run().reason,'stale-native-policy-root');}
});
test('label-only mutations cannot inherit native transition and policy hashes',()=>{
  for(const mutate of [
    a=>a.studyReads[0].labels[0]=Y,
    a=>a.studyReads.push(read(Y)),
    a=>a.branches[0].studyReads=[read(Y)]
  ]){const f=fixture({a:{reads:[read(X)],branches:[{p:1}]}});mutate(f.input.model.states[0].actions[0]);assert.equal(f.run().reason,'unverified-exposure-label-source');}
});
test('stale transport context, literal snapshot and selected laws fail closed',()=>{
  const cases=[
    [f=>f.input.request.state.snapshotHash='changed',/stale/],
    [f=>f.input.model.states[0].snapshot.positionKey='Other|Top',/nonliteral/],
    [f=>f.input.model.states[0].actions[0].branches[0].subtype='different',/differs-from-bound/],
    [f=>f.input.model.behaviorCompression=true,/compression/],
    [f=>f.input.policy.rows.push(clone(f.input.policy.rows[0])),/duplicate/],
    [f=>f.input.startDistribution[0].probability='1/2',/non-normalized/]
  ];for(const [mutate,pattern]of cases){const f=fixture({a:{branches:[{p:1}]}});mutate(f);assert.match(f.run().reason,pattern);}
});
test('source admission and arithmetic budgets are enforced before solving',async()=>{
  const f=fixture({a:{reads:[read(X)],branches:[{p:'3/4',to:'a'},{p:'1/4'}]}});
  for(const opts of [{maxRationalBits:NaN},{maxMilliseconds:0},{maxOperations:2},{maxRationalBits:4},{maxBranches:1}])assert.equal(f.run(opts).status,'unavailable');
  assert.equal(f.run({cancelled:()=>true}).reason,'cancelled');
  let calls=0;const r=await E.ngMdpEvaluateExposureAsync(f.input,f.deps,{cancelled:()=>++calls>20});assert.equal(r.reason,'cancelled');
});
test('synthetic distribution accepts explicit empty events, but rejects duration, reads and incoming support',()=>{
  const make=()=>fixture({a:{reads:[read(X)],branches:[{p:1}]},b:{branches:[{p:1,terminal:'loss'}]}},[{state:'a',probability:'1/3'},{state:'b',probability:'2/3'}]);
  const f=make(),root=f.input.policy.binding.model.states.find(s=>s.id==='@exposure-distribution');
  for(const b of root.actions[0].branches){b.events=[];b.studyReads=[];}ready(f);
  const g=make();g.input.policy.binding.model.states.find(s=>s.id==='@exposure-distribution').actions[0].studyReads=[read(X)];assert.match(g.run().reason,/zero-reads/);
  const h=make();h.input.policy.binding.model.states.find(s=>s.id==='@exposure-distribution').actions[0].branches[0].duration=1;assert.match(h.run().reason,/kernel-admission|distribution-mismatch/);
});
test('interval route preserves underflow support and async cancellation processes an external turn',async()=>{
  const d=10n**324n,f=fixture({a:{branches:[{p:'1/'+d,reads:[read(X)]},{p:(d-1n)+'/'+d}]}}),r=ready(f,{algorithm:'certified'});
  assert.equal(r.records[0].hittingProbability.exactZero,false);assert.equal(r.records[0].hittingProbability.value,0);assert.ok(r.records[0].hittingProbability.bounds[1]>=Number.MIN_VALUE);
  assert.equal(E.ngMdpExposureProviderRecord(r).records[0].reason,'positive-exposure-number-underflow');
  const spec=Object.fromEntries(Array.from({length:200},(_,i)=>['n'+i,{branches:i<199?[{p:1,to:'n'+(i+1)}]:[{p:1}]}])),g=fixture(spec,[{state:'n0',probability:1}]);
  let cancel=false;const timer=setTimeout(()=>{cancel=true;},0),result=await E.ngMdpEvaluateExposureAsync(g.input,g.deps,{cancelled:()=>cancel});clearTimeout(timer);assert.equal(result.reason,'cancelled');
});
test('129-state chain deliberately uses certified sparse production and includes downstream edges',()=>{
  const spec=Object.fromEntries(Array.from({length:129},(_,i)=>['n'+i,{reads:i===128?[read(X)]:[],branches:i===128?[{p:'1/3'},{p:'2/3',terminal:'loss'}]:[{p:1,to:'n'+(i+1)}]}]));
  const r=ready(fixture(spec,[{state:'n0',probability:1}]),{absoluteProbabilityError:1e-8});
  assert.equal(r.diagnostics.numericalRoute,'outward-interval');assert.equal(r.coverage.states,129);assert.equal(r.diagnostics.maxLinearStates,1);
  assert.ok(r.policyEvaluation.outcomes.win.bounds[0]<=1/3&&r.policyEvaluation.outcomes.win.bounds[1]>=1/3);assert.ok(r.records[0].hittingProbability.bounds[0]<=1&&r.records[0].hittingProbability.bounds[1]>=1);
});
test('129-state leaky ring exercises sparse cyclic production without policy enumeration',()=>{
  const spec=Object.fromEntries(Array.from({length:129},(_,i)=>['n'+i,{reads:i===0?[read(X)]:[],branches:[{p:'1/2',to:'n'+((i+1)%129)},{p:'1/2'}]}]));
  const r=ready(fixture(spec,[{state:'n0',probability:1}]),{absoluteProbabilityError:1e-9,absoluteCountError:1e-9});
  assert.equal(r.diagnostics.maxLinearStates,129);assert.equal(r.quality.certificate.kind,'outward-interval-fixed-policy-drift-v1');assert.equal(r.policyEvaluation.outcomes.win.value,1);
  assert.ok(r.records[0].expectedVisits.bounds[0]<=1&&r.records[0].expectedVisits.bounds[1]>=1);
  const f=fixture(spec,[{state:'n0',probability:1}]);assert.equal(f.run({maxLinearTerms:100}).reason,'exposure-linear-fill-budget');
});
test('nearly closed drift cannot be certified by a tiny residual alone',()=>{
  const d=10n**18n,f=fixture({a:{reads:[read(X)],branches:[{p:(d-1n)+'/'+d,to:'a'},{p:'1/'+d}]}});
  assert.equal(f.run({algorithm:'certified'}).reason,'unproved-exposure-positive-drift');assert.equal(ready(f).records[0].expectedVisits.exact,d+'/1');
});
test('forced interval arithmetic encloses independent exact small-chain outcomes and every measure',()=>{
  const cases=[
    {a:{reads:[read(X)],branches:[{p:'3/4',to:'a'},{p:'1/4'}]}},
    {a:{branches:[{p:'1/3',to:'b'},{p:'2/3'}]},b:{reads:[read(X)],branches:[{p:'1/2',to:'a'},{p:'1/2',terminal:'loss'}]}},
    {a:{branches:[{p:'1/10',to:'b'},{p:'9/10',terminal:'loss'}]},b:{reads:[read(X)],branches:[{p:1,to:'b'}]}}
  ];
  for(const spec of cases){const f=fixture(spec),exact=ready(f),bounded=ready(f,{algorithm:'certified'});
    const pairs=[...Object.keys(exact.policyEvaluation.outcomes).map(k=>[exact.policyEvaluation.outcomes[k],bounded.policyEvaluation.outcomes[k]]),[exact.records[0].hittingProbability,bounded.records[0].hittingProbability],[exact.records[0].expectedVisits,bounded.records[0].expectedVisits]];
    for(const [a,b]of pairs)if(a.status==='ready'){const value=M.ngMdpRat(a.exact);assert.ok(M.ngMdpSub(value,M.ngMdpRat(b.bounds[0]))[0]>=0n);assert.ok(M.ngMdpSub(M.ngMdpRat(b.bounds[1]),value)[0]>=0n);}
  }
});
// Independent dense exact arithmetic oracle, used only on <=6-state leaking
// chains. It shares no solver, SCC, rational or interval helpers with production.
function oracle(spec,label,kind){
  const gcd=(a,b)=>b?gcd(b,a%b):a<0n?-a:a;
  const rat=(n,d=1n)=>{if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return [n/g,d/g];};
  const parse=p=>{const [n,d='1']=String(p).split('/');return rat(BigInt(n),BigInt(d));};
  const add=(a,b)=>rat(a[0]*b[1]+b[0]*a[1],a[1]*b[1]),mul=(a,b)=>rat(a[0]*b[0],a[1]*b[1]),neg=a=>[-a[0],a[1]],div=(a,b)=>rat(a[0]*b[1],a[1]*b[0]);
  const ids=Object.keys(spec),n=ids.length,rows=ids.map((id,i)=>{
    const row=Array.from({length:n+1},()=>[0n,1n]);row[i]=[1n,1n];const marked=(spec[id].reads||[]).some(e=>e.labels.some(l=>l.deckKey===label));
    if(kind==='hitting'&&marked){row[n]=[1n,1n];return row;}
    if(kind==='expected'&&marked)row[n]=[1n,1n];
    for(const b of spec[id].branches){const p=parse(b.p);if(b.to){const j=ids.indexOf(b.to);row[j]=add(row[j],neg(p));}else if(kind===(b.terminal||'win'))row[n]=add(row[n],p);}
    return row;
  });
  for(let k=0;k<n;k++){const pivot=rows[k][k];for(let j=k;j<=n;j++)rows[k][j]=div(rows[k][j],pivot);
    for(let i=0;i<n;i++)if(i!==k){const factor=rows[i][k];for(let j=k;j<=n;j++)rows[i][j]=add(rows[i][j],neg(mul(factor,rows[k][j])));}
  }
  const result=rows[0][n];return result[0]+'/'+result[1];
}
test('independent dense rational oracle agrees on seeded mixed-outcome and killed-hit chains',()=>{
  let seed=92731;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)%5)+1;
  for(let count=1;count<=6;count++)for(let repeat=0;repeat<2;repeat++){
    const spec={};for(let i=0;i<count;i++){
      const weights=Array.from({length:count+3},random),sum=weights.reduce((a,b)=>a+b,0);
      spec[i===0?'a':'s'+i]={reads:i%2?[read(Y)]:[read(X)],branches:weights.map((w,j)=>({p:w+'/'+sum,...(j<count?{to:j===0?'a':'s'+j}:{terminal:['win','loss','explicitNoResult'][j-count]})}))};
    }
    const f=fixture(spec,undefined,[X,Y]),exact=ready(f),bounded=ready(f,{algorithm:'certified'});
    for(const outcome of ['win','loss','explicitNoResult'])assert.equal(exact.policyEvaluation.outcomes[outcome].exact,oracle(spec,null,outcome));
    for(const [q,label]of [X,Y].entries())for(const [key,kind]of [['hittingProbability','hitting'],['expectedVisits','expected']]){
      const expected=oracle(spec,label.deckKey,kind);assert.equal(exact.records[q][key].exact,expected);
      const value=M.ngMdpNumber(M.ngMdpRat(expected)),interval=bounded.records[q][key];assert.equal(interval.status,'ready');assert.ok(interval.bounds[0]<=value&&interval.bounds[1]>=value);
    }
  }
});
test('certificate rejects a perturbed downstream assembled solution and reports arithmetic overflow',()=>{
  const code=readFileSync(new URL('../neural/src/mdp-exposure.src.js',import.meta.url),'utf8');
  const marker='return {values,hitting,rewarded,countQueries,exact};';assert.ok(code.includes(marker));
  const corrupt=code.replace(marker,"if(!exact)for(const [id,v]of values)if(JSON.parse(id).nodeId==='b'){v[0]=.8;v[1]=.2;} "+marker);
  const module={exports:{}};new Function('module',corrupt)(module);
  const f=fixture({a:{branches:[{p:'1/2',to:'b'},{p:'1/2',terminal:'loss'}]},b:{branches:[{p:'1/2',to:'b'},{p:'1/2'}]}});
  assert.equal(module.exports.ngMdpEvaluateExposure(f.input,f.deps,{algorithm:'certified'}).reason,'unproved-fixed-policy-outcome-precision');
  const huge=code.replace(marker,"if(!exact)for(const v of values.values())v[4]=Number.MAX_VALUE; "+marker),module2={exports:{}};new Function('module',huge)(module2);
  const overflow=fixture({a:{branches:[{p:1,to:'b'}]},b:{branches:[{p:'1/2',to:'b'},{p:'1/2'}]}});
  assert.equal(module2.exports.ngMdpEvaluateExposure(overflow.input,overflow.deps,{algorithm:'certified'}).reason,'exposure-interval-overflow');
});
test('independent fixed evaluator preserves native raw policy identity and all four outcomes',()=>{
  const f=fixture({a:{actions:[{id:'one',branches:[{p:'1/2',to:'b'},{p:'1/2'}]},{id:'two',branches:[{p:1,terminal:'loss'}]}],policy:[{actionId:'one',probability:'1/3'},{actionId:'two',probability:'2/3'}]},b:{branches:[{p:1,to:'b'}]}});
  const b=f.input.policy.binding,r=E.ngMdpEvaluateFixedPolicy(b.model,b.request,b.actions,f.deps);
  assert.equal(r.root.status,'ready',r.root.reason);assert.equal(r.policyId,b.evaluation.root.policyId);assert.deepEqual(r.root.outcomes,Object.fromEntries(['win','loss','explicitNoResult','nontermination'].map(k=>[k,b.evaluation.root.outcomes[k]])));
  assert.equal(r.quality.supportHash,b.sourceSupportHash);assert.equal(r.quality.policySemantics,'fixed');assert.equal(r.quality.numericalStatus,'exact-rational');
  assert.equal(r.quality.policyRegretBound,undefined);assert.equal(r.root.winBounds,undefined);assert.equal(r.root.selectedActionId,undefined);
});
test('65 and 129 state fixed kernels use the explicit independent certificate discriminator',async()=>{
  for(const n of [65,129]){
    const spec=Object.fromEntries(Array.from({length:n},(_,i)=>['s'+i,{branches:i===n-1?[{p:'1/3'},{p:'2/3',terminal:'loss'}]:[{p:1,to:'s'+(i+1)}]}]));
    const f=fixture(spec,[{state:'s0',probability:1}]),b=f.input.policy.binding,r=await E.ngMdpEvaluateFixedPolicyAsync(b.model,b.request,b.actions,f.deps);
    assert.equal(r.root.status,'ready',r.root.reason);assert.equal(r.quality.numericalStatus,'certified-fixed-policy');assert.equal(r.diagnostics.algorithm,'fixed-policy-sparse-scc-v1');assert.equal(r.diagnostics.certificate,'outward-interval-fixed-policy-drift-v1');
    assert.equal(r.policyId,b.evaluation.root.policyId);assert.equal(r.quality.supportHash,b.sourceSupportHash);assert.ok(r.root.outcomeBounds.win[0]<=1/3&&r.root.outcomeBounds.win[1]>=1/3);
  }
});
test('independent fixed certificate handles an actual synthetic mixture without exposure labels',()=>{
  const f=fixture({a:{branches:[{p:1}]},b:{branches:[{p:1,terminal:'loss'}]}},[{state:'a',probability:'1/3'},{state:'b',probability:'2/3'}]),b=f.input.policy.binding;
  const r=E.ngMdpEvaluateFixedPolicy(b.model,b.request,b.actions,{identity:M,math:M},{algorithm:'certified'});
  assert.equal(r.root.status,'ready',r.root.reason);assert.equal(r.root.stateId,'@exposure-distribution');assert.equal(r.policyId,b.evaluation.root.policyId);assert.equal(r.root.outcomes.win,1/3);
  assert.equal(r.quality.coverage.states,3);assert.equal(r.diagnostics.certificateEvidence.globalOperator,true);
});
test('fixed-policy certificate rejects malformed policy arguments and stale native request',()=>{
  const make=()=>fixture({a:{branches:[{p:1}]}});
  for(const mutate of [b=>b.actions.push(b.actions[0]),b=>b.actions.push(['extraneous','take']),b=>b.actions.pop(),b=>b.request.profileHash='changed']){
    const f=make(),b=f.input.policy.binding;mutate(b);const r=E.ngMdpEvaluateFixedPolicy(b.model,b.request,b.actions,f.deps);assert.equal(r.root.status,'unavailable');assert.equal(r.root.outcomes,undefined);
  }
  const f=make(),b=f.input.policy.binding,old=E.ngMdpEvaluateFixedPolicy(b.model,b.request,b.actions,f.deps);b.actions[0][1]=[{actionId:'take',probability:'1/1'}];
  const spelling=E.ngMdpEvaluateFixedPolicy(b.model,b.request,b.actions,f.deps);assert.notEqual(spelling.policyId,old.policyId);assert.deepEqual(spelling.root.outcomes,old.root.outcomes);
  b.model.states[0].actions[0].branches[0].terminal='loss';const changed=E.ngMdpEvaluateFixedPolicy(b.model,b.request,b.actions,f.deps);assert.notEqual(changed.quality.supportHash,old.quality.supportHash);assert.equal(changed.root.outcomes.loss,1);
});
test('fixed-policy direct unresolved boundary and near-closed conditioning stay explicit',()=>{
  const f=fixture({a:{branches:[{p:1,terminal:'nontermination'}]}}),b=f.input.policy.binding;
  const r=E.ngMdpEvaluateFixedPolicy(b.model,b.request,b.actions,f.deps,{algorithm:'certified'});assert.equal(r.root.status,'ready',r.root.reason);assert.equal(r.root.outcomes.nontermination,1);
  const d=10n**18n,g=fixture({a:{branches:[{p:(d-1n)+'/'+d,to:'a'},{p:'1/'+d}]}}),c=g.input.policy.binding;
  assert.equal(E.ngMdpEvaluateFixedPolicy(c.model,c.request,c.actions,g.deps,{algorithm:'certified'}).root.reason,'unproved-exposure-positive-drift');
});
test('fixed-policy raw zero-mass actions must be legal before positive support is selected',async()=>{
  const f=fixture({a:{actions:[{id:'take',branches:[{p:1}]},{id:'spare',branches:[{p:1,terminal:'loss'}]}]}}),b=f.input.policy.binding;
  for(const objectForm of [false,true])for(const algorithm of ['exact-sparse','certified']){
    const choices=[{actionId:'take',probability:1},{actionId:'absent',probability:0}],raw=objectForm?{[f.ids.a]:choices}:[[f.ids.a,choices]];
    assert.equal(M.ngMdpEvaluatePolicy(b.model,b.request,raw).root.status,'unavailable');
    const bad=await E.ngMdpEvaluateFixedPolicyAsync(b.model,b.request,raw,f.deps,{algorithm});
    assert.equal(bad.root.status,'unavailable');assert.equal(bad.root.reason,'illegal-fixed-policy-action');assert.equal(bad.root.outcomes,undefined);
    choices[1].actionId='spare';
    const expected=M.ngMdpEvaluatePolicy(b.model,b.request,raw),good=E.ngMdpEvaluateFixedPolicy(b.model,b.request,raw,f.deps,{algorithm});
    assert.equal(good.root.status,'ready',good.root.reason);assert.equal(good.policyId,expected.root.policyId);assert.deepEqual(good.root.outcomes,Object.fromEntries(['win','loss','explicitNoResult','nontermination'].map(k=>[k,expected.root.outcomes[k]])));
  }
});
