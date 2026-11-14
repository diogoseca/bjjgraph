import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { journey } from "../dsl";

/**
 * Production cache + draw, real mouse Settings/grade controls, and owned persistence.
 * The harness serves real graph/deck data but empty dossiers; no assertion depends
 * on article content. Colour expectations are read from app/cache/draw, not a second
 * renderer. The separate real-network payload gate bans the deferred module at boot.
 * Owner's 2026-10-15 decision: ALWAYS mix the overview, even with gold Off. Only
 * the split halves retain the byte-identical Off contract; warming follows first paint.
 * Required mutations, 2026-10-15, tests/mastery_gold.test.mjs:
 * default mix false -> "default overview mixes both halves" and the no-Settings
 * journey below; RGB average -> "blue/gold is green";
 * position keyed by seat -> "current position halves read their own decks";
 * removed publish rebuild -> "a real recall grade retints immediately".
 * Unit mutations do not prove mouse reachability; the journeys below do.
 * All seven unit controls (including pre-paint import, Settings veto and idle
 * deadline) killed. The grade journey keeps Settings-before-ready ordering.
 * On integrated dev f006d73b8, the browser policy mutant failed the no-Settings
 * default-mix assertion itself; all five journeys passed again after restoration.
 * Review B1 (2026-10-16): cache identity missed the later focus/rest repaint.
 * The rendered Off regression below compares real draw pixels against its uncached
 * historical Off path, including prior-Bottom replay while the live seat is Top.
 * Focus-only and rest-only cache-gate mutants both fail the rendered Off assertion,
 * for default Off and a deferred import completing after Off (2026-10-16).
 *
 * THE SWITCH LEFT SETTINGS (v1.280.0, GOLD1; the owner's U183 a: the map's gold became the outlines, NG_MAP_MARKS, so
 * "Turn what you know gold" went). The key `masteryGold` stays stored, synced and readable (a settings key can never be
 * deleted, CLAUDE.md 6.6) and nothing reads it for paint; the palette module keeps only the overview's site mix, which
 * paints exactly as it did with the switch Off. The marks themselves are pinned by map-gold.spec.ts and
 * known-move-seal.spec.ts. Each test says what it claimed before:
 *   rendered Off ...               KEPT for the default frame; RESTATED "On then Off by mouse" as "the stored key On (a
 *                                  player who had the switch On)": the frame is still the historical Off frame, pixel for pixel
 *   overview mixes both halves ... KEPT as it was
 *   the switch's row (1440, 390)   RESTATED. Was "mastery gold mouse toggle, own-half paint, Off restoration and reload": On
 *                                  by mouse turned the seat's learned half gold, Off restored it, a reload kept On. Now: the
 *                                  row is gone from the tab it lived in (by mouse, against that tab's own recall row); with
 *                                  the deck learned and the stored key On, the half is the orb's own colour, across a reload;
 *                                  and a held frame looks up no mastery (was "draw looks up none at all": the map's test
 *                                  `_answered` now reads it, once per knowledge revision, then from its memo)
 *   a real landing-card grade      RESTATED. Was "the grade retints the seat's half toward gold". Now: the grade that
 *                                  completes the deck turns the map's test on without a reload, and the paint stays its own
 *   a delayed import               RESTATED. Was "On, then Off while the module is held". Now "the stored key On while the
 *                                  module is held": the late import still paints only the base site mix
 * The unit file's ten (tests/mastery_gold.test.mjs) carry their own notes.
 */
const moduleURL = /\/static\/neural\/app\/mastery-gold\.js(?:\?|$)/;
test.beforeAll(async ({ request }) => {
  for (const name of ["neural.js", "mastery-gold.js", "settings-ui.js"]) {
    const r = await request.get("/static/neural/app/" + name);
    expect(r.ok()).toBe(true);
    const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
    expect(hash(await r.body()), "served own fresh " + name).toBe(hash(readFileSync("neural/dist/" + name)));
  }
});
// v1.280.0: was "open Settings and scroll to the switch's row" (the row, its text, a settled scroll); the row is gone. The
// tab it lived in is asserted RENDERED first (its own recall row, `data-recall-mode`), so the absence is a claim about the
// tab, not about a panel that never drew (CLAUDE.md 6.4)
async function openSettings(page: Page, j: ReturnType<typeof journey>) {
  await j.openAccountMenu();
  await j.clickByMouse("[data-menu-settings]", "Settings");
  await expect(page.locator(".ng-modal [data-recall-mode]")).toHaveCount(1);
  await expect(page.locator(".ng-modal")).toContainText("Show flashcards on pages");
  await expect(page.locator("[data-mastery-gold]"), "the switch's row is gone").toHaveCount(0);
  await expect(page.locator(".ng-modal"), "...and its words with it").not.toContainText("Turn what you know gold");
}
// a player who had the switch On: the key as the row used to write it
const storeOn = (page: Page) => page.evaluate(() => { const a = (window as any).__neural; a.set("masteryGold", true); return a.get("masteryGold", false); });
async function ready(page: Page) {
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural._mapPaint)).toBe(true);
}

async function renderedOff(page: Page, info: TestInfo, phase: string, stored = false) {
  const rows = await page.evaluate(phase => {
    const a=(window as any).__neural, liveCtx=a.ctx, cache=a._mapPaint;
    a.setPaused(true);
    const top=a.nodes.find((n:any)=>n.ty==="positions"&&n.t==="Mount Top"&&n.rep), bottom=a.nodes[top.pi];
    const rows:any[]=[];
    // Both frames use the actual production draw on fresh native software canvases.
    // At full split, removing the cache selects the historical Off render path;
    // no renderer, geometry, or colour formula is copied into this oracle.
    function snap(paint:any, focus:any) {
      const canvas=document.createElement("canvas");
      canvas.width=liveCtx.canvas.width; canvas.height=liveCtx.canvas.height;
      const ctx=canvas.getContext("2d",{willReadFrequently:true})!, fills:string[]=[];
      a.ctx=new Proxy(ctx,{
        get(t,key){const v=Reflect.get(t,key,t);return typeof v==="function"?v.bind(t):v;},
        set(t,key,v){if(key==="fillStyle"&&typeof v==="string") fills.push(v);return Reflect.set(t,key,v,t);}
      });
      a._mapPaint=paint; ctx.save();
      try {a.draw();} finally {a.ctx=liveCtx; a._mapPaint=cache; ctx.restore();}
      return {pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data,
        perspectiveFill:fills.includes(a.rgba(a.myColor(focus),.98*a.alpha))};
    }
    try {
      for(const fixture of ["current-top","replay-previous-bottom"]) {
        a.stopReplay("Off canvas regression"); a.focusIdx=top.idx;
        if(fixture==="replay-previous-bottom") {
          if(!a.startReplay({ts:123,log:[{idx:bottom.idx,name:"Mount",role:"bottom"}]})) throw Error("replay setup failed");
          a._replayStep(); // Real replay landing; never change the live player role.
          if(a.focusIdx!==bottom.idx||a.playerRole!=="top") throw Error("previous Bottom replay not reached");
        }
        a._arriveLabelT=null; a._settleT=0; a.pulse=null; a.trail=[]; a.ripples=[];
        for(const n of a.nodes) n.lit=-Infinity;
        for(const scale of [2.2,3]) {
          const n=a.nodes[a.focusIdx], mid=a.pairMid(n);
          a.cam={...a.cam,cx:mid.x,cy:mid.y,vw:a.W/scale,lvw:Math.log(a.W/scale)}; a.draw();
          const before=snap(null,n), repeat=snap(null,n), after=snap(cache,n);
          let different=0,repeatDifferent=0;
          for(let i=0;i<before.pixels.length;i++) {
            if(before.pixels[i]!==after.pixels[i]) different++;
            if(before.pixels[i]!==repeat.pixels[i]) repeatDifferent++;
          }
          rows.push({phase,fixture,scale,lod:a._lodK,on:a.get("masteryGold",false),cache:!!cache,
            focus:n.t,playerRole:a.playerRole,halfIdentity:a._mapColor(n)===n.col,
            perspectiveDiffers:a.rgba(a.myColor(n),1)!==a.rgba(n.col,1),
            referencePerspectiveFill:before.perspectiveFill,perspectiveFill:after.perspectiveFill,
            pixelBytes:before.pixels.length,different,repeatDifferent});
        }
      }
    } finally {a.ctx=liveCtx; a._mapPaint=cache; a.stopReplay("Off canvas regression done");}
    return rows;
  },phase);
  await info.attach(`rendered-${phase}.json`,{body:JSON.stringify(rows,null,2),contentType:"application/json"});
  expect(rows).toHaveLength(4);
  expect(rows.every(r=>r.repeatDifferent===0&&r.referencePerspectiveFill&&r.pixelBytes>0),"uncached Off repeat control").toBe(true);
  // v1.280.0: `on` is the stored key, never read for paint (was "!r.on": Off was the only state this frame could be in)
  expect(rows.every(r=>r.lod===1&&r.halfIdentity&&r.on===stored&&r.cache),"split Off preconditions").toBe(true);
  expect(rows.filter(r=>r.fixture==="replay-previous-bottom").every(r=>r.perspectiveDiffers&&r.playerRole==="top"),"replay differs from the live player perspective").toBe(true);
  expect(rows.filter(r=>r.different>0||!r.perspectiveFill),"rendered Off focus and resting glow preserve historical pixels").toEqual([]);
}

test("rendered Off focus and resting glow preserve the player perspective", async ({page},info) => {
  const j=journey(page); await j.boot("/"); await j.land("Mount Top"); await ready(page);
  await renderedOff(page,info,"default-off");
  // v1.280.0: was "On then Off by mouse" (the row is gone); now the stored key On, as the row left it for a player
  expect(await storeOn(page)).toBe(true);
  await renderedOff(page,info,"stored-on",true);
});

test("overview mixes both halves without ever opening Settings", async ({ page }) => {
  // Real boot, no journey rails: this visitor has never touched the gold setting.
  // Hold only the deferred palette to observe the unchanged fallback before it lands.
  let release!:()=>void;
  const gate=new Promise<void>(r=>{release=r;}), settingsRequests:string[]=[];
  page.on("request",r=>{if(/\/settings-ui\.js(?:\?|$)/.test(r.url())) settingsRequests.push(r.url());});
  await page.addInitScript(()=>{
    (window as any).__NEURAL_RIG={"start-pos":[0],role:[0],"ai-skill":[.5],"max-moves":[.5]};
    new MutationObserver((_,obs)=>{
      if(!document.querySelector("[data-tech]")) return;
      (window as any).__mixHandAt=performance.now(); obs.disconnect();
      requestAnimationFrame(()=>{(window as any).__mixHandFrameAt=performance.now();});
    }).observe(document,{childList:true,subtree:true});
  });
  // Same network boundary as the payload gate: local app bytes are real, while
  // optional third parties cannot make this visitor depend on an external service.
  await page.route("**/*",r=>{
    const url=r.request().url();
    if(/^(http:\/\/localhost|http:\/\/127\.|data:|blob:|about:)/.test(url)) return r.continue();
    if(/fonts\.(googleapis|gstatic)\.com/.test(url)) return r.fulfill({status:200,contentType:"text/css",body:""});
    return r.abort();
  });
  await page.route(moduleURL,async r=>{await gate;await r.continue();});
  try {
    await page.goto("/",{waitUntil:"commit"});
    await expect(page.locator("[data-tech]").first()).toBeVisible({timeout:180000});
    await expect.poll(()=>page.evaluate(()=>!!(window as any).__neural?._mapPaintReady)).toBe(true);
    expect(await page.evaluate(()=>{
      const a=(window as any).__neural;
      return {on:a.get("masteryGold",false),cache:a._mapPaint,
        unchanged:a.nodes.every((n:any)=>a._mapColor(n)===n.col&&a._mapColor(n,true)===(n.colU||n.col))};
    })).toEqual({on:false,cache:null,unchanged:true});
    release();
    // This is the policy mutant's killing assertion, not an import/readiness
    // timeout: draw must actually use a shared, non-representative site colour.
    await expect.poll(()=>page.evaluate(()=>{
      const a=(window as any).__neural,n=a.nodes.find((n:any)=>n.rep&&n.ty==="transitions"&&n.pi>=0&&a.rsAllows(n)),p=a.nodes[n.pi];
      a.setPaused(true);
      const mid=a.pairMid(n); a.cam={...a.cam,cx:mid.x,cy:mid.y,vw:a.W,lvw:Math.log(a.W)};
      a.draw();
      const col=JSON.stringify(a._mapColor(n));
      return {lod:a._lodK,shared:col===JSON.stringify(a._mapColor(p,true)),mixed:col!==JSON.stringify(n.col)};
    }),{message:"default overview mixes both halves for a user who never opened Settings"})
      .toEqual({lod:0,shared:true,mixed:true});
    const result=await page.evaluate(()=>{
      const a=(window as any).__neural,n=a.nodes.find((n:any)=>n.rep&&n.ty==="transitions"&&n.pi>=0&&a.rsAllows(n)),p=a.nodes[n.pi];
      a.setPaused(true);
      const mid=a.pairMid(n),calls:any[]=[],paint=a._mapColor;
      a.cam={...a.cam,cx:mid.x,cy:mid.y,vw:a.W,lvw:Math.log(a.W)};
      a._mapColor=function(node:any,lower:boolean){const c=paint.call(this,node,lower);calls.push({idx:node.idx,col:c});return c;};
      try{a.draw();}finally{a._mapColor=paint;}
      const overview={lod:a._lodK,col:a._mapColor(n),other:a._mapColor(p,true),site:a._mapPaint[n.idx].sitePaint,base:n.col,
        drawn:calls.filter(c=>c.idx===n.idx).map(c=>c.col)};
      a.cam={...a.cam,vw:a.W/3,lvw:Math.log(a.W/3)}; a.draw();
      const entries=performance.getEntriesByType("resource").filter(e=>/\/mastery-gold\.js(?:\?|$)/.test(e.name));
      return {overview,split:a._lodK,unchanged:a.nodes.every((n:any)=>a._mapColor(n)===n.col&&a._mapColor(n,true)===(n.colU||n.col)),
        on:a.get("masteryGold",false),settingWritten:Object.hasOwn(a.settings,"masteryGold"),
        handAt:(window as any).__mixHandAt,frameAt:(window as any).__mixHandFrameAt,starts:entries.map(e=>e.startTime)};
    });
    expect(settingsRequests).toEqual([]); expect(result.on).toBe(false); expect(result.settingWritten).toBe(false);
    expect(result.handAt).toBeGreaterThan(0); expect(result.frameAt).toBeGreaterThanOrEqual(result.handAt);
    expect(result.starts).toHaveLength(1); expect(result.starts[0]).toBeGreaterThan(result.frameAt);
    expect(result.overview.lod).toBe(0); expect(result.overview.col).toEqual(result.overview.site);
    expect(result.overview.other).toEqual(result.overview.col); expect(result.overview.col).not.toEqual(result.overview.base);
    expect(result.overview.drawn).toContainEqual(result.overview.col);
    expect(result.split).toBe(1); expect(result.unchanged).toBe(true);
  } finally {release();}
});

for (const width of [1440, 390]) {
  // v1.280.0: was "mastery gold mouse toggle, own-half paint, Off restoration and reload at ${width}px" (see the header)
  test(`the switch is gone from Settings; a learned deck keeps its own colour with the stored key On, across a reload, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const j = journey(page), requests: string[] = [];
    page.on("request", r => { if (moduleURL.test(r.url())) requests.push(r.url()); });
    await j.boot("/"); await j.land("Mount Top");
    await ready(page);
    expect(requests).toHaveLength(1);
    expect(await page.evaluate(() => (window as any).__neural.get("masteryGold",false))).toBe(false);
    await openSettings(page,j);
    expect(await storeOn(page)).toBe(true);
    expect(requests.length, "the stored key imports nothing more").toBe(1);
    await j.clickByMouse(".ng-modal .x", "close Settings"); await j.clickByMouse(".ng-explorer-close","close the drawer"); // v1.242.0: Settings opens from the drawer's badge
    const result = await page.evaluate(async () => {
      const a=(window as any).__neural, n=a.nodes[a.currentPos], p=a.nodes[n.pi];
      const key=a._mapPaint[n.idx].key;
      await a.hydrateDeck(key);
      for(const card of a._cardsOf(a.flashcards.decks[key])) a._bumpStage(key,card.q,3,3);
      const mid=a.pairMid(n); a.cam={...a.cam,cx:mid.x,cy:mid.y,vw:a.W/3,lvw:Math.log(a.W/3)};
      // Observe the material calls actually made by draw. Labels/DOM still read
      // their original sources. No colour-space or position math is copied here.
      const calls: any[] = [], paint=a._mapColor;
      a._mapColor=function(node: any,lower: boolean) { const c=paint.call(this,node,lower); calls.push({idx:node.idx,lower:!!lower,col:c}); return c; };
      try { a.draw(); } finally { a._mapColor=paint; }
      // v1.280.0: the map's test (`_answered`) read the new knowledge in that frame; a HELD frame reads it from the memo
      const mastery=a.deckMastery; let lookups=0; a.deckMastery=function(this: any, ...args: any[]){lookups++;return mastery.apply(this,args);};
      try { a.draw(); } finally { a.deckMastery=mastery; }
      return {idx:n.idx,partner:p.idx,key,other:a._mapPaint[p.idx].key,m:a.deckMastery(key),answered:a._answered(n),
        half:a._mapColor(n),base:n.col,baseU:p.colU,otherHalf:a._mapColor(p,true),lod:a._lodK,calls,lookups};
    });
    expect(result.key).toBe("Mount|Top"); expect(result.other).toBe("Mount|Bottom");
    expect([result.m, result.answered], "the seat's deck is learned and the map's test reads it").toEqual([1, true]);
    // v1.280.0: was { r: 240, g: 192, b: 90 } (the gold palette, with the switch On); now the orb's own colour
    expect(result.half, "the learned half keeps its own colour, the stored key On").toEqual(result.base);
    expect(result.otherHalf).toEqual(result.baseU);
    expect(result.lod).toBe(1);
    expect(result.calls.filter(c=>c.idx===result.idx&&c.lower).map(c=>c.col)).toContainEqual(result.half);
    // v1.280.0: RETIRED "the seat's half paint is read for the focus too" (the non-lower call): that was the gold-On focus
    // branch; the focus paints the player's perspective colour (`myColor`) whatever the stored key, pinned pixel for pixel by
    // "rendered Off focus ..." above with the key On
    // v1.280.0: was "draw looks up no mastery" (a throwing stub); now a HELD frame looks up none (the memo's claim)
    expect(result.lookups, "a held frame looks up no mastery").toBe(0);
    await j.boot("/",{preserveStorage:true}); await j.land("Mount Top"); await ready(page);
    expect(await page.evaluate(() => {
      const a=(window as any).__neural, n=a.nodes[a.currentPos];
      return {on:a.get("masteryGold",false),m:a.deckMastery("Mount|Top"),own:a.nodes.every((n: any)=>a._mapColor(n)===n.col&&a._mapColor(n,true)===(n.colU||n.col)),half:a._mapPaint[n.idx].halfPaint===n.col};
    }), "after a reload: the key still stored and readable, the deck still learned, every half its own colour")
      // v1.280.0: was { on: true, m: 1, half: { r: 240, g: 192, b: 90 } }
      .toEqual({on:true,m:1,own:true,half:true});
  });
}

// v1.280.0: was "a real landing-card grade updates map paint without reload" (the half retinted toward gold)
test("a real landing-card grade that completes the deck turns the map's test on without reload; the paint stays its own", async ({ page }) => {
  const j=journey(page);
  await j.boot("/",{beforeNavigate:async()=>{
    await page.addInitScript(()=>{
      // Hold the first idle turn until Settings covers the hand, then simulate
      // a busy foreground: only a callback carrying a deadline gets to run.
      const idle=window.requestIdleCallback.bind(window), held:{cb:IdleRequestCallback,options?:IdleRequestOptions}[]=[];
      window.requestIdleCallback=(cb,options)=>{held.push({cb,options});return -held.length;};
      (window as any).__releaseGoldIdle=()=>{
        window.requestIdleCallback=idle;
        for(const {cb,options} of held) if(options?.timeout!=null)
          setTimeout(()=>cb({didTimeout:true,timeRemaining:()=>0}),options.timeout);
      };
    });
  }});
  await j.land("Mount Top");
  await openSettings(page,j); // v1.280.0: was "and choose On"; the warm never needed the switch
  expect(await page.evaluate(()=>(window as any).__neural._mapPaint)).toBeNull();
  await page.evaluate(()=>(window as any).__releaseGoldIdle());
  await ready(page); // Must converge while Settings stays open, before closing it.
  await j.clickByMouse(".ng-modal .x", "close Settings"); await j.clickByMouse(".ng-explorer-close","close the drawer"); // v1.242.0: Settings opens from the drawer's badge
  const before=await page.evaluate(async () => {
    const a=(window as any).__neural,n=a.nodes[a.currentPos],key=a._mapPaint[n.idx].key;
    await a.hydrateDeck(key); a.set("recallInPlay",true);
    const cards=a._cardsOf(a.flashcards.decks[key]), q=cards[0].q;
    // A due stage-2 card is eligible for the real recall landing surface. Its
    // successful grade can still increase deckMastery, unlike a stage-3 fixture.
    // v1.280.0: every OTHER card at stage 3 (was: none), so this one grade completes the deck: the map's test is all or nothing
    a.stage[key]={...Object.fromEntries(cards.slice(1).map((c:any)=>[a.qhash(c.q),3])),[a.qhash(q)]:2};
    const today=a._epochDay(); a.srs[key]={[a.qhash(q)]:[today-1,3,today-4]};
    a._publishKnowledge("grade-fixture"); a._landQ=null; a.renderLandCard(n,"land",null);
    a.draw();
    return {idx:n.idx,key,m:a.deckMastery(key),answered:a._answered(n),paint:a._mapPaint[n.idx].halfPaint,col:n.col};
  });
  expect([before.m < 1, before.answered], "one card short: the deck is not learned, the map's test is off").toEqual([true, false]);
  await j.openQuestion(); // U47 d: the remounted card asks again; Answer for Points precedes recall's Show answer.
  await expect(page.locator("[data-land-reveal]")).toBeVisible();
  await j.clickByMouse("[data-land-reveal]","Show answer");
  await j.clickByMouse("[data-land-got]","Got it");
  const after=await page.evaluate(({idx,key}) => {
    const a=(window as any).__neural; a.draw();
    return {answered:a._landQ?.answered,m:a.deckMastery(key),test:a._answered(a.nodes[idx]),paint:a._mapPaint[idx].halfPaint,col:a.nodes[idx].col};
  },before);
  expect(after.answered).toBe(true); expect(after.m).toBe(1);
  // v1.280.0: was "the cached mastery follows and the paint changes" (cached === m, paint !== before)
  expect(after.test, "the map's test turns on without a reload").toBe(true);
  expect([before.paint, after.paint], "the paint is the orb's own colour before and after").toEqual([before.col, after.col]);
});

// v1.280.0: was "a delayed gold import after Off paints only the base site mix" (On, then Off, while the module was held)
test("a delayed palette import with the stored key On paints only the base site mix", async ({ page },info) => {
  const j=journey(page); let release!:()=>void;
  const gate=new Promise<void>(r=>{release=r;});
  await j.boot("/",{beforeNavigate:async()=>{await page.route(moduleURL,async r=>{await gate;await r.continue();});}});
  await j.land("Mount Top");
  try {
    await openSettings(page,j);
    await expect.poll(()=>page.evaluate(()=>!!(window as any).__neural._goldLoading)).toBe(true);
    expect(await storeOn(page)).toBe(true); release();
    await page.evaluate(()=>(window as any).__neural._goldLoading);
    await ready(page);
    expect(await page.evaluate(()=>{
      const a=(window as any).__neural;
      return a.nodes.every((n:any)=>a._mapPaint[n.idx].halfPaint===n.col&&a._mapPaint[n.idx].lowerPaint===(n.colU||n.col));
    })).toBe(true);
    await j.clickByMouse(".ng-modal .x","close Settings"); await j.clickByMouse(".ng-explorer-close","close the drawer"); // v1.242.0: Settings opens from the drawer's badge
    await renderedOff(page,info,"late-import-stored-on",true);
  } finally {release();}
});
