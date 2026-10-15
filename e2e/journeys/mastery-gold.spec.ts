import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { journey } from "../dsl";

/**
 * Production cache + draw, real mouse Settings/grade controls, and owned persistence.
 * The harness serves real graph/deck data but empty dossiers; no assertion depends
 * on article content. Colour expectations are read from app/cache/draw, not a second
 * renderer. The separate real-network payload gate bans the deferred module at boot.
 * Required mutations, 2026-10-15, tests/mastery_gold.test.mjs:
 * default On -> "default off imports nothing"; RGB average -> "blue/gold is green";
 * position keyed by seat -> "current position halves read their own decks";
 * removed publish rebuild -> "a real recall grade retints immediately".
 * All four killed. These unit mutations do not prove mouse reachability; the
 * journeys below do. No non-kill among the four required mutants.
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
  await j.clickByMouse(".ngAcctChip", "account");
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

for (const width of [1440, 390]) {
  test(`@curated mastery gold mouse toggle, own-half paint, Off restoration and reload at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const j = journey(page), requests: string[] = [];
    page.on("request", r => { if (moduleURL.test(r.url())) requests.push(r.url()); });
    await j.boot("/"); await j.land("Mount Top");
    expect(requests).toEqual([]);
    expect(await page.evaluate(() => (window as any).__neural._mapPaint)).toBeNull();
    await openSettings(page,j); await choose(j,true); await ready(page);
    expect(requests.length).toBe(1);
    await j.clickByMouse(".ng-modal .x", "close Settings");
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
    await j.boot("/",{preserveStorage:true}); await ready(page);
    expect(await page.evaluate(() => {
      const a=(window as any).__neural, e=a._mapPaint.find((e: any)=>e.key==="Mount|Top");
      return {on:a.get("masteryGold",false),m:e.mastery,half:e.halfPaint};
    })).toEqual({on:true,m:1,half:{r:240,g:192,b:90}});
  });
}

test("@curated a real landing-card grade updates map paint without reload", async ({ page }) => {
  const j=journey(page); await j.boot("/"); await j.land("Mount Top");
  await openSettings(page,j); await choose(j,true); await ready(page);
  await j.clickByMouse(".ng-modal .x", "close Settings");
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

test("a delayed gold import cannot repaint after Off", async ({ page }) => {
  const j=journey(page); let release!:()=>void;
  const gate=new Promise<void>(r=>{release=r;});
  await j.boot("/",{beforeNavigate:async()=>{await page.route(moduleURL,async r=>{await gate;await r.continue();});}});
  await j.land("Mount Top");
  try {
    await openSettings(page,j); await choose(j,true);
    await expect.poll(()=>page.evaluate(()=>!!(window as any).__neural._goldLoading)).toBe(true);
    await choose(j,false); release();
    await page.evaluate(()=>(window as any).__neural._goldLoading);
    expect(await page.evaluate(()=>(window as any).__neural._mapPaint)).toBeNull();
  } finally {release();}
});
