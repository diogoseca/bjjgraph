// THE MISS DISTRIBUTION, MEASURED FROM THE SHIPPED FUNCTION (v1.121.0).
//
// `_resolve_kernel_measure.py` computes the kernels analytically from graph-data.json. This one
// re-derives the SAME numbers by driving the app's own `resolve()` — so neither figure rests on a
// re-implementation of the thing under test. If the two disagree, one of them is wrong.
//
// Method: for every node carrying `cal.outcomes`, for each branch, sweep a rigged `outcome` value
// over a uniform grid and record WHICH ROW the real resolve() hands to enterSuccessCal /
// enterFailCal. The four entry points are stubbed for the duration (they are the only things
// resolve() calls after choosing), so nothing in the app moves: no travel, no fx, no state.
// The induced within-branch frequencies are then compared with the authored weights.
//
//   npm run dev            # or any server for source/public on :8080
//   flock /tmp/bjj-pw.lock node tests/artifacts/_resolve_kernel_probe.mjs [gridSteps]
import { chromium } from "@playwright/test";

const GRID = Number(process.argv[2] || 1000);
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { window.__NEURAL_TEST__ = true; });
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + String(e)));
await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__neural && (window.__neural.nodes || []).length > 0, null, { timeout: 30000 });

const R = await page.evaluate((GRID) => {
  const a = window.__neural;
  // freeze every input resolve() reads apart from the rigged draw
  a._combo = 0;                       // momentumSkew() === 0 -> authored weights are live weights
  const saved = ["enterSuccessCal", "enterFailCal", "enterSuccess", "enterFail"].map((k) => [k, a[k]]);
  let got = null;
  a.enterSuccessCal = (opt, out) => { got = { branch: "s", out: out }; };
  a.enterFailCal = (opt, out) => { got = { branch: "f", out: out }; };
  a.enterSuccess = () => { got = { branch: "s", out: null }; };
  a.enterFail = () => { got = { branch: "f", out: null }; };

  const tvs = [], counterShip = [], counterAuth = [];
  let zero = 0, over10 = 0, measured = 0, endsCounter = 0, skewBeats = 0;
  const beats0 = (a.beats || []).length;
  const worst = [];

  for (let i = 0; i < a.nodes.length; i++) {
    const n = a.nodes[i];
    const outs = n.cal && Array.isArray(n.cal.outcomes) ? n.cal.outcomes : null;
    if (!outs || !outs.length) continue;
    measured++;
    if (outs[outs.length - 1].result === "counter") endsCounter++;
    // p: the AUTHORED calibrated rate for the live frame — the number the EDGE solver prices with
    const p = a.calSuccess(n);
    if (p == null) continue;

    // ── empirical: sweep the single rigged draw across [0,1] for each pre-decided branch
    const hits = outs.map(() => 0);
    for (const success of [true, false]) {
      const mass = success ? p : 1 - p;
      for (let k = 0; k < GRID; k++) {
        a._rig = { outcome: [(k + 0.5) / GRID] };
        got = null;
        a.resolve({ idx: i, res: -1 }, success);
        const j = got && got.out ? outs.indexOf(got.out) : -1;
        if (j >= 0) hits[j] += mass / GRID;
      }
    }
    a._rig = null;

    // ── authored: branch by p, row by weight renormalised INSIDE the branch
    const w = outs.map((o) => Math.max(0, +o.probability || 0));
    const isS = outs.map((o) => o.result === "success");
    let Ws = 0, Wm = 0;
    for (let j = 0; j < outs.length; j++) (isS[j] ? (Ws += w[j]) : (Wm += w[j]));
    const auth = outs.map((o, j) => (isS[j] ? (Ws > 0 ? p * w[j] / Ws : 0) : (Wm > 0 ? (1 - p) * w[j] / Wm : 0)));

    let tv = 0;
    for (let j = 0; j < outs.length; j++) tv += Math.abs(hits[j] - auth[j]);
    tv /= 2;
    tvs.push(tv);
    if (tv < 0.5 / GRID) zero++;                 // grid resolution, not a fudge: see report
    if (tv > 0.10) over10++;
    let cs = 0, ca = 0;
    for (let j = 0; j < outs.length; j++) if (outs[j].result === "counter") { cs += hits[j]; ca += auth[j]; }
    counterShip.push(cs); counterAuth.push(ca);
    worst.push([tv, n.id, ca - cs]);
  }
  skewBeats = (a.beats || []).length - beats0;
  for (const [k, v] of saved) a[k] = v;

  tvs.sort((x, y) => x - y);
  worst.sort((x, y) => y[0] - x[0]);
  const sum = (arr) => arr.reduce((s, x) => s + x, 0);
  return {
    grid: GRID, measured, endsCounter, nodes: tvs.length, beatsEmitted: skewBeats,
    tvMean: sum(tvs) / tvs.length, tvMedian: tvs[tvs.length >> 1], tvMax: tvs[tvs.length - 1],
    tvZero: zero, tvOver10: over10,
    counterAuth: sum(counterAuth), counterShip: sum(counterShip),
    worst: worst.slice(0, 5),
  };
}, GRID);

const lost = R.counterAuth - R.counterShip;
console.log("grid steps per branch      " + R.grid + "   (TV resolution +-" + (1 / R.grid).toFixed(4) + ")");
console.log("nodes with cal.outcomes    " + R.measured + "   (measured " + R.nodes + ")");
console.log("outcome lists ending in a counter  " + R.endsCounter + " of " + R.measured);
console.log("TV  mean " + R.tvMean.toFixed(4) + "  median " + R.tvMedian.toFixed(4) + "  max " + R.tvMax.toFixed(4));
console.log("TV == 0 (within grid) on " + R.tvZero + " of " + R.nodes + " ;  > 0.10 on " + R.tvOver10);
console.log("counter mass  authored " + R.counterAuth.toFixed(4) + "   rolled " + R.counterShip.toFixed(4) +
  "   LOST " + lost.toFixed(4) + "  (" + (100 * lost / R.counterAuth).toFixed(2) + "%)");
console.log("side effects during the probe: " + R.beatsEmitted + " beats");
console.log("worst 5 by TV:");
for (const [tv, id, cl] of R.worst) console.log("   " + tv.toFixed(4) + "  " + id.padEnd(58) + " counter lost " + cl.toFixed(4));
if (errs.length) console.log("ERRORS " + JSON.stringify(errs));
await b.close();
