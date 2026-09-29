// Bounded read-only check of the emitted graph/index. Requires real emitted files
// (the existing CI emission step supplies them); never silently skips if absent.
// Identity/calibration only: no profile, playable mask, browser or solve claim.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ngKnowledgeFingerprint } from "../neural/src/knowledge-profile.src.js";
import { ngKnowledgeScenarioManifestHash } from "../neural/src/knowledge-scenarios.src.js";
import { ngKnowledgeScenarioManifestProduce } from "../neural/src/knowledge-scenario-manifest.src.js";
import { ngWireDecks, ngWireDeckIndex } from "../neural/src/wire-keys.src.js";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const root = process.env.KNOWLEDGE_MANIFEST_SOURCE_ROOT || fileURLToPath(new URL("../", import.meta.url));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function exactMethod(source, name) {
  const marker = "\n  " + name + "(", start = source.indexOf(marker) + 1;
  assert.ok(start > 0, "missing actual app identity helper " + name);
  assert.equal(source.indexOf(marker, start), -1, "ambiguous helper " + name);
  const firstEnd = source.indexOf("\n", start);
  const end = source.slice(start, firstEnd).trimEnd().endsWith("}") ? firstEnd : source.indexOf("\n  }", firstEnd) + 4;
  assert.ok(end > start, "missing helper body " + name);
  return source.slice(start, end);
}

test("every real role deck maps once to the actual app's source identity and calibrated frames", async () => {
  const paths = {
    graph: resolve(root, "source/quartz/static/neural/graph-data.json"),
    index: resolve(root, "source/quartz/static/neural/flashcards/_index.json"),
    app: resolve(root, "neural/src/app.src.jsx"),
  };
  const bytes = Object.fromEntries(Object.entries(paths).map(([k, path]) => [k, readFileSync(path)]));
  const hashes = Object.fromEntries(Object.entries(bytes).map(([k, b]) => [k, sha(b)]));
  // Optional externally frozen identities make a delivery run fail if candidate
  // bytes changed; routine CI can emit its own new corpus and re-prove the join.
  if (process.env.KNOWLEDGE_MANIFEST_GRAPH_SHA256) assert.equal(hashes.graph, process.env.KNOWLEDGE_MANIFEST_GRAPH_SHA256);
  if (process.env.KNOWLEDGE_MANIFEST_INDEX_SHA256) assert.equal(hashes.index, process.env.KNOWLEDGE_MANIFEST_INDEX_SHA256);
  const graph = JSON.parse(bytes.graph), index = JSON.parse(bytes.index);
  // The shipped manifest is format 4 (decks keyed by share ordinal): decode it with the ONE reader.
  const dec = ngWireDecks(index, graph.nodes);
  assert.equal(dec.unresolved, 0, "every emitted ordinal names a node"); assert.equal(dec.dupes, 0);
  const keys = Object.keys(dec.decks), canonical = ngWireDeckIndex(dec, index.shared);
  // THE P3 GATE: the authoritative revision is read from the REAL app's ingest, not recomputed
  // here, so this pins app == producer. The app fingerprints the canonical decoded index.
  const Component = new Function("DCLogic", "React", `${knowledgeSource}\n${bytes.app.toString("utf8")}\nreturn Component;`)(
    class {}, { createRef: () => ({ current: null }) });
  const live = Object.create(Component.prototype), store = {};
  Object.assign(live, { settings: {}, beats: [], track() {}, fx() {}, _saveProgress() {}, noteChallenges() {},
    _gameValueChanged() {}, get: (k, d) => (k in store ? store[k] : d), set: (k, v) => { store[k] = v; } });
  live.ingest(structuredClone(graph));
  live._ingestDeckManifest(structuredClone(index));
  const contentRevision = live._knowledgeContentRevision;
  assert.equal(contentRevision, ngKnowledgeFingerprint(canonical), "the app fingerprints the canonical index");
  assert.notEqual(contentRevision, ngKnowledgeFingerprint(index), "never the raw wire");
  const result = await ngKnowledgeScenarioManifestProduce({ graphBytes: bytes.graph, indexBytes: bytes.index,
    expected: { graphHash: hashes.graph, indexHash: hashes.index, contentRevision },
    bounds: { maxGraphBytes: 2_000_000, maxIndexBytes: 1_000_000, maxNodes: 5000,
      maxDecks: 10_000, maxSharedGroups: 5000, maxSharedMemberships: 50_000 } });
  assert.equal(result.status, "ready", JSON.stringify(result));
  const { manifest, provenance } = result;
  assert.equal(manifest.fingerprint, ngKnowledgeScenarioManifestHash(manifest));
  assert.deepEqual(manifest.deckIndex, canonical);
  assert.deepEqual(Object.keys(manifest.deckIndex.decks), keys);
  assert.deepEqual(provenance.bindings.map(b => b.deckKey), keys);

  // Execute original methods, not a test-side rewrite of the mapping law. The
  // pair helper's identity/calibration projection does not depend on decoding
  // compact outcomes; its links and geometry are outside this test's assertions.
  const appSource = bytes.app.toString("utf8");
  const names = ["_deriveDualPairs", "posFamily", "playedRole", "deckRole", "deckCat", "deckKeyFor", "giAllows"];
  const methods = names.map(name => exactMethod(appSource, name));
  const app = new Function("return ({\n" + methods.join(",\n") + "\n});")();
  app.currentPos = -1;
  const paired = structuredClone(graph);
  assert.equal(app._deriveDualPairs(paired), true);
  assert.ok(graph.nodes.length > 1000 && keys.length > 2000, "positive real-corpus floor");
  assert.equal(paired.nodes.length, keys.length);
  const actual = new Map(), rawById = new Map(graph.nodes.map(n => [n.id, n]));
  for (const node of paired.nodes) {
    const d = app.deckKeyFor(node);
    assert.ok(!actual.has(d.key), "ambiguous actual app deck " + d.key);
    actual.set(d.key, { node, d });
  }
  assert.deepEqual([...actual.keys()].sort(), [...keys].sort());
  let mapped = 0, frameComparisons = 0, aliasPeers = 0, inactiveFramePeers = 0;
  const typeCounts = { Position: 0, Transition: 0, Submission: 0 };
  for (const binding of provenance.bindings) {
    const d = manifest.identity.decks[binding.deckKey], reference = actual.get(binding.deckKey);
    assert.ok(reference, binding.deckKey); const { node, d: appDeck } = reference;
    assert.equal(binding.roleNodeId, node.id);
    assert.equal(d.category, appDeck.cat); assert.equal(d.role, appDeck.role);
    assert.equal(binding.category, canonical.decks[binding.deckKey].cat);
    const raw = rawById.get(binding.sourceNodeId); assert.ok(raw, binding.sourceNodeId);
    assert.equal(binding.sourceTitle, raw.t);
    assert.equal(binding.stateAlias, raw.cal.stateAlias ?? null);
    for (const frame of ["gi", "nogi"]) {
      assert.equal(typeof raw.cal.avail[frame], "boolean", "no unknown verdict fallback");
      app._giMode = frame;
      assert.equal(d.rulesets[frame], app.giAllows(node));
      assert.equal(d.rulesets[frame], raw.cal.avail[frame]);
      if (!d.rulesets[frame]) inactiveFramePeers++;
      frameComparisons++;
    }
    if (binding.stateAlias !== null) aliasPeers++;
    typeCounts[d.category]++; mapped++;
  }
  assert.equal(mapped, keys.length); assert.equal(frameComparisons, keys.length * 2);
  assert.ok(Object.values(typeCounts).every(n => n > 0));
  assert.ok(inactiveFramePeers > 0 && aliasPeers > 0, "inactive/alias preservation actually exercised");
  let sharedMemberships = 0, sharedInactiveMemberships = 0;
  for (const [hash, ordinals] of Object.entries(index.shared)) {
    assert.deepEqual(manifest.deckIndex.shared[hash], ordinals);
    for (const ordinal of ordinals) {
      const key = keys[ordinal];
      assert.equal(provenance.bindings[ordinal].deckKey, key);
      assert.ok(actual.has(key)); sharedMemberships++;
      if (!manifest.identity.decks[key].rulesets.nogi) sharedInactiveMemberships++;
    }
  }
  assert.ok(sharedMemberships > 0 && sharedInactiveMemberships > 0);
  assert.equal(sharedMemberships, provenance.coverage.sharedMemberships);
  for (const [key, path] of Object.entries(paths)) assert.equal(sha(readFileSync(path)), hashes[key], "source changed during check: " + key);
  console.log("KNOWLEDGE_MANIFEST_CORPUS_RECEIPT " + JSON.stringify({
    scope: "complete-study-manifest-source-identity-only", sources: Object.fromEntries(Object.entries(paths).map(([k, path]) =>
      [k, { path, sha256: hashes[k], bytes: bytes[k].length }])),
    exactAppMethodHashes: Object.fromEntries(names.map((n, i) => [n, sha(methods[i])])),
    contentRevision: provenance.contentRevision, manifestHash: provenance.manifestHash,
    coverage: provenance.coverage, mapped, frameComparisons, aliasPeers, inactiveFramePeers,
    sharedMemberships, sharedInactiveMemberships, sourceHashesUnchanged: true,
    maxRSSKiB: process.resourceUsage().maxRSS,
  }));
});
