import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),M=require('../neural/src/mdp-model.src.js'),E=require('../neural/src/mdp-exposure.src.js');
const source=readFileSync(new URL('../neural/src/app.src.jsx',import.meta.url),'utf8');
// The baseline calls local methods; integrated app sources require their real
// knowledge module. Missing integrated dependencies fail, never skip a test.
const knowledgeSource=/\bngKnowledge[A-Z]/.test(source)?readFileSync(new URL('../neural/src/knowledge-profile.src.js',import.meta.url),'utf8').replace(/^export /gm,''):'';
const Component=new Function('DCLogic','React',knowledgeSource+'\n'+source+'\nreturn Component;')(class {},{createRef:()=>({current:null})});
const laws={adapter:'f79abb07b14ba2ec8c661a614f19a6f0430f7a3e69253ed0556f1f4b1e76f368',knowledge:'8cb262645b39b56a20f9940f41d7fd8cdfdfdb09419482e0c82722a98a8bd4e3',identity:'c9b811f4a2e5af11af2b193dcb30b6a787a19da4a06385373517f5f58591dc3a'};
const deepFreeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))deepFreeze(x);Object.freeze(v);}return v;};
function fixture({kind='transition',positionKey='Mount|Top',panicKey=null,override=false,bonus=0,phase='user',lawHashes=laws}={}){
  const snapshot={nodeId:'seat',role:'top',phase,moveCount:9,arrivalAge:0,qMod:0,combo:0,positionKey,panicKey},id=M.ngMdpStateId(snapshot),actionId=M.ngMdpActionId(id,'act',kind,'dest',null);
  const request={apiVersion:2,requestId:'label-source',revision:1,modelHash:'model',mechanicsHash:'mechanics',graphHash:'graph',profileHash:'profile',opponentPolicyHash:'opponent',ruleset:'gi',objective:M.NG_MDP_OBJECTIVE,futureStudyPolicy:'no-additional-study-events',horizon:{kind:'actual-roll',episodeCap:9,moveCount:9},state:{id,snapshot,aiSkill:.07}};
  const nodes=[{id:'seat',idx:0,t:'Mount Top',ty:'positions',role:'top',submissionId:'sub',s:[.5,-.5]},
    {id:'act',idx:1,t:'Armbar',ty:kind==='entry'?'submissions':'transitions',role:'attacker',deckKey:'Armbar|Attacker',cal:{successRate:50},s:[.1,-.1]},
    {id:'sub',idx:2,t:'Triangle',ty:'submissions',role:'attacker',s:[.8,-.8],cal:{successRate:70}},
    {id:'dest',idx:3,t:'Guard Bottom',ty:'positions',role:'bottom',s:[-.3,.3]}];
  const metadata={coverage:{status:'COMPLETE'},ruleset:'gi',nodes,hands:{[M.ngMdpStable(['seat','top'])]:[{techniqueId:'act',kind,destinationId:'dest'}]}};
  const profile={status:'ready',fingerprint:'profile',userMods:override?[{on:true,name:'Armbar',pct:75}]:[]};
  const original=deepFreeze({id,snapshot:{...snapshot},actions:[{id:actionId,kind,immediateExecutionChance:.5,branches:[{probability:1,terminal:'win'}]}]});
  const native={normalize:s=>({...s}),stateId:M.ngMdpStateId,enumerate:()=>original,semantics:{exposureLabelsPreserved:false},behaviorKey:()=> 'value-only-class'};
  const knowledge={ngKnowledgeOverride:(mods,act)=>Component.prototype.successOverride.call({userMods:mods},act)};
  const adapter=E.ngMdpCreateExposureAdapter({metadata,profile,knowledge,adapter:native,identity:M,request,lawHashes});
  const observed=[],app=Object.create(Component.prototype);
  Object.assign(app,{nodes,currentPos:0,playerRole:'top',_posKey:positionKey,_panicKey:panicKey,_defendSub:2,userMods:profile.userMods,prep:{},_sharp:{},aiSkill:.07,_giMode:'gi',_qMod:0,_combo:0});
  app.stateBonus=key=>{if(key)observed.push(key);return bonus;};app.myVal=n=>n.s[0];app.oppVal=n=>n.s[1];
  const emitted=()=>adapter.enumerate(snapshot).actions[0].studyReads;
  function bound(){
    const model={...Object.fromEntries(['modelHash','mechanicsHash','graphHash','profileHash','opponentPolicyHash','ruleset'].map(k=>[k,request[k]])),contractHash:M.ngMdpContractHash(request),stateEquivalence:{scope:'literal-state',exposureLabelsPreserved:true},states:[{id,actions:original.actions}]};
    const evaluation=M.ngMdpSolve(model,request,{includePolicy:true});assert.equal(evaluation.root.status,'ready',evaluation.root.reason);
    const startDistribution=[{stateId:id,probability:1}],startDistributionHash=M.ngMdpDigest(startDistribution),labels=[{deckKey:'Mount|Top',role:'Top'},{deckKey:'Armbar|Attacker',role:'Attacker'}];
    return {request,adapter,startDistribution,startDistributionHash,labels,policy:{id:evaluation.root.policyId,contractHash:M.ngMdpContractHash(request),startDistributionHash,rows:[{stateId:id,actions:[{actionId,probability:1}]}],binding:{kind:'native-solver',model,request,evaluation}}};
  }
  return {snapshot,id,request,metadata,adapter,emitted,observed,app,nodes,original,bound};
}
test('read wrapper matches actual moveChance inputs including zero, clamp and duplicate-role input',()=>{
  for(const config of [{},{bonus:10},{positionKey:null},{positionKey:'Armbar|Attacker'},{positionKey:'Guard|Bottom'}]){
    const f=fixture(config);Component.prototype.moveChance.call(f.app,f.nodes[1]);
    assert.deepEqual(f.emitted()[0].labels.map(x=>x.deckKey),[...new Set(f.observed)]);
    assert.equal(f.adapter.enumerate(f.snapshot).actions[0].branches,f.original.actions[0].branches);assert.equal(f.adapter.behaviorKey,undefined);
  }
});
test('actual absolute execution override bypasses reads while escape keeps the frozen panic role',()=>{
  const f=fixture({override:true});Component.prototype.moveChance.call(f.app,f.nodes[1]);assert.deepEqual(f.observed,[]);assert.deepEqual(f.emitted(),[]);
  for(const panicKey of [null,'Mount|Top','Guard|Bottom']){
    const g=fixture({kind:'escape',override:true,panicKey});Component.prototype.escapeChance.call(g.app,{node:g.nodes[1],res:3});
    assert.deepEqual(g.emitted()[0].labels.map(x=>x.deckKey),g.observed);
  }
});
test('actual committed execution counts the active draw; deterministic entry bypasses that calculation',()=>{
  const f=fixture();f.app.rng=()=>.1;f.app.fx=()=>{};f.app.after=()=>{};Component.prototype.tensionSweep.call(f.app,{idx:1});
  assert.deepEqual(f.emitted()[0].labels.map(x=>x.deckKey),f.observed);
  const g=fixture({kind:'entry'});for(const name of ['_endArrival','releaseCamera','_flushLandSkipDebt','_disarmLandClock','fx','track','_prefetchLandDeck','setEvent'])g.app[name]=()=>{};
  g.app.submissionNode=n=>n;g.app.startTravel=()=>{};Component.prototype.enterAttempt.call(g.app,{idx:1,res:1,node:g.nodes[1],action:'enter'});
  assert.deepEqual(g.observed,[]);assert.deepEqual(g.emitted(),[]);
});
test('opponent/display evaluations are not emitted as chosen user reads',()=>{
  const f=fixture({phase:'opponent'});Component.prototype.moveChance.call(f.app,f.nodes[1]);assert.ok(f.observed.length);assert.deepEqual(f.emitted(),[]);
});
test('canonical-ID recovery materializes native snapshots deleted by expansion without mutating frozen branches',()=>{
  const f=fixture(),input=f.bound(),before=JSON.stringify(input.policy.binding.model),r=E.ngMdpEvaluateExposure(input,{identity:M,math:M});
  assert.equal(r.status,'ready',r.reason);assert.equal(r.records[0].hittingProbability.exact,'1/1');assert.equal(r.provenance.labelAdmission.kind,'admitted-native-label-replay');
  assert.equal(r.provenance.labelAdmission.metadataHash,M.ngMdpDigest(f.metadata));assert.equal(r.provenance.labelAdmission.queryHash,M.ngMdpDigest(input.labels));
  assert.equal(JSON.stringify(input.policy.binding.model),before);assert.ok(Object.isFrozen(f.original));
  const materialized=E.ngMdpMaterializeExposurePolicy(input,{identity:M,math:M});assert.equal(materialized.status,'ready',materialized.reason);assert.deepEqual(materialized.model.states[0].snapshot,f.snapshot);
  const mutated=JSON.parse(JSON.stringify(materialized.model));mutated.states[0].actions[0].studyReads[0].labels[0]={deckKey:'Other|Top',role:'Top'};
  assert.equal(E.ngMdpEvaluateExposure({...input,model:mutated},{identity:M,math:M}).reason,'label-annotation-differs-from-source');
});
test('wrapper refuses positional normalization and wrong law identity instead of transferring equal bonuses',()=>{
  const f=fixture(),wrong={...f.snapshot,positionKey:'Elsewhere|Top'};
  assert.throws(()=>f.adapter.enumerate(wrong),/nonliteral/);
  const g=fixture({positionKey:'missing-role'});assert.throws(()=>g.emitted(),/deck-role/);
  assert.throws(()=>fixture({lawHashes:{...laws,adapter:'wrong'}}),/unsupported-exposure-label-law/);
});
