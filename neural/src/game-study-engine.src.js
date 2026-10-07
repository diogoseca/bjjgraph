// Worker-only assembly. Build/host owns source trust, admission and hard deadline.
import { ngStudyCreateSources } from "./game-study-sources.src.js";
import { ngKnowledgeScenarioManifestProduce } from "./knowledge-scenario-manifest.src.js";
import { ngKnowledgeScenarioProject } from "./knowledge-scenarios.src.js";
import { ngGameplanStudyCreateBatchRunner } from "./study-batch-runner.src.js";
import { ngStudyCreateBridge } from "./study-native-bridge.src.js";
import { ngGameplanStudyProvider } from "./gameplan-study-provider.src.js";
import { ngStudyDemand, ngStudyInstallation, ngStudyLimits, ngStudySnapshot, ngStudyJsonLimits } from "./study-scheduler.src.js";

const need = (ok, reason) => { if (!ok) throw new Error(reason); };
const nativeKeys = ["modelHash", "mechanicsHash", "graphHash", "opponentPolicyHash", "ruleset"];
const unavailable = reason => ({ status: "unavailable", reason, coordinator: null, receipts: {} });

export function ngStudyCreateEngine(configuration, dependencies) {
  const { M, G, K, E, evaluateStudyScenarios, metadataHost, fetch: fetcher } = dependencies;
  const limits = ngStudyLimits(configuration?.bounds?.scheduler);
  const config = ngStudySnapshot(configuration, ngStudyJsonLimits(limits));
  for (const [space, names] of [[M, ["ngMdpDigest", "ngMdpStable", "ngMdpContractHash", "ngMdpEnvelope", "ngMdpSolveAsync"]],
    [G, ["ngMdpCreateGameAdapter"]], [K, ["ngKnowledgeFingerprint", "ngKnowledgeOverride"]],
    [E, ["ngMdpEvaluateFixedPolicyAsync", "ngMdpCreateExposureAdapter", "ngMdpEvaluateExposureAsync", "ngMdpExposureProviderRecord"]]])
    need(space && names.every(name => typeof space[name] === "function"), "missing-study-native-namespace");
  need(typeof evaluateStudyScenarios === "function" && typeof metadataHost?.load === "function", "missing-study-engine-dependencies");
  const installation = ngStudyInstallation(config.installation, M, limits), expected = config.expected;
  need(expected && installation.graphHash === expected.graphHash && installation.indexHash === expected.indexHash
    && M.ngMdpStable(installation.lawHashes) === M.ngMdpStable(expected.lawHashes), "stale-study-engine-installation");
  need(config.registration && nativeKeys.every(k => typeof config.registration[k] === "string" && config.registration[k])
    && config.registration.graphHash === expected.graphHash, "invalid-study-engine-registration");
  for (const key of ["manifest", "projector", "coordinator", "bridge"])
    need(config.bounds[key] && typeof config.bounds[key] === "object", "missing-study-engine-bounds:" + key);
  const registration = Object.fromEntries(nativeKeys.map(k => [k, config.registration[k]]));
  let dead = false, active = null;

  // Revoke references before invoking cleanup. One throwing owner cannot retain
  // another resource, and a reentrant dispose cannot release either twice.
  function release(token) {
    if (!token) return null;
    const clear = token.clear, source = token.source;
    token.clear = null; token.source = null;
    let error = null;
    for (const cleanup of [clear, source && (() => source.dispose())]) {
      try { cleanup?.(); } catch (failure) {
        if (!error) error = failure instanceof Error ? failure : new Error("study-engine-cleanup-failed");
      }
    }
    return error;
  }

  async function execute(input, control) {
    if (dead) return unavailable("study-engine-disposed");
    if (active) return unavailable("study-engine-busy");
    const token = { source: null, clear: null }; active = token;
    const check = () => {
      need(!dead && active === token, "study-engine-disposed");
      need(typeof control?.check === "function", "missing-study-engine-lifecycle");
      control.check();
    };
    try {
      check();
      need(M.ngMdpStable(control.installation) === M.ngMdpStable(installation), "stale-study-worker-installation");
      const { job, key } = ngStudyDemand(input, { identity: M, fingerprint: K.ngKnowledgeFingerprint }, limits, installation);
      const request = job.baseline.request;
      for (const name of nativeKeys) need(request[name] === registration[name], "stale-study-engine-registration:" + name);
      need(typeof request.requestId === "string" && request.requestId && Number.isSafeInteger(request.revision)
        && request.objective === M.NG_MDP_OBJECTIVE && request.futureStudyPolicy === "no-additional-study-events", "invalid-study-engine-request");
      need(!request.contractHash || request.contractHash === M.ngMdpContractHash(request), "stale-study-engine-contract");
      const h = request.horizon;
      need(h && ["actual-roll", "eventual"].includes(h.kind), "invalid-study-engine-horizon");
      if (h.kind === "actual-roll") need(Number.isSafeInteger(h.episodeCap) && h.episodeCap > 0
        && Number.isSafeInteger(h.moveCount) && h.moveCount >= 0, "invalid-study-engine-clock");
      token.source = ngStudyCreateSources({ expected, registration: config.registration, dataBase: config.dataBase,
        bounds: config.bounds.manifest }, { identity: M, metadataHost, fetch: fetcher });
      const run = ngGameplanStudyCreateBatchRunner({
        loadSources: async () => {
          check(); const value = await token.source.load(job.baseline.profile, { cancelled: () => { check(); return false; } });
          check(); return value;
        },
        manifestProduce: ngKnowledgeScenarioManifestProduce,
        project: ngKnowledgeScenarioProject,
        coordinate: ngGameplanStudyProvider,
        evaluateStudyScenarios,
        fingerprint: K.ngKnowledgeFingerprint,
        prepareBridge: async ({ source }) => {
          check();
          const { metadata, admission } = source;
          need(admission.metadataHash === M.ngMdpDigest(metadata), "stale-study-decoded-metadata");
          const createAdapter = (profile, runtime) => G.ngMdpCreateGameAdapter(metadata, profile, K, runtime);
          const bridge = ngStudyCreateBridge({ state: request.state, context: { horizon: request.horizon,
            objective: request.objective, futureStudyPolicy: request.futureStudyPolicy },
            runtime: job.runtime, starts: job.startSnapshots, registration, admission, limits: config.bounds.bridge }, {
            identity: M, math: M, fingerprint: K.ngKnowledgeFingerprint, createAdapter,
            isCurrent: () => { check(); return true; }, cancelled: () => { check(); return false; },
            solve: (model, nativeRequest, bounds) => M.ngMdpSolveAsync(model, nativeRequest, bounds),
            evaluateFixed: (model, nativeRequest, policy, bounds) =>
              E.ngMdpEvaluateFixedPolicyAsync(model, nativeRequest, policy, { identity: M, math: M }, bounds),
            exposure: async ({ binding, startDistribution, startDistributionHash, labels, profile, runtime }, bounds) => {
              check();
              need(binding.kind === "native-solver" && Array.isArray(binding.evaluation.policy), "missing-study-complete-native-policy");
              const nativeRequest = binding.request;
              const adapter = E.ngMdpCreateExposureAdapter({ metadata, profile, knowledge: K,
                adapter: createAdapter(profile, runtime), identity: M, request: nativeRequest, lawHashes: admission.lawHashes });
              const rows = binding.evaluation.policy.map(([stateId, actionId]) => ({ stateId, actions: [{ actionId, probability: 1 }] }));
              const raw = await E.ngMdpEvaluateExposureAsync({ request: nativeRequest, startDistribution, startDistributionHash,
                labels, measure: "hitting-probability", adapter, policy: { id: binding.evaluation.root.policyId,
                  contractHash: M.ngMdpContractHash(nativeRequest), startDistributionHash, rows, binding } },
                { identity: M, math: M }, bounds);
              check();
              return E.ngMdpExposureProviderRecord(raw, "hitting-probability");
            },
          });
          let cleared = false;
          token.clear = () => { if (!cleared) { cleared = true; bridge.clear(); } };
          return { status: "ready", bridge: { ...bridge, clear: token.clear }, receipt: {
            kind: "verified-study-engine-admission", installationId: installation.id, demandHash: key,
            registration, admission, startDistributionHash: job.capture.startDistributionHash,
            startMappingHash: job.capture.startMappingHash, declaredStarts: job.startDistribution.length,
            physicalLegality: "validated-by-native-union-before-ready-evaluation", behaviorCompression: false,
          } };
        },
      }, config.bounds);
      return await run(job, { installation, check, progress: phase => { check(); control.progress?.(phase); } });
    } catch (error) {
      return unavailable(error.message || "study-engine-failed");
    } finally {
      const failure = release(token);
      if (active === token) active = null;
      // Teardown is part of admission: never publish ready after cleanup failed.
      if (failure) return unavailable(failure.message || "study-engine-cleanup-failed");
    }
  }
  return Object.freeze({ execute, dispose() {
    dead = true;
    const failure = release(active);
    if (failure) throw failure;
  } });
}
