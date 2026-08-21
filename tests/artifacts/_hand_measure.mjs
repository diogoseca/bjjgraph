// THE HAND — the reproduction harness for the figures CLAUDE.md quotes (v1.119.0). Not a gate:
// the gate is e2e/journeys/option-hand.spec.ts. This exists so the numbers in the canon can be
// re-derived from the live app instead of trusted.
//
//   npm run dev            # or any server for source/public on :8080
//   flock /tmp/bjj-pw.lock node tests/artifacts/_hand_measure.mjs
//
// It walks all 272 role-hands through `optionsFor` — the seam `enterLand` deals from — and reports:
//   1. THE CAP: how many hands it truncates, and how many lose a whole CATEGORY to it (the answer
//      must be 0; before _capHand it was 1, side-control/top, which erased all 9 of its
//      transitions including the 23%-attempt Side Control to Mount).
//   2. THE ORDER: descending by the ranking value, a comparator that never returns 0, and
//      permutation-invariance (an order that depends on insertion order = node index cannot
//      survive reversing the input and re-sorting).
//   3. THE PRINT: exact display ties and whether they come from identical wire rows.
//   4. THE ODDS: submission calibration coverage, spread, and what the old dominance fallback
//      would have priced them at.
import { chromium } from "@playwright/test";

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { window.__NEURAL_TEST__ = true; });
await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__neural && (window.__neural.nodes || []).length > 0, null, { timeout: 30000 });

const R = await page.evaluate(() => {
  const a = window.__neural;
  a.aiSkill = 0.13; a.userMods = null; a._posKey = "__measure__";
  const posIdx = []; a.nodes.forEach((n, i) => { if (n.ty === "positions" && n.posId) posIdx.push(i); });

  // the survivor pool: optionsFor's own filters (role v1.103.0, origin v1.103.0), minus the cap
  const pool = (pi, role) => {
    const seen = new Set(); const out = []; const hereId = a.nodes[pi].posId || null;
    for (const k of a.adj[pi]) {
      const n = a.nodes[k];
      if (n.ty === "positions" || seen.has(n.t)) continue; seen.add(n.t);
      if (n.fromRole && n.fromRole !== role) continue;
      if (n.fromPositionId && hereId && n.fromPositionId !== hereId) continue;
      out.push(k);
    }
    return out;
  };

  let hands = 0, capped = 0, maxPool = 0, notDesc = 0, zeroPairs = 0, numericTies = 0, revMismatch = 0;
  let exactTies = 0, exactTiesSameRow = 0, printTies = 0, printed = 0;
  const erased = [];
  for (const pi of posIdx) for (const role of ["top", "bottom"]) {
    a.currentPos = pi; a.playerRole = role;
    const p = pool(pi, role); if (!p.length) continue;
    const dealt = a.optionsFor(pi); if (!dealt.length) continue;
    hands++;
    const st = a.nodes[pi].posId + "/" + role;
    if (p.length > dealt.length) capped++;
    if (p.length > maxPool) maxPool = p.length;
    const pty = new Set(p.map((k) => a.nodes[k].ty)), dty = new Set(dealt.map((o) => o.node.ty));
    for (const ty of pty) if (!dty.has(ty)) erased.push(st + " loses all " + p.filter((k) => a.nodes[k].ty === ty).length + " " + ty);

    for (let i = 1; i < dealt.length; i++) {
      const x = dealt[i - 1].ord, y = dealt[i].ord;
      if (x != null && y != null && y > x + 1e-9) notDesc++;
    }
    for (let i = 0; i < dealt.length; i++) for (let j = i + 1; j < dealt.length; j++) {
      if (a._cmpDealt(dealt[i], dealt[j]) === 0) zeroPairs++;
      const x = dealt[i], y = dealt[j];
      if (x.ord === y.ord && x.ordOdds === y.ordOdds && ((x.ev && x.ev.att) || 0) === ((y.ev && y.ev.att) || 0)) numericTies++;
    }
    const rev = dealt.slice().reverse().sort((x, y) => a._cmpDealt(x, y));
    if (rev.map((o) => o.node.t).join("|") !== dealt.map((o) => o.node.t).join("|")) revMismatch++;

    const byRaw = {}, byPrint = {};
    for (const o of dealt) {
      const raw = a.moveEdge(o); if (raw == null) continue; printed++;
      (byRaw[raw] = byRaw[raw] || []).push(o);
      (byPrint[Math.round(raw)] = byPrint[Math.round(raw)] || []).push(o);
    }
    for (const k in byRaw) {
      const g = byRaw[k]; if (g.length < 2) continue; exactTies++;
      if (g.every((o) => o.ev.e0 === g[0].ev.e0 && o.ev.c1 === g[0].ev.c1)) exactTiesSameRow++;
    }
    for (const k in byPrint) if (byPrint[k].length > 1) printTies++;
  }

  // the hand the category floor was written for
  let sctIdx = -1; a.nodes.forEach((n, i) => { if (n.ty === "positions" && n.posId === "side-control") sctIdx = i; });
  a.currentPos = sctIdx; a.playerRole = "top";
  const sctPool = pool(sctIdx, "top");
  const sct = a.optionsFor(sctIdx).map((o) => ({ t: o.node.t, ty: o.node.ty, edge: a.edgeMark(o) ? a.edgeMark(o).txt : null, att: o.ev ? o.ev.att : null }));

  // submission odds
  const subs = a.nodes.filter((n) => n.ty === "submissions");
  const cal = subs.map((n) => a.calSuccess(n));
  const rates = subs.filter((n, i) => cal[i] != null).map((n) => Math.round(a.calSuccess(n) * 100));
  const fb = subs.map((n) => Math.round((0.36 + n.dom * 0.1) * 100));

  return {
    cap: { hands, capped, maxPool, erased, sctPool: sctPool.length,
      sctPoolTransitions: sctPool.filter((k) => a.nodes[k].ty === "transitions").length,
      sctDealt: sct.length, sctClockSec: a.get("decisionSec", 9) + (sct.length - 1) * 0.8, sct },
    order: { notDesc, zeroPairs, numericTies, revMismatch },
    print: { printed, exactTies, exactTiesSameRow, printTies },
    odds: { subs: subs.length, uncalibrated: cal.filter((c) => c == null).length,
      distinct: new Set(rates).size, min: Math.min(...rates), max: Math.max(...rates),
      outsideFallbackBand: rates.filter((r) => r < 44 || r > 47).length, fallbackDistinct: new Set(fb).size },
  };
});
console.log(JSON.stringify(R, null, 1));
await b.close();
