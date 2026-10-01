// Proposal only. Native computation and source admission are injected; no live client.
const OUT = ['win','loss','explicitNoResult','nontermination'];
const STAGES=['maxPrepareMilliseconds','maxSolveMilliseconds','maxFixedMilliseconds','maxExposureMilliseconds'];
function stageBudget(b,key){const value={...b,maxMilliseconds:b[key]};for(const stage of STAGES)delete value[stage];return value;}
const CERTS = ['exact-rational-all-action-drift+common-policy-residual+Bellman-supersolution','outward-interval-all-action-drift+common-policy-residual+Bellman-supersolution'];
const need = (ok, why) => { if (!ok) throw new Error(why); };
const clone = x => JSON.parse(JSON.stringify(x));
function freeze(x) { if(x && typeof x==='object') {Object.values(x).forEach(freeze);Object.freeze(x);}return x; }
const cmp = (a,b) => { const n=a[0]*b[1]-b[0]*a[1];return n<0n?-1:n>0n?1:0; };
function next(x,up) { if(x===0)return up?Number.MIN_VALUE:-Number.MIN_VALUE;const d=new DataView(new ArrayBuffer(8));d.setFloat64(0,x);d.setBigUint64(0,d.getBigUint64(0)+((x>0)===up?1n:-1n));return d.getFloat64(0); }
const low = (v,e) => e===0?v:Math.max(0,next(v-e,false));
const high = (v,e) => e===0?v:Math.min(1,next(v+e,true));
const scalar = x => Number.isFinite(x)&&x>=0&&x<=1;
function budget(options={}) {
 const b={maxStarts:32,maxStates:20000,maxBranches:200000,maxWorkStates:40000,maxWorkBranches:400000,maxMilliseconds:15000,maxRationalBits:4096,maxCacheEntries:8,...options};
 for(const k of ['maxStarts','maxStates','maxBranches','maxWorkStates','maxWorkBranches','maxMilliseconds','maxRationalBits','maxCacheEntries'])need(Number.isSafeInteger(b[k])&&b[k]>0,'invalid-budget:'+k);
 for(const k of STAGES){if(b[k]==null)b[k]=b.maxMilliseconds;need(Number.isSafeInteger(b[k])&&b[k]>0&&b[k]<=b.maxMilliseconds,'invalid-budget:'+k);}
 return b;
}
function arithmetic(math,b) {
 const bits=r=>{need(r[0].toString(2).length+r[1].toString(2).length<=b.maxRationalBits,'rational-budget');return r;};
 return {p(x){need((typeof x==='string'&&x.length<=Math.min(1024,b.maxRationalBits))||(typeof x==='number'&&Number.isFinite(x)),'invalid-probability');const text=String(x),exp=/e([+-]?\d+)$/i.exec(text);if(exp)need(Number.isSafeInteger(+exp[1])&&Math.abs(+exp[1])<=Math.floor(b.maxRationalBits/Math.log2(10)),'rational-preparse-budget');const p=bits(math.ngMdpRat(x));need(p[0]>=0n&&p[0]<=p[1],'invalid-probability');return p;},add(a,c){return bits(math.ngMdpAdd(a,c));}};
}
function starts(input,M,A,b) {
 need(Array.isArray(input)&&input.length>0&&input.length<=b.maxStarts,'invalid-start-distribution');const seen=new Set();let mass=[0n,1n];
 const rows=input.map(r=>{need(r&&typeof r.stateId==='string'&&r.stateId&&!seen.has(r.stateId),'invalid-start-identity');seen.add(r.stateId);const p=A.p(r.probability);mass=A.add(mass,p);return {...clone(r),p};});
 need(cmp(mass,[1n,1n])===0,'non-normalized-start-distribution');return {rows,hash:M.ngMdpDigest(input.slice().sort((a,b)=>a.stateId<b.stateId?-1:1))};
}
function guard(deps,request,b) {const began=Date.now();return()=>{need(!(deps.cancelled&&deps.cancelled())&&!(b.cancelled&&b.cancelled()),'cancelled');need(Date.now()-began<=b.maxMilliseconds,'study-time-budget');need(!deps.isCurrent||deps.isCurrent(request),'stale-study');};}
function envelope(M,request,reply) {need(reply&&typeof reply==='object','missing-native-receipt');for(const [k,v]of Object.entries(M.ngMdpEnvelope(request)))need(M.ngMdpStable(reply[k])===M.ngMdpStable(v),'stale-native-'+k);}
function vector(v) {need(v&&OUT.every(k=>scalar(v[k]))&&Math.abs(OUT.reduce((s,k)=>s+v[k],0)-1)<=1e-12,'invalid-common-policy-vector');}
function bounds(record,quality) {
 vector(record.outcomes);const e=quality.coordinateErrorBound;need(scalar(e),'missing-coordinate-bound');const result={};
 for(const k of OUT){const v=record.outcomes[k],pair=record.outcomeBounds?.[k]||[low(v,e),high(v,e)];need(Array.isArray(pair)&&pair.length===2&&pair.every(scalar)&&pair[0]<=v&&v<=pair[1]&&v-pair[0]<=e+4*Number.EPSILON&&pair[1]-v<=e+4*Number.EPSILON,'invalid-coordinate-enclosure');result[k]=pair.slice();}
 return result;
}
async function nativeBinding(model,request,result,M,math,b) {
 envelope(M,request,result);need(['ready','bounded'].includes(result.root?.status)&&result.root.stateId===request.state.id,'unavailable-native-root');
 need(model.stateEquivalence?.scope==='literal-state'&&model.stateEquivalence.exposureLabelsPreserved===true&&result.quality?.stateEquivalence?.exposureLabelsPreserved===true,'compressed-policy');
 const check=()=>need(!b.cancelled||!b.cancelled(),'cancelled');check();const kernel=math.ngMdpCompile(model,request,b);check();need(!kernel.reasons.length,'incomplete-kernel');const ids=[...kernel.states.keys()].sort(),index=new Map(ids.map((id,i)=>[id,i]));
 const hashes=[];let lastYield=Date.now();
 for(const id of ids){check();const rows=[];
  for(const action of kernel.states.get(id).actions){check();const branches=[];
   for(const r of action.branches){check();branches.push([math.ngMdpFraction(r.p),r.to?index.get(r.to):null,r.terminal||null,r.subtype||null,r.duration==null?null:r.duration,r.events||[]]);}
   rows.push([action.id,branches]);
  }
  hashes.push(M.ngMdpDigest(rows));check();
  if(Date.now()-lastYield>=8){await new Promise(resolve=>setTimeout(resolve,0));lastYield=Date.now();check();}
 }

 check();const supportHash=M.ngMdpDigest(['indexed-support-v1',ids,hashes]);check();need(result.quality.supportHash===supportHash,'stale-support');
 need(Array.isArray(result.policy)&&result.policy.length===ids.length,'missing-full-policy');const policy=new Map();
 for(const row of result.policy){check();need(Array.isArray(row)&&row.length===2&&typeof row[0]==='string'&&typeof row[1]==='string'&&!policy.has(row[0]),'invalid-policy');policy.set(...row);}
 const choices=ids.map(id=>{check();const i=kernel.states.get(id).actions.findIndex(a=>a.id===policy.get(id));need(i>=0,'illegal-policy');return i;});
 const policyId='policy:'+M.ngMdpDigest(['support-policy-v1',supportHash,choices]);need(result.root.policyId===policyId&&result.root.selectedActionId===policy.get(request.state.id),'stale-selected-policy');
 need(Array.isArray(result.actions)&&result.actions.length===request.requestedActionIds.length&&result.actions.every((a,i)=>a.actionId===request.requestedActionIds[i]&&a.stateId===request.state.id&&a.policyId===policyId&&['ready','bounded'].includes(a.status)),'invalid-native-action-receipt');
 const q=result.quality;need(['exact-rational','certified'].includes(q.numericalStatus)&&scalar(q.policyRegretBound),'unsupported-value-quality');
 if(q.numericalStatus==='certified')need(CERTS.includes(result.diagnostics?.certificate)&&recordHasBounds(result.root),'unsupported-value-certificate');
 else need(q.policyRegretBound===0,'inexact-rational-regret');
 const interval=bounds(result.root,q);return freeze({supportHash,policyId,interval,policy:[...policy].sort((a,b)=>a[0]<b[0]?-1:1)});
}
function recordHasBounds(r){return r.outcomeBounds&&OUT.every(k=>Array.isArray(r.outcomeBounds[k]))&&Array.isArray(r.winBounds);}

// One literal breadth-first traversal of the complete positive-start union.
// Enumeration remains the unchanged native adapter law. Only fresh copies are wired.
export async function ngStudyPrepareUnion(input,deps,options={}) {
 const b=budget(options),M=deps.identity,A=arithmetic(deps.math,b),check=guard(deps,input.request,b);
 const distribution=starts(input.startDistribution,M,A,b),mapping=new Map();
 need(Array.isArray(input.startSnapshots)&&input.startSnapshots.length<=b.maxStarts,'invalid-start-mapping');
 for(const row of input.startSnapshots){need(row&&typeof row.stateId==='string'&&!mapping.has(row.stateId),'duplicate-start-mapping');mapping.set(row.stateId,row.snapshot);}
 const adapter=deps.createAdapter(input.profile,input.runtime),states=new Map(),pending=[],seen=new Set(),validatedIds=new Map(),nativeStarts=[],mapped=[];
 let workStates=0,workBranches=0,lastYield=Date.now();
 // Per-call, bounded memo of already admitted scalar probabilities. Raw branch
 // spelling is retained; eviction only repeats ordinary exact parsing later.
 const probabilities=new Map();
 const probability=value=>{
  if(probabilities.has(value))return probabilities.get(value);
  const p=A.p(value);
  if(probabilities.size===4096)probabilities.delete(probabilities.keys().next().value);
  probabilities.set(value,p);return p;
 };
 const literal=(snapshot,reason)=>{
  const id=M.ngMdpStateId(snapshot);
  // A previously validated canonical serialization is the same full snapshot,
  // under this immutable request/profile. Reuse its string across branch edges.
  if(validatedIds.has(id))return validatedIds.get(id);
  const normalized=adapter.normalize(clone(snapshot),input.request);
  need(M.ngMdpStable(normalized)===id,reason);
  need(adapter.stateId(snapshot,input.request)===id&&M.ngMdpStateId(JSON.parse(id))===id,'nonliteral-state-id');
  validatedIds.set(id,id);return id;
 };
 const enqueue=(snapshot,id)=>{
  if(seen.has(id))return;
  // One additional state is reserved for the distribution root, which is never
  // sent through a physical normalizer or enumerator.
  need(seen.size+2<=b.maxStates,'union-state-budget');
  need(seen.size+1<=b.maxWorkStates,'union-work-state-budget');
  seen.add(id);pending.push({id,snapshot:clone(snapshot)});
 };
 const positiveIds=new Set();
 for(const row of distribution.rows){check();if(!row.p[0])continue;
  const snapshot=mapping.get(row.stateId);need(snapshot,'missing-positive-start');
  const id=literal(snapshot,'start-normalization-changed');
  if(input.request.horizon.kind==='actual-roll')need(snapshot.moveCount===input.request.horizon.moveCount,'stale-root-move-count');
  need(!positiveIds.has(id),'aliased-positive-starts');positiveIds.add(id);
  enqueue(snapshot,id);
  nativeStarts.push({stateId:id,probability:deps.math.ngMdpFraction(row.p)});
  mapped.push({logicalStateId:row.stateId,nativeStateId:id,probability:deps.math.ngMdpFraction(row.p),snapshot:clone(snapshot)});
 }
 need(nativeStarts.length>0,'no-positive-starts');
 need(nativeStarts.length<=b.maxBranches,'union-branch-budget');
 for(let at=0;at<pending.length;at++){
  check();const {id,snapshot}=pending[at];
  // Keep root-independent AI/challenge/runtime context fixed for the full union.
  // The physical snapshot argument is authoritative for per-state mechanics.
  const raw=adapter.enumerate(snapshot,input.request);check();workStates++;
  need(raw&&raw.id===id&&Array.isArray(raw.actions)&&raw.status!=='unavailable','invalid-enumerated-state');
  // Validate/count before copying; never mutate an adapter's frozen labelled rows.
  for(const action of raw.actions){
   check();need(Array.isArray(action.branches),'incomplete-union-action');
   for(const branch of action.branches){check();workBranches++;
    need(workBranches<=b.maxWorkBranches,'union-work-branch-budget');
    need(workBranches+nativeStarts.length<=b.maxBranches,'union-branch-budget');probability(branch.probability);
   }
  }
  const state=clone(raw);state.id=id;delete state.snapshot;
  for(const action of state.actions){let mass=[0n,1n];
   for(const branch of action.branches){check();const p=probability(branch.probability);mass=A.add(mass,p);
    if(branch.next!=null){
     need(!branch.to&&!branch.terminal,'ambiguous-native-destination');
     const nextId=literal(branch.next,'future-normalization-changed');
     branch.to=nextId;
     if(p[0])enqueue(branch.next,nextId);
     delete branch.next;
    }else if(branch.to){
     // Native enumeration must supply literal next snapshots. A prewired ID
     // cannot smuggle in a missing/normalized/compressed state.
     throw new Error('prewired-native-destination');
    }
    need((!!branch.to)!=(!!branch.terminal),'invalid-native-destination');
   }
   need(cmp(mass,[1n,1n])===0,'non-normalized-union-action');
  }
  states.set(id,state);
  if(Date.now()-lastYield>=8){await new Promise(resolve=>setTimeout(resolve,0));lastYield=Date.now();check();}
 }
 check();let rootId='study-distribution:'+M.ngMdpDigest(nativeStarts);while(states.has(rootId))rootId+=':root';
 const actionId='study-distribution-action:'+M.ngMdpDigest(nativeStarts);
 states.set(rootId,{id:rootId,actions:[{id:actionId,kind:'forced',studyReads:[],branches:nativeStarts.map(r=>({to:r.stateId,probability:r.probability,duration:0,events:[],studyReads:[]}))}]});
 const request={...clone(input.request),state:{...clone(input.request.state),id:rootId},requestedActionIds:[actionId]};delete request.contractHash;
 const model={apiVersion:2,states:[...states.values()],contractHash:M.ngMdpContractHash(request),stateEquivalence:{scope:'literal-state',rootIdentityPreserved:true,exposureLabelsPreserved:true,futureExplanationLabelsPreserved:true,replayLabelsPreserved:true,profileConditional:true,residencyConditional:true}};
 for(const k of ['modelHash','mechanicsHash','graphHash','profileHash','opponentPolicyHash','ruleset'])model[k]=request[k];
 check();const kernel=deps.math.ngMdpCompile(model,request,b);check();need(!kernel.reasons.length,'incomplete-union');
 return freeze({request,model,startDistribution:nativeStarts,startDistributionHash:starts(nativeStarts,M,A,b).hash,mapping:mapped,coverage:{workStates,workBranches,states:states.size,branches:workBranches+nativeStarts.length},distributionActionId:actionId});
}

export function ngStudyCreateBridge(configuration,deps) {
 const config=freeze(clone(configuration)),b=budget(config.limits),M=deps.identity,math=deps.math,A=arithmetic(math,b),cache=new Map();let generation=0;
 need(M&&math&&typeof deps.fingerprint==='function','missing-native-dependencies');
 for(const key of ['metadataHash','lawHashes'])need(config.admission?.[key],'missing-source-admission:'+key);
 const eq=(a,c)=>M.ngMdpStable(a)===M.ngMdpStable(c);
 function context(args){
  const request=clone(args.request),profile=clone(args.profile);need(!('snapshotId'in request.state)&&!('snapshotHash'in request.state),'native-fields-in-logical-state');need(eq(request.state,config.state),'logical-context-drift');
  for(const key of ['horizon','objective','futureStudyPolicy'])need(config.context&&eq(request[key],config.context[key]),'logical-context-drift:'+key);
  need(request.requestedActionIds==null,'logical-action-filter-not-supported');
  need(request.apiVersion===2&&request.objective===M.NG_MDP_OBJECTIVE&&request.futureStudyPolicy==='no-additional-study-events','unsupported-logical-contract');
  for(const [key,value]of Object.entries(config.registration))need(eq(request[key],value),'stale-registration:'+key);
  need(profile.status==='ready'&&profile.fingerprint===request.profileHash,'stale-profile');const body={...profile};delete body.fingerprint;need(deps.fingerprint(body)===profile.fingerprint,'profile-fingerprint-mismatch');
  const d=starts(args.startDistribution,M,A,b);need(d.hash===args.startDistributionHash,'stale-logical-start-hash');
  const snapshotHash=M.ngMdpDigest({profile,runtime:config.runtime});const nativeRequest={...request,state:{...request.state,snapshotId:snapshotHash,snapshotHash}};delete nativeRequest.contractHash;delete nativeRequest.requestedActionIds;
  return {request:freeze(request),profile:freeze(profile),nativeRequest:freeze(nativeRequest),distribution:d,key:M.ngMdpDigest([M.ngMdpEnvelope(request),d.hash,snapshotHash]),snapshotHash};
 }
 function lifecycle(request){const revision=generation,base=guard(deps,request,b);return()=>{base();need(revision===generation,'cleared-study');};}
 function unavailable(reason){return freeze({status:'unavailable',reason,unresolvedReasons:[reason]});}
 need(deps.releasePreparedModel==null||typeof deps.releasePreparedModel==='function','invalid-prepared-release-hook');
 function releasePrepared(prepared){if(prepared&&deps.releasePreparedModel)deps.releasePreparedModel(prepared.model);}
 async function evaluate(args){let prepared,retained=false;try{
  need(args.policySemantics==='reoptimized','wrong-policy-semantics');const c=context(args),check=lifecycle(c.request);check();
  if(cache.has(c.key))return cache.get(c.key).result;
  need(cache.size<b.maxCacheEntries,'study-artifact-budget');
  prepared=await ngStudyPrepareUnion({request:c.nativeRequest,profile:c.profile,runtime:config.runtime,startDistribution:args.startDistribution,startSnapshots:config.starts},{...deps,isCurrent:()=>{check();return true;}},stageBudget(b,'maxPrepareMilliseconds'));check();
  const stageLimits={...b,includePolicy:true,behaviorCompression:false,cancelled:()=>{check();return false;}};
  const solved=freeze(clone(await deps.solve(prepared.model,prepared.request,stageBudget(stageLimits,'maxSolveMilliseconds'))));check();
  const binding=await nativeBinding(prepared.model,prepared.request,solved,M,math,stageLimits);check();
  const fixed=freeze(clone(await deps.evaluateFixed(prepared.model,prepared.request,binding.policy,stageBudget(stageLimits,'maxFixedMilliseconds'))));check();envelope(M,prepared.request,fixed);
  const fixedId='policy:'+M.ngMdpDigest(binding.policy);need(fixed.policyId===fixedId&&fixed.root?.policyId===fixedId&&fixed.root.stateId===prepared.request.state.id&&fixed.root.status==='ready','stale-fixed-policy');
  // Admit independently evaluated parent outcomes only. Optimization regret and
  // secondary-objective status always remain the optimizer's separate evidence.
  const fq=fixed.quality,fd=fixed.diagnostics;
  const legacyExact=fq?.numericalStatus==='exact-rational'&&fd?.algorithm==='fixed-policy-rational-scc';
  const sparseExact=fq?.numericalStatus==='exact-rational'&&fd?.algorithm==='fixed-policy-sparse-scc-v1'&&fd.certificate==='exact-rational-sparse-fixed-policy-v1';
  const sparseCertified=fq?.numericalStatus==='certified-fixed-policy'&&fd?.algorithm==='fixed-policy-sparse-scc-v1'&&fd.certificate==='outward-interval-fixed-policy-drift-v1';
  need(fq?.policySemantics==='fixed'&&(legacyExact||sparseExact||sparseCertified),'unsupported-fixed-certificate');
  if(!legacyExact){need(fq.supportHash===binding.supportHash,'stale-fixed-support');need(fixed.root.outcomeBounds&&OUT.every(k=>Array.isArray(fixed.root.outcomeBounds[k])),'missing-fixed-enclosures');}
  const precision=prepared.request.precision?.absoluteProbabilityError??1e-6;
  need(scalar(precision)&&scalar(fq.coordinateErrorBound)&&fq.coordinateErrorBound<=precision,'fixed-coordinate-precision');
  const fixedBounds=bounds(fixed.root,fixed.quality);for(const k of OUT)need(Math.max(fixedBounds[k][0],binding.interval[k][0])<=Math.min(fixedBounds[k][1],binding.interval[k][1]),'independent-policy-disagreement');
  let upper=high(binding.interval.win[1],solved.quality.policyRegretBound);
  if(solved.root.winBounds){const pair=solved.root.winBounds;need(pair.length===2&&pair.every(scalar)&&pair[0]<=pair[1]&&pair[1]>=binding.interval.win[0],'invalid-optimal-win-bound');upper=pair[1];}
  const receipt={version:1,kind:'logical-native-study-bridge',logicalStamp:M.ngMdpEnvelope(c.request),nativeStamp:M.ngMdpEnvelope(prepared.request),nativeValueQuality:clone(solved.quality),nativeValueDiagnostics:{algorithm:solved.diagnostics?.algorithm||null,certificate:solved.diagnostics?.certificate||null},independentQuality:clone(fixed.quality),independentDiagnostics:clone(fixed.diagnostics),logicalStartDistributionHash:c.distribution.hash,nativeStartDistributionHash:prepared.startDistributionHash,mappingHash:M.ngMdpDigest(prepared.mapping),snapshotId:c.snapshotHash,snapshotHash:c.snapshotHash,profileHash:c.profile.fingerprint,runtimeHash:M.ngMdpDigest(config.runtime),admission:config.admission,supportHash:binding.supportHash,policyId:binding.policyId,fixedPolicyId:fixedId,independentSourceSupportHash:binding.supportHash,behaviorCompression:false};
  receipt.hash=M.ngMdpDigest(receipt);
  const result=freeze({status:'ready',stamp:M.ngMdpEnvelope(c.request),startDistributionHash:c.distribution.hash,policyId:binding.policyId,outcomes:clone(fixed.root.outcomes),outcomeBounds:fixedBounds,winBounds:[fixedBounds.win[0],Math.max(fixed.root.outcomes.win,upper)],quality:{...clone(solved.quality),numericalStatus:sparseCertified?'certified':solved.quality.numericalStatus,coordinateErrorBound:fixed.quality.coordinateErrorBound},provenance:{kind:'evaluated-common-policy',scope:'start-distribution',policyId:binding.policyId,contractHash:M.ngMdpContractHash(c.request),startDistributionHash:c.distribution.hash,winBoundsSemantics:'attainable-lower-optimal-upper'},bridgeReceipt:receipt});
  cache.set(c.key,{prepared,solved,binding,result,profile:c.profile});retained=true;return result;
 }catch(e){return unavailable(e.message);}finally{
  if(prepared&&!retained){try{releasePrepared(prepared);}catch(error){return unavailable('study-release-failed:'+error.message);}}
 }}
 async function exposure(args){try{
  const c=context(args),check=lifecycle(c.request);check();const artifact=cache.get(c.key);need(artifact&&artifact.binding.policyId===args.policyId,'missing-bound-baseline-policy');need(typeof deps.exposure==='function','missing-exposure-provider');
  const labels=clone(args.deckKeys).map(({deckKey,role})=>({deckKey,role}));need(labels.length>0&&new Set(labels.map(x=>M.ngMdpStable(x))).size===labels.length&&labels.every(x=>['Top','Bottom','Attacker','Defender'].includes(x.role)&&typeof x.deckKey==='string'&&x.deckKey.endsWith('|'+x.role)),'invalid-exposure-labels');
  const p=artifact.prepared;const binding={kind:'native-solver',model:p.model,request:p.request,evaluation:artifact.solved};
  const reply=freeze(clone(await deps.exposure({binding,startDistribution:p.startDistribution,startDistributionHash:p.startDistributionHash,labels,profile:c.profile,runtime:config.runtime,admission:config.admission},{...stageBudget(b,'maxExposureMilliseconds'),cancelled:()=>{check();return false;}})));check();
  envelope(M,p.request,reply.stamp);need(reply.status==='ready'&&reply.policyId===args.policyId&&reply.startDistributionHash===p.startDistributionHash,'stale-native-exposure');
  const pr=reply.provenance;need(pr?.kind==='evaluated-policy'&&pr.policyId===args.policyId&&pr.contractHash===M.ngMdpContractHash(p.request)&&pr.startDistributionHash===p.startDistributionHash&&pr.behaviorCompression===false&&pr.exposureConvention==='chosen-execution-escape-input-reads-v1','unbound-exposure');
  const la=pr.labelAdmission;need(la?.kind==='admitted-native-label-replay'&&eq(la.lawHashes,config.admission.lawHashes)&&la.metadataHash===config.admission.metadataHash&&la.queryHash===M.ngMdpDigest(labels)&&la.sourceSupportHash===artifact.binding.supportHash,'unadmitted-exposure-labels');
  need(pr.supportHash===artifact.binding.supportHash&&typeof pr.kernelHash==='string'&&pr.kernelHash&&typeof pr.policyHash==='string'&&pr.policyHash,'missing-exposure-binding');
  need(reply.stateEquivalence?.exposureLabelsPreserved!==false&&Array.isArray(reply.records)&&reply.records.length===labels.length,'partial-exposure');
  for(const label of labels){const rows=reply.records.filter(r=>r.deckKey===label.deckKey&&r.role===label.role);need(rows.length===1&&rows[0].status==='ready','partial-exposure');const r=rows[0];need(['hitting-probability','expected-visits'].includes(r.kind)&&Number.isFinite(r.value)&&r.value>=0&&(r.kind!=='hitting-probability'||r.value<=1)&&r.roundedToZero!==true,'unavailable-exposure-measure');need(r.value!==0||r.exactZero===true,'unproven-zero-exposure');}
  return freeze({...clone(reply),stamp:M.ngMdpEnvelope(c.request),startDistributionHash:c.distribution.hash,provenance:{...clone(pr),contractHash:M.ngMdpContractHash(c.request),startDistributionHash:c.distribution.hash},bridgeReceipt:{...artifact.result.bridgeReceipt,nativeExposureProvenance:clone(pr),nativeExposureStamp:clone(reply.stamp)}});
 }catch(e){return unavailable(e.message);}}
 // Release only a completed scenario artifact; never invalidate the baseline or
 // unrelated pending work. Receipt objects remain immutable after release.
 return Object.freeze({evaluate,exposure,release(args){
  const key=context(args).key,artifact=cache.get(key);if(!artifact)return false;
  cache.delete(key);releasePrepared(artifact.prepared);return true;
 },clear(){
  generation++;const artifacts=[...cache.values()];cache.clear();let failure;
  for(const artifact of artifacts){try{releasePrepared(artifact.prepared);}catch(error){failure??=error;}}
  if(failure)throw failure;
 }});
}
