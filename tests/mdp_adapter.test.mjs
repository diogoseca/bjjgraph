import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const M=new Function('module','require',read('neural/src/mdp-identity.src.js')+'\n'+read('neural/src/mdp-model.src.js')+'\nconst core=module.exports;\n'+read('neural/src/mdp-adapter.src.js')+'\nreturn {...core,...module.exports};')({exports:{}}, createRequire(new URL('../neural/src/mdp-model.src.js',import.meta.url)));
const knowledgePath=process.env.BJJ_MDP_KNOWLEDGE_SOURCE || new URL('../neural/src/knowledge-profile.src.js',import.meta.url);
// Integration dependency is mandatory, including CI. Standalone worker checkouts
// explicitly supply the sibling's source path; no fake arithmetic or silent skip.
const knowledgeSource=readFileSync(knowledgePath,'utf8');
const K=await import('data:text/javascript;base64,'+Buffer.from(knowledgeSource).toString('base64'));
const Component=new Function('DCLogic','React',read('neural/src/app.src.jsx')+'\nreturn Component;')(class {},{createRef:()=>({current:null})});
function setup(options={}) {
  const nodes=[
    {id:'pT',t:'Position Top',ty:'positions',role:'top',pairId:'pB',deckKey:'Position|Top',s:[.2,-.2]},
    {id:'pB',t:'Position Top',ty:'positions',role:'bottom',pairId:'pT',deckKey:'Position|Bottom',s:[.2,-.2]},
    {id:'sA',t:'Submission',ty:'submissions',role:'attacker',fromRole:'top',submissionId:'sA',pairId:'sD',deckKey:'Submission|Attacker',s:[.8,-.8],cal:{successRate:60,successRateByRuleset:{gi:60,nogi:40},outcomes:[{probability:60,result:'success',to:'game-over'},{probability:40,result:'failure',to:'pos/top'}],defenses:[{id:'posture',to:'pos/bottom'}]}},
    {id:'sD',t:'Submission',ty:'submissions',role:'defender',fromRole:'top',submissionId:'sA',pairId:'sA',deckKey:'Submission|Defender',s:[.8,-.8]},
    {id:'tA',t:'Transition',ty:'transitions',role:'attacker',fromRole:'top',deckKey:'Transition|Attacker',s:[.1,-.1],cal:{successRate:60,outcomes:[{probability:60,result:'success',to:'pos/top'},{probability:20,result:'failure',to:'pos/top'},{probability:20,result:'counter',to:'pos/bottom'}]}}
  ].map(n=>({allowed:true,dom:0,poolName:n.t.toLowerCase(),...n}));
  const hands={};
  for(const p of ['pT','pB']) {
    hands[M.ngMdpStable([p,'top'])]=[{techniqueId:'sA',kind:'entry',destinationId:null},{techniqueId:'tA',kind:'transition',destinationId:'pT'}];
    hands[M.ngMdpStable([p,'bottom'])]=options.subsOnly?[{techniqueId:'sA',kind:'entry',destinationId:null}]:[];
  }
  for(const s of ['sA','sD']) {
    hands[M.ngMdpStable([s,'top'])]=[{techniqueId:'sA',kind:'finish',destinationId:null}];
    hands[M.ngMdpStable([s,'bottom'])]=[{techniqueId:'sD',kind:'escape',destinationId:'pB',destinationRole:'bottom',defense:{id:'posture',to:'pos/bottom'}}];
  }
  const graph={version:1,ruleset:options.ruleset||'gi',evFrame:'nogi',nodes,hands,evHands:{},canonical:{},deckReady:{'Submission|Defender':true},destinations:{'game-over':{terminal:true,nodeId:null,role:null},'pos/top':{nodeId:'pT',role:'top',terminal:false},'pos/bottom':{nodeId:'pB',role:'bottom',terminal:false}},coverage:{status:'COMPLETE'}};
  const profile=K.ngKnowledgeBuildProfile(options.profile||{prep:{'Position|Top':2,'Submission|Attacker':1,'Submission|Defender':3},sharp:{'Position|Top':.1,'Submission|Defender':.1}});
  const adapter=M.ngMdpCreateGameAdapter(graph,profile,K);
  const snapshot={nodeId:'pT',role:'top',phase:'user',moveCount:8,arrivalAge:0,qMod:-.04,combo:3,positionKey:'Position|Top',panicKey:null,aiSkill:.07,...options.snapshot};
  const request={apiVersion:2,requestId:'r',revision:1,modelHash:'model',mechanicsHash:'law',graphHash:'graph',profileHash:profile.fingerprint,opponentPolicyHash:'opponent',ruleset:graph.ruleset,state:{id:'',snapshot,aiSkill:.07,...options.state},horizon:{kind:'actual-roll',episodeCap:9,moveCount:snapshot.moveCount},objective:'max-win/min-loss/min-nontermination',futureStudyPolicy:'no-additional-study-events'};
  request.state.id=adapter.stateId(snapshot,request);
  return {graph,profile,adapter,request,snapshot};
}
const p=b=>M.ngMdpNumber(M.ngMdpRat(b.probability));

test('entry is deterministic, preserves the cap opportunity and applies exactly one arrival',()=>{
  const {adapter,request,snapshot}=setup();const row=adapter.enumerate(snapshot,request).actions.find(a=>a.kind==='entry');
  assert.equal(row.immediateExecutionChance,1);assert.equal(row.immediateExecutionKind,'entry');assert.equal(row.branches.length,1);
  const next=row.branches[0].next;assert.equal(next.nodeId,'sA');assert.equal(next.moveCount,9);assert.equal(next.arrivalAge,1);assert.equal(next.qMod,0);assert.equal(next.combo,3);assert.equal(next.positionKey,'Submission|Attacker');
  assert.ok(adapter.enumerate(next,request).actions.some(a=>a.kind==='finish'));
});

test('same-state miss costs zero, changed-state miss increments without cap check, success checks cap',()=>{
  const {adapter,request,snapshot}=setup();const action=adapter.enumerate(snapshot,request).actions.find(a=>a.kind==='transition');
  const same=action.branches.find(b=>b.events.includes('same-state-miss')),changed=action.branches.find(b=>b.events.includes('changed-state-miss')),success=action.branches.find(b=>b.events.includes('success'));
  assert.equal(same.next.moveCount,8);assert.equal(same.next.phase,'opponent');assert.equal(same.next.qMod,-.04);
  assert.equal(changed.next.moveCount,9);assert.equal(changed.next.phase,'opponent');assert.equal(changed.next.role,'bottom');assert.equal(changed.terminal,undefined);
  assert.equal(success.terminal,'explicitNoResult');assert.equal(success.subtype,'cap-reset');
  assert.ok(Math.abs(action.branches.reduce((sum,b)=>sum+p(b),0)-1)<1e-12);
});

test('Finish at cap wins before counter check and shared override bypass remains exact',()=>{
  const {adapter,request,snapshot}=setup({profile:{prep:{},sharp:{},userMods:[{name:'Submission',on:true,pct:95}]},snapshot:{nodeId:'sA',moveCount:9,positionKey:'Submission|Attacker'}});
  const a=adapter.enumerate(snapshot,request).actions[0];assert.equal(a.immediateExecutionChance,.95);
  const win=a.branches.find(b=>b.terminal==='win');assert.equal(p(win),.95);assert.deepEqual(win.events,['commit','success','terminal']);
  const miss=a.branches.find(b=>b.next);assert.equal(miss.next.phase,'opponent');assert.equal(miss.next.moveCount,9);
});

test('defense uses its frozen fallback deck, escape does not immediately check cap, current aiSkill is mandatory',()=>{
  const {adapter,request,snapshot,profile,graph}=setup({snapshot:{nodeId:'sD',role:'bottom',positionKey:'Submission|Defender',panicKey:'Position|Top',moveCount:9}});
  const a=adapter.enumerate(snapshot,request).actions[0];
  const expected=K.ngKnowledgeEscapeChance({calibrated:.6,destinationValue:-.2,submissionValue:-.8,defenseBonus:K.ngKnowledgeBonus(profile,'Position|Top').total,aiSkill:.07,momentum:.05});
  assert.equal(a.immediateExecutionChance,expected);assert.equal(a.branches.find(b=>b.next).next.moveCount,9);assert.equal(a.branches.find(b=>b.next).next.nodeId,'pB');
  assert.equal(a.branches.find(b=>b.terminal).terminal,'loss');
  assert.throws(()=>M.ngMdpCreateGameAdapter({...graph,coverage:{status:'INCOMPLETE'}},profile,K),/incomplete/);
  delete request.state.aiSkill;delete request.state.snapshot.aiSkill;assert.throws(()=>adapter.enumerate(snapshot,request),/sampled-opponent/);
});

test('opponent submissions-only law preserves distinct .9 attack and .1 full-outcome fallback',()=>{
  const {adapter,request,snapshot}=setup({subsOnly:true,snapshot:{phase:'opponent',moveCount:7}});
  const branches=adapter.enumerate(snapshot,request).actions[0].branches;
  const attacks=branches.filter(b=>b.events.includes('opponent-submission'));
  const fallback=branches.filter(b=>b.events.includes('opponent-positional'));
  assert.equal(attacks.reduce((sum,b)=>sum+p(b),0),.9);assert.ok(Math.abs(fallback.reduce((sum,b)=>sum+p(b),0)-.1)<1e-15);
  const caught=attacks[0].next;assert.equal(caught.nodeId,'sD');assert.equal(caught.moveCount,7);assert.equal(caught.arrivalAge,0);assert.equal(caught.qMod,-.04);assert.equal(caught.combo,3);
  assert.equal(fallback.length,2); // terminal full-table draw lands back at current position
});

test('gi/nogi rates differ under the same legal mechanics; full expansion is bound to exact context',()=>{
  const gi=setup({snapshot:{nodeId:'sA',positionKey:'Submission|Attacker'}}),nogi=setup({ruleset:'nogi',snapshot:{nodeId:'sA',positionKey:'Submission|Attacker'}});
  assert.notEqual(gi.adapter.enumerate(gi.snapshot,gi.request).actions[0].immediateExecutionChance,nogi.adapter.enumerate(nogi.snapshot,nogi.request).actions[0].immediateExecutionChance);
  const model=M.ngMdpExpand(gi.adapter,gi.request,{maxStates:200,maxBranches:2000});assert.equal(model.contractHash,M.ngMdpContractHash(gi.request));
  assert.ok(model.states.length>1);const result=M.ngMdpSolve(model,gi.request);assert.equal(result.root.status,'ready',result.root.reason);
  assert.equal(M.ngMdpSolve(model,{...gi.request,horizon:{kind:'eventual'}}).root.status,'unavailable');
});

test('behavior compression preserves root identity and values; unequal deck effects remain distinct',()=>{
  const f=setup({profile:{prep:{},sharp:{}}});
  const a={...f.snapshot,positionKey:'one|Top'},b={...f.snapshot,positionKey:'two|Top'};
  assert.equal(f.adapter.behaviorKey(a,f.request),f.adapter.behaviorKey(b,f.request));
  const learned=M.ngMdpCreateGameAdapter(f.graph,K.ngKnowledgeBuildProfile({prep:{'two|Top':2},sharp:{}}),K);
  assert.notEqual(learned.behaviorKey(a,f.request),learned.behaviorKey(b,f.request));
  const resident=M.ngMdpCreateGameAdapter(f.graph,f.profile,K,{deckReady:{'two|Top':true}});
  assert.notEqual(resident.behaviorKey(a,f.request),resident.behaviorKey(b,f.request));
  const compressed=M.ngMdpExpand(f.adapter,f.request),literal=M.ngMdpExpand(f.adapter,f.request,{behaviorCompression:false});
  assert.ok(compressed.states.length<=literal.states.length);assert.equal(compressed.states[0].id,f.request.state.id);
  const c=M.ngMdpSolve(compressed,f.request),l=M.ngMdpSolve(literal,f.request);
  assert.deepEqual(c.root.outcomes,l.root.outcomes);assert.deepEqual(c.actions.map(r=>r.outcomes),l.actions.map(r=>r.outcomes));
});

test('every literal member has equal semantic actions and exact class mass; deck labels remain unpreserved',()=>{
  const f=setup({subsOnly:true,profile:{prep:{'DeckA|Top':2},sharp:{'DeckB|Top':.06}},snapshot:{moveCount:9}});
  const residency={'DeckA|Top':true,'DeckB|Top':true};
  const base=M.ngMdpCreateGameAdapter(f.graph,f.profile,K,{deckReady:residency});
  const starts=['DeckA|Top','DeckB|Top'].map(positionKey=>base.normalize({...f.snapshot,positionKey},f.request));
  const root={...starts[0],nodeId:'audit-root',positionKey:null};
  const adapter={...base,normalize:(s,r)=>s.nodeId==='audit-root'?s:base.normalize(s,r),
    stateId:(s,r)=>s.nodeId==='audit-root'?M.ngMdpStateId(s):base.stateId(s,r),
    enumerate:(s,r)=>s.nodeId==='audit-root'?{id:M.ngMdpStateId(s),actions:[{id:'split',branches:starts.map(next=>({probability:'1/2',next}))}]}:base.enumerate(s,r)};
  const request={...f.request,state:{...f.request.state,snapshot:root,id:M.ngMdpStateId(root)}};
  // Independently form classes from literal snapshots, including null panic and
  // residency. Summation below uses local rational arithmetic, not MDP backups.
  const key=s=>M.ngMdpStable([s.nodeId,s.role,s.phase,s.moveCount,s.arrivalAge,s.qMod,s.combo,
    K.ngKnowledgeBonus(f.profile,s.positionKey,s.arrivalAge).total,!!residency[s.positionKey],
    s.panicKey==null?null:K.ngKnowledgeBonus(f.profile,s.panicKey,s.arrivalAge).total]);
  const gcd=(a,b)=>b?gcd(b,a%b):a,add=(a,b)=>{const n=a[0]*b[1]+b[0]*a[1],d=a[1]*b[1],g=gcd(n,d);return[n/g,d/g];};
  const signature=s=>base.enumerate(s,request).actions.map(a=>{
    const mass=new Map();for(const b of a.branches){const k=b.next?'next:'+key(b.next):M.ngMdpStable([b.terminal,b.subtype]),p=b.probability.split('/').map(BigInt);mass.set(k,add(mass.get(k)||[0n,1n],p));}
    return [JSON.parse(a.id).slice(1),a.immediateExecutionChance??null,[...mass].sort().map(([k,p])=>[k,p.join('/')])];
  }).sort((a,b)=>M.ngMdpStable(a[0]).localeCompare(M.ngMdpStable(b[0])));
  const literal=M.ngMdpExpand(adapter,request,{behaviorCompression:false}),compressed=M.ngMdpExpand(adapter,request);
  const classes=new Map();let equivalent=0;
  for(const state of literal.states){const s=JSON.parse(state.id);if(s.nodeId==='audit-root')continue;const group=key(s),sig=signature(s);if(classes.has(group)){assert.deepEqual(sig,classes.get(group));equivalent++;}else classes.set(group,sig);}
  assert.ok(equivalent>0);assert.ok(compressed.states.length<literal.states.length);
  assert.equal(compressed.stateEquivalence.exposureLabelsPreserved,false);assert.equal(compressed.stateEquivalence.futureExplanationLabelsPreserved,false);assert.equal(compressed.stateEquivalence.replayLabelsPreserved,false);
  assert.equal(literal.stateEquivalence.exposureLabelsPreserved,true);
  // Same terminal law cannot identify which of these distinct deck rewards paid.
  assert.equal(key(starts[0]),key(starts[1]));assert.notEqual(starts[0].positionKey,starts[1].positionKey);
  const changed=M.ngMdpCreateGameAdapter(f.graph,K.ngKnowledgeBuildProfile({prep:{'DeckA|Top':3},sharp:{'DeckB|Top':.06}}),K,{deckReady:residency});
  assert.notEqual(changed.behaviorKey(starts[0],request),changed.behaviorKey(starts[1],request));
  assert.notEqual(base.behaviorKey({...starts[0],panicKey:null},request),base.behaviorKey({...starts[0],panicKey:'empty|Defender'},request));
  const c=M.ngMdpSolve(compressed,request,{algorithm:'policy-iteration'}),l=M.ngMdpSolve(literal,request,{algorithm:'policy-iteration'});
  assert.equal(c.root.status,'ready',c.root.reason);assert.equal(l.root.status,'ready',l.root.reason);assert.deepEqual(c.root.outcomes,l.root.outcomes);
});

test('actual source replay agrees with calibrated success/miss routing and belt loss-to-points behavior',()=>{
  const {adapter,request,snapshot,graph}=setup();
  const ns=graph.nodes.map((n,idx)=>({...n,idx,pi:graph.nodes.findIndex(x=>x.id===n.pairId)}));
  function appFor(){
    const a=Object.create(Component.prototype);Object.assign(a,{nodes:ns,currentPos:0,playerRole:'top',moveCount:8,maxMoves:9,_combo:3,_qMod:-.04,aiSkill:.07,_posKey:'Position|Top',_sharp:{'Position|Top':.1},prep:{'Position|Top':2},beats:[],settings:{}});
    for(const name of ['fx','setEvent','flashFx','bumpBounce','flare','clearTimers','clearOptions','_flushSave','ladderMove','track','applyDeckVisibility','showCenter'])a[name]=()=>{};
    a.startTravel=(_path,done)=>done();a.after=(_delay,done)=>done();a.canonicalState=i=>i;a.get=(_key,fallback)=>fallback;a.cfg=()=>({signalSpeed:1});
    a.resolveOutcomeTo=to=>{const r=graph.destinations[to];return {idx:r.nodeId?ns.findIndex(n=>n.id===r.nodeId):-1,role:r.role,terminal:r.terminal};};
    a.opponentDefend=()=>{a.phase='opponent';};a.enterLand=()=>{a.phase='arrival';};a.endRound=kind=>{a.outcome=kind;};return a;
  }
  const opt={idx:4,node:ns[4],res:0};const rows=adapter.enumerate(snapshot,request).actions.find(a=>a.kind==='transition').branches;
  for(const authored of ns[4].cal.outcomes){const a=appFor();const success=authored.result==='success';
    if(success)a.enterSuccessCal(opt,authored);else a.enterFailCal(opt,authored);
    const b=rows.find(r=>success?r.events.includes('success'):authored.result==='failure'?r.events.includes('same-state-miss'):r.events.includes('changed-state-miss'));
    if(a.outcome)assert.equal(b.terminal,'explicitNoResult');else{assert.equal(b.next.nodeId,ns[a.currentPos].id);assert.equal(b.next.role,a.playerRole);assert.equal(b.next.moveCount,a.moveCount);assert.equal(b.next.phase,a.phase);}
  }
  const a=appFor();a.currentPos=2;a.playerRole='top';a._beltTest={pointsWin:.7,names:[],beltId:'test'};a.belts={};a.anim=()=>false;a.after=()=>{};a.evRef={current:null};
  Component.prototype.endRound.call(a,'lose','caught',2);assert.equal(a._lastOutcome,'win');
  const belt=setup({snapshot:{nodeId:'sD',role:'top',positionKey:'Submission|Defender',panicKey:'Submission|Defender'},state:{challenge:{pointsWin:.7,names:[]}}});
  // Same endRound classifier is also exercised on a failed escape when defender
  // value exceeds points threshold (surprising source behavior, deliberately pinned).
  const defended=setup({snapshot:{nodeId:'sD',role:'bottom',positionKey:'Submission|Defender'},state:{challenge:{pointsWin:-.9,names:[]}}});
  assert.equal(defended.adapter.enumerate(defended.snapshot,defended.request).actions[0].branches.find(b=>b.terminal).subtype,'challenge-points-win');
  assert.ok(belt.adapter);
});

test('invalid clocks fail before expansion and user auto-restart bypasses belt classifier',()=>{
  const {adapter,request,snapshot,graph,profile}=setup();
  for(const moveCount of [undefined,NaN,-1,.5,Infinity,Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>adapter.enumerate({...snapshot,moveCount},request),/mechanical-clock/);
  }
  for(const arrivalAge of [undefined,NaN,-1,.5]) assert.throws(()=>adapter.enumerate({...snapshot,arrivalAge},request),/mechanical-clock/);
  assert.throws(()=>M.ngMdpExpand(adapter,{...request,horizon:{...request.horizon,moveCount:7}}),/stale-root-move-count/);
  for(const maxStates of [0,-1,NaN,Infinity,.5])assert.throws(()=>M.ngMdpExpand(adapter,request,{maxStates}),/invalid-budget/);
  assert.throws(()=>M.ngMdpExpand(adapter,request,{maxStates:1}),e=>e.message==='expansion-state-budget'&&e.coverage.status==='INCOMPLETE'&&e.coverage.discoveredStates===1);
  const empty={...graph,hands:{...graph.hands,[M.ngMdpStable(['pT','top'])]:[]}};
  const a=M.ngMdpCreateGameAdapter(empty,profile,K);
  const challenge={...request,state:{...request.state,challenge:{pointsWin:-1,names:[]}}};
  const branch=a.enumerate(snapshot,challenge).actions[0].branches[0];
  assert.equal(branch.terminal,'explicitNoResult');assert.equal(branch.subtype,'user-no-action-restart');
  const opponent=a.enumerate({...snapshot,phase:'opponent'},challenge).actions[0].branches[0];
  assert.equal(opponent.terminal,'win');assert.equal(opponent.subtype,'challenge-points-win');
});

// Explicitly bounded real-data probe, separate from portable fixtures. It is
// opt-in to avoid a corpus job on every generic unit run; requesting it never skips.
if(process.env.BJJ_MDP_WIRE_DIR) test('bounded real-wire adapter topology and all-hand action coverage',()=>{
  const base=resolve(process.env.BJJ_MDP_WIRE_DIR),raw=readFileSync(resolve(base,'graph-data.json'));
  const a=Object.create(Component.prototype);a.settings={};a.beats=[];a.get=(_key,v)=>v;a.set=a.track=a._saveProgress=()=>{};
  a.ingest(JSON.parse(raw));a._giMode='gi';a.aiSkill=.07;a._combo=0;a._qMod=0;a._sharp={};a.prep={};a._deckHasCards=()=>false;
  let defenses=0;
  for(const n of a.nodes.filter(n=>n.rep&&n.ty==='submissions')){const payload=JSON.parse(readFileSync(resolve(base,'submission-details',a.qhash(n.t)+'.json')))[n.t];n.cal.defenses=payload.choices;n._defenseDetails=payload.details;defenses+=payload.choices.length;}
  const graph=M.ngMdpCaptureGameGraph(a);assert.equal(graph.coverage.status,'COMPLETE');assert.ok(defenses>=290);assert.ok(graph.coverage.actions>1000);
  const profile=K.ngKnowledgeBuildProfile({prep:{},sharp:{}}),adapter=M.ngMdpCreateGameAdapter(graph,profile,K);
  const start=a.nodes.find(n=>n.rep&&n.ty==='submissions'&&n.t==='Triangle Choke from Triangle Control');assert.ok(start);
  a.currentPos=start.idx;a.playerRole=start.fromRole;a._posKey=a.deckKeyFor(start).key;a.moveCount=8;a.maxMoves=9;
  const snapshot=M.ngMdpCaptureDecision(a),request={apiVersion:2,requestId:'corpus',revision:1,modelHash:'probe',mechanicsHash:'reference-capture',graphHash:createHash('sha256').update(raw).digest('hex'),profileHash:profile.fingerprint,opponentPolicyHash:'actual',ruleset:'gi',state:{id:'',snapshot,aiSkill:a.aiSkill},horizon:{kind:'actual-roll',episodeCap:9,moveCount:8},objective:'max-win/min-loss/min-nontermination',futureStudyPolicy:'no-additional-study-events'};
  request.state.id=adapter.stateId(snapshot,request);
  const started=performance.now();let model,unavailable=null;
  try{model=M.ngMdpExpand(adapter,request,{maxStates:1600,maxBranches:60000,maxMilliseconds:10000});}catch(e){unavailable=e.message;}
  const report={graphHash:request.graphHash,metadataBytes:Buffer.byteLength(JSON.stringify(graph)),graphCoverage:graph.coverage,defenses,start:start.id,scope:'one gi submission start at sampled cap9 count8; all reachable actions, bounded preparation',elapsedMilliseconds:performance.now()-started,peakRssKiB:process.resourceUsage().maxRSS,unavailable};
  if(model){report.expansion=model.adapterCoverage;const byId=new Map(model.states.map(s=>[s.id,s]));const comps=M.ngMdpComponents([...byId.keys()],id=>byId.get(id).actions.flatMap(a=>(a.branches||[]).filter(b=>b.to).map(b=>b.to)));report.topology={components:comps.length,largestComponent:Math.max(...comps.map(c=>c.length))};}
  console.log('MDP_BOUNDED_CORPUS '+JSON.stringify(report));assert.ok(model||unavailable); // named limit is evidence, NOT full solve success
});
