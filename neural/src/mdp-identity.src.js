/* Tiny shared main-thread/worker identity seam. No graph, solver, profile, or DOM. */
var NG_MDP_API_VERSION = 2;
var NG_MDP_OBJECTIVE = 'max-win/min-loss/min-nontermination';
var ngMdpShaInitial = null,ngMdpShaConstants = null;
function ngMdpStable(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('nonfinite-identity');
    if (value === undefined) throw new Error('undefined-identity');
    return JSON.stringify(value);
  }
  // Loops, not map/join (WINLAT1): the same text, ~20% faster on the solver's keys. A hole in a sparse
  // array prints as nothing, exactly as map/join printed it.
  if (Array.isArray(value)) {
    let out = '[';
    for (let i = 0; i < value.length; i++) { if (i) out += ','; if (i in value) out += ngMdpStable(value[i]); }
    return out + ']';
  }
  const keys = Object.keys(value).sort(); let out = '{';
  for (let i = 0; i < keys.length; i++) { if (i) out += ','; out += JSON.stringify(keys[i]) + ':' + ngMdpStable(value[keys[i]]); }
  return out + '}';
}
// SHA-256 over canonical UTF-8; compact identities never echo the graph per card.
// Known-answer tests compare this synchronous worker/browser implementation with
// node:crypto, including Unicode and multiple compression blocks.
// THE SAME DIGEST, ABOUT 2.7x FASTER (WINLAT1, 2026-10-05): the support identity hashes every state of
// a solve, ~30 MB per in-session hand, and this function was 9% of the worker's time. The rounds now
// run on locals and one reused word array, with no per-block destructuring or DataView reads. Same
// algorithm and constants, so the same hex for every input (tests/mdp_model.test.mjs, node:crypto).
var ngMdpShaWords = null;
function ngMdpDigest(value) {
  const input = typeof value === 'string' ? value : ngMdpStable(value);
  const bytes = new TextEncoder().encode(input), length = bytes.length, size = Math.ceil((length + 9) / 64) * 64;
  const data = new Uint8Array(size); data.set(bytes); data[length] = 128;
  const view = new DataView(data.buffer); const bits = length * 8;
  view.setUint32(size - 8, Math.floor(bits / 4294967296)); view.setUint32(size - 4, bits >>> 0);
  if (!ngMdpShaInitial) {
    const primes = [], initial = [], constants = new Int32Array(64);
    for (let n = 2; primes.length < 64; n++) {
      if (primes.some(p => p * p <= n && n % p === 0)) continue;
      constants[primes.length] = (Math.cbrt(n) % 1 * 4294967296) | 0;
      primes.push(n); if (initial.length < 8) initial.push((Math.sqrt(n) % 1 * 4294967296) | 0);
    }
    ngMdpShaInitial = initial; ngMdpShaConstants = constants; ngMdpShaWords = new Int32Array(64);
  }
  const k = ngMdpShaConstants, w = ngMdpShaWords;
  let h0 = ngMdpShaInitial[0], h1 = ngMdpShaInitial[1], h2 = ngMdpShaInitial[2], h3 = ngMdpShaInitial[3];
  let h4 = ngMdpShaInitial[4], h5 = ngMdpShaInitial[5], h6 = ngMdpShaInitial[6], h7 = ngMdpShaInitial[7];
  for (let offset = 0; offset < size; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] = (data[j] << 24) | (data[j + 1] << 16) | (data[j + 2] << 8) | data[j + 3];
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      w[i] = (w[i - 16] + (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) + w[i - 7]
        + (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10))) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + k[i] + w[i]) | 0;
      const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + hh) | 0;
  }
  let out = '';
  for (const x of [h0, h1, h2, h3, h4, h5, h6, h7]) out += (x >>> 0).toString(16).padStart(8, '0');
  return out;
}
function ngMdpContractHash(request) {
  const keys = ['modelHash', 'mechanicsHash', 'graphHash', 'profileHash', 'opponentPolicyHash',
    'ruleset', 'objective', 'horizon', 'futureStudyPolicy', 'state'];
  const identity = { apiVersion: NG_MDP_API_VERSION };
  for (const key of keys) identity[key] = request[key];
  return 'mdp2:' + ngMdpDigest(identity);
}
// The text of ngMdpStable([stateId, techniqueId, kind, destination, context]), with the state's part
// spelled once per state instead of once per action (WINLAT1): a state's actions share one long
// stateId, and escaping it again for each of them was a measurable share of an expansion.
var ngMdpActionState = null, ngMdpActionStateText = null;
function ngMdpActionId(stateId, techniqueId, kind, destinationId, branchContext) {
  if (!stateId || !techniqueId || !['entry', 'finish', 'transition', 'escape', 'forced'].includes(kind))
    throw new Error('invalid-action-identity');
  if (stateId !== ngMdpActionState) { ngMdpActionStateText = ngMdpStable(stateId); ngMdpActionState = stateId; }
  return '[' + ngMdpActionStateText + ',' + ngMdpStable(techniqueId) + ',' + ngMdpStable(kind) + ','
    + (destinationId == null ? 'null' : ngMdpStable(destinationId)) + ',' + (branchContext == null ? 'null' : ngMdpStable(branchContext)) + ']';
}
function ngMdpStateId(snapshot) { return ngMdpStable(snapshot); }

// Root capture only: caller already uses live canonicalState/current authored ID.
// Current profile has already decayed, so the new forecast's arrivalAge is zero.
function ngMdpNormalizeRootSnapshot(input, horizon) {
  if (!input || !input.nodeId || !['top','bottom'].includes(input.role) || input.phase !== 'user') throw new Error('requires-context');
  if (!horizon || !['actual-roll','eventual'].includes(horizon.kind)) throw new Error('invalid-horizon');
  if (!Number.isSafeInteger(input.moveCount) || input.moveCount < 0 || !Number.isFinite(input.qMod) || !Number.isSafeInteger(input.combo) || input.combo < 0) throw new Error('invalid-root-context');
  if (horizon.kind === 'actual-roll' && (input.moveCount !== horizon.moveCount || !Number.isSafeInteger(horizon.episodeCap) || horizon.episodeCap <= 0)) throw new Error('stale-root-move-count');
  return { nodeId: input.nodeId, role: input.role, phase: 'user', moveCount: horizon.kind === 'eventual' ? 0 : Math.min(input.moveCount,horizon.episodeCap), arrivalAge: 0,
    qMod: input.qMod, combo: input.combo, positionKey: input.positionKey || null, panicKey: input.panicKey || null };
}
function ngMdpDefenseId(response, detail) {
  const content = { ...response, detail: detail == null ? null : detail };
  delete content.contentHash; delete content.defenseId;
  return 'defense:' + ngMdpDigest(content);
}

function ngMdpEnvelope(request) {
  const response = { apiVersion: 2, requestId: request.requestId, revision: request.revision };
  for (const key of ['modelHash', 'mechanicsHash', 'graphHash', 'profileHash', 'opponentPolicyHash', 'ruleset', 'objective', 'horizon', 'futureStudyPolicy']) response[key] = request[key];
  try { response.contractHash = ngMdpContractHash(request); } catch (_) { response.contractHash = null; }
  return response;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { NG_MDP_API_VERSION, NG_MDP_OBJECTIVE, ngMdpStable, ngMdpDigest, ngMdpContractHash, ngMdpActionId, ngMdpStateId, ngMdpNormalizeRootSnapshot, ngMdpDefenseId, ngMdpEnvelope };
