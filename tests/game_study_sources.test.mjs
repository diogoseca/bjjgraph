import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { ngKnowledgeFingerprint } from "../neural/src/knowledge-profile.src.js";
import { ngStudyCreateSources } from "../neural/src/game-study-sources.src.js";
import { ngWireDecks, ngWireDeckIndex } from "../neural/src/wire-keys.src.js";
const M = createRequire(import.meta.url)("../neural/src/mdp-identity.src.js");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const encode = value => new TextEncoder().encode(JSON.stringify(value));
function fixture() {
  const graph = { nodes: [{ id: "Positions/Mount", t: "Mount Top", ty: "positions", posId: "mount",
    cal: { avail: { gi: true, nogi: true }, stateAlias: null } }], links: [], toTab: [], evFrame: "nogi" };
  const index = { _meta: { format: 3, status: "generated" }, decks: { "Mount|Top": ["Position", 3], "Mount|Bottom": ["Position", 3] }, shared: {} };
  const gb = encode(graph), ib = encode(index), requests = [];
  const metadata = { version: 1, coverage: { status: "COMPLETE" }, ruleset: "gi", lossAversion: 1, nodes: graph.nodes };
  const config = { dataBase: "https://example.test/neural/", registration: { graphHash: sha(gb), ruleset: "gi", lossAversion: 1, manifestHash: "f".repeat(64) },
    expected: { graphHash: sha(gb), indexHash: sha(ib), graphBytes: gb.length, indexBytes: ib.length,
      lawHashes: Object.fromEntries(["identity", "model", "adapter", "knowledge", "certified", "exposure"].map(k => [k, "e".repeat(64)])) },
    bounds: { maxGraphBytes: 10000, maxIndexBytes: 10000, maxNodes: 20, maxDecks: 40, maxSharedGroups: 20, maxSharedMemberships: 100 } };
  const deps = { identity: M, metadataHost: { load: async () => metadata }, fetch: async (url, options) => {
    requests.push({ url, options }); return new Response(url.endsWith("graph-data.json") ? gb : ib);
  } };
  return { config, deps, profile: { status: "ready", contentRevision: ngKnowledgeFingerprint(ngWireDeckIndex(ngWireDecks(index, graph.nodes), index.shared)) }, metadata, gb, ib, requests };
}

test("real raw producer admission pins both sources and independently digests decoded metadata", async () => {
  const f = fixture(), loader = ngStudyCreateSources(f.config, f.deps);
  const first = await loader.load(f.profile), second = await loader.load(f.profile);
  assert.equal(first, second); assert.equal(first.verifiedManifest.status, "ready");
  assert.equal(first.verifiedManifest.provenance.coverage.decks, 2);
  assert.equal(first.admission.metadataHash, M.ngMdpDigest(f.metadata));
  assert.notEqual(first.admission.metadataHash, f.config.registration.manifestHash);
  assert.equal(first.admission.rawIndexHash, sha(f.ib)); assert.ok(Object.isFrozen(first));
  assert.equal(f.requests.length, 2);
  for (const { url, options } of f.requests) {
    assert.equal(new URL(url).origin, "https://example.test"); assert.equal(options.credentials, "omit");
    assert.equal(options.body, undefined); assert.equal(options.headers, undefined);
  }
});

test("equal-length raw graph or index tampering cannot reuse trusted hashes", async () => {
  for (const target of ["graph-data.json", "flashcards/_index.json"]) {
    const f = fixture(), real = f.deps.fetch;
    f.deps.fetch = async (url, options) => {
      if (!url.endsWith(target)) return real(url, options);
      const b = new Uint8Array(target.startsWith("graph") ? f.gb : f.ib); b[5] ^= 1; return new Response(b);
    };
    await assert.rejects(ngStudyCreateSources(f.config, f.deps).load(f.profile), /sha256-mismatch/);
  }
});

test("stream overflow cancels the reader before JSON admission", async () => {
  const f = fixture(); let cancelled = false;
  f.deps.fetch = async () => ({ ok: true, body: new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(10000)); }, cancel() { cancelled = true; },
  }) });
  await assert.rejects(ngStudyCreateSources(f.config, f.deps).load(f.profile), /size-mismatch/);
  assert.equal(cancelled, true);
});

test("content revision is checked again even for a cached admitted source", async () => {
  const f = fixture(), loader = ngStudyCreateSources(f.config, f.deps); await loader.load(f.profile);
  await assert.rejects(loader.load({ ...f.profile, contentRevision: "different" }), /stale-study-content/);
  const g = fixture(); await assert.rejects(ngStudyCreateSources(g.config, g.deps).load({ ...g.profile, contentRevision: "wrong" }), /revision/);
});

test("immediate retry after failed fetch creates a new attempt without a rejected cache", async () => {
  const f = fixture(), real = f.deps.fetch; let fail = true;
  f.deps.fetch = async (...args) => fail ? new Response("", { status: 503 }) : real(...args);
  const loader = ngStudyCreateSources(f.config, f.deps);
  await assert.rejects(loader.load(f.profile), /fetch-failed/); fail = false;
  assert.equal((await loader.load(f.profile)).verifiedManifest.status, "ready");
});

test("late metadata completion cannot deliver after disposal or caller cancellation", async () => {
  for (const dispose of [false, true]) {
    const f = fixture(); let release, cancelled = false;
    f.deps.metadataHost.load = () => new Promise(resolve => { release = resolve; });
    const loader = ngStudyCreateSources(f.config, f.deps), waiting = loader.load(f.profile, { cancelled: () => cancelled });
    if (dispose) loader.dispose(); else cancelled = true;
    release(f.metadata); await assert.rejects(waiting, /disposed|cancelled/);
    if (dispose) {
      for (const r of f.requests) assert.equal(r.options.signal.aborted, true);
      await assert.rejects(loader.load(f.profile), /disposed/);
    }
  }
});

test("incomplete or wrong-frame decoded metadata refuses admission", async () => {
  for (const change of [{ coverage: { status: "PARTIAL" } }, { ruleset: "nogi" }, { lossAversion: 4 }]) {
    const f = fixture(); Object.assign(f.metadata, change);
    await assert.rejects(ngStudyCreateSources(f.config, f.deps).load(f.profile), /incomplete-study-metadata/);
  }
});

test("trusted installation is pinned independently of later caller mutations", async () => {
  const f = fixture(), loader = ngStudyCreateSources(f.config, f.deps);
  f.config.expected.indexHash = "0".repeat(64); f.config.dataBase = "https://untrusted.test/";
  const value = await loader.load(f.profile);
  assert.equal(value.admission.rawIndexHash, sha(f.ib));
  assert.ok(f.requests.every(r => r.url.startsWith("https://example.test/")));
  assert.throws(() => ngStudyCreateSources({ ...f.config, expected: { ...f.config.expected, lawHashes: {} } }, f.deps), /law-hashes/);
});
