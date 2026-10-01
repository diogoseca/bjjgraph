// Tiny source-binding contracts only. No fetch, profile, study reward or solve.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ngKnowledgeFingerprint } from "../neural/src/knowledge-profile.src.js";
import { ngKnowledgeScenarioManifestHash } from "../neural/src/knowledge-scenarios.src.js";
import { ngKnowledgeScenarioManifestProduce as produce,
  NG_KNOWLEDGE_SCENARIO_MANIFEST_VERSION } from "../neural/src/knowledge-scenario-manifest.src.js";
import { ngWireDecks, ngWireDeckIndex } from "../neural/src/wire-keys.src.js";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const encode = value => new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
const limits = () => ({ maxGraphBytes: 100_000, maxIndexBytes: 100_000,
  maxNodes: 50, maxDecks: 100, maxSharedGroups: 100, maxSharedMemberships: 1000 });
// Format 4 (the shipped wire, v1.204.3) names no deck: each node's share ordinal `o` carries two
// card counts, and the decoded keys come back in NAME order. `keys` is that order.
const keys = ["Mount|Bottom", "Mount|Top", "Rear Naked Choke from Invisible Collar|Attacker",
  "Rear Naked Choke from Invisible Collar|Defender", "Sweep from Half Guard|Attacker", "Sweep from Half Guard|Defender"];
// Format 3 (a stale CDN copy) spelled each key and kept the emitter's own order, which this
// deliberately non-sorted order exercises; its shared indexes address THIS order.
const keys3 = ["Mount|Bottom", "Rear Naked Choke from Invisible Collar|Defender", "Sweep from Half Guard|Attacker",
  "Mount|Top", "Sweep from Half Guard|Defender", "Rear Naked Choke from Invisible Collar|Attacker"];
const catOf = k => k.startsWith("Mount|") ? "Position" : k.startsWith("Sweep ") ? "Transition" : "Submission";
function fixture(format = 4) {
  const graph = { nodes: [
    { id: "Positions/Mount", t: "Mount Top", ty: "positions", posId: "mount", o: 5,
      cal: { avail: { gi: true, nogi: false }, stateAlias: "retired-control" } },
    { id: "Transitions/Sweep/from-Half-Guard", t: "Sweep from Half Guard", ty: "transitions", fromRole: "bottom", o: 9,
      cal: { avail: { gi: false, nogi: true } } },
    { id: "Submissions/Rear-Naked-Choke/from-Invisible-Collar", t: "Rear Naked Choke from Invisible Collar",
      ty: "submissions", fromRole: "top", o: 12, cal: { avail: { gi: false, nogi: false } } },
  ], links: [], toTab: [], evFrame: "nogi" };
  const note = 'Quotes " and slashes \\ remain literal.';
  const index = format === 4
    // ordinals 5, 9, 12 delta-coded (d0 = o0, di = oi - o(i-1) - 1); three cards in every seat.
    ? { _meta: { format: 4, note }, deckOrd: { o: [5, 3, 2], n: [3, 3, 3, 3, 3, 3] },
      shared: { "012345ab": [5, 0, 4], abcdef01: [3, 2] } }
    : { _meta: { format: 3, status: "generated", note },
      decks: Object.fromEntries(keys3.map(k => [k, [catOf(k), 3]])), shared: { "012345ab": [4, 0, 2], abcdef01: [1, 5] } };
  return { graph, index };
}
// The authoritative revision is the fingerprint of the CANONICAL decoded index, exactly as the app
// computes it at ingest (`_ingestDeckManifest`), never of the raw file.
const revisionOf = f => ngKnowledgeFingerprint(ngWireDeckIndex(ngWireDecks(f.index, f.graph.nodes), f.index.shared));
function job(f = fixture()) {
  const graphBytes = encode(f.graph), indexBytes = encode(f.index);
  return { graphBytes, indexBytes, expected: { graphHash: sha(graphBytes), indexHash: sha(indexBytes),
    contentRevision: revisionOf(f) }, bounds: limits() };
}
let rejectedCases = 0;
async function unavailable(j, reason, fn = produce) {
  const result = await fn(j);
  assert.equal(result.status, "unavailable", JSON.stringify(result));
  assert.equal(result.manifest, null);
  if (reason) assert.equal(result.reason, reason);
  assert.ok(Object.isFrozen(result)); rejectedCases++;
  return result;
}
function frozen(value) {
  if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}

test("complete source bindings preserve exact full titles, both role axes, frames and aliases", async () => {
  assert.equal(NG_KNOWLEDGE_SCENARIO_MANIFEST_VERSION, 1);
  const j = job(), result = await produce(j);
  assert.equal(result.status, "ready", result.reason);
  const m = result.manifest, p = result.provenance;
  assert.equal(m.fingerprint, ngKnowledgeScenarioManifestHash(m));
  assert.equal(m.identity.contentRevision, j.expected.contentRevision);
  assert.equal(m.identity.graphHash, j.expected.graphHash);
  assert.equal(p.indexHash, j.expected.indexHash);
  assert.equal(p.manifestHash, m.fingerprint);
  assert.deepEqual(Object.keys(m.deckIndex.decks), keys);
  assert.deepEqual(Object.keys(m.identity.decks), keys);
  assert.deepEqual(p.bindings.map(b => b.deckKey), keys);
  assert.deepEqual(p.bindings[0], { deckKey: "Mount|Bottom", category: "Position", role: "Bottom",
    sourceNodeId: "Positions/Mount", roleNodeId: "Positions/Mount/Bottom", sourceTitle: "Mount Top", stateAlias: "retired-control" });
  assert.equal(p.bindings[1].roleNodeId, "Positions/Mount");
  assert.equal(p.bindings[5].roleNodeId, "Transitions/Sweep/from-Half-Guard/Defender");
  for (const key of keys) {
    const d = m.identity.decks[key];
    assert.equal(d.role, key.slice(key.lastIndexOf("|") + 1));
    assert.deepEqual(d.rulesets, key.startsWith("Mount|") ? { gi: true, nogi: false } :
      key.startsWith("Sweep ") ? { gi: false, nogi: true } : { gi: false, nogi: false });
  }
  assert.deepEqual(p.coverage, { sourceNodes: 3, decks: 6, mappedDecks: 6,
    categories: { Position: 2, Transition: 2, Submission: 2 }, roles: { Top: 1, Bottom: 1, Attacker: 2, Defender: 2 },
    frames: { gi: { available: 2, unavailable: 4 }, nogi: { available: 2, unavailable: 4 } },
    stateAliasDecks: 2, sharedGroups: 2, sharedMemberships: 5, sharedDecks: 5 });
  frozen(result);
});

test("all four calibrated boolean pairs are copied for every category and both seats", async () => {
  let comparisons = 0;
  for (const gi of [true, false]) for (const nogi of [true, false]) {
    const f = fixture(); f.graph.nodes.forEach(n => { n.cal.avail = { gi, nogi }; });
    const r = await produce(job(f)); assert.equal(r.status, "ready", r.reason);
    for (const d of Object.values(r.manifest.identity.decks)) { assert.deepEqual(d.rulesets, { gi, nogi }); comparisons += 2; }
  }
  assert.equal(comparisons, 48);
});

test("shared ordinal order and inactive closure peers survive without normalization or filtering", async () => {
  const f = fixture(), r = await produce(job(f));
  assert.equal(r.status, "ready", r.reason);
  assert.deepEqual(r.manifest.deckIndex, { decks: Object.fromEntries(keys.map(k => [k, { cat: catOf(k), n: 3 }])),
    shared: f.index.shared }, "the canonical decoded index, never the raw wire");
  assert.deepEqual(r.manifest.deckIndex.shared.abcdef01.map(i => Object.keys(r.manifest.deckIndex.decks)[i]),
    ["Rear Naked Choke from Invisible Collar|Defender", "Rear Naked Choke from Invisible Collar|Attacker"]);
  assert.equal(r.provenance.coverage.decks, 6);
  // Format 3 still decodes, in the order it shipped, with its shared indexes into that order.
  const three = fixture(3), t = await produce(job(three));
  assert.equal(t.status, "ready", t.reason);
  assert.deepEqual(Object.keys(t.manifest.deckIndex.decks), keys3);
  assert.deepEqual(t.manifest.deckIndex.shared.abcdef01.map(i => Object.keys(t.manifest.deckIndex.decks)[i]),
    ["Rear Naked Choke from Invisible Collar|Defender", "Rear Naked Choke from Invisible Collar|Attacker"]);
  // The same content in either wire format is the same content revision (P3): format 3 in NAME
  // order with the same shared indexes decodes to the identical canonical index.
  const named = fixture(3); named.index.decks = Object.fromEntries(keys.map(k => [k, [catOf(k), 3]]));
  named.index.shared = structuredClone(f.index.shared);
  assert.equal(revisionOf(named), revisionOf(f), "content revision is independent of the wire format");
  // Raw order is bound: a reordered format-3 index is weakly the same content but a different manifest.
  const g = fixture(3); g.index.decks = Object.fromEntries(Object.entries(g.index.decks).reverse());
  assert.equal(ngKnowledgeFingerprint(three.index), ngKnowledgeFingerprint(g.index), "weak content identity sorts map keys");
  const s = await produce(job(g)); assert.equal(s.status, "ready");
  assert.notEqual(t.provenance.indexHash, s.provenance.indexHash);
  assert.notEqual(t.manifest.fingerprint, s.manifest.fingerprint, "frozen manifest identity binds ordinal order");
  assert.deepEqual(Object.keys(s.manifest.deckIndex.decks), keys3.toReversed());
});

test("digests check exact bytes, including harmless whitespace, rather than reserialized JSON", async () => {
  const j = job(); j.graphBytes = encode(JSON.stringify(fixture().graph, null, 2) + "\r\n");
  await unavailable(j, "graph-sha256-mismatch");
  j.expected.graphHash = sha(j.graphBytes); assert.equal((await produce(j)).status, "ready");
  j.indexBytes = encode(JSON.stringify(fixture().index, null, 1));
  await unavailable(j, "index-sha256-mismatch");
  j.expected.indexHash = sha(j.indexBytes); assert.equal((await produce(j)).status, "ready");
});

test("stale graph/index digests and authoritative content revision fail closed", async () => {
  for (const field of ["graphHash", "indexHash"]) {
    const j = job(); j.expected[field] = "0".repeat(64);
    await unavailable(j, field === "graphHash" ? "graph-sha256-mismatch" : "index-sha256-mismatch");
  }
  const j = job(); j.expected.contentRevision += "-stale";
  await unavailable(j, "index-content-revision-mismatch");
  for (const value of [null, "", "abc", "A".repeat(64), 123]) {
    const bad = job(); bad.expected.graphHash = value; await unavailable(bad, "invalid-expected-identities");
  }
});

test("bytes, settings and expectations are copied before yielding; caller input is not frozen", async () => {
  const j = job(), original = structuredClone(j), promise = produce(j);
  j.graphBytes.fill(0); j.indexBytes.fill(0); j.expected.graphHash = "0".repeat(64); j.expected.contentRevision = "changed";
  j.bounds.maxNodes = 1;
  const r = await promise; assert.equal(r.status, "ready", r.reason);
  assert.equal(r.provenance.graphHash, original.expected.graphHash);
  assert.equal(r.provenance.contentRevision, original.expected.contentRevision);
  assert.ok(!Object.isFrozen(j) && !Object.isFrozen(j.bounds) && !Object.isFrozen(j.expected));
  const untouched = job(), before = structuredClone(untouched);
  await produce(untouched); assert.deepEqual(untouched, before);
});

test("ArrayBuffer and exact typed-array views work; unsupported/shared buffers reject", async () => {
  const j = job(), padded = new Uint8Array(j.graphBytes.length + 4);
  padded.set(j.graphBytes, 2); j.graphBytes = padded.subarray(2, padded.length - 2);
  j.indexBytes = j.indexBytes.buffer;
  assert.equal((await produce(j)).status, "ready");
  for (const value of [[], "{}", new DataView(new ArrayBuffer(8)), new Uint8Array(new SharedArrayBuffer(2))]) {
    const bad = job(); bad.graphBytes = value; await unavailable(bad, "invalid-source-bytes");
  }
});

test("missing sources, wrong categories and absent role peers never become partial manifests", async () => {
  // Format 4: a deck whose node is gone is an ordinal the graph cannot name.
  const noSource = fixture(); noSource.graph.nodes.pop();
  await unavailable(job(noSource), "unresolved-deck-ordinals");
  // Format 4: a seat whose count is 0 carries no deck, so its role peer is absent.
  const noPeer = fixture(); noPeer.index.deckOrd.n[4] = 0; noPeer.index.shared = {};
  await unavailable(job(noPeer), "incomplete-source-deck-coverage");
  const orphan = fixture(); orphan.index.deckOrd = { o: [5, 3, 2, 0], n: [3, 3, 3, 3, 3, 3, 3, 3] };
  await unavailable(job(orphan), "unresolved-deck-ordinals");
  // Format 3 spelled its keys, so it alone can name a deck the graph does not have.
  const noPeer3 = fixture(3); delete noPeer3.index.decks[keys3[5]]; noPeer3.index.shared = {};
  await unavailable(job(noPeer3), "incomplete-source-deck-coverage");
  const cat = fixture(3); cat.index.decks[keys3[0]][0] = "Transition";
  await unavailable(job(cat), "deck-source-category-mismatch");
  const wrong = fixture(3); wrong.index.decks["Sweep from Half Guard|Bottom"] = ["Transition", 3];
  await unavailable(job(wrong), "missing-deck-source");
  const short = fixture(3); short.graph.nodes[1].t = "Sweep";
  await unavailable(job(short), "missing-deck-source");
});

test("duplicate and ambiguous source identities reject instead of choosing first or last", async () => {
  const f = fixture(); f.graph.nodes.push(structuredClone(f.graph.nodes[0]));
  await unavailable(job(f), "duplicate-source-node-id");
  f.graph.nodes.at(-1).id += "/Another";
  await unavailable(job(f), "ambiguous-deck-source");
  f.graph.nodes.at(-1).id = "Positions/Mount/Bottom"; f.graph.nodes.at(-1).t = "Another Top";
  await unavailable(job(f), "ambiguous-role-node-id");
  const expanded = fixture(); expanded.graph.nodes[0].pairId = "Positions/Mount/Bottom";
  await unavailable(job(expanded), "already-expanded-source-node");
  delete expanded.graph.nodes[0].pairId; expanded.graph.nodes[0].role = "top";
  await unavailable(job(expanded), "already-expanded-source-node");
});

test("unknown calibration never becomes true, false, a regex guess or a probability-derived verdict", async () => {
  for (const avail of [undefined, null, {}, { gi: true }, { gi: true, nogi: null }, { gi: 0, nogi: 1 },
    { gi: true, nogi: true, unknown: true }]) {
    const f = fixture(); f.graph.nodes[2].cal.avail = avail;
    await unavailable(job(f), "unknown-source-availability");
  }
  const f = fixture(); delete f.graph.nodes[0].cal; await unavailable(job(f), "missing-source-calibration");
  const g = fixture(); g.graph.nodes[2].cal.stateAlias = "another";
  await unavailable(job(g), "invalid-source-state-alias");
});

test("format, entry, shared-group and ordinal validation requires complete valid input", async () => {
  for (const mutate of [f => { f.index._meta.format = 2; }, f => { delete f.index.shared; },
    f => { f.index._meta.status = "unknown"; }, f => { f.index.decks[keys3[0]][1] = -1; },
    f => { f.index.decks[keys3[0]].push("extra"); }, f => { f.index.decks[keys3[0]][0] = "System"; },
    f => { f.index.shared.bad = [0, 1]; }, f => { f.index.shared.abcdef01 = [0]; },
    f => { f.index.shared.abcdef01 = [0, 0]; }, f => { f.index.shared.abcdef01 = [0, 6]; },
    f => { f.index.shared.abcdef01 = [-1, 2]; }, f => { f.index.shared.abcdef01 = [0, 1.5]; },
    f => { f.index.shared.abcdef01 = ["0", 1]; }, f => { f.index.extra = 1; }]) {
    const f = fixture(3); mutate(f); await unavailable(job(f));
  }
  // Format 4: the decoder trusts `deckOrd`; the producer does not.
  for (const mutate of [f => { f.index._meta.format = 3; }, f => { f.index.deckOrd.n.pop(); },
    f => { f.index.deckOrd.o[1] = -1; }, f => { f.index.deckOrd.o[1] = 1.5; }, f => { f.index.deckOrd.n[0] = "3"; },
    f => { f.index.deckOrd.extra = []; }, f => { f.index.decks = {}; }, f => { f.index.shared.abcdef01 = [0, 6]; },
    f => { f.index.shared = []; }, f => { f.graph.nodes[1].o = 5; }]) {
    const f = fixture(); mutate(f); await unavailable(job(f));
  }
});

test("all explicit admission quotas fail in full rather than truncating data", async () => {
  for (const [field, limit] of Object.entries({ maxGraphBytes: 10, maxIndexBytes: 10, maxNodes: 2,
    maxDecks: 5, maxSharedGroups: 1, maxSharedMemberships: 4 })) {
    const j = job(); j.bounds[field] = limit; await unavailable(j);
  }
  for (const v of [0, -1, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, "5"]) {
    const j = job(); j.bounds.maxNodes = v; await unavailable(j, "invalid-manifest-bounds");
  }
  const j = job(); delete j.bounds.maxNodes; await unavailable(j, "invalid-manifest-bounds");
});

test("malformed source JSON, UTF-8, duplicates, nonfinite numbers and excessive depth reject", async () => {
  for (const [source, text, reason] of [
    ["graph", "{", "invalid-source-json"], ["index", '{"decks":{},"decks":{}}', "duplicate-source-json-key"],
    ["index", '{"decks":{},"d\\u0065cks":{}}', "duplicate-source-json-key"],
    ["graph", '{"a":{"gi":true,"gi":false}}', "duplicate-source-json-key"],
    ["graph", '{"a":1e999}', "nonfinite-source-number"],
    ["graph", "[".repeat(49) + "0" + "]".repeat(49), "source-json-too-deep"],
  ]) {
    const j = job(); j[source + "Bytes"] = encode(text); j.expected[source + "Hash"] = sha(j[source + "Bytes"]);
    await unavailable(j, reason);
  }
  const j = job(); j.graphBytes = new Uint8Array([0xc0, 0xaf]); j.expected.graphHash = sha(j.graphBytes);
  await unavailable(j, "invalid-source-utf8");
});

test("bad graph identity shapes and input accessors/symbols cannot bypass validation", async () => {
  for (const mutate of [f => { f.graph.nodes = []; }, f => { f.graph.nodes[0].id = ""; },
    f => { f.graph.nodes[0].ty = "unknown"; }, f => { f.graph.nodes[0].t = ""; },
    f => { f.graph.nodes[0].t = " Top"; }, f => { f.graph.nodes[0].cal.stateAlias = 2; }]) {
    const f = fixture(); mutate(f); await unavailable(job(f));
  }
  let invoked = 0; const getter = job();
  Object.defineProperty(getter.expected, "graphHash", { enumerable: true, get() { invoked++; return "0".repeat(64); } });
  await unavailable(getter, "invalid-expected-identities"); assert.equal(invoked, 0);
  const sym = job(); sym.bounds[Symbol("unknown")] = true; await unavailable(sym, "invalid-manifest-bounds");
  const extra = job(); extra.profile = {}; await unavailable(extra, "invalid-manifest-input");
});

test("source JSON can repeat keys in DIFFERENT objects and quote delimiter characters safely", async () => {
  const f = fixture(); f.graph.extra = { a: { gi: true }, b: { gi: false },
    text: '[{"quoted\\\" key": ": // }\\"} ]' };
  f.index._meta.extra = { "__proto__": "literal", strings: ["}", ":", "\\", '"', "[{]}"] };
  assert.equal((await produce(job(f))).status, "ready");
});

test("semantic mutation kills cover bytes, calibration, complete coverage and ordinal preservation", async () => {
  const sourceUrl = new URL("../neural/src/knowledge-scenario-manifest.src.js", import.meta.url);
  const original = readFileSync(sourceUrl, "utf8");
  const replacements = [
    ["graphHash === expected.graphHash", "true", async fn => {
      const j = job(); j.expected.graphHash = "0".repeat(64); await unavailable(j, "graph-sha256-mismatch", fn);
    }],
    ["rulesets: { ...availability }", "rulesets: { gi: true, nogi: true }", async fn => {
      const r = await fn(job()); assert.deepEqual(r.manifest.identity.decks[keys[2]].rulesets, { gi: false, nogi: false });
    }],
    ["keys.length === sources.size", "true", async fn => {
      const f = fixture(); f.index.deckOrd.n[4] = 0; f.index.shared = {};
      await unavailable(job(f), "incomplete-source-deck-coverage", fn);
    }],
    // An ordinal the graph cannot name must refuse the manifest, never shrink it quietly.
    ["!dec.unresolved && !dec.dupes", "true", async fn => {
      const f = fixture(); f.index.deckOrd = { o: [5, 3, 2, 0], n: [3, 3, 3, 3, 3, 3, 3, 3] };  // ordinal 13 names no node
      await unavailable(job(f), "unresolved-deck-ordinals", fn);
    }],
  ];
  let killed = 0;
  for (const [, , probe] of replacements) await probe(produce); // every probe passes on the real source
  for (const [before, afterText, probe] of replacements) {
    assert.equal(original.split(before).length, 2, "unique mutation site");
    const mutated = original.replace(before, afterText).replaceAll('"./knowledge-profile.src.js"',
      JSON.stringify(new URL("../neural/src/knowledge-profile.src.js", import.meta.url).href))
      .replaceAll('"./knowledge-scenarios.src.js"', JSON.stringify(new URL("../neural/src/knowledge-scenarios.src.js", import.meta.url).href))
      .replaceAll('"./wire-keys.src.js"', JSON.stringify(new URL("../neural/src/wire-keys.src.js", import.meta.url).href));
    const module = await import("data:text/javascript;base64," + Buffer.from(mutated).toString("base64"));
    await assert.rejects(() => probe(module.ngKnowledgeScenarioManifestProduce), { name: "AssertionError" }); killed++;
  }
  assert.equal(killed, 4);
});

after(() => console.log(JSON.stringify({ scope: "tiny-source-manifest-contracts", calibratedRoleFrameComparisons: 48,
  rejectedCases, semanticMutantsKilled: 4, maxRSSKiB: process.resourceUsage().maxRSS })));
