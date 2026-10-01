/* WORKER ONLY. Verified mdp-columns-v1 decoder, cached deferred metadata loader,
 * bounded root identity projection, and native worker buildModel callbacks.
 * No boot installation. Root injects exact emitted asset/law identities.
 */
function ngGameValueDataError(reason) { throw new Error(reason); }
// ms before each retry of a transient metadata fetch failure: 4 attempts, ~4.3 s at most, far inside
// the client's 30 s root-description deadline (see `bytes` in ngGameValueCreateWorkerHost)
const NG_GAME_VALUE_FETCH_BACKOFF_MS = [300, 1000, 3000];
function ngGameValueDataFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) ngGameValueDataFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function ngGameValueDataPut(map, key, value) {
  if (Object.prototype.hasOwnProperty.call(map, key)) ngGameValueDataError('duplicate-metadata-key');
  Object.defineProperty(map, key, { value, enumerable: true });
}
function ngGameValueDecode(records, rootIndex, codec = 'mdp-columns-v1') {
  if (codec !== 'mdp-columns-v1' || !Array.isArray(records) || !records.length) ngGameValueDataError('invalid-metadata-codec');
  const expanded = [];
  const ref = (index, before = expanded.length) => {
    if (!Number.isSafeInteger(index) || index < 0 || index >= before) ngGameValueDataError('invalid-metadata-reference');
    return expanded[index];
  };
  for (const record of records) {
    if (Array.isArray(record)) expanded.push(record.map(index => ref(index)));
    else if (record && typeof record === 'object') {
      const out = Object.create(null);
      for (const [key, value] of Object.entries(record)) {
        if (!/^(0|[1-9][0-9]*)$/.test(key)) ngGameValueDataError('invalid-metadata-property-reference');
        const name = ref(Number(key));
        if (typeof name !== 'string') ngGameValueDataError('invalid-metadata-property-name');
        ngGameValueDataPut(out, name, ref(value));
      }
      expanded.push(out);
    } else {
      if (typeof record === 'number' && (!Number.isFinite(record) || Number.isInteger(record) && !Number.isSafeInteger(record)))
        ngGameValueDataError('invalid-metadata-number');
      if (record !== null && !['string', 'number', 'boolean'].includes(typeof record)) ngGameValueDataError('invalid-metadata-primitive');
      expanded.push(record);
    }
  }
  if (rootIndex !== expanded.length - 1) ngGameValueDataError('invalid-metadata-root');
  const packed = ref(rootIndex);
  const nodeColumns = ['id', 't', 'ty', 'role', 'fromRole', 'pairId', 'submissionId', 'posId',
    'fromPositionId', 's', 'dom', 'allowed', 'cal', 'deckKey', 'fallbackRole', 'poolName'];
  const optionColumns = ['techniqueId', 'destinationId', 'destinationRole', 'kind', 'defense', 'relaxed', 'ev', 'defenseId'];
  if (!packed || !packed.header || !Array.isArray(packed.nodes) || !packed.nodes.length) ngGameValueDataError('invalid-metadata-columns');
  const nodeId = index => {
    if (index === null) return null;
    if (!Number.isSafeInteger(index) || index < 0 || index >= packed.nodes.length) ngGameValueDataError('invalid-metadata-node-reference');
    return packed.nodes[index][0];
  };
  const tuple = (row, columns, min = columns.length) => {
    if (!Array.isArray(row) || row.length < min || row.length > columns.length) ngGameValueDataError('invalid-metadata-tuple');
    const out = Object.create(null);
    row.forEach((value, index) => ngGameValueDataPut(out, columns[index], value));
    return out;
  };
  const ids = new Set();
  const nodes = packed.nodes.map(row => {
    const n = tuple(row, nodeColumns);
    if (typeof n.id !== 'string' || !n.id || ids.has(n.id)) ngGameValueDataError('invalid-metadata-node-id');
    ids.add(n.id);
    return { ...n, pairId: nodeId(n.pairId), submissionId: nodeId(n.submissionId) };
  });
  const hands = Object.create(null), canonical = Object.create(null), destinations = Object.create(null), evHands = Object.create(null);
  const key = (index, role) => {
    if (!['top', 'bottom'].includes(role)) ngGameValueDataError('invalid-metadata-role');
    return JSON.stringify([nodeId(index), role]);
  };
  for (let index = 0; index < nodes.length; index++) for (const role of ['top', 'bottom']) canonical[key(index, role)] = nodes[index].id;
  for (const row of packed.hands || []) {
    if (!Array.isArray(row) || row.length !== 3 || !Array.isArray(row[2])) ngGameValueDataError('invalid-metadata-hand');
    const options = row[2].map(values => {
      const a = tuple(values, optionColumns, 7);
      return { ...a, techniqueId: nodeId(a.techniqueId), destinationId: nodeId(a.destinationId) };
    });
    ngGameValueDataPut(hands, key(row[0], row[1]), options);
  }
  const overrides = new Set();
  for (const row of packed.canonical || []) {
    if (!Array.isArray(row) || row.length !== 3) ngGameValueDataError('invalid-canonical-row');
    const k = key(row[0], row[1]);
    if (overrides.has(k)) ngGameValueDataError('duplicate-canonical-row');
    overrides.add(k); canonical[k] = nodeId(row[2]);
  }
  for (const row of packed.destinations || []) {
    if (!Array.isArray(row) || row.length !== 4 || typeof row[0] !== 'string' || typeof row[3] !== 'boolean') ngGameValueDataError('invalid-destination-row');
    ngGameValueDataPut(destinations, row[0], { nodeId: nodeId(row[1]), role: row[2], terminal: row[3] });
  }
  for (const row of packed.evHands || []) {
    if (!Array.isArray(row) || row.length !== 3 || !Array.isArray(row[2])) ngGameValueDataError('invalid-ev-hand');
    ngGameValueDataPut(evHands, key(row[0], row[1]), row[2].map(values => {
      if (!Array.isArray(values) || values.length !== 3) ngGameValueDataError('invalid-ev-row');
      return { techniqueId: nodeId(values[0]), att: values[1], c1: values[2] };
    }));
  }
  const metadata = { ...packed.header, nodes, hands, canonical, destinations, evHands };
  if (metadata.version !== 1 || metadata.coverage?.status !== 'COMPLETE' || !Object.keys(hands).length) ngGameValueDataError('incomplete-mechanics-metadata');
  return ngGameValueDataFreeze(metadata);
}
function ngGameValueCreateWorkerHost(deps) {
  const M = deps.mdp, K = deps.knowledge, expected = deps.expected;
  const fetcher = deps.fetch || globalThis.fetch.bind(globalThis);
  const digest = deps.sha256 || (async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join(''));
  const cache = new Map(), decoder = new TextDecoder('utf-8', { fatal: true });
  const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  if (!expected || !['manifestHash', 'graphHash', 'modelHash', 'opponentPolicyHash'].every(k => sha(expected[k]))
    || !Number.isSafeInteger(expected.manifestBytes) || expected.manifestBytes <= 0 || expected.manifestBytes > 40000
    || !expected.lawHashes || !['adapter', 'model', 'knowledge', 'identity', 'certified'].every(k => sha(expected.lawHashes[k])))
    ngGameValueDataError('missing-worker-build-identities');
  // ONE DROPPED REQUEST MUST NOT COST WIN CHANCE FOR THE SESSION (FGRETRY1, 2026-10-01). Before this,
  // one failed fetch of any metadata file failed the root description, and the runtime HOLDS a failed
  // prepare until the player presses Retry. Found by reproduction, not on a phone: a corpus hydration
  // overlapping this load (~2,900 deck fetches in flight) made Chromium refuse the worker's part
  // fetches with net::ERR_INSUFFICIENT_RESOURCES, because the renderer's request budget is shared,
  // and Win chance ended for the session in 9 of 15 runs. A dropped mobile request is the same class.
  // So a TRANSIENT failure is retried, bounded, after each NG_GAME_VALUE_FETCH_BACKOFF_MS delay.
  // Transient means one of two things:
  //   - the request got no answer (a network error, which is all `fetch` reports of either cause);
  //   - the server answered "try again" (408, 429, 5xx).
  // An ANSWER is never retried. A 404 is permanent, and a size or digest mismatch is an integrity
  // failure that a second copy of the same URL cannot fix. When retries run out, the failure keeps
  // its own class (`metadata-network-failed`, `metadata-fetch-failed`), and the provider passes that
  // reason on unmasked.
  const backoff = deps.fetchBackoff || NG_GAME_VALUE_FETCH_BACKOFF_MS;
  const sleep = deps.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const transient = reason => Object.assign(new Error(reason), { transient: true });
  // only the network operations themselves are wrapped: a bug's TypeError is never "transient"
  const net = promise => Promise.resolve(promise).then(null, () => { throw transient('metadata-network-failed'); });
  async function bytes(url, hash, rawBytes, maxBytes = 40000) {
    if (!sha(hash) || !Number.isSafeInteger(rawBytes) || rawBytes <= 0 || rawBytes > maxBytes) ngGameValueDataError('invalid-asset-receipt');
    for (let attempt = 0; ; attempt++) {
      try { return await verifiedBytes(url, hash, rawBytes, maxBytes); }
      catch (error) {
        if (!error.transient) throw error;
        if (attempt >= backoff.length) ngGameValueDataError(error.message);
        await sleep(backoff[attempt]);
      }
    }
  }
  async function verifiedBytes(url, hash, rawBytes, maxBytes) {
    const response = await net(fetcher(url));
    if (!response.ok) {
      if (response.status === 408 || response.status === 429 || response.status >= 500) throw transient('metadata-fetch-failed');
      ngGameValueDataError('metadata-fetch-failed');
    }
    const chunks = []; let length = 0;
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      try {
        for (;;) {
          const part = await net(reader.read()); if (part.done) break;
          length += part.value.length;
          if (length > rawBytes || length > maxBytes) { await reader.cancel(); ngGameValueDataError('metadata-size-mismatch'); }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
    } else { const part = new Uint8Array(await net(response.arrayBuffer())); chunks.push(part); length = part.length; }
    if (length !== rawBytes) ngGameValueDataError('metadata-size-mismatch');
    const result = new Uint8Array(length); let offset = 0;
    for (const part of chunks) { result.set(part, offset); offset += part.length; }
    if (await digest(result) !== hash) ngGameValueDataError('metadata-digest-mismatch');
    return result;
  }
  const namedURL = (base, file, kind) => {
    if (!(new RegExp('^' + kind + '-[a-f0-9]{64}\\.' + (kind === 'part' ? 'txt' : 'json') + '$')).test(file)) ngGameValueDataError('invalid-metadata-filename');
    return new URL(file, base).href;
  };
  async function load(reg) {
    if (reg.manifestHash !== expected.manifestHash || reg.manifestBytes !== expected.manifestBytes
      || reg.graphHash !== expected.graphHash || reg.modelHash !== expected.modelHash
      || reg.opponentPolicyHash !== expected.opponentPolicyHash) ngGameValueDataError('stale-worker-build');
    for (const [name, hash] of Object.entries(expected.lawHashes)) if (!sha(hash)) ngGameValueDataError('invalid-expected-law-hash:' + name);
    const key = deps.registrationKey(reg, M.ngMdpStable);
    if (cache.has(key)) return cache.get(key);
    const pending = (async () => {
      const manifest = JSON.parse(decoder.decode(await bytes(reg.manifestUrl, reg.manifestHash, reg.manifestBytes)));
      if (manifest.version !== 1 || manifest.codec !== 'mdp-columns-v1' || manifest.status !== 'COMPLETE'
        || manifest.provenance?.graphHash !== expected.graphHash || manifest.provenance?.modelHash !== expected.modelHash) ngGameValueDataError('invalid-metadata-manifest');
      if (M.ngMdpStable(Object.keys(manifest.provenance.lawHashes || {}).sort()) !== M.ngMdpStable(Object.keys(expected.lawHashes).sort()))
        ngGameValueDataError('metadata-law-key-mismatch');
      for (const [name, hash] of Object.entries(expected.lawHashes)) if (manifest.provenance.lawHashes?.[name] !== hash) ngGameValueDataError('stale-metadata-law:' + name);
      if (!Array.isArray(manifest.variants)) ngGameValueDataError('invalid-metadata-variants');
      const choices = manifest.variants.filter(v => v.ruleset === reg.ruleset && v.lossAversion === reg.lossAversion);
      if (choices.length !== 1) ngGameValueDataError('ambiguous-metadata-variant');
      const variant = choices[0];
      if (variant.status !== 'COMPLETE' || variant.mechanicsHash !== reg.mechanicsHash || variant.sha256 !== reg.metadataHash) ngGameValueDataError('stale-metadata-variant');
      if (variant.file !== 'variant-' + variant.sha256 + '.json') ngGameValueDataError('invalid-variant-content-name');
      const variantURL = namedURL(reg.manifestUrl, variant.file, 'variant');
      if (new URL(reg.metadataUrl, reg.manifestUrl).href !== variantURL) ngGameValueDataError('stale-metadata-locator');
      const descriptor = JSON.parse(decoder.decode(await bytes(variantURL, variant.sha256, variant.rawBytes)));
      if (descriptor.codec !== 'mdp-columns-v1' || descriptor.partEncoding !== 'utf8-json-fragments'
        || descriptor.mechanicsHash !== reg.mechanicsHash || descriptor.ruleset !== reg.ruleset
        || descriptor.lossAversion !== reg.lossAversion || descriptor.coverage?.status !== 'COMPLETE'
        || !Array.isArray(descriptor.parts) || !descriptor.parts.length) ngGameValueDataError('invalid-metadata-descriptor');
      const parts = new Array(descriptor.parts.length); let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(4, parts.length) }, async () => {
        for (;;) {
          const i = cursor++; if (i >= parts.length) return;
          const part = descriptor.parts[i];
          if (part.file !== 'part-' + part.sha256 + '.txt') ngGameValueDataError('invalid-part-content-name');
          parts[i] = await bytes(namedURL(variantURL, part.file, 'part'), part.sha256, part.rawBytes, 39000);
        }
      }));
      const size = parts.reduce((n, part) => n + part.length, 0), joined = new Uint8Array(size); let offset = 0;
      for (const part of parts) { joined.set(part, offset); offset += part.length; }
      if (size !== descriptor.transfer.rawBytes || await digest(joined) !== descriptor.transfer.sha256) ngGameValueDataError('metadata-transfer-mismatch');
      const records = JSON.parse(decoder.decode(joined));
      if (!Array.isArray(records) || records.length !== descriptor.records) ngGameValueDataError('metadata-record-count-mismatch');
      const metadata = ngGameValueDecode(records, descriptor.root, descriptor.codec);
      if (metadata.ruleset !== reg.ruleset || metadata.evFrame !== reg.evFrame || metadata.lossAversion !== reg.lossAversion
        || M.ngMdpStable(metadata.coverage) !== M.ngMdpStable(descriptor.coverage)) ngGameValueDataError('metadata-header-mismatch');
      return metadata;
    })();
    cache.set(key, pending);
    try { return await pending; } catch (error) { if (cache.get(key) === pending) cache.delete(key); throw error; }
  }
  async function describeRoot(reg, query) {
    const metadata = await load(reg);
    if (!query || typeof query.nodeId !== 'string' || !['top', 'bottom'].includes(query.role)) ngGameValueDataError('invalid-root-query');
    const sourceKey = M.ngMdpStable([query.nodeId, query.role]);
    if (!Object.prototype.hasOwnProperty.call(metadata.canonical, sourceKey)) ngGameValueDataError('unknown-root-state');
    const canonicalNodeId = metadata.canonical[sourceKey];
    const hand = metadata.hands[M.ngMdpStable([canonicalNodeId, query.role])];
    if (!hand) ngGameValueDataError('unavailable-root-hand');
    const identity = hand.map(a => ({ techniqueId: a.techniqueId, destinationId: a.destinationId,
      destinationRole: a.destinationRole, kind: a.kind, defense: a.defense, ...(a.defenseId ? { defenseId: a.defenseId } : {}) }));
    const result = { status: 'ready', registrationKey: deps.registrationKey(reg, M.ngMdpStable), canonicalNodeId,
      modelHash: reg.modelHash, graphHash: reg.graphHash, mechanicsHash: reg.mechanicsHash,
      opponentPolicyHash: reg.opponentPolicyHash, ruleset: reg.ruleset, evFrame: metadata.evFrame,
      coverage: { status: 'COMPLETE', source: 'verified-immutable-metadata' }, hand: identity };
    if (new TextEncoder().encode(JSON.stringify(result)).length > 65536) ngGameValueDataError('root-description-size-budget');
    return ngGameValueDataFreeze(result);
  }
  async function buildModel(reg, request, scope) {
    const metadata = await load(reg);
    if (scope.cancelled()) ngGameValueDataError('cancelled');
    const snapshot = scope.snapshot;
    if (!snapshot || request.state.snapshotId !== snapshot.id || request.state.snapshotHash !== snapshot.hash
      || request.profileHash !== snapshot.profileHash || snapshot.profile?.fingerprint !== snapshot.profileHash
      || snapshot.profile.status !== 'ready') ngGameValueDataError('stale-worker-profile');
    for (const key of ['graphHash', 'modelHash', 'mechanicsHash', 'opponentPolicyHash', 'ruleset'])
      if (request[key] !== reg[key]) ngGameValueDataError('stale-worker-' + key);
    const adapter = deps.createAdapter(metadata, snapshot.profile, K, snapshot.runtime);
    return deps.expandAsync(adapter, request, { ...(deps.expansionOptions || {}), cancelled: scope.cancelled });
  }
  return { load, describeRoot, buildModel };
}
export {
  ngGameValueDecode, ngGameValueCreateWorkerHost,
};
