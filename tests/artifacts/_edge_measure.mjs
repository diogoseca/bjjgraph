// EDGE — the reproduction harness for the figures CLAUDE.md quotes (v1.118.0). Not a gate: the
// gate is e2e/journeys/option-edge.spec.ts. This exists so the numbers in the canon can be
// re-derived from the live app instead of trusted.
//
//   npm run dev            # or any server for source/public on :8080
//   flock /tmp/bjj-pw.lock node tests/artifacts/_edge_measure.mjs
//
// Three things:
//   1. ACCEPTANCE: with every move pinned to its authored odds (p == p0), the card must show the
//      solver's published integer. The spec's worked examples are the assertion.
//   2. The three hands the task asks for, dealt by a real roll.
//   3. How far the live hand moves from the published one, across all 272 role-hands, because
//      `moveChance` carries the opponent's resistance and that is a per-STATE odds shift.
import { chromium } from "@playwright/test";

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { window.__NEURAL_TEST__ = true; });
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/PostHog|404/.test(m.text())) errs.push("console: " + m.text()); });

await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__neural && (window.__neural.nodes || []).length > 0, null, { timeout: 30000 });

const R = await page.evaluate(() => {
  const a = window.__neural;
  const posByHub = {};
  a.nodes.forEach((n, i) => { if (n.ty === "positions" && n.posId) posByHub[n.posId] = i; });

  // ── 1. AT REST: pin every technique to its own authored (evFrame) rate via successOverride,
  //       so moveChance(n) === p0(n) exactly and every modifier is out of the picture.
  const atRest = (hub, role) => {
    const idx = posByHub[hub];
    a.currentPos = idx; a.playerRole = role; a._posKey = "__norest__";
    a.userMods = a.nodes.map((n) => {
      const p0 = a._evP0(n);
      return p0 == null ? null : { on: true, name: n.t, pct: Math.round(p0 * 100) };
    }).filter(Boolean);
    // successOverride matches by TITLE, and titles repeat; keep the first per title (same as the app)
    const opts = a.optionsFor(idx);
    const rows = opts.map((o) => ({
      t: o.node.t, ty: o.node.ty,
      odds: Math.round(a.moveChance(o.node) * 100),
      edge: a.edgeMark(o) ? a.edgeMark(o).i : null,
      e0: o.ev ? o.ev.e0 : null, c1: o.ev ? o.ev.c1 : null, att: o.ev ? o.ev.att : null,
      raw: a.moveEdge(o),
    }));
    a.userMods = null;
    return rows;
  };

  // ── 2. LIVE: a fresh profile mid-roll. aiSkill is the rigged 0.13 the journeys use.
  const live = (hub, role) => {
    const idx = posByHub[hub];
    a.currentPos = idx; a.playerRole = role; a._posKey = "__nolive__"; a.aiSkill = 0.13; a.userMods = null;
    return a.optionsFor(idx).map((o) => ({
      t: o.node.t, ty: o.node.ty,
      odds: Math.round(a.moveChance(o.node) * 100),
      edge: a.edgeMark(o) ? a.edgeMark(o).i : null,
      e0: o.ev ? o.ev.e0 : null, c1: o.ev ? o.ev.c1 : null, att: o.ev ? o.ev.att : null,
    }));
  };

  // ── 3. SURVEY over every role-hand the table can value
  const survey = { states: 0, sameTop: 0, sameSet: 0, sameOrder: 0, aiMods: [], worst: [] };
  for (const hub in posByHub) {
    for (const role of ["top", "bottom"]) {
      const idx = posByHub[hub];
      if (!a._ev.get(idx + "/" + role)) continue;
      const rest = atRest(hub, role), lv = live(hub, role);
      if (!rest.length || !lv.length) continue;
      survey.states++;
      a.currentPos = idx; a.playerRole = role; a.aiSkill = 0.13; a.userMods = null;
      const aiMod = Math.max(0, a.oppVal(a.nodes[idx])) * 0.4 + 0.13;
      survey.aiMods.push(Math.round(aiMod * 1000) / 1000);
      if (rest[0].t === lv[0].t) survey.sameTop++;
      const rs = rest.map((r) => r.t).sort().join("|"), ls = lv.map((r) => r.t).sort().join("|");
      if (rs === ls) survey.sameSet++;
      if (rest.map((r) => r.t).join("|") === lv.map((r) => r.t).join("|")) survey.sameOrder++;
      else {
        // biggest rank move of any card that is in both hands
        const ri = {}; rest.forEach((r, i) => (ri[r.t] = i));
        let mx = 0, who = null;
        lv.forEach((r, i) => { if (ri[r.t] != null && Math.abs(ri[r.t] - i) > mx) { mx = Math.abs(ri[r.t] - i); who = r.t; } });
        if (mx) survey.worst.push([hub + "/" + role, who, mx]);
      }
    }
  }
  survey.worst.sort((x, y) => y[2] - x[2]);
  survey.worst = survey.worst.slice(0, 6);
  survey.aiMods.sort((x, y) => x - y);
  survey.aiMod = { min: survey.aiMods[0], med: survey.aiMods[(survey.aiMods.length / 2) | 0], max: survey.aiMods[survey.aiMods.length - 1] };
  delete survey.aiMods;

  const hands = {};
  for (const [hub, role] of [["side-control", "top"], ["closed-guard", "bottom"], ["mount", "top"], ["side-control", "bottom"]]) {
    hands[hub + "/" + role] = { rest: atRest(hub, role), live: live(hub, role) };
  }
  // the FULL authored action set at side-control/top (25), which the 10-cap hides
  const fullSCT = (() => {
    const idx = posByHub["side-control"], m = a._ev.get(idx + "/top"), k = a._evLamIdx(), out = [];
    for (const [j, r] of m) out.push({ t: a.nodes[j].t, ty: a.nodes[j].ty, att: r.att, e0: r.lam[k][0], c1: r.lam[k][1] });
    out.sort((x, y) => y.e0 - x.e0);
    return out;
  })();
  a.userMods = null; a._posKey = null;
  return { hands, survey, fullSCT, evFrame: a._evFrame, evLam: a._evLam, giMode: a._giMode, lam: a.get("lossAversion", 2) };
});

console.log(JSON.stringify({ R, errs }, null, 1));
await b.close();
