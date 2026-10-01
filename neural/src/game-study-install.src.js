// Deferred browser installer only. No boot I/O, live-client or solver import.
import { ngStudyCreateInputs } from './game-study-inputs.src.js';
import { ngGameplanStudyCreateHost } from './gameplan-study-host.src.js';
import { ngGameplanStudyCreateScheduler, ngStudySnapshot, ngStudyLimits,
  ngStudyInstallation, ngStudyJsonLimits } from './study-scheduler.src.js';
import { ngGameplanStudyPresent } from './gameplan-study-presenter.src.js';

const slots = new WeakMap(); let serial = 0;
function need(ok, reason) {
  if (!ok) { const error = new Error(reason); error.phase = 'unavailable'; error.code = reason; throw error; }
}

export function ngGameplanStudyInstall(app, options) {
  const M = options.identity, K = options.knowledge;
  need(M && ['ngMdpDigest','ngMdpStable','ngMdpContractHash','ngMdpEnvelope'].every(k => typeof M[k] === 'function')
    && typeof K?.ngKnowledgeFingerprint === 'function', 'missing-study-install-runtime');
  need(Number.isSafeInteger(options.attempt) && options.attempt > 0 && options.ownerStamp
    && typeof options.isCurrent === 'function', 'missing-study-install-generation');
  const limits = ngStudyLimits(options.build?.computation?.study?.scheduler);
  const build = ngStudySnapshot(options.build, ngStudyJsonLimits(limits));
  need(typeof options.expectedVersion === 'string' && build.version === options.expectedVersion, 'incompatible-study-install-version');
  const body = { graphHash: build.sources?.graphHash, indexHash: build.sources?.indexHash, lawHashes: build.sources?.lawHashes };
  const installation = ngStudyInstallation({ ...body, id: M.ngMdpDigest(body) }, M, limits);
  need(build.mechanics?.graphHash === installation.graphHash && Array.isArray(build.variants), 'incompatible-study-install-sources');
  const buildKey = M.ngMdpDigest(build), instance = 'study-install:' + (++serial);
  const presenterBounds = options.presenterBounds;
  need(presenterBounds && ['maxScenarios','maxDecks','maxEvidenceNodes','maxStringLength'].every(k =>
    Number.isSafeInteger(presenterBounds[k]) && presenterBounds[k] > 0), 'missing-study-presenter-bounds');
  const basicCurrent = () => !app.__ngDestroyed && app._progressLoaded === true
    && app._progressOwnerStamp === options.ownerStamp && app._progressCurrent?.() === true && options.isCurrent() === true;
  const graphCurrent = () => app._gameValueGraph?.status === 'verified' && app._gameValueGraph.hash === installation.graphHash;
  need(basicCurrent(), 'stale-study-install-owner-or-generation');
  need(graphCurrent(), 'unverified-study-install-graph');
  need(typeof app._dataBase === 'function' && typeof options.documentURL === 'string', 'missing-study-install-location');
  const base = new URL(app._dataBase() || './', options.documentURL);
  need(['http:','https:'].includes(base.protocol) && !base.username && !base.password, 'invalid-study-install-location');
  if (!base.pathname.endsWith('/')) base.pathname += '/'; base.search = ''; base.hash = '';
  const workerURL = new URL('app/game-study.worker.js', base);
  workerURL.searchParams.set('v', build.version); workerURL.searchParams.set('content', buildKey);
  workerURL.searchParams.set('attempt', String(options.attempt)); workerURL.searchParams.set('instance', instance);
  const WorkerClass = options.Worker === undefined ? globalThis.Worker : options.Worker;
  const capabilityReason = typeof WorkerClass !== 'function' ? 'unavailable-study-worker-capability'
    : typeof options.admit !== 'function' ? 'missing-browser-study-admission-policy' : null;
  const slot = slots.get(app) || { record: null, pending: null, lease: null };
  slots.set(app, slot);
  // The old host's scheduler terminates only its own worker and releases its own
  // lease. A pending external admission remains in the shared slot until settled.
  slot.record?.host?.destroy();
  const record = { host: null }; slot.record = record;
  const current = () => slot.record === record && basicCurrent() && graphCurrent()
    && M.ngMdpDigest(options.build) === buildKey;
  const report = error => { try { options.reportError?.(error); } catch (_) { /* observer */ } };
  const inputs = ngStudyCreateInputs({ identity: M, knowledge: K,
    readDeclaration: owner => structuredClone(owner._gameplanStudyDeclaration) });
  const runtime = Object.freeze({ NG_GAMEPLAN_STUDY_BUILD: build, ngGameplanStudyCreateScheduler, ngStudySnapshot, ngGameplanStudyPresent });
  async function admit(meta, signal) {
    need(current() && !signal.aborted, 'stale-study-install-admission');
    need(!capabilityReason, capabilityReason);
    if (slot.pending || slot.lease) return { status: 'deferred', dependency: slot.pending ? 'previous-study-admission' : 'previous-study-worker' };
    const pending = { record }; slot.pending = pending;
    let backend = null, wrapped = null;
    try {
      backend = await options.admit(meta, signal);
      if (backend?.status === 'admitted') {
        need(typeof backend.release === 'function', 'invalid-study-admission-lease');
        let released = false;
        wrapped = { ...backend, release() {
          if (released) return; released = true;
          if (slot.lease === wrapped) slot.lease = null;
          backend.release?.();
        } };
      }
      if (!current() || signal.aborted) { wrapped?.release(); need(false, 'stale-study-install-admission'); }
      if (wrapped) { slot.lease = wrapped; return wrapped; }
      return backend;
    } finally {
      if (slot.pending === pending) slot.pending = null;
      // Resume only an existing newer host intent; never create study demand.
      if (slot.record !== record) Promise.resolve().then(() => slot.record?.host?.reconcile('previous-study-admission-settled')).catch(report);
    }
  }
  const host = ngGameplanStudyCreateHost(app, {
    runtime, identity: M, fingerprint: K.ngKnowledgeFingerprint, presenterBounds: { ...presenterBounds },
    readInputIdentity(owner) {
      if (!current()) return { status: 'unavailable', reason: 'stale-study-installation' };
      if (capabilityReason) return { status: 'unavailable', reason: capabilityReason };
      return inputs.readInputIdentity(owner);
    },
    produceStarts: inputs.produceStarts, produceTargets: inputs.produceTargets, admit,
    createWorker() {
      need(current() && slot.lease, 'stale-study-worker-installation');
      return new WorkerClass(workerURL.href, { type: 'classic', name: instance });
    },
    onState: options.onState, reportError: report,
    ...(options.now ? { now: options.now } : {}),
    ...(options.setTimer ? { setTimer: options.setTimer } : {}),
    ...(options.clearTimer ? { clearTimer: options.clearTimer } : {}),
  });
  record.host = host;
  try { need(current(), 'stale-study-installation'); return host; }
  catch (error) { host.destroy(); throw error; }
}
