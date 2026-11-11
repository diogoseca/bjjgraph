#!/usr/bin/env node
/**
 * PROTOTYPE ONLY, practicedrawer (PRACT1), leaves with the prototype once the owner picks: the owner's screens of Practice, today and each variant, plus the
 * measurements the report quotes. NOT a gate: real wall-clock time against this worktree's own built site
 * (scripts/e2e-serve.mjs on a private port), real mouse presses and touch taps at MEASURED centres.
 *
 *   node e2e/practicedrawer-shots/shoot.mjs <outDir> [looks] [viewports]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOOT_BASE || "http://localhost:8217";
const OUT = process.argv[2];
const LOOKS = (process.argv[3] || "today,a,b,c").split(",");
const VPS = [
  { tag: "390", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { tag: "1440", width: 1440, height: 900, deviceScaleFactor: 1 },
  { tag: "390s", width: 390, height: 631, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
].filter((v) => process.argv[4] ? process.argv[4].split(",").includes(v.tag) : v.tag !== "390s");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ORDER = { today: 1, a: 3, b: 5, c: 7 };
const results = [];

async function press(page, vp, sel, what) {
  const hit = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden");
    if (!el) return { ok: false, why: "no visible match" };
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { ok: false, why: `centre ${x},${y} off screen` };
    const top = document.elementFromPoint(x, y);
    return { ok: !!top && (top === el || el.contains(top)), x, y, why: top ? top.tagName + "." + top.className : "nothing" };
  }, sel);
  if (!hit.ok) throw new Error(`${what}: ${hit.why}`);
  if (vp.hasTouch) await page.touchscreen.tap(hit.x, hit.y); else await page.mouse.click(hit.x, hit.y);
}

async function seed(page) {
  return page.evaluate(async () => {
    const a = window.__neural;
    a.srs = {}; a.prep = {}; a.stage = {}; a.rec = {}; a.units = {};
    a.belts = { held: { id: "white", t: 1 }, gf: 1, won: {} };
    a.settings.dailyGoal = 20;
    const day = a._epochDay();
    const live = a.curriculum.belts.find((b) => b.id === "white").units.flatMap((u) => u.lessons).filter((l) => a._lessonLive(l)).map((l) => l.deckKey);
    const picked = [...new Set(live)].slice(0, 3);
    // the corpus's longest answer (160 chars) and longest explanation (1,013 chars), due after the three
    const stress = [["Reverse Armbar from Mount|Attacker", "What are the three acceptable tap signals"], ["Front Headlock to Guillotine|Attacker", "What is the upper body sequence for the front headlock"]];
    await a.hydrateDecks(picked.concat(stress.map((s) => s[0])));
    picked.forEach((key, i) => { const c = a._cardsOf(a.flashcards.decks[key])[0]; a.srs[key] = { [a.qhash(c.q)]: [day - 5 + i, 3, day - 8] }; });
    for (const [key, q] of stress) {
      const c = (a._cardsOf(a.flashcards.decks[key]) || []).find((x) => x.q.startsWith(q));
      if (c) a.srs[key] = { [a.qhash(c.q)]: [day - 1, 3, day - 4] };
    }
    a.srs["Previous practice|Top"] = Object.fromEntries(Array.from({ length: 3 }, (_, i) => ["prior" + i, [day + 1, 1, day]]));
    await a._ensureGameplanRuntime();
    return { picked, stress: stress.map((s) => s[0]) };
  });
}

/** What is on screen, read from the page: the drawer, the open card, its targets, and the map under it. */
const measure = (page) => page.evaluate(() => {
  const a = window.__neural, s = a._session, R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom) }; };
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
  const drawer = document.querySelector(".ng-drill");
  const open = document.querySelector('[data-session-row][aria-expanded="true"] + div');
  const q = open && open.querySelector("[data-mini-q]"), ans = open && open.querySelector("[data-mini-a]");
  const lines = (e) => { if (!e) return null; const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5; return { font: cs.fontSize, lines: Math.round(e.getBoundingClientRect().height / lh), w: Math.round(e.getBoundingClientRect().width) }; };
  const targets = open ? [...open.querySelectorAll("button,summary")].filter(vis).map((b) => ({ t: (b.textContent || "").trim().slice(0, 28), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), onScreen: b.getBoundingClientRect().bottom <= innerHeight && b.getBoundingClientRect().top >= 0 })) : [];
  // the card's technique on the map: the same projection as draw(), through the frame's own lift (_LY)
  let node = null;
  if (s && s.keys.length && a.cam) {
    const i = a.nodeForKey(s.keys[s.idx || 0]), n = a.nodes[i];
    if (n) {
      const scale = a.W / a.cam.vw, LY = typeof a._LY === "function" ? a._LY : (m) => m.y;
      const x = Math.round(a.W / 2 + (n.x - a.cam.cx) * scale), y = Math.round(a.H / 2 + (LY(n) - a.cam.cy) * scale);
      const top = x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight ? document.elementFromPoint(x, y) : null;
      node = { name: n.t, x, y, onScreen: !!top, uncovered: !!top && top.tagName === "CANVAS" };
    }
  }
  const ringsSeen = (a._sessionNodes || []).filter((i) => {
    const n = a.nodes[i]; if (!n || !a.cam) return false;
    const scale = a.W / a.cam.vw, LY = typeof a._LY === "function" ? a._LY : (m) => m.y;
    const x = a.W / 2 + (n.x - a.cam.cx) * scale, y = a.H / 2 + (LY(n) - a.cam.cy) * scale;
    const top = x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight ? document.elementFromPoint(x, y) : null;
    return !!top && top.tagName === "CANVAS";
  }).length;
  return {
    drawer: R(drawer), wide: drawer.hasAttribute("data-practice-wide"), brand: (document.querySelector(".ng-drawer-brand")?.textContent || "").trim(),
    paused: !!a.paused, deckShown: !!a.deckShown, landQ: !!a.decisionSec,
    card: R(open), q: lines(q), qText: q && q.textContent.slice(0, 60), answer: lines(ans && vis(ans) ? ans : null),
    mcOpts: open ? [...open.querySelectorAll("[data-practice-mc-opt],[data-mc-opt]")].filter(vis).map((b) => ({ h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) })) : [],
    targets, node, rings: (a._sessionNodes || []).length, ringsSeen,
    goal: document.querySelector("[data-practice-goal]")?.textContent, rows: document.querySelectorAll("[data-session-row]").length,
    rowsShown: [...document.querySelectorAll("[data-session-row]")].filter(vis).length,
    scrollH: a.drillListRef.current?.scrollHeight, listH: a.drillListRef.current?.clientHeight,
  };
});

async function shot(page, name) {
  const file = path.join(OUT, name + ".jpg");
  await page.screenshot({ path: file, type: "jpeg", quality: 84 });
  return file;
}

const browser = await chromium.launch();
for (const vp of VPS) {
  for (const look of LOOKS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    // the same paused game behind every shot of a row: every look boots on the Mount (top) page
    await page.goto(BASE + "/Positions/Mount/Top" + (look === "today" ? "" : "?practice=" + look));
    // INTERIM ONLY (SHOOT_INJECT=1): the source's one new CSS rule, until the locked rebuild lands
    if (process.env.SHOOT_INJECT) await page.addStyleTag({ content: ".ng-drill[data-practice-page]{background:#111522!important}" });
    await page.waitForFunction(() => window.__neural && window.__neural.curriculum && window.__neural.nodes && window.__neural.nodes.length > 100, null, { timeout: 90_000 });
    await sleep(6000); // the intro and the first landing, in real time
    const seeded = await seed(page);
    await press(page, vp, ".ng-logo", "open the drawer"); await sleep(900);
    const home = await measure(page);
    let pathView = null;
    if (look === "today") {   // the reference: Path, the view Practice should behave like
      await press(page, vp, '[data-explore-stats] [data-view="challenges"]', "Path"); await sleep(1500);
      pathView = await page.evaluate(() => { const d = document.querySelector(".ng-drill").getBoundingClientRect(), a = window.__neural; return { drawer: { x: Math.round(d.x), w: Math.round(d.width) }, brand: document.querySelector(".ng-drawer-brand").textContent.trim(), paused: !!a.paused, badge: getComputedStyle(document.querySelector(".ng-acctwrap")).display }; });
      await shot(page, "00-path-" + vp.tag);
      await press(page, vp, ".ng-drawer-brand", "back to the drawer"); await sleep(800);
    }
    await press(page, vp, '[data-explore-stats] [data-b="due"]', "Practice");
    // ON A TOUCH SCREEN THE PLAN IS STRANDED (found here, not this brief's to fix): the tap leaves the drawer list
    // :hover, so `_afterPress` waits for a pointerleave the tap already fired. Recorded, then nudged the way the
    // page's own "Open study plan" does, so every look is shot on the same plan.
    let stranded = false;
    try { await page.waitForFunction(() => { const s = window.__neural._session; return s && s.plan; }, null, { timeout: 5_000 }); }
    catch (e) { stranded = true; await page.evaluate(() => { const a = window.__neural; a.openPlanSession(a._session.anchor, false); }); }
    try { await page.waitForFunction(() => { const s = window.__neural._session; return s && s.plan && s.keys.length > 3; }, null, { timeout: 30_000 }); }
    catch (e) {
      await shot(page, "zz-fail-" + look + "-" + vp.tag);
      console.log("FAIL", look, vp.tag, JSON.stringify(await page.evaluate(() => { const a = window.__neural, s = a._session; return { session: !!s, practice: s && s.practice, plan: !!(s && s.plan), keys: s && s.keys.length, rt: !!a._gameplanRuntime, load: a._gameplanLoadState, deckShown: a.deckShown, view: a._viewMode }; })), errors);
      throw e;
    }
    await sleep(2500); // the camera's flight to the card's technique, in real time
    const n = ORDER[look], W = vp.tag;
    const plan = await measure(page);
    await shot(page, String(n).padStart(2, "0") + "-" + look + "-plan-" + W);
    // the middle of a card: b first starts one from its plan; then the answer is revealed (or a choice made)
    if (look === "b") { await press(page, vp, "[data-session-row]", "start the first card"); await sleep(1200); }
    const hasMc = await page.locator('[data-session-row][aria-expanded="true"] + div [data-practice-mc-opt]:visible').count();
    if (hasMc) await press(page, vp, '[data-session-row][aria-expanded="true"] + div [data-practice-mc-opt]', "a choice");
    else await press(page, vp, '[data-session-row][aria-expanded="true"] + div [data-mini-reveal]', "Reveal");
    await sleep(hasMc ? 250 : 700);
    const card = await measure(page);
    await shot(page, String(n + 1).padStart(2, "0") + "-" + look + "-card-" + W);
    // stress: the corpus's longest answer and longest explanation, revealed in this look's card width
    const stress = [];
    for (const key of seeded.stress) {
      const ok = await page.evaluate((key) => { const a = window.__neural, s = a._session, i = s.keys.indexOf(key); if (i < 0) return false; a._sessionOpeners[i](); a._scrollFocusedDeck(); return true; }, key);
      if (!ok) { stress.push({ key, missing: true }); continue; }
      await sleep(900);
      const mc = await page.locator('[data-session-row][aria-expanded="true"] + div [data-practice-mc-opt]:visible').count();
      const before = await measure(page);
      if (mc) await page.evaluate(() => { const o = document.querySelector('[data-session-row][aria-expanded="true"] + div [data-practice-mc-opt]'); o.click(); });
      else await page.evaluate(() => { const o = document.querySelector('[data-session-row][aria-expanded="true"] + div [data-mini-reveal]'); o && o.click(); });
      await sleep(400);
      stress.push({ key, mc, before: { q: before.q, mcOpts: before.mcOpts }, after: await measure(page) });
      if (key === seeded.stress[0]) await shot(page, String(20 + n).padStart(2, "0") + "-" + look + "-longest-" + W);
    }
    // a NEW deck shows multiple choice first (recognition): measure its choices as answer targets
    let mc = null;
    // multiple choice is opt-in in Practice (Settings: mcMode, default "classic"); a player who chose it sees this
    const newKey = await page.evaluate(async () => {
      const a = window.__neural, s = a._session; if (!s.plan) return null;
      a.settings.mcMode = "mc";
      for (const r of s.plan.fresh) {
        const i = s.keys.indexOf(r.key); if (i < 0) continue;
        await a.hydrateDeck(r.key);
        const cards = a._cardsOf(a.flashcards.decks[r.key]) || [], c = cards.find((x) => r.questions.includes(a.qhash(x.q))) || cards[0];
        if (c) await a._warmMcPool(c, r.key, "practice");
        a._sessionOpeners[i](); a._scrollFocusedDeck(); return r.key;
      }
      return null;
    });
    if (newKey) {
      await sleep(1500);
      mc = await page.evaluate(() => {
        const open = document.querySelector('[data-session-row][aria-expanded="true"] + div');
        const opts = open ? [...open.querySelectorAll("[data-practice-mc-opt]")].filter((e) => e.getClientRects().length) : [];
        return opts.map((o) => { const r = o.getBoundingClientRect(), cs = getComputedStyle(o); return { h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top), bottom: Math.round(r.bottom), onScreen: r.bottom <= innerHeight && r.top >= 0, chars: (o.textContent || "").trim().length, font: cs.fontSize }; });
      });
      if (mc && mc.length) await shot(page, String(30 + n).padStart(2, "0") + "-" + look + "-choices-" + W);
    }
    // how you get back: the Back control (today, b's card) or the brand (a, b's plan, c), measured for where it lands
    const back = await page.evaluate(() => { const b = [...document.querySelectorAll("[data-pane-back]")].find((e) => e.getClientRects().length); return b ? "back" : "brand"; });
    await press(page, vp, back === "back" ? "[data-pane-back]" : ".ng-drawer-brand", "the way back"); await sleep(900);
    const after = await page.evaluate(() => { const a = window.__neural; return { session: !!a._session, deckShown: !!a.deckShown, view: a._viewMode, wide: document.querySelector(".ng-drill").hasAttribute("data-practice-wide"), brand: document.querySelector(".ng-drawer-brand").textContent.trim() }; });
    results.push({ look, vp: W, newKey, mc, stranded, seeded, home: { drawer: home.drawer, paused: home.paused }, pathView, plan, card, stress, back, after, errors });
    console.log(look, W, JSON.stringify({ stranded, drawer: plan.drawer, wide: plan.wide, brand: plan.brand, paused: plan.paused, q: plan.q, node: plan.node, ringsSeen: plan.ringsSeen, rowsShown: plan.rowsShown, errors: errors.length }));
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify(results, null, 1));
console.log("wrote", path.join(OUT, "measure.json"));
