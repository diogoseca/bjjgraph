import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ngProgressOwner, ngProgressLocalKey, ngProgressCreateStore, ngProgressCreateHost, ngProgressValidateBlob } from '../neural/src/progress-owner.src.js';
import { ngClozeDone } from '../neural/src/master-cloze.src.js';
import { ngGameplanReviewed } from '../neural/src/gameplan-debt.src.js';
// the app class built below is the bundle's eager part without the planner's debt file, which `practiceToday` reads
// (the cloze's result line asks it): handed in here, as tests/master_cloze.test.mjs does
globalThis.ngGameplanReviewed = ngGameplanReviewed;

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = text => text.replace(/^export (function|const|let|var|class) /gm, '$1 ');
// knowledge-profile (v1.279.0): the pull's srs merge is `ngKnowledgeMergeRow`, which the bundle concatenates above the class;
// rating (dev, PR #412) beside it
const dependencies = ['lists-codec', 'lists', 'belt', 'knowledge-profile', 'rating', 'challenge-definitions', 'challenge-engine'].map(name => strip(read('../neural/src/'+name+'.src.js'))).join('\n');
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
test('an account never adopts unowned legacy automatically; the data layer retains explicit legacy import',async()=>{
  const h=harness(); h.setIdentity({id:'A',email:'A@example.invalid'});
  h.mem.rows.set('bjj-neural-progress',JSON.stringify(blob({legacy:5}))); await h.boot();
  assert.equal(h.get()._progressOwner.kind,'account'); assert.deepEqual(h.get().prep,{});
  assert.equal(h.mem.rows.get(ngProgressLocalKey(guest)),undefined,'no guest adoption while an account is resolved');
  assert.equal(h.host.previewImport(h.get(),'legacy').status,'preview');
});
// v1.262.0 (owner U138 a): guest practice joins EVERY account that signs in on the browser, so A and B both get
// `guest: 3`; the claim kept is that A's own practice never reaches B (was: B restored with no guest state at all).
test('A to B saves A only: B never receives A practice (both receive the guest practice, U138 a)',async()=>{
  // ORDER1: guest practice joins after the account's first successful pull, so each sign-in here is followed by it
  const h=harness();h.host.store.write(ownerB,blob({b:7}));await h.boot();h.get().prep.guest=3;const a=h.switchTo('A');await a._pullAndMerge();a.prep.a=8;const b=h.switchTo('B');await b._pullAndMerge();
  assert.deepEqual(b.prep,{b:7,guest:3});assert.deepEqual(h.host.store.read(ownerA).blob.prep,{a:8,guest:3});assert.deepEqual(h.host.store.read(guest).blob.prep,{guest:3});assert.equal(a.__ngDestroyed,true);
});
test('signout restores guest rather than relabeling account practice',async()=>{
  const h=harness();await h.boot();h.get().prep.guest=4;const a=h.switchTo('A');await a._pullAndMerge();a.prep.a=9;a._clearAuthUser();
  // v1.262.0: A's copy also holds the guest practice it joined at sign-in; the guest copy is never relabelled with A's
  assert.deepEqual(h.get().prep,{guest:4});assert.deepEqual(h.host.store.read(ownerA).blob.prep,{a:9,guest:4});assert.equal(h.get().user,undefined);
});
for (const existingGuest of [false,true]) {
  test(existingGuest
    ? 'signout with an existing guest keeps legacy separate; signing back in joins only that guest copy'
    : 'signout without a guest adopts legacy; signing back in joins it with the guest copy (v1.262.0)',async()=>{
    const h=harness(), legacy={
      'bjj-neural-progress':'{ "v": 2, "prep": { "legacy": 5 } }\n',
      'bjj-neural-ladder':'{ "rank": 3 }', 'bjj-neural-firstroll':'1', 'bjj-neural-coached':'1',
    };
    for (const [key,value] of Object.entries(legacy)) h.mem.rows.set(key,value);
    if (existingGuest) h.host.store.write(guest,blob({guest:2}));
    h.setIdentity({id:'A',email:'A@example.invalid'});await h.boot();
    assert.deepEqual(h.get().prep,{},'account boot never adopts legacy');
    h.setIdentity(null);h.get()._clearAuthUser();
    const expected=existingGuest?{guest:2}:{legacy:5};
    assert.equal(h.get()._progressOwner.kind,'guest');assert.deepEqual(h.get().prep,expected);
    // v1.262.0: signing back in joins the guest copy by itself (was: an explicit, confirmed import)
    h.switchTo('A');await h.get()._pullAndMerge();assert.deepEqual(h.get().prep,expected,'the guest copy joined after the first pull');
    for (const [key,value] of Object.entries(legacy)) assert.equal(h.mem.rows.get(key),value,key+' stays byte-identical');
  });
}
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
  // v1.262.0: an (empty) guest copy exists, so the guest never adopted the legacy copy and the sign-in joins nothing
  const h=harness();h.host.store.write(guest,blob({}));const legacy=JSON.stringify(blob({old:9},{settings:{emailMarketing:true},settingsAt:{emailMarketing:999}}));h.mem.rows.set('bjj-neural-progress',legacy);await h.boot();const a=h.switchTo('A');await a._pullAndMerge();a.settings={emailMarketing:false};a._settingsAt={emailMarketing:1};
  assert.deepEqual(a.prep,{});const preview=h.host.previewImport(a,'legacy');assert.equal(preview.status,'preview');assert.equal(h.host.confirmImport(a,preview).status,'ready');
  assert.equal(h.get().prep.old,9);assert.equal(h.get().settings.emailMarketing,false);assert.equal(h.mem.rows.get('bjj-neural-progress'),legacy);assert.equal(a.__ngDestroyed,true);
});
// v1.262.0 (owner U138 a): was "guest import is explicit"; guest practice now joins at sign-in, with no import step.
test('guest practice joins at sign-in without an import, and another account is never offered',async()=>{
  const h=harness();await h.boot();h.get().prep.guest=3;const a=h.switchTo('A');assert.deepEqual(a.prep,{},'nothing before the first pull (ORDER1)');await a._pullAndMerge();assert.deepEqual(a.prep,{guest:3});assert.equal(h.host.previewImport(a,'account:B').status,'unavailable');
  assert.equal(h.host.store.read(ownerA).blob.prep.guest,3);assert.equal(h.host.store.read(guest).blob.prep.guest,3);
});
test('import preview cannot cross an identity change or changed source',async()=>{
  // v1.262.0: an (empty) guest copy exists, so the legacy copy is not adopted and joins nobody at sign-in
  const h=harness();h.host.store.write(guest,blob({}));h.mem.rows.set('bjj-neural-progress',JSON.stringify(blob({old:9})));await h.boot();const a=h.switchTo('A');await a._pullAndMerge();const old=h.host.previewImport(a,'legacy');const b=h.switchTo('B');await b._pullAndMerge();
  // v1.262.0: each refusal's REASON is asserted, so a later refusal (not-pulled, ORDER1) cannot stand in for these
  assert.deepEqual(h.host.confirmImport(b,old),{status:'unavailable',reason:'stale-import-target'});const fresh=h.host.previewImport(b,'legacy');h.mem.rows.set('bjj-neural-progress',JSON.stringify(blob({changed:4})));assert.deepEqual(h.host.confirmImport(b,fresh),{status:'unavailable',reason:'import-source-changed'});assert.deepEqual(b.prep,{});
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
  // L1-R1 (v1.290.0, the reader of PR #434, its finding 6; the orchestrator's ruling): `explored:[1]` used to be refused here, and
  // a refused stored envelope held the whole app before it drew. A damaged ENTRY is read now (strings only, the rest counted,
  // never written back: tests/master_list.test.mjs); a non-list `explored` is still refused, which is the shape this test keeps
  for(const bad of [{v:2,prep:[]},JSON.parse('{"v":2,"prep":{"__proto__":{"bad":true}}}'),{v:2,explored:1},{v:2,explored:{}}])assert.throws(()=>ngProgressValidateBlob(bad));assert.equal({}.bad,undefined);
  assert.doesNotThrow(()=>ngProgressValidateBlob({v:2,explored:[1]}));
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
// v1.262.0: "guest import UI names target, cancel keeps separate, explicit click imports" is DELETED with the dialog it
// pinned (the owner, 11 Nov: "i dont like that functionality"). Its successors: tests/guest_join_safety.test.mjs (the
// join, once, adding only) and e2e/journeys/guest-join.spec.ts (no row in the menu, the line, by mouse and touch).

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
  // v1.262.0: an (empty) guest copy, so the legacy copy reaches the account only through this import; the import, like
  // the join, needs the account's first pull
  const h=harness();h.host.store.write(guest,blob({}));h.mem.rows.set('bjj-neural-progress',JSON.stringify(blob({legacy:3})));await h.boot();const a=h.switchTo('A');await a._pullAndMerge();a.prep.mine=2;a._flushSave();const preview=h.host.previewImport(a,'legacy');
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

// v1.227.0 review S2: cloud receipt publication must update effective danger
// immediately; no frame tick may be needed to notice a newer per-key setting.
test('cloud danger preference updates visuals immediately and leaves the live clock alone', async () => {
  const h = harness(); await h.boot(); const a = h.switchTo('A');
  let shows = 0, removals = 0;
  a._reducedMotion = () => false;
  a.showVignette = () => { shows++; a._vignetteEl = { remove: () => removals++ }; };
  a._defensePressure = true;
  a._decision = { remaining: 2500, total: 13500 };
  a.settings.dangerAnimation = true; a._settingsAt.dangerAnimation = 1;
  a._syncDangerAnimation();
  assert.equal(shows, 1);
  h.facade.pullNeural = async userId => ({ userId, blob: blob({}, { settings: { dangerAnimation: false }, settingsAt: { dangerAnimation: 2 } }) });
  a._pushCloud = () => {};
  assert.equal(await a._pullAndMerge(), true);
  assert.equal(a._vignetteEl, null, 'cloud off takes effect before any tick');
  assert.equal(removals, 1);
  assert.deepEqual(a._decision, { remaining: 2500, total: 13500 });
  assert.equal(a._defensePressure, true);
  assert.equal(await a._pullAndMerge(), true);
  assert.deepEqual([shows, removals], [1, 1], 'same effective cloud preference does no extra DOM work');
  h.facade.pullNeural = async userId => ({ userId, blob: blob({}, { settings: { dangerAnimation: true }, settingsAt: { dangerAnimation: 3 } }) });
  assert.equal(await a._pullAndMerge(), true);
  assert.deepEqual([shows, removals], [2, 1]);
  assert.equal(a._settingsAt.dangerAnimation, 3);
  console.log('# cloud danger preference: 11 assertions');
});

// THE APP'S OWN PULL, BOTH ORDERS, AGAINST A CLOUD THAT HOLDS ROWS (v1.279.0, SRS-R1: the independent reader's
// finding 5, ported from its app_pull.mjs). The schedule's merge is a pure function (`ngKnowledgeMergeRow`, pinned in
// tests/schedule_ladder.test.mjs); this holds the app that calls it: `_mergeProgressBlobs` in both orders with blobs
// that hold srs AND moves rows, and a full `_pullAndMerge` on a booted, signed-in instance whose rows dev wrote, against
// a cloud holding other dev rows, coming out row for row as DEV'S OWN PULL leaves them. Dev's pull is its own code, cut
// from git by tests/artifacts/_capture_old_schedule.mjs (dev v1.278.2), never re-typed.
const OLD_CLIENT = JSON.parse(read('./artifacts/schedule_old_client.json'));
const devSrsMerge = new Function('cloud', OLD_CLIENT.app.srsMerge);
const devMergeMoves = new Function(OLD_CLIENT.owner.mergeMoves + '\nreturn ngProgressMergeMoves;')();
const copy = v => JSON.parse(JSON.stringify(v));
async function withDay(day, run) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'window');
  globalThis.window = { ...(had ? had.value : {}), __NG_EPOCH_DAY__: day };
  try { return await run(); } finally { if (had) Object.defineProperty(globalThis, 'window', had); else delete globalThis.window; }
}
const PULL_DAY = 20400;
test("the app's pull merges srs and moves rows the same in both orders, against a cloud that holds them (SRS-R1)", () => withDay(PULL_DAY, async () => {
  const h = harness(); await h.boot(); const a = h.get(), D = PULL_DAY;
  assert.equal(a._epochDay(), D);
  const pairs = [
    // one day, one floored cell, due days apart (the new tie): the earlier due wins and keeps the longer interval it beat
    [[D + 42, 30, D], [D + 55, 30, D], [D + 55, 30, D]],
    // a miss today beside a right answer today: the miss stands (rung 0 keeps its 1 day)
    [[D + 1, 1, D], [D + 60, 60, D], [D + 1, 1, D]],
    // the later answer wins and heals to the longer TRUE interval it beat (90 days, both cells 60)
    [[D + 65, 60, D], [D + 80, 60, D - 10], [D + 90, 60, D]],
    // dev's answer (cell 120, 120 days) after a new client's 241: the 241 days come back
    [[D + 120, 120, D], [D - 1 + 241, 120, D - 1], [D + 241, 120, D]],
    // two misses of one day, one written by a device whose clock ran a day ahead and already clamped by a pull ([D+2, 1,
    // D]): no heal at rung 0, so the tie itself decides, the earlier due on both devices (until v1.279.0 each kept its own)
    [[D + 1, 1, D], [D + 2, 1, D], [D + 1, 1, D]],
  ];
  for (const [x, y, want] of pairs) {
    const L = blob({}, { srs: { d: { q: x } }, moves: { '1/top': { m: [...x, 1] } } }), C = blob({}, { srs: { d: { q: y } }, moves: { '1/top': { m: [...y, 1] } } });
    const ab = a._mergeProgressBlobs(L, C), ba = a._mergeProgressBlobs(C, L);
    assert.deepEqual(ab.srs.d.q, want, `local ${x}, cloud ${y}`);
    assert.deepEqual(ba.srs.d.q, want, `local ${y}, cloud ${x}`);
    assert.deepEqual(ab.moves['1/top'].m, [...want, 1], `moves: local ${x}, cloud ${y}`);
    assert.deepEqual(ba.moves['1/top'].m, [...want, 1], `moves: local ${y}, cloud ${x}`);
  }
}));
test("a full pull of rows dev wrote leaves every srs and moves row as dev's own pull does (SRS-R1)", () => withDay(PULL_DAY, async () => {
  const D = PULL_DAY, S = [1, 3, 7, 14, 30, 60, 120];
  const localSrs = { d: {}, e: {} }, cloudSrs = { d: {}, e: {} }, localMoves = { '1/top': {} }, cloudMoves = { '1/top': {} };
  let i = 0;
  // dev's rows (due = last + cell) on both sides: every pair of cells, answered 0, 1, 3 or 50 days ago here, 0, 1 or 4
  // there, so one card can be a later answer, a same-day tie, a heal or none of them; moves rows carry Yes or No
  for (const c of S) for (const dl of [0, 1, 3, 50]) for (const c2 of S) for (const dl2 of [0, 1, 4]) {
    const q = 'q' + i++, l = [D - dl + c, c, D - dl], r = [D - dl2 + c2, c2, D - dl2];
    localSrs.d[q] = l; cloudSrs.d[q] = r; localMoves['1/top'][q] = [...l, 1]; cloudMoves['1/top'][q] = [...r, i % 3 ? 1 : 0];
  }
  for (let j = 0; j < 20; j++) {   // and rows only one side holds
    localSrs.e['l' + j] = [D + S[j % 7] - j, S[j % 7], D - j]; cloudSrs.e['c' + j] = [D + S[j % 7] - j, S[j % 7], D - j];
  }
  // dev's own pull of the same blobs: its srs block run as the app runs it, and its moves merge
  const dev = { srs: copy(localSrs), _epochDay: () => D };
  devSrsMerge.call(dev, { srs: copy(cloudSrs) });
  const devMoves = devMergeMoves(copy(localMoves), copy(cloudMoves), D);
  await fakeTimers(async ({ flush }) => {
    const h = harness(); await h.boot(); const a = h.switchTo('A');
    assert.equal(await a._pullAndMerge(), true, 'the first pull: an empty account');
    a.srs = copy(localSrs); a.moves = copy(localMoves); a._saveProgress(); await flush();
    h.facade.pullNeural = async id => ({ userId: id, blob: blob({}, { srs: copy(cloudSrs), moves: copy(cloudMoves) }) });
    assert.equal(await a._pullAndMerge(), true, 'the pull of a cloud that holds rows');
    await flush();
    let rows = 0;
    for (const dk of Object.keys(dev.srs)) for (const q of Object.keys(dev.srs[dk])) { assert.deepEqual(a.srs[dk][q], dev.srs[dk][q], `srs ${dk}/${q}`); rows++; }
    for (const q of Object.keys(devMoves['1/top'])) { assert.deepEqual(a.moves['1/top'][q], devMoves['1/top'][q], `moves ${q}`); rows++; }
    assert.deepEqual(Object.keys(a.srs.d).length + Object.keys(a.srs.e).length, Object.keys(dev.srs.d).length + Object.keys(dev.srs.e).length);
    assert.equal(rows, 588 + 40 + 588, `${rows} rows compared`);
    const stored = JSON.parse(h.mem.rows.get(ngProgressLocalKey(ownerA)));
    assert.deepEqual((stored.blob || stored).srs, a.srs, 'what is stored is what is read');
    // a passive pull (the cloud holds exactly this device's rows): no row changes
    const before = copy({ srs: a.srs, moves: a.moves });
    h.facade.pullNeural = async id => ({ userId: id, blob: blob({}, copy(before)) });
    assert.equal(await a._pullAndMerge(), true);
    assert.deepEqual({ srs: a.srs, moves: a.moves }, before, 'a passive pull rewrites nothing');
  });
}));

// ── L1-R3 (v1.290.0, the orchestrator's ruling of 17 Nov 2026, which takes back L1-R2's "write back what is not read"):
// `explored` HOLDS UNIQUE STRINGS, EACH A PLACE'S KEY, AND NOTHING ELSE, FOR GOOD. A list with a damaged entry is READ
// (the app boots: L1-R1), and the next save writes the unique strings only; a merge is the union of two copies' strings.
// Why not keep the rest (measured by the third read of PR #434): every older build's validator refuses a non-string
// here, so a record saved with one locks those devices out ("pull-failed", nothing pushed), and repeats never settled
// between two devices. The fake cloud HOLDS a record (a pull returns it, a push replaces it). The older validators are
// the captured ones (tests/artifacts/progress_validators.json: v1.280.4, v1.252.0 (production until 19 Nov), and since
// v1.295.4 v1.293.3 and v1.294.0 (production since 19 Nov; one file, the same sha256); dev v1.289.0's line for `explored` is
// the same text).
// MUTANTS (each applied alone to progress-owner.src.js, red on the named test; the clean file green before and after):
//   L1-R3a the reader keeping a non-string as a key (so the save writes it)  → "a pull, a new place and a push…"
//   L1-R3b the empty string kept as a place                                  → "a guest's damaged record…"
const OLDER = Object.entries(JSON.parse(read('./artifacts/progress_validators.json')).clients).map(([name, v]) => [name, new Function(v.validator + '\nreturn ngProgressValidateBlob;')()]);
// THE TWO THAT REFUSE a damaged `explored` list, by name: the premise is about them (v1.293.3 and v1.294.0, captured since
// v1.295.4, accept it, so they are only READERS here: every "reads it" line runs over all four, every "refuses it" premise
// over exactly these two, as strict as when they were the only rows)
const REFUSING = OLDER.filter(([name]) => name === 'v1.280.4' || name === 'v1.252.0');
const DAMAGED = [42, 42, 'Mount|Top', 'Mount|Top', { k: 1 }, ''];
function cloudOf(h, cloud) {
  h.facade.pullNeural = async id => ({ userId: id, blob: cloud.blob === null ? null : JSON.parse(JSON.stringify(cloud.blob)) });
  h.facade.pushNeural = async value => { cloud.blob = JSON.parse(JSON.stringify(value)); cloud.pushes++; return true; };
  return h;
}
async function fixedClock(run) { const now = Date.now; Date.now = () => 1795000000000; try { return await run(); } finally { Date.now = now; } }
test('a pull, a new place and a push: the cloud holds the unique strings only, every other key as the control\'s, and every older validator reads it (L1-R3)', async () => fakeTimers(async ({ flush }) => fixedClock(async () => {
  assert.equal(OLDER.length, 4, 'premise: the captured older validators are here');
  assert.equal(REFUSING.length, 2, 'premise: the two that refuse a damaged list are among them');
  for (const [name, validate] of REFUSING) assert.throws(() => validate(blob({}, { explored: DAMAGED })), /Invalid explored history/, 'premise: ' + name + ' refuses the damaged list');
  const visit = async (explored) => {
    const cloud = { blob: blob({ 'Mount|Top': 3 }, { explored, futureField: { keep: [1, 2] } }), pushes: 0 };
    const h = cloudOf(harness(), cloud); await h.boot(); const a = h.switchTo('A');
    assert.equal(await a._pullAndMerge(), true); await flush();
    const read = { keys: [...a._exploredKeys], bad: a._exploredBad };
    a._exploredKeys.add('Turtle|Bottom');   // a visit to a new place
    a._saveProgress(); await flush();
    return { cloud, read, stored: h.host.store.read(ownerA).blob };
  };
  const got = await visit(DAMAGED), control = await visit(['Mount|Top']);
  // (a pull merges through a staged copy, so what this device holds afterwards is already the strings only: nothing is
  // left to count; the count is for a list a device LOADED from its own storage: the guest test below)
  assert.deepEqual(got.read, { keys: ['Mount|Top'], bad: 0 }, 'read: one place, once; the 42s, the object and the empty string are not kept');
  assert.ok(got.cloud.pushes >= 1, 'pushed');
  assert.deepEqual(got.cloud.blob.explored, ['Mount|Top', 'Turtle|Bottom'], 'the cloud: the unique strings only, in their order, then the new place');
  assert.deepEqual(got.stored.explored, ['Mount|Top', 'Turtle|Bottom'], 'and the stored copy');
  const rest = ({ explored, ...b }) => b;
  assert.deepEqual(rest(got.cloud.blob), rest(control.cloud.blob), 'every other key is the control\'s (a good list), value for value');
  for (const [name, validate] of OLDER) assert.doesNotThrow(() => validate(got.cloud.blob), name + ' reads what this build saved');
  assert.doesNotThrow(() => ngProgressValidateBlob(got.cloud.blob));
})));
test('two devices, one holding repeats: both settle on the union of the strings, 0 pushes in 6 idle pulls (L1-R3)', async () => fakeTimers(async ({ flush }) => {
  const cloud = { blob: null, pushes: 0 }, own = ngProgressLocalKey(ownerA);
  const seed = (mem, explored) => mem.rows.set(own, JSON.stringify({ format: 'bjj-progress-owner-v1', owner: ownerA, blob: blob({ x: 1 }, { explored }), savedAt: 0 }));
  const m1 = memory(), m2 = memory();
  seed(m1, [42, 42, 'Mount|Top', 'Mount|Top', null, 'Turtle|Bottom']); seed(m2, ['Closed Guard|Bottom', 'Mount|Top']);
  const d1 = cloudOf(harness(m1), cloud), d2 = cloudOf(harness(m2), cloud);
  await d2.boot(); const b = d2.switchTo('A'); assert.equal(await b._pullAndMerge(), true); b._saveProgress(); await flush();
  await d1.boot(); const a = d1.switchTo('A'); assert.equal(await a._pullAndMerge(), true); a._saveProgress(); await flush();
  assert.deepEqual(cloud.blob.explored, ['Mount|Top', 'Turtle|Bottom', 'Closed Guard|Bottom'], 'device 1: its strings once each, then the cloud\'s it did not hold');
  assert.equal(await b._pullAndMerge(), true); b._saveProgress(); await flush();
  const want = ['Closed Guard|Bottom', 'Mount|Top', 'Turtle|Bottom'];
  assert.deepEqual([...cloud.blob.explored].sort(), want);
  // IDLE: nothing changes on either device, each pulls three times in turn; nobody pushes
  const settled = cloud.pushes;
  for (let i = 0; i < 6; i++) { const d = i % 2 ? a : b; assert.equal(await d._pullAndMerge(), true); await flush(); }
  assert.equal(cloud.pushes - settled, 0, '0 pushes in 6 idle pulls');
  assert.deepEqual([...a._exploredKeys].sort(), want); assert.deepEqual([...b._exploredKeys].sort(), want);
  for (const [name, validate] of OLDER) assert.doesNotThrow(() => validate(cloud.blob), name + ' reads the settled record');
}));
test("a guest's damaged record is healed at its first save: the unique strings only, which every older validator reads (L1-R3)", async () => {
  const mem = memory(), key = ngProgressLocalKey(guest), was = blob({}, { explored: ['', 'Mount|Top', 42, 'Mount|Top'] });
  mem.rows.set(key, JSON.stringify({ format: 'bjj-progress-owner-v1', owner: guest, blob: was, savedAt: 0 }));
  assert.equal(REFUSING.length, 2, 'premise: the two that refuse a damaged list are captured');
  for (const [name, validate] of REFUSING) assert.throws(() => validate(was), /Invalid explored history/, 'premise: ' + name + ' refuses it as stored');
  const h = harness(mem); await h.boot(); const a = h.get();
  assert.equal(h.mounted.length, 1, 'the app boots on it (L1-R1)');
  assert.deepEqual([...a._exploredKeys], ['Mount|Top']);
  assert.equal(a._exploredBad, 1, 'the 42 is counted; the empty string was never a place, so it is not');
  a._saveProgress(); a._flushSave();
  const saved = JSON.parse(mem.rows.get(key)).blob;
  assert.deepEqual(saved.explored, ['Mount|Top'], 'the first save: the place once, nothing else');
  for (const [name, validate] of OLDER) assert.doesNotThrow(() => validate(saved), name + ' reads the healed record');
});

// ── L2-R1 (v1.292.0, the reader of PR #438 and the orchestrator's rulings, 18 Nov 2026): the cloze's confirm and its Undo,
// on the real app class and the real owner host, with a storage that can remove a key and a cloud that HOLDS a record.
// MUTANTS (each applied alone, red on the named test; the clean code green before and after):
//   L2-R1a the seat's existence read per answer (app.src.jsx, `_gradeMoves`)      → "two new moves at a place that had none…"
//   L2-R1b the journal key the confirm made is left behind, empty (`unjournal`)   → "two new moves at a place that had none…"
//   L2-R1c the push not held while an Undo is offered (both guards in `_pushCloud`) → "the cloud push waits while an Undo is offered…"
//   L2-R1d the hold ends and the Undo stays on the line (`_undoEnd`)              → "the cloud push waits while an Undo is offered…"
//   L2-R1e a hidden tab keeps the hold (`_undoHeld`)                              → "a hidden tab ends the hold: the Undo first…"
//   L2-R2a `ngClozeDone` never sets the hold (master-cloze.src.js)                → "the cloud push waits while an Undo is offered…"
//   L2-R2b `ngClozeDone` leaves the confirm before with its Undo                  → "the cloud push waits while an Undo is offered…"
//   L2-R2c `ngClozeDone` sets the hold after the write                            → SURVIVES (see `confirm` below: the timer's own guard)
const memory2 = () => { const m = memory(); m.removeItem = k => { m.rows.delete(k); }; return m; };
const PENDING = owner => ngProgressLocalKey(owner, 'pending');
// the whole of what is stored, every key, with the two times a save writes taken out: the record's `updatedAt` and the
// envelope's `savedAt` (what "exactly" leaves out, and nothing else)
function storedWhole(mem) {
  const out = {};
  for (const [k, v] of [...mem.rows].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    let x; try { x = JSON.parse(v); } catch { x = v; }
    if (x && typeof x === 'object' && x.blob && typeof x.blob === 'object') { x = JSON.parse(JSON.stringify(x)); delete x.savedAt; delete x.blob.updatedAt; }
    out[k] = x;
  }
  return JSON.stringify(out);
}
async function withDocument(doc, run) { const old = globalThis.document; globalThis.document = doc; try { return await run(); } finally { if (old === undefined) delete globalThis.document; else globalThis.document = old; } }
test('L2-R1: two new moves at a place that had none, Done then Undo: everything stored is what it was (the two save times apart), and the journal key the confirm made is gone', async () => fakeTimers(async ({ flush }) => {
  const mem = memory2(), h = harness(mem); await h.boot(); const a = h.get(), D = a._epochDay();
  a.moves = { '76/bottom': { 301: [D - 1, 7, D - 8, 1, 7, 7] } }; a._movesRev = 1;
  a._saveProgress(); a._flushSave(); await flush();
  assert.equal(mem.rows.has(PENDING(guest)), false, 'premise: this browser has no journal yet');
  const before = storedWhole(mem), moves = JSON.stringify(a.moves);
  const u = a._gradeMoves([['108/top', '316', true], ['108/top', '1242', false]]); a._flushSave(); await flush();
  assert.equal(JSON.parse(mem.rows.get(PENDING(guest))).e.length, 2, 'premise: the confirm made the journal, two entries');
  assert.deepEqual(Object.keys(JSON.parse(mem.rows.get(ngProgressLocalKey(guest))).blob.moves['108/top']), ['316', '1242'], 'premise: and the stored record holds the new seat');
  assert.equal(a._ungradeMoves(u), true); a._flushSave(); await flush();
  assert.equal(JSON.stringify(a.moves), moves, 'the moves record in hand: no empty seat left');
  assert.equal(mem.rows.has(PENDING(guest)), false, 'the journal key the confirm made is gone with its entries');
  assert.equal(storedWhole(mem), before, 'everything stored, every key, is what it was (the two save times apart)');
  // a journal that already held an answer goes back as the same text, its counter included
  a._gradeMoves([['76/bottom', '302', true]]); a._flushSave(); await flush();
  const journal = mem.rows.get(PENDING(guest)), stored = storedWhole(mem);
  const u2 = a._gradeMoves([['108/top', '316', false], ['108/top', '1242', true], ['76/bottom', '301', false]]); a._flushSave(); await flush();
  assert.equal(JSON.parse(mem.rows.get(PENDING(guest))).e.length, 4);
  assert.equal(a._ungradeMoves(u2), true); a._flushSave(); await flush();
  assert.equal(mem.rows.get(PENDING(guest)), journal, 'a journal that held an answer is the same text again, its counter included');
  assert.equal(storedWhole(mem), stored, 'and everything stored is what it was');
}));
// A CONFIRM IS THE APP'S OWN `ngClozeDone` (L2-R2, the orchestrator's point 2: until then this helper wrote out its
// three steps by hand, so a change there could not turn these tests red). The cloze it is handed is a shown one with
// these moves asked and the `ok` ones tapped, on a session the drawer shows; its host is a stand-in that takes the
// markup and is not on a page (the fit, the foot and the heading have nothing to do there).
// WHAT THE ORDER INSIDE IT IS WORTH, said so nobody reads more into these tests than they prove: the hold is set BEFORE
// the write, and `_pushCloud` also asks `_undoHeld()` when its timer fires. Either guard alone holds a push here (the
// mutant "hold set after the write" SURVIVES these tests: the timer's guard covers it; the mutant "hold never set" and
// the mutant "the confirm before keeps its Undo" are red, L2-R2a and L2-R2b below).
const standIn = () => ({ toggleAttribute() {}, setAttribute() {}, set innerHTML(_v) {}, isConnected: false, hidden: false });
function confirm(a, s, seat, list) {
  const id = ([st, mv]) => 'm:' + st + ':' + mv;
  const rows = list.map((x, i) => ({ id: id(x), st: x[0], mv: x[1], ask: true, w: 1, idx: i, name: 'move ' + x[1], tri: false, leads: [] }));
  const c = { seat, rows, down: new Set(), shown: true, had: new Set(list.filter(x => x[2]).map(id)), done: null, side: 'top' };
  s.cz.set(seat, c); s.czOpen = seat; s.czHost = s.czHost || standIn();
  ngClozeDone(a, s);
  assert.ok(c.done && c.done.u && c.done.u.ids, 'premise: the app\'s own Done confirmed it (' + seat + ')');
  return c;
}
async function signedIn(cloud, mem = memory2()) {
  const h = cloudOf(harness(mem), cloud); await h.boot(); const a = h.switchTo('A');
  assert.equal(await a._pullAndMerge(), true);
  const s = { cz: new Map() }; a._session = s; a.deckShown = true; a._painted = 0; a._paintPractice = () => { a._painted++; };
  return { h, a, s, mem };
}
test('L2-R1: the cloud push waits while an Undo is offered, and when the hold ends the Undo is withdrawn first; then ONE push, holding the rows', async () => fakeTimers(async ({ flush }) => withDocument({ hidden: false, visibilityState: 'visible' }, async () => {
  const cloud = { blob: blob({ 'Mount|Top': 3 }, { moves: { '76/bottom': { 301: [20000, 7, 19993, 1, 7, 7] } } }), pushes: 0 };
  const { a, s } = await signedIn(cloud); await flush(); await flush();
  const p0 = cloud.pushes, held = JSON.stringify(cloud.blob.moves);
  const c = confirm(a, s, 'Side Control|Top', [['108/top', '316', true], ['108/top', '1242', false]]);
  for (let i = 0; i < 4; i++) { a._saveProgress(); await flush(); }
  a._pushCloud(); await flush(); await flush();
  assert.equal(cloud.pushes - p0, 0, 'no push while the Undo is offered: not from the confirm\'s own save, not from later saves, not when asked for');
  assert.equal(JSON.stringify(cloud.blob.moves), held, 'the cloud has not seen the confirm');
  assert.ok(c.done.u, 'and the Undo is still offered');
  // the place is left: the Undo goes first, then the push
  let undoAtPush = 'never pushed';
  const push = a._auth().pushNeural; a._auth().pushNeural = async v => { undoAtPush = c.done.u; return push(v); };
  const painted = a._painted;   // (the app's own Done painted once already)
  a._undoRelease();
  assert.equal(c.done.u, null, 'the hold ends: the Undo is withdrawn at once');
  assert.equal(a._painted - painted, 1, 'and the line is drawn again without it');
  await flush(); await flush();
  assert.equal(cloud.pushes - p0, 1, 'then ONE push');
  assert.equal(undoAtPush, null, 'made after the Undo was withdrawn, never before');
  assert.deepEqual(cloud.blob.moves['108/top'], a.moves['108/top'], 'the pushed record holds the confirm\'s rows');
  assert.equal(cloud.blob.moves['108/top']['316'][3], 1); assert.equal(cloud.blob.moves['108/top']['1242'][3], 0);
  // a confirm, then its Undo: the cloud never sees the rows at all, and the Undo's own push carries the record as it was
  const p1 = cloud.pushes, c2 = confirm(a, s, 'Mount|Bottom', [['76/bottom', '302', true]]);
  a._saveProgress(); await flush(); await flush();
  assert.equal(cloud.pushes - p1, 0);
  assert.equal(a._ungradeMoves(c2.done.u), true); await flush(); await flush();
  assert.equal(cloud.blob.moves['76/bottom']['302'], undefined, 'a confirm undone is never in the cloud');
  // two confirms one after the other (the second inside the first's debounce): the push waits for the second's Undo
  // too, since the record it would send holds the second confirm; when that ends, one push holds both
  const p2 = cloud.pushes, c3 = confirm(a, s, 'Mount|Bottom', [['76/bottom', '303', true]]), c4 = confirm(a, s, 'Side Control|Top', [['108/top', '400', true]]);
  assert.equal(c3.done.u, null, 'the next confirm ends the Undo of the one before');
  a._saveProgress(); await flush(); await flush();
  assert.equal(cloud.pushes - p2, 0, 'still held: the newer confirm can be undone');
  a._undoRelease(); await flush(); await flush();
  assert.ok(cloud.pushes - p2 >= 1, 'pushed once the last Undo is over');
  assert.equal(c4.done.u, null);
  assert.equal(cloud.blob.moves['76/bottom']['303'][3], 1); assert.equal(cloud.blob.moves['108/top']['400'][3], 1);
})));
test('L2-R1: a hidden tab ends the hold: the Undo first, then the push; and a drawer shut or another session the same', async () => fakeTimers(async ({ flush }) => {
  for (const how of ['hidden', 'drawer', 'session']) {
    const doc = { hidden: false, visibilityState: 'visible' };
    await withDocument(doc, async () => {
      const cloud = { blob: blob({ 'Mount|Top': 3 }), pushes: 0 };
      const { a, s } = await signedIn(cloud); await flush(); await flush();
      const p0 = cloud.pushes, c = confirm(a, s, 'Mount|Bottom', [['76/bottom', '301', true]]);
      a._saveProgress(); await flush(); await flush();
      assert.equal(cloud.pushes - p0, 0, how + ': premise: held');
      if (how === 'hidden') { doc.hidden = true; doc.visibilityState = 'hidden'; } else if (how === 'drawer') a.deckShown = false; else a._session = { cz: new Map() };
      a._pushCloud();   // any push asked for after that (the tab's own flush, a later save)
      assert.equal(c.done.u, null, how + ': the Undo is withdrawn before anything is sent');
      await flush(); await flush();
      assert.equal(cloud.pushes - p0, 1, how + ': and the confirm goes up, once');
      assert.equal(cloud.blob.moves['76/bottom']['301'][3], 1);
      assert.equal(a._undoHold, null);
    });
  }
}));
test('L2-R1: a cloze\'s Done pushes the rows a roll\'s answers push, and a second device that pulls them merges them as it merges a roll\'s', async () => fakeTimers(async ({ flush }) => withDocument({ hidden: false, visibilityState: 'visible' }, async () => fixedClock(async () => {
  const start = () => ({ blob: blob({ 'Mount|Top': 3 }, { moves: { '76/bottom': { 301: [20000, 7, 19993, 1, 7, 7], 302: [20000, 30, 19970, 1, 30, 30] } } }), pushes: 0 });
  const ANSWERS = [['76/bottom', '301', true], ['76/bottom', '302', false], ['76/bottom', '303', true], ['108/top', '316', false]];
  // device 1, a cloze: one confirm of four, then the place is left
  const viaCloze = start(), one = await signedIn(viaCloze); await flush(); await flush();
  confirm(one.a, one.s, 'Mount|Bottom', ANSWERS); one.a._undoRelease(); await flush(); await flush();
  // the control: the same four as a roll gives them, one hidden card at a time (`_gradeMove` hands the writer one answer)
  const viaRoll = start(), two = await signedIn(viaRoll); await flush(); await flush();
  for (const x of ANSWERS) two.a._gradeMoves([x]); await flush(); await flush();
  assert.ok(viaCloze.pushes >= 1 && viaRoll.pushes >= 1, 'premise: both pushed');
  assert.deepEqual(viaCloze.blob.moves, viaRoll.blob.moves, 'the pushed move rows are a roll\'s, field by field');
  for (const [st, mv, ok] of ANSWERS) assert.equal(viaCloze.blob.moves[st][mv][3], ok ? 1 : 0);
  const lines = mem => JSON.parse(mem.rows.get(PENDING(ownerA)) || '{"e":[]}').e.map(e => e.slice(1));
  assert.deepEqual(lines(one.mem), lines(two.mem), 'and the journal lines the same, in the same order');
  // a second device with older rows of its own pulls each cloud: the same merged record either way
  const own = () => { const m = memory2(); m.rows.set(ngProgressLocalKey(ownerA), JSON.stringify({ format: 'bjj-progress-owner-v1', owner: ownerA, savedAt: 0,
    blob: blob({ x: 1 }, { moves: { '76/bottom': { 301: [20003, 3, 20000, 1, 3, 3], 305: [20010, 10, 20000, 1, 10, 10] }, '108/top': { 316: [19999, 1, 19998, 0] } } }) })); return m; };
  const afterCloze = await signedIn(viaCloze, own()); await flush(); await flush();
  const afterRoll = await signedIn(viaRoll, own()); await flush(); await flush();
  assert.deepEqual(afterCloze.a.moves, afterRoll.a.moves, 'the second device holds the same rows after pulling a cloze\'s as after pulling a roll\'s');
  assert.equal(afterCloze.a.moves['76/bottom']['305'][0], 20010, 'its own row for a move the first never answered is kept');
  for (const [st, mv] of ANSWERS) assert.deepEqual(afterCloze.a.moves[st][mv], viaCloze.blob.moves[st][mv], st + ' ' + mv + ': the later answer is the one kept, as a roll\'s is');
  assert.deepEqual(viaCloze.blob.moves, viaRoll.blob.moves, 'and both clouds settle on the same record');
}))));
