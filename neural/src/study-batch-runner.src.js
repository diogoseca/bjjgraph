// Proposed worker-only assembly of frozen producer/projector/coordinator APIs.
// Root's trusted raw loader and admitted bridge wrapper are explicit NEW seams.
// No solver implementation, source authenticity claim, or planner lives here.
export function ngGameplanStudyCreateBatchRunner(deps, bounds) {
  return async (job, control) => {
    const unavailable = (reason, receipts = {}) => ({ status: 'unavailable', reason, coordinator: null, receipts });
    let bridge;
    const receipts = {};
    try {
      for (const name of ['loadSources', 'manifestProduce', 'project', 'prepareBridge', 'coordinate', 'evaluateStudyScenarios', 'fingerprint'])
        if (typeof deps[name] !== 'function') return unavailable('missing-study-executor:' + name);
      control.check(); control.progress('sources');
      // The worker-bound loader fixes URLs from the trusted installation. Raw
      // hashes are checked by the frozen producer, never supplied as a callback.
      const source = await deps.loadSources(control.installation, control.check); control.check();
      const manifest = source.verifiedManifest || await deps.manifestProduce({ graphBytes: source.graphBytes, indexBytes: source.indexBytes,
        expected: { graphHash: control.installation.graphHash, indexHash: control.installation.indexHash,
          contentRevision: job.capture.contentRevision }, bounds: bounds.manifest });
      control.check();
      if (manifest?.status !== 'ready') return unavailable(manifest?.reason || 'unavailable-study-manifest', { manifest: manifest || null });
      const p = manifest.provenance;
      if (p?.kind !== 'verified-raw-study-manifest' || p.graphHash !== job.capture.graphHash || p.indexHash !== job.capture.indexHash
        || p.contentRevision !== job.capture.contentRevision || p.manifestHash !== manifest.manifest?.fingerprint)
        return unavailable('unbound-study-manifest');
      receipts.manifest = p;
      control.progress('projecting');
      const scenarios = [], ids = new Set(), receiptById = new Map(); receipts.scenarios = []; receipts.exposureCalls = [];
      for (const row of job.scenarios) {
        control.check();
        const projected = deps.project({ baselineProfile: job.baseline.profile, logicalContextHash: job.capture.logicalContextHash,
          ruleset: job.capture.ruleset, day: job.capture.day, manifest: manifest.manifest, targets: row.targets, bounds: bounds.projector });
        if (projected?.status !== 'ready') return unavailable(projected?.reason || 'unavailable-study-scenario', receipts);
        const proof = projected.provenance, scenario = projected.scenario;
        if (proof?.kind !== 'hypothetical-knowledge-input' || proof.targetSemantics !== 'declared-mechanics-input-no-earned-credit'
          || proof.baselineProfileHash !== job.capture.profileHash || proof.manifestHash !== p.manifestHash
          || proof.graphHash !== job.capture.graphHash || proof.logicalContextHash !== job.capture.logicalContextHash
          || proof.ruleset !== job.capture.ruleset || proof.day !== job.capture.day || proof.sharedClosure?.status !== 'validated'
          || !scenario?.profile || scenario.profileHash !== scenario.profile.fingerprint || ids.has(scenario.id))
          return unavailable('unbound-or-duplicate-projected-study-scenario', receipts);
        ids.add(scenario.id);
        const request = { ...job.baseline.request, requestId: job.baseline.request.requestId + ':scenario:' + scenario.id,
          profileHash: scenario.profileHash };
        delete request.contractHash;
        scenarios.push({ id: scenario.id, request, profile: scenario.profile, deckKeys: scenario.deckKeys, changes: scenario.changes });
        // Presenter v1 requires the ENTIRE actual projector output, including
        // unchanged closure peers and the hypothetical compact profile.
        const receipt = { id: scenario.id, projection: projected, evaluation: null, exposure: null };
        receipts.scenarios.push(receipt); receiptById.set(scenario.id, receipt);
      }
      control.check();
      // New root-owned seam: verify actual metadata/laws and complete intended
      // start scope, then construct the frozen ngStudyCreateBridge. Never return
      // a live client. The bridge's proposed exposure adapter is still missing.
      const prepared = await deps.prepareBridge({ job, manifest, source, check: control.check, limits: bounds.bridge });
      control.check();
      if (prepared?.status !== 'ready' || !prepared.bridge) return unavailable(prepared?.reason || 'unavailable-admitted-study-bridge', receipts);
      bridge = prepared.bridge;
      if (!['evaluate', 'exposure', 'release', 'clear'].every(name => typeof bridge[name] === 'function')) return unavailable('invalid-study-bridge', receipts);
      if (!prepared.receipt || typeof prepared.receipt !== 'object') return unavailable('missing-study-source-start-admission-receipt', receipts);
      receipts.startAdmission = prepared.receipt;
      control.progress('baseline');
      const baseline = await bridge.evaluate({ request: job.baseline.request, profile: job.baseline.profile,
        startDistribution: job.startDistribution, startDistributionHash: job.capture.startDistributionHash, policySemantics: 'reoptimized' });
      control.check(); receipts.baseline = baseline;
      if (baseline?.status !== 'ready' || !baseline.policyId) return unavailable('unavailable-study-baseline', receipts);
      control.progress('scenarios');
      let pendingExposure = null;
      const labels = keys => JSON.stringify(keys.map(d => [d.deckKey, d.role]));
      // Baseline preflight and callback have identical stamps/profile/runtime/
      // starts, so the frozen bridge reuses its validated private artifact.
      const coordinator = await deps.coordinate({ baseline: job.baseline, startDistribution: job.startDistribution,
        exposurePolicyId: baseline.policyId, scenarios, bounds: bounds.coordinator }, {
        fingerprint: deps.fingerprint, evaluateStudyScenarios: deps.evaluateStudyScenarios,
        evaluate: async args => {
          control.check();
          const receipt = args.scenarioId == null ? null : receiptById.get(args.scenarioId);
          if (args.scenarioId != null) {
            const scenario = scenarios.find(row => row.id === args.scenarioId);
            if (!receipt || !pendingExposure || labels(scenario.deckKeys) !== pendingExposure.labels)
              throw new Error('unbound-study-exposure-callback-order');
            // The frozen helper calls this immediately after that scenario's
            // exposure. Never guess association from identical deck sets alone.
            receipt.exposure = pendingExposure.result; pendingExposure = null;
          }
          try {
            const value = await bridge.evaluate(args);
            // Keep the immutable raw callback receipt before a freshness check
            // can throw; releasing its private kernel must not discard evidence.
            if (receipt) receipt.evaluation = value; else receipts.baseline = value;
            control.check();
            return value;
          } finally {
            // The serial coordinator never exposes or reevaluates a completed
            // hypothetical policy. Keep baseline artifacts for every exposure.
            // Pass the ORIGINAL complete context; do not rebuild a partial key.
            if (receipt) bridge.release(args);
          }
        },
        exposure: async args => {
          control.check(); const value = await bridge.exposure(args); control.check();
          pendingExposure = { labels: labels(args.deckKeys), result: value };
          receipts.exposureCalls.push({ deckKeys: args.deckKeys, result: value });
          return value;
        },
        isCurrent: () => { control.check(); return true; },
      });
      control.check();
      if (!coordinator || !['ready', 'partial', 'unavailable'].includes(coordinator.status)) return unavailable('invalid-study-coordinator-result', receipts);
      return { status: coordinator.status, coordinator, receipts,
        scenarioRequests: scenarios.map(s => ({ id: s.id, request: s.request })) };
    } catch (error) { return unavailable(error.message || 'study-batch-failed', receipts); }
    finally { bridge?.clear?.(); }
  };
}
