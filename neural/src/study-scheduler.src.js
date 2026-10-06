// Proposed isolated study transport. No DOM, storage, live client or solver.
export const NG_GAMEPLAN_STUDY_PROTOCOL = 'bjj-gameplan-study-v1';
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
const need = (ok, reason) => { if (!ok) throw new Error(reason); };
const integer = n => Number.isSafeInteger(n) && n >= 0;
const text = s => typeof s === 'string' && s.length > 0;
const sha = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);

// Preserve object insertion order (format3 deck ordinals are semantic). Never
// invoke getters or JSON.stringify an unvalidated caller-owned object.
export function ngStudySnapshot(value, limits) {
  let nodes = 0, characters = 0;
  const path = new Set();
  const copy = (v, depth) => {
    need(++nodes <= limits.maxNodes && depth <= limits.maxDepth, 'study-json-node-or-depth-budget');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') { need(Number.isFinite(v), 'nonfinite-study-json'); return v; }
    if (typeof v === 'string') { characters += v.length; need(characters <= limits.maxBytes, 'study-json-byte-budget'); return v; }
    need(v && typeof v === 'object' && !path.has(v), 'non-json-or-cyclic-study-input');
    need(Array.isArray(v) || [Object.prototype, null].includes(Object.getPrototypeOf(v)), 'exotic-study-json');
    path.add(v);
    const keys = Reflect.ownKeys(v), descriptors = Object.getOwnPropertyDescriptors(v), array = Array.isArray(v);
    const dataKeys = array ? keys.filter(k => k !== 'length') : keys;
    if (array) need(dataKeys.length === v.length && dataKeys.every((k, i) => k === String(i)), 'sparse-or-extended-study-array');
    const out = array ? [] : {};
    for (const k of dataKeys) {
      const d = descriptors[k];
      need(typeof k === 'string' && d.enumerable && own(d, 'value'), 'accessor-or-hidden-study-field');
      characters += k.length; need(characters <= limits.maxBytes, 'study-json-byte-budget');
      Object.defineProperty(out, k, { value: copy(d.value, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    path.delete(v); return Object.freeze(out);
  };
  const result = copy(value, 0);
  need(new TextEncoder().encode(JSON.stringify(result)).byteLength <= limits.maxBytes, 'study-json-byte-budget');
  return result;
}

export function ngStudyLimits(input) {
  const keys = ['maxRequestNodes', 'maxRequestBytes', 'maxResultNodes', 'maxResultBytes', 'maxDepth',
    'maxStarts', 'maxScenarios', 'maxTargets', 'maxQueueMilliseconds', 'maxRunMilliseconds'];
  need(input && keys.every(k => Number.isSafeInteger(input[k]) && input[k] > 0), 'invalid-study-scheduler-limits');
  return Object.freeze(Object.fromEntries(keys.map(k => [k, input[k]])));
}
export const ngStudyJsonLimits = (limits, result = false) => ({ maxNodes: result ? limits.maxResultNodes : limits.maxRequestNodes,
  maxBytes: result ? limits.maxResultBytes : limits.maxRequestBytes, maxDepth: limits.maxDepth });

export function ngStudyInstallation(input, identity, limits) {
  const value = ngStudySnapshot(input, ngStudyJsonLimits(limits));
  need(Object.keys(value).sort().join(',') === 'graphHash,id,indexHash,lawHashes', 'invalid-study-installation');
  need(sha(value.graphHash) && sha(value.indexHash) && value.lawHashes && !Array.isArray(value.lawHashes)
    && Object.keys(value.lawHashes).length > 0 && Object.values(value.lawHashes).every(sha), 'invalid-study-source-identities');
  need(value.id === identity.ngMdpDigest({ graphHash: value.graphHash, indexHash: value.indexHash, lawHashes: value.lawHashes }), 'invalid-study-installation-id');
  return value;
}

export function ngStudyDemand(input, deps, limits, installation) {
  const job = ngStudySnapshot(input, ngStudyJsonLimits(limits));
  need(Object.keys(job).sort().join(',') === 'baseline,capture,runtime,scenarios,startDistribution,startSnapshots', 'invalid-study-demand-envelope');
  const c = job.capture, request = job.baseline?.request, profile = job.baseline?.profile, M = deps.identity;
  need(job.baseline && Object.keys(job.baseline).sort().join(',') === 'profile,request', 'invalid-study-baseline-envelope');
  const profileFields = ['version', 'revision', 'contentRevision', 'evidenceRevision', 'day', 'studyPolicy', 'permanent', 'sharp',
    'userMods', 'filmLook', 'flowCounts', 'status', 'diagnostics', 'fingerprint'];
  need(profile && Object.keys(profile).every(k => profileFields.includes(k)), 'noncompact-study-profile');
  const fields = ['ownerEpoch', 'day', 'ruleset', 'profileHash', 'profileRevision', 'evidenceRevision', 'contentRevision',
    'residencyHash', 'residencyRevision', 'logicalContextHash', 'startDistributionHash', 'startMappingHash',
    'installationId', 'graphHash', 'indexHash'];
  need(c && Object.keys(c).sort().join(',') === fields.sort().join(','), 'invalid-study-capture');
  need(text(c.ownerEpoch) && integer(c.day) && integer(c.profileRevision) && integer(c.residencyRevision)
    && ['gi', 'nogi'].includes(c.ruleset), 'invalid-study-owner-day-ruleset');
  for (const k of ['profileHash', 'evidenceRevision', 'contentRevision', 'logicalContextHash']) need(text(c[k]), 'missing-study-identity:' + k);
  need(c.installationId === installation.id && c.graphHash === installation.graphHash && c.indexHash === installation.indexHash, 'stale-study-installation');
  need(profile?.version === 1 && profile.status === 'ready' && profile.fingerprint === c.profileHash
    && profile.revision === c.profileRevision && profile.evidenceRevision === c.evidenceRevision
    && profile.contentRevision === c.contentRevision && profile.day === c.day, 'stale-study-profile');
  const body = Object.fromEntries(Object.entries(profile).filter(([k]) => k !== 'fingerprint'));
  need(deps.fingerprint(body) === profile.fingerprint, 'study-profile-fingerprint-mismatch');
  need(request?.apiVersion === 2 && request.profileHash === c.profileHash && request.ruleset === c.ruleset
    && request.graphHash === c.graphHash && request.futureStudyPolicy === profile.studyPolicy
    && request.state && !own(request.state, 'snapshotId') && !own(request.state, 'snapshotHash')
    && !own(request, 'requestedActionIds'), 'invalid-logical-study-request');
  need(M.ngMdpContractHash(request) === c.logicalContextHash, 'stale-study-context');
  need(job.runtime && Object.keys(job.runtime).sort().join(',') === 'deckReady,residencyRevision'
    && job.runtime.deckReady && !Array.isArray(job.runtime.deckReady) && Object.values(job.runtime.deckReady).every(v => v === true), 'invalid-study-residency');
  need(job.runtime.residencyRevision === c.residencyRevision && M.ngMdpDigest(job.runtime) === c.residencyHash, 'stale-study-residency');
  const starts = job.startDistribution, mappings = job.startSnapshots;
  need(Array.isArray(starts) && starts.length > 0 && starts.length <= limits.maxStarts && Array.isArray(mappings)
    && mappings.length === starts.length, 'missing-or-over-limit-complete-study-starts');
  const ids = new Set(), mapped = new Set();
  for (const row of starts) {
    need(row && Object.keys(row).sort().join(',') === 'probability,stateId' && text(row.stateId) && !ids.has(row.stateId)
      && (typeof row.probability === 'string' && text(row.probability) || typeof row.probability === 'number' && Number.isFinite(row.probability)), 'invalid-study-start-row');
    ids.add(row.stateId);
  }
  for (const row of mappings) {
    need(row && Object.keys(row).sort().join(',') === 'snapshot,stateId' && ids.has(row.stateId) && !mapped.has(row.stateId)
      && row.snapshot && typeof row.snapshot === 'object' && !Array.isArray(row.snapshot), 'incomplete-study-start-mapping');
    mapped.add(row.stateId);
  }
  const byId = (a, b) => a.stateId < b.stateId ? -1 : a.stateId > b.stateId ? 1 : 0;
  need(M.ngMdpDigest(starts.slice().sort(byId)) === c.startDistributionHash
    && M.ngMdpDigest(mappings.slice().sort(byId)) === c.startMappingHash, 'stale-study-start-identities');
  need(Array.isArray(job.scenarios) && job.scenarios.length > 0 && job.scenarios.length <= limits.maxScenarios, 'empty-or-over-limit-study-scenarios');
  for (const s of job.scenarios) need(s && Object.keys(s).join(',') === 'targets' && Array.isArray(s.targets)
    && s.targets.length > 0 && s.targets.length <= limits.maxTargets, 'invalid-or-over-limit-study-targets');
  // Exact probability normalization and physical legality belong to the native
  // bridge. This check never substitutes approximate JS summation for that law.
  return { job, key: M.ngMdpDigest({ protocol: NG_GAMEPLAN_STUDY_PROTOCOL, installation, job }) };
}

export function ngGameplanStudyCreateScheduler(deps, inputLimits) {
  const limits = ngStudyLimits(inputLimits), installation = ngStudyInstallation(deps.installation, deps.identity, limits);
  for (const name of ['fingerprint', 'isCurrent', 'admit', 'createWorker']) need(typeof deps[name] === 'function', 'missing-study-scheduler:' + name);
  const now = deps.now || (() => performance.now()), setTimer = deps.setTimer || setTimeout, clearTimer = deps.clearTimer || clearTimeout;
  let serial = 0, active = null, dead = false, admissionInFlight = null;
  const current = token => !dead && active === token && !token.done && deps.isCurrent(token.job.capture) === true;
  const emit = (token, phase, details = {}) => {
    try { deps.onStatus?.(Object.freeze({ jobId: token?.id || null, key: token?.key || null, phase, ...details })); } catch (_) { /* observer cannot control ownership */ }
  };
  const release = (token, lease) => {
    if (!lease || typeof lease.release !== 'function' || token.released.has(lease)) return;
    token.released.add(lease);
    try { lease.release(); } catch (_) { token.cleanupErrors.push('admission-release-failed'); }
  };
  const finish = (token, reason, result = null) => {
    if (token.done) return;
    token.done = true; token.controller.abort(reason || 'completed');
    clearTimer(token.queueTimer); clearTimer(token.runTimer);
    if (token.worker) {
      try {
        if (reason) token.worker.postMessage?.({ protocol: NG_GAMEPLAN_STUDY_PROTOCOL, type: 'cancel', jobId: token.id, key: token.key });
        token.worker.removeEventListener?.('message', token.message); token.worker.removeEventListener?.('error', token.error);
      } catch (_) { /* hard termination still owns cancellation */ }
      try { token.worker.terminate?.(); } catch (_) { token.cleanupErrors.push('study-worker-termination-failed'); }
    }
    release(token, token.lease);
    if (active === token) active = null;
    reason ||= token.cleanupErrors[0] || null;
    const value = Object.freeze({ protocol: NG_GAMEPLAN_STUDY_PROTOCOL, jobId: token.id, key: token.key,
      capture: token.job.capture, transportStatus: reason ? 'unavailable' : 'complete', reason,
      result: reason ? null : result, receipt: Object.freeze({ ownerEpoch: token.job.capture.ownerEpoch,
        installationId: installation.id, admissionId: token.lease?.id || null, submittedAt: token.started,
        admittedAt: token.admittedAt ?? null, finishedAt: now(), cleanupErrors: Object.freeze(token.cleanupErrors.slice()) }) });
    emit(token, reason ? 'unavailable' : 'complete', { reason, resultStatus: result?.status || null }); token.resolve(value);
  };
  const start = async token => {
    if (token.admitting || token.done) return;
    if (admissionInFlight) { emit(token, 'queued', { dependency: 'previous-study-admission' }); return; }
    admissionInFlight = token;
    token.admitting = true; emit(token, 'admitting');
    let lease;
    try {
      if (!current(token)) return finish(token, 'stale-study-capture');
      lease = await deps.admit(Object.freeze({ jobId: token.id, key: token.key, capture: token.job.capture,
        scope: Object.freeze({ starts: token.job.startDistribution.length, scenarios: token.job.scenarios.length }) }), token.controller.signal);
      if (!current(token)) { release(token, lease); return finish(token, 'stale-study-capture'); }
      if (lease?.status === 'deferred') {
        need(text(lease.dependency), 'unnamed-study-admission-dependency'); emit(token, 'queued', { dependency: lease.dependency }); return;
      }
      need(lease?.status === 'admitted' && text(lease.id) && Number.isFinite(lease.expiresAt)
        && lease.expiresAt > now() && typeof lease.release === 'function', 'invalid-study-admission-lease');
      token.lease = lease; token.admittedAt = now(); clearTimer(token.queueTimer);
      token.runTimer = setTimer(() => finish(token, 'study-hard-deadline'), Math.min(limits.maxRunMilliseconds, lease.expiresAt - now()));
      token.worker = deps.createWorker();
      need(token.worker && ['postMessage', 'addEventListener', 'removeEventListener', 'terminate'].every(k => typeof token.worker[k] === 'function'), 'invalid-study-worker');
      token.message = event => {
        try {
          if (!current(token)) return finish(token, 'stale-study-capture');
          const message = ngStudySnapshot(event.data, ngStudyJsonLimits(limits, true));
          if (message.protocol !== NG_GAMEPLAN_STUDY_PROTOCOL || message.jobId !== token.id || message.key !== token.key) return;
          if (message.type === 'accepted') return emit(token, 'working', { stage: 'worker-input-admitted' });
          if (message.type === 'progress') {
            need(['sources', 'projecting', 'baseline', 'scenarios'].includes(message.stage), 'invalid-study-progress');
            return emit(token, 'working', { stage: message.stage });
          }
          if (message.type === 'error') return finish(token, text(message.reason) ? message.reason : 'study-worker-error');
          need(message.type === 'result' && message.result && ['ready', 'partial', 'unavailable'].includes(message.result.status), 'invalid-study-worker-result');
          finish(token, null, message.result);
        } catch (error) { finish(token, error.message || 'study-response-failed'); }
      };
      token.error = () => finish(token, 'study-worker-error');
      token.worker.addEventListener('message', token.message); token.worker.addEventListener('error', token.error);
      emit(token, 'starting');
      token.worker.postMessage(ngStudySnapshot({ protocol: NG_GAMEPLAN_STUDY_PROTOCOL, type: 'run', jobId: token.id, key: token.key, job: token.job }, ngStudyJsonLimits(limits)));
    } catch (error) {
      if (lease !== token.lease) release(token, lease);
      finish(token, error.message || 'study-admission-failed');
    } finally {
      token.admitting = false;
      if (admissionInFlight === token) admissionInFlight = null;
      // A superseded admission may ignore AbortSignal. Retain at most ONE such
      // request; do not create an unbounded chain of pending root callbacks.
      if (active && active !== token && !active.worker && !active.done) void start(active);
    }
  };
  return Object.freeze({
    submit(input) {
      if (dead) return Promise.resolve(Object.freeze({ transportStatus: 'unavailable', reason: 'study-scheduler-destroyed', result: null }));
      let captured;
      try { captured = ngStudyDemand(input, deps, limits, installation); need(deps.isCurrent(captured.job.capture) === true, 'stale-study-capture'); }
      catch (error) { return Promise.resolve(Object.freeze({ transportStatus: 'unavailable', reason: error.message, result: null })); }
      if (active?.key === captured.key && !active.done) return active.promise;
      if (active) finish(active, 'study-superseded');
      const token = { ...captured, id: 'study:' + (++serial), started: now(), done: false, admitting: false,
        controller: new AbortController(), released: new Set(), cleanupErrors: [] };
      token.promise = new Promise(resolve => { token.resolve = resolve; }); active = token;
      token.queueTimer = setTimer(() => finish(token, 'study-queue-deadline'), limits.maxQueueMilliseconds);
      emit(token, 'queued', { dependency: 'root-admission' }); void start(token); return token.promise;
    },
    retryAdmission() { if (active && !active.worker) void start(active); },
    invalidate(reason = 'study-context-invalidated') { if (active) finish(active, reason); },
    destroy() { if (dead) return; dead = true; if (active) finish(active, 'study-scheduler-destroyed'); },
  });
}
