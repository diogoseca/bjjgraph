// wire_semantics.mjs — THE ZERO-WIRE-BYTE ROUTE, as a reference (gs-2, items S3/S4).
//
// Rebuilds the corpus's game IN NODE from the shipped wire exactly the way the browser does (the real
// `ingest` from neural/src/app.src.jsx + `ngFlowBuild` from neural/src/flow.src.js, the same harness as
// tests/flow.test.mjs), then computes by fixed-point iteration:
//   (i)   the H = infinity committor at every state, both turns;
//   (ii)  the exit law by body-region class x performer (the class table stands in for the
//         one-char-per-submission wire field the payload probe prices);
//   (iii) expected PLIES to the finish (the stay-put miss costs 0 plies under the shipped rule);
//   (iv)  the clock's Yaglom ratio P(I finish | roll outlasts H plies) at large H.
// It writes one JSON that `python3 -B scripts/semantics/scalars.py --consequences` compares with the
// kernel (the exact agreement is Proposition-free: the kernel with the wire's integer attempt shares
// substituted into its own cells reproduces every number here to <= 4.3e-13).
//
//   node scripts/semantics/wire_semantics.mjs <repo> <join.json> <out.json> <shipped|symmetric> <none|nogi>
//
// READ-ONLY on the repo: it reads the EMITTED wire (source/quartz/static/neural/graph-data.json,
// gitignored — `python3 scripts/regenerate_neural_data.py` writes it) and the two neural sources, and
// refuses an <out.json> inside the repo's source/, neural/, content/ or tests/ trees.
// The finisher tags come from a copy of ngFlowAction's expansion that ALSO records which node
// finishes; the copy is asserted cell-for-cell equal to the shipped expansion (K.hands[i][t].succ
// and .miss), so it cannot drift from what the browser builds.
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const [, , REPO, JOIN_PATH, OUT, RULE, MASK] = process.argv;
if (!REPO || !JOIN_PATH || !OUT || !["shipped", "symmetric"].includes(RULE) || !["none", "nogi"].includes(MASK)) {
  console.error("usage: node wire_semantics.mjs <repo> <join.json> <out.json> <shipped|symmetric> <none|nogi>");
  process.exit(2);
}
{
  const { resolve } = await import("node:path");
  const out = resolve(OUT), repo = resolve(REPO);
  for (const tree of ["source", "neural", "content", "tests"]) {
    if (out.startsWith(resolve(repo, tree) + "/")) {
      console.error(`[wire_semantics] FAIL refusing to write ${out}: inside the repo's ${tree}/ tree (read-only reference)`);
      process.exit(2);
    }
  }
}
const { ngFlowBuild, ngFlowBackward, ngFlowV0 } = await import(REPO + "/neural/src/flow.src.js");
const SRC = readFileSync(REPO + "/neural/src/app.src.jsx", "utf8");
const WIRE_TEXT = readFileSync(REPO + "/source/quartz/static/neural/graph-data.json", "utf8");
const JOIN = JSON.parse(readFileSync(JOIN_PATH, "utf8"));
const fail = (msg) => { console.error("[wire_semantics] FAIL " + msg); process.exit(1); };

const Component = new Function("DCLogic", "React", `${SRC}\nreturn Component;`)(
  class DCLogic {}, { createRef: () => ({ current: null }) },
);
const T0 = performance.now();
const app = Object.create(Component.prototype);
app.settings = {}; app.beats = []; app.track = () => {}; app._saveProgress = () => {};
app.get = (_k, d) => d; app.set = () => {};
if (MASK === "nogi") app._giMode = "nogi";        // _hydrateGiMode keeps a non-null mode
app.ingest(JSON.parse(WIRE_TEXT));
if (MASK === "nogi" && app._giMode !== "nogi") fail("could not hold the no-gi ruleset mask");
const T1 = performance.now();
// `frame: "nogi"`: this route reproduces the corpus's NO-GI game (graph.json's no-gi Model). Since
// v1.208.0 ngFlowBuild prices the app's own ruleset, and a harness app with no localStorage is in
// gi, so without the override the "none" mask would silently read the gi hands (`cal.evGi`). The
// override moves hands and rates only; the mask stays the app's, which is what <mask> selects.
const K = ngFlowBuild(app, { lamIdx: 0, frame: "nogi" });
if (K && K.handsFrame !== "nogi") fail(`ngFlowBuild priced ${K.handsFrame} hands, not the no-gi route`);
const T2 = performance.now();
if (!K || !K.n) fail("ngFlowBuild returned no kernel");

const KW = 1, KL = 2, KS = 3;
const nodes = app.nodes;
const flipKey = (k) => k.endsWith("/top") ? k.slice(0, -4) + "/bottom" : k.endsWith("/bottom") ? k.slice(0, -7) + "/top" : k;
const rsOk = (i) => (typeof app.giAllows === "function" ? app.giAllows(nodes[i]) : true);

// ngFlowAction's expansion, plus the finishing node on every W/L cell
function expand(node) {
  const raw = [[], []];
  const outs = (node.cal && node.cal.outcomes) || [];
  for (const o of outs) {
    const to = String(o.to || ""), res = o.result, prob = +o.probability || 0;
    const b = raw[res === "success" ? 0 : 1];
    if (to === "game-over") { b.push([prob, KW, null, false, node]); continue; }
    if (/\/(top|bottom)$/.test(to)) { b.push([prob, KS, to, res === "success", null]); continue; }
    const r = app.resolveOutcomeTo(to);
    const ch = r && r.idx >= 0 ? nodes[r.idx] : null;
    const cOuts = (ch && ch.cal && ch.cal.outcomes) || null;
    if (!cOuts) continue;
    const byActor = res === "success";
    for (const co of cOuts) {
      const cto = String(co.to || ""), w = prob * (+co.probability || 0) / 100;
      if (cto === "game-over") { b.push([w, byActor ? KW : KL, null, false, ch]); continue; }
      b.push([w, KS, byActor ? cto : flipKey(cto), co.result === "success" && byActor, null]);
    }
  }
  return raw.map((cells) => {
    let tot = 0;
    for (const c of cells) tot += c[0];
    return tot > 0 ? cells.map((c) => [c[0] / tot, c[1], c[2], c[3], c[4]]) : [];
  });
}

// recover each hand's node indices in ngFlowBuild's own order, and check the join
const firstEv = new Map();
for (const [key, m] of app._ev) {
  const slash = key.lastIndexOf("/");
  const n = nodes[parseInt(key.slice(0, slash), 10)];
  if (!n || !n.posId) continue;
  const sk = n.posId + "/" + key.slice(slash + 1);
  if (!firstEv.has(sk)) firstEv.set(sk, m);
}
const classOf = JOIN.sub_class, hubOf = JOIN.node_hub;
const classes = [...new Set(Object.values(classOf))].sort();
const C = 2 * classes.length;                       // columns: me|cls..., them|cls...
const col = (performer, node) => {
  const hub = hubOf[node.id];
  const cls = hub != null ? classOf[hub] : undefined;
  if (cls == null) return -1;
  return (performer === "me" ? 0 : classes.length) + classes.indexOf(cls);
};
let tagged = 0, cellsCompared = 0, unmappedFinishers = 0;
const tags = [];                                     // tags[i][t][b][c] = finisher node or null
const hands = {};                                    // state -> [[hub, share], ...] for the Python join
for (let i = 0; i < K.n; i++) {
  const m = firstEv.get(K.states[i]);
  if (!m) fail("no ev block for " + K.states[i]);
  const tis = [];
  for (const [ti] of m) {
    const tn = nodes[ti];
    if (!tn || tn.ty === "positions") continue;
    if (!rsOk(ti)) continue;
    const ex = expand(tn);
    if (!ex[0].length && !ex[1].length) continue;
    tis.push([ti, ex]);
  }
  if (tis.length !== K.hands[i].length) fail(`hand length ${K.states[i]}: ${tis.length} vs ${K.hands[i].length}`);
  const row = [];
  hands[K.states[i]] = [];
  for (let t = 0; t < tis.length; t++) {
    const [ti, ex] = tis[t], a = K.hands[i][t];
    if (a.name !== nodes[ti].t) fail(`hand order ${K.states[i]}[${t}]: ${a.name} vs ${nodes[ti].t}`);
    const tb = [];
    for (let b = 0; b < 2; b++) {
      const mine = ex[b], ref = b === 0 ? a.succ : a.miss;
      if (mine.length !== ref.length) fail(`cell count ${K.states[i]} ${a.name} branch ${b}`);
      for (let c = 0; c < mine.length; c++) {
        cellsCompared++;
        const x = mine[c], y = ref[c];
        if (x[0] !== y[0] || x[1] !== y[1] || x[2] !== y[2] || x[3] !== y[3]) fail(`cell ${K.states[i]} ${a.name} ${b}/${c}`);
      }
      tb.push(mine.map((x) => { if (x[4]) tagged++; return x[4]; }));
    }
    row.push(tb);
    const hub = hubOf[nodes[ti].id];
    if (hub == null) fail("no hub for wire node " + nodes[ti].id);
    hands[K.states[i]].push([nodes[ti].ty, hub, a.att]);
  }
  tags.push(row);
}

// per-cell payload columns, bound to K's own resolved cells
const mineCells = [], theirCells = [];
for (let i = 0; i < K.n; i++) {
  mineCells.push(K.mine[i].map((br, t) => br.map((cells, b) => cells.map((c, k) => {
    let cc = -1;
    if (c[1] === KW) cc = col("me", tags[i][t][b][k]);
    else if (c[1] === KL) cc = col("them", tags[i][t][b][k]);
    if (c[1] !== KS && cc < 0) unmappedFinishers++;
    return [c[0], c[1], c[2], c[3], cc];
  }))));
  const f = K.flipIdx[i];
  theirCells.push(K.theirs[i].map((br, t) => br.map((cells, b) => cells.map((c, k) => {
    let cc = -1;                                     // THEIR card: KW = they finish, KL = I finish
    if (c[1] === KW) cc = col("them", tags[f][t][b][k]);
    else if (c[1] === KL) cc = col("me", tags[f][t][b][k]);
    if (c[1] !== KS && cc < 0) unmappedFinishers++;
    return [c[0], c[1], c[2], c[3], cc];
  }))));
}
if (unmappedFinishers) fail(`${unmappedFinishers} finishing cells have no body-region class`);
const SYM = RULE === "symmetric";
const n = K.n;
let unresolved = 0;

// one sweep of the H = infinity fixed point; D = C exit columns + 1 plies column
const D = C + 1;
function sweep(V, U, Vin, Uin, gs) {
  // THEIR turn
  const Vr = gs ? V : Vin, Ur = gs ? U : Uin;
  for (let i = 0; i < n; i++) {
    const hand = theirCells[i], acts = K.hands[K.flipIdx[i]] || [];
    const out = new Float64Array(D);
    if (!hand.length) { out[C] = 1; U.set(out, i * D); continue; }   // optionless: a draw, 1 ply
    for (let t = 0; t < hand.length; t++) {
      const a = acts[t];
      for (let b = 0; b < 2; b++) {
        const bw = b === 0 ? a.p0 : 1 - a.p0, cells = hand[t][b];
        if (bw <= 0 || !cells.length) continue;
        for (const c of cells) {
          const x = a.att * bw * c[0];
          out[C] += x;                                                   // every opponent cell is 1 ply
          if (c[1] !== KS) { out[c[4]] += x; continue; }
          if (c[2] < 0) { unresolved++; continue; }
          const src = (SYM && c[3]) ? Ur : Vr, o = c[2] * D;
          for (let d = 0; d < D; d++) out[d] += x * src[o + d];
        }
      }
    }
    U.set(out, i * D);
  }
  // MY turn
  const Ur2 = gs ? U : Uin;
  for (let i = 0; i < n; i++) {
    const hand = mineCells[i], P = K.att[i];
    const out = new Float64Array(D);
    if (!hand.length) { out[C] = 1; V.set(out, i * D); continue; }
    for (let t = 0; t < hand.length; t++) {
      const p = K.hands[i][t].p0;
      for (let b = 0; b < 2; b++) {
        const bw = b === 0 ? p : 1 - p, cells = hand[t][b];
        if (bw <= 0 || !cells.length) continue;
        for (const c of cells) {
          const x = P[t] * bw * c[0];
          if (c[1] !== KS) { out[c[4]] += x; out[C] += x; continue; }
          if (c[2] < 0) { unresolved++; out[C] += x; continue; }   // lost mass still costs its ply
          const j = c[2];
          const keeps = c[3];
          const src = keeps ? Vr : Ur2, o = j * D;
          out[C] += x * ((!keeps && !SYM && j === i) ? 0 : 1);            // the stay-put miss: 0 plies
          for (let d = 0; d < D; d++) out[d] += x * src[o + d];
        }
      }
    }
    V.set(out, i * D);
  }
}

function solve(gs, tol) {
  let V = new Float64Array(n * D), U = new Float64Array(n * D);
  const t0 = performance.now();
  let it = 0, delta = Infinity;
  while (delta > tol && it < 100000) {
    const V0 = V.slice(), U0 = U.slice();
    if (gs) sweep(V, U, V0, U0, true);
    else { const V1 = new Float64Array(n * D), U1 = new Float64Array(n * D); sweep(V1, U1, V0, U0, false); V = V1; U = U1; }
    delta = 0;
    for (let k = 0; k < V.length; k++) delta = Math.max(delta, Math.abs(V[k] - V0[k]), Math.abs(U[k] - U0[k]));
    it++;
  }
  return { V, U, it, delta, ms: performance.now() - t0 };
}
const TOL = 1e-13;
const gs = solve(true, TOL);
const jac = solve(false, TOL);
// residual of the GS answer: one more exact Jacobi sweep from it
const Vr = new Float64Array(n * D), Ur = new Float64Array(n * D);
sweep(Vr, Ur, gs.V, gs.U, false);
let resid = 0;
for (let k = 0; k < Vr.length; k++) resid = Math.max(resid, Math.abs(Vr[k] - gs.V[k]), Math.abs(Ur[k] - gs.U[k]));
// iterations to reach 1e-12 of the final answer (measured on a re-run)
function itersTo(gsFlag, target) {
  let V = new Float64Array(n * D), U = new Float64Array(n * D);
  for (let it = 1; it < 100000; it++) {
    if (gsFlag) sweep(V, U, V.slice(), U.slice(), true);
    else { const V1 = new Float64Array(n * D), U1 = new Float64Array(n * D); sweep(V1, U1, V, U, false); V = V1; U = U1; }
    let e = 0;
    for (let k = 0; k < V.length; k++) {
      if (k % D === C) continue;                       // the probability columns only
      e = Math.max(e, Math.abs(V[k] - gs.V[k]), Math.abs(U[k] - gs.U[k]));
    }
    if (e < target) return it;
  }
  return -1;
}
const itGs12 = itersTo(true, 1e-12), itJac12 = itersTo(false, 1e-12);

// (iv) the Yaglom ratio: ply recursion to H with W, L, D tracked (my own finite horizon), and the
// shipped ngFlowBackward at H = 11 as a control of that recursion (no card sits outside the clamp)
function horizon(H) {
  let Vw = new Float64Array(n), Vl = new Float64Array(n), Vd = new Float64Array(n);
  let Uw = new Float64Array(n), Ul = new Float64Array(n), Ud = new Float64Array(n);
  for (let m = 1; m <= H; m++) {
    const pVw = Vw, pVl = Vl, pVd = Vd, pUw = Uw, pUl = Ul, pUd = Ud;
    const nUw = new Float64Array(n), nUl = new Float64Array(n), nUd = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const hand = theirCells[i], acts = K.hands[K.flipIdx[i]] || [];
      if (!hand.length) { nUd[i] = 1; continue; }
      for (let t = 0; t < hand.length; t++) {
        const a = acts[t];
        for (let b = 0; b < 2; b++) {
          const bw = b === 0 ? a.p0 : 1 - a.p0;
          for (const c of hand[t][b]) {
            const x = a.att * bw * c[0];
            if (c[1] === KW) nUl[i] += x; else if (c[1] === KL) nUw[i] += x;
            else if (c[2] >= 0) {
              const j = c[2];
              if (SYM && c[3]) { nUw[i] += x * pUw[j]; nUl[i] += x * pUl[j]; nUd[i] += x * pUd[j]; }
              else { nUw[i] += x * pVw[j]; nUl[i] += x * pVl[j]; nUd[i] += x * pVd[j]; }
            }
          }
        }
      }
    }
    Uw = nUw; Ul = nUl; Ud = nUd;
    const nVw = new Float64Array(n), nVl = new Float64Array(n), nVd = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const hand = mineCells[i], P = K.att[i];
      if (!hand.length) { nVd[i] = 1; continue; }
      for (let t = 0; t < hand.length; t++) {
        const p = K.hands[i][t].p0;
        for (let b = 0; b < 2; b++) {
          const bw = b === 0 ? p : 1 - p;
          for (const c of hand[t][b]) {
            const x = P[t] * bw * c[0];
            if (c[1] === KW) nVw[i] += x; else if (c[1] === KL) nVl[i] += x;
            else if (c[2] >= 0) {
              const j = c[2];
              let sw, sl, sd;
              if (c[3]) { sw = pVw; sl = pVl; sd = pVd; }
              else if (!SYM && j === i) { sw = Uw; sl = Ul; sd = Ud; }       // 0 plies, same horizon
              else { sw = pUw; sl = pUl; sd = pUd; }
              nVw[i] += x * sw[j]; nVl[i] += x * sl[j]; nVd[i] += x * sd[j];
            }
          }
        }
      }
    }
    Vw = nVw; Vl = nVl; Vd = nVd;
  }
  return { Vw, Vl, Vd, Uw, Ul, Ud };
}
let ctrl = null;
if (!SYM) {
  const mine11 = horizon(11), fb = ngFlowBackward(K, new Float64Array(K.deckKeys.length), 2, 11, null, false);
  let e = 0;
  for (let i = 0; i < n; i++) e = Math.max(e, Math.abs(mine11.Vw[i] - fb.Vw[i]), Math.abs(mine11.Vl[i] - fb.Vl[i]),
    Math.abs(mine11.Uw[i] - fb.Uw[i]), Math.abs(mine11.Ul[i] - fb.Ul[i]));
  ctrl = e;
}
const Y = 60, hY = horizon(Y);
const yag = [], yagState = {};
for (let i = 0; i < n; i++) {
  yagState[K.states[i]] = {};
  for (const [side, w, l, d, off] of [["M", hY.Vw, hY.Vl, hY.Vd, "V"], ["T", hY.Uw, hY.Ul, hY.Ud, "U"]]) {
    const src = off === "V" ? gs.V : gs.U;
    let qW = 0;
    for (let k = 0; k < classes.length; k++) qW += src[i * D + k];
    const surv = 1 - w[i] - l[i] - d[i];
    yagState[K.states[i]][side] = surv > 1e-9 ? (qW - w[i]) / surv : null;
    if (surv > 1e-9) yag.push((qW - w[i]) / surv);
  }
}
const T3 = performance.now();

const states = {};
for (let i = 0; i < n; i++) {
  states[K.states[i]] = { M: Array.from(gs.V.slice(i * D, (i + 1) * D)), T: Array.from(gs.U.slice(i * D, (i + 1) * D)) };
}
const clamped = K.hands.flat().filter((a) => a.p0 < 0.05 || a.p0 > 0.95).length;
writeFileSync(OUT, JSON.stringify({
  rule: RULE, mask: MASK, columns: [...classes.map((c) => "me|" + c), ...classes.map((c) => "them|" + c), "E_plies"],
  classes, states, hands, yaglomState: yagState,
  coverage: { ...K.cov, n: K.n, cellsCompared, taggedFinisherCells: tagged, unresolvedDuringSolve: unresolved,
              cardsOutsideClamp: clamped, handsCards: K.hands.reduce((s, h) => s + h.length, 0) },
  iterations: { gaussSeidelToTol: gs.it, jacobiToTol: jac.it, tol: TOL, gaussSeidelTo1e12: itGs12, jacobiTo1e12: itJac12,
                finalDeltaGS: gs.delta, residualGS: resid },
  control_myHorizon11_vs_ngFlowBackward: ctrl,
  flowV0_shipped: SYM ? null : ngFlowV0(K, new Float64Array(K.deckKeys.length), 2, 11, null, null),
  yaglom: { H: Y, n: yag.length, min: Math.min(...yag), max: Math.max(...yag), mean: yag.reduce((s, x) => s + x, 0) / yag.length },
  wall_ms: { ingest: T1 - T0, build: T2 - T1, gaussSeidel: gs.ms, jacobi: jac.ms, total: T3 - T0 },
  node: process.version,
}));
console.log(`[wire_semantics] ${RULE}/${MASK}: ${n} states, ${cellsCompared} cells equal to ngFlowAction, GS ${gs.it} sweeps (${gs.ms.toFixed(1)} ms), `
  + `Jacobi ${jac.it}, to 1e-12: GS ${itGs12} / Jacobi ${itJac12}, residual ${resid.toExponential(2)}, `
  + `control H=11 ${ctrl === null ? "n/a" : ctrl.toExponential(2)}, yaglom ${yag.length} states [${Math.min(...yag).toFixed(4)}, ${Math.max(...yag).toFixed(4)}]`);
