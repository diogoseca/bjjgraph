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
  if (Array.isArray(value)) return '[' + value.map(ngMdpStable).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + ngMdpStable(value[k])).join(',') + '}';
}
// SHA-256 over canonical UTF-8; compact identities never echo the graph per card.
// Known-answer tests compare this synchronous worker/browser implementation with
// node:crypto, including Unicode and multiple compression blocks.
function ngMdpDigest(value) {
  const input = typeof value === 'string' ? value : ngMdpStable(value);
  const bytes = new TextEncoder().encode(input), size = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(size); data.set(bytes); data[bytes.length] = 128;
  const view = new DataView(data.buffer); const bits = bytes.length * 8;
  view.setUint32(size - 8, Math.floor(bits / 4294967296)); view.setUint32(size - 4, bits >>> 0);
  if(!ngMdpShaInitial){
    const primes=[],initial=[],constants=[];
    for (let n = 2; primes.length < 64; n++) {
      if (primes.some(p => p * p <= n && n % p === 0)) continue;
      primes.push(n); if (initial.length < 8) initial.push((Math.sqrt(n) % 1 * 4294967296) | 0);
      constants.push((Math.cbrt(n) % 1 * 4294967296) | 0);
    }
    ngMdpShaInitial=initial;ngMdpShaConstants=constants;
  }
  const h = ngMdpShaInitial.slice(),constants=ngMdpShaConstants, w = new Int32Array(64), rotate = (x, n) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < size; offset += 64) {
    for (let i = 0; i < 64; i++) {
      if (i < 16) w[i] = view.getInt32(offset + i * 4);
      else { const x = w[i - 15], y = w[i - 2]; w[i] = (w[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) + w[i - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10))) | 0; }
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + constants[i] + w[i]) | 0;
      const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    for (const [i, v] of [a, b, c, d, e, f, g, hh].entries()) h[i] = (h[i] + v) | 0;
  }
  return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
function ngMdpContractHash(request) {
  const keys = ['modelHash', 'mechanicsHash', 'graphHash', 'profileHash', 'opponentPolicyHash',
    'ruleset', 'objective', 'horizon', 'futureStudyPolicy', 'state'];
  const identity = { apiVersion: NG_MDP_API_VERSION };
  for (const key of keys) identity[key] = request[key];
  return 'mdp2:' + ngMdpDigest(identity);
}
function ngMdpActionId(stateId, techniqueId, kind, destinationId, branchContext) {
  if (!stateId || !techniqueId || !['entry', 'finish', 'transition', 'escape', 'forced'].includes(kind))
    throw new Error('invalid-action-identity');
  return ngMdpStable([stateId, techniqueId, kind, destinationId == null ? null : destinationId,
    branchContext == null ? null : branchContext]);
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
