import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {ngStudyCreateBridge,ngStudyPrepareUnion} from '../neural/src/study-native-bridge.src.js';
const root=fileURLToPath(new URL('../neural/src/',import.meta.url));
const files=['mdp-identity.src.js','mdp-model.src.js','mdp-adapter.src.js','knowledge-profile.src.js','mdp-certified.src.js'];
const text=f=>readFileSync(root+f,'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
const M=new Function('module','require',text(files[0])+'\n'+text(files[1])+'\nconst core=module.exports;\n'+text(files[2])+'\nreturn {...core,...module.exports};')({exports:{}},createRequire(root+files[1]));
const K=await import('data:text/javascript;base64,'+Buffer.from(text(files[3])).toString('base64'));
const S=id=>({nodeId:id,role:'top',phase:'user',moveCount:0,arrivalAge:0,qMod:0,combo:0,positionKey:id+'|Top',panicKey:null});
function setup(overrides={}) {
 const profile=K.ngKnowledgeBuildProfile({prep:{},sharp:{}}),registration={modelHash:'model',mechanicsHash:'mechanics',graphHash:'graph',opponentPolicyHash:'opponent',ruleset:'gi'};
 const state={id:'logical-study-context',snapshot:S('A'),aiSkill:0,challenge:null,host:{instanceId:'isolated-study',revision:1}};
 const request={apiVersion:2,requestId:'baseline',revision:1,...registration,profileHash:profile.fingerprint,state,objective:M.NG_MDP_OBJECTIVE,futureStudyPolicy:'no-additional-study-events',horizon:{kind:'actual-roll',moveCount:0,episodeCap:4}};
 const distribution=[{stateId:'logical-A',probability:'1/3'},{stateId:'logical-B',probability:'2/3'}];
 const config={state,context:{horizon:request.horizon,objective:request.objective,futureStudyPolicy:request.futureStudyPolicy},runtime:{deckReady:{'A|Top':true}},registration,admission:{metadataHash:'admitted-metadata',lawHashes:{adapter:'a',knowledge:'k'}},starts:[{stateId:'logical-A',snapshot:S('A')},{stateId:'logical-B',snapshot:S('B')}],limits:{maxStates:32,maxBranches:128,maxWorkStates:64,maxWorkBranches:256,maxMilliseconds:3000}};
 let solveCalls=0,fixedCalls=0,expands=0,lastModel,lastRequest;
 const deps={identity:M,math:M,fingerprint:K.ngKnowledgeFingerprint,isCurrent:()=>true,
 createAdapter:p=>({normalize:s=>copy(s),stateId:s=>M.ngMdpStateId(s),enumerate(s){const id=M.ngMdpStateId(s);const branch=(probability,node)=>({probability,next:S(node)});let actions;
 if(s.nodeId==='A')actions=[{id:'safe',branches:[{probability:'1/2',terminal:'win'},{probability:'1/2',terminal:'loss'}]},{id:'better',branches:[{probability:p.permanent['A|Top']?'7/8':'3/4',terminal:'win'},branch(p.permanent['A|Top']?'1/8':'1/4','C')]}];
 else if(s.nodeId==='B')actions=[{id:'go',branches:[branch('1/2','A'),{probability:'1/2',terminal:'loss'}]}];
 else actions=[{id:'stay',branches:[branch('1','C')]}];return{id,snapshot:copy(s),actions};}}),
 expandAsync:async(...args)=>{expands++;return M.ngMdpExpand(...args);},
 solve:async(model,req,limits)=>{solveCalls++;lastModel=model;lastRequest=req;return M.ngMdpSolve(model,req,limits);},
 evaluateFixed:async(...args)=>{fixedCalls++;return M.ngMdpEvaluatePolicy(...args);},
 exposure:async({binding,startDistributionHash,labels,admission})=>({status:'ready',stamp:M.ngMdpEnvelope(binding.request),policyId:binding.evaluation.root.policyId,startDistributionHash,records:labels.map(l=>({...l,status:'ready',kind:'hitting-probability',value:1,exact:'1/1',exactZero:false,roundedToZero:false})),provenance:{kind:'evaluated-policy',policyId:binding.evaluation.root.policyId,contractHash:M.ngMdpContractHash(binding.request),startDistributionHash,behaviorCompression:false,exposureConvention:'chosen-execution-escape-input-reads-v1',labelAdmission:{kind:'admitted-native-label-replay',...admission,queryHash:M.ngMdpDigest(labels),sourceSupportHash:binding.evaluation.quality.supportHash},supportHash:binding.evaluation.quality.supportHash,kernelHash:'injected-labelled-kernel',policyHash:'injected-labelled-policy'}}),...overrides};
 const args={request,profile,startDistribution:distribution,startDistributionHash:M.ngMdpDigest(distribution),policySemantics:'reoptimized'};
 return {M,K,config,deps,args,bridge:ngStudyCreateBridge(config,deps),stats:()=>({solveCalls,fixedCalls,expands,lastModel,lastRequest})};
}
async function ready(h){const r=await h.bridge.evaluate(h.args);assert.equal(r.status,'ready',r.reason);return r;}
async function refuses(h,reason){const r=await h.bridge.evaluate(h.args);assert.equal(r.status,'unavailable');assert.match(r.reason,reason);return r;}
test('native-law union, solve and independent fixed evaluation match analytic distribution',async()=>{const h=setup(),r=await ready(h);assert.ok(Math.abs(r.outcomes.win-.5)<1e-14);assert.ok(Math.abs(r.outcomes.loss-1/3)<1e-14);assert.ok(Math.abs(r.outcomes.nontermination-1/6)<1e-14);assert.equal(r.outcomes.explicitNoResult,0);assert.equal(h.stats().solveCalls,1);assert.equal(h.stats().fixedCalls,1);assert.equal(h.stats().expands,0);assert.notEqual(r.bridgeReceipt.fixedPolicyId,r.policyId);assert.equal(r.bridgeReceipt.independentSourceSupportHash,r.bridgeReceipt.supportHash);assert.notEqual(r.stamp.contractHash,r.bridgeReceipt.nativeStamp.contractHash);assert.equal(h.stats().lastModel.states.length,4);});
test('native zero-read root preserves exact masses and clocks',async()=>{const h=setup();await ready(h);const {lastModel,lastRequest}=h.stats(),root=lastModel.states.find(s=>s.id===lastRequest.state.id);assert.equal(root.actions.length,1);assert.deepEqual(root.actions[0].studyReads,[]);assert.deepEqual(root.actions[0].branches.map(b=>b.probability),['1/3','2/3']);for(const b of root.actions[0].branches){assert.equal(b.duration,0);assert.deepEqual(b.events,[]);assert.deepEqual(b.studyReads,[]);}assert.equal(lastRequest.state.snapshot.moveCount,0);});
test('joint scenario gets distinct profile snapshot and one coherent optimizing policy',async()=>{const h=setup(),base=await ready(h);const p=K.ngKnowledgeBuildProfile({prep:{'A|Top':1},sharp:{}});const r=await h.bridge.evaluate({...h.args,profile:p,request:{...h.args.request,requestId:'scenario',profileHash:p.fingerprint}});assert.equal(r.status,'ready',r.reason);assert.notEqual(r.bridgeReceipt.snapshotHash,base.bridgeReceipt.snapshotHash);assert.equal(r.stamp.profileHash,p.fingerprint);assert.ok(Math.abs(r.outcomes.win-7/12)<1e-14);assert.equal(h.stats().solveCalls,2);});
test('changed position label mapping refuses silent normalization',async()=>{const h=setup();const orig=h.deps.createAdapter;h.deps.createAdapter=p=>{const a=orig(p);return {...a,normalize:s=>({...s,positionKey:'wrong|Top'})};};await refuses(h,/start-normalization/);});
test('exact zero starts do not require an invented snapshot',async()=>{const h=setup();h.args.startDistribution.push({stateId:'zero',probability:'0/999'});h.args.startDistributionHash=M.ngMdpDigest(h.args.startDistribution);await ready(h);assert.equal(h.stats().expands,0);});
test('positive underflow is not discarded as zero',async()=>{const h=setup();h.args.startDistribution=[{stateId:'unknown',probability:'1e-400'},{stateId:'logical-A',probability:'1'}];h.args.startDistributionHash=M.ngMdpDigest(h.args.startDistribution.slice().sort((a,b)=>a.stateId<b.stateId?-1:1));await refuses(h,/non-normalized/);});
test('missing positive start refuses',async()=>{const h=setup();h.args.startDistribution[0].stateId='unknown';h.args.startDistributionHash=M.ngMdpDigest(h.args.startDistribution.slice().sort((a,b)=>a.stateId<b.stateId?-1:1));await refuses(h,/missing-positive/);});
test('duplicate start refuses',async()=>{const h=setup();h.args.startDistribution[1].stateId='logical-A';await refuses(h,/invalid-start-identity/);});
test('logical context modifications cannot be hidden in native stamp',async()=>{const h=setup();h.args.request={...h.args.request,state:{...h.args.request.state,aiSkill:.1}};await refuses(h,/context-drift/);});
test('logical snapshot transport fields rejected',async()=>{const h=setup();h.args.request={...h.args.request,state:{...h.args.request.state,snapshotId:'x'}};await refuses(h,/native-fields/);});
test('profile hash content mismatch refuses before expansion',async()=>{const h=setup();h.args.profile={...h.args.profile,day:9};await refuses(h,/fingerprint/);assert.equal(h.stats().expands,0);});
test('stale native envelope rejected',async()=>{const h=setup();const solve=h.deps.solve;h.deps.solve=async(...x)=>({...await solve(...x),profileHash:'other'});await refuses(h,/stale-native-profileHash/);});
test('missing full policy and duplicate policy rejected',async()=>{for(const kind of ['missing','duplicate']){const h=setup();const solve=h.deps.solve;h.deps.solve=async(...x)=>{const r=await solve(...x);if(kind==='missing')delete r.policy;else r.policy[1]=r.policy[0];return r;};await refuses(h,/policy/);}});
test('unselected-action support mutation rejected',async()=>{const h=setup();const solve=h.deps.solve;h.deps.solve=async(...x)=>{const r=await solve(...x);r.quality.supportHash='other';return r;};await refuses(h,/support/);});
test('selected-policy mutation rejected',async()=>{const h=setup();const solve=h.deps.solve;h.deps.solve=async(...x)=>{const r=await solve(...x);r.root.selectedActionId='other';return r;};await refuses(h,/selected-policy/);});
test('independent common-policy disagreement rejected',async()=>{const h=setup();const fixed=h.deps.evaluateFixed;h.deps.evaluateFixed=async(...x)=>{const r=await fixed(...x);r.root.outcomes={win:1,loss:0,explicitNoResult:0,nontermination:0};return r;};await refuses(h,/independent-policy-disagreement/);});
test('unknown numeric certification rejected',async()=>{const h=setup();const solve=h.deps.solve;h.deps.solve=async(...x)=>{const r=await solve(...x);r.quality.numericalStatus='checked-float';return r;};await refuses(h,/unsupported-value-quality/);});
test('unrecognized fixed certified discriminator is refused',async()=>{const h=setup();const fixed=h.deps.evaluateFixed;h.deps.evaluateFixed=async(...x)=>{const r=await fixed(...x);r.quality.numericalStatus='certified';return r;};await refuses(h,/unsupported-fixed-certificate/);});
test('freshness checked after pending solve',async()=>{let current=true;const h=setup({isCurrent:()=>current});const solve=h.deps.solve;h.deps.solve=async(...x)=>{const r=await solve(...x);current=false;return r;};await refuses(h,/stale-study/);});
test('cumulative expansion budget refuses no truncation',async()=>{const h=setup();h.config.limits.maxWorkStates=2;h.bridge=ngStudyCreateBridge(h.config,h.deps);await refuses(h,/budget/);assert.equal(h.stats().solveCalls,0);});
test('cancellation propagates between literal union states',async()=>{let cancel=false;const h=setup({cancelled:()=>cancel}),create=h.deps.createAdapter;h.deps.createAdapter=p=>{const a=create(p);return {...a,enumerate(...args){const r=a.enumerate(...args);cancel=true;return r;}};};await refuses(h,/cancelled/);assert.equal(h.stats().solveCalls,0);});
test('exposure retains separate native and logical provenance and rejects missing/forged binding',async()=>{const h=setup(),r=await ready(h),args={...h.args,policyId:r.policyId,deckKeys:[{deckKey:'A|Top',role:'Top'}]};const good=await h.bridge.exposure(args);assert.equal(good.status,'ready',good.reason);assert.equal(good.stamp.contractHash,r.stamp.contractHash);assert.equal(good.bridgeReceipt.nativeExposureStamp.contractHash,r.bridgeReceipt.nativeStamp.contractHash);assert.notEqual(good.stamp.contractHash,good.bridgeReceipt.nativeExposureStamp.contractHash);const orig=h.deps.exposure;h.deps.exposure=async(...x)=>{const v=await orig(...x);v.provenance.supportHash='bad';return v;};assert.equal((await h.bridge.exposure(args)).reason,'missing-exposure-binding');h.bridge.clear();assert.equal((await h.bridge.exposure(args)).reason,'missing-bound-baseline-policy');});
test('whole joint exposure refuses a missing role and rounded positive zero',async()=>{for(const kind of ['missing','underflow','unprovedZero']){const h=setup(),r=await ready(h),orig=h.deps.exposure;h.deps.exposure=async(...x)=>{const v=await orig(...x);if(kind==='missing')v.records=[];else{v.records[0].value=0;v.records[0].roundedToZero=kind==='underflow';}return v;};const v=await h.bridge.exposure({...h.args,policyId:r.policyId,deckKeys:[{deckKey:'A|Top',role:'Top'}]});assert.equal(v.status,'unavailable');}});
test('actual gameplay adapter on complete two-role no-choice kernel stays literal',async()=>{const h=setup();const graph={version:1,ruleset:'gi',coverage:{status:'COMPLETE'},nodes:[{id:'A',t:'A',ty:'positions',role:'top',deckKey:'A|Top',dom:0},{id:'B',t:'B',ty:'positions',role:'top',deckKey:'B|Top',dom:0}],canonical:{},hands:{[M.ngMdpStable(['A','top'])]:[],[M.ngMdpStable(['B','top'])]:[]},evHands:{},destinations:{},deckReady:{}};h.deps.createAdapter=(p,runtime)=>M.ngMdpCreateGameAdapter(graph,p,K,runtime);const r=await ready(h);assert.equal(r.outcomes.explicitNoResult,1);assert.equal(r.outcomes.win,0);});
test('finite horizon cannot drift within a bridge',async()=>{const h=setup();h.args.request={...h.args.request,horizon:{...h.args.request.horizon,episodeCap:8}};await refuses(h,/context-drift:horizon/);});
test('normalized positive underflow still requires its exact start',async()=>{const h=setup(),den=10n**400n;h.args.startDistribution=[{stateId:'missing',probability:'1/'+den},{stateId:'logical-A',probability:(den-1n)+'/'+den}];h.args.startDistributionHash=M.ngMdpDigest(h.args.startDistribution.slice().sort((a,b)=>a.stateId<b.stateId?-1:1));await refuses(h,/missing-positive-start/);});
test('local rational budget rejects exponent before native parse',async()=>{const h=setup();h.config.limits.maxRationalBits=64;h.bridge=ngStudyCreateBridge(h.config,h.deps);h.args.startDistribution=[{stateId:'logical-A',probability:'1e-400'}];await refuses(h,/rational-preparse-budget/);});
test('changed label admission refused despite identical support and terminal values',async()=>{const h=setup(),r=await ready(h),orig=h.deps.exposure;h.deps.exposure=async(...x)=>{const v=await orig(...x);v.provenance.labelAdmission.lawHashes={adapter:'different',knowledge:'k'};return v;};const v=await h.bridge.exposure({...h.args,policyId:r.policyId,deckKeys:[{deckKey:'A|Top',role:'Top'}]});assert.equal(v.reason,'unadmitted-exposure-labels');});
test('actual certified optimizer plus exact independent evaluation retain unresolved secondary status',async()=>{for(const certificateArithmetic of ['exact','interval']){const h=setup();h.deps.solve=async(model,request,limits)=>M.ngMdpSolve(model,request,{...limits,algorithm:'certified',certificateArithmetic:certificateArithmetic==='interval'?'interval':undefined});const r=await ready(h);assert.equal(r.quality.numericalStatus,'certified');assert.equal(r.quality.secondaryStatus,'unresolved-primary-ties');assert.ok(r.winBounds[0]<=.5&&r.winBounds[1]>=.5);assert.ok(r.bridgeReceipt.nativeValueDiagnostics.certificate.startsWith(certificateArithmetic==='interval'?'outward-interval':'exact-rational'));}});
test('native requested-action receipt cannot be omitted',async()=>{const h=setup(),solve=h.deps.solve;h.deps.solve=async(...x)=>{const r=await solve(...x);r.actions=[];return r;};await refuses(h,/native-action-receipt/);});
test('clearing during pending evaluation rejects publication and artifact retention',async()=>{const h=setup(),solve=h.deps.solve;h.deps.solve=async(...x)=>{const r=await solve(...x);h.bridge.clear();return r;};await refuses(h,/cleared-study/);});
test('baseline preflight can supply declared exposure policy without a second solve',async()=>{const h=setup(),a=await ready(h),b=await ready(h);assert.equal(a,b);assert.equal(h.stats().solveCalls,1);});
test('many overlapping positive starts enumerate each unique physical state once',async()=>{
 const h=setup(),count=new Map(),n=24;h.config.starts=Array.from({length:n},(_,i)=>({stateId:'logical-'+i,snapshot:S('P'+i)}));h.config.limits.maxWorkStates=n+1;h.config.limits.maxStates=n+2;
 h.args.startDistribution=h.config.starts.map(r=>({stateId:r.stateId,probability:'1/'+n}));h.args.startDistributionHash=M.ngMdpDigest(h.args.startDistribution.slice().sort((a,b)=>a.stateId<b.stateId?-1:1));
 h.deps.createAdapter=()=>({normalize:s=>copy(s),stateId:s=>M.ngMdpStateId(s),enumerate(s){count.set(s.nodeId,(count.get(s.nodeId)||0)+1);return{id:M.ngMdpStateId(s),snapshot:copy(s),actions:[{id:'only',branches:s.nodeId==='C'?[{probability:1,terminal:'win'}]:[{probability:1,next:S('C'),duration:2,events:['unchanged-event']}]}]};}});
 h.bridge=ngStudyCreateBridge(h.config,h.deps);const r=await ready(h);assert.equal(r.outcomes.win,1);assert.equal(count.size,n+1);assert.ok([...count.values()].every(v=>v===1));assert.equal(h.stats().expands,0);
 const physical=h.stats().lastModel.states.find(s=>s.id===M.ngMdpStateId(S('P0')));assert.equal(physical.actions[0].branches[0].duration,2);assert.deepEqual(physical.actions[0].branches[0].events,['unchanged-event']);
});
test('frozen labelled native enumeration is copied without law or label mutation',async()=>{
 const h=setup(),create=h.deps.createAdapter,emitted=[];const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 h.deps.createAdapter=p=>{const a=create(p);return {...a,enumerate(...args){const r=a.enumerate(...args);r.actions[0].studyReads=[{kind:'execution',labels:[{deckKey:'A|Top',role:'Top'}]}];freeze(r);emitted.push({r,before:JSON.stringify(r)});return r;}};};await ready(h);for(const {r,before}of emitted){assert.equal(JSON.stringify(r),before);assert.ok(r.snapshot);}
});
test('boolean cancellation during full-support rehash is enforced without requiring throw',async()=>{
 const h=setup();await ready(h);const {lastModel,lastRequest}=h.stats(),result=M.ngMdpSolve(lastModel,lastRequest,{includePolicy:true});
 const fn=new Function(readFileSync(new URL('../neural/src/study-native-bridge.src.js',import.meta.url),'utf8').replace(/^export /gm,'')+';return nativeBinding;')();let checks=0;
 await assert.rejects(()=>fn(lastModel,lastRequest,result,M,M,{...h.config.limits,cancelled:()=>++checks===5}),/cancelled/);assert.equal(checks,5);
});
test('union physical transition rows match unchanged per-root native expansion',async()=>{
 const h=setup();await ready(h);const full=new Map(h.stats().lastModel.states.map(s=>[s.id,s]));
 for(const start of h.config.starts){const request={...h.args.request,state:{...h.args.request.state,id:M.ngMdpStateId(start.snapshot),snapshot:start.snapshot}};
 const one=M.ngMdpExpand(h.deps.createAdapter(h.args.profile),request,{...h.config.limits,behaviorCompression:false});for(const state of one.states)assert.deepEqual(full.get(state.id),state);}
});

// Exercise the delivered independent fixed evaluator, not synthetic certificates.
const E=createRequire(import.meta.url)('../neural/src/mdp-exposure.src.js');
test('delivered sparse exact and certified fixed evaluators admit separate full receipts',async()=>{
 for(const algorithm of ['exact-sparse','certified']){
  const h=setup();h.deps.evaluateFixed=(model,request,policy,limits)=>E.ngMdpEvaluateFixedPolicyAsync(model,request,policy,{identity:M,math:M},{...limits,algorithm});
  const r=await ready(h);assert.equal(r.bridgeReceipt.nativeValueQuality.numericalStatus,'exact-rational');
  assert.equal(r.quality.numericalStatus,algorithm==='certified'?'certified':'exact-rational');
  assert.equal(r.bridgeReceipt.independentQuality.supportHash,r.bridgeReceipt.supportHash);
  assert.equal(r.bridgeReceipt.independentDiagnostics.algorithm,'fixed-policy-sparse-scc-v1');
  assert.equal(r.bridgeReceipt.independentDiagnostics.certificate,algorithm==='certified'?'outward-interval-fixed-policy-drift-v1':'exact-rational-sparse-fixed-policy-v1');
  assert.ok(r.winBounds[0]<=.5&&r.winBounds[1]>=.5);assert.equal(r.quality.policyRegretBound,0);
 }
});
test('automatic fixed certification above 64 transient states is visible with exact optimization',async()=>{
 const h=setup(),n=65;h.config.limits={...h.config.limits,maxStates:70,maxBranches:150,maxWorkStates:70,maxWorkBranches:150};
 h.config.starts=[{stateId:'logical-A',snapshot:S('P0')}];h.args.startDistribution=[{stateId:'logical-A',probability:1}];h.args.startDistributionHash=M.ngMdpDigest(h.args.startDistribution);
 h.deps.createAdapter=()=>({normalize:s=>copy(s),stateId:M.ngMdpStateId,enumerate(s){const at=+s.nodeId.slice(1);return{id:M.ngMdpStateId(s),actions:[{id:'go',branches:at===n-1?[{probability:1,terminal:'win'}]:[{probability:1,next:S('P'+(at+1))}]}]};}});
 h.deps.evaluateFixed=(model,request,policy,limits)=>E.ngMdpEvaluateFixedPolicyAsync(model,request,policy,{identity:M,math:M},limits);
 h.bridge=ngStudyCreateBridge(h.config,h.deps);const r=await ready(h);
 assert.equal(r.bridgeReceipt.nativeValueQuality.numericalStatus,'exact-rational');assert.equal(r.bridgeReceipt.independentQuality.numericalStatus,'certified-fixed-policy');assert.equal(r.quality.numericalStatus,'certified');assert.equal(r.outcomes.win,1);
});
test('fixed certificate support, root, discriminator and enclosures each fail closed',async()=>{
 const mutations=[
  [r=>{r.quality.supportHash='wrong';},/stale-fixed-support/],
  [r=>{r.root.stateId='wrong';},/stale-fixed-policy/],
  [r=>{r.diagnostics.certificate='residual-only';},/unsupported-fixed-certificate/],
  [r=>{r.quality.numericalStatus='certified';},/unsupported-fixed-certificate/],
  [r=>{delete r.root.outcomeBounds;},/missing-fixed-enclosures/],
  [r=>{r.quality.coordinateErrorBound=.01;},/fixed-coordinate-precision/],
 ];
 for(const [mutate,reason]of mutations){const h=setup();h.deps.evaluateFixed=async(model,request,policy,limits)=>{const r=copy(await E.ngMdpEvaluateFixedPolicyAsync(model,request,policy,{identity:M,math:M},{...limits,algorithm:'certified'}));mutate(r);return r;};await refuses(h,reason);}
});
test('sequential scenario release keeps baseline exposure and all immutable receipts beyond cache capacity',async()=>{
 const h=setup();h.config.limits.maxCacheEntries=2;h.bridge=ngStudyCreateBridge(h.config,h.deps);const baseline=await ready(h),saved=JSON.stringify(baseline),receipts=[];
 for(let i=1;i<=12;i++){
  const profile=K.ngKnowledgeBuildProfile({prep:{['Other'+i+'|Top']:1},sharp:{}}),args={...h.args,profile,request:{...h.args.request,requestId:'scenario-'+i,profileHash:profile.fingerprint}};
  const r=await h.bridge.evaluate(args);assert.equal(r.status,'ready',r.reason);receipts.push(r);
  assert.equal(h.bridge.release(args),true);assert.equal(h.bridge.release(args),false);
  const exposure=await h.bridge.exposure({...h.args,policyId:baseline.policyId,deckKeys:[{deckKey:'A|Top',role:'Top'}]});assert.equal(exposure.status,'ready',exposure.reason);
 }
 assert.equal(h.stats().solveCalls,13);assert.equal(await ready(h),baseline);assert.equal(JSON.stringify(baseline),saved);assert.equal(receipts.length,12);assert.ok(receipts.every(r=>Object.isFrozen(r)&&r.bridgeReceipt.independentSourceSupportHash));
 assert.throws(()=>h.bridge.release({...h.args,profile:{...h.args.profile,fingerprint:'wrong'}}),/stale-profile/);
 assert.equal(await ready(h),baseline);
});

test('bridge total deadline does not replace independent native stage deadlines',async()=>{
 const h=setup();h.config.limits={...h.config.limits,maxMilliseconds:60000,maxPrepareMilliseconds:10000,maxSolveMilliseconds:15000,maxFixedMilliseconds:14000,maxExposureMilliseconds:13000};
 const solve=h.deps.solve,fixed=h.deps.evaluateFixed,exposure=h.deps.exposure,seen={};
 h.deps.solve=(model,request,limits)=>{seen.solve=limits.maxMilliseconds;return solve(model,request,limits);};
 h.deps.evaluateFixed=(model,request,policy,limits)=>{seen.fixed=limits.maxMilliseconds;return fixed(model,request,policy,limits);};
 h.deps.exposure=(args,limits)=>{seen.exposure=limits.maxMilliseconds;return exposure(args,limits);};
 h.bridge=ngStudyCreateBridge(h.config,h.deps);const r=await ready(h);
 assert.equal((await h.bridge.exposure({...h.args,policyId:r.policyId,deckKeys:[{deckKey:'A|Top',role:'Top'}]})).status,'ready');
 assert.deepEqual(seen,{solve:15000,fixed:14000,exposure:13000});
 assert.throws(()=>ngStudyCreateBridge({...h.config,limits:{...h.config.limits,maxPrepareMilliseconds:60001}},h.deps),/invalid-budget:maxPrepareMilliseconds/);
});

test('probability memo eviction preserves every exact branch and raw spelling',async()=>{
 const h=setup(),snapshot=S('Only'),stateId=M.ngMdpStateId(snapshot),actions=Array.from({length:2100},(_,i)=>({id:'a'+i,branches:[{probability:'1/'+(i+3),terminal:'win'},{probability:(i+2)+'/'+(i+3),terminal:'loss'}]}));
 const request={...h.args.request,state:{...h.args.request.state,id:stateId,snapshot}};
 const input={request,profile:h.args.profile,runtime:{deckReady:{}},startDistribution:[{stateId,probability:1}],startSnapshots:[{stateId,snapshot}]};
 const deps={identity:M,math:M,createAdapter:()=>({normalize:s=>copy(s),stateId:M.ngMdpStateId,enumerate:()=>({id:stateId,actions:copy(actions)})})};
 const result=await ngStudyPrepareUnion(input,deps,{maxStates:2,maxWorkStates:1,maxBranches:5000,maxWorkBranches:4999});
 assert.deepEqual(result.model.states.find(s=>s.id===stateId).actions,actions);assert.equal(result.coverage.workBranches,4200);
 await assert.rejects(ngStudyPrepareUnion(input,deps,{maxStates:2,maxWorkStates:1,maxBranches:5000,maxWorkBranches:4999,maxRationalBits:8}),/rational/);
});


test('prepared release hook keeps successful baseline until explicit release or clear',async()=>{
 const released=[],h=setup({releasePreparedModel:model=>released.push(model)});await ready(h);
 const first=h.stats().lastModel;assert.deepEqual(released,[]);assert.equal(h.bridge.release(h.args),true);assert.deepEqual(released,[first]);
 assert.equal(h.bridge.release(h.args),false);await ready(h);const second=h.stats().lastModel;assert.notEqual(first,second);
 h.bridge.clear();assert.deepEqual(released,[first,second]);h.bridge.clear();assert.equal(released.length,2);
});
test('post-fixed receipt rejection releases the exact prepared model',async()=>{
 const released=[],h=setup({releasePreparedModel:model=>released.push(model)}),fixed=h.deps.evaluateFixed;
 h.deps.evaluateFixed=async(...args)=>{const result=await fixed(...args);result.root.stateId='wrong-root';return result;};
 await refuses(h,/stale-fixed-policy/);assert.equal(released.length,1);assert.equal(released[0],h.stats().lastModel);assert.equal(h.bridge.release(h.args),false);
});
test('clear during pending fixed releases late prepared result without retaining it',async()=>{
 const released=[],h=setup({releasePreparedModel:model=>released.push(model)}),fixed=h.deps.evaluateFixed;
 h.deps.evaluateFixed=async(...args)=>{const result=await fixed(...args);h.bridge.clear();return result;};
 await refuses(h,/cleared-study/);assert.deepEqual(released,[h.stats().lastModel]);assert.equal(h.bridge.release(h.args),false);
});
test('clear revokes baseline and scenario and attempts every cleanup after a hook error',async()=>{
 const released=[],h=setup({releasePreparedModel:model=>{released.push(model);if(released.length===1)throw new Error('fixture-cleanup');}});
 await ready(h);const base=h.stats().lastModel,p=K.ngKnowledgeBuildProfile({prep:{'Other|Top':1},sharp:{}});
 const args={...h.args,profile:p,request:{...h.args.request,requestId:'scenario',profileHash:p.fingerprint}};
 assert.equal((await h.bridge.evaluate(args)).status,'ready');const scenario=h.stats().lastModel;
 assert.throws(()=>h.bridge.clear(),/fixture-cleanup/);assert.deepEqual(released,[base,scenario]);assert.equal(h.bridge.release(h.args),false);assert.equal(h.bridge.release(args),false);
});
test('failed prepare without an owned model cannot invoke the release hook',async()=>{
 const released=[],h=setup({releasePreparedModel:model=>released.push(model)});h.args.request={...h.args.request,state:{...h.args.request.state,aiSkill:.5}};
 await refuses(h,/context-drift/);assert.deepEqual(released,[]);
});
