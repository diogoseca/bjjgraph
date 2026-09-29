import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../neural/src/mdp-model.src.js');
const W = p => ({ probability: p, terminal: 'win' });
const L = p => ({ probability: p, terminal: 'loss' });
const N = p => ({ probability: p, terminal: 'explicitNoResult' });
const to = (p, id, duration) => ({ probability: p, to: id, ...(duration == null ? {} : { duration }) });
const action = (id, ...branches) => ({ id, branches });
const state = (id, ...actions) => ({ id, actions });
function fixture(states, extra = {}) {
  const request = { apiVersion: 2, requestId: 'r', revision: 1, modelHash: 'model', mechanicsHash: 'law', graphHash: 'graph', profileHash: 'profile', opponentPolicyHash: 'opponent', ruleset: 'gi',
    state: { id: states[0].id }, horizon: { kind: 'eventual' }, objective: 'max-win/min-loss/min-nontermination', futureStudyPolicy: 'no-additional-study-events', ...extra };
  const model = { ...request, states, contractHash: M.ngMdpContractHash(request) };
  return { model, request };
}
function solve(states, extra, options) { const {model,request}=fixture(states,extra); return M.ngMdpSolve(model,request,options); }
function vector(record) { return ['win','loss','explicitNoResult','nontermination'].map(k => record.outcomes[k]); }
function conserved(record) {
  assert.ok(Math.abs(vector(record).reduce((a,b)=>a+b,0)-1)<1e-14);
  for(const key of ['win','loss','explicitNoResult','nontermination']) {
    assert.ok(record.outcomes[key]>=0 && record.outcomes[key]<=1);
    const total=Object.entries(record.outcomes.subtypes).filter(([k])=>k.startsWith(key+':')).reduce((sum,[,v])=>sum+v,0);
    assert.ok(Math.abs(total-record.outcomes[key])<1e-14, key+' subtype partition');
  }
}

test('canonical context identities and SHA-256 match independent crypto implementation', () => {
  for(const text of ['', 'abc', 'é日本🤼', 'x'.repeat(1000)]) assert.equal(M.ngMdpDigest(text),createHash('sha256').update(text).digest('hex'));
  const {request}=fixture([state('top',action('win',W(1)))]);
  assert.equal(M.ngMdpContractHash(request),M.ngMdpContractHash({...request,revision:2,requestId:'other',requestedActionIds:['anything']}));
  for(const field of ['profileHash','ruleset','modelHash','mechanicsHash','graphHash','opponentPolicyHash']) assert.notEqual(M.ngMdpContractHash(request),M.ngMdpContractHash({...request,[field]:'changed'}));
  assert.notEqual(M.ngMdpActionId('top','kimura','escape','mount','a'),M.ngMdpActionId('bottom','kimura','escape','mount','a'));
  assert.notEqual(M.ngMdpActionId('top','kimura','escape','mount','a'),M.ngMdpActionId('top','kimura','escape','guard','a'));
});

test('exact huge-fraction conversion is correctly rounded, including audit and subnormal regressions', () => {
  const power=10n**400n, n=(10n**18n+999n)*power+1n, d=(10n**18n+1000n)*power+1n;
  assert.equal(M.ngMdpNumber([n,d]),1);
  assert.equal(M.ngMdpNumber([1n,2n**1074n]),Number.MIN_VALUE);
  assert.equal(M.ngMdpNumber([1n,2n**1075n]),0);
  assert.equal(M.ngMdpNumber([3n,2n**1075n]),2*Number.MIN_VALUE);
  assert.equal(M.ngMdpNumber([2n**53n+1n,2n**53n]),1);
  assert.equal(M.ngMdpNumber([2n**53n+3n,2n**53n]),1+2**-51);
  assert.throws(()=>M.ngMdpRat('1'.repeat(5000)),/input-budget/);
  assert.throws(()=>M.ngMdpRat('1e999999'),/input-budget/);
});

test('delayed win beats immediate odds; counterfactuals follow ONE future optimizing policy', () => {
  const r=solve([state('s',action('direct',W('.6'),L('.4')),action('delayed',to(1,'x'))),state('x',action('trap',W('.5'),N('.5')),action('finish',W('.9'),L('.1')))]);
  assert.equal(r.root.selectedActionId,'delayed'); assert.deepEqual(vector(r.root),[.9,.1,0,0]);
  assert.deepEqual(vector(r.actions.find(a=>a.actionId==='direct')),[.6,.4,0,0]);
  assert.equal(r.quality.numericalStatus,'exact-rational'); assert.equal(r.quality.policyRegretBound,0);
  r.actions.forEach(conserved);
});

test('improper Bellman tie chooses an exiting stationary policy while one-time stay is equally valued', () => {
  const r=solve([state('s',action('a-stay',to(1,'s',0)),action('z-exit',W(1)))]);
  assert.equal(r.root.selectedActionId,'z-exit'); assert.deepEqual(vector(r.root),[1,0,0,0]);
  assert.deepEqual(r.actions.map(a=>a.outcomes.win),[1,1]); assert.equal(r.ranking[0],'a-stay');
  assert.equal(r.actions.find(a=>a.selected).actionId,'z-exit');
});

test('secondary loss and tertiary nontermination are evaluated globally, not local Bellman equality', () => {
  // Strict-improvement-only policy iteration initialized at lose would be stuck.
  const avoid=solve([state('s',action('a-lose',L(1)),action('z-stay',to(1,'s')))]);
  assert.equal(avoid.root.selectedActionId,'z-stay'); assert.deepEqual(vector(avoid.root),[0,0,0,1]); conserved(avoid.root);
  const reset=solve([state('s',action('a-stay',to(1,'s')),action('z-reset',N(1)))]);
  assert.equal(reset.root.selectedActionId,'z-reset'); assert.deepEqual(vector(reset.root),[0,0,1,0]);
  const primary=solve([state('s',action('danger',W('.6'),L('.4')),action('safe',W('.5'),N('.5')))]);
  assert.deepEqual(vector(primary.root),[.6,.4,0,0]);
});

test('closed cycles, near-absorbing loops and exact tiny action gaps never use a residual tolerance', () => {
  const closed=solve([state('a',action('go',to(1,'b'))),state('b',action('go',to(1,'a')))]);
  assert.deepEqual(vector(closed.root),[0,0,0,1]); conserved(closed.root);
  const leak=solve([state('s',action('wait',W('1/1000000000'),to('999999999/1000000000','s')))]);
  assert.deepEqual(vector(leak.root),[1,0,0,0]);
  const near=solve([state('s',action('a',W('1/2'),N('1/2')),action('z',W('5000000000000001/10000000000000000'),N('4999999999999999/10000000000000000')))]);
  assert.equal(near.root.selectedActionId,'z');
});

test('role-specific user-first values are not forced complements; legality is not attempt weight', () => {
  for(const role of ['Top','Bottom','Attacker','Defender']) assert.equal(solve([state(role,action('finish',W(1)))]).root.outcomes.win,1);
  const states=[state('s',{...action('collar',W('.9'),L('.1')),rulesets:['gi']},{...action('never-attempted',W('.7'),L('.3')),attemptWeight:0})];
  assert.equal(solve(states).root.selectedActionId,'collar');
  const r=solve(states,{ruleset:'nogi',requestedActionIds:['collar','never-attempted']});
  assert.equal(r.root.selectedActionId,'never-attempted'); assert.equal(r.actions[0].status,'unavailable'); assert.equal(r.actions[0].outcomes,undefined);
});

test('unknown support, malformed rows, cancellation and budgets have no fabricated probabilities', () => {
  for(const states of [[state('s',action('unknown',to(1,'missing')))], [state('s',action('short',W('.9')))], [state('s',action('negative',W('-1'),L('2')))], [state('s',{id:'x',status:'unavailable',reason:'unloaded-defense'})]]) {
    const r=solve(states); assert.equal(r.root.status,'unavailable'); assert.equal(r.root.outcomes,undefined); assert.equal(r.quality.numericalStatus,'incomplete');
  }
  const states=[state('s',action('stay',to(1,'s')),action('win',W(1)))];
  assert.match(solve(states,{}, {maxPolicies:1,algorithm:'enumeration'}).root.reason,/enumeration-budget/);
  assert.match(solve(states,{}, {cancelled:()=>true}).root.reason,/cancelled/);
});

test('same instantiated kernel cannot be relabeled with a different clock or snapshot', () => {
  const {model,request}=fixture([state('s',action('win',W(1)))],{horizon:{kind:'actual-roll',episodeCap:9,moveCount:8}});
  assert.equal(M.ngMdpSolve(model,request).root.status,'ready');
  for(const changed of [{...request,horizon:{...request.horizon,episodeCap:10}}, {...request,state:{...request.state,qMod:-.08}}]) {
    const r=M.ngMdpSolve(model,changed); assert.equal(r.root.status,'unavailable'); assert.match(r.root.reason,/stale-contract/);
  }
  assert.match(M.ngMdpSolve({...model,contractHash:undefined},request).root.reason,/stale-contract/);
});

test('joint endpoint-duration state augmentation preserves deadlines, terminal precedence and zero-cost choices', () => {
  // Hand-constructed independent deadline=2 adapter: duration 1 wins; duration 3
  // times out; terminal exactly at 2 wins. The kernel, not solver, owns ordering.
  const r=solve([state('s@2',action('mean2',W('.5'),{...N('.5'),subtype:'timeout'}),action('fixed2',W(1)),action('zero',to(1,'s@2',0)))],{horizon:{kind:'actual-roll',episodeCap:2,moveCount:0}});
  assert.deepEqual(vector(r.actions.find(a=>a.actionId==='mean2')),[.5,0,.5,0]); assert.equal(r.root.selectedActionId,'fixed2');
  assert.equal(r.quality.coverage.zeroDurationBranches,1);
});

test('production policy iteration scales past exponential reference and sparse 64-state boundary', () => {
  const binary=Array.from({length:16},(_,i)=>state('s'+i,action('a-ring',to(1,'s'+((i+1)%16))),action('z-win',W(1))));
  assert.match(solve(binary,{}, {algorithm:'enumeration'}).root.reason,/enumeration-budget/);
  const result=solve(binary); assert.equal(result.root.outcomes.win,1); assert.equal(result.diagnostics.algorithm,'rational-lexicographic-policy-iteration');
  const ring=Array.from({length:65},(_,i)=>state('s'+i,action('leak',W('1/2'),to('1/2','s'+((i+1)%65)))));
  const r=solve(ring); assert.equal(r.root.status,'ready',r.root.reason); assert.equal(r.root.outcomes.win,1); assert.equal(r.diagnostics.largestPolicyComponent,65);
  const tiny=solve([state('s',action('x',W('1/1048576'),L('1048575/1048576')))],{}, {maxRationalBits:16});
  assert.equal(tiny.root.status,'unavailable'); assert.match(tiny.root.reason,/rational.*budget/);
});

test('all solver routes enforce finite positive budgets and initial sparse fill admission',()=>{
  const {model,request}=fixture([state('s',action('leak',W('1/2'),to('1/2','t'))),state('t',action('leak',W('1/2'),to('1/2','s')))]);
  for(const maxRationalBits of [0,NaN,Infinity,-1,3.5]) {
    for(const algorithm of ['policy-iteration','enumeration']) assert.equal(M.ngMdpSolve(model,request,{algorithm,maxRationalBits}).root.status,'unavailable');
    assert.equal(M.ngMdpEvaluatePolicy(model,request,{s:'leak',t:'leak'},{maxRationalBits}).root.status,'unavailable');
  }
  assert.match(M.ngMdpSolve(model,request,{maxLinearTerms:3}).root.reason,/linear-fill-budget/);
  assert.match(M.ngMdpEvaluatePolicy(model,request,{s:'leak',t:'leak'},{maxLinearTerms:3}).root.reason,/linear-fill-budget/);
});

test('certified quotient lifts proper exits, avoids arbitrary-ID collisions and encloses nearly closed laws',()=>{
  const collision='@mec:'+M.ngMdpDigest(['a']);
  const trap=solve([state('a',action('stay',to(1,'a')),action('exit',to(1,collision))),state(collision,action('win',W(1)))],{}, {algorithm:'certified'});
  assert.equal(trap.root.status,'bounded',trap.root.reason);assert.equal(trap.root.selectedActionId,'exit');assert.equal(trap.root.outcomes.win,1);
  assert.equal(trap.root.secondaryStatus,'unresolved-primary-ties');assert.ok(trap.quality.policyRegretBound<=1e-4);
  for(const k of [9,30,150]){
    const d=10n**BigInt(k),r=solve([state('s',action('leak',W('1/'+(3n*d)),L('2/'+(3n*d)),to((d-1n)+'/'+d,'s')))],{}, {algorithm:'certified'});
    assert.equal(r.root.status,'bounded',r.root.reason);assert.ok(r.root.winBounds[0]<=1/3&&r.root.winBounds[1]>=1/3);
    assert.ok(r.quality.maxWinError<=1e-4);conserved(r.root);
  }
  const recurrent=solve([state('s',action('cycle',to(1,'t'))),state('t',action('cycle',to(1,'s')))],{}, {algorithm:'certified'});
  assert.equal(recurrent.root.outcomes.nontermination,1);conserved(recurrent.root);
  const cancel=solve([state('s',action('exit',W(1)))],{}, {algorithm:'certified',cancelled:()=>true});assert.equal(cancel.root.status,'unavailable');
});

test('outward interval witnesses enclose subnormal mass and reject uncertified near recurrence or overflow',()=>{
  const d=2n**1100n;
  const inputs=[
    [state('s',action('mixed',W('1/10'),W('1/3'),L('17/30')))],
    [state('s',action('tiny',W('1/'+d),L((d-1n)+'/'+d)))],
    [state('s',action('zero',W(0),L(1)))],
    [state('s',action('one',W(1),L(0)))]
  ];
  for(const states of inputs){
    const r=solve(states,{}, {algorithm:'certified',certificateArithmetic:'interval'});
    assert.equal(r.root.status,'bounded',r.root.reason);conserved(r.root);
    const exact=oracleEvaluate(states,[0]).get('s');
    ['win','loss','explicitNoResult','nontermination'].forEach((key,i)=>{
      assert.ok(leq(floatFraction(r.root.outcomeBounds[key][0]),exact[i]));
      assert.ok(leq(exact[i],floatFraction(r.root.outcomeBounds[key][1])));
    });
    assert.ok(r.quality.coordinateErrorBound>=4*Number.EPSILON);
  }
  for(const exponent of [30,309]){
    const den=10n**BigInt(exponent),r=solve([state('s',action('near',W('1/'+den),to((den-1n)+'/'+den,'s')))],{}, {algorithm:'certified',certificateArithmetic:'interval'});
    assert.equal(r.root.status,'unavailable');
    assert.match(r.root.reason,/termination-witness-not-verified|nonfinite-numerical-candidate|interval-overflow/);
    assert.equal(r.root.outcomes,undefined);
  }
  // Splitting a tiny leak into many rows must never turn a nonpositive outward
  // drift into a certificate just because the residual happens to be small.
  const den=10n**18n,rows=Array.from({length:40},()=>W('1/'+den));
  const many=solve([state('s',action('tiny-rows',...rows,to((den-40n)+'/'+den,'s')))],{}, {algorithm:'certified',certificateArithmetic:'interval'});
  if(many.root.status==='bounded')assert.ok(many.root.winBounds[1]>=1&&many.root.winBounds[0]<=1);
  else assert.equal(many.root.outcomes,undefined);
});

test('coordinate accuracy is admitted independently and cancellation during export cannot publish a result',()=>{
  const {model,request}=fixture([state('s',action('win',W(1)))]);
  const tight={...request,precision:{absoluteProbabilityError:Number.EPSILON,policyRegret:.1}};
  assert.match(M.ngMdpSolve(model,tight,{algorithm:'certified'}).root.reason,/requested-precision-not-certified/);
  for(const algorithm of ['certified','policy-iteration','enumeration']){
    let cancelled=false;
    const late={...request};Object.defineProperty(late,'requestedActionIds',{get(){cancelled=true;return undefined;}});
    const r=M.ngMdpSolve(model,late,{algorithm,cancelled:()=>cancelled});
    assert.equal(r.root.status,'unavailable');assert.match(r.root.reason,/cancelled/);
  }
});

// INDEPENDENT oracle: no production rational helpers, SCC routine, backups, or
// Gaussian eliminator. Enumerate complete stationary policies; backward graph
// reachability finds the nonterminal basin; Cramer's determinants solve four RHS.
const gcd=(a,b)=>b?gcd(b,a%b):a;
const frac=(n,d=1n)=>{if(d<0n){n=-n;d=-d;} const g=gcd(n<0n?-n:n,d);return [n/g,d/g];};
const add=(a,b)=>frac(a[0]*b[1]+b[0]*a[1],a[1]*b[1]);
const mul=(a,b)=>frac(a[0]*b[0],a[1]*b[1]);
const neg=a=>[-a[0],a[1]];
const div=(a,b)=>frac(a[0]*b[1],a[1]*b[0]);
const zero=()=>[0n,1n], one=()=>[1n,1n];
const parse=v=>{const [n,d]=String(v).split('/');return frac(BigInt(n),BigInt(d||1));};
function floatFraction(x){
  if(!x)return zero();const bytes=new ArrayBuffer(8);new Float64Array(bytes)[0]=x;const bits=new BigUint64Array(bytes)[0];
  const e=Number((bits>>52n)&2047n),sign=bits>>63n?-1n:1n,mantissa=(bits&((1n<<52n)-1n))+(e?1n<<52n:0n),power=e?e-1075:-1074;
  return power>=0?frac(sign*mantissa*(2n**BigInt(power))):frac(sign*mantissa,2n**BigInt(-power));
}
const leq=(a,b)=>a[0]*b[1]<=b[0]*a[1];
function determinant(a){if(!a.length)return one();if(a.length===1)return a[0][0];return a[0].reduce((v,x,j)=>add(v,mul(j%2?neg(x):x,determinant(a.slice(1).map(r=>r.filter((_,k)=>k!==j))))),zero());}
function oracleEvaluate(states,choice){
  const terminal=['win','loss','explicitNoResult','nontermination'];
  const reached=new Set(); let changed=true;
  while(changed){changed=false;states.forEach((s,i)=>{if(!reached.has(s.id)&&s.actions[choice[i]].branches.some(b=>b.terminal || reached.has(b.to))){reached.add(s.id);changed=true;}});}
  const trans=states.filter(s=>reached.has(s.id)), ids=trans.map(s=>s.id), a=trans.map((s,i)=>trans.map((_,j)=>i===j?one():zero())), rhs=trans.map(()=>[zero(),zero(),zero(),zero()]);
  trans.forEach((s,i)=>s.actions[choice[states.indexOf(s)]].branches.forEach(b=>{const p=parse(b.probability);if(b.terminal)rhs[i][terminal.indexOf(b.terminal)]=add(rhs[i][terminal.indexOf(b.terminal)],p);else if(reached.has(b.to)){const j=ids.indexOf(b.to);a[i][j]=add(a[i][j],neg(p));}else rhs[i][3]=add(rhs[i][3],p);}));
  const det=determinant(a), values=new Map(states.filter(s=>!reached.has(s.id)).map(s=>[s.id,[zero(),zero(),zero(),one()]]));
  trans.forEach((s,i)=>values.set(s.id,[0,1,2,3].map(c=>div(determinant(a.map((row,k)=>row.map((v,j)=>j===i?rhs[k][c]:v))),det))));return values;
}
function oracle(states){
  const compare=(a,b)=>{for(const [i,sign]of[[0,1],[1,-1],[3,-1]]){const d=a[i][0]*b[i][1]-b[i][0]*a[i][1];if(d)return(d>0n?1:-1)*sign;}return 0;};
  const best=new Map(),choice=states.map(()=>0),count=states.reduce((n,s)=>n*s.actions.length,1);
  for(let k=0;k<count;k++){const value=oracleEvaluate(states,choice);for(const [id,v]of value)if(!best.has(id)||compare(v,best.get(id))>0)best.set(id,v);for(let j=choice.length-1;j>=0;j--){if(++choice[j]<states[j].actions.length)break;choice[j]=0;}}
  return best;
}
test('independent rational determinant oracle matches cyclic model, selected policy and every one-time action', () => {
  let seed=1729;const draw=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};let checked=0;
  for(let sample=0;sample<20;sample++){
    const states=Array.from({length:3},(_,i)=>state('s'+i,...Array.from({length:2},(_,j)=>action('a'+j,...Array.from({length:4},()=>{const dest=draw()%6;return dest<3?to('1/4','s'+dest):dest===3?W('1/4'):dest===4?L('1/4'):N('1/4');})) )));
    // All states are deliberately made root-reachable without restricting choices.
    states.unshift(state('root',action('enter',to('1/3','s0'),to('1/3','s1'),to('1/3','s2'))));
    const expected=oracle(states),r=solve(states,{}, {includeStateValues:true});assert.equal(r.root.status,'ready',r.root.reason);
    const reference=solve(states,{}, {includeStateValues:true,algorithm:'enumeration'});assert.equal(reference.root.status,'ready',reference.root.reason);
    const bounded=solve(states,{}, {includeStateValues:true,algorithm:'certified',certificateArithmetic:'interval'});assert.equal(bounded.root.status,'bounded',bounded.root.reason);
    const boundedChoices=states.map(s=>s.actions.findIndex(a=>a.id===new Map(bounded.policy).get(s.id))),boundedActual=oracleEvaluate(states,boundedChoices);
    for(const row of bounded.states){
      const value=boundedActual.get(row.stateId),best=expected.get(row.stateId);
      ['win','loss','explicitNoResult','nontermination'].forEach((name,c)=>{
        assert.ok(leq(floatFraction(row.outcomeBounds[name][0]),value[c])&&leq(value[c],floatFraction(row.outcomeBounds[name][1])),name+' common-policy exact enclosure');
      });
      assert.ok(leq(best[0],floatFraction(row.winBounds[1])),'max-win upper');assert.ok(leq(floatFraction(row.winBounds[0]),best[0]),'max-win lower');
    }
    for(const row of r.states) assert.deepEqual(vector(row),vector(reference.states.find(s=>s.stateId===row.stateId)));
    const picked=states.map(s=>s.actions.findIndex(a=>a.id===new Map(r.policy).get(s.id))),actual=oracleEvaluate(states,picked);
    for(const row of r.states){const v=expected.get(row.stateId).map(x=>Number(x[0])/Number(x[1]));assert.deepEqual(vector(row),v);assert.deepEqual(actual.get(row.stateId),expected.get(row.stateId));conserved(row);checked++;}
  }
  assert.equal(checked,80); console.log('MDP independent oracle: 80 state comparisons, 20 complete policy enumerations');
});
