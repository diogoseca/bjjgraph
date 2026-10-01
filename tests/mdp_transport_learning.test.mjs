import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const names=['identity','model','client','worker','q','learning'];
const code=names.map(n=>readFileSync(new URL('../neural/src/mdp-'+n+'.src.js',import.meta.url),'utf8')+'\nObject.assign(all,module.exports);').join('\n');
const M=new Function('module','require','const all={};\n'+code+'\nreturn all;')({exports:{}},createRequire(new URL('../neural/src/mdp-model.src.js',import.meta.url)));
function fixture(){
  const request={apiVersion:2,requestId:'r1',revision:1,modelHash:'m',mechanicsHash:'law',graphHash:'g',profileHash:'p',opponentPolicyHash:'opp',ruleset:'gi',state:{id:'s'},horizon:{kind:'eventual'},objective:'max-win/min-loss/min-nontermination',futureStudyPolicy:'no-additional-study-events',requestedActionIds:['safe','route']};
  const model={...request,contractHash:M.ngMdpContractHash(request),states:[{id:'s',actions:[{id:'safe',branches:[{probability:'3/5',terminal:'win'},{probability:'2/5',terminal:'loss'}]},{id:'route',branches:[{probability:1,to:'x'}]}]},{id:'x',actions:[{id:'finish',branches:[{probability:'9/10',terminal:'win'},{probability:'1/10',terminal:'loss'}]}]}]};
  return {model,request};
}
function transport(host={}){
  const events={message:new Set(),error:new Set()},inbound=new Set(),messages=[];
  const worker={terminated:false,addEventListener:(k,fn)=>events[k].add(fn),removeEventListener:(k,fn)=>events[k].delete(fn),terminate(){this.terminated=true;},postMessage(message){messages.push(structuredClone(message));queueMicrotask(()=>{for(const fn of inbound)fn({data:structuredClone(message)});});}};
  const scope={addEventListener:(_k,fn)=>inbound.add(fn),removeEventListener:(_k,fn)=>inbound.delete(fn),postMessage(message){queueMicrotask(()=>{for(const fn of events.message)fn({data:structuredClone(message)});});}};
  const dispose=M.ngMdpInstallWorker(scope,host);return {worker,scope,messages,dispose};
}
test('worker registers once, publishes one frozen coherent snapshot, and consumer exceptions cannot strand promise',async()=>{
  const {model,request}=fixture();let callbacks=0,consumerErrors=0;
  const t=transport(),client=M.ngMdpCreateClient(t.worker,{onSnapshot(){callbacks++;throw new Error('consumer bug');},onConsumerError(){consumerErrors++;}});
  await client.register(model);const response=await client.evaluate(request);
  assert.equal(response.root.outcomes.win,.9);assert.equal(callbacks,1);assert.equal(consumerErrors,1);assert.ok(Object.isFrozen(response.actions[0].outcomes));
  assert.equal(t.messages.filter(m=>m.op==='init').length,1);assert.equal('model' in t.messages.find(m=>m.op==='evaluate'),false);
  await assert.rejects(client.evaluate(request),/duplicate-request-id/);client.destroy();t.dispose();
});
test('compact snapshot hashes/ack bind profile and residency; metadata description remains bounded',async()=>{
  const {model,request}=fixture();let used;
  const t=transport({buildModel(data,req,{snapshot}){used=snapshot;return {...data,contractHash:M.ngMdpContractHash(req)};},describeRoot(data,query){return {status:'ready',modelHash:data.modelHash,coverage:{status:'COMPLETE'},nodeId:query.nodeId,hands:[]};}});
  const client=M.ngMdpCreateClient(t.worker);await client.register(model);
  const identity=await client.updateSnapshot({id:'profile-1',profileHash:'p',profile:{fingerprint:'p',prep:{}},runtime:{deckReady:{defense:true},residencyRevision:2}});
  const req={...request,state:{...request.state,...identity}};const r=await client.evaluate(req);assert.equal(r.root.status,'ready');assert.equal(used.runtime.residencyRevision,2);
  assert.equal(t.messages.filter(m=>m.op==='snapshot').length,1);assert.equal(t.messages.find(m=>m.op==='evaluate').request.state.profile,undefined);
  const description=await client.describeRoot({nodeId:'s',role:'top'});assert.equal(description.nodeId,'s');assert.ok(Object.isFrozen(description));
  await assert.rejects(client.evaluate({...req,requestId:'stale',state:{...req.state,snapshotHash:'bad'}}),/stale-profile/);
  client.destroy();t.dispose();
});
test('stale contract/profile/revision replies are rejected and cancellation has no gameplay outcome',async()=>{
  const {model,request}=fixture();let release;
  const t=transport({buildModel:()=>new Promise(resolve=>{release=()=>resolve(model);})});
  let published=0;const client=M.ngMdpCreateClient(t.worker,{onSnapshot:()=>published++});await client.register(model);
  const pending=client.evaluate(request);await new Promise(resolve=>setImmediate(resolve));
  const good=M.ngMdpSolve(model,request);
  assert.equal(M.ngMdpMatchingResponse(request,{...good,revision:2}),false);
  assert.equal(M.ngMdpMatchingResponse(request,{...good,profileHash:'other'}),false);
  assert.equal(M.ngMdpMatchingResponse(request,{...good,contractHash:'wrong'}),false);
  client.cancel('cancelled-hand');await assert.rejects(pending,/cancelled-hand/);release();await new Promise(resolve=>setImmediate(resolve));assert.equal(published,0);client.destroy();t.dispose();
});
test('hard main-thread worker deadline terminates nonresponding computation',async()=>{
  const {model,request}=fixture();const listeners=new Set();
  const worker={terminated:false,addEventListener(k,fn){if(k==='message')listeners.add(fn);},removeEventListener(k,fn){listeners.delete(fn);},terminate(){this.terminated=true;},postMessage(m){if(m.op==='init')queueMicrotask(()=>listeners.forEach(fn=>fn({data:{op:'ready',registrationId:m.registrationId,modelHash:m.model.modelHash}})));}};
  const client=M.ngMdpCreateClient(worker,{deadlineMilliseconds:15});await client.register(model);await assert.rejects(client.evaluate(request),/worker-computation-deadline/);assert.equal(worker.terminated,true);
});
test('fixed randomized policy keeps full attainable vector and one-time action continuation',()=>{
  const {model,request}=fixture();const r=M.ngMdpEvaluatePolicy(model,request,[['s',[{actionId:'safe',probability:'1/2'},{actionId:'route',probability:'1/2'}]],['x','finish']]);
  assert.equal(r.root.status,'ready',r.root.reason);assert.equal(r.root.outcomes.win,.75);assert.equal(r.root.outcomes.loss,.25);
  assert.equal(r.actions.find(a=>a.actionId==='route').outcomes.win,.9);assert.equal(r.quality.policySemantics,'fixed');assert.equal(r.quality.policyRegretBound,undefined);
});
test('Q comparator trains identical finite-rank kernel across every predeclared seed and independently evaluates full policy',()=>{
  const {model,request}=fixture();const result=M.ngMdpCompareQ(model,request,{samplesPerPair:1024});
  assert.equal(result.status,'ready');assert.deepEqual(result.seeds,[7,23,101]);assert.equal(result.runs.length,3);
  for(const run of result.runs){assert.equal(run.coverage.pairs,3);assert.equal(run.diagnostics.updates,3072);assert.ok(run.metrics.maxActionError<.07);assert.equal(run.metrics.rootRegret,0);assert.equal(run.evaluation.root.outcomes.loss,.1);assert.equal(run.gamma,1);}
  const a=M.ngMdpTrainQ(model,request,{seed:7,samplesPerPair:64}),b=M.ngMdpTrainQ(model,request,{seed:7,samplesPerPair:64});assert.deepEqual(a.q,b.q);
  const cyclic={...model,states:[{id:'s',actions:[{id:'stay',branches:[{probability:1,to:'s'}]}]}]};assert.match(M.ngMdpTrainQ(cyclic,request).reason,/finite-rank/);
  console.log('MDP_Q_MEASURE '+JSON.stringify(result.runs.map(r=>({seed:r.seed,updates:r.diagnostics.updates,milliseconds:r.diagnostics.elapsedMilliseconds,...r.metrics,unseen:r.coverage.unseenPositiveBranches}))));
});
test('sample coverage reports unobserved rare positive branches, not invented zero odds',()=>{
  const {model,request}=fixture();model.states=[{id:'s',actions:[{id:'rare',branches:[{probability:'1/1000000000',terminal:'loss'},{probability:'999999999/1000000000',terminal:'win'}]}]}];
  const r=M.ngMdpTrainQ(model,request,{seed:7,samplesPerPair:2});assert.equal(r.status,'ready');assert.equal(r.coverage.positiveBranches,2);assert.equal(r.coverage.unseenPositiveBranches,1);assert.equal(r.diagnostics.convergenceClaim,false);
});
test('Q comparator deliberately uses the exact DAG reference above the 128-state production switch',()=>{
  const {request}=fixture();request.state={id:'s0'};delete request.requestedActionIds;
  const states=Array.from({length:129},(_,i)=>({id:'s'+i,actions:[{id:'forward',branches:[i===128?{probability:1,terminal:'win'}:{probability:1,to:'s'+(i+1)}]}]}));
  const model={...request,states,contractHash:M.ngMdpContractHash(request)};
  const result=M.ngMdpCompareQ(model,request,{samplesPerPair:4});
  assert.equal(result.status,'ready',result.reason);assert.equal(result.reference.quality.numericalStatus,'exact-rational');
  assert.equal(result.reference.states.length,129);assert.equal(result.runs.length,3);
  for(const run of result.runs){assert.equal(run.metrics.rootRegret,0);assert.equal(run.metrics.maxActionError,0);}
  const rejected=M.ngMdpCompareQ(model,request,{samplesPerPair:4,maxStates:128});
  assert.equal(rejected.status,'unavailable');assert.match(rejected.reason,/state-budget/);
});
test('Q table construction and rejection draws obey explicit bit and cancellation budgets',()=>{
  const action={branches:[{p:[1n,3n]},{p:[2n,3n]}]};
  assert.throws(()=>M.ngMdpSamplingTable(action,{maxRationalBits:2}),/denominator-budget/);
  assert.throws(()=>M.ngMdpSamplingTable(action,{maxRationalBits:NaN}),/sampling-bit-budget/);
  assert.throws(()=>M.ngMdpSamplingTable(action,{},()=>{throw new Error('cancelled-table');}),/cancelled-table/);
  const table=M.ngMdpSamplingTable(action);let checks=0;
  assert.throws(()=>M.ngMdpSampleIndex(table,()=>4294967295,()=>{if(++checks===3)throw new Error('cancelled-rejection');}),/cancelled-rejection/);
  const {model,request}=fixture();assert.match(M.ngMdpTrainQ(model,request,{maxRationalBits:NaN}).reason,/invalid-budget/);
});
test('joint study scenarios use measured provider delta, exact role exposure, and full start/context stamps',async()=>{
  const {request}=fixture();const startDistribution=[{stateId:'s',probability:'1/1'}];
  const deck={deckKey:'Submission|Defender',role:'Defender',headroom:.03};
  const scenarios=['a','b','joint'].map(id=>({id,profileHash:id,deckKeys:[deck],changes:{id},request:{...request,requestId:id,profileHash:id,modelHash:'m-'+id}}));
  const input={request,startDistribution,exposurePolicyId:'base-policy',baseline:{profileHash:request.profileHash,request},scenarios};
  const providers={evaluate:async({request:r,startDistributionHash})=>({status:'ready',stamp:M.ngMdpEnvelope(r),startDistributionHash,policyId:r.profileHash==='p'?'base-policy':'policy-'+r.profileHash,outcomes:{win:r.profileHash==='p'?.4:r.profileHash==='joint'?.52:.5,loss:r.profileHash==='p'?.6:r.profileHash==='joint'?.48:.5,explicitNoResult:0,nontermination:0}}),exposure:async({request:r,startDistributionHash,policyId})=>({status:'ready',stamp:M.ngMdpEnvelope(r),startDistributionHash,policyId,records:[{deckKey:deck.deckKey,role:'Defender',status:'ready',kind:'hitting-probability',value:.2}]})};
  const r=await M.ngMdpEvaluateStudyScenarios(input,providers);assert.equal(r.status,'ready');assert.equal(r.coverage.readyScenarios,3);assert.ok(Math.abs(r.scenarios[2].simulatedWinDelta-.12)<1e-14);assert.notEqual(r.scenarios[2].simulatedWinDelta,r.scenarios[0].simulatedWinDelta+r.scenarios[1].simulatedWinDelta);
  const wrong=await M.ngMdpEvaluateStudyScenarios(input,{...providers,exposure:async args=>({...await providers.exposure(args),records:[{deckKey:'Submission|Attacker',role:'Attacker',status:'ready',kind:'hitting-probability',value:1}]})});assert.equal(wrong.status,'unavailable');assert.equal(wrong.scenarios[0].simulatedWinDelta,undefined);
  const stale=await M.ngMdpEvaluateStudyScenarios(input,{...providers,evaluate:async args=>({...await providers.evaluate(args),startDistributionHash:'other'})});assert.equal(stale.status,'unavailable');assert.match(stale.unresolvedReasons[0],/stale-baseline/);
  const compressed=await M.ngMdpEvaluateStudyScenarios(input,{...providers,exposure:async args=>({...await providers.exposure(args),stateEquivalence:{exposureLabelsPreserved:false}})});assert.equal(compressed.status,'unavailable');assert.match(compressed.scenarios[0].reason,/value-only-compression/);
});
