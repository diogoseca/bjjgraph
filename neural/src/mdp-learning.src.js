/* Gameplan integration contract: compare JOINT hypothetical profiles through
 * separately reoptimized, fully stamped outcomes; exposure is from a separately
 * DECLARED baseline policy. Headroom, exposure, simulated outcome sensitivity and
 * real learning evidence remain distinct. No sum of per-deck win gains, no write
 * to persistent learning credit, and no claim about real grappling improvement.
 * Root injects actual complete solve/exposure providers. An absent provider or
 * unsupported defender row remains unavailable with positive coverage counts.
 */
function ngMdpValidOutcomes(outcomes) {
  return outcomes && NG_MDP_OUTCOMES.every(k => Number.isFinite(outcomes[k]) && outcomes[k] >= 0 && outcomes[k] <= 1) &&
    Math.abs(NG_MDP_OUTCOMES.reduce((sum, k) => sum + outcomes[k], 0) - 1) <= 1e-12;
}
function ngMdpStudyStampMatches(request, stamp) {
  if (!stamp || stamp.apiVersion !== 2 || stamp.requestId !== request.requestId || stamp.revision !== request.revision || stamp.contractHash !== ngMdpContractHash(request)) return false;
  return ['modelHash','mechanicsHash','graphHash','profileHash','opponentPolicyHash','ruleset','objective','horizon','futureStudyPolicy'].every(k => ngMdpStable(request[k]) === ngMdpStable(stamp[k]));
}
async function ngMdpEvaluateStudyScenarios(input, providers) {
  const request = input.request, scenarios = input.scenarios || [];
  const result = { apiVersion: 1, status: 'unavailable', stamp: ngMdpEnvelope(request), startDistribution: input.startDistribution,
    exposurePolicyId: input.exposurePolicyId, policySemantics: 'reoptimized', scenarios: [],
    coverage: { requestedScenarios: scenarios.length, readyScenarios: 0, requestedDecks: 0, readyDecks: 0 }, unresolvedReasons: [] };
  try {
    if (!Array.isArray(input.startDistribution) || !input.startDistribution.length) throw new Error('missing-start-distribution');
    let mass = ngMdpRat(0); const seen = new Set();
    for (const row of input.startDistribution) {
      if (!row.stateId || seen.has(row.stateId)) throw new Error('invalid-start-identity'); seen.add(row.stateId);
      mass = ngMdpAdd(mass, ngMdpProbability(row.probability));
    }
    if (ngMdpCmp(mass, ngMdpRat(1))) throw new Error('non-normalized-start-distribution');
    const startDistributionHash = ngMdpDigest(input.startDistribution.slice().sort((a,b) => a.stateId < b.stateId ? -1 : 1));
    result.startDistributionHash = startDistributionHash;
    if (!providers || typeof providers.evaluate !== 'function' || typeof providers.exposure !== 'function') throw new Error('unavailable-learning-provider');
    if (!input.exposurePolicyId) throw new Error('missing-exposure-policy');
    if (!input.baseline || input.baseline.profileHash !== request.profileHash || ngMdpContractHash(input.baseline.request) !== ngMdpContractHash(request)) throw new Error('stale-baseline-context');
    const common = { startDistribution: input.startDistribution, startDistributionHash, policySemantics: 'reoptimized' };
    const baseline = await providers.evaluate({ ...common, request });
    if (!baseline || baseline.status !== 'ready' || !baseline.policyId || !ngMdpValidOutcomes(baseline.outcomes) || !ngMdpStudyStampMatches(request, baseline.stamp) || baseline.startDistributionHash !== startDistributionHash) throw new Error('unavailable-or-stale-baseline');
    result.baseline = baseline;
    for (const scenario of scenarios) {
      const row = { id: scenario.id, status: 'unavailable', profileHash: scenario.profileHash, deckKeys: scenario.deckKeys || [] };
      result.coverage.requestedDecks += row.deckKeys.length;
      try {
        const changed = scenario.request;
        if (!scenario.id || !changed || changed.profileHash !== scenario.profileHash || !row.deckKeys.length) throw new Error('missing-scenario-context');
        for (const key of ['mechanicsHash','graphHash','opponentPolicyHash','ruleset','objective','horizon','futureStudyPolicy','state'])
          if (ngMdpStable(request[key]) !== ngMdpStable(changed[key])) throw new Error('incompatible-scenario-' + key);
        if (row.deckKeys.some(d => !['Top','Bottom','Attacker','Defender'].includes(d.role) || !d.deckKey.endsWith('|' + d.role) || !Number.isFinite(d.headroom) || d.headroom < 0 || d.headroom > 1)) throw new Error('invalid-role-headroom');
        const exposure = await providers.exposure({ request, ...common, policyId: input.exposurePolicyId, deckKeys: row.deckKeys });
        if (!exposure || exposure.status !== 'ready' || exposure.policyId !== input.exposurePolicyId || !ngMdpStudyStampMatches(request, exposure.stamp) || exposure.startDistributionHash !== startDistributionHash) throw new Error('unavailable-or-stale-exposure');
        if(exposure.stateEquivalence && exposure.stateEquivalence.exposureLabelsPreserved===false)throw new Error('value-only-compression-cannot-certify-deck-exposure');
        const records = row.deckKeys.map(d => (exposure.records || []).find(e => e.deckKey === d.deckKey && e.role === d.role));
        if (records.some(e => !e || e.status !== 'ready' || !['hitting-probability','expected-visits'].includes(e.kind) || !Number.isFinite(e.value) || e.value < 0 || (e.kind === 'hitting-probability' && e.value > 1))) throw new Error('unavailable-role-exposure');
        const value = await providers.evaluate({ ...common, request: changed, scenarioId: scenario.id, changes: scenario.changes });
        if (!value || value.status !== 'ready' || !value.policyId || !ngMdpValidOutcomes(value.outcomes) || !ngMdpStudyStampMatches(changed, value.stamp) || value.startDistributionHash !== startDistributionHash) throw new Error('unavailable-or-stale-scenario');
        Object.assign(row, { status: 'ready', stamp: value.stamp, exposure: records, headroom: Math.max(...row.deckKeys.map(d => d.headroom)),
          headroomSemantics: 'maximum-individual-input-bonus-headroom', baselinePolicyId: baseline.policyId, scenarioPolicyId: value.policyId,
          outcomes: value.outcomes, simulatedWinDelta: value.outcomes.win - baseline.outcomes.win });
        result.coverage.readyScenarios++; result.coverage.readyDecks += records.length;
      } catch (error) { row.reason = error.message; result.unresolvedReasons.push(scenario.id + ':' + error.message); }
      result.scenarios.push(row);
    }
    result.status = result.coverage.readyScenarios === scenarios.length && scenarios.length ? 'ready' : result.coverage.readyScenarios ? 'partial' : 'unavailable';
    return result;
  } catch (error) { result.unresolvedReasons.push(error.message); return result; }
}
if (typeof module !== 'undefined' && module.exports) module.exports = { ngMdpEvaluateStudyScenarios, ngMdpValidOutcomes, ngMdpStudyStampMatches };
