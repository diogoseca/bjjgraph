// AN INDEPENDENT EXACT REFERENCE FOR THE CERTIFIED SOLVER (ported 2026-10-06, DEVMV34).
// Written by the MDP engine seat on feat/mdp-game-model and kept only there (custody commit 88bee5214,
// tests/mdp_flat.test.mjs); dev took that branch's solver through PR #231 but never this file. The
// reference below shares NO solver code: its own BigInt fractions, complete policy enumeration for
// the optimum, terminal-basin reachability and Cramer's-rule determinant ratios for each policy's
// exact vector. Every certified STATE record and every ACTION record (includeStateValues and
// includeActionValues, in both certificate arithmetics) must enclose that exact vector, and the
// winBounds upper end must cover the independent optimum.
// WHAT IT ADDS THAT DEV LACKED, by mutation against dev 45d114a10's mdp-certified.src.js:
//   - an action record without its successors' error terms (actionRecord's `e`, the bound every
//     card's certified Win chance prints from) is RED here and GREEN in tests/mdp_model.test.mjs;
//   - an upper bound without the Bellman excess, or zeroed state-record errors: red in both suites;
//   - no outward rounding: red in mdp_model only (this file's fixtures happen to round exactly).
// NOT a kill anywhere: an MEC lift that takes each member's first internal action instead of the
// distance-descending one (the fixtures' first internal action already progresses).
// LEFT ON THE BRANCH, deliberately: two tests assert features dev's solver does not have. (1) The
// `probabilityRows`/`probabilityConversions` diagnostics of the branch's WeakMap conversion cache: dev
// reuses conversions through its own per-probability memo (v1.218.6, WINLAT), whose outputs a
// byte-for-byte differential pinned instead. (2) Yields INSIDE quotient construction, so a cancel lands
// in stage "quotient" for one very wide state: dev's first yield after starting a solve is at
// "drift-witness" (measured on this file's fixture), and the client's 10 s cancellation grace covers a
// quotient build measured at 0.3-0.6 s on desktop. Porting either changes a hash-pinned law file.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),M=require('../neural/src/mdp-model.src.js');
const kinds=['win','loss','explicitNoResult','nontermination'];
const action=(id,...branches)=>({id,branches}),state=(id,...actions)=>({id,actions});
const to=(p,id)=>({probability:p,to:id,duration:0,events:[{kind:'arrival',deckKey:id+'|Top'}]});
const terminal=(p,kind='win')=>({probability:p,terminal:kind,subtype:kind+'-leaf'});
function fixture(states,extra={}){
 const request={apiVersion:2,requestId:'flat',revision:1,modelHash:'model',mechanicsHash:'law',graphHash:'graph',profileHash:'profile',opponentPolicyHash:'opponent',ruleset:'gi',state:{id:states[0].id},horizon:{kind:'eventual'},objective:M.NG_MDP_OBJECTIVE,futureStudyPolicy:'no-additional-study-events',...extra};
 return {model:{...request,states,contractHash:M.ngMdpContractHash(request)},request};
}
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const solve=(f,options={})=>M.ngMdpSolve(f.model,f.request,{algorithm:'certified',certificateArithmetic:'interval',includeStateValues:true,includeActionValues:true,includePolicy:true,...options});

// Independent tiny reference: complete policy enumeration, terminal-basin
// reachability and determinant ratios; no native arithmetic/SCC/linear helpers.
const gcd=(a,b)=>b?gcd(b,a%b):a;
const frac=(n,d=1n)=>{if(d<0n){n=-n;d=-d;}const g=gcd(n<0n?-n:n,d);return[n/g,d/g];};
const add=(a,b)=>frac(a[0]*b[1]+b[0]*a[1],a[1]*b[1]);
const mul=(a,b)=>frac(a[0]*b[0],a[1]*b[1]);
const neg=a=>[-a[0],a[1]],div=(a,b)=>frac(a[0]*b[1],a[1]*b[0]);
const zero=()=>[0n,1n],one=()=>[1n,1n];
const parse=v=>{const[n,d]=String(v).split('/');return frac(BigInt(n),BigInt(d||1));};
const leq=(a,b)=>a[0]*b[1]<=b[0]*a[1];
function float(x){
 if(!x)return zero();const b=new DataView(new ArrayBuffer(8));b.setFloat64(0,x);const bits=b.getBigUint64(0),e=Number((bits>>52n)&2047n),sign=bits>>63n?-1n:1n,m=(bits&((1n<<52n)-1n))+(e?1n<<52n:0n),p=e?e-1075:-1074;
 return p>=0?frac(sign*m*(2n**BigInt(p))):frac(sign*m,2n**BigInt(-p));
}
function det(a){if(!a.length)return one();if(a.length===1)return a[0][0];return a[0].reduce((s,x,j)=>add(s,mul(j%2?neg(x):x,det(a.slice(1).map(r=>r.filter((_,k)=>k!==j))))),zero());}
function fixed(states,policy){
 const reached=new Set();let changed=true;
 while(changed){changed=false;for(const s of states)if(!reached.has(s.id)&&s.actions.find(a=>a.id===policy.get(s.id)).branches.some(b=>parse(b.probability)[0]&&(b.terminal||reached.has(b.to)))){reached.add(s.id);changed=true;}}
 const transient=states.filter(s=>reached.has(s.id)),ids=transient.map(s=>s.id),a=ids.map((_,i)=>ids.map((_,j)=>i===j?one():zero())),rhs=ids.map(()=>kinds.map(zero));
 transient.forEach((s,i)=>s.actions.find(a=>a.id===policy.get(s.id)).branches.forEach(b=>{
  const p=parse(b.probability);if(b.terminal)rhs[i][kinds.indexOf(b.terminal)]=add(rhs[i][kinds.indexOf(b.terminal)],p);
  else if(reached.has(b.to)){const j=ids.indexOf(b.to);a[i][j]=add(a[i][j],neg(p));}else rhs[i][3]=add(rhs[i][3],p);
 }));
 const determinant=det(a),values=new Map(states.filter(s=>!reached.has(s.id)).map(s=>[s.id,[zero(),zero(),zero(),one()]]));
 transient.forEach((s,i)=>values.set(s.id,kinds.map((_,c)=>div(det(a.map((r,k)=>r.map((v,j)=>j===i?rhs[k][c]:v))),determinant))));return values;
}
function optimum(states){
 const choice=states.map(()=>0),best=new Map(),n=states.reduce((s,x)=>s*x.actions.length,1);
 for(let i=0;i<n;i++){
  const values=fixed(states,new Map(states.map((s,j)=>[s.id,s.actions[choice[j]].id])));
  for(const[id,v]of values)if(!best.has(id)||leq(best.get(id),v[0]))best.set(id,v[0]);
  for(let j=choice.length-1;j>=0;j--){if(++choice[j]<states[j].actions.length)break;choice[j]=0;}
 }
 return best;
}
function enclosed(record,value){kinds.forEach((k,i)=>{assert.ok(leq(float(record.outcomeBounds[k][0]),value[i]),k+' lower');assert.ok(leq(value[i],float(record.outcomeBounds[k][1])),k+' upper');});}
function prove(states,arithmetic){
 const f=fixture(states),before=JSON.stringify(f);freeze(f);const r=solve(f,{certificateArithmetic:arithmetic});assert.equal(r.root.status,'bounded',r.root.reason);assert.equal(JSON.stringify(f),before);
 const values=fixed(states,new Map(r.policy)),best=optimum(states);
 for(const record of r.states){enclosed(record,values.get(record.stateId));assert.ok(leq(best.get(record.stateId),float(record.winBounds[1])));}
 for(const record of r.actionValues){const a=states.find(s=>s.id===record.stateId).actions.find(a=>a.id===record.actionId),q=kinds.map(zero);
  for(const b of a.branches){const p=parse(b.probability),v=b.to?values.get(b.to):kinds.map(k=>k===b.terminal?one():zero());for(let c=0;c<4;c++)q[c]=add(q[c],mul(p,v[c]));}enclosed(record,q);
 }
 assert.ok(r.quality.coordinateErrorBound>=4*Number.EPSILON);return r;
}

test('every certified state and action record encloses the independent exact vector; winBounds cover the optimum',()=>{
 for(const arithmetic of ['rational','interval'])for(let i=0;i<12;i++){
  const states=[state('Deck A|Top',action('a',to('1/2','Deck B|Defender'),terminal('1/3'),terminal('1/6','loss')),action('b',terminal((i%5+1)+'/6'),terminal((5-i%5)+'/6','explicitNoResult'))),
   state('Deck B|Defender',action('a',to('1/2','Deck A|Top'),terminal('1/2','loss')),action('b',to('2/3','third'),terminal('1/3'))),
   state('third',action('a',to('1/3','third'),terminal('1/3'),terminal('1/3','explicitNoResult')))];
  prove(states,arithmetic);
 }
});

test('MEC lift keeps literal identities and original duration/event/source fields',()=>{
 const collision='@mec:'+M.ngMdpDigest(['Deck A|Top','Deck B|Top']);
 const states=[state('Deck A|Top',action('a-internal',to(1,'Deck B|Top')),action('z-exit',to('1/2',collision),terminal('1/2','loss'))),
  state('Deck B|Top',action('a-internal',to(1,'Deck A|Top')),action('z-exit',terminal('1/3'),terminal('2/3','loss'))),state(collision,action('end',terminal(1)))];
 states[0].actions[1].studyReads=[{kind:'execution',labels:[{deckKey:'Deck A|Top',role:'Top'}]}];
 const before=JSON.stringify(states),r=prove(states,'interval');assert.equal(JSON.stringify(states),before);assert.equal(r.policy.length,3);
 const changed=JSON.parse(before);changed[0].actions[1].branches[0].duration=7;changed[0].actions[1].branches[0].events=[{kind:'arrival',deckKey:'Different|Top'}];
 const c=solve(fixture(changed));assert.deepEqual(c.root.outcomes,r.root.outcomes);assert.notEqual(c.quality.supportHash,r.quality.supportHash);assert.notEqual(c.root.policyId,r.root.policyId);
 const closed=prove([state('a',action('loop',to(1,'b'))),state('b',action('loop',to(1,'a')))],'interval');assert.equal(closed.root.outcomes.nontermination,1);
});

test('probability exports keep exact endpoints and tiny mass, and refuse what they cannot certify',()=>{
 const d=2n**1100n;
 for(const arithmetic of ['rational','interval']){
  prove([state('s',action('tiny',terminal('1/'+d),terminal((d-1n)+'/'+d,'loss')),action('zero',terminal(0),terminal(1,'explicitNoResult')))],arithmetic);
  prove([state('s',action('one',terminal(1),terminal(0,'loss')))],arithmetic);
 }
 for(const exponent of [30,309]){
  const d=10n**BigInt(exponent),r=solve(fixture([state('s',action('near',to((d-1n)+'/'+d,'s'),terminal('1/'+d)))]));
  assert.equal(r.root.status,'unavailable');assert.match(r.root.reason,/termination-witness-not-verified|nonfinite-numerical-candidate|interval-overflow/);assert.equal(r.root.outcomes,undefined);
 }
});

test('async invocation isolation preserves rational budgets, precise admission and cancellation',async()=>{
 const f=fixture([state('s',action('end',terminal('1/1048576'),terminal('1048575/1048576','loss')))]);
 const [tight,wide]=await Promise.all([M.ngMdpSolveAsync(f.model,f.request,{algorithm:'certified',maxRationalBits:16}),M.ngMdpSolveAsync(f.model,f.request,{algorithm:'certified',maxRationalBits:4096})]);
 assert.equal(tight.root.status,'unavailable');assert.match(tight.root.reason,/rational.*budget/);assert.equal(wide.root.status,'bounded',wide.root.reason);
 const precise=fixture(f.model.states,{precision:{absoluteProbabilityError:Number.EPSILON,policyRegret:.1}});assert.match(solve(precise).root.reason,/requested-precision-not-certified/);
 const states=Array.from({length:260},(_,i)=>state('s'+i,action('end',i===259?terminal(1):to(1,'s'+(i+1))))),large=fixture(states);let cancel=false;
 const work=M.ngMdpSolveAsync(large.model,large.request,{algorithm:'certified',cancelled:()=>cancel});cancel=true;const r=await work;assert.equal(r.root.status,'unavailable');assert.equal(r.root.outcomes,undefined);assert.match(r.root.reason,/cancelled/);
});

