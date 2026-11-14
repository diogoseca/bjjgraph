// Collected by test:units and ci:validate. Execute the production palette, cache,
// and actual app methods, including grade publication and per-key progress merge.
// Browser paint, mouse reachability and reload are in mastery-gold.spec.ts.
// Owner's 2026-10-15 decision: always mix the overview, including mastery gold Off.
// Boot stays deferred; only split halves retain the byte-identical Off contract.
// Mutants killed: default mix false and pre-paint import -> default overview test;
// RGB average -> hue bands;
// position by played seat -> own-half test; removed publish hook -> real-grade test.
// Settings veto and missing idle deadline -> first-hand scheduler test.
// All seven killed; this suite makes no mouse/pixel assertion.
// v1.280.0 (GOLD1, ruled): "Turn what you know gold" is RETIRED (the map's gold is the outlines, NG_MAP_MARKS); the stored
// key stays readable and is never read for paint, and the module keeps only the site mix, exactly as it painted with the
// switch Off. EACH TEST BELOW says what it claimed before: kept, restated for the site mix or the inside mark (`_answered`),
// or its gold half retired, with the reason (the table is in the GOLD1 report and the PR).
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
// v1.280.0: `enable` (turn the switch On, wait for the import) became `warm`: the paint warms by itself; the switch is gone
async function warm(a) { a._mapPaintReady=true; a._rebuildMapPaint(); await a._goldLoading; assert.ok(a._mapPaint); }
const [neutral, blue, red] = gold.NG_GOLD_PIGMENTS;
const mix = (da, db) => gold.ngGoldColor(gold.ngGoldWeights(da).map((v, i) => (v + gold.ngGoldWeights(db)[i]) / 2));
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

// v1.280.0 RESTATED. Was "blue/gold is green and red/gold is orange, in declared OKLCH hue/chroma bands": the gold half of the
// palette (green, orange, full gold) is retired with the recolour; the site mix's own claims stay, unchanged.
test("a blue/red site mixes to purple in its OKLCH band; a site of one colour keeps it", () => {
  band(mix(1,-1),300,335,.06);
  assert.deepEqual(mix(1,1),blue); assert.deepEqual(mix(-1,-1),red); assert.deepEqual(mix(0,0),neutral);
});

// v1.280.0 RESTATED. Was "zero mastery preserves every runtime base object and bytes; colour is continuous and in gamut",
// over mastery 0 to 1: there is no mastery in the paint now. Kept: every half paints its OWN base object, byte-identical,
// and the site mix is continuous (now over the strength a site averages) and in gamut.
test("every half paints its own base object, byte-identical; the site mix is continuous and in gamut", async () => {
  const a=app(); assert.ok(a.nodes.length>2500); await warm(a);
  for (const n of a.nodes) {
    assert.equal(a._mapPaint[n.idx].halfPaint,n.col);
    assert.equal(a.rgba(a._mapPaint[n.idx].halfPaint,.62),a.rgba(n.col,.62));
  }
  let samples=0;
  for (let si=-10;si<=10;si++) {
    let last=mix(si/10,-1);
    for(let i=1;i<=20000;i++) {
      const c=mix(si/10,-1+2*i/20000); samples++;
      for(const k of ["r","g","b"]) { assert.ok(c[k]>=-1e-9&&c[k]<=255+1e-9); assert.ok(Math.abs(c[k]-last[k])<.04); }
      last=c;
    }
  }
  console.log(`mastery-gold: ${a.nodes.length} real base halves, ${samples} continuity samples`);
});

test("default overview mixes both halves after idle; gold-off halves stay byte-identical", async () => {
  const a=app(); let loads=0; a._fetchMasteryGold=()=>{loads++;return Promise.resolve(gold);};
  a._rebuildMapPaint(); assert.equal(a._goldLoading,undefined,"default boot must never import"); assert.equal(loads,0); assert.equal(a._mapPaint,null);
  for(const k of [0,.2,.5,1]) { a._lodK=k; for(const n of a.nodes) {
    assert.equal(a._mapColor(n),n.col); assert.equal(a._mapColor(n,true),n.colU||n.col);
  }}
  a._mapPaintReady=true; a._rebuildMapPaint(); await a._goldLoading;
  assert.ok(a._mapPaint,"default overview must mix without ever enabling gold");
  const check=()=>{
    let sites=0,changed=0;
    for(const n of a.nodes) {
      a._lodK=1;
      assert.equal(a._mapColor(n),n.col); assert.equal(a._mapColor(n,true),n.colU||n.col);
      assert.equal(a.rgba(a._mapColor(n),.62),a.rgba(n.col,.62));
      if(!n.rep||n.pi<0) continue;
      const p=a.nodes[n.pi], expected=mix(n.dom,p.dom);
      a._lodK=0;
      assert.deepEqual(a._mapColor(n),expected); assert.equal(a._mapColor(n),a._mapColor(p,true));
      sites++; if(a.rgba(expected,1)!==a.rgba(n.col,1)) changed++;
    }
    assert.ok(sites>1000); assert.ok(changed>1000);
  };
  check(); assert.equal(a.get("masteryGold",false),false);
  // v1.280.0 RESTATED: was "enable gold, turn it Off, the Off paint is back"; now the stored key, set either way, changes
  // nothing and imports nothing more (the switch is retired, the key kept readable)
  a.set("masteryGold",true); a._rebuildMapPaint(); check(); a.set("masteryGold",false); a._rebuildMapPaint(); check(); assert.equal(loads,1);
});

test("palette waits for first hand paint, then warms by its idle deadline even when Settings covers it", async () => {
  const previous={window:globalThis.window,raf:globalThis.requestAnimationFrame,timer:globalThis.setTimeout};
  for(const fallback of [false,true]) {
    // Ingest has unrelated timers. Control only this scheduler's synchronous work;
    // restore the host timers before yielding to the test runner or import promise.
    const a=app(),b=app(),frames=[],idles=[],tasks=[],deadlines=[]; let playable=false,loads=0;
    globalThis.window={requestIdleCallback:fallback?undefined:(cb,options)=>{idles.push(cb);deadlines.push(options?.timeout);}};
    globalThis.requestAnimationFrame=cb=>frames.push(cb);
    globalThis.setTimeout=cb=>tasks.push(cb);
    try {
      a._gameValuePlayable=()=>playable&&!a.__ngDestroyed;
      a._fetchMasteryGold=()=>{loads++;return Promise.resolve(gold);};
      // v1.280.0: was "even saved/enabled gold waits for a hand"; the stored key no longer matters, the wait does
      a.set("masteryGold",true); a._warmMapPaint();
      assert.equal(loads,0,"the paint waits for a hand, whatever the stored key"); assert.equal(frames.length,0);
      playable=true; a._warmMapPaint(); a._warmMapPaint();
      assert.equal(frames.length,1); assert.equal(loads,0);
      frames.shift()(); assert.equal(loads,0,"paint must precede idle import");
      const queue=fallback?tasks:idles; assert.equal(queue.length,1);
      if(!fallback) assert.deepEqual(deadlines,[1000],"a busy foreground must have a bounded idle wait");
      playable=false; queue.shift()();
      assert.equal(loads,1,"Settings cannot revoke warming after the first hand painted");
      a._warmMapPaint(); assert.equal(frames.length,0,"warm once per app");
      b._gameValuePlayable=()=>!b.__ngDestroyed;
      b._fetchMasteryGold=()=>{throw Error("retired app imported");};
      b._warmMapPaint(); frames.shift()(); b.__ngDestroyed=true; queue.shift()();
      assert.equal(b._mapPaintReady,undefined); assert.equal(b._mapPaint,null);
    } finally {
      if(previous.window===undefined) delete globalThis.window; else globalThis.window=previous.window;
      if(previous.raf===undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame=previous.raf;
      globalThis.setTimeout=previous.timer;
    }
    await a._goldLoading; assert.ok(a._mapPaint);
  }
});

// v1.280.0 RESTATED for the INSIDE mark. Was "current position halves read their own decks, never the player's seat;
// missing is null" (the recolour's deck read): the map's gold inside reads the same way (`_answered`, its own half's deck).
test("the inside mark reads each half's own deck, never the player's seat; a missing or empty deck is not answered", () => {
  const a=app(), n=a.nodes.find(n=>n.ty==="positions"&&n.rep), p=a.nodes[n.pi];
  a.currentPos=n.idx; a.playerRole="bottom";
  const key=gold.ngGoldDeckKey(n), other=gold.ngGoldDeckKey(p);
  assert.notEqual(key,other); assert.match(key,/\|Top$/); assert.match(other,/\|Bottom$/);
  a.flashcards.decks[key]={n:1}; a.stage[key]={test:3}; a._stageVer=(a._stageVer||0)+1;
  assert.equal(a._answered(n),true); assert.equal(a._answered(p),false);
  delete a.flashcards.decks[key]; a._stageVer++; assert.equal(a._answered(n),false);
  a.flashcards.decks[key]={n:0}; a._stageVer++; assert.equal(a._answered(n),false);
});

// v1.280.0 RESTATED for the INSIDE mark. Was "a real recall grade retints immediately; failed review moves paint back": now
// a grade that completes a deck turns its inside gold on at once (no reload), and a failed review takes it off again.
test("a real recall grade completing a deck turns the inside mark on at once; a failed review turns it off", () => {
  const a=app(), n=a.nodes.find(n=>n.ty==="positions"&&n.rep), key=gold.ngGoldDeckKey(n);
  const card={q:"Recall the tested position",a:"Test answer"};
  a.flashcards.decks[key]={n:1,cards:[card]};
  assert.equal(a._answered(n),false);
  for (let i=0;i<4&&a.deckMastery(key)<1;i++) assert.equal(a.gradeRecall(key,card,true,"g"+i,"deck").status,"applied");   // a stage a grade
  assert.equal(a.deckMastery(key),1); assert.equal(a._answered(n),true,"the grade's own publish re-reads it");
  assert.equal(a.gradeRecall(key,card,false,"failed","deck").status,"applied");
  assert.ok(a.deckMastery(key)<1); assert.equal(a._answered(n),false,"a failed review takes it off");
});

test("cached endpoints share the site, preserve lower shade, and hand over continuously without a lookup", async () => {
  const a=app(); await warm(a); const n=a.nodes.find(n=>n.rep&&n.pi>=0), p=a.nodes[n.pi];
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

test("focus and rest blend the shared site to the player's Off perspective, including late Off", async () => {
  const a=app(); a.playerRole="top";
  const top=a.nodes.find(n=>n.ty==="positions"&&n.t==="Mount Top"&&n.rep), n=a.nodes[top.pi];
  assert.notDeepEqual(a.myColor(n),n.col,"previous Bottom differs from the live Top perspective");
  a._mapPaintReady=true; a._rebuildMapPaint(); await a._goldLoading;
  const check=()=>{
    a._lodK=0; assert.equal(a._mapFocusColor(n),a._mapPaint[n.idx].sitePaint);
    let last=a._mapFocusColor(n);
    for(let i=1;i<=1000;i++) {
      a._lodK=i/1000; const c=a._mapFocusColor(n);
      for(const k of ["r","g","b"]) assert.ok(Math.abs(c[k]-last[k])<.3);
      last=c;
    }
    assert.deepEqual(a._mapFocusColor(n),a.myColor(n),"Off focus/rest endpoint is player perspective");
  };
  check();
  // v1.280.0 RETIRED: "with gold On the focus takes the gold paint" (`_mapFocusColor` read the switch); now the stored key
  // set On changes nothing: the focus still blends to the player's perspective
  a.set("masteryGold",true); a._rebuildMapPaint(); check();
  a._mapPaint=null;
  for(const k of [0,.5,1]) {a._lodK=k; assert.deepEqual(a._mapFocusColor(n),a.myColor(n));}
});

// v1.280.0 RESTATED. Was "late import uses latest setting, Off completion keeps only the base mix, and failure can retry":
// there is no setting to follow now; a late import paints only the base mix whatever the stored key, and failure can retry.
test("a late import paints only the base mix whatever the stored key, and failure can retry", async () => {
  const a=app(); let release, loads=0;
  a._mapPaintReady=true;
  a._fetchMasteryGold=()=>{loads++;return new Promise(r=>{release=r;});};
  a.set("masteryGold",true); a._rebuildMapPaint(); const pending=a._goldLoading;
  a._publishKnowledge("another-grade"); assert.equal(loads,1);
  release(gold); await pending; assert.ok(a._mapPaint);
  for(const n of a.nodes) assert.equal(a._mapPaint[n.idx].halfPaint,n.col);
  const b=app(); b._mapPaintReady=true; b._fetchMasteryGold=()=>Promise.reject(Error("offline test"));
  b._rebuildMapPaint(); await b._goldLoading; assert.equal(b._mapPaint,null);
  b._fetchMasteryGold=()=>Promise.resolve(gold); b._rebuildMapPaint(); await b._goldLoading; assert.ok(b._mapPaint);
});

// v1.280.0 RESTATED: the stored key still merges per key (newer wins) and is never deleted (CLAUDE.md 6.6). Was "merged and
// hydrated progress rebuild current paint": the paint no longer reads knowledge (the publish's "map-paint" effect went with
// the recolour), so a publish and a hydration keep the cache built at warm, the SAME object, and every half stays its own
// colour whatever the key says.
test("per-key cloud merge keeps the stored key; publishes and hydrations keep the warm paint; base colours never mutate", async () => {
  const a=app(), base=JSON.stringify(a.nodes.map(n=>[n.col,n.colU]));
  a._mapPaintReady=true; a._goldModule=gold; a._rebuildMapPaint();
  const built=a._mapPaint; assert.ok(built);
  a.settings={masteryGold:false}; a._settingsAt={masteryGold:20};
  a._mergeProgressFields({v:2,settings:{masteryGold:true},settingsAt:{masteryGold:30},updatedAt:30});
  assert.equal(a.settings.masteryGold,true); a._publishKnowledge("merged-progress"); assert.equal(a._mapPaint,built,"a publish keeps the paint built at warm");
  a._mergeProgressFields({v:2,settings:{masteryGold:false},settingsAt:{masteryGold:10},updatedAt:10});
  assert.equal(a.settings.masteryGold,true,"older Off cannot erase newer On");
  a._hydrateProgressBlob({v:2,settings:{masteryGold:false}}); assert.equal(a._mapPaint,built,"a hydration keeps it");
  for(const n of a.nodes) assert.equal(a._mapPaint[n.idx].halfPaint,n.col);
  a._hydrateProgressBlob({v:2,settings:{masteryGold:true}}); assert.equal(a._mapPaint,built);
  assert.equal(JSON.stringify(a.nodes.map(n=>[n.col,n.colU])),base);
});
