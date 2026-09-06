// Real wire + real state-machine methods. Rendering is stubbed only in execution tests;
// browser interaction and threat preview are covered by submission-choices.spec.ts.
// Mutation checks: removing Finish fails tests 1/5; forcing Bottom escape seats fails 1/4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
const Component = new Function('DCLogic','React', read('neural/src/app.src.jsx')+'\nreturn Component;')(class {}, {createRef:()=>({current:null})});
const wire = JSON.parse(read('source/quartz/static/neural/graph-data.json'));
async function boot() {
  const a = Object.create(Component.prototype);
  a.settings={}; a.beats=[]; a.get=(_k,d)=>d; a.set=a.track=a._saveProgress=()=>{};
  a.ingest(structuredClone(wire));
  a._dataBase=()=>"/submission-test/";
  await Promise.all(a.nodes.filter(n=>n.rep && n.ty==='submissions').map(n=>a.loadSubmissionChoices(n)));
  return a;
}
// Keep the real async loader; replace only its transport with the emitted files.
globalThis.fetch = async url => ({ok:true,json:async()=>JSON.parse(read('source/quartz/static/neural/'+String(url).replace('/submission-test/',''))) });
const flip = r => r==='top'?'bottom':'top';
const find = (a,t) => a.nodes.find(n=>n.rep && n.t===t);

test('every available submission has one finish, owned continuations, and named defenses in both rulesets',async()=>{
  const a=await boot();
  for(const frame of ['gi','nogi']) {
    a._giMode=frame;
    const subs=a.nodes.filter(n=>n.rep && n.ty==='submissions' && a.rsAllows(n));
    assert.ok(subs.length>=267);
    for(const s of subs) {
      a.currentPos=s.idx; a.playerRole=s.fromRole;
      const own=a.optionsFor(s.idx);
      assert.equal(own.filter(o=>o.action==='finish').length,1,s.t);
      assert.equal(a.choiceLabel(own[0]),'Finish',s.t);
      assert.equal(own[0].idx,s.idx,s.t);
      for(const o of own) {
        assert.equal(o.node.fromRole,s.fromRole,`${s.t}: ${o.node.t} belongs to another seat`);
        assert.ok(!o.threat);
      }
      const defenses=a.optionsFor(s.pi,flip(s.fromRole));
      assert.ok(defenses.length>=1,s.t);
      assert.equal(new Set(defenses.map(o=>o.label)).size,defenses.length,s.t);
      for(const d of defenses) {
        assert.equal(d.action,'escape'); assert.ok(d.res>=0,s.t);
        const landed=a.nodes[d.res], sub=a.submissionNode(landed);
        const physical=sub ? (landed.role==='defender'?flip(sub.fromRole):sub.fromRole) : landed.role;
        assert.equal(physical,d.destinationRole,`${s.t}: ${d.label}`);
        assert.ok(d.label && d.label!==s.t,s.t);
      }
      const before=a.playerRole;
      const threats=a.opponentThreats(s.idx);
      assert.equal(a.playerRole,before);
      assert.deepEqual(threats.map(o=>o.label),defenses.map(o=>o.label),s.t);
      assert.ok(threats.every(o=>o.threat && o.actor==='opponent'));
    }
  }
});

test('old control URLs resolve to the same submission state and physical seat as actual arrivals',async()=>{
  const a=await boot();
  for(const n of a.nodes.filter(n=>n.ty==='positions' && n.cal?.stateAlias)) {
    const dest=a.canonicalState(n.idx,n.role);
    const s=a.submissionNode(a.nodes[dest]);
    if(!s || !a.giAllows(s)) continue;
    assert.notEqual(dest,n.idx,n.t);
    assert.equal(a.rsAllows(n),false);
    const route=a._nodeAndRoleForPath('/'+n.id);
    assert.equal(route.idx,dest,n.id);
    assert.equal(route.role,n.role,n.id);
    a.playerRole=n.role;
    assert.deepEqual(a.optionsFor(n.idx).map(o=>[o.action,o.idx,o.label]),a.optionsFor(dest).map(o=>[o.action,o.idx,o.label]),n.t);
  }
});

test('triangle offers its finish, three joint locks, and a concretely named back take',async()=>{
  const a=await boot(),s=find(a,'Triangle Choke from Triangle Control');
  a.playerRole=s.fromRole;
  const labels=a.optionsFor(s.idx).map(o=>a.choiceLabel(o));
  for(const label of ['Finish','Attack Kimura','Attack Americana','Attack straight arm lock','Take the back']) assert.ok(labels.includes(label),label);
  assert.ok(!labels.some(l=>l.includes('Triangle Control')));
  const threats=a.opponentThreats(s.idx).map(o=>o.label);
  assert.deepEqual(threats,['Posture up','Stack escape']);
  const mount=find(a,'Americana from Mount'),side=find(a,'Americana from Side Control');
  assert.notEqual(mount.idx,side.idx);
  assert.notEqual(mount.id,side.id);
});

async function executionApp() {
  const a=await boot();
  for(const k of ['_declineLandQ','clearLandCard','fx','setEvent','frameNodes','buildDrillPanel','showVignette','buildPanicCard','clearTimers','clearOptions','killVignette','flashFx','bumpBounce','_syncHandLayer','after','_prefetchLandDeck','setPaused','releaseCamera','_flushLandSkipDebt','_disarmLandClock']) a[k]=()=>{};
  a._deckHasCards=()=>true; a.renderChoiceGroups=()=>{};
  a.optionsRef={current:{innerHTML:'',style:{}}};
  a.startTravel=(_p,done)=>done(); a.rng=()=>0; a.aiSkill=0; a._momentum=0;
  return a;
}
test('executing each primary triangle defense preserves the correct top role',async()=>{
  const a=await executionApp(),s=find(a,'Triangle Choke from Triangle Control');
  for(const [label,dest] of [['Posture up','open-guard'],['Stack escape','half-guard']]) {
    a.currentPos=s.pi; a.playerRole='top'; a.enterDefense(s.idx);
    const o=a._optList.find(o=>o.label===label);
    a._optPick(o);
    assert.equal(a.nodes[a.currentPos].posId,dest);
    assert.equal(a.playerRole,'top');
    assert.equal(a.nodes[a.currentPos].role,'top');
  }
});
test('selecting an alternative submission enters its state without ending the round',async()=>{
  const a=await executionApp(),s=find(a,'Triangle Choke from Triangle Control');
  a.currentPos=s.idx; a.playerRole=s.fromRole;
  let lands=0; a.enterLand=()=>{lands++}; a.endRound=()=>assert.fail('entry is not a finish');
  const o=a.optionsFor(s.idx).find(o=>a.choiceLabel(o)==='Attack Kimura');
  a.enterAttempt(o);
  assert.equal(a.nodes[a.currentPos].t,'Kimura from Triangle Control');
  assert.equal(lands,1);
  assert.equal(a.optionsFor(a.currentPos)[0].action,'finish');
  const before=a.currentPos; a.enterAttempt({...o,threat:true}); assert.equal(a.currentPos,before); assert.equal(lands,1);
});
