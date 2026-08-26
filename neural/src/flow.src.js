// ═══ FLOW — what each DECK is worth to your whole game ════════════════════════════════════
//
//     GAIN(deck) = V0(you, that deck mastered) - V0(you, now)
//
// EDGE answers "which of these cards should I play, standing here". This answers "which deck
// should I DRILL", and the two are not interchangeable in either direction:
//
//   * EDGE is RELATIVE to its own state's baseline. `_evShift` subtracts an attempt-weighted
//     hand mean, so `sum(att * EDGE) == 0` at every state BY CONSTRUCTION — a weak-spot score
//     built out of EDGE has an identically-zero total everywhere and its ranking is rounding
//     noise. FLOW is built in Q, absolute, and never reads an EDGE integer.
//   * EDGE is solved under ARGMAX. That value function is compressed into nothing at the top
//     (every dominant state sits near p_win 0.98) because it prices a player who always picks
//     the best card. Drilling advice has to be priced under the policy you ACTUALLY play, so
//     this is a POLICY EVALUATION: the same recursion with argmax replaced by pi.
//
// ZERO NEW WIRE BYTES. The kernel is rebuilt in the browser from what already ships: `cal.ev`
// (the hand at each role-node, with attempt shares) and `cal.outcomes` (the two-branch kernel,
// 1331 of 1331 summing to exactly 100).
//
// A REAL ES MODULE, stripped of its `export`s at bundle time like `lists-codec.src.js`, so the
// browser and `tests/flow.test.mjs` run ONE implementation and it cannot drift from the Python
// reference (`scripts/solve_flow.py`) that gates it.
//
// Scope note: this file shares ONE top-level scope with lists-codec/lists in the bundle, so
// every name here is `NG_FLOW_*` / `ngFlow*`. build.mjs's duplicate-name scan enforces it.

export const NG_FLOW_H = 11;        // EDGE keeps the (9,10,11,12) mixture because it PRINTS an
                                    // integer; FLOW is a ranking, and the mixture/9/12 were
                                    // measured to give the same top-40 and the same negatives.
export const NG_FLOW_MCAP = 0.15;   // `mastery()`'s cap: the full drill headroom of one deck
export const NG_FLOW_PLO = 0.05;    // `moveChance`'s clamp
export const NG_FLOW_PHI = 0.95;
const KW = 1, KL = 2, KS = 3;       // cell kind: actor wins / actor loses / continue

function ngFlowFlip(k) {
  if (k.endsWith("/top")) return k.slice(0, -4) + "/bottom";
  if (k.endsWith("/bottom")) return k.slice(0, -7) + "/top";
  return k;
}

/** `posFamily` + role -> the app's own deck key, so the join to the manifest is exact. */
function ngFlowPosDeck(title, role) {
  const fam = String(title || "").replace(/\s+(Top|Bottom)\s*$/i, "").trim();
  return fam + (role === "bottom" ? "|Bottom" : "|Top");
}

/**
 * Expand one technique node into (p0, successBranch, missBranch).
 *
 * Branch membership is the AUTHORED label, so a technique whose whole success branch is a
 * chained hub cell keeps a success branch. Within a branch weights renormalise to 1.
 *
 * CHAINING follows the label, which is what the label means: a `success` chain is performed by
 * the ACTOR (their game-over is the actor winning); a `failure`/`counter` chain is performed by
 * the OPPONENT, so its game-over is the actor LOSING and its landing roles flip.
 */
function ngFlowAction(node, resolve, nodeAt) {
  const raw = [[], []];
  const outs = (node.cal && node.cal.outcomes) || [];
  for (let i = 0; i < outs.length; i++) {
    const o = outs[i], to = String(o.to || ""), res = o.result, prob = +o.probability || 0;
    const b = raw[res === "success" ? 0 : 1];
    if (to === "game-over") { b.push([prob, KW, null, false]); continue; }
    if (/\/(top|bottom)$/.test(to)) { b.push([prob, KS, to, res === "success"]); continue; }
    // hub target -> the chained technique's own outcomes, one level (selfcheck pins no second)
    const r = resolve(to);
    const ch = r && r.idx >= 0 ? nodeAt(r.idx) : null;
    const cOuts = (ch && ch.cal && ch.cal.outcomes) || null;
    if (!cOuts) continue;
    const byActor = res === "success";
    for (let j = 0; j < cOuts.length; j++) {
      const co = cOuts[j], cto = String(co.to || ""), w = prob * (+co.probability || 0) / 100;
      if (cto === "game-over") { b.push([w, byActor ? KW : KL, null, false]); continue; }
      b.push([w, KS, byActor ? cto : ngFlowFlip(cto), co.result === "success" && byActor]);
    }
  }
  const br = [];
  for (let k = 0; k < 2; k++) {
    let tot = 0;
    for (let i = 0; i < raw[k].length; i++) tot += raw[k][i][0];
    br.push(tot > 0 ? raw[k].map((c) => [c[0] / tot, c[1], c[2], c[3]]) : []);
  }
  const sr = node.cal && typeof node.cal.successRate === "number" ? node.cal.successRate : 0;
  return { p0: Math.max(0, Math.min(1, sr / 100)), succ: br[0], miss: br[1] };
}

/**
 * Build the 272-state kernel from the app's ingested payload.
 *
 * `_deriveDualPairs` files the SAME `cal.ev` block on BOTH pair members, so `app._ev` holds 544
 * entries for 272 hands. Iterating it directly would DOUBLE every state and still print
 * plausible numbers — the §6.6 shape exactly. Keying on `posId + "/" + role` collapses that,
 * and `build()` returns the coverage counts so a caller can hard-fail on zero rather than
 * quietly scoring nothing.
 */
export function ngFlowBuild(app, opts) {
  const nodes = app.nodes || [];
  const ev = app._ev;
  // the lambda block to read EDGE from: the user's own `lossAversion`, so FLOW's features and
  // the integers printed on their cards are priced off the same dial (measured: the dial does
  // not change the FLOW ordering, rho ~0.9998, but it changes the scale 2.4x).
  const lamIdx = (opts && opts.lamIdx != null) ? opts.lamIdx
    : (typeof app._evLamIdx === "function" ? Math.max(0, app._evLamIdx()) : 0);
  const nodeAt = (i) => nodes[i];
  const resolve = (t) => app.resolveOutcomeTo(t);
  const stateIdx = new Map();
  const states = [];
  const hands = [];
  const posDeck = [];
  const deckKeys = [];
  const deckIdx = new Map();
  const deckOf = (k) => {
    let i = deckIdx.get(k);
    if (i == null) { i = deckKeys.length; deckIdx.set(k, i); deckKeys.push(k); }
    return i;
  };
  const seenPair = new Set();
  const cov = { evKeys: 0, states: 0, dropped: 0, cells: 0, unresolved: 0 };

  if (!ev || !ev.size) return null;
  // PASS 1 — the state space, deduped across pair members, positions first so a position deck
  // is identifiable by index (deck < nPosDecks).
  const raw = [];
  for (const [key, m] of ev) {
    cov.evKeys++;
    const slash = key.lastIndexOf("/");
    const ni = parseInt(key.slice(0, slash), 10), role = key.slice(slash + 1);
    const n = nodes[ni];
    const pid = n && n.posId;
    if (!pid) { cov.dropped++; continue; }
    const sk = pid + "/" + role;
    if (seenPair.has(sk)) continue;
    seenPair.add(sk);
    raw.push([sk, role, n, m]);
  }
  raw.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (let i = 0; i < raw.length; i++) { stateIdx.set(raw[i][0], i); states.push(raw[i][0]); }
  cov.states = states.length;
  for (let i = 0; i < raw.length; i++) posDeck.push(deckOf(ngFlowPosDeck(raw[i][2].t, raw[i][1])));
  const nPosDecks = deckKeys.length;

  // PASS 2 — the hands. Attempt shares renormalise per state: graph.json is exact, but the wire
  // rounds to integers (measured 95..103 per state), and a kernel must be a stochastic matrix.
  for (let i = 0; i < raw.length; i++) {
    const m = raw[i][3];
    const hand = [];
    let tot = 0;
    for (const [ti, row] of m) {
      const tn = nodes[ti];
      if (!tn || tn.ty === "positions") continue;
      const a = ngFlowAction(tn, resolve, nodeAt);
      if (!a.succ.length && !a.miss.length) continue;
      const lamRow = (row.lam && row.lam[lamIdx]) || null;
      hand.push({ att: row.att || 0, p0: a.p0, succ: a.succ, miss: a.miss,
                  deck: deckOf(tn.t + "|Attacker"), name: tn.t,
                  ord: tn.o == null ? -1 : tn.o,            // the PERMANENT id the ledger keys on
                  e0: lamRow ? (lamRow[0] || 0) : 0,        // EDGE at rest — an L1 feature
                  sub: tn.ty === "submissions" ? 1 : 0 });
      tot += row.att || 0;
    }
    for (let k = 0; k < hand.length; k++) hand[k].att = tot > 0 ? hand[k].att / tot : 0;
    hands.push(hand);
  }

  // PASS 3 — resolve every continuation cell to a state index, once.
  const bind = (cells, mineFrame) => {
    const out = [];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      cov.cells++;
      if (c[1] !== KS) { out.push([c[0], c[1], -1, false]); continue; }
      const j = stateIdx.get(mineFrame ? c[2] : ngFlowFlip(c[2]));
      if (j == null) cov.unresolved++;
      out.push([c[0], KS, j == null ? -1 : j, c[3]]);
    }
    return out;
  };
  const mine = [], theirs = [];
  for (let i = 0; i < hands.length; i++) {
    mine.push(hands[i].map((a) => [bind(a.succ, true), bind(a.miss, true)]));
  }
  // the opponent's hand at MY state is the PAIRED role-node's hand, read in their frame
  const flipIdx = states.map((s) => {
    const j = stateIdx.get(ngFlowFlip(s));
    return j == null ? -1 : j;
  });
  for (let i = 0; i < hands.length; i++) {
    const f = flipIdx[i];
    theirs.push(f < 0 ? [] : hands[f].map((a) => [bind(a.succ, false), bind(a.miss, false)]));
  }

  // the ledger join: a recorded (posDeckKey, ordinal) has to find its action. Built here so no
  // consumer re-derives it — and counted, so "your ledger matched nothing" can never read the
  // same as "you have not rolled" (§6.6).
  const ordAt = hands.map((h) => { const m = new Map(); h.forEach((a, t) => { if (a.ord >= 0) m.set(a.ord, t); }); return m; });
  return { states: states, stateIdx: stateIdx, n: states.length, hands: hands, mine: mine,
           theirs: theirs, flipIdx: flipIdx, posDeck: posDeck, deckKeys: deckKeys,
           deckIdx: deckIdx, nPosDecks: nPosDecks, cov: cov, ordAt: ordAt, lamIdx: lamIdx,
           att: hands.map((h) => h.map((a) => a.att)) };
}

/**
 * `moveChance`'s player half: p + stateBonus(posKey) + stateBonus(techKey), clamped.
 *
 * `pYou` is the ledger's measured rate for this technique (ngFlowPersonal), shrunk toward the
 * authored one; absent, `p0` IS the authored rate. Reading it here rather than at the call
 * sites means the corpus model and the personal model are the same code path — cold start is a
 * continuous deformation, not a second implementation with a cliff between them.
 */
function ngFlowP(K, m, i, t) {
  const a = K.hands[i][t];
  const base = (K.usePersonal && typeof a.pYou === "number") ? a.pYou : a.p0;
  const raw = base + m[K.posDeck[i]] + (a.deck >= 0 ? m[a.deck] : 0);
  if (raw <= NG_FLOW_PLO) return [NG_FLOW_PLO, 0];
  if (raw >= NG_FLOW_PHI) return [NG_FLOW_PHI, 0];
  return [raw, 1];
}

/**
 * Policy evaluation. `solve_edge_values.solve()` with argmax replaced by pi — the initiative
 * asymmetry, the paired-role opponent and the free stay-put ply are the SHIPPED recursion,
 * because FLOW must price the game the app actually deals.
 *
 * The opponent always samples the AUTHORED distribution: their rates are not something you
 * drill, so no personal policy is applied on their turn.
 */
export function ngFlowBackward(K, m, lam, H, pi, keepAB) {
  const n = K.n, P = pi || K.att;
  let Vw = new Float64Array(n), Vl = new Float64Array(n);
  let Uw = new Float64Array(n), Ul = new Float64Array(n);
  const AB = keepAB ? [] : null;
  for (let ply = 1; ply <= H; ply++) {
    const pVw = Vw, pVl = Vl, pUw = Uw, pUl = Ul;
    // ---- THEIR turn: reads V[ply-1] only, so it is well founded before mine
    const nUw = new Float64Array(n), nUl = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const hand = K.theirs[i];
      if (!hand.length) continue;                 // optionless opponent = reset = a draw (0)
      const f = K.flipIdx[i], acts = K.hands[f];
      let w = 0, l = 0;
      for (let t = 0; t < hand.length; t++) {
        const a = acts[t];
        let aw = 0, al = 0;
        for (let b = 0; b < 2; b++) {
          const bw = b === 0 ? a.p0 : 1 - a.p0, cells = hand[t][b];
          if (bw <= 0 || !cells.length) continue;
          for (let c = 0; c < cells.length; c++) {
            const cell = cells[c], x = bw * cell[0];
            if (cell[1] === KW) al += x;          // THEY win -> I lose
            else if (cell[1] === KL) aw += x;
            else if (cell[2] >= 0) { aw += x * pVw[cell[2]]; al += x * pVl[cell[2]]; }
          }
        }
        w += a.att * aw; l += a.att * al;         // the opponent always SAMPLES
      }
      nUw[i] = w; nUl[i] = l;
    }
    Uw = nUw; Ul = nUl;
    // ---- MY turn: may read U[ply] at the SAME horizon (the free stay-put ply)
    const nVw = new Float64Array(n), nVl = new Float64Array(n);
    const abPly = keepAB ? [] : null;
    for (let i = 0; i < n; i++) {
      const hand = K.mine[i];
      let vw = 0, vl = 0;
      const abRow = keepAB ? [] : null;
      for (let t = 0; t < hand.length; t++) {
        const p = ngFlowP(K, m, i, t)[0];
        const bv = [];
        for (let b = 0; b < 2; b++) {
          const cells = hand[t][b];
          let bw = 0, bl = 0;
          for (let c = 0; c < cells.length; c++) {
            const cell = cells[c], j = cell[2];
            if (cell[1] === KW) bw += cell[0];
            else if (cell[1] === KL) bl += cell[0];
            else if (j >= 0) {
              if (cell[3]) { bw += cell[0] * pVw[j]; bl += cell[0] * pVl[j]; }        // keeps
              else if (j === i) { bw += cell[0] * Uw[j]; bl += cell[0] * Ul[j]; }     // 0 plies
              else { bw += cell[0] * pUw[j]; bl += cell[0] * pUl[j]; }
            }
          }
          bv.push([bw, bl]);
        }
        const aw = p * bv[0][0] + (1 - p) * bv[1][0];
        const al = p * bv[0][1] + (1 - p) * bv[1][1];
        vw += P[i][t] * aw; vl += P[i][t] * al;
        if (keepAB) abRow.push([bv[0][0] - lam * bv[0][1], bv[1][0] - lam * bv[1][1]]);
      }
      nVw[i] = vw; nVl[i] = vl;
      if (keepAB) abPly.push(abRow);
    }
    Vw = nVw; Vl = nVl;
    if (keepAB) AB.push(abPly);
  }
  return { Vw: Vw, Vl: Vl, Uw: Uw, Ul: Ul, AB: AB };
}

/** The number FLOW maximises: your expected p_win - lam*p_loss over a whole roll. */
export function ngFlowV0(K, m, lam, H, pi, d0) {
  const r = ngFlowBackward(K, m, lam, H, pi, false);
  let v = 0;
  for (let i = 0; i < K.n; i++) v += (d0 ? d0[i] : 1 / K.n) * (r.Vw[i] - lam * r.Vl[i]);
  return v;
}

/**
 * The adjoint: EVERY deck's derivative from one backward and one forward sweep, not one
 * re-solve per deck.
 *
 * `rho` is the forward OCCUPANCY — "how much of V0 flows through this state at this ply",
 * which is the owner's "big lakes in a river" as an exact quantity. Transposing the backward
 * recursion gives it, and each deck's derivative is then a dot product.
 *
 * SWEEP ORDER IS LOAD BEARING. rho_U[ply] receives from rho_V[ply] (the free stay-put ply, same
 * horizon) AND from rho_V[ply+1] (hand-over, the previous iteration), so rho_V at a ply must be
 * distributed BEFORE rho_U at that same ply is read.
 */
export function ngFlowAdjoint(K, m, lam, H, pi, d0) {
  const n = K.n, P = pi || K.att;
  const bk = ngFlowBackward(K, m, lam, H, P, true);
  let V0 = 0;
  const d = [];
  for (let i = 0; i < n; i++) { d.push(d0 ? d0[i] : 1 / n); V0 += d[i] * (bk.Vw[i] - lam * bk.Vl[i]); }
  const grad = new Float64Array(K.deckKeys.length);
  const rhoV = [], rhoU = [];
  for (let p = 0; p <= H; p++) { rhoV.push(new Float64Array(n)); rhoU.push(new Float64Array(n)); }
  for (let i = 0; i < n; i++) rhoV[H][i] = d[i];

  for (let ply = H; ply >= 1; ply--) {
    const ab = bk.AB[ply - 1], rv = rhoV[ply];
    // ---- 1. distribute rho_V[ply]
    for (let i = 0; i < n; i++) {
      const r = rv[i];
      if (r === 0) continue;
      const hand = K.mine[i], pd = K.posDeck[i];
      for (let t = 0; t < hand.length; t++) {
        const w = r * P[i][t];
        if (w === 0) continue;
        const pr = ngFlowP(K, m, i, t), p = pr[0];
        if (pr[1]) {
          const g = w * (ab[i][t][0] - ab[i][t][1]);
          grad[pd] += g;                                   // the position deck moves EVERY card
          const td = K.hands[i][t].deck;
          if (td >= 0) grad[td] += g;                      // the technique deck moves this one
        }
        for (let b = 0; b < 2; b++) {
          const bw = b === 0 ? p : 1 - p, cells = hand[t][b];
          if (bw <= 0 || !cells.length) continue;
          for (let c = 0; c < cells.length; c++) {
            const cell = cells[c], j = cell[2];
            if (cell[1] !== KS || j < 0) continue;          // W/L are terminal
            const x = w * bw * cell[0];
            if (cell[3]) rhoV[ply - 1][j] += x;
            else if (j === i) rhoU[ply][j] += x;            // 0 plies, same horizon
            else rhoU[ply - 1][j] += x;
          }
        }
      }
    }
    // ---- 2. rho_U[ply] is complete now; the opponent's turn only ever reads V[ply-1]
    const ru = rhoU[ply];
    for (let i = 0; i < n; i++) {
      const r = ru[i];
      if (r === 0) continue;
      const hand = K.theirs[i];
      if (!hand.length) continue;
      const acts = K.hands[K.flipIdx[i]];
      for (let t = 0; t < hand.length; t++) {
        const a = acts[t], w = r * a.att;
        if (w === 0) continue;
        for (let b = 0; b < 2; b++) {
          const bw = b === 0 ? a.p0 : 1 - a.p0, cells = hand[t][b];
          if (bw <= 0 || !cells.length) continue;
          for (let c = 0; c < cells.length; c++) {
            const cell = cells[c];
            if (cell[1] === KS && cell[2] >= 0) rhoV[ply - 1][cell[2]] += w * bw * cell[0];
          }
        }
      }
    }
  }
  return { grad: grad, V0: V0, rhoV: rhoV };
}

/**
 * The FINITE gain for one deck: V0 with it at the drill cap, minus V0 now.
 * The linearisation is only good to ~93-107%, which is enough to RANK but never enough to
 * publish a sign on — so the shown shortlist is re-solved exactly and the tail never shows one.
 */
export function ngFlowExactGain(K, m, deck, lam, H, pi, d0) {
  const base = ngFlowV0(K, m, lam, H, pi, d0);
  const m2 = Float64Array.from(m);
  m2[deck] = NG_FLOW_MCAP;
  return ngFlowV0(K, m2, lam, H, pi, d0) - base;
}

// ═══ PERSONALISATION ══════════════════════════════════════════════════════════════════════
//
// The measurement that decides the whole design: at 5.23 my-turn decisions per roll, a player
// with 50 rolls has ~261 decisions, and ZERO of the 1246 (state, move) cells reach n>=8. A
// per-cell empirical estimate is not a weak estimator, it has no data at all.
//
// But the STATES do. The 8 states that clear 8 visits at 50 rolls carry 43% of all traffic —
// the states with enough data are exactly the states that dominate the score. So estimate what
// the data can carry, shrink everything else to the authored prior, and PRINT the coverage.
//
// The shrinkage is the repo's own `folded_rate` (scripts/_votes.py):
//     folded = (prior*pseudo + observed*n) / (pseudo + n)
// at `pseudo_count = 8`, and the published reason for that constant applies unchanged
// (calibrate_probabilities.py): "Cap at 8 (< the 30-vote human seed) so ~8 real observations
// overturn the model prior."
//
// Four levels, each shrinking to the prior at n=0, so cold start is a CONTINUOUS deformation
// of the corpus model — not a second code path with a cliff between them.
export const NG_FLOW_PSEUDO = 8;

/** Newton step for the L1 tilt. Returns beta for pi(a|s) ∝ att(a|s)·exp(beta·x). */
function ngFlowFitTilt(K, counts, nfeat, feat, iters) {
  const beta = new Float64Array(nfeat);
  for (let it = 0; it < (iters || 12); it++) {
    const gr = new Float64Array(nfeat);
    const H = [];
    for (let f = 0; f < nfeat; f++) H.push(new Float64Array(nfeat));
    let moved = false;
    for (let i = 0; i < K.n; i++) {
      const row = counts[i];
      if (!row || !row.n) continue;
      const hand = K.hands[i], L = hand.length;
      if (L < 2) continue;
      moved = true;
      // pi ∝ att·exp(beta·x)
      const w = new Float64Array(L);
      let tot = 0;
      for (let t = 0; t < L; t++) {
        let z = 0;
        for (let f = 0; f < nfeat; f++) z += beta[f] * feat[i][t][f];
        w[t] = (hand[t].att || 0) * Math.exp(Math.max(-30, Math.min(30, z)));
        tot += w[t];
      }
      if (tot <= 0) continue;
      const xbar = new Float64Array(nfeat);
      for (let t = 0; t < L; t++) { const q = w[t] / tot; for (let f = 0; f < nfeat; f++) xbar[f] += q * feat[i][t][f]; }
      for (let t = 0; t < L; t++) {
        const nt = row.byT[t] || 0;
        if (nt) for (let f = 0; f < nfeat; f++) gr[f] += nt * (feat[i][t][f] - xbar[f]);
      }
      for (let t = 0; t < L; t++) {
        const q = w[t] / tot;
        for (let f = 0; f < nfeat; f++) {
          const df = feat[i][t][f] - xbar[f];
          for (let h = 0; h < nfeat; h++) H[f][h] += row.n * q * df * (feat[i][t][h] - xbar[h]);
        }
      }
    }
    if (!moved) break;
    // solve H·d = gr (H is the observed information; add a ridge so a flat direction cannot blow up)
    const A = [];
    for (let f = 0; f < nfeat; f++) { A.push([...H[f]]); A[f][f] += 1e-6 + 0.5; A[f].push(gr[f]); }
    for (let c = 0; c < nfeat; c++) {
      let piv = c;
      for (let r = c + 1; r < nfeat; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      const tmp = A[c]; A[c] = A[piv]; A[piv] = tmp;
      if (Math.abs(A[c][c]) < 1e-12) continue;
      for (let r = 0; r < nfeat; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k <= nfeat; k++) A[r][k] -= f * A[c][k];
      }
    }
    let step = 0;
    for (let f = 0; f < nfeat; f++) {
      const d = Math.abs(A[f][f]) < 1e-12 ? 0 : A[f][nfeat] / A[f][f];
      const clipped = Math.max(-1, Math.min(1, d));           // trust region: a Newton step on
      beta[f] += clipped;                                     // sparse counts can overshoot wildly
      step += Math.abs(clipped);
    }
    if (step < 1e-6) break;
  }
  return beta;
}

/**
 * Turn the roll ledger into (pi_you, p0_you) plus the coverage figures that must be printed.
 *
 * `counts` is `app.flowCounts()` — {posDeckKey: {ordinal: [attempts, successes]}}.
 * Returns null when the ledger is empty, so the caller keeps the corpus model rather than
 * quietly scoring against a table of zeros.
 */
export function ngFlowPersonal(K, counts, opts) {
  const c = (opts && opts.pseudo) || NG_FLOW_PSEUDO;
  const rows = [];                       // per state: {n, byT:[], kByT:[]}
  let totN = 0, totK = 0, totP0 = 0, matched = 0, unmatched = 0, statesSeen = 0;
  for (let i = 0; i < K.n; i++) rows.push(null);
  for (let i = 0; i < K.n; i++) {
    const led = counts[K.deckKeys[K.posDeck[i]]];
    if (!led) continue;
    const hand = K.hands[i], byT = new Float64Array(hand.length), kByT = new Float64Array(hand.length);
    let n = 0;
    for (const ord in led) {
      const t = K.ordAt[i].get(+ord);
      if (t == null) { unmatched += led[ord][0]; continue; }
      matched += led[ord][0];
      byT[t] += led[ord][0]; kByT[t] += led[ord][1];
      n += led[ord][0];
      totN += led[ord][0]; totK += led[ord][1]; totP0 += led[ord][0] * hand[t].p0;
    }
    if (n > 0) { rows[i] = { n: n, byT: byT, kByT: kByT }; statesSeen++; }
  }
  if (!totN) return null;

  // ── L0: one global execution offset. Live from roll ~2 — the honest measurement of the
  //        thing `aiSkill` and `stateBonus` currently only PRESCRIBE.
  const expected = totP0 / totN;
  const d0 = (totK + c * expected) / (totN + c) - expected;

  // ── L1: the choice tilt. pi ∝ att·exp(b1·EDGE + b2·isSubmission). `b1 > 0` says you reach
  //        for what the card says is good; a positive submission term says you hunt finishes.
  //        Fitted over EVERY decision at once (3 parameters, ~130-260 observations at 25 rolls),
  //        which is why it is estimable when no single cell is.
  const feat = [];
  for (let i = 0; i < K.n; i++) {
    const h = K.hands[i], f = [];
    for (let t = 0; t < h.length; t++) f.push([h[t].e0 / 50, h[t].sub]);
    feat.push(f);
  }
  const beta = ngFlowFitTilt(K, rows, 2, feat, 12);

  // ── L2: per-state Dirichlet on top of the tilted prior, only where counts allow.
  const pi = [];
  let refined = 0;
  for (let i = 0; i < K.n; i++) {
    const h = K.hands[i], L = h.length, out = new Float64Array(L);
    let tot = 0;
    for (let t = 0; t < L; t++) {
      const z = beta[0] * feat[i][t][0] + beta[1] * feat[i][t][1];
      out[t] = (h[t].att || 0) * Math.exp(Math.max(-30, Math.min(30, z)));
      tot += out[t];
    }
    for (let t = 0; t < L; t++) out[t] = tot > 0 ? out[t] / tot : (L ? 1 / L : 0);
    const row = rows[i];
    if (row && row.n) {
      if (row.n >= c) refined++;
      for (let t = 0; t < L; t++) out[t] = (row.byT[t] + c * out[t]) / (row.n + c);
    }
    pi.push(out);
  }

  // ── L3: per-TECHNIQUE execution rate, pooled across every state that offers it (a technique
  //        seen 3 times from two states has 6 observations, not two of three). Falls back to
  //        p0 + d0, so a never-attempted move still carries what your play says about you.
  const deckN = new Float64Array(K.deckKeys.length), deckK = new Float64Array(K.deckKeys.length);
  const deckP = new Float64Array(K.deckKeys.length);
  for (let i = 0; i < K.n; i++) {
    const row = rows[i];
    if (!row) continue;
    const h = K.hands[i];
    for (let t = 0; t < h.length; t++) {
      if (!row.byT[t] || h[t].deck < 0) continue;
      deckN[h[t].deck] += row.byT[t]; deckK[h[t].deck] += row.kByT[t];
      deckP[h[t].deck] += row.byT[t] * h[t].p0;
    }
  }
  let pShift = 0;
  for (let i = 0; i < K.n; i++) {
    const h = K.hands[i];
    for (let t = 0; t < h.length; t++) {
      const d = h[t].deck;
      let shift = d0;
      if (d >= 0 && deckN[d] > 0) {
        const exp = deckP[d] / deckN[d];
        shift = (deckK[d] + c * exp) / (deckN[d] + c) - exp;
        pShift++;
      }
      h[t].pYou = Math.max(NG_FLOW_PLO, Math.min(NG_FLOW_PHI, h[t].p0 + shift));
    }
  }
  return {
    pi: pi, delta0: d0, beta: [beta[0], beta[1]],
    cov: { decisions: totN, matched: matched, unmatched: unmatched, states: statesSeen,
           refined: refined, techniques: pShift, pseudo: c },
  };
}

// ═══ THE SCORE THE APP READS ══════════════════════════════════════════════════════════════
//
// Ordinal buckets over a CONTINUOUS score, which is what the owner asked for and what no
// membership rule can give. The cuts are cumulative shares of a FIXED denominator:
//
//     R0 = sum of max(0, GAIN) at m == 0     — a constant of (graph, lambda, horizon)
//
// MEASURED, AND IT OVERTURNED THE DESIGN THIS SHIPPED WITH. A FIXED R0 (the blank-profile total)
// was supposed to make the tiers empty as you drilled. It does the opposite: mastering the top 3
// decks took the called-out count from 37 to 94, the top 11 to 236, the top 37 to 570.
//
// That is not a bug, it is a real property of the model. GAIN is not decreasing in your overall
// mastery — a better game reaches more states and survives longer, so every REMAINING deck
// becomes worth more (V0 measured 0.079 -> 0.385 over those same steps). Total recoverable value
// GROWS as you improve, and a fixed denominator cannot bound a growing numerator.
//
// So the denominator is the CURRENT total. A tier then means "the decks carrying the first 10% of
// what is recoverable to you RIGHT NOW", which is stable at every mastery level, and a mastered
// deck still scores exactly 0 and leaves the list. The tiers are labels on a study queue, not a
// gap counter — the number the stat row shows is a DOSE (dailyGoal minus what maintenance owes),
// which is the owner's own rule and does not depend on these cuts at all.
export const NG_FLOW_CUTS = [0.10, 0.25, 0.40];
export const NG_FLOW_TIERS = ["leaking", "loose", "polish"];

/**
 * GAIN, linearised: the gradient times the headroom you actually have LEFT on this deck.
 *
 * The gradient is a SLOPE, so it does not know a deck is already at the cap — without the
 * headroom factor a fully-mastered deck keeps its rank forever (measured: `Side Control|Top`
 * stayed #1 after being mastered, which is the exact "already proven reads as still weakest"
 * failure this feature exists to remove). At the cap the headroom is 0, the deck scores 0, and
 * it leaves the list — the same way `ngFlowExactGain` returns 0 for it.
 */
function ngFlowLin(grad, m, k) { return grad[k] * Math.max(0, NG_FLOW_MCAP - m[k]); }

/** Total recoverable value AT YOUR CURRENT MASTERY — the tier denominator. See the note above. */
function ngFlowRecoverable(grad, m) {
  let r = 0;
  for (let i = 0; i < grad.length; i++) { const g = ngFlowLin(grad, m, i); if (g > 0) r += g; }
  return r;
}

/**
 * The whole score, in one call.
 *
 * `m` is the user's real drill state (mastery per deck), so this is ALREADY personal on day one
 * even with an empty ledger — which is why there is no separate cold-start path.
 *
 * Ranks with the adjoint (~50ms, all 1500 decks) and then re-solves the shown shortlist EXACTLY,
 * because the linearisation only recovers ~93-107% of the true change: good enough to order,
 * never good enough to publish a SIGN on. Nothing outside the shortlist is ever shown a sign.
 */
export function ngFlowScore(app, opts) {
  const o = opts || {};
  const K = o.kernel || ngFlowBuild(app, o);
  if (!K || !K.n) return null;
  const lam = o.lam != null ? o.lam : 2;
  const H = o.H || NG_FLOW_H;
  const shortlist = o.shortlist || 40;

  // the ledger, if there is one. Never a silent fallback: `personal` is null and says so.
  let personal = null;
  if (o.counts && typeof o.counts === "object") {
    personal = ngFlowPersonal(K, o.counts, o);
    K.usePersonal = !!personal;
  }
  const pi = personal ? personal.pi : K.att;

  // the user's drill state, in the app's own units
  const m = new Float64Array(K.deckKeys.length);
  const mastery = o.mastery;
  if (typeof mastery === "function") {
    for (let i = 0; i < K.deckKeys.length; i++) m[i] = Math.max(0, Math.min(NG_FLOW_MCAP, mastery(K.deckKeys[i]) || 0));
  }

  const run = ngFlowAdjoint(K, m, lam, H, pi, null);
  const order = [];
  for (let i = 0; i < K.deckKeys.length; i++) order.push(i);
  order.sort((a, b) => ngFlowLin(run.grad, m, b) - ngFlowLin(run.grad, m, a));

  const R0 = ngFlowRecoverable(run.grad, m);
  const out = [];
  let cum = 0;
  for (let r = 0; r < order.length; r++) {
    const k = order[r];
    const lin = ngFlowLin(run.grad, m, k);
    if (lin <= 0) break;                                  // tiers hold POSITIVE gain only
    const exact = r < shortlist ? ngFlowExactGain(K, m, k, lam, H, pi, null) : null;
    const gain = exact != null ? exact : lin;
    cum += gain;
    const share = R0 > 0 ? cum / R0 : 1;
    let tier = null;
    for (let c = 0; c < NG_FLOW_CUTS.length; c++) if (share <= NG_FLOW_CUTS[c]) { tier = NG_FLOW_TIERS[c]; break; }
    if (tier == null && r >= shortlist) break;            // past the last cut: stop paying for it
    out.push({ deck: K.deckKeys[k], gain: gain, lin: lin, exact: exact != null,
               tier: tier, share: R0 > 0 ? gain / R0 : 0, pos: k < K.nPosDecks });
  }

  // BACKFIRING is a CLASS, never a tier, and only ever from an exact re-solve — a sign taken
  // from the linearisation is the single worst thing this could get wrong.
  const back = [];
  for (let r = order.length - 1; r >= 0; r--) {
    const k = order[r];
    if (ngFlowLin(run.grad, m, k) >= 0) break;
    if (back.length >= 12) break;
    const g = ngFlowExactGain(K, m, k, lam, H, pi, null);
    if (g < 0) back.push({ deck: K.deckKeys[k], gain: g, pos: k < K.nPosDecks });
  }
  back.sort((a, b) => a.gain - b.gain);

  return {
    v0: run.V0, r0: R0, lam: lam, H: H, kernel: K, ranked: out, backfiring: back,
    personal: personal,
    // the positive coverage count every FLOW surface must be able to print (§6.6)
    cov: Object.assign({ decks: K.deckKeys.length, ranked: out.length,
                         shortlist: Math.min(shortlist, out.length) }, K.cov,
                       personal ? personal.cov : { decisions: 0 }),
  };
}
