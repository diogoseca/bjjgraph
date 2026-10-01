// Pure byte-to-manifest binding. Root supplies trusted expected identities and
// owns fetching/installation. This verifies consistency, not source authenticity.
import { ngKnowledgeFingerprint } from "./knowledge-profile.src.js";
import { ngKnowledgeScenarioManifestHash } from "./knowledge-scenarios.src.js";
// The ONE decoder of the deck manifest (format 4 keys decks by share ordinal, v1.204.3) and the
// one deck-name rule; never a second copy here (CLAUDE.md §6.5).
import { ngWireDecks, ngWireDeckIndex, ngWireDeckName, ngWireSeats, ngWireCat } from "./wire-keys.src.js";

export const NG_KNOWLEDGE_SCENARIO_MANIFEST_VERSION = 1;

function ngKnowledgeScenarioManifestRequire(ok, reason, details) {
  if (!ok) throw Object.assign(new Error(reason), { manifestReason: reason, details });
}
function ngKnowledgeScenarioManifestOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
function ngKnowledgeScenarioManifestObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function ngKnowledgeScenarioManifestText(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function ngKnowledgeScenarioManifestRecord(value, fields, reason) {
  ngKnowledgeScenarioManifestRequire(ngKnowledgeScenarioManifestObject(value), reason);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  ngKnowledgeScenarioManifestRequire(Reflect.ownKeys(descriptors).length === fields.length &&
    fields.every(k => descriptors[k]?.enumerable && ngKnowledgeScenarioManifestOwn(descriptors[k], "value")), reason);
  return Object.fromEntries(fields.map(k => [k, descriptors[k].value]));
}
function ngKnowledgeScenarioManifestFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(ngKnowledgeScenarioManifestFreeze);
    Object.freeze(value);
  }
  return value;
}
function ngKnowledgeScenarioManifestBytes(value, limit, source) {
  const bytes = value instanceof Uint8Array ? value :
    value instanceof ArrayBuffer ? new Uint8Array(value) : null;
  ngKnowledgeScenarioManifestRequire(bytes && bytes.buffer instanceof ArrayBuffer,
    "invalid-source-bytes", { source });
  ngKnowledgeScenarioManifestRequire(bytes.byteLength > 0 && bytes.byteLength <= limit,
    "source-bytes-over-limit", { source });
  // Copy the exact view before any await: caller buffer/settings changes cannot
  // switch the bytes parsed after the digest has verified a different snapshot.
  return new Uint8Array(bytes);
}
async function ngKnowledgeScenarioManifestDigest(bytes) {
  const subtle = globalThis.crypto?.subtle;
  ngKnowledgeScenarioManifestRequire(subtle && typeof subtle.digest === "function", "sha256-unavailable");
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}
function ngKnowledgeScenarioManifestParse(bytes, source) {
  let text, value;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { ngKnowledgeScenarioManifestRequire(false, "invalid-source-utf8", { source }); }
  try { value = JSON.parse(text); }
  catch { ngKnowledgeScenarioManifestRequire(false, "invalid-source-json", { source }); }
  // JSON.parse silently overwrites duplicate properties. Scan the already valid
  // JSON, decoding key escapes, so duplicate decks/verdicts cannot disappear.
  const stack = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      const start = i++;
      while (text[i] !== '"') { if (text[i] === "\\") i++; i++; }
      let next = i + 1;
      while (/\s/.test(text[next] || "x")) next++;
      if (text[next] === ":") {
        const key = JSON.parse(text.slice(start, i + 1)), seen = stack[stack.length - 1];
        ngKnowledgeScenarioManifestRequire(!seen.has(key), "duplicate-source-json-key", { source, key });
        seen.add(key);
      }
    } else if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? new Set() : null);
      ngKnowledgeScenarioManifestRequire(stack.length <= 48, "source-json-too-deep", { source });
    } else if (ch === "}" || ch === "]") stack.pop();
  }
  const pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (typeof item === "number") ngKnowledgeScenarioManifestRequire(Number.isFinite(item),
      "nonfinite-source-number", { source });
    else if (item && typeof item === "object") for (const child of Object.values(item)) pending.push(child);
  }
  return value;
}

// The raw manifest is checked structurally, then decoded ONCE through `ngWireDecks` against the
// verified graph's nodes. The result handed on is the canonical decoded index (`ngWireDeckIndex`:
// {decks: {"<Name>|<Role>": {cat, n}}, shared}), which is also what the app fingerprints at ingest,
// so the content revision agrees across wire formats. Format 3 still decodes (a stale CDN copy).
function ngKnowledgeScenarioManifestIndex(index, graph, bounds) {
  ngKnowledgeScenarioManifestRequire(ngKnowledgeScenarioManifestObject(index), "invalid-deck-index");
  const format4 = ngKnowledgeScenarioManifestOwn(index, "deckOrd");
  ngKnowledgeScenarioManifestRecord(index, ["_meta", format4 ? "deckOrd" : "decks", "shared"], "invalid-deck-index");
  ngKnowledgeScenarioManifestRequire(ngKnowledgeScenarioManifestObject(index._meta) &&
    index._meta.format === (format4 ? 4 : 3) && (format4 || index._meta.status === "generated") &&
    ngKnowledgeScenarioManifestObject(index.shared), "missing-complete-deck-index");
  if (format4) {
    // `ngWireDecks` trusts these arrays; the producer does not. A negative delta, a fraction or a
    // count array of the wrong length is a corrupt wire, never a smaller one.
    const w = ngKnowledgeScenarioManifestRecord(index.deckOrd, ["o", "n"], "invalid-deck-ordinals");
    const ints = (a) => Array.isArray(a) && a.every(v => Number.isSafeInteger(v) && v >= 0);
    ngKnowledgeScenarioManifestRequire(ints(w.o) && ints(w.n) && w.n.length === 2 * w.o.length, "invalid-deck-ordinals");
  } else {
    ngKnowledgeScenarioManifestRequire(ngKnowledgeScenarioManifestObject(index.decks), "missing-complete-deck-index");
    for (const [key, row] of Object.entries(index.decks)) ngKnowledgeScenarioManifestRequire(Array.isArray(row) && row.length === 2 &&
      ["Position", "Transition", "Submission"].includes(row[0]) && Number.isSafeInteger(row[1]) && row[1] >= 0,
    "invalid-deck-row", { deckKey: key });
  }
  ngKnowledgeScenarioManifestRequire(ngKnowledgeScenarioManifestObject(graph) && Array.isArray(graph.nodes),
    "missing-or-over-limit-graph-nodes");
  const dec = ngWireDecks(index, graph.nodes);
  ngKnowledgeScenarioManifestRequire(!dec.unresolved && !dec.dupes, "unresolved-deck-ordinals",
    { unresolved: dec.unresolved, dupes: dec.dupes });
  const canonical = ngWireDeckIndex(dec, index.shared);
  const keys = Object.keys(canonical.decks), groups = Object.keys(canonical.shared);
  ngKnowledgeScenarioManifestRequire(keys.length > 0 && keys.length <= bounds.maxDecks &&
    groups.length <= bounds.maxSharedGroups, "deck-index-over-limit");
  for (const key of keys) {
    const row = canonical.decks[key];
    ngKnowledgeScenarioManifestRequire(["Position", "Transition", "Submission"].includes(row.cat) &&
      Number.isSafeInteger(row.n) && row.n >= 0, "invalid-deck-row", { deckKey: key });
  }
  let memberships = 0;
  const sharedDecks = new Set();
  for (const hash of groups) {
    const row = canonical.shared[hash];
    ngKnowledgeScenarioManifestRequire(/^[0-9a-f]{8}$/.test(hash) && Array.isArray(row) && row.length >= 2 &&
      new Set(row).size === row.length && row.every(n => Number.isSafeInteger(n) && n >= 0 && n < keys.length),
    "invalid-shared-ordinals", { hash });
    memberships += row.length;
    ngKnowledgeScenarioManifestRequire(memberships <= bounds.maxSharedMemberships, "shared-memberships-over-limit");
    row.forEach(n => sharedDecks.add(n));
  }
  return { keys, canonical, sharedGroups: groups.length, sharedMemberships: memberships, sharedDecks: sharedDecks.size };
}

function ngKnowledgeScenarioManifestSources(graph, bounds) {
  ngKnowledgeScenarioManifestRequire(ngKnowledgeScenarioManifestObject(graph) && Array.isArray(graph.nodes) &&
    graph.nodes.length > 0 && graph.nodes.length <= bounds.maxNodes, "missing-or-over-limit-graph-nodes");
  const types = { positions: "Position", transitions: "Transition", submissions: "Submission" };
  const sources = new Map(), ids = new Set(), roleIds = new Set();
  for (const node of graph.nodes) {
    ngKnowledgeScenarioManifestRequire(ngKnowledgeScenarioManifestObject(node) &&
      ngKnowledgeScenarioManifestOwn(types, node.ty) && ngKnowledgeScenarioManifestText(node.id) &&
      ngKnowledgeScenarioManifestText(node.t), "invalid-source-node");
    ngKnowledgeScenarioManifestRequire(!ngKnowledgeScenarioManifestOwn(node, "pairId") &&
      !ngKnowledgeScenarioManifestOwn(node, "role"), "already-expanded-source-node", { sourceNodeId: node.id });
    ngKnowledgeScenarioManifestRequire(!ids.has(node.id), "duplicate-source-node-id", { sourceNodeId: node.id });
    ids.add(node.id);
    const isPosition = node.ty === "positions", category = ngWireCat(node);
    const roles = ngWireSeats(node);
    // The app's deck-name rule, from its one home (wire-keys.src.js): posFamily for a position,
    // the full title for a technique — never its fromRole (the physical performer axis).
    const title = ngWireDeckName(node);
    ngKnowledgeScenarioManifestRequire(ngKnowledgeScenarioManifestText(title), "empty-source-deck-title");
    ngKnowledgeScenarioManifestRequire(ngKnowledgeScenarioManifestObject(node.cal),
      "missing-source-calibration", { sourceNodeId: node.id });
    const availability = ngKnowledgeScenarioManifestRecord(node.cal.avail, ["gi", "nogi"], "unknown-source-availability");
    ngKnowledgeScenarioManifestRequire(typeof availability.gi === "boolean" && typeof availability.nogi === "boolean",
      "unknown-source-availability", { sourceNodeId: node.id });
    const stateAlias = ngKnowledgeScenarioManifestOwn(node.cal, "stateAlias") ? node.cal.stateAlias : null;
    ngKnowledgeScenarioManifestRequire(stateAlias === null || (isPosition && ngKnowledgeScenarioManifestText(stateAlias)),
      "invalid-source-state-alias", { sourceNodeId: node.id });
    for (let seat = 0; seat < roles.length; seat++) {
      const role = roles[seat], deckKey = title + "|" + role;
      const roleNodeId = seat === 0 ? node.id : node.id + "/" + role;
      ngKnowledgeScenarioManifestRequire(!roleIds.has(roleNodeId), "ambiguous-role-node-id", { roleNodeId });
      roleIds.add(roleNodeId);
      ngKnowledgeScenarioManifestRequire(!sources.has(deckKey), "ambiguous-deck-source", { deckKey });
      sources.set(deckKey, { deckKey, category, role, sourceNodeId: node.id, roleNodeId,
        sourceTitle: node.t, stateAlias, rulesets: { ...availability } });
    }
  }
  return sources;
}

/** Verify exact trusted bytes, then produce the complete frozen v1 manifest.
 * No fetch, policy, profile, grade, question text, storage or live state input.
 */
export async function ngKnowledgeScenarioManifestProduce(input) {
  try {
    const job = ngKnowledgeScenarioManifestRecord(input, ["graphBytes", "indexBytes", "expected", "bounds"], "invalid-manifest-input");
    const expected = ngKnowledgeScenarioManifestRecord(job.expected, ["graphHash", "indexHash", "contentRevision"], "invalid-expected-identities");
    ngKnowledgeScenarioManifestRequire([expected.graphHash, expected.indexHash].every(v =>
      typeof v === "string" && /^[0-9a-f]{64}$/.test(v)) && ngKnowledgeScenarioManifestText(expected.contentRevision),
    "invalid-expected-identities");
    const bounds = ngKnowledgeScenarioManifestRecord(job.bounds,
      ["maxGraphBytes", "maxIndexBytes", "maxNodes", "maxDecks", "maxSharedGroups", "maxSharedMemberships"], "invalid-manifest-bounds");
    ngKnowledgeScenarioManifestRequire(Object.values(bounds).every(n => Number.isSafeInteger(n) && n > 0), "invalid-manifest-bounds");
    const graphBytes = ngKnowledgeScenarioManifestBytes(job.graphBytes, bounds.maxGraphBytes, "graph");
    const indexBytes = ngKnowledgeScenarioManifestBytes(job.indexBytes, bounds.maxIndexBytes, "index");
    const [graphHash, indexHash] = await Promise.all([
      ngKnowledgeScenarioManifestDigest(graphBytes), ngKnowledgeScenarioManifestDigest(indexBytes),
    ]);
    ngKnowledgeScenarioManifestRequire(graphHash === expected.graphHash, "graph-sha256-mismatch");
    ngKnowledgeScenarioManifestRequire(indexHash === expected.indexHash, "index-sha256-mismatch");
    const graph = ngKnowledgeScenarioManifestParse(graphBytes, "graph");
    const index = ngKnowledgeScenarioManifestParse(indexBytes, "index");
    // Graph identities first: the index is decoded AGAINST these nodes (format 4 names each deck
    // from its node's ordinal), so a duplicate or malformed node must fail as itself, not as a
    // decode that happened to skip it.
    const sources = ngKnowledgeScenarioManifestSources(graph, bounds);
    const { keys, canonical, ...sharedCoverage } = ngKnowledgeScenarioManifestIndex(index, graph, bounds);
    const contentRevision = ngKnowledgeFingerprint(canonical);
    ngKnowledgeScenarioManifestRequire(contentRevision === expected.contentRevision, "index-content-revision-mismatch");
    const bindings = [], identities = [];
    const coverage = { sourceNodes: graph.nodes.length, decks: keys.length, mappedDecks: 0,
      categories: { Position: 0, Transition: 0, Submission: 0 }, roles: { Top: 0, Bottom: 0, Attacker: 0, Defender: 0 },
      frames: { gi: { available: 0, unavailable: 0 }, nogi: { available: 0, unavailable: 0 } },
      stateAliasDecks: 0, ...sharedCoverage };
    for (const deckKey of keys) {
      ngKnowledgeScenarioManifestRequire(sources.has(deckKey), "missing-deck-source", { deckKey });
      const { rulesets, ...binding } = sources.get(deckKey);
      ngKnowledgeScenarioManifestRequire(binding.category === canonical.decks[deckKey].cat, "deck-source-category-mismatch", { deckKey });
      bindings.push(binding);
      identities.push([deckKey, { role: binding.role, category: binding.category, rulesets }]);
      coverage.categories[binding.category]++; coverage.roles[binding.role]++; coverage.mappedDecks++;
      if (binding.stateAlias !== null) coverage.stateAliasDecks++;
      for (const frame of ["gi", "nogi"]) coverage.frames[frame][rulesets[frame] ? "available" : "unavailable"]++;
    }
    // Equality after the per-deck unique join also requires the other role and
    // every inactive source peer. A filtered index never becomes a ready subset.
    ngKnowledgeScenarioManifestRequire(keys.length === sources.size, "incomplete-source-deck-coverage");
    const manifest = { version: 1, status: "ready", deckIndex: canonical,
      identity: { contentRevision, graphHash, decks: Object.fromEntries(identities) } };
    manifest.fingerprint = ngKnowledgeScenarioManifestHash(manifest);
    return ngKnowledgeScenarioManifestFreeze({ apiVersion: NG_KNOWLEDGE_SCENARIO_MANIFEST_VERSION, status: "ready", manifest,
      provenance: { kind: "verified-raw-study-manifest", graphHash, indexHash, contentRevision,
        manifestHash: manifest.fingerprint, availabilitySource: "raw-graph-cal.avail",
        roleExpansion: "collapsed-hub-two-seats-v1", bindings, coverage } });
  } catch (error) {
    const result = { apiVersion: NG_KNOWLEDGE_SCENARIO_MANIFEST_VERSION, status: "unavailable", manifest: null,
      reason: error?.manifestReason || "manifest-production-failed" };
    if (error?.manifestReason && error.details) result.details = error.details;
    return ngKnowledgeScenarioManifestFreeze(result);
  }
}
