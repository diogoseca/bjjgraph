import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ngGameplanStudyBrowserAdmission,ngGameplanStudyInstallBrowser} from '../neural/src/game-study-browser.src.js';
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


const documentFixture=()=>({baseURI:'https://example.test/game',visibilityState:'visible'});
function installed(extra={}){const f=fixture(),document=documentFixture();f.options.build.computation.study.manifest={maxDecks:8};
  f.options.document=document;Object.assign(f.options,extra);const host=ngGameplanStudyInstallBrowser(f.app,f.options);f.app._gameStudyHost=host;return {...f,document,host};}
const source=readFileSync(new URL('../neural/src/app.src.jsx',import.meta.url),'utf8');
function method(name){const m=new RegExp('^  (?:async )?'+name+'\\([^\\n]*\\) \\{','m').exec(source);assert.ok(m,name);const tail=source.slice(m.index),next=/\n  (?:async )?[A-Za-z_$][\w$]*\([^\n]*\) \{/.exec(tail.slice(1));return next?tail.slice(0,next.index+1):tail;}
const App=Function('return class {\n'+['_requestGameplanStudy','_dispatchGameplanStudy','_gameStudyChanged','_destroyGameplanStudy','_gameplanStamp','startFrom'].map(method).join('\n')+'\n}')();
test('actual browser host construction is inert and exposes controls without inventing declaration',async()=>{
 const f=fixture(),doc=documentFixture();delete f.app._gameplanStudyDeclaration;f.options.build.computation.study.manifest={maxDecks:8};
 const h=ngGameplanStudyInstallBrowser(f.app,{...f.options,document:doc});f.app._gameStudyHost=h;
 assert.equal(typeof f.app._gameStudyControlsRuntime,'function');assert.equal(f.app._gameplanStudyDeclaration,undefined);h.reconcile('visibility');
 assert.equal(f.workers.length,0);assert.equal(f.counts.profile,0);assert.equal((await h.request('open-plan')).phase,'unavailable');assert.equal(f.workers.length,0);h.destroy();
});
test('hidden page queues one existing intent, visible reconcile resumes it, settlement removes timers',async()=>{
 const f=installed();f.document.visibilityState='hidden';const p=f.host.request('suggestions');await flush();assert.equal(f.workers.length,0);
 assert.equal(f.host.snapshot().phase,'queued');assert.equal(f.host.snapshot().dependency,'visible-page');
 f.document.visibilityState='visible';f.host.reconcile('day-or-resume');await flush();assert.equal(f.workers.length,1);f.workers[0].reply();await p;
 assert.equal(f.workers[0].terminations,1);assert.equal(f.time.timers.size,0);f.host.reconcile('visible-again');await flush();assert.equal(f.workers.length,1);f.host.destroy();
});
test('hidden queue expiry does not create a fresh request on visibility return',async()=>{
 const f=installed();f.document.visibilityState='hidden';const p=f.host.request('suggestions');await flush();f.time.advance(1001);await flush();
 assert.equal((await p).phase,'unavailable');f.document.visibilityState='visible';f.host.reconcile('day-or-resume');await flush();assert.equal(f.workers.length,0);f.host.destroy();
});
test('browser admission uses one lease, exact declared scope and idempotent release',()=>{
 const f=fixture(),doc=documentFixture(),admit=ngGameplanStudyBrowserAdmission(f.app,{build:f.options.build,document:doc,isCurrent:()=>true,now:f.time.now});
 const meta={scope:{starts:1,scenarios:1}},signal=new AbortController().signal,a=admit(meta,signal);
 assert.equal(a.expiresAt,5000);assert.equal(admit(meta,signal).dependency,'previous-study-worker');a.release();a.release();
 for(const scope of [{starts:0,scenarios:1},{starts:1,scenarios:9},{starts:1.5,scenarios:1}])assert.throws(()=>admit({scope},signal),/outside-admission/);
 const b=admit(meta,signal);a.release();assert.equal(admit(meta,signal).dependency,'previous-study-worker');b.release();
});
test('production default admission and actual scheduler use the same monotonic clock',async()=>{
 const pd=Object.getOwnPropertyDescriptor(globalThis,'performance'),dn=Date.now;
 Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>1000}});Date.now=()=>500;
 let f,p;try{f=installed({now:undefined});p=f.host.request('suggestions');await flush();assert.equal(f.workers.length,1);
  assert.ok([...f.time.timers.values()].some(t=>t.at===5000),'expected full 5000 ms lease, one shared clock');
 }finally{f?.host.destroy();if(p)await p;Object.defineProperty(globalThis,'performance',pd);Date.now=dn;}
});
test('actual app dispatch requires declaration while explicit plan opening still loads controls',async()=>{
 const a=new App(),calls=[];Object.assign(a,{_progressOwnerStamp:{},_progressCurrent:()=>true,_refreshGameplanUI(){},
 _fetchGameplanStudyHost:async()=>({request:i=>{calls.push(i);return Promise.resolve({phase:'unavailable'});},snapshot(){},reconcile(){},destroy(){}})});
 const state=await a._requestGameplanStudy('open-plan');assert.equal(state.phase,'idle');assert.deepEqual(calls,[]);
 a._gameplanStudyDeclaration={mode:'current-position',targets:{kind:'sharp-refresh',deckKeys:['Mount|Top']}};
 await a._requestGameplanStudy('suggestions');assert.deepEqual(calls,['suggestions']);a._destroyGameplanStudy();
});
test('app preserves unavailable factory errors and stale import cannot dispatch an old owner intent',async()=>{
 const a=new App();let resolve,calls=0;Object.assign(a,{_progressOwnerStamp:{},_progressCurrent:()=>true,_refreshGameplanUI(){},_gameplanStudyDeclaration:{},
 _fetchGameplanStudyHost:()=>Promise.reject(Object.assign(Error('unverified-study-install-graph'),{phase:'unavailable'}))});
 await a._requestGameplanStudy('open-plan');assert.equal(a._gameStudyState.phase,'unavailable');
 a._fetchGameplanStudyHost=()=>new Promise(r=>resolve=r);const p=a._requestGameplanStudy('retry');await flush();a._progressOwnerStamp={};
 resolve({request(){throw Error('stale request');},snapshot(){},reconcile(){},destroy(){calls++;}});await p;assert.equal(calls,1);assert.equal(a._gameStudyHost,undefined);
});
test('actual startFrom stamp follows random default and normalizes unsupported saved values',()=>{
 const a=new App();Object.assign(a,{settings:{},_epochDay:()=>5,get(k,d){return this.settings[k]??d;}});
 assert.equal(JSON.parse(a._gameplanStamp())[4],'random');a.settings.startFrom='standing';assert.equal(JSON.parse(a._gameplanStamp())[4],'standing');
 a.settings.startFrom='bogus';assert.equal(JSON.parse(a._gameplanStamp())[4],'random');
});
const buildSource=readFileSync(new URL('../neural/build/build.mjs',import.meta.url),'utf8');
function factory(document,loadRuntime){let body=buildSource.slice(buildSource.indexOf('Component.prototype._fetchGameplanStudyHost = '),buildSource.indexOf('Component.prototype._fetchGameplanRuntime = '));
 body=body.replace('Component.prototype._fetchGameplanStudyHost = ','return ').replaceAll('${JSON.stringify(APP_VERSION)}','"fixture-version"').replace('await import(url.href)','await loadRuntime(url.href)');
 return Function('document','loadRuntime',body)(document,loadRuntime);}
test('actual factory pins version/attempt and captures owner plus generation before dynamic import',async()=>{
 for(const kind of ['owner','generation','destroyed']){const f=fixture(),doc=documentFixture();let resolve,url;const load=factory(doc,u=>{url=u;return new Promise(r=>resolve=r);});
 const p=load.call(f.app,3,{onState(){}});assert.equal(new URL(url).searchParams.get('v'),'fixture-version');assert.equal(new URL(url).searchParams.get('attempt'),'3');
 if(kind==='owner')f.app._progressOwnerStamp={};else if(kind==='generation')f.app._gameStudyGeneration=1;else f.app.__ngDestroyed=true;
 resolve({ngGameplanStudyInstallBrowser(){throw Error('stale install must not happen');}});await assert.rejects(p,e=>e.phase==='unavailable'&&e.message==='stale-study-browser-import');}
});
test('actual factory reaches real browser installer without starting any worker or study request',async()=>{
 const f=fixture(),doc=documentFixture();f.options.build.computation.study.manifest={maxDecks:8};
 const oldDoc=globalThis.document;globalThis.document=doc;let h;try{const load=factory(doc,async()=>({ngGameplanStudyInstallBrowser,NG_GAMEPLAN_STUDY_BUILD:f.options.build}));
 h=await load.call(f.app,1,{onState(){}});f.app._gameStudyHost=h;assert.equal(h.snapshot().phase,'idle');assert.equal(typeof f.app._gameStudyControlsRuntime,'function');assert.equal(f.workers.length,0);assert.equal(f.counts.profile,0);
 }finally{h?.destroy();if(oldDoc===undefined)delete globalThis.document;else globalThis.document=oldDoc;}
});
