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
async function openSettings(page: Page, j: ReturnType<typeof journey>) {
  await j.openAccountMenu();
  await j.clickByMouse("[data-menu-settings]", "Settings");
  await expect(page.locator("[data-mastery-gold]")).toHaveCount(1);
  await expect(page.locator("[data-mastery-gold]")).toContainText("Turn what you know gold");
  const panel = await page.locator("#ng-stab-panel").boundingBox();
  expect(panel).not.toBeNull();
  await page.mouse.move(panel!.x + panel!.width / 2, panel!.y + panel!.height / 2);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(150);
}
const choose = (j: ReturnType<typeof journey>, on: boolean) =>
  j.clickByMouse(`[data-mastery-gold] button:nth-child(${on ? 1 : 2})`, on ? "mastery gold On" : "mastery gold Off");
async function ready(page: Page) {
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural._mapPaint)).toBe(true);
}

async function renderedOff(page: Page, info: TestInfo, phase: string) {
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
  expect(rows.every(r=>r.lod===1&&r.halfIdentity&&!r.on&&r.cache),"split Off preconditions").toBe(true);
  expect(rows.filter(r=>r.fixture==="replay-previous-bottom").every(r=>r.perspectiveDiffers&&r.playerRole==="top"),"replay differs from the live player perspective").toBe(true);
  expect(rows.filter(r=>r.different>0||!r.perspectiveFill),"rendered Off focus and resting glow preserve historical pixels").toEqual([]);
}

test("@curated rendered Off focus and resting glow preserve the player perspective", async ({page},info) => {
  const j=journey(page); await j.boot("/"); await j.land("Mount Top"); await ready(page);
  await renderedOff(page,info,"default-off");
  await openSettings(page,j); await choose(j,true); await choose(j,false);
  await j.clickByMouse(".ng-modal .x","close Settings"); await j.clickByMouse(".ng-explorer-close","close the drawer"); // v1.242.0: Settings opens from the drawer's badge
  await renderedOff(page,info,"on-then-off");
});

test("@curated overview mixes both halves without ever opening Settings", async ({ page }) => {
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
  test(`@curated mastery gold mouse toggle, own-half paint, Off restoration and reload at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const j = journey(page), requests: string[] = [];
    page.on("request", r => { if (moduleURL.test(r.url())) requests.push(r.url()); });
    await j.boot("/"); await j.land("Mount Top");
    await ready(page);
    expect(requests).toHaveLength(1);
    expect(await page.evaluate(() => (window as any).__neural.get("masteryGold",false))).toBe(false);
    await openSettings(page,j); await choose(j,true); await ready(page);
    expect(requests.length).toBe(1);
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
      const mastery=a.deckMastery; a.deckMastery=()=>{throw Error("mastery lookup in draw");};
      try { a.draw(); } finally { a._mapColor=paint; a.deckMastery=mastery; }
      return {idx:n.idx,partner:p.idx,key,other:a._mapPaint[p.idx].key,m:a._mapPaint[n.idx].mastery,
        otherM:a._mapPaint[p.idx].mastery,half:a._mapColor(n),base:n.col,baseU:p.colU,
        otherHalf:a._mapColor(p,true),lod:a._lodK,calls};
    });
    expect(result.key).toBe("Mount|Top"); expect(result.other).toBe("Mount|Bottom");
    expect(result.m).toBe(1); expect(result.otherM).toBe(0);
    expect(result.half).toEqual({r:240,g:192,b:90}); expect(result.otherHalf).toEqual(result.baseU);
    expect(result.lod).toBe(1);
    expect(result.calls.filter(c=>c.idx===result.idx&&c.lower).map(c=>c.col)).toContainEqual(result.half);
    expect(result.calls.filter(c=>c.idx===result.idx&&!c.lower).map(c=>c.col)).toContainEqual(result.half);
    await openSettings(page,j); await choose(j,false);
    expect(await page.evaluate(() => {
      const a=(window as any).__neural; return a.nodes.every((n: any)=>a._mapColor(n)===n.col&&a._mapColor(n,true)===(n.colU||n.col));
    })).toBe(true);
    await choose(j,true); await ready(page);
    await j.boot("/",{preserveStorage:true}); await j.land("Mount Top"); await ready(page);
    expect(await page.evaluate(() => {
      const a=(window as any).__neural, e=a._mapPaint.find((e: any)=>e.key==="Mount|Top");
      return {on:a.get("masteryGold",false),m:e.mastery,half:e.halfPaint};
    })).toEqual({on:true,m:1,half:{r:240,g:192,b:90}});
  });
}

test("@curated a real landing-card grade updates map paint without reload", async ({ page }) => {
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
  await openSettings(page,j); await choose(j,true);
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
    a.stage[key]={[a.qhash(q)]:2};
    const today=a._epochDay(); a.srs[key]={[a.qhash(q)]:[today-1,3,today-4]};
    a._publishKnowledge("grade-fixture"); a._landQ=null; a.renderLandCard(n,"land",null);
    return {idx:n.idx,key,m:a.deckMastery(key),paint:a._mapPaint[n.idx].halfPaint};
  });
  await j.openQuestion(); // U47 d: the remounted card asks again; Answer for Points precedes recall's Show answer.
  await expect(page.locator("[data-land-reveal]")).toBeVisible();
  await j.clickByMouse("[data-land-reveal]","Show answer");
  await j.clickByMouse("[data-land-got]","Got it");
  const after=await page.evaluate(({idx,key}) => {
    const a=(window as any).__neural; a.draw();
    return {answered:a._landQ?.answered,m:a.deckMastery(key),cached:a._mapPaint[idx].mastery,paint:a._mapPaint[idx].halfPaint};
  },before);
  expect(after.answered).toBe(true); expect(after.m).toBeGreaterThan(before.m);
  expect(after.cached).toBe(after.m); expect(after.paint).not.toEqual(before.paint);
});

test("a delayed gold import after Off paints only the base site mix", async ({ page },info) => {
  const j=journey(page); let release!:()=>void;
  const gate=new Promise<void>(r=>{release=r;});
  await j.boot("/",{beforeNavigate:async()=>{await page.route(moduleURL,async r=>{await gate;await r.continue();});}});
  await j.land("Mount Top");
  try {
    await openSettings(page,j); await choose(j,true);
    await expect.poll(()=>page.evaluate(()=>!!(window as any).__neural._goldLoading)).toBe(true);
    await choose(j,false); release();
    await page.evaluate(()=>(window as any).__neural._goldLoading);
    await ready(page);
    expect(await page.evaluate(()=>{
      const a=(window as any).__neural;
      return a.nodes.every((n:any)=>a._mapPaint[n.idx].halfPaint===n.col&&a._mapPaint[n.idx].lowerPaint===(n.colU||n.col));
    })).toBe(true);
    await j.clickByMouse(".ng-modal .x","close Settings"); await j.clickByMouse(".ng-explorer-close","close the drawer"); // v1.242.0: Settings opens from the drawer's badge
    await renderedOff(page,info,"late-import-off");
  } finally {release();}
});
