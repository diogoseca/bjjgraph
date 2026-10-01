// Worker-only static source admission. No live client, profile upload or solve.
import { ngKnowledgeScenarioManifestProduce } from "./knowledge-scenario-manifest.src.js";

const ngStudySourceNeed = (condition, reason) => { if (!condition) throw new Error(reason); };
function ngStudySourceFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(ngStudySourceFreeze); Object.freeze(value);
  }
  return value;
}

export function ngStudyCreateSources(configuration, dependencies) {
  const config = structuredClone(configuration), expected = config.expected;
  const sha = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  ngStudySourceNeed(expected && sha(expected.graphHash) && sha(expected.indexHash), "missing-study-source-hashes");
  for (const name of ["graphBytes", "indexBytes"])
    ngStudySourceNeed(Number.isSafeInteger(expected[name]) && expected[name] > 0, "invalid-study-source-size");
  ngStudySourceNeed(expected.lawHashes && ["identity", "model", "adapter", "knowledge", "certified", "exposure"]
    .every(name => sha(expected.lawHashes[name])), "missing-study-law-hashes");
  ngStudySourceNeed(config.registration?.graphHash === expected.graphHash, "stale-study-registration");
  ngStudySourceNeed(dependencies.identity && typeof dependencies.identity.ngMdpDigest === "function"
    && typeof dependencies.metadataHost?.load === "function", "missing-study-source-dependencies");
  const base = new URL(config.dataBase);
  ngStudySourceNeed(["http:", "https:"].includes(base.protocol) && !base.username && !base.password, "invalid-study-data-base");
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  base.search = ""; base.hash = "";
  const bounds = config.bounds;
  ngStudySourceNeed(bounds && expected.graphBytes <= bounds.maxGraphBytes
    && expected.indexBytes <= bounds.maxIndexBytes, "study-source-size-budget");
  const fetcher = dependencies.fetch || globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  let disposed = false, pending = null, admitted = null;
  const check = scope => ngStudySourceNeed(!disposed && !scope?.cancelled?.(), disposed ? "study-sources-disposed" : "cancelled");
  async function read(file, exactBytes) {
    check();
    const response = await fetcher(new URL(file, base).href, { signal: controller.signal, credentials: "omit" });
    ngStudySourceNeed(response.ok && response.body?.getReader, "study-source-fetch-failed");
    const reader = response.body.getReader(), chunks = []; let total = 0;
    try {
      for (;;) {
        const part = await reader.read(); check(); if (part.done) break;
        total += part.value.byteLength;
        if (total > exactBytes) { await reader.cancel(); throw new Error("study-source-size-mismatch"); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    ngStudySourceNeed(total === exactBytes, "study-source-size-mismatch");
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  }
  async function load(profile, scope = {}) {
    check(scope);
    const revision = profile?.contentRevision;
    ngStudySourceNeed(profile?.status === "ready" && typeof revision === "string" && revision.length > 0, "missing-study-content-revision");
    if (!pending && !admitted) {
      const attempt = Promise.all([
        read("graph-data.json", expected.graphBytes), read("flashcards/_index.json", expected.indexBytes),
        dependencies.metadataHost.load(config.registration),
      ]).then(async ([graphBytes, indexBytes, metadata]) => {
        check();
        const produced = await ngKnowledgeScenarioManifestProduce({ graphBytes, indexBytes,
          expected: { graphHash: expected.graphHash, indexHash: expected.indexHash, contentRevision: revision }, bounds });
        check();
        ngStudySourceNeed(produced.status === "ready", produced.reason || "study-manifest-unavailable");
        ngStudySourceNeed(metadata?.coverage?.status === "COMPLETE" && metadata.ruleset === config.registration.ruleset
          && metadata.lossAversion === config.registration.lossAversion, "incomplete-study-metadata");
        const admission = { metadataHash: dependencies.identity.ngMdpDigest(metadata), lawHashes: expected.lawHashes,
          rawGraphHash: expected.graphHash, rawIndexHash: expected.indexHash,
          mechanicsManifestHash: config.registration.manifestHash };
        return ngStudySourceFreeze({ metadata, verifiedManifest: produced, sourceProvenance: produced.provenance,
          admission, contentRevision: revision });
      });
      const tracked = attempt.then(value => { if (!disposed) admitted = value; return value; })
        .finally(() => { if (pending === tracked) pending = null; });
      pending = tracked;
    }
    const result = admitted || await pending; check(scope);
    ngStudySourceNeed(result.contentRevision === revision, "stale-study-content-revision");
    return result;
  }
  return { load, dispose() { disposed = true; admitted = null; controller.abort(); } };
}
