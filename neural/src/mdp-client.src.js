/* One immutable snapshot and worker owner per live surface. Models cross the
 * boundary on register, not once per card. Root supplies the lazy Worker URL.
 * Numerical stages yield between policies/components; parsing/SCC/linear stages
 * can still be synchronous. A MAIN-THREAD hard deadline terminates that worker
 * instead of claiming a worker message can interrupt synchronous JavaScript.
 * After hard termination the host creates/registers a new client. UI cancellation
 * is not a modeled terminal, and never publishes a fabricated no-result value.
 */
function ngMdpFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) ngMdpFreeze(child); Object.freeze(value);
  }
  return value;
}
function ngMdpMatchingResponse(request, response) {
  if (!response || response.apiVersion !== 2 || response.requestId !== request.requestId || response.revision !== request.revision || response.contractHash !== ngMdpContractHash(request)) return false;
  for (const key of ['modelHash','mechanicsHash','graphHash','profileHash','opponentPolicyHash','ruleset','objective','horizon','futureStudyPolicy'])
    if (ngMdpStable(request[key]) !== ngMdpStable(response[key])) return false;
  if (!response.root || response.root.stateId !== request.state.id) return false;
  const ids = request.requestedActionIds;
  return !ids || (Array.isArray(response.actions) && ids.length === response.actions.length && ids.every((id,i) => response.actions[i].actionId === id));
}
function ngMdpCreateClient(worker, options) {
  const opts = { deadlineMilliseconds: 30000, cancellationGraceMilliseconds: 1000, ...(options || {}) };
  let registration = null, active = null, registrationId = 0, dead = false;
  const cancellations = new Map();
  const usedRequestIds = new Set();
  const descriptions = new Map(); let descriptionId = 0;
  const error = reason => { const e = new Error(reason); e.name = /cancel|supersed|destroy/.test(reason) ? 'AbortError' : 'Error'; return e; };
  function stop(reason) {
    if (dead) return; dead = true;
    if (active) { clearTimeout(active.timer); active.reject(error(reason)); active = null; }
    if (registration && registration.reject) { clearTimeout(registration.timer); registration.reject(error(reason)); registration.reject = null; }
    if (registration && registration.snapshot && registration.snapshot.reject) { clearTimeout(registration.snapshot.timer); registration.snapshot.reject(error(reason)); registration.snapshot.reject = null; }
    for (const timer of cancellations.values()) clearTimeout(timer); cancellations.clear();
    for (const query of descriptions.values()) { clearTimeout(query.timer); query.reject(error(reason)); } descriptions.clear();
    worker.removeEventListener('message', receive); worker.removeEventListener('error', failed);
    worker.terminate(); if (opts.onTerminated) opts.onTerminated(reason);
  }
  function cancel(reason) {
    if (!active) return;
    const job = active; active = null; clearTimeout(job.timer); job.reject(error(reason || 'cancelled'));
    worker.postMessage({ op: 'cancel', requestId: job.request.requestId, registrationId: job.registrationId });
    const key = job.registrationId + ':' + job.request.requestId;
    cancellations.set(key, setTimeout(() => stop('worker-cancellation-deadline'), opts.cancellationGraceMilliseconds));
  }
  function receive(event) {
    const message = event.data || {};
    if (message.op === 'root-description') {
      const query = descriptions.get(message.descriptionId);
      if (!query || message.registrationId !== query.registrationId || message.queryHash !== query.queryHash) return;
      descriptions.delete(message.descriptionId); clearTimeout(query.timer);
      if (!registration || registration.id !== query.registrationId) query.reject(error('superseded-registration'));
      else if (message.result && JSON.stringify(message.result).length <= 65536) query.resolve(ngMdpFreeze(message.result));
      else query.reject(error('invalid-root-description'));
      return;
    }
    if (message.op === 'cancelled') {
      const key = message.registrationId + ':' + message.requestId;
      clearTimeout(cancellations.get(key)); cancellations.delete(key); return;
    }
    if (message.op === 'ready' && registration && message.registrationId === registration.id) {
      if (message.modelHash !== registration.modelHash) { stop('worker-registration-identity'); return; }
      clearTimeout(registration.timer); registration.resolve(); registration.reject = null; return;
    }
    if (message.op === 'snapshot-ready' && registration && message.registrationId === registration.id) {
      const snapshot = registration.snapshot;
      if (!snapshot || snapshot.id !== message.snapshotId || snapshot.hash !== message.snapshotHash || snapshot.profileHash !== message.profileHash) return;
      clearTimeout(snapshot.timer);
      if (message.status === 'ready') { snapshot.resolve({ snapshotId: snapshot.id, snapshotHash: snapshot.hash }); snapshot.reject = null; }
      else { snapshot.reject(error(message.reason || 'snapshot-rejected')); snapshot.reject = null; }
      return;
    }
    const job = active;
    if (message.op !== 'result' || !job || message.registrationId !== job.registrationId) return;
    if (!ngMdpMatchingResponse(job.request, message.response)) return;
    active = null; clearTimeout(job.timer);
    const snapshot = ngMdpFreeze(message.response); job.resolve(snapshot);
    try { if (opts.onSnapshot) opts.onSnapshot(snapshot); }
    catch (error) { if (opts.onConsumerError) opts.onConsumerError(error); }
  }
  function failed() { stop('worker-error'); }
  worker.addEventListener('message', receive); worker.addEventListener('error', failed);
  return {
    register(model) {
      if (dead) return Promise.reject(error('worker-terminated'));
      cancel('superseded-model');
      if (registration && registration.reject) { clearTimeout(registration.timer); registration.reject(error('superseded-registration')); }
      if (registration && registration.snapshot && registration.snapshot.reject) { clearTimeout(registration.snapshot.timer); registration.snapshot.reject(error('superseded-snapshot')); }
      const id = ++registrationId;
      const promise = new Promise((resolve, reject) => {
        registration = { id, modelHash: model.modelHash, resolve, reject,
          timer: setTimeout(() => stop('worker-registration-deadline'), opts.deadlineMilliseconds) };
      });
      registration.promise = promise; worker.postMessage({ op: 'init', registrationId: id, model }); return promise;
    },
    async updateSnapshot(input) {
      if (dead || !registration) throw error('worker-not-registered');
      const current = registration; await current.promise;
      if (dead || current !== registration) throw error('superseded-registration');
      cancel('superseded-snapshot');
      if (current.snapshot && current.snapshot.reject) { clearTimeout(current.snapshot.timer); current.snapshot.reject(error('superseded-snapshot')); }
      const hash = ngMdpDigest({ profile: input.profile, runtime: input.runtime }), id = input.id || hash;
      const promise = new Promise((resolve, reject) => {
        current.snapshot = { id, hash, profileHash: input.profileHash, resolve, reject,
          timer: setTimeout(() => stop('worker-snapshot-deadline'), opts.deadlineMilliseconds) };
      });
      current.snapshot.promise = promise;
      worker.postMessage({ op: 'snapshot', registrationId: current.id, snapshotId: id, snapshotHash: hash,
        profileHash: input.profileHash, profile: input.profile, runtime: input.runtime });
      return promise;
    },
    async describeRoot(query) {
      if (dead || !registration) throw error('worker-not-registered');
      const current = registration; await current.promise;
      if (dead || current !== registration) throw error('superseded-registration');
      const id = ++descriptionId, captured = JSON.parse(JSON.stringify(query)), queryHash = ngMdpDigest(captured);
      return new Promise((resolve, reject) => {
        descriptions.set(id, { registrationId: current.id, queryHash, resolve, reject,
          timer: setTimeout(() => { descriptions.delete(id); reject(error('root-description-deadline')); }, opts.deadlineMilliseconds) });
        worker.postMessage({ op: 'describe-root', registrationId: current.id, descriptionId: id, queryHash, query: captured });
      });
    },
    async evaluate(request) {
      if (dead) throw error('worker-terminated');
      if (!registration) throw error('worker-not-registered');
      const current = registration; await current.promise;
      if (dead || current !== registration) throw error('superseded-registration');
      if (request.modelHash !== current.modelHash) throw error('stale-modelHash');
      if (current.snapshot) {
        const snapshot = current.snapshot; await snapshot.promise;
        if (snapshot !== current.snapshot || current !== registration || request.state.snapshotId !== snapshot.id || request.state.snapshotHash !== snapshot.hash || request.profileHash !== snapshot.profileHash) throw error('stale-profile-snapshot');
      }
      if (request.contractHash && request.contractHash !== ngMdpContractHash(request)) throw error('stale-contract');
      const requestKey = current.id + ':' + request.requestId;
      if (usedRequestIds.has(requestKey)) throw error('duplicate-request-id');
      usedRequestIds.add(requestKey);
      cancel('superseded-request');
      const captured = JSON.parse(JSON.stringify(request));
      return new Promise((resolve, reject) => {
        active = { request: captured, registrationId: current.id, resolve, reject,
          timer: setTimeout(() => stop('worker-computation-deadline'), opts.deadlineMilliseconds) };
        worker.postMessage({ op: 'evaluate', registrationId: current.id, request: captured });
      });
    },
    cancel,
    destroy() { stop('destroyed'); }
  };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { ngMdpCreateClient, ngMdpMatchingResponse, ngMdpFreeze };
