import { knowledgeSource } from './_knowledge_profile_harness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as K from '../neural/src/knowledge-profile.src.js';
import { ngStudyCreateInputs } from '../neural/src/game-study-inputs.src.js';
const M=createRequire(import.meta.url)('../neural/src/mdp-identity.src.js');
const source=readFileSync(new URL('../neural/src/app.src.jsx',import.meta.url),'utf8');
// The bundle's prelude (wire-keys + knowledge-profile, export-stripped) from the one shared harness.
const Component=new Function('DCLogic','React',knowledgeSource+'\n'+source+'\nreturn Component;')(class {},{createRef:()=>({current:null})});
const startBody=source.slice(source.indexOf('    const rsOk = this._rulesetMask();',source.indexOf('  startRoll() {')),source.indexOf('    this._prefetchLandDeck(this.currentPos);',source.indexOf('  startRoll() {')));
const selectSource=new Function(startBody+'\nreturn {idx:this.currentPos,role:this.playerRole};');
const storage=new Map(); globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:()=>{throw new Error('unexpected-storage-write');}};
const copy=x=>structuredClone(x), number=s=>{const[n,d]=s.split('/').map(Number);return n/d;};
function fixture({mode='next-roll-current-conditions',setting='random',fresh=false}={}) {
  const app=Object.create(Component.prototype),nodes=[],decks={},slugs=new Map();
  for(const [name,slug]of [['Standing Position','standing-position'],['Guard','guard'],['Mount','mount']]) {
    const top=nodes.length,bottom=top+1;nodes.push({id:slug,idx:top,t:name+' Top',ty:'positions',role:'top',rep:true,posId:slug,pairId:slug,pi:bottom,cal:{avail:{gi:true,nogi:true}}},
      {id:slug+'/Bottom',idx:bottom,t:name+' Bottom',ty:'positions',role:'bottom',rep:false,posId:slug,pairId:slug,pi:top,cal:{avail:{gi:true,nogi:true}}});slugs.set(slug,top);
    decks[name+'|Top']={cat:'Position',n:1,cards:[{q:'q'}]};decks[name+'|Bottom']={cat:'Position',n:1,cards:[{q:'q'}]};
  }
  const ti=nodes.length;nodes.push({id:'pass',idx:ti,t:'Pass from Guard',ty:'transitions',role:'attacker',fromRole:'top',fromPositionId:'guard',cal:{avail:{gi:true,nogi:true}}});
  nodes.push({id:'pass/Defender',idx:ti+1,t:'Pass from Guard',ty:'transitions',role:'defender',fromRole:'top',fromPositionId:'guard',cal:{avail:{gi:true,nogi:true}}});
  decks['Pass from Guard|Attacker']={cat:'Transition',n:1,cards:[{q:'q'}]};decks['Pass from Guard|Defender']={cat:'Transition',n:1,cards:[{q:'q'}]};
  const index={_meta:{format:3,status:'generated'},decks:Object.fromEntries(Object.entries(decks).map(([k,v])=>[k,[v.cat,v.n]])),shared:{}};
  Object.assign(app,{nodes,adj:nodes.map(n=>n.ty==='positions'?[ti]:[0,2,4]),_posSlugIndex:slugs,_techSlugIndex:new Map(),_idIndex:new Map(nodes.map(n=>[n.id,n.idx])),
    settings:{startFrom:setting},_giMode:'gi',_evFrame:'nogi',_evLam:[1,2,3],_evLamIdx:()=>0,_epochDay:()=>5,_progressCurrent:()=>true,_progressLoaded:true,
    _gameValueGraph:{status:'verified',hash:'a'.repeat(64)},_gameValueResidencyRevision:1,_gameValueRollRevision:1,_gameValueContextRevision:1,
    maxMoves:12,aiSkill:.07,moveCount:3,currentPos:2,playerRole:'bottom',_posKey:'Guard|Bottom',_qMod:.02,_combo:2,_decision:true,
    _firstRollDone:!fresh,_returning:!fresh,_owedFirst:false,_knowledgeContentRevision:K.ngKnowledgeFingerprint(index),_knowledgeRevision:1,_knowledgeDay:5,
    flashcards:{decks,manifest:true},_sharedQ:new Map(),prep:{},_sharp:{},stage:{},rec:{},srs:{},flow:{},_stageVer:1,_flowVer:2,
    curriculum:{weights:{'Pass from Guard|Attacker':9}},fx(){throw new Error('live-fx');},rng(){throw new Error('live-rng');}});
  const declaration={mode,targets:{kind:'sharp-refresh',deckKeys:['Guard|Top']}};
  const inputs=ngStudyCreateInputs({identity:M,knowledge:K,readDeclaration:()=>declaration});
  const laws={adapter:'b'.repeat(64)},sources={graphHash:app._gameValueGraph.hash,indexHash:'c'.repeat(64),lawHashes:laws};
  const installation={...sources,id:M.ngMdpDigest(sources)},build={sources,mechanics:{graphHash:sources.graphHash,modelHash:'actual-fixture-model',opponentPolicyHash:'actual-fixture-opponent'},
    variants:[{ruleset:'gi',evFrame:'nogi',lossAversion:1,status:'COMPLETE',sha256:'d'.repeat(64),file:'variant-'+ 'd'.repeat(64)+'.json',mechanicsHash:'actual-fixture-mechanics'}],lossAversions:[1,2,3]};
  const args=()=>({app,build,installation,profile:app.knowledgeProfile(),runtime:{residencyRevision:1,deckReady:Object.fromEntries(Object.keys(decks).map(k=>[k,true]))},requestId:'declared-study',revision:2});
  return{app,declaration,inputs,args,index};
}
function ready(f){const r=f.inputs.produceStarts(f.args());assert.equal(r.status,'ready',r.reason);return r;}
function stateBefore(app){return JSON.stringify({keys:Object.keys(app),first:app._firstRollDone,returning:app._returning,owed:app._owedFirst,
  keyNode:app._keyNode?[...app._keyNode]:null,rs:app._rsOk?[...app._rsOk]:null,scoreW:app._scoreW,traffic:app._posTraffic,weak:app._lastWeakWindow,rig:app._rig,sharp:app._sharp,prep:app.prep});}
function actualSelection(f,u,roleU=.25){
  const a=Object.create(f.app);Object.assign(a,{playerRole:roleU<.5?'top':'bottom',_scoreW:{...f.app._scoreW},_keyNode:f.app._keyNode?new Map(f.app._keyNode):null,
    fx(){},rng:tag=>{assert.equal(tag,'start-pos');return u;},_progressLocalKey:()=> 'fixture-firstroll'});
  if(f.app._flowScoreCache)a.flowScore=()=>f.app._flowScoreCache.out;
  const old=globalThis.localStorage;globalThis.localStorage={getItem:old.getItem,setItem(){}};
  try{const selected=selectSource.call(a);return {...selected,positionKey:a.deckKeyFor(a.nodes[selected.idx]).key};}finally{globalThis.localStorage=old;}
}
function assertLawDifferential(f,r){
  // Fixture distribution bins retain source cumulative thresholds. Midpoints
  // verify exact deterministic source branch choice without statistical sampling.
  const law=r.provenance.sourceLaw, rows=law.selection;
  for(const row of rows){const interval=row.interval||null,u=interval?(number(interval[0])+number(interval[1]))/2:(rows.indexOf(row)+.5)/rows.length;
    for(const roleU of [.25,.75]){const selected=actualSelection(f,u,roleU),node=f.app.nodes[selected.idx];
      const target=r.startSnapshots.find(x=>x.snapshot.nodeId===node.id&&x.snapshot.role===selected.role);
      assert.ok(target,node.id+' '+selected.role);assert.equal(target.snapshot.positionKey,selected.positionKey);}}
}

test('returning random law is actual representative playable pool and equal role draw, without live mutation',()=>{
  const f=fixture(),a=f.args(),before=stateBefore(f.app),r=f.inputs.produceStarts(a);assert.equal(r.status,'ready',r.reason);
  assert.equal(r.startDistribution.length,6);assert.ok(r.startDistribution.every(x=>x.probability==='1/6'));
  assert.equal(r.request.horizon.episodeCap,12);assert.equal(r.request.horizon.moveCount,0);assert.equal(r.request.state.aiSkill,.07);
  assert.ok(r.startSnapshots.every(x=>x.snapshot.qMod===0&&x.snapshot.combo===0&&x.snapshot.arrivalAge===0));
  assertLawDifferential(f,r);assert.equal(stateBefore(f.app),before);
});
test('fresh random inverse-CDF exactly follows source gamma/floor intervals and leaves first-roll markers/cache unspent',()=>{
  const f=fixture({fresh:true}),a=f.args(),before=stateBefore(f.app),r=f.inputs.produceStarts(a);assert.equal(r.status,'ready',r.reason);
  assertLawDifferential(f,r);assert.equal(r.provenance.sourceLaw.freshness.fresh,true);
  assert.equal(r.provenance.sourceLaw.prngBitGridIntegrated,false);assert.equal(stateBefore(f.app),before);
  const guard=r.startDistribution.filter(x=>x.stateId.includes('guard'));assert.ok(guard.every(x=>number(x.probability)>.49));
});
test('degraded fresh draw and unavailable Standing fall through to the actual ordinary law',()=>{
  for(const setting of ['random','standing']){const f=fixture({fresh:true,setting});f.app.curriculum=null;if(setting==='standing')f.app._posSlugIndex.delete('standing-position');
    const r=ready(f);assert.ok(r.startDistribution.every(x=>x.probability==='1/6'));assertLawDifferential(f,r);assert.equal(f.app._firstRollDone,false);}
});
test('Standing keeps both actual seats and never spends first-impression flags',()=>{
  const f=fixture({setting:'standing',fresh:true}),r=ready(f);assert.equal(r.startDistribution.length,2);assert.ok(r.startDistribution.every(x=>x.probability==='1/2'));
  assert.ok(r.startSnapshots.every(x=>x.snapshot.nodeId.startsWith('standing-position')));assertLawDifferential(f,r);assert.equal(f.app._firstRollDone,false);
});
test('weak source window deduplicates seats, flips Defender and uses source cumulative FLOW gains',()=>{
  const f=fixture({setting:'weak'});f.app._flowScoreCache={k:'1/2/0/5/gi',out:{ranked:[{deck:'Pass from Guard|Defender',tier:'leaking',gain:3},
    {deck:'Mount|Top',tier:'leaking',gain:1},{deck:'Standing Position|Bottom',tier:'loose',gain:2}]}};
  const a=f.args(),before=stateBefore(f.app),r=f.inputs.produceStarts(a);assert.equal(r.status,'ready',r.reason);assert.equal(r.startDistribution.length,3);
  assertLawDifferential(f,r);assert.ok(r.startSnapshots.some(x=>x.snapshot.nodeId==='guard/Bottom'&&x.snapshot.role==='bottom'));
  assert.equal(stateBefore(f.app),before);
});
test('weak missing authority is named; current cached cold fallback uses ordinary source draw',()=>{
  const f=fixture({setting:'weak'});assert.equal(f.inputs.produceStarts(f.args()).reason,'weak-start-ranking-not-captured');
  f.app._flowScoreCache={k:'1/2/0/5/gi',out:null};const r=ready(f);assert.equal(r.startDistribution.length,6);assert.equal(r.provenance.sourceLaw.fallback,'weak-no-ranking');
});
test('current-position is one exact defense/challenge state and ignores future start RNG',()=>{
  const f=fixture({mode:'current-position'}),sub={id:'submission',idx:f.app.nodes.length,t:'Triangle',ty:'submissions',role:'attacker',fromRole:'top'};
  f.app.nodes.push(sub);f.app.nodes[2].ty='submissions';f.app.nodes[2].role='defender';f.app.nodes[2].pi=sub.idx;f.app._panicKey='Guard|Bottom';f.app._beltTest={names:['triangle'],pointsWin:.4,maxMoves:12,beltId:'white'};
  f.app._rig={'start-pos':[.7]};const r=ready(f);assert.equal(r.startDistribution[0].probability,'1/1');const s=r.startSnapshots[0].snapshot;
  assert.equal(s.moveCount,3);assert.equal(s.qMod,.02);assert.equal(s.combo,2);assert.equal(s.panicKey,'Guard|Bottom');assert.deepEqual(r.request.state.challenge,f.app._beltTest);
  assert.deepEqual(f.app._rig['start-pos'],[.7]);
});
test('keys invalidate physical settings, first-start law, target selection and shared closure',()=>{
  const f=fixture({fresh:true}),a=f.inputs.readInputIdentity(f.app);f.app.curriculum.weights['Pass from Guard|Attacker']=0;
  const b=f.inputs.readInputIdentity(f.app);assert.notEqual(a.startKey,b.startKey);f.declaration.targets.deckKeys=['Mount|Top'];
  const c=f.inputs.readInputIdentity(f.app);assert.notEqual(b.targetKey,c.targetKey);f.app._sharedQ.set('12345678',['Guard|Top','Mount|Top']);
  assert.notEqual(c.targetKey,f.inputs.readInputIdentity(f.app).targetKey);
});
test('current native cap saturation keeps request and snapshot clocks coherent and retains observed count',()=>{
  const f=fixture({mode:'current-position'});f.app.moveCount=14;const r=ready(f);
  assert.equal(r.request.horizon.moveCount,12);assert.equal(r.startSnapshots[0].snapshot.moveCount,12);
  assert.equal(r.provenance.sourceLaw.observedMoveCount,14);assert.equal(f.app.moveCount,14);
});
test('sharp refresh is explicitly selected frozen cap with already-capped exclusions and no earned writes',()=>{
  const f=fixture();f.declaration.targets.deckKeys=['Guard|Top','Mount|Top'];f.app._sharp['Mount|Top']=.10;const a=f.args(),starts=f.inputs.produceStarts(a),before=stateBefore(f.app);
  const r=f.inputs.produceTargets({...a,starts});assert.equal(r.status,'ready',r.reason);assert.deepEqual(r.scenarios,[{targets:[{deckKey:'Guard|Top',role:'Top',sharpTo:.10}]}]);
  assert.equal(r.provenance.skipped[0].deckKey,'Mount|Top');assert.equal(stateBefore(f.app),before);
});
test('joint permanent proposal requires complete transitive shared closure, preserving held-fixed peers',()=>{
  const f=fixture();f.app._sharedQ=new Map([['11111111',['Guard|Top','Mount|Top']],['22222222',['Mount|Top','Standing Position|Bottom']]]);
  f.declaration.targets={kind:'declared-joint',scenarios:[{targets:[{deckKey:'Guard|Top',role:'Top',permanentTo:.03}]}]};
  let a=f.args(),starts=f.inputs.produceStarts(a);assert.equal(f.inputs.produceTargets({...a,starts}).reason,'incomplete-declared-permanent-closure');
  f.declaration.targets.scenarios[0].targets.push({deckKey:'Mount|Top',role:'Top',permanentTo:0},{deckKey:'Standing Position|Bottom',role:'Bottom',permanentTo:0});
  a=f.args();starts=f.inputs.produceStarts(a);const r=f.inputs.produceTargets({...a,starts});assert.equal(r.status,'ready',r.reason);assert.equal(r.scenarios[0].targets.length,3);
  assert.equal(r.scenarios[0].targets.find(t=>t.deckKey==='Mount|Top').permanentTo,0);
});
test('cancelled, rigged, forged-profile and stale-residency inputs fail without consuming a draw',()=>{
  const f=fixture(),a=f.args();assert.equal(f.inputs.produceStarts(a,{aborted:true}).reason,'cancelled');f.app._rig={'start-pos':[.5]};
  assert.equal(f.inputs.produceStarts(a).reason,'rigged-next-roll-law-unsupported');assert.deepEqual(f.app._rig['start-pos'],[.5]);delete f.app._rig;
  const p=copy(a.profile);p.sharp['Guard|Top']=.1;delete p.fingerprint;p.fingerprint=K.ngKnowledgeFingerprint(p);
  assert.equal(f.inputs.produceStarts({...a,profile:p}).reason,'changed-live-study-profile');
  assert.equal(f.inputs.produceStarts({...a,runtime:{...a.runtime,deckReady:{}}}).reason,'stale-study-input-residency');
});
test('explicitly absent mode/targets and invalid full-frame variant cannot silently pick defaults',()=>{
  const f=fixture();delete f.declaration.mode;assert.equal(f.inputs.readInputIdentity(f.app).reason,'missing-declared-study-scope');f.declaration.mode='current-position';
  const a=f.args();a.build.variants[0].evFrame='gi';assert.equal(f.inputs.produceStarts(a).reason,'unavailable-study-input-variant');
});
