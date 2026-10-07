/* Study-worker-only evaluated-policy exposure. Frozen live laws are read-only.
 * A policy name is not evidence: the complete source kernel, actual native
 * evaluation and materialized choices must agree before any reward is solved.
 * Exposure is a calculation-read event, never a root Q or passive deck visit.
 */
var NG_MDP_EXPOSURE_VERSION = 1;
var NG_MDP_EXPOSURE_CONVENTION = 'chosen-execution-escape-input-reads-v1';
var NG_MDP_EXPOSURE_OUTCOMES = ['win','loss','explicitNoResult','nontermination'];
var ngMdpExposureAdapters = new WeakMap();
function ngMdpExposureFail(reason) { throw new Error(reason); }
function ngMdpExposureFreeze(value) {
  if(value && typeof value==='object' && !Object.isFrozen(value)){for(const v of Object.values(value))ngMdpExposureFreeze(v);Object.freeze(value);}return value;
}
function ngMdpExposureLabel(label) {
  if(!label || !['Top','Bottom','Attacker','Defender'].includes(label.role) || typeof label.deckKey!=='string' || !label.deckKey.endsWith('|'+label.role) || label.deckKey==='|'+label.role)ngMdpExposureFail('invalid-exposure-deck-role');
  return JSON.stringify([label.deckKey,label.role]);
}
function ngMdpExposureLimits(options) {
  const limits={maxStates:40000,maxBranches:400000,maxQueries:32,maxLinearStates:4096,maxLinearTerms:250000,maxRationalBits:8192,maxOperations:50000000,maxMilliseconds:15000,maxExactStates:64,...options};
  for(const key of Object.keys(limits))if(key.startsWith('max')&&(!Number.isSafeInteger(limits[key])||limits[key]<=0))ngMdpExposureFail('invalid-exposure-budget:'+key);
  if(limits.maxRationalBits>16384)ngMdpExposureFail('unsupported-exposure-rational-budget');
  return limits;
}
function ngMdpExposureArithmetic(math,limits) {
  const began=Date.now();let operations=0;
  const check=()=>{if(++operations>limits.maxOperations)ngMdpExposureFail('exposure-operation-budget');if(limits.cancelled&&limits.cancelled())ngMdpExposureFail('cancelled');if(Date.now()-began>limits.maxMilliseconds)ngMdpExposureFail('exposure-time-budget');};
  const bits=x=>(x<0n?-x:x).toString(2).length;
  const admit=a=>{check();if(bits(a[0])+bits(a[1])>limits.maxRationalBits)ngMdpExposureFail('exposure-rational-budget');return a;};
  const guard=(a,b)=>{check();if(bits(a[0])+bits(a[1])+bits(b[0])+bits(b[1])+2>limits.maxRationalBits)ngMdpExposureFail('exposure-rational-intermediate-budget');};
  const parseCache=new Map();
  const rat=v=>{
    check();if(Array.isArray(v))return admit(math.ngMdpRat(v));
    if(!['string','number'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v))ngMdpExposureFail('invalid-exposure-rational');
    if(parseCache.has(v))return parseCache.get(v);
    const s=String(v),budget=Math.min(4096,Math.floor(limits.maxRationalBits/Math.log2(10)));
    if(s.length>budget)ngMdpExposureFail('exposure-rational-input-budget');
    const exp=/e([+-]?\d+)$/i.exec(s);if(exp&&(!Number.isSafeInteger(+exp[1])||Math.abs(+exp[1])+s.length>budget))ngMdpExposureFail('exposure-rational-input-budget');
    const result=admit(math.ngMdpRat(v));parseCache.set(v,result);return result;
  };
  const add=(a,b)=>{guard(a,b);return admit(math.ngMdpAdd(a,b));};
  const sub=(a,b)=>{guard(a,b);return admit(math.ngMdpSub(a,b));};
  const mul=(a,b)=>{guard(a,b);return admit(math.ngMdpMul(a,b));};
  const div=(a,b)=>{guard(a,b);return admit(math.ngMdpDiv(a,b));};
  const cmp=(a,b)=>{guard(a,b);const n=a[0]*b[1]-b[0]*a[1];return n>0n?1:n<0n?-1:0;};
  const probability=v=>{const p=rat(v);if(p[0]<0n||p[0]>p[1])ngMdpExposureFail('exposure-probability-out-of-range');return p;};
  const fraction=a=>a[0]+'/'+a[1],zero=()=>[0n,1n],one=()=>[1n,1n];
  const sum=values=>values.reduce(add,zero());
  const view=new DataView(new ArrayBuffer(8));
  const floatRat=x=>{
    if(!Number.isFinite(x))ngMdpExposureFail('nonfinite-exposure-candidate');if(!x)return zero();
    view.setFloat64(0,x);const b=view.getBigUint64(0),e=Number((b>>52n)&2047n),m=(b&((1n<<52n)-1n))+(e?1n<<52n:0n),power=e?e-1075:-1074,sign=b>>63n?-1n:1n;
    return admit(power>=0?[sign*(m<<BigInt(power)),1n]:[sign*m,1n<<BigInt(-power)]);
  };
  const next=(x,up)=>{if(!Number.isFinite(x))return x;if(!x)return up?Number.MIN_VALUE:-Number.MIN_VALUE;view.setFloat64(0,x);view.setBigUint64(0,view.getBigUint64(0)+((x>0)===up?1n:-1n));return view.getFloat64(0);};
  const down=x=>{if(!Number.isFinite(x))ngMdpExposureFail('exposure-interval-overflow');return next(x,false);};
  const up=x=>{if(!Number.isFinite(x))ngMdpExposureFail('exposure-interval-overflow');return next(x,true);};
  const number=math.ngMdpNumber;
  const endpoint=(a,upper)=>{const x=number(a);if(!Number.isFinite(x))return x;const c=cmp(floatRat(x),a);return (upper?c<0:c>0)?next(x,upper):x;};
  const exact=a=>{
    const value=number(a),text=fraction(a);
    if(!Number.isFinite(value))return {status:'unavailable',reason:'finite-exposure-number-overflow',exact:text};
    return {status:'ready',value,exact:text,bounds:[endpoint(a,false),endpoint(a,true)],exactZero:!a[0],roundedToZero:value===0&&!!a[0],numericalStatus:'exact-rational-sparse'};
  };
  return {check,rat,add,sub,mul,div,cmp,probability,fraction,zero,one,sum,floatRat,number,endpoint,down,up,exact,stats:()=>({operations,elapsedMilliseconds:Date.now()-began})};
}
function ngMdpExposureReadCounts(reads,A) {
  if(!Array.isArray(reads))ngMdpExposureFail('missing-exposure-read-annotation');const counts=new Map();
  for(const event of reads){A.check();if(!event||!['execution','escape'].includes(event.kind)||!Array.isArray(event.labels))ngMdpExposureFail('invalid-exposure-read-event');
    for(const key of new Set(event.labels.map(ngMdpExposureLabel)))counts.set(key,(counts.get(key)||0)+1);
  }return counts;
}
function ngMdpExposureChoices(input,A,validateAction) {
  const entries=Array.isArray(input)?input:Object.entries(input||{}),rows=new Map();
  for(const [id,item]of entries){A.check();if(typeof id!=='string'||!id||rows.has(id))ngMdpExposureFail('duplicate-or-invalid-policy-state');
    const choices=typeof item==='string'?[{actionId:item,probability:1}]:item;
    if(!Array.isArray(choices)||!choices.length)ngMdpExposureFail('missing-materialized-policy-action');
    let sum=A.zero();const used=new Set(),list=[];
    for(const choice of choices){if(typeof choice.actionId!=='string'||!choice.actionId||used.has(choice.actionId))ngMdpExposureFail('duplicate-or-invalid-policy-action');used.add(choice.actionId);if(validateAction)validateAction(id,choice.actionId);const p=A.probability(choice.probability);sum=A.add(sum,p);if(p[0])list.push({actionId:choice.actionId,p});}
    if(A.cmp(sum,A.one()))ngMdpExposureFail('non-normalized-exposure-policy');rows.set(id,list);
  }return {entries,rows};
}
function ngMdpExposureSnapshot(id,M) {
  let v;try{v=JSON.parse(id);}catch(_){ngMdpExposureFail('nonliteral-exposure-state');}
  if(!v||typeof v.nodeId!=='string'||!v.nodeId||!['top','bottom'].includes(v.role)||!['user','opponent'].includes(v.phase)||![v.moveCount,v.arrivalAge,v.combo].every(n=>Number.isSafeInteger(n)&&n>=0)||!Number.isFinite(v.qMod)||![v.positionKey,v.panicKey].every(k=>k===null||typeof k==='string')||M.ngMdpStateId(v)!==id)ngMdpExposureFail('nonliteral-exposure-state');
  return v;
}
function* ngMdpExposureBind(input,M,math,A,limits) {
  const {request,policy,startDistribution}=input,binding=policy&&policy.binding;
  if(!binding||!['native-solver','native-fixed-policy'].includes(binding.kind)||!binding.model||!binding.request||!binding.evaluation)ngMdpExposureFail('missing-native-policy-binding');
  const stamp=M.ngMdpEnvelope(request),sourceStamp=M.ngMdpEnvelope(binding.request),evaluation=binding.evaluation;
  if(!stamp.contractHash||stamp.contractHash!==sourceStamp.contractHash||M.ngMdpStable(stamp)!==M.ngMdpStable(sourceStamp))ngMdpExposureFail('stale-exposure-policy-request');
  for(const [k,v]of Object.entries(sourceStamp))if(M.ngMdpStable(evaluation[k])!==M.ngMdpStable(v))ngMdpExposureFail('stale-native-policy-evaluation');
  if(!['ready','bounded'].includes(evaluation.root?.status)||!evaluation.root.policyId)ngMdpExposureFail('unavailable-native-policy-evaluation');
  const equivalence=binding.model.stateEquivalence;
  if(!equivalence||equivalence.scope!=='literal-state'||equivalence.exposureLabelsPreserved!==true||evaluation.quality?.stateEquivalence?.scope!=='literal-state'||evaluation.quality?.stateEquivalence?.exposureLabelsPreserved!==true||binding.model.adapterCoverage?.equivalentDestinationRedirects>0)ngMdpExposureFail('value-only-policy-cannot-certify-exposure');
  if(!Array.isArray(binding.model.states)||binding.model.states.length>limits.maxStates)ngMdpExposureFail('exposure-source-state-budget');
  let sourceBranches=0;
  for(const s of binding.model.states){for(const a of s.actions||[]){let total=A.zero();for(const b of a.branches||[]){if(++sourceBranches>limits.maxBranches)ngMdpExposureFail('exposure-source-branch-budget');total=A.add(total,A.probability(b.probability));}if(a.immediateExecutionChance!=null)A.probability(a.immediateExecutionChance);}A.check();yield;}
  const kernel=math.ngMdpCompile(binding.model,binding.request,limits);A.check();if(kernel.reasons.length)ngMdpExposureFail('incomplete-native-policy-kernel:'+kernel.reasons.join(';'));
  if(evaluation.root.stateId!==request.state.id||evaluation.root.stateId!==kernel.rootId)ngMdpExposureFail('stale-native-policy-root');
  const ids=[...kernel.states.keys()].sort(),index=new Map(ids.map((id,i)=>[id,i])),hashes=[];
  for(const id of ids){const s=kernel.states.get(id);hashes.push(M.ngMdpDigest(s.actions.map(a=>[a.id,a.branches.map(b=>[A.fraction(b.p),b.to?index.get(b.to):null,b.terminal||null,b.subtype||null,b.duration==null?null:b.duration,b.events||[]])])));A.check();yield;}
  const supportHash=M.ngMdpDigest(['indexed-support-v1',ids,hashes]);
  const rawPolicy=binding.kind==='native-solver'?evaluation.policy:binding.actions;
  if(!rawPolicy||Object.keys(rawPolicy).length>limits.maxStates)ngMdpExposureFail('exposure-source-policy-budget');
  const source=ngMdpExposureChoices(rawPolicy,A);
  if(source.rows.size!==ids.length||[...source.rows.keys()].some(id=>!kernel.states.has(id)))ngMdpExposureFail('extraneous-or-missing-native-policy-state');
  for(const id of ids){const choices=source.rows.get(id),actions=kernel.states.get(id).actions;if(!choices||choices.some(c=>!actions.some(a=>a.id===c.actionId)))ngMdpExposureFail('incomplete-native-policy-choices');}
  let nativePolicyId;
  if(binding.kind==='native-solver'){
    if(evaluation.quality.supportHash!==supportHash)ngMdpExposureFail('stale-native-support-hash');
    if(source.rows.size!==ids.length||ids.some(id=>source.rows.get(id).length!==1||A.cmp(source.rows.get(id)[0].p,A.one())))ngMdpExposureFail('invalid-native-solver-policy');
    nativePolicyId='policy:'+M.ngMdpDigest(['support-policy-v1',supportHash,ids.map(id=>kernel.states.get(id).actions.findIndex(a=>a.id===source.rows.get(id)[0].actionId))]);
    if(evaluation.root.selectedActionId!==source.rows.get(kernel.rootId)[0].actionId)ngMdpExposureFail('stale-native-selected-action');
  }else {
    if(evaluation.quality?.policySemantics!=='fixed'||binding.sourceSupportHash!==supportHash)ngMdpExposureFail('missing-fixed-policy-kernel-admission');
    nativePolicyId='policy:'+M.ngMdpDigest(source.entries.slice().sort((a,b)=>a[0]<b[0]?-1:1));
  }
  if(nativePolicyId!==policy.id||nativePolicyId!==evaluation.root.policyId)ngMdpExposureFail('stale-native-policy-identity');
  if(!Array.isArray(policy.rows)||policy.rows.length>limits.maxStates||!Array.isArray(startDistribution)||startDistribution.length>limits.maxStates)ngMdpExposureFail('exposure-input-row-budget');
  const supplied=ngMdpExposureChoices(policy.rows.map(r=>[r.stateId,r.actions]),A);
  const signature=choices=>M.ngMdpStable(choices.map(c=>[c.actionId,A.fraction(c.p)]).sort((a,b)=>a[0]<b[0]?-1:1));
  for(const [id,choices]of supplied.rows)if(!source.rows.has(id)||signature(choices)!==signature(source.rows.get(id)))ngMdpExposureFail('materialized-policy-does-not-match-evaluation');
  const starts=new Map();let startMass=A.zero();
  for(const row of startDistribution||[]){if(typeof row.stateId!=='string'||!row.stateId||starts.has(row.stateId))ngMdpExposureFail('invalid-exposure-start');const p=A.probability(row.probability);starts.set(row.stateId,p);startMass=A.add(startMass,p);}
  if(!starts.size||starts.size>limits.maxStates||A.cmp(startMass,A.one()))ngMdpExposureFail('non-normalized-exposure-starts');
  const startDistributionHash=M.ngMdpDigest(startDistribution.slice().sort((a,b)=>a.stateId<b.stateId?-1:1));
  if(startDistributionHash!==input.startDistributionHash||policy.startDistributionHash!==startDistributionHash||policy.contractHash!==stamp.contractHash)ngMdpExposureFail('stale-exposure-start-or-policy-context');
  const positive=[...starts].filter(([,p])=>p[0]);
  let distributionRoot=null;
  if(!(positive.length===1&&positive[0][0]===kernel.rootId&&A.cmp(positive[0][1],A.one())===0)){
    const state=kernel.states.get(kernel.rootId),choices=source.rows.get(kernel.rootId);
    if(starts.get(kernel.rootId)?.[0]||state.actions.length!==1||choices.length!==1||A.cmp(choices[0].p,A.one()))ngMdpExposureFail('explicit-distribution-root-required');
    const rawRoot=binding.model.states.find(s=>s.id===kernel.rootId),action=rawRoot.actions[0];
    if(!Array.isArray(action.studyReads)||action.studyReads.length||action.kind!=='forced')ngMdpExposureFail('distribution-root-must-have-zero-reads');
    const mass=new Map();for(const b of state.actions[0].branches){if(!b.to||!starts.has(b.to)||!starts.get(b.to)[0]||b.duration!==0||(b.events||[]).length)ngMdpExposureFail('native-root-distribution-mismatch');mass.set(b.to,A.add(mass.get(b.to)||A.zero(),b.p));}
    if(action.branches.some(b=>(b.studyReads||[]).length))ngMdpExposureFail('distribution-root-must-have-zero-reads');
    for(const id of ids)if(id!==kernel.rootId&&kernel.states.get(id).actions.some(a=>a.branches.some(b=>b.to===kernel.rootId)))ngMdpExposureFail('incoming-distribution-root-edge');
    if(positive.some(([id,p])=>!mass.has(id)||A.cmp(p,mass.get(id))))ngMdpExposureFail('native-root-distribution-mismatch');
    distributionRoot=kernel.rootId;
  }
  for(const id of ids)if(id!==distributionRoot)ngMdpExposureSnapshot(id,M);
  return {kernel,source:supplied.rows,nativePolicy:source.rows,supportHash,policyId:nativePolicyId,stamp,starts,startDistributionHash,distributionRoot};
}
function ngMdpCreateExposureAdapter({metadata,profile,knowledge,adapter,identity:M,request,lawHashes}) {
  // Adapter pin moved in v1.207.0 (from cff41e…), for four label-neutral changes:
  //   - threat probes were added (`threats`), never enumerated for a study;
  //   - `endpoint` / `finishMove` were hoisted unchanged;
  //   - the forced opponent action's rows come from `opponentPositionalRows`: the same rows in the
  //     same order, and opponent rows read no player knowledge;
  //   - classify mirrors the v1.204.5 belt verdict (a submission always loses; only a no-tap reset is
  //     judged on points), a terminal classification that carries no study read.
  //   - v1.207.6: the forced escape turn's row moved into `opponentEscapeRow`, unchanged, so that
  //     escape threat probes (`ngMdpThreatId`) share it; opponent rows read no player knowledge.
  //   - v1.213.0: an ENTRY action reports `followUp` — the landed state's Finish chance and its
  //     knowledge explanation, for the card's "Works" line. No branch reads it, the entry's own
  //     studyReads stay empty (below), and that Finish row is enumerated with its own reads as before.
  //   - v1.214.0 (origin coherence PR B1): a listing's OWN outcome table. `actAt` prices and draws a
  //     move from `cal.at[posId]` when the state's listing carries one, else the node itself; the
  //     three caches key on it; knowledge gains the pure `ngKnowledgeCalAt`. Label-neutral: the
  //     overlay keeps the move's id and deckKey, so every study read is the same deck, and with no
  //     table on the wire every action is byte-identical (tests/listing_tables*.test.mjs, the
  //     metadata differential on a wire WITH tables). Reviewed by the full-game seat (OCPRB1-FG).
  //   - WINLAT1 (2026-10-05, win-chance latency): speed only, no law change. The adapter memoises
  //     pure lookups (canonical entry, arrival projection, constant rationals, fraction text), the
  //     expansion spells a successor's id only for a NEW behaviour class (field equality decides the
  //     alias count otherwise), the expansion rebuilds a branch/state without `next`/`snapshot`
  //     instead of deleting the key (same keys, same order), memoises the chance-context key per state,
  //     and the async drivers yield by MessageChannel; ngMdpActionId escapes the state id once per state. Identity: a faster
  //     SHA-256 and a loop-built ngMdpStable, both byte-identical (KATs against node:crypto). Every
  //     enumerated action, branch, read and id is the same; the WINLAT differential replays real
  //     requests through the previous and this worker core and compares whole responses byte for byte.
  //   - DEVMV39 (2026-10-07), the KNOWLEDGE pin (from fbc488…): `ngKnowledgeAdvance`'s panic "wrong" row
  //     breaks momentum without a qMod change, as the panic drill has since v1.221.0 (PR #272) and as its
  //     expiry row always did. Label-neutral: the adapter calls ngKnowledgeAdvance for arrivals only
  //     (mdp-adapter.src.js), and no study read names an answer event. Measured: regenerated before and
  //     after, every MDP shard part is byte-identical; only provenance hashes and the variants'
  //     mechanicsHash moved.
  // Evidence: the live-routing corpus replay (mdp_corpus), the metadata differential
  // (mdp_data_corpus), tests/mdp_adapter.test.mjs and tests/mdp_threats.test.mjs.
  const expected={adapter:'b9ebcf843218a48d7b8cc196460428da945fbd64d9360016a6f31c70d3ef4ef0',knowledge:'17c12cbf48e37e4cb00f5c57f16e18e06168a4967e76e21d6bc168a9b48ba879',identity:'a47bc900c7643dfe135b6e2f364471884c08274d10e2cedf5f03299390fe4969'};
  if(Object.entries(expected).some(([key,hash])=>lawHashes?.[key]!==hash))ngMdpExposureFail('unsupported-exposure-label-law');
  if(metadata?.coverage?.status!=='COMPLETE'||metadata.ruleset!==request.ruleset||profile?.status!=='ready'||profile.fingerprint!==request.profileHash||typeof knowledge.ngKnowledgeOverride!=='function')ngMdpExposureFail('incomplete-exposure-adapter-context');
  const contractHash=M.ngMdpContractHash(request),metadataHash=M.ngMdpDigest(metadata);
  const nodes=new Map(metadata.nodes.map(n=>[n.id,{id:n.id,t:n.t,deckKey:n.deckKey,submissionId:n.submissionId}]));
  const hands=new Map(Object.entries(metadata.hands).map(([key,rows])=>[key,rows.map(a=>({...a}))])),overrideMods=(profile.userMods||[]).map(m=>({...m}));
  const labels=keys=>[...new Set(keys.filter(k=>k!=null))].map(deckKey=>{const value={deckKey,role:deckKey.slice(deckKey.lastIndexOf('|')+1)};ngMdpExposureLabel(value);return value;});
  const wrapper=Object.freeze({
    normalize:(s,r)=>adapter.normalize(s,r),stateId:(s,r)=>adapter.stateId(s,r),graphCoverage:adapter.graphCoverage,
    semantics:Object.freeze({...adapter.semantics,behaviorCompression:false,exposureLabelsPreserved:true,equivalenceScope:'literal-state',exposureConvention:NG_MDP_EXPOSURE_CONVENTION,lawHashes:{...lawHashes}}),
    enumerate(input,r=request){
      if(r!==request&&M.ngMdpContractHash(r)!==contractHash)ngMdpExposureFail('stale-exposure-adapter-request');
      const s=adapter.normalize(input,r),out=adapter.enumerate(s,r);
      if(out.id!==M.ngMdpStateId(s)||s.positionKey!==input.positionKey||s.panicKey!==input.panicKey)ngMdpExposureFail('nonliteral-exposure-label-normalization');
      const hand=hands.get(M.ngMdpStable([s.nodeId,s.role]))||[];
      const actions=out.actions.map(action=>{
        let studyReads=[];
        if(s.phase!=='opponent'&&action.kind!=='entry'){
          if(!action.kind){if(JSON.parse(action.id)[2]!=='forced')ngMdpExposureFail('missing-exposure-calculation-kind');}
          else {
            const matches=hand.filter(a=>M.ngMdpActionId(out.id,a.techniqueId,a.kind,a.destinationId,a.defenseId||a.defense||null)===action.id);
            if(matches.length!==1)ngMdpExposureFail('ambiguous-exposure-action');
            const choice=matches[0],act=nodes.get(choice.techniqueId);if(!act)ngMdpExposureFail('missing-exposure-technique');
            if(choice.kind==='escape'){
              const sub=nodes.get(nodes.get(s.nodeId)?.submissionId);if(!sub)ngMdpExposureFail('missing-exposure-defense');
              studyReads=[{kind:'escape',labels:labels([s.panicKey||sub.t+'|Defender'])}];
            }else if(['finish','transition'].includes(choice.kind)){
              if(!act.deckKey)ngMdpExposureFail('missing-exposure-technique-deck');
              if(knowledge.ngKnowledgeOverride(overrideMods,act)==null)studyReads=[{kind:'execution',labels:labels([s.positionKey,act.deckKey])}];
            }else ngMdpExposureFail('unsupported-exposure-calculation');
          }
        }
        return {...action,studyReads};
      });
      return {...out,snapshot:{...s},actions};
    }
  });
  ngMdpExposureAdapters.set(wrapper,{contractHash,metadataHash,lawHashes:{...lawHashes}});return wrapper;
}
function* ngMdpMaterializeExposureSteps(input,M,A,limits,bound) {
  const adapter=input.adapter;if(adapter?.semantics?.behaviorCompression!==false||adapter.semantics.exposureLabelsPreserved!==true)ngMdpExposureFail('literal-exposure-adapter-required');
  const queue=[],seen=new Set(),states=[];let branches=0;
  for(const [id,p]of bound.starts)if(p[0]){
    const explicit=input.startSnapshots instanceof Map?input.startSnapshots.get(id):input.startSnapshots?.[id],s=explicit||ngMdpExposureSnapshot(id,M);
    if(!s||adapter.stateId(s,input.request)!==id)ngMdpExposureFail('explicit-literal-start-mapping-required');queue.push(s);
  }
  for(let i=0;i<queue.length;i++){
    A.check();const snapshot=queue[i],id=adapter.stateId(snapshot,input.request);if(seen.has(id))continue;
    if(seen.size>=limits.maxStates)ngMdpExposureFail('exposure-state-budget');seen.add(id);
    const row=bound.source.get(id);if(!row)ngMdpExposureFail('missing-materialized-policy-state');
    const out=adapter.enumerate(snapshot,input.request),actions=[];
    for(const selected of row){
      const a=out.actions.find(a=>a.id===selected.actionId);if(!a)ngMdpExposureFail('missing-materialized-policy-action');
      const converted=[];
      for(const b of a.branches){
        if(++branches>limits.maxBranches)ngMdpExposureFail('exposure-branch-budget');const p=A.probability(b.probability);
        if(!b.next){converted.push({...b});continue;}
        const to=adapter.stateId(b.next,input.request);if(p[0]&&!seen.has(to))queue.push(b.next);
        const branch={...b,to};delete branch.next;converted.push(branch);
      }actions.push({...a,branches:converted});
    }
    states.push({id,snapshot:out.snapshot,actions});yield;
  }
  if(M.ngMdpContractHash(input.request)!==bound.stamp.contractHash)ngMdpExposureFail('stale-exposure-materialization');
  return {version:1,behaviorCompression:false,exposureLabelsPreserved:true,convention:NG_MDP_EXPOSURE_CONVENTION,states,
    provenance:{contractHash:bound.stamp.contractHash,profileHash:input.request.profileHash,sourceSupportHash:bound.supportHash,lawHashes:adapter.semantics.lawHashes||null,support:'materialized-fixed-policy-positive-start-union'}};
}
function* ngMdpExposureCompile(input,model,M,A,limits,bound) {
  if(model?.behaviorCompression!==false||model.exposureLabelsPreserved!==true||model.convention!==NG_MDP_EXPOSURE_CONVENTION)ngMdpExposureFail('value-only-compression-cannot-certify-deck-exposure');
  if(model.provenance?.contractHash!==bound.stamp.contractHash||model.provenance?.profileHash!==input.request.profileHash)ngMdpExposureFail('stale-labelled-exposure-model');
  if(!Array.isArray(model.states)||!model.states.length||model.states.length>limits.maxStates)ngMdpExposureFail('exposure-state-budget');
  const states=new Map();
  for(const s of model.states){
    A.check();const v=ngMdpExposureSnapshot(s.id,M);if(!s.snapshot||M.ngMdpStable(s.snapshot)!==M.ngMdpStable(v))ngMdpExposureFail('nonliteral-exposure-state');
    if(states.has(s.id))ngMdpExposureFail('duplicate-labelled-exposure-state');states.set(s.id,s);yield;
  }
  const queue=[...bound.starts].filter(([,p])=>p[0]).map(([id])=>id),queued=new Set(queue),chain=new Map();let branchCount=0;
  const law=b=>[A.fraction(b.p),b.to||null,b.terminal||null,b.terminal?(b.subtype||'unspecified'):null,b.duration==null?null:b.duration,b.events||[]];
  for(let i=0;i<queue.length;i++){
    A.check();const id=queue[i],s=states.get(id),policy=bound.source.get(id),source=bound.kernel.states.get(id);
    if(!s||!policy||!source)ngMdpExposureFail('incomplete-labelled-positive-support');
    if(!Array.isArray(s.actions))ngMdpExposureFail('missing-labelled-actions');
    const actions=new Map(s.actions.map(a=>[a.id,a]));if(actions.size!==s.actions.length)ngMdpExposureFail('duplicate-labelled-action');
    const edges=[];
    for(const choice of policy){
      const a=actions.get(choice.actionId),native=source.actions.find(a=>a.id===choice.actionId);
      if(!a||!native||!Array.isArray(a.branches)||!a.branches.length)ngMdpExposureFail('missing-labelled-policy-action');
      const actionReads=ngMdpExposureReadCounts(a.studyReads,A),positive=[];let total=A.zero();
      for(const b of a.branches){
        if(++branchCount>limits.maxBranches)ngMdpExposureFail('exposure-branch-budget');const p=A.probability(b.probability);total=A.add(total,p);
        if(Boolean(b.to)===Boolean(b.terminal)||b.terminal&&!NG_MDP_EXPOSURE_OUTCOMES.slice(0,3).includes(b.terminal))ngMdpExposureFail('invalid-exposure-destination');
        if(!p[0])continue;positive.push({...b,p});
        const counts=new Map(actionReads);for(const [key,n]of ngMdpExposureReadCounts(b.studyReads||[],A))counts.set(key,(counts.get(key)||0)+n);
        edges.push({p:A.mul(choice.p,p),to:b.to||null,terminal:b.terminal||null,counts});
        if(b.to&&!queued.has(b.to)){queued.add(b.to);queue.push(b.to);}
      }
      if(A.cmp(total,A.one()))ngMdpExposureFail('non-normalized-labelled-action');
      if(M.ngMdpStable(positive.map(law))!==M.ngMdpStable(native.branches.map(law)))ngMdpExposureFail('labelled-kernel-differs-from-bound-policy');
    }chain.set(id,edges);yield;
  }
  const ids=[...chain.keys()].sort(),index=new Map(ids.map((id,i)=>[id,i])),parts=[];
  for(const id of ids){parts.push(M.ngMdpDigest(chain.get(id).map(b=>[A.fraction(b.p),b.to?index.get(b.to):null,b.terminal,[...b.counts].sort()])));A.check();yield;}
  const kernelHash=M.ngMdpDigest(['labelled-fixed-policy-v1',NG_MDP_EXPOSURE_CONVENTION,ids,parts]);
  const policyHash=M.ngMdpDigest(ids.map(id=>[id,bound.source.get(id).map(c=>[c.actionId,A.fraction(c.p)]).sort((a,b)=>a[0]<b[0]?-1:1)]));
  if(input.policy.policyHash!=null&&input.policy.policyHash!==policyHash)ngMdpExposureFail('stale-labelled-policy-hash');
  return {ids,chain,states,kernelHash,policyHash,coverage:{states:ids.length,branches:branchCount,positiveStarts:[...bound.starts.values()].filter(p=>p[0]).length,scope:'fixed-policy-positive-support'}};
}
// The input model is not its own label authority. Native production uses a
// privately branded wrapper; an offline oracle may inject an independently
// admitted labelled-kernel digest through trusted dependencies, never input.
function* ngMdpExposureAdmitLabels(input,deps,compiled,bound,M,A) {
  const wrapper=ngMdpExposureAdapters.get(input.adapter),parts=[];
  if(wrapper&&wrapper.contractHash!==bound.stamp.contractHash)ngMdpExposureFail('stale-exposure-label-adapter');
  for(const id of compiled.ids){
    const state=compiled.states.get(id),actions=bound.source.get(id).map(c=>state.actions.find(a=>a.id===c.actionId));
    const projection=a=>[a.id,a.studyReads,a.branches.filter(b=>A.probability(b.probability)[0]).map(b=>b.studyReads||[])];
    if(wrapper){
      const replay=input.adapter.enumerate(state.snapshot,input.request);
      if(replay.id!==id)ngMdpExposureFail('nonliteral-label-replay');
      for(const action of actions){const expected=replay.actions.find(a=>a.id===action.id);
        if(!expected||M.ngMdpStable(projection(action))!==M.ngMdpStable(projection(expected)))ngMdpExposureFail('label-annotation-differs-from-source');
        const law=a=>a.branches.filter(b=>A.probability(b.probability)[0]).map(b=>[A.fraction(A.probability(b.probability)),b.next?input.adapter.stateId(b.next,input.request):b.to||null,b.terminal||null,b.terminal?b.subtype||'unspecified':null,b.duration==null?null:b.duration,b.events||[]]);
        if(M.ngMdpStable(law(action))!==M.ngMdpStable(law(expected)))ngMdpExposureFail('label-replay-kernel-mismatch');
      }
    }
    parts.push(M.ngMdpDigest([id,actions.map(projection)]));A.check();yield;
  }
  const labelHash=M.ngMdpDigest(['chosen-calculation-labels-v1',compiled.ids,parts]);
  if(!wrapper){const trusted=deps.labelSource;
    if(trusted?.kind!=='trusted-labelled-source'||trusted.labelHash!==labelHash||!trusted.lawHashes)ngMdpExposureFail('unverified-exposure-label-source');
  }
  return {kind:wrapper?'admitted-native-label-replay':'independently-admitted-labelled-source',labelHash,metadataHash:wrapper?.metadataHash||null,
    queryHash:M.ngMdpDigest(input.labels),sourceSupportHash:bound.supportHash,lawHashes:{...(wrapper?.lawHashes||deps.labelSource.lawHashes)}};
}
// Iterative Kosaraju. Components are returned in source-to-sink order, so
// reversing them solves dependencies without recursive JS call-stack limits.
function* ngMdpExposureComponents(compiled,A) {
  const {ids,chain}=compiled,adj=new Map(),reverse=new Map(ids.map(id=>[id,[]]));
  for(const id of ids){const next=[...new Set(chain.get(id).filter(b=>b.to).map(b=>b.to))];adj.set(id,next);for(const to of next)reverse.get(to).push(id);A.check();yield;}
  const visited=new Set(),finish=[];
  for(const root of ids)if(!visited.has(root)){
    visited.add(root);const stack=[[root,0]];
    while(stack.length){const frame=stack[stack.length-1],next=adj.get(frame[0]);
      if(frame[1]===next.length){finish.push(frame[0]);stack.pop();}
      else {const to=next[frame[1]++];if(!visited.has(to)){visited.add(to);stack.push([to,0]);}}
      A.check();yield;
    }
  }
  const seen=new Set(),components=[],componentOf=new Map(),closed=new Set();
  for(let i=finish.length-1;i>=0;i--){const root=finish[i];if(seen.has(root))continue;
    const members=[],stack=[root];seen.add(root);
    while(stack.length){const id=stack.pop();members.push(id);for(const to of reverse.get(id))if(!seen.has(to)){seen.add(to);stack.push(to);}A.check();yield;}
    const c=components.length;members.sort();components.push(members);for(const id of members)componentOf.set(id,c);
  }
  for(let c=0;c<components.length;c++){if(components[c].every(id=>chain.get(id).every(b=>b.to&&componentOf.get(b.to)===c)))closed.add(c);A.check();yield;}
  return {components,componentOf,closed};
}
// Sparse elimination for a nonsingular M-matrix I-P. Its exact leading pivots
// are positive. A nonpositive floating pivot is a refusal, never repaired by a
// tolerance. Arithmetic candidates are certified against the global operator.
function* ngMdpExposureLinear(rows,rhs,exact,A,limits,diagnostics) {
  const n=rows.length;if(n>limits.maxLinearStates)ngMdpExposureFail('exposure-linear-state-budget');
  let terms=rows.reduce((s,row)=>s+row.size,0);if(terms>limits.maxLinearTerms)ngMdpExposureFail('exposure-linear-fill-budget');
  diagnostics.maxLinearStates=Math.max(diagnostics.maxLinearStates,n);diagnostics.maxLinearTerms=Math.max(diagnostics.maxLinearTerms,terms);
  const columns=Array.from({length:n},()=>new Set());for(let i=0;i<n;i++)for(const j of rows[i].keys())columns[j].add(i);
  const zero=exact?A.zero():0,nonzero=x=>exact?!!x[0]:x!==0;
  const mul=exact?A.mul:(a,b)=>{A.check();const x=a*b;if(!Number.isFinite(x))ngMdpExposureFail('nonfinite-exposure-linear');return x;};
  const sub=exact?A.sub:(a,b)=>{A.check();const x=a-b;if(!Number.isFinite(x))ngMdpExposureFail('nonfinite-exposure-linear');return x;};
  const div=exact?A.div:(a,b)=>{A.check();const x=a/b;if(!Number.isFinite(x))ngMdpExposureFail('nonfinite-exposure-linear');return x;};
  for(let k=0;k<n;k++){
    A.check();const pivot=rows[k].get(k)||zero;if(exact?pivot[0]<=0n:!(pivot>0))ngMdpExposureFail('unproved-exposure-linear-pivot');
    for(const i of [...columns[k]])if(i>k){
      const factor=div(rows[i].get(k),pivot);rows[i].delete(k);columns[k].delete(i);terms--;
      for(const [j,coefficient]of rows[k])if(j>k){const old=rows[i].get(j),value=sub(old||zero,mul(factor,coefficient));
        if(nonzero(value)){rows[i].set(j,value);if(old==null){columns[j].add(i);if(++terms>limits.maxLinearTerms)ngMdpExposureFail('exposure-linear-fill-budget');}}
        else if(old!=null){rows[i].delete(j);columns[j].delete(i);terms--;}
      }
      for(let q=0;q<rhs[i].length;q++)rhs[i][q]=sub(rhs[i][q],mul(factor,rhs[k][q]));
      diagnostics.maxLinearTerms=Math.max(diagnostics.maxLinearTerms,terms);yield;
    }yield;
  }
  const solution=new Array(n);
  for(let i=n-1;i>=0;i--){const result=rhs[i].slice();for(const [j,c]of rows[i])if(j>i)for(let q=0;q<result.length;q++)result[q]=sub(result[q],mul(c,solution[j][q]));
    solution[i]=result.map(value=>div(value,rows[i].get(i)));A.check();yield;
  }
  diagnostics.linearSystems++;return solution;
}
function* ngMdpExposureCandidates(compiled,topology,queries,exact,A,limits,diagnostics) {
  const {components,componentOf,closed}=topology,{chain}=compiled;
  const rewarded=queries.map(key=>[...closed].filter(c=>components[c].some(id=>chain.get(id).some(b=>b.counts.get(key)>0))));
  const countQueries=queries.map((key,q)=>({key,q})).filter(({q})=>!rewarded[q].length);
  const dimension=5+countQueries.length,values=new Map(),hitting=queries.map(()=>new Map());
  const zero=()=>exact?A.zero():0,one=()=>exact?A.one():1;
  const arithmetic=(x,y,op)=>{if(exact)return A[op](x,y);A.check();const z=op==='add'?x+y:x*y;if(!Number.isFinite(z))ngMdpExposureFail('nonfinite-exposure-candidate');return z;};
  const add=(x,y)=>arithmetic(x,y,'add'),mul=(x,y)=>arithmetic(x,y,'mul'),scalar=p=>exact?p:A.number(p);
  for(const c of closed)for(const id of components[c]){const v=Array.from({length:dimension},zero);v[3]=one();values.set(id,v);for(let q=0;q<queries.length;q++)hitting[q].set(id,rewarded[q].includes(c)?one():zero());}
  function* system(members,hitQuery){
    const local=new Map(members.map((id,i)=>[id,i])),rows=[],rhs=[],hit=hitQuery!=null;
    for(let i=0;i<members.length;i++){
      const id=members[i],coefficients=new Map([[i,A.one()]]),v=Array.from({length:hit?1:dimension},zero);if(!hit)v[4]=one();
      for(const b of chain.get(id)){
        const p=scalar(b.p),read=hit&&b.counts.has(queries[hitQuery]);
        if(read)v[0]=add(v[0],p);
        else if(b.to){
          if(local.has(b.to)){const j=local.get(b.to);coefficients.set(j,A.sub(coefficients.get(j)||A.zero(),b.p));}
          else {const next=hit?[hitting[hitQuery].get(b.to)]:values.get(b.to);if(!next)ngMdpExposureFail('exposure-scc-order');for(let q=0;q<v.length;q++)v[q]=add(v[q],mul(p,next[q]));}
        }else if(!hit){const q=NG_MDP_EXPOSURE_OUTCOMES.indexOf(b.terminal);v[q]=add(v[q],p);}
        if(!hit)for(let q=0;q<countQueries.length;q++){const n=b.counts.get(countQueries[q].key)||0;if(n)v[q+5]=add(v[q+5],mul(p,exact?A.rat(n):n));}
      }
      rows.push(new Map([...coefficients].filter(([,x])=>x[0]).map(([j,x])=>[j,scalar(x)])));rhs.push(v);A.check();yield;
    }
    return yield* ngMdpExposureLinear(rows,rhs,exact,A,limits,diagnostics);
  }
  for(let c=components.length-1;c>=0;c--)if(!closed.has(c)){
    const members=components[c],solution=yield* system(members,null);for(let i=0;i<members.length;i++)values.set(members[i],solution[i]);
    for(let q=0;q<queries.length;q++){const hit=yield* system(members,q);for(let i=0;i<members.length;i++)hitting[q].set(members[i],hit[i][0]);}
    A.check();yield;
  }
  if(!exact)for(const id of compiled.ids){
    const v=values.get(id);for(let q=0;q<4;q++)v[q]=Math.max(0,Math.min(1,v[q]));
    const sum=v.slice(0,4).reduce((a,b)=>a+b,0);if(!(sum>0))ngMdpExposureFail('unproved-exposure-terminal-vector');for(let q=0;q<4;q++)v[q]/=sum;
    for(let q=5;q<v.length;q++)v[q]=Math.max(0,v[q]);
    for(const hit of hitting)hit.set(id,Math.max(0,Math.min(1,hit.get(id))));A.check();yield;
  }
  return {values,hitting,rewarded,countQueries,exact};
}
function* ngMdpExposureCertificate(compiled,topology,candidates,queries,bound,A) {
  const {values,hitting,countQueries}=candidates,{chain}=compiled,dimension=values.values().next().value.length;
  const transient=compiled.ids.filter(id=>!topology.closed.has(topology.componentOf.get(id))),probabilities=new Map();
  const probability=p=>{const key=A.fraction(p);if(!probabilities.has(key))probabilities.set(key,[A.endpoint(p,false),A.endpoint(p,true)]);return probabilities.get(key);};
  const plus=(range,p,value)=>{
    if(!Number.isFinite(value)||value<0)ngMdpExposureFail('nonfinite-or-negative-exposure-candidate');if(value===0)return;
    const [lo,hi]=probability(p),lower=Math.max(0,A.down(lo*value)),upper=A.up(hi*value);
    range[0]=Math.max(0,A.down(range[0]+lower));range[1]=A.up(range[1]+upper);
    if(!Number.isFinite(range[0])||!Number.isFinite(range[1]))ngMdpExposureFail('exposure-interval-overflow');
  };
  let drift=Infinity;const residual=Array(dimension).fill(0),hitResidual=queries.map(()=>0);
  const error=(value,range)=>{const result=Math.max(0,A.up(value-range[0]),A.up(range[1]-value));if(!Number.isFinite(result))ngMdpExposureFail('exposure-residual-overflow');return result;};
  for(const id of transient){
    const v=values.get(id),t=v[4];if(!(t>0)||!Number.isFinite(t))ngMdpExposureFail('unproved-exposure-time-witness');
    const future=[0,0],ranges=Array.from({length:dimension},()=>[0,0]),hitRanges=queries.map(()=>[0,0]);ranges[4]=[1,1];
    for(const b of chain.get(id)){
      if(b.to){const next=values.get(b.to);for(let q=0;q<dimension;q++)plus(ranges[q],b.p,next[q]);plus(future,b.p,next[4]);}
      else plus(ranges[NG_MDP_EXPOSURE_OUTCOMES.indexOf(b.terminal)],b.p,1);
      for(let q=0;q<countQueries.length;q++){const n=b.counts.get(countQueries[q].key)||0;if(n)plus(ranges[q+5],b.p,n);}
      for(let q=0;q<queries.length;q++)plus(hitRanges[q],b.p,b.counts.has(queries[q])?1:b.to?hitting[q].get(b.to):0);
    }
    drift=Math.min(drift,A.down(t-future[1]));
    for(let q=0;q<dimension;q++)residual[q]=Math.max(residual[q],error(v[q],ranges[q]));
    for(let q=0;q<queries.length;q++)hitResidual[q]=Math.max(hitResidual[q],error(hitting[q].get(id),hitRanges[q]));
    A.check();yield;
  }
  if(transient.length&&(!(drift>0)||!Number.isFinite(drift)))ngMdpExposureFail('unproved-exposure-positive-drift');
  // Keep the common division EXACT. Rounding each time coordinate upward
  // independently need not preserve (I-P)w >= 1 because of negative terms.
  const d=transient.length?A.floatRat(drift):A.one();let weightedTime=A.zero();
  for(const [id,p]of bound.starts)if(p[0])weightedTime=A.add(weightedTime,A.mul(p,A.floatRat(values.get(id)[4])));
  const weightedWitness=A.div(weightedTime,d);
  const aggregate=get=>{let value=A.zero();for(const [id,p]of bound.starts)if(p[0])value=A.add(value,A.mul(p,A.floatRat(get(id))));return value;};
  const interval=(value,rho,isProbability,positive)=>{
    if(!positive)return {...A.exact(A.zero()),numericalStatus:'support-proved-zero'};
    const radius=A.mul(A.floatRat(rho),weightedWitness),zero=A.zero(),one=A.one();
    let lower=A.sub(value,radius),upper=A.add(value,radius);if(lower[0]<0n)lower=zero;if(isProbability&&A.cmp(upper,one)>0)upper=one;
    const number=A.number(value),lo=A.endpoint(lower,false),hi=A.endpoint(upper,true);
    if(![number,lo,hi].every(Number.isFinite))return {status:'unavailable',reason:'finite-exposure-number-overflow',numericalStatus:'outward-interval-fixed-policy'};
    const exported=A.floatRat(number),errorLo=A.sub(exported,A.floatRat(lo)),errorHi=A.sub(A.floatRat(hi),exported),error=A.cmp(errorLo,errorHi)>0?errorLo:errorHi;
    return {status:'ready',value:number,bounds:[lo,hi],coordinateErrorBound:A.endpoint(error,true),exactZero:false,roundedToZero:number===0,
      numericalStatus:'outward-interval-fixed-policy',certificate:{residualUpper:rho,driftLower:transient.length?drift:null}};
  };
  const outcomeSupport=NG_MDP_EXPOSURE_OUTCOMES.map((kind,q)=>(q===3&&topology.closed.size>0)||compiled.ids.some(id=>chain.get(id).some(b=>b.terminal===kind)));
  const measures={outcomes:NG_MDP_EXPOSURE_OUTCOMES.map((_,q)=>interval(aggregate(id=>values.get(id)[q]),residual[q],true,outcomeSupport[q])),hitting:[],counts:[]};
  for(let q=0;q<queries.length;q++){
    const positive=compiled.ids.some(id=>chain.get(id).some(b=>b.counts.has(queries[q])));
    measures.hitting[q]=interval(aggregate(id=>hitting[q].get(id)),hitResidual[q],true,positive);
    const n=countQueries.findIndex(x=>x.q===q);if(n>=0)measures.counts[q]=interval(aggregate(id=>values.get(id)[n+5]),residual[n+5],false,positive);
    A.check();yield;
  }
  return {measures,certificate:{kind:'outward-interval-fixed-policy-drift-v1',globalOperator:true,transientStates:transient.length,
    driftLower:transient.length?drift:null,weightedWitness:A.fraction(weightedWitness),maxResidualUpper:Math.max(...residual,...hitResidual)}};
}
function* ngMdpExposureResults(input,compiled,topology,candidates,bound,A,limits) {
  const keys=input.labels.map(ngMdpExposureLabel);let measures,certificate;
  if(candidates.exact){
    const aggregate=get=>{let v=A.zero();for(const [id,p]of bound.starts)if(p[0])v=A.add(v,A.mul(p,get(id)));return A.exact(v);};
    measures={outcomes:NG_MDP_EXPOSURE_OUTCOMES.map((_,q)=>aggregate(id=>candidates.values.get(id)[q])),hitting:[],counts:[]};
    for(let q=0;q<keys.length;q++){
      measures.hitting[q]=aggregate(id=>candidates.hitting[q].get(id));const n=candidates.countQueries.findIndex(x=>x.q===q);
      if(n>=0)measures.counts[q]=aggregate(id=>candidates.values.get(id)[n+5]);A.check();yield;
    }
    certificate={kind:'exact-rational-sparse-fixed-policy-v1',globalOperator:true};
  }else ({measures,certificate}=yield* ngMdpExposureCertificate(compiled,topology,candidates,keys,bound,A));
  const coordinateError=measure=>{
    if(measure.status!=='ready')return null;
    if(measure.coordinateErrorBound!=null)return measure.coordinateErrorBound;
    const v=A.floatRat(measure.value),left=A.sub(v,A.floatRat(measure.bounds[0])),right=A.sub(A.floatRat(measure.bounds[1]),v);
    return A.endpoint(A.cmp(left,right)>0?left:right,true);
  };
  const admit=(measure,probability)=>{
    if(measure.status!=='ready')return measure;
    const error=coordinateError(measure),limit=probability?limits.absoluteProbabilityError:limits.absoluteCountError;
    if(!Number.isFinite(error)||error>limit)return {...measure,status:'unavailable',reason:probability?'exposure-probability-precision-unmet':'exposure-count-precision-unmet',coordinateErrorBound:error};
    return {...measure,coordinateErrorBound:error};
  };
  const outcomes=Object.fromEntries(NG_MDP_EXPOSURE_OUTCOMES.map((kind,q)=>[kind,admit(measures.outcomes[q],true)]));
  if(Object.values(outcomes).some(x=>x.status!=='ready'))ngMdpExposureFail('unproved-fixed-policy-outcome-precision');
  const records=input.labels.map((label,q)=>({...label,hittingProbability:admit(measures.hitting[q],true),
    expectedVisits:candidates.rewarded[q].length?{status:'unavailable',reason:'infinite-exposure',exact:'infinity',rewardedClosedClasses:candidates.rewarded[q].map(c=>topology.components[c][0])}:admit(measures.counts[q],false)}));
  return {records,policyEvaluation:{status:'ready',policyId:bound.policyId,semantics:'evaluated-fixed-policy',outcomes},certificate};
}
function ngMdpExposureUnavailable(input,M,error,diagnostics) {
  let stamp=null;try{stamp=JSON.parse(M.ngMdpStable(M.ngMdpEnvelope(input.request)));}catch(_){}
  return ngMdpExposureFreeze({status:'unavailable',reason:error.message||String(error),stamp,records:[],diagnostics:{...diagnostics}});
}
function* ngMdpExposureRun(input,deps,options,materializeOnly) {
  let A;const diagnostics={algorithm:'sparse-scc-labelled-fixed-policy-v1',linearSystems:0,maxLinearStates:0,maxLinearTerms:0},M=deps.identity,math=deps.math;
  try{
    const limits=ngMdpExposureLimits({absoluteProbabilityError:1e-6,absoluteCountError:1e-6,...options});
    for(const k of ['absoluteProbabilityError','absoluteCountError'])if(!Number.isFinite(limits[k])||limits[k]<0)ngMdpExposureFail('invalid-exposure-precision');
    if(!input||!M||!math)ngMdpExposureFail('missing-exposure-dependencies');A=ngMdpExposureArithmetic(math,limits);
    if(input.measure!=null&&!['hitting-probability','expected-visits'].includes(input.measure))ngMdpExposureFail('unsupported-exposure-kind');
    if(!Array.isArray(input.labels)||!input.labels.length||input.labels.length>limits.maxQueries)ngMdpExposureFail('exposure-query-budget');
    const queries=input.labels.map(ngMdpExposureLabel);if(new Set(queries).size!==queries.length)ngMdpExposureFail('duplicate-exposure-deck-role');
    const bound=yield* ngMdpExposureBind(input,M,math,A,limits);
    const model=input.model|| (yield* ngMdpMaterializeExposureSteps(input,M,A,limits,bound));
    const compiled=yield* ngMdpExposureCompile(input,model,M,A,limits,bound),labelAdmission=yield* ngMdpExposureAdmitLabels(input,deps,compiled,bound,M,A);
    const stamp=JSON.parse(M.ngMdpStable(bound.stamp));
    const provenance={kind:'evaluated-policy',contractHash:stamp.contractHash,policyId:bound.policyId,policyHash:compiled.policyHash,kernelHash:compiled.kernelHash,
      startDistributionHash:bound.startDistributionHash,sourceSupportHash:bound.supportHash,supportHash:bound.supportHash,behaviorCompression:false,exposureLabelsPreserved:true,
      exposureConvention:NG_MDP_EXPOSURE_CONVENTION,algorithm:diagnostics.algorithm,labelAdmission,
      nativeBinding:{kind:input.policy.binding.kind,stamp,sourceSupportHash:bound.supportHash,policyId:bound.policyId,distributionRoot:bound.distributionRoot}};
    if(materializeOnly)return ngMdpExposureFreeze({status:'ready',stamp,model:JSON.parse(M.ngMdpStable(model)),provenance,diagnostics:{...diagnostics,...A.stats()}});
    const topology=yield* ngMdpExposureComponents(compiled,A),transient=compiled.ids.length-[...topology.closed].reduce((n,c)=>n+topology.components[c].length,0);
    const algorithm=limits.algorithm||'auto';if(!['auto','exact-sparse','certified'].includes(algorithm))ngMdpExposureFail('unsupported-exposure-algorithm');
    if(algorithm==='exact-sparse'&&transient>limits.maxExactStates)ngMdpExposureFail('exposure-exact-state-budget');
    const exact=algorithm!=='certified'&&transient<=limits.maxExactStates;
    diagnostics.numericalRoute=exact?'exact-sparse':'outward-interval';
    const candidates=yield* ngMdpExposureCandidates(compiled,topology,queries,exact,A,limits,diagnostics),results=yield* ngMdpExposureResults(input,compiled,topology,candidates,bound,A,limits);
    if(M.ngMdpContractHash(input.request)!==bound.stamp.contractHash)ngMdpExposureFail('stale-exposure-request');
    A.check();return ngMdpExposureFreeze({status:'ready',stamp,policyId:bound.policyId,policyHash:compiled.policyHash,kernelHash:compiled.kernelHash,
      startDistributionHash:bound.startDistributionHash,measure:input.measure||'hitting-probability',provenance,records:results.records,policyEvaluation:results.policyEvaluation,
      quality:{certificate:results.certificate,policySemantics:'fixed',stateEquivalence:{scope:'literal-state',exposureLabelsPreserved:true},
        absoluteProbabilityError:limits.absoluteProbabilityError,absoluteCountError:limits.absoluteCountError},
      coverage:{...compiled.coverage,sourceStates:bound.kernel.states.size,components:topology.components.length,closedClasses:topology.closed.size,transientStates:transient,labelledComplete:true},diagnostics:{...diagnostics,...A.stats()}});
  }catch(error){return ngMdpExposureUnavailable(input||{},M,error,{...diagnostics,...(A?A.stats():{})});}
}
function ngMdpExposureDrain(it) {let step;do{step=it.next();}while(!step.done);return step.value;}
async function ngMdpExposureDrainAsync(it) {let step,checkpoint=Date.now();do{step=it.next();if(!step.done&&Date.now()-checkpoint>=8){await new Promise(resolve=>setTimeout(resolve,0));checkpoint=Date.now();}}while(!step.done);return step.value;}
function ngMdpEvaluateExposure(input,deps,options) {return ngMdpExposureDrain(ngMdpExposureRun(input,deps,options,false));}
function ngMdpEvaluateExposureAsync(input,deps,options) {return ngMdpExposureDrainAsync(ngMdpExposureRun(input,deps,options,false));}
function ngMdpMaterializeExposurePolicy(input,deps,options) {return ngMdpExposureDrain(ngMdpExposureRun(input,deps,options,true));}
function ngMdpMaterializeExposurePolicyAsync(input,deps,options) {return ngMdpExposureDrainAsync(ngMdpExposureRun(input,deps,options,true));}
function ngMdpExposureProviderRecord(result,kind=result.measure||'hitting-probability') {
  if(!['hitting-probability','expected-visits'].includes(kind))ngMdpExposureFail('unsupported-exposure-kind');
  if(result.status!=='ready')return result;
  const records=result.records.map(row=>{const evidence=kind==='hitting-probability'?row.hittingProbability:row.expectedVisits,base={deckKey:row.deckKey,role:row.role,kind};
    return evidence.status!=='ready'||evidence.roundedToZero?{...base,status:'unavailable',reason:evidence.reason||'positive-exposure-number-underflow',evidence}:{...base,status:'ready',value:evidence.value,exactZero:evidence.exactZero,roundedToZero:false,evidence};
  });
  return ngMdpExposureFreeze({status:records.every(r=>r.status==='ready')?'ready':records.some(r=>r.status==='ready')?'partial':'unavailable',stamp:result.stamp,
    policyId:result.policyId,startDistributionHash:result.startDistributionHash,provenance:result.provenance,stateEquivalence:{scope:'literal-state',exposureLabelsPreserved:true},records,
    diagnostics:{policyHash:result.policyHash,kernelHash:result.kernelHash,measures:result.records,policyEvaluation:result.policyEvaluation,quality:result.quality,coverage:result.coverage}});
}
// Independent VALUE-ONLY fixed-policy entry. No exposure label is constructed,
// no optimizer result is consumed, and the native raw policy identity is kept.
// The caller/bridge separately compares this support receipt with its optimizer.
function* ngMdpExposureFixedSteps(model,request,rawPolicy,deps,options) {
  const M=deps.identity,math=deps.math,diagnostics={algorithm:'fixed-policy-sparse-scc-v1',linearSystems:0,maxLinearStates:0,maxLinearTerms:0};let A;
  try{
    const limits=ngMdpExposureLimits({absoluteProbabilityError:1e-6,absoluteCountError:1e-6,...options});
    for(const k of ['absoluteProbabilityError','absoluteCountError'])if(!Number.isFinite(limits[k])||limits[k]<0)ngMdpExposureFail('invalid-exposure-precision');
    A=ngMdpExposureArithmetic(math,limits);
    if(!Array.isArray(model.states)||model.states.length>limits.maxStates)ngMdpExposureFail('fixed-policy-source-state-budget');
    let branches=0;
    for(const state of model.states){for(const action of state.actions||[]){let total=A.zero();for(const b of action.branches||[]){if(++branches>limits.maxBranches)ngMdpExposureFail('fixed-policy-source-branch-budget');total=A.add(total,A.probability(b.probability));}if(action.immediateExecutionChance!=null)A.probability(action.immediateExecutionChance);}A.check();yield;}
    const kernel=math.ngMdpCompile(model,request,limits);A.check();if(kernel.reasons.length)ngMdpExposureFail('incomplete-fixed-policy-kernel:'+kernel.reasons.join(';'));
    const sourceIds=[...kernel.states.keys()].sort(),index=new Map(sourceIds.map((id,i)=>[id,i])),hashes=[];
    for(const id of sourceIds){hashes.push(M.ngMdpDigest(kernel.states.get(id).actions.map(a=>[a.id,a.branches.map(b=>[A.fraction(b.p),b.to?index.get(b.to):null,b.terminal||null,b.subtype||null,b.duration==null?null:b.duration,b.events||[]])])));A.check();yield;}
    const supportHash=M.ngMdpDigest(['indexed-support-v1',sourceIds,hashes]);
    if(!rawPolicy||Object.keys(rawPolicy).length>limits.maxStates)ngMdpExposureFail('fixed-policy-argument-budget');
    // Raw zero-mass choices still belong to the argument and must be legal.
    const policy=ngMdpExposureChoices(rawPolicy,A,(id,actionId)=>{const state=kernel.states.get(id);if(state&&!state.actions.some(a=>a.id===actionId))ngMdpExposureFail('illegal-fixed-policy-action');});
    if(policy.rows.size!==sourceIds.length||[...policy.rows.keys()].some(id=>!kernel.states.has(id)))ngMdpExposureFail('extraneous-or-missing-native-policy-state');
    const policyId='policy:'+M.ngMdpDigest(policy.entries.slice().sort((a,b)=>a[0]<b[0]?-1:1)),stamp=JSON.parse(M.ngMdpStable(M.ngMdpEnvelope(request)));
    const queue=[kernel.rootId],seen=new Set(queue),chain=new Map();let selectedBranches=0;
    for(let i=0;i<queue.length;i++){
      const id=queue[i],edges=[];
      for(const choice of policy.rows.get(id))for(const b of kernel.states.get(id).actions.find(a=>a.id===choice.actionId).branches){
        if(++selectedBranches>limits.maxBranches)ngMdpExposureFail('fixed-policy-mixture-branch-budget');
        edges.push({p:A.mul(choice.p,b.p),to:b.to||null,terminal:b.terminal||null,counts:new Map()});
        if(b.to&&!seen.has(b.to)){seen.add(b.to);queue.push(b.to);}
      }
      chain.set(id,edges);A.check();yield;
    }
    const compiled={ids:[...chain.keys()].sort(),chain},topology=yield* ngMdpExposureComponents(compiled,A),transient=compiled.ids.length-[...topology.closed].reduce((n,c)=>n+topology.components[c].length,0);
    const algorithm=limits.algorithm||'auto';if(!['auto','exact-sparse','certified'].includes(algorithm))ngMdpExposureFail('unsupported-exposure-algorithm');
    if(algorithm==='exact-sparse'&&transient>limits.maxExactStates)ngMdpExposureFail('exposure-exact-state-budget');
    const exact=algorithm!=='certified'&&transient<=limits.maxExactStates,candidates=yield* ngMdpExposureCandidates(compiled,topology,[],exact,A,limits,diagnostics);
    const bound={starts:new Map([[kernel.rootId,A.one()]]),policyId},evaluated=yield* ngMdpExposureResults({labels:[]},compiled,topology,candidates,bound,A,limits);
    const evidence=evaluated.policyEvaluation.outcomes,outcomes={},outcomeBounds={};let error=0;
    for(const kind of NG_MDP_EXPOSURE_OUTCOMES){outcomes[kind]=evidence[kind].value;outcomeBounds[kind]=evidence[kind].bounds;error=Math.max(error,evidence[kind].coordinateErrorBound);}
    if(M.ngMdpContractHash(request)!==stamp.contractHash)ngMdpExposureFail('stale-fixed-policy-request');A.check();
    return ngMdpExposureFreeze({...stamp,policyId,root:{stateId:kernel.rootId,status:'ready',policyId,outcomes,outcomeBounds},
      quality:{numericalStatus:exact?'exact-rational':'certified-fixed-policy',policySemantics:'fixed',coordinateErrorBound:error,supportHash,
        stateEquivalence:kernel.stateEquivalence?JSON.parse(M.ngMdpStable(kernel.stateEquivalence)):null,
        coverage:{sourceStates:sourceIds.length,states:compiled.ids.length,branches:selectedBranches,components:topology.components.length,closedClasses:topology.closed.size},unresolvedReasons:[]},
      provenance:{kind:'independently-evaluated-fixed-policy',contractHash:stamp.contractHash,policyId,sourceSupportHash:supportHash},
      diagnostics:{...diagnostics,...A.stats(),certificate:evaluated.certificate.kind,certificateEvidence:evaluated.certificate,outcomeEvidence:evidence}});
  }catch(error){const failed=ngMdpExposureUnavailable({request},M,error,{...diagnostics,...(A?A.stats():{})});
    return ngMdpExposureFreeze({...failed.stamp,root:{stateId:request?.state?.id||null,status:'unavailable',reason:failed.reason},quality:{policySemantics:'fixed',unresolvedReasons:[failed.reason]},diagnostics:failed.diagnostics});
  }
}
function ngMdpEvaluateFixedPolicy(model,request,rawPolicy,deps,options) {return ngMdpExposureDrain(ngMdpExposureFixedSteps(model,request,rawPolicy,deps,options));}
function ngMdpEvaluateFixedPolicyAsync(model,request,rawPolicy,deps,options) {return ngMdpExposureDrainAsync(ngMdpExposureFixedSteps(model,request,rawPolicy,deps,options));}
if(typeof module!=='undefined'&&module.exports)module.exports={NG_MDP_EXPOSURE_VERSION,NG_MDP_EXPOSURE_CONVENTION,ngMdpCreateExposureAdapter,ngMdpMaterializeExposurePolicy,ngMdpMaterializeExposurePolicyAsync,ngMdpEvaluateExposure,ngMdpEvaluateExposureAsync,ngMdpExposureProviderRecord,ngMdpEvaluateFixedPolicy,ngMdpEvaluateFixedPolicyAsync};
