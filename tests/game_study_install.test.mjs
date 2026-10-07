import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as K from '../neural/src/knowledge-profile.src.js';
import { ngGameplanStudyInstall } from '../neural/src/game-study-install.src.js';
const M=createRequire(import.meta.url)('../neural/src/mdp-identity.src.js');
const flush=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
function clock(){let at=0,id=0;const timers=new Map();return {now:()=>at,setTimer(fn,delay){timers.set(++id,{fn,at:at+delay});return id;},clearTimer(i){timers.delete(i);},
  advance(ms){at+=ms;for(const [i,t]of [...timers])if(t.at<=at){timers.delete(i);t.fn();}},timers};}
function fixture(){
  const time=clock(),workers=[],states=[],errors=[],counts={admit:0,release:0,live:0,profile:0};let generation=1;
  const index={_meta:{format:3,status:'generated'},decks:{'Mount|Top':['Position',1]},shared:{}};
  const profile=K.ngKnowledgeBuildProfile({revision:1,day:5,contentRevision:K.ngKnowledgeFingerprint(index),evidenceRevision:'fixture-evidence'});
  const node={id:'Mount',idx:0,t:'Mount Top',ty:'positions',role:'top',cal:{avail:{gi:true,nogi:true}}};
  const app={_progressLoaded:true,_progressOwnerStamp:{privateOwner:'HOST_ONLY'},_progressCurrent:()=>true,_giMode:'gi',_evFrame:'nogi',_evLam:[2],_evLamIdx:()=>0,
    _gameValueGraph:{status:'verified',hash:'a'.repeat(64)},_gameValueResidencyRevision:1,_gameValueRollRevision:1,_gameValueContextRevision:1,
    _gameplanStudyDeclaration:{mode:'current-position',targets:{kind:'sharp-refresh',deckKeys:['Mount|Top']}},
    nodes:[node],currentPos:0,playerRole:'top',moveCount:0,maxMoves:12,aiSkill:.07,_decision:true,_posKey:'Mount|Top',_qMod:0,_combo:0,
    _knowledgeContentRevision:profile.contentRevision,flashcards:{decks:{'Mount|Top':{cat:'Position',n:1,cards:[{q:'HOST_ONLY question'}]}}},_sharedQ:new Map(),
    _dataBase:()=>'/assets/neural/',_checkKnowledgeDay:()=>5,_epochDay:()=>5,knowledgeProfile(){counts.profile++;return profile;},_gameplanStamp:()=>profile.fingerprint,
    _gameplanDecks:()=>({'Mount|Top':{allowed:true,count:1,exact:true,questions:['questionHash'],headroom:.15}}),
    _deckHasCards:()=>true,_deckCardCount:d=>d.n,canonicalState:i=>i,submissionNode:()=>null,deckKeyFor:()=>({key:'Mount|Top'}),deckCat:()=> 'Position',
    nodeForKey:()=>0,giAllows:()=>true,startFrom:()=> 'random',get:(_k,d)=>d,
    setGameplanRecommendations(p){this._gameplanProvider=p;return true;},
    _choiceValueSource:{cancel(){counts.live++;},destroy(){counts.live++;},evaluate(){counts.live++;}},_session:{keys:['frozen'],idx:0}};
  const build={version:'fixture-version',sources:{graphHash:app._gameValueGraph.hash,indexHash:'b'.repeat(64),lawHashes:{identity:'c'.repeat(64)}},
    mechanics:{graphHash:app._gameValueGraph.hash,modelHash:'fixture-model',opponentPolicyHash:'fixture-opponent'},lossAversions:[2],
    variants:[{status:'COMPLETE',ruleset:'gi',evFrame:'nogi',lossAversion:2,mechanicsHash:'fixture-mechanics',sha256:'d'.repeat(64),file:'variant-'+ 'd'.repeat(64)+'.json'}],
    computation:{study:{scheduler:{maxRequestNodes:10000,maxRequestBytes:100000,maxResultNodes:20000,maxResultBytes:200000,maxDepth:48,
      maxStarts:8,maxScenarios:8,maxTargets:8,maxQueueMilliseconds:1000,maxRunMilliseconds:5000}}}};
  class Worker{constructor(url,options){this.url=url;this.options=options;this.messages=[];this.listeners=new Map();this.terminations=0;workers.push(this);}
    postMessage(m){this.messages.push(m);}addEventListener(k,f){this.listeners.set(k,f);}removeEventListener(k,f){if(this.listeners.get(k)===f)this.listeners.delete(k);}
    terminate(){this.terminations++;}reply(type='result',extra={}){const m=this.messages.find(m=>m.type==='run');this.listeners.get('message')?.({data:{protocol:m.protocol,jobId:m.jobId,key:m.key,type,
      result:{status:'unavailable',reason:'fixture-no-model-calculation',receipts:{}},...extra}});}}
  const options={build,identity:M,knowledge:K,attempt:1,ownerStamp:app._progressOwnerStamp,isCurrent:()=>generation===1,
    expectedVersion:build.version,documentURL:'https://example.test/page',Worker,...time,presenterBounds:{maxScenarios:8,maxDecks:8,maxEvidenceNodes:20000,maxStringLength:10000},
    admit(){counts.admit++;return {status:'admitted',id:'fixture-lease:'+counts.admit,expiresAt:time.now()+5000,release(){counts.release++;}};},
    onState:s=>states.push(s),reportError:e=>errors.push(e)};
  function install(extra={}){const o={...options,...extra},host=ngGameplanStudyInstall(app,o);app._gameStudyHost=host;return host;}
  return {app,options,install,time,workers,states,errors,counts,generation:v=>{generation=v;}};
}

test('construction/reconcile are inert; explicit request uses actual producer and pinned classic worker',async()=>{
  const f=fixture(),h=f.install();assert.equal(h.snapshot().phase,'idle');h.reconcile('stats');assert.equal(f.counts.profile,0);assert.equal(f.counts.admit,0);assert.equal(f.workers.length,0);
  const result=h.request('open-plan');await flush();assert.equal(f.workers.length,1);const w=f.workers[0],u=new URL(w.url);
  assert.equal(u.pathname,'/assets/neural/app/game-study.worker.js');assert.equal(u.searchParams.get('v'),'fixture-version');assert.equal(u.searchParams.get('content'),M.ngMdpDigest(f.options.build));
  assert.equal(u.searchParams.get('attempt'),'1');assert.match(u.searchParams.get('instance'),/^study-install:/);assert.equal(w.options.type,'classic');
  const job=w.messages[0].job;assert.equal(job.startDistribution[0].probability,'1/1');assert.deepEqual(job.scenarios,[{targets:[{deckKey:'Mount|Top',role:'Top',sharpTo:.1}]}]);
  assert.ok(!JSON.stringify(job).includes('HOST_ONLY'));w.reply();assert.equal((await result).phase,'unavailable');assert.equal(f.counts.release,1);assert.equal(w.terminations,1);
  assert.equal(f.time.timers.size,0);assert.equal(f.counts.live,0);assert.deepEqual(f.app._session,{keys:['frozen'],idx:0});h.destroy();assert.equal(f.counts.release,1);
});
test('missing Worker, browser admission or explicit declaration stays unavailable without a fake job',async()=>{
  for(const kind of ['worker','admit','declaration']){const f=fixture();if(kind==='declaration')delete f.app._gameplanStudyDeclaration;
    const h=f.install(kind==='worker'?{Worker:null}:kind==='admit'?{admit:null}:{}),r=await h.request('open-plan');
    assert.equal(r.phase,'unavailable');assert.match(r.reason,/worker-capability|admission-policy|declared-study-scope/);assert.equal(f.workers.length,0);assert.equal(f.counts.admit,0);h.destroy();}
});
test('stale import generation/owner or mismatched graph is rejected before replacing a valid host',()=>{
  const f=fixture(),h=f.install();
  for(const extra of [{isCurrent:()=>false},{ownerStamp:{}},{build:{...f.options.build,version:'different'}}])assert.throws(()=>f.install(extra),e=>e.phase==='unavailable');
  assert.equal(h.snapshot().phase,'idle');f.app._gameValueGraph={status:'verified',hash:'e'.repeat(64)};assert.throws(()=>f.install(),/unverified-study-install-graph/);h.destroy();
});
test('live-card work preempts only study, then resumes the same explicit intent',async()=>{
  const f=fixture(),h=f.install(),p=h.request('open-plan');await flush();assert.equal(f.workers.length,1);
  f.app._choiceValueQueued=true;h.reconcile('live-priority');assert.equal(f.workers[0].terminations,1);assert.equal(f.counts.release,1);assert.equal(h.snapshot().phase,'queued');
  f.app._choiceValueQueued=false;h.reconcile('live-settled');await flush();assert.equal(f.workers.length,2);f.workers[1].reply();await p;
  assert.equal(f.counts.release,2);assert.equal(f.counts.live,0);h.destroy();
});
test('replacement waits for stale backend admission and releases its late lease once before new admission',async()=>{
  const f=fixture();let grant;const old=f.install({admit(){f.counts.admit++;return new Promise(resolve=>{grant=resolve;});}}),p=old.request('open-plan');await flush();
  f.generation(2);const next=f.install({attempt:2,isCurrent:()=>true}),q=next.request('retry');await flush();assert.equal(f.counts.admit,1);assert.equal(f.workers.length,0);
  grant({status:'admitted',id:'late',expiresAt:5000,release(){f.counts.release++;}});await flush();assert.equal(f.counts.release,1);assert.equal(f.counts.admit,2);
  assert.equal(f.workers.length,1);assert.equal(new URL(f.workers[0].url).searchParams.get('attempt'),'2');f.workers[0].reply();await q;assert.equal((await p).phase,'destroyed');
  assert.equal(f.counts.release,2);next.destroy();assert.equal(f.time.timers.size,0);
});
test('actual scheduler hard deadline terminates worker and releases only its admitted lease',async()=>{
  const f=fixture(),h=f.install(),p=h.request('open-plan');await flush();f.time.advance(5001);await flush();
  const r=await p;assert.equal(r.phase,'unavailable');assert.equal(r.reason,'study-hard-deadline');assert.equal(f.workers[0].terminations,1);assert.equal(f.counts.release,1);assert.equal(f.time.timers.size,0);h.destroy();
});
test('worker construction failure and malformed backend lease cannot leak or manufacture valid admission',async()=>{
  const f=fixture(),h=f.install({Worker:class{constructor(){throw Error('fixture-worker-constructor');}}});const r=await h.request('open-plan');
  assert.equal(r.phase,'error');assert.equal(f.counts.release,1);h.destroy();
  const g=fixture(),i=g.install({admit:()=>({status:'admitted',id:'bad',expiresAt:5000})});const s=await i.request('open-plan');assert.equal(s.phase,'unavailable');
  assert.equal(s.reason,'invalid-study-admission-lease');assert.equal(g.workers.length,0);i.destroy();
});
test('owner or build replacement invalidates installed controller without reusing live profile context',async()=>{
  for(const kind of ['owner','build']){const f=fixture(),h=f.install(),p=h.request('open-plan');await flush();
    if(kind==='owner')f.app._progressOwnerStamp={};else f.options.build.version='changed';h.reconcile('changed');await p;
    assert.equal(f.workers[0].terminations,1);assert.equal(f.counts.release,1);assert.equal(f.counts.live,0);h.destroy();}
});
