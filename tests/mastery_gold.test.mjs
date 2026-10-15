// Collected by test:units and ci:validate. Execute the production palette, cache,
// and actual app methods, including grade publication and per-key progress merge.
// Browser paint, mouse reachability and reload are in mastery-gold.spec.ts.
// Required mutants killed: default On -> default-off test; RGB average -> hue bands;
// position by played seat -> own-half test; removed publish hook -> real-grade test.
// No non-kill among those four; this suite makes no mouse/pixel assertion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
import * as gold from "../neural/src/mastery-gold.src.js";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const strip = p => read("neural/src/" + p).replace(/^export /gm, "");
const source = read("neural/src/app.src.jsx");
const C = new Function("DCLogic", "React", knowledgeSource + "\n" +
  strip("lists-codec.src.js") + "\n" + strip("lists.src.js") + "\n" + strip("progress-owner.src.js") + "\n" +
  read("neural/src/challenge-definitions.src.js") + "\n" + read("neural/src/challenge-engine.src.js") + "\n" +
  source + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
const wire = JSON.parse(read("source/quartz/static/neural/graph-data.json"));
const manifest = JSON.parse(read("source/quartz/static/neural/flashcards/_index.json"));
function app() {
  const a = Object.create(C.prototype);
  Object.assign(a, { settings: {}, stage: {}, prep: {}, rec: {}, srs: {}, _days: {}, beats: [],
    _saveProgress() {}, _progressCurrent: () => true, track() {}, fx() {}, _syncBelt() {}, renderTabSubtitles() {},
    _syncWhiteChallengeCompatibility() {}, _maybeLessonDone() {}, _noteKnowledgeCredit() {},
    noteCardAnswered() {}, refreshOptionOdds() {}, _fetchMasteryGold: () => Promise.resolve(gold),
  });
  a.ingest(structuredClone(wire));
  a._ingestDeckManifest(manifest);
  return a;
}
async function enable(a) { a.set("masteryGold", true); await a._goldLoading; assert.ok(a._mapPaint); }
const [neutral, blue, red, fullGold] = gold.NG_GOLD_PIGMENTS;
const mix = (da, ma, db, mb) => gold.ngGoldColor(gold.ngGoldWeights(da, ma).map((v, i) => (v + gold.ngGoldWeights(db, mb)[i]) / 2));
// Test-only sRGB -> OKLCH conversion, on the same truncated bytes rgba() emits.
// CSS Color 4 conversion matrices; no colour-space library ships with the app.
function oklch(c) {
  const [r,g,b] = ["r","g","b"].map(k => { const v=(c[k]|0)/255; return v<=.04045?v/12.92:((v+.055)/1.055)**2.4; });
  const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b);
  const m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b);
  const s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  const a=1.9779984951*l-2.428592205*m+.4505937099*s;
  const bb=.0259040371*l+.7827717662*m-.808675766*s;
  return { C:Math.hypot(a,bb), h:(Math.atan2(bb,a)*180/Math.PI+360)%360 };
}
function band(c, lo, hi, min) { const v=oklch(c); assert.ok(v.h>=lo&&v.h<=hi&&v.C>=min, JSON.stringify({c,...v,lo,hi,min})); }

test("blue/gold is green and red/gold is orange, in declared OKLCH hue/chroma bands", () => {
  for (const m of [1/3,.5,2/3]) {
    band(gold.ngGoldHalf(blue,1,m),125,170,.10);
    band(gold.ngGoldHalf(red,-1,m),40,80,.12);
    band(gold.ngGoldHalf(neutral,0,m),75,95,.04);
  }
  band(mix(1,0,-1,1),125,170,.10); band(mix(1,1,-1,0),40,80,.12);
  band(mix(1,0,-1,0),300,335,.06);
  for (const a of [-1,-.2,0,.4,1]) for (const b of [-1,0,1]) assert.deepEqual(mix(a,1,b,1),fullGold);
  assert.deepEqual(mix(1,0,1,0),blue); assert.deepEqual(mix(-1,0,-1,0),red); assert.deepEqual(mix(0,0,0,0),neutral);
});

test("zero mastery preserves every runtime base object and bytes; colour is continuous and in gamut", () => {
  const a=app(); assert.ok(a.nodes.length>2500);
  for (const n of a.nodes) {
    assert.equal(gold.ngGoldHalf(n.col,n.dom,0),n.col);
    assert.equal(gold.ngGoldHalf(n.col,n.dom,null),n.col);
    assert.equal(a.rgba(gold.ngGoldHalf(n.col,n.dom,0),.62),a.rgba(n.col,.62));
  }
  for (let si=-10;si<=10;si++) {
    let last=gold.ngGoldColor(gold.ngGoldWeights(si/10,0));
    for(let i=1;i<=20000;i++) {
      const c=gold.ngGoldColor(gold.ngGoldWeights(si/10,i/20000));
      for(const k of ["r","g","b"]) { assert.ok(c[k]>=-1e-9&&c[k]<=255+1e-9); assert.ok(Math.abs(c[k]-last[k])<.04); }
      last=c;
    }
  }
  console.log(`mastery-gold: ${a.nodes.length} real base halves, 420021 continuity samples`);
});

test("default off imports nothing and off paint is byte-identical at every zoom", async () => {
  const a=app(); let loads=0; a._fetchMasteryGold=()=>{loads++;return Promise.resolve(gold);};
  a._rebuildMapPaint(); assert.equal(a._goldLoading,undefined,"default boot must never import"); assert.equal(loads,0); assert.equal(a._mapPaint,null);
  const check=()=>{for(const k of [0,.001,.2,.5,.99,1]) { a._lodK=k; for(const n of a.nodes) {
    assert.equal(a._mapColor(n),n.col); assert.equal(a._mapColor(n,true),n.colU||n.col);
  }}};
  check(); await enable(a); a.set("masteryGold",false); check(); assert.equal(loads,1);
});

test("current position halves read their own decks, never the player's seat; missing is null", async () => {
  const a=app(), n=a.nodes.find(n=>n.ty==="positions"&&n.rep), p=a.nodes[n.pi];
  a.currentPos=n.idx; a.playerRole="bottom";
  const key=gold.ngGoldDeckKey(n), other=gold.ngGoldDeckKey(p);
  assert.notEqual(key,other); assert.match(key,/\|Top$/); assert.match(other,/\|Bottom$/);
  a.flashcards.decks[key]={n:1}; a.stage[key]={test:3};
  await enable(a);
  assert.equal(a._mapPaint[n.idx].key,key); assert.equal(a._mapPaint[p.idx].key,other);
  assert.equal(a._mapPaint[n.idx].mastery,1); assert.equal(a._mapPaint[p.idx].mastery,0);
  assert.deepEqual(a._mapPaint[n.idx].halfPaint,fullGold);
  delete a.flashcards.decks[key]; a._publishKnowledge("manifest-change");
  assert.equal(a._mapPaint[n.idx].mastery,null); assert.equal(a._mapPaint[n.idx].halfPaint,n.col);
  a.flashcards.decks[key]={n:0}; a._publishKnowledge("empty-deck"); assert.equal(a._mapPaint[n.idx].mastery,null);
});

test("a real recall grade retints immediately; failed review moves paint back", async () => {
  const a=app(), n=a.nodes.find(n=>n.ty==="positions"&&n.rep), key=gold.ngGoldDeckKey(n);
  const card={q:"Recall the tested position",a:"Test answer"};
  a.flashcards.decks[key]={n:1,cards:[card]};
  await enable(a); const before=a._mapPaint[n.idx].halfPaint;
  assert.equal(a.gradeRecall(key,card,true,"first","deck").status,"applied");
  assert.equal(a._mapPaint[n.idx].mastery,a.deckMastery(key));
  assert.ok(a._mapPaint[n.idx].mastery>0); assert.notDeepEqual(a._mapPaint[n.idx].halfPaint,before);
  const learned=a._mapPaint[n.idx].mastery;
  assert.equal(a.gradeRecall(key,card,false,"failed","deck").status,"applied");
  assert.ok(a._mapPaint[n.idx].mastery<learned); assert.equal(a._mapPaint[n.idx].mastery,a.deckMastery(key));
});

test("cached endpoints share the site, preserve lower shade, and hand over continuously without a lookup", async () => {
  const a=app(); await enable(a); const n=a.nodes.find(n=>n.rep&&n.pi>=0), p=a.nodes[n.pi];
  assert.equal(a._mapPaint[n.idx].sitePaint,a._mapPaint[p.idx].sitePaint);
  assert.equal(a._mapPaint[p.idx].lowerPaint,p.colU);
  a.deckMastery=()=>{throw Error("mastery lookup in a frame");};
  for(const node of [n,p]) {
    a._lodK=0; assert.equal(a._mapColor(node,true),a._mapPaint[node.idx].sitePaint);
    let last=a._mapColor(node,true);
    for(let i=1;i<=1000;i++) { a._lodK=i/1000; const c=a._mapColor(node,true); for(const k of ["r","g","b"])assert.ok(Math.abs(c[k]-last[k])<.3); last=c; }
    assert.equal(a._mapColor(node,true),node.colU||node.col);
  }
});

test("late import uses latest progress/setting, disabled completion stays off, and failure can retry", async () => {
  const a=app(); let release, loads=0;
  a._fetchMasteryGold=()=>{loads++;return new Promise(r=>{release=r;});};
  a.set("masteryGold",true); const pending=a._goldLoading;
  a._publishKnowledge("another-grade"); assert.equal(loads,1);
  a.set("masteryGold",false); release(gold); await pending; assert.equal(a._mapPaint,null);
  a.set("masteryGold",true); assert.ok(a._mapPaint); assert.equal(loads,1);
  const b=app(); b._fetchMasteryGold=()=>Promise.reject(Error("offline test"));
  b.set("masteryGold",true); await b._goldLoading; assert.equal(b._mapPaint,null);
  b._fetchMasteryGold=()=>Promise.resolve(gold); b._rebuildMapPaint(); await b._goldLoading; assert.ok(b._mapPaint);
});

test("per-key cloud merge and hydrated owner progress rebuild current paint without mutating base colours", async () => {
  const a=app(), base=JSON.stringify(a.nodes.map(n=>[n.col,n.colU]));
  a._goldModule=gold; a.settings={masteryGold:false}; a._settingsAt={masteryGold:20};
  a._mergeProgressFields({v:2,settings:{masteryGold:true},settingsAt:{masteryGold:30},updatedAt:30});
  assert.equal(a.settings.masteryGold,true); a._publishKnowledge("merged-progress"); assert.ok(a._mapPaint);
  a._mergeProgressFields({v:2,settings:{masteryGold:false},settingsAt:{masteryGold:10},updatedAt:10});
  assert.equal(a.settings.masteryGold,true,"older Off cannot erase newer On");
  a._hydrateProgressBlob({v:2,settings:{masteryGold:false}}); assert.equal(a._mapPaint,null);
  a._hydrateProgressBlob({v:2,settings:{masteryGold:true}}); assert.ok(a._mapPaint);
  assert.equal(JSON.stringify(a.nodes.map(n=>[n.col,n.colU])),base);
});
