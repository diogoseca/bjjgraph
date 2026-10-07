import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ngProgressOwner, ngProgressLocalKey, ngProgressCreateStore, ngProgressCreateHost, ngProgressValidateBlob } from '../neural/src/progress-owner.src.js';

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = text => text.replace(/^export (function|const|let|var|class) /gm, '$1 ');
const dependencies = ['lists-codec', 'lists', 'belt', 'challenge-definitions', 'challenge-engine'].map(name => strip(read('../neural/src/'+name+'.src.js'))).join('\n');
const ownerSource = strip(read('../neural/src/progress-owner.src.js'));
const source = read('../neural/src/app.src.jsx');
const Component = new Function('DCLogic','React',ownerSource+'\n'+dependencies+'\n'+source+'\nreturn Component;')(class {}, {createRef:()=>({current:null})});
const guest=ngProgressOwner(), ownerA=ngProgressOwner('A'), ownerB=ngProgressOwner('B');
const blob = (prep={},extra={}) => ({v:2,prep,...extra});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function memory() { const rows=new Map();return {rows,getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,String(v))}; }
function harness(mem=memory()) {
  const mounted=[], held=[], events=[];let current;
  let identity = null;
  const facade={resolveNeuralUser:async()=>identity,neuralSyncVersion:2,isAuthenticated:()=>true,pullNeural:async id=>({userId:id,blob:null}),pushNeural:async()=>true};
  const host=ngProgressCreateHost({storage:mem,resolveUser:()=>facade.resolveNeuralUser(),hold:r=>held.push(r),mount(boot){
    const inst=new Component({});current=inst;host.bind(inst,boot);mounted.push(inst);
    inst._publishKnowledge=reason=>{events.push(['profile',reason,inst._progressOwner]);};
    inst._applyLayers=()=>{};inst._refreshChallengeEvidence=()=>{};inst.updateAccountUI=()=>{};inst.track=()=>{};inst.fx=()=>{};
    inst._auth=()=>facade;inst.isTest=()=>true;
    inst.destroy=()=>{if(inst.__ngDestroyed)return;inst.__ngDestroyed=true;inst._authDisposed=true;inst._invalidateCloudSync();events.push(['destroy',inst._progressOwner]);};
    inst._loadProgress();
  }});
  const get=()=>current;
  const switchTo=id=>{identity={id,email:id+'@example.invalid'};const old=get();old._applyUser({id,email:id+'@example.invalid'});get()._applyUser({id,email:id+'@example.invalid'});return get();};
  return {mem,host,mounted,held,events,facade,get,switchTo,setIdentity:user=>{identity=user;},boot:()=>host.bootstrap()};
}
async function fakeTimers(run) {
  const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;let seq=0;const q=new Map();
  globalThis.setTimeout=fn=>{const id=++seq;q.set(id,fn);return id;};globalThis.clearTimeout=id=>q.delete(id);
  try {await run({q,flush:async()=>{const jobs=[...q.values()];q.clear();for(const fn of jobs)await fn();}});}
  finally {globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
}

// INVERTED BY OWNER RULING (2026-09-29, v1.207.0). This test used to pin "unknown-owner legacy is
// preserved and NOT loaded", which made every existing player boot as a white belt with the newcomer
// intro until they found an import button. The ruling: the first guest load adopts the old saved
// progress automatically — exactly what that player saw before per-owner storage — and keeps the
// legacy bytes untouched. Accounts still never adopt unowned progress without an explicit import.
test('first guest load adopts unowned legacy progress and its markers once, and keeps the legacy bytes',async()=>{
  const mem=memory(), raw=JSON.stringify(blob({legacy:99}));
  mem.rows.set('bjj-neural-progress',raw); mem.rows.set('bjj-neural-ladder','{"rank":3}'); mem.rows.set('bjj-neural-firstroll','1');
  const h=harness(mem); await h.boot();
  assert.equal(h.get()._progressOwner.kind,'guest'); assert.deepEqual(h.get().prep,{legacy:99});
  assert.equal(mem.rows.get('bjj-neural-progress'),raw,'legacy bytes are never rewritten or deleted');
  assert.equal(JSON.parse(mem.rows.get(ngProgressLocalKey(guest))).adoptedFrom,'legacy');
  assert.equal(mem.rows.get(ngProgressLocalKey(guest,'ladder')),'{"rank":3}');
  assert.equal(mem.rows.get(ngProgressLocalKey(guest,'firstroll')),'1');
  // _returningVisitor reads the browser's localStorage directly and latches; point it at this store.
  const had=Object.getOwnPropertyDescriptor(globalThis,'localStorage'); globalThis.localStorage=mem;
  try { h.get()._returning=null; assert.equal(h.get()._returningVisitor(),true,'a returning player is not handed the newcomer intro'); }
  finally { if (had) Object.defineProperty(globalThis,'localStorage',had); else delete globalThis.localStorage; }
  assert.equal(h.host.previewImport(h.get(),'legacy').status,'unavailable','a guest is never offered what it already adopted');
  // Once only: a later legacy write (an old tab) does not overwrite the adopted guest profile.
  mem.rows.set('bjj-neural-progress',JSON.stringify(blob({later:1})));
  const again=harness(mem); await again.boot(); assert.deepEqual(again.get().prep,{legacy:99});
});
test('malformed legacy progress is never adopted and stays byte-identical',async()=>{
  const h=harness(), bad='{"v":2,"prep":'; h.mem.rows.set('bjj-neural-progress',bad); await h.boot();
  assert.deepEqual(h.get().prep,{}); assert.equal(h.mem.rows.get('bjj-neural-progress'),bad);
  assert.equal(h.mem.rows.get(ngProgressLocalKey(guest)),undefined);
});
test('an account never adopts unowned legacy automatically; it is offered to accounts as an explicit import',async()=>{
  const h=harness(); h.setIdentity({id:'A',email:'A@example.invalid'});
  h.mem.rows.set('bjj-neural-progress',JSON.stringify(blob({legacy:5}))); await h.boot();
  assert.equal(h.get()._progressOwner.kind,'account'); assert.deepEqual(h.get().prep,{});
  assert.equal(h.mem.rows.get(ngProgressLocalKey(guest)),undefined,'no guest adoption while an account is resolved');
  assert.equal(h.host.previewImport(h.get(),'legacy').status,'preview');
});
test('A to B saves A only and restores B without legacy or guest state',async()=>{
  const h=harness();h.host.store.write(ownerB,blob({b:7}));await h.boot();h.get().prep.guest=3;const a=h.switchTo('A');a.prep.a=8;const b=h.switchTo('B');
  assert.deepEqual(b.prep,{b:7});assert.deepEqual(h.host.store.read(ownerA).blob.prep,{a:8});assert.deepEqual(h.host.store.read(guest).blob.prep,{guest:3});assert.equal(a.__ngDestroyed,true);
});
test('signout restores guest rather than relabeling account practice',async()=>{
  const h=harness();await h.boot();h.get().prep.guest=4;const a=h.switchTo('A');a.prep.a=9;a._clearAuthUser();
  assert.deepEqual(h.get().prep,{guest:4});assert.deepEqual(h.host.store.read(ownerA).blob.prep,{a:9});assert.equal(h.get().user,undefined);
});
test('same-account token identity preserves current roll and study object',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a._session={live:true};a._knowledgeAttempts=['old'];const count=h.mounted.length;
  a._applyUser({id:'A',email:'fresh@example.invalid'});assert.equal(h.get(),a);assert.equal(h.mounted.length,count);assert.deepEqual(a._session,{live:true});assert.equal(a.user.email,'fresh@example.invalid');
});
test('full identity replacement resets attempts, modifiers and active sessions',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');Object.assign(a,{_session:{live:true},_knowledgeAttempts:['old'],_knowledgeAttempt:8,_sharp:{old:1},userMods:{old:1},_beltTest:{active:true}});
  const b=h.switchTo('B');for(const key of ['_session','_knowledgeAttempts','_knowledgeAttempt','_sharp','userMods','_beltTest'])assert.equal(b[key],undefined,key);
});
test('destroyed account cannot grade or persist into either account cache',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.prep.a=4;h.switchTo('B');const before=JSON.stringify([...h.mem.rows]);
  a.prep.a=100;a._flushSave();a._saveProgress();assert.deepEqual(a._gradeKnowledge('x',{},true,'recall',null,'late','test'),{status:'rejected',reason:'stale-owner'});assert.equal(JSON.stringify([...h.mem.rows]),before);
});
test('queued old local-save callback is retired on account transition',async()=>fakeTimers(async({q,flush})=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.isTest=()=>false;a.prep.a=6;a._saveProgress();const stale=[...q.values()][0];h.switchTo('B');
  a.prep.a=999;stale();await flush();assert.deepEqual(h.host.store.read(ownerA).blob.prep,{a:6});assert.deepEqual(h.get().prep,{});
}));
test('failed cloud pull cannot authorize cloud push or change local evidence',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.prep.local=3;h.facade.pullNeural=async()=>{throw Error('offline');};
  assert.equal(await a._pullAndMerge(),false);assert.equal(a._pulled,false);assert.deepEqual(a.prep,{local:3});
});
test('successful empty pull is tied to the current account',async()=>fakeTimers(async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.prep.local=3;assert.equal(await a._pullAndMerge(),true);assert.equal(a._pulledUserId,'A');assert.deepEqual(h.host.store.read(ownerA).blob.prep,{local:3});
}));
test('late A cloud result cannot alter B or unlock a B write',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A'),wait=deferred();h.facade.pullNeural=()=>wait.promise;const pending=a._pullAndMerge();const b=h.switchTo('B');
  wait.resolve({userId:'A',blob:blob({aCloud:99})});assert.equal(await pending,false);assert.deepEqual(b.prep,{});assert.notEqual(b._pulled,true);
});
test('unsupported or malformed cloud stays held without partial application',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.prep.local=3;a.dayLog.d={s:1,k:null};
  for(const cloud of [{v:9,prep:{x:9}},{v:2,prep:{x:9},dayLog:{d:{k:['x']}}}]){
    h.facade.pullNeural=async userId=>({userId,blob:cloud});const before=JSON.stringify(a.prep);assert.equal(await a._pullAndMerge(),false);assert.equal(JSON.stringify(a.prep),before);assert.equal(a._pulled,false);
  }
});
test('real semantic merge keeps SRS debt, MAX proof and device flow',async()=>{
  const h=harness();await h.boot();const a=h.get(),today=a._epochDay();
  const local=blob({x:1},{rec:{x:2},srs:{x:{q:[today+10,10,today]}},flow:{one:{p:{o:[2,0,today]}}},settings:{mail:false},settingsAt:{mail:30},updatedAt:30});
  const cloud=blob({x:3},{rec:{x:3},srs:{x:{q:[today+1,1,today]}},flow:{two:{p:{o:[4,1,today]}}},settings:{mail:true},settingsAt:{mail:10},updatedAt:10});
  const untouched=JSON.stringify([local,cloud]);const merged=a._mergeProgressBlobs(local,cloud);
  assert.equal(merged.prep.x,3);assert.equal(merged.rec.x,3);assert.equal(merged.srs.x.q[1],1);assert.equal(merged.flow.one.p.o[0],2);assert.equal(merged.flow.two.p.o[0],4);assert.equal(merged.settings.mail,false);assert.equal(JSON.stringify([local,cloud]),untouched);
});
test('same-owner local re-read merges other-tab evidence before writing',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.prep.thisTab=2;h.host.store.write(ownerA,blob({otherTab:7}));a._flushSave();
  assert.deepEqual(h.host.store.read(ownerA).blob.prep,{thisTab:2,otherTab:7});
});
test('explicit legacy import strips consent and preserves its source bytes',async()=>{
  const h=harness();const legacy=JSON.stringify(blob({old:9},{settings:{emailMarketing:true},settingsAt:{emailMarketing:999}}));h.mem.rows.set('bjj-neural-progress',legacy);await h.boot();const a=h.switchTo('A');a.settings={emailMarketing:false};a._settingsAt={emailMarketing:1};
  assert.deepEqual(a.prep,{});const preview=h.host.previewImport(a,'legacy');assert.equal(preview.status,'preview');assert.equal(h.host.confirmImport(a,preview).status,'ready');
  assert.equal(h.get().prep.old,9);assert.equal(h.get().settings.emailMarketing,false);assert.equal(h.mem.rows.get('bjj-neural-progress'),legacy);assert.equal(a.__ngDestroyed,true);
});
test('guest import is explicit and another account is never offered',async()=>{
  const h=harness();await h.boot();h.get().prep.guest=3;const a=h.switchTo('A');assert.deepEqual(a.prep,{});assert.equal(h.host.previewImport(a,'account:B').status,'unavailable');
  assert.equal(h.host.confirmImport(a,h.host.previewImport(a,'guest')).status,'ready');assert.equal(h.get().prep.guest,3);assert.equal(h.host.store.read(guest).blob.prep.guest,3);
});
test('import preview cannot cross an identity change or changed source',async()=>{
  const h=harness();h.mem.rows.set('bjj-neural-progress',JSON.stringify(blob({old:9})));await h.boot();const a=h.switchTo('A');const old=h.host.previewImport(a,'legacy');const b=h.switchTo('B');
  assert.equal(h.host.confirmImport(b,old).status,'unavailable');const fresh=h.host.previewImport(b,'legacy');h.mem.rows.set('bjj-neural-progress',JSON.stringify(blob({changed:4})));assert.equal(h.host.confirmImport(b,fresh).status,'unavailable');assert.deepEqual(b.prep,{});
});
test('corrupt incoming owner is preserved and transition shows recovery',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.prep.a=7;const bad='unreadable';h.mem.rows.set(ngProgressLocalKey(ownerB),bad);a._applyUser({id:'B'});
  assert.equal(h.get(),a);assert.equal(a.__ngDestroyed,true);assert.equal(h.held.length,1);assert.deepEqual(h.host.recoverySnapshot().prep,{a:7});assert.equal(h.mem.rows.get(ngProgressLocalKey(ownerB)),bad);
});
test('outgoing quota error pauses rather than mounting wrong-account progress',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.prep.a=5;const set=h.mem.setItem;h.mem.setItem=()=>{throw Error('quota');};a._applyUser({id:'B'});
  assert.equal(h.get(),a);assert.equal(a.__ngDestroyed,true);assert.equal(h.held.length,1);assert.equal(h.host.recoverySnapshot().prep.a,5);
  h.mem.setItem=set;h.setIdentity({id:'B'});assert.equal((await h.host.retry()).status,'ready');assert.equal(h.get()._progressOwner.id,'B');assert.deepEqual(h.get().prep,{});assert.equal(h.host.store.read(ownerA).blob.prep.a,5);
});
test('unknown owner format does not boot or overwrite an empty guest',async()=>{
  const h=harness();h.mem.rows.set(ngProgressLocalKey(guest),'broken');await h.boot();assert.equal(h.mounted.length,0);assert.equal(h.held.length,1);assert.equal(h.mem.rows.get(ngProgressLocalKey(guest)),'broken');
});
test('safe unknown v2 fields survive hydration and a staged merge',async()=>{
  const h=harness();await h.boot();const out=h.get()._mergeProgressBlobs(blob({},{futureLocal:{flag:true}}),blob({},{futureCloud:{value:3}}));assert.deepEqual(out.futureLocal,{flag:true});assert.deepEqual(out.futureCloud,{value:3});
});
test('unsafe saved keys and invalid map shapes fail before publication',async()=>{
  for(const bad of [{v:2,prep:[]},JSON.parse('{"v":2,"prep":{"__proto__":{"bad":true}}}'),{v:2,explored:[1]}])assert.throws(()=>ngProgressValidateBlob(bad));assert.equal({}.bad,undefined);
});
test('auxiliary keys stay account scoped and unowned originals are not removed',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');for(const field of ['ladder','firstroll','coached'])assert.equal(a._progressLocalKey(field),ngProgressLocalKey(ownerA,field));
  assert.equal(/localStorage\.(?:getItem|setItem|removeItem)\("bjj-neural-(?:progress|ladder|firstroll|coached)"/.test(source),false);
});
test('build owner pinning occurs before mount and normal teardown saves before destroy flag',async()=>{
  const build=read('../neural/build/build.mjs');assert.ok(build.indexOf('boot.host.bind(inst, boot)')<build.indexOf('const mounting = inst.componentDidMount'));
  assert.ok(build.indexOf('inst._flushSave()')<build.indexOf('inst.__ngDestroyed = true'));assert.ok(build.includes('progressOwner = stripExports("progress-owner.src.js")'));
  assert.ok(source.includes('const bytes = await r.arrayBuffer();')); assert.ok(source.includes('typeof this._progressCurrent === \"function\" && !this._progressCurrent()'));
});
test('same-owner merged local evidence is included in a delayed cloud snapshot',async()=>fakeTimers(async({flush})=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.prep.thisTab=2;h.host.store.write(ownerA,blob({otherTab:7}));let pushed;
  h.facade.pushNeural=async(value,userId)=>{pushed={value,userId};return true;};
  a._pulled=true;a._pulledUserId='A';a._pushCloud();await flush();assert.equal(pushed.userId,'A');assert.deepEqual(pushed.value.prep,{thisTab:2,otherTab:7});
}));
test('asynchronous mount failure destroys the partial instance and offers a retry',async()=>{
  const h=harness();await h.boot();const a=h.get();h.host.mountFailed(a);assert.equal(a.__ngDestroyed,true);assert.equal(h.held.at(-1).reason,'mount-failed');
  await h.host.retry();assert.notEqual(h.get(),a);assert.equal(h.host.current(h.get()),true);
});
test('import UI names target, cancel keeps separate, explicit click imports',async()=>{
  const oldDocument=globalThis.document;
  const element=tag=>({tag,children:[],attrs:{},style:{},textContent:'',setAttribute(k,v){this.attrs[k]=v;},append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},set innerHTML(v){this.children=[];}});
  globalThis.document={createElement:element};
  try {
    const h=harness();h.mem.rows.set('bjj-neural-progress',JSON.stringify(blob({old:4})));await h.boot();const a=h.switchTo('A');let closed=0;a.openModal=()=>{};a.closeModal=()=>{closed++;};a.modalCardRef.current=element('div');
    a.openProgressImport('legacy');let section=a.modalCardRef.current.children[0];assert.ok(section.children[1].textContent.includes('A@example.invalid'));assert.ok(section.children[1].textContent.includes('email consent stay unchanged'));
    section.children.find(x=>x.textContent==='Keep separate').onclick();assert.equal(closed,1);assert.deepEqual(a.prep,{});
    a.openProgressImport('legacy');section=a.modalCardRef.current.children[0];section.children.find(x=>x.attrs['data-progress-import-confirm']==='1').onclick();assert.equal(h.get().prep.old,4);assert.notEqual(h.get(),a);
  } finally {globalThis.document=oldDocument;}
});

test('bootstrap waits for authoritative identity before exposing any cached owner',async()=>{
  const h=harness(),wait=deferred();h.host.store.write(ownerA,blob({a:8}));h.facade.resolveNeuralUser=()=>wait.promise;
  const pending=h.boot();assert.equal(h.mounted.length,0);wait.resolve({id:'A'});await pending;
  assert.equal(h.get()._progressOwner.id,'A');assert.deepEqual(h.get().prep,{a:8});assert.equal(h.mounted.length,1);
});
test('SPA remount after unsubscribed signout restores guest, never the previous account',async()=>{
  const h=harness();await h.boot();h.get().prep.guest=2;const a=h.switchTo('A');a.prep.a=8;a._flushSave();a.destroy();h.setIdentity(null);
  await h.boot();assert.equal(h.get()._progressOwner.kind,'guest');assert.deepEqual(h.get().prep,{guest:2});assert.equal(h.host.store.read(ownerA).blob.prep.a,8);
});
test('SPA remount after unsubscribed account switch restores the newly verified account',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a._flushSave();a.destroy();h.host.store.write(ownerB,blob({b:7}));h.setIdentity({id:'B'});
  await h.boot();assert.equal(h.get()._progressOwner.id,'B');assert.deepEqual(h.get().prep,{b:7});
});
test('held transition retry revalidates identity instead of installing the old requested account',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.prep.a=6;const set=h.mem.setItem;h.mem.setItem=()=>{throw Error('quota');};h.setIdentity({id:'B'});a._applyUser({id:'B'});
  assert.equal(a.__ngDestroyed,true);h.mem.setItem=set;h.setIdentity(null);await h.host.retry();
  assert.equal(h.get()._progressOwner.kind,'guest');assert.deepEqual(h.get().prep,{});assert.equal(h.host.store.read(ownerA).blob.prep.a,6);
});
test('failed authoritative resolution holds without exposing cached A or guessing guest',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.prep.a=6;a._flushSave();a.destroy();const before=JSON.stringify([...h.mem.rows]);h.facade.resolveNeuralUser=async()=>{throw Error('SDK unavailable');};
  const count=h.mounted.length;await h.boot();assert.equal(h.mounted.length,count);assert.equal(h.held.at(-1).reason,'identity-unavailable');assert.equal(JSON.stringify([...h.mem.rows]),before);
});
test('initAuth resolves authoritative null despite an advisory false isAuthenticated',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');h.setIdentity(null);h.facade.isAuthenticated=()=>false;
  await a._initAuth();assert.equal(a.__ngDestroyed,true);assert.equal(h.get()._progressOwner.kind,'guest');
});
test('normal guest item removal and last-item deletion persist through flush and reload',async()=>{
  const h=harness();await h.boot();const a=h.get();a.siteIdOf=x=>x;a.lists={l:{name:'Plan',items:['x','y'],t:1}};a._flushSave();
  assert.equal(a.removeFromList('x','l'),true);a._flushSave();assert.deepEqual(h.host.cloudSnapshot(a).lists.l.items,['y']);a.destroy();await h.boot();
  const b=h.get();b.siteIdOf=x=>x;assert.deepEqual(b.lists.l.items,['y']);assert.equal(b.removeFromList('y','l'),true);b._flushSave();b.destroy();await h.boot();assert.deepEqual(h.get().lists,{});
});
test('normal guest explicit list deletion persists without reintroducing its prior cache',async()=>{
  const h=harness();await h.boot();const a=h.get();a.lists={l:{name:'Plan',items:['x'],t:1}};a._armListUndo=()=>{};a._refreshListSurfaces=()=>{};a._flushSave();
  a.deleteList('l');a._flushSave();a.destroy();await h.boot();assert.deepEqual(h.get().lists,{});
});
test('normal guest tutorial restart stays reset after flush and reload',async()=>{
  const h=harness();await h.boot();const a=h.get();a.tut={done:{intro:true}};a.renderTutorial=()=>{};a._flushSave();a.restartTutorial();a._flushSave();
  assert.deepEqual(h.host.cloudSnapshot(a).tut.done,{});a.destroy();await h.boot();assert.deepEqual(h.get().tut.done,{});
});
test('external local evidence remains in the live owner after later ordinary saves',async()=>{
  const h=harness();await h.boot();const a=h.get();a._challengeRuntime={activeRun:{beat:2}};const runtime=a._challengeRuntime;a.prep.thisTab=2;a._flushSave();h.host.store.write(guest,blob({otherTab:7}));a._flushSave();
  assert.deepEqual(a.prep,{thisTab:2,otherTab:7});assert.equal(a._challengeRuntime,runtime);a.prep.later=3;a._flushSave();assert.deepEqual(h.host.store.read(guest).blob.prep,{thisTab:2,otherTab:7,later:3});
});

test('old identity rejection cannot revoke a newer same-account pull or queued push',async()=>fakeTimers(async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');let reject,listener;
  const waiting=new Promise((resolve,fail)=>{reject=fail;});h.facade.resolveNeuralUser=()=>waiting;h.facade.onAuthChange=callback=>{listener=callback;return()=>{};};
  const old=a._initAuth();listener('SIGNED_IN',{id:'A',email:'A@example.invalid'});assert.equal(await a._pullAndMerge(),true);
  const epoch=a._authEpoch,push=a._pushT;assert.equal(a._pulledUserId,'A');assert.ok(push);reject(Error('old SDK read failed'));await old;
  assert.equal(a._authEpoch,epoch);assert.equal(a._pulledUserId,'A');assert.equal(a._pulled,true);assert.equal(a._pushT,push);assert.notEqual(a._cloudSyncError,'identity-unavailable');
}));

test('local list deletion survives unrelated external prep across A to B to A',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.siteIdOf=x=>x;a.lists={l:{name:'Plan',items:['x','y'],t:1}};a._flushSave();
  const external=JSON.parse(JSON.stringify(h.host.store.read(ownerA).blob));a.isTest=()=>false;await fakeTimers(async()=>{
    a.removeFromList('x','l');external.prep.otherTab=7;h.host.store.write(ownerA,external);
    const b=h.switchTo('B');assert.deepEqual(b.prep,{});const restored=h.switchTo('A');assert.deepEqual(restored.lists.l.items,['y']);assert.equal(restored.prep.otherTab,7);
  });
});
test('confirmed import activates externally merged saved result before an ordinary save',async()=>{
  const h=harness();h.mem.rows.set('bjj-neural-progress',JSON.stringify(blob({legacy:3})));await h.boot();const a=h.switchTo('A');a.prep.mine=2;a._flushSave();const preview=h.host.previewImport(a,'legacy');
  h.host.store.write(ownerA,blob({mine:2,otherTab:7}));assert.equal(h.host.confirmImport(a,preview).status,'ready');
  assert.deepEqual(h.get().prep,{mine:2,legacy:3,otherTab:7});h.get()._flushSave();assert.deepEqual(h.host.store.read(ownerA).blob.prep,{mine:2,legacy:3,otherTab:7});
});
test('held switch retry retains accepted outgoing merge after incoming cache failure',async()=>{
  const h=harness();await h.boot();const a=h.switchTo('A');a.prep.mine=2;a._flushSave();h.host.store.write(ownerA,blob({mine:2,otherTab:7}));h.mem.rows.set(ngProgressLocalKey(ownerB),'broken');h.setIdentity({id:'B'});a._applyUser({id:'B'});
  assert.equal(a.__ngDestroyed,true);assert.deepEqual(h.host.recoverySnapshot().prep,{mine:2,otherTab:7});h.mem.rows.delete(ngProgressLocalKey(ownerB));await h.host.retry();
  assert.equal(h.get()._progressOwner.id,'B');assert.deepEqual(h.get().prep,{});assert.deepEqual(h.host.store.read(ownerA).blob.prep,{mine:2,otherTab:7});
});

test('old host retry rejection cannot hold a newer accepted account',async()=>{
  const h=harness();await h.boot();h.switchTo('A');let reject;
  h.facade.resolveNeuralUser=()=>new Promise((resolve,fail)=>{reject=fail;});const old=h.host.retry();await Promise.resolve();
  const b=h.switchTo('B'),held=h.held.length;reject(Error('old identity read failed'));
  assert.equal((await old).reason,'stale-owner-resolution');assert.equal(h.get(),b);assert.equal(h.host.current(b),true);assert.equal(h.held.length,held);
});
test('old host retry finalizer cannot clear or share a newer resolution promise',async()=>{
  const h=harness();await h.boot();h.switchTo('A');let rejectOld,resolveNew;
  h.facade.resolveNeuralUser=()=>new Promise((resolve,reject)=>{rejectOld=reject;});const old=h.host.retry();await Promise.resolve();h.switchTo('B');
  h.facade.resolveNeuralUser=()=>new Promise(resolve=>{resolveNew=resolve;});const fresh=h.host.retry();assert.notEqual(fresh,old);await Promise.resolve();
  rejectOld(Error('old identity read failed'));assert.equal((await old).reason,'stale-owner-resolution');assert.equal(h.host.retry(),fresh);assert.equal(h.held.length,0);
  resolveNew({id:'B'});assert.equal((await fresh).status,'ready');assert.equal(h.get()._progressOwner.id,'B');assert.equal(h.host.current(h.get()),true);
});
test('old successful host retry cannot restore its account after a newer accepted identity',async()=>{
  const h=harness();await h.boot();h.switchTo('A');const wait=deferred();h.facade.resolveNeuralUser=()=>wait.promise;
  const old=h.host.retry();await Promise.resolve();const b=h.switchTo('B');wait.resolve({id:'A'});
  assert.equal((await old).reason,'stale-owner-resolution');assert.equal(h.get(),b);assert.equal(h.held.length,0);assert.equal(h.host.current(b),true);
});

// LOCAL-ONLY PLAY (owner ruling 2026-09-29, FGLOCAL1). A signed-in device whose sign-in SDK cannot
// load plays on ITS OWN copy of that account: nothing is pulled or pushed while local-only, local
// saves work, and the first verified answer pulls and merges before any push.
test('local-only: an unreachable SDK restores the stored account locally, pushes nothing, then pulls before pushing', async () => {
  const mem = memory(), store = ngProgressCreateStore(mem);
  store.write(ownerA, blob({ 'A|Top': 3 }, { lists: {} }));
  const h = harness(mem), calls = [];
  h.facade.resolveNeuralUser = async () => { throw Object.assign(new Error('Account service unreachable'), { code: 'sdk-unavailable', storedUserId: 'A' }); };
  h.facade.pullNeural = async id => { calls.push('pull:' + id); return { userId: id, blob: blob({ 'A|Top': 1, 'Cloud|Top': 2 }) }; };
  h.facade.pushNeural = async (b, id) => { calls.push('push:' + id); return true; };
  const result = await h.boot();
  assert.equal(result.status, 'ready'); assert.equal(result.localOnly, true);
  const app = h.get();
  assert.deepEqual(app._progressOwner, ownerA, "this device's copy of the stored account");
  assert.equal(app._progressLocalOnly, true); assert.deepEqual(h.held, []);
  assert.equal(app.prep['A|Top'], 3, 'its local progress is what plays');
  await app._initAuth();                      // the mount's own re-verify attempt: still unreachable
  assert.equal(app._progressLocalOnly, true);
  // Both save paths (the ordinary debounced one runs synchronously under isTest) and both cloud
  // entry points, called directly. Mutant, recorded 2026-09-29: a save that pushes the local blob
  // while local-only turns this red on `calls`.
  app.prep['Offline|Top'] = 4; app._saveProgress(); app._flushSave(); app._pushCloud(); await app._pullAndMerge();
  assert.deepEqual(calls, [], 'local-only reads and writes nothing in the cloud');
  assert.equal(JSON.parse(mem.getItem(ngProgressLocalKey(ownerA))).blob.prep['Offline|Top'], 4, 'local saves work');
  // The SDK is reachable again and verifies the same account.
  h.facade.resolveNeuralUser = async () => ({ id: 'A', email: 'A@example.invalid' });
  await app._initAuth();
  assert.equal(h.get(), app, 'the same account stays mounted'); assert.equal(app._progressLocalOnly, false);
  await new Promise(r => setTimeout(r, 600));  // the push debounce
  assert.deepEqual(calls, ['pull:A', 'push:A'], 'the merge-bearing pull runs before the first push');
  assert.equal(app.prep['Offline|Top'], 4); assert.equal(app.prep['Cloud|Top'], 2, 'cloud and local play merged');
});

// D3 (owner, 2026-09-30): the SDK loaded but its session check failed (`session-unverified`). Same
// treatment as an unreachable SDK. Mutant, recorded 2026-09-30: dropping "session-unverified" from
// NG_PROGRESS_LOCAL_ONLY_CODES turns this red (the host holds instead of playing).
test('local-only D3: a failed session check that names a stored account plays locally and pushes nothing', async () => {
  const mem = memory(), store = ngProgressCreateStore(mem);
  store.write(ownerA, blob({ 'A|Top': 3 }, { lists: {} }));
  const h = harness(mem), calls = [];
  h.facade.resolveNeuralUser = async () => { throw Object.assign(new Error('Unable to verify progress owner'), { code: 'session-unverified', storedUserId: 'A' }); };
  h.facade.pullNeural = async id => { calls.push('pull:' + id); return { userId: id, blob: null }; };
  h.facade.pushNeural = async (b, id) => { calls.push('push:' + id); return true; };
  const result = await h.boot();
  assert.equal(result.status, 'ready'); assert.equal(result.localOnly, true); assert.deepEqual(h.held, []);
  const app = h.get();
  assert.deepEqual(app._progressOwner, ownerA); assert.equal(app._progressLocalOnly, true);
  app.prep['Offline|Top'] = 4; app._saveProgress(); app._flushSave(); app._pushCloud(); await app._pullAndMerge();
  assert.deepEqual(calls, [], 'nothing pulled or pushed while the session is unverified');
});

test('local-only is only for the named facade failures with a stored account; every other failure still holds', async () => {
  for (const error of [Object.assign(new Error('x'), { code: 'sdk-unavailable', storedUserId: null }),
    Object.assign(new Error('x'), { code: 'session-unverified', storedUserId: null }), new Error('Unable to verify progress owner'),
    Object.assign(new Error('x'), { code: 'something-else', storedUserId: 'A' })]) {
    const h = harness();
    h.facade.resolveNeuralUser = async () => { throw error; };
    const result = await h.boot();
    assert.equal(result.status, 'held'); assert.equal(h.mounted.length, 0);
    assert.deepEqual(h.held.map(r => r.reason), ['identity-unavailable']);
  }
});
