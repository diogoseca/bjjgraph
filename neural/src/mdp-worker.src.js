/* Worker entry host. Root bundles model/adapter/knowledge code into a lazy worker
 * and calls ngMdpInstallWorker(self,{buildModel}). buildModel receives the ONCE
 * registered immutable dataset and a compact request; it may fetch complete,
 * content-addressed mechanics metadata then call ngMdpExpandAsync. Never accept
 * a partial positive-support graph as complete. No automatic global installation
 * here: importing this definition in node tests or the UI cannot create a worker.
 */
function ngMdpInstallWorker(scope, options) {
  const opts = options || {}; let registered = null, generation = 0, disposed = false;
  async function receive(event) {
    const message = event.data || {};
    if (disposed) return;
    if (message.op === 'init') {
      generation++; registered = { id: message.registrationId, model: message.model };
      scope.postMessage({ op: 'ready', registrationId: registered.id, modelHash: registered.model.modelHash }); return;
    }
    if (message.op === 'cancel') {
      // The client can cancel an earlier queued request after a newer init; that
      // acknowledgement must not cancel an unrelated registration's work.
      if (registered && message.registrationId === registered.id) generation++;
      scope.postMessage({ op: 'cancelled', registrationId: message.registrationId, requestId: message.requestId }); return;
    }
    if (message.op === 'snapshot' && registered && message.registrationId === registered.id) {
      const hash = ngMdpIdentity.ngMdpDigest({ profile: message.profile, runtime: message.runtime });
      const valid = hash === message.snapshotHash && message.profile && message.profile.fingerprint === message.profileHash;
      if (valid) { generation++; registered.snapshot = { id: message.snapshotId, hash, profileHash: message.profileHash, profile: message.profile, runtime: message.runtime }; }
      scope.postMessage({ op: 'snapshot-ready', registrationId: registered.id, snapshotId: message.snapshotId,
        snapshotHash: message.snapshotHash, profileHash: message.profileHash, status: valid ? 'ready' : 'unavailable', reason: valid ? null : 'invalid-profile-snapshot' }); return;
    }
    if (message.op === 'describe-root' && registered && message.registrationId === registered.id) {
      const current = registered; let result;
      try {
        if (ngMdpIdentity.ngMdpDigest(message.query) !== message.queryHash || !opts.describeRoot) throw new Error('unavailable-root-description');
        result = await opts.describeRoot(current.model, message.query);
        if (JSON.stringify(result).length > 65536) throw new Error('root-description-size-budget');
      } catch (error) { result = { status: 'unavailable', reason: error.message }; }
      if (!disposed && current === registered) scope.postMessage({ op: 'root-description', registrationId: current.id,
        descriptionId: message.descriptionId, queryHash: message.queryHash, result });
      return;
    }
    if (message.op !== 'evaluate' || !registered || message.registrationId !== registered.id) return;
    const stamp = ++generation, current = registered, request = message.request;
    const cancelled = () => disposed || generation !== stamp || registered !== current;
    scope.postMessage({ op: 'accepted', registrationId: current.id, requestId: request.requestId, revision: request.revision, contractHash: ngMdpIdentity.ngMdpContractHash(request) });
    let response;
    try {
      if (current.snapshot && (request.state.snapshotId !== current.snapshot.id || request.state.snapshotHash !== current.snapshot.hash || request.profileHash !== current.snapshot.profileHash)) throw new Error('stale-profile-snapshot');
      const model = opts.buildModel ? await opts.buildModel(current.model, request, { cancelled, snapshot: current.snapshot }) : current.model;
      if (cancelled()) return;
      response = await ngMdpSolveAsync(model, request, { ...(opts.solveOptions || {}), cancelled });
    } catch (error) { response = ngMdpUnavailable(request, [error.message], error.coverage || null, { stage: 'worker-model-preparation' }); }
    if (!cancelled()) scope.postMessage({ op: 'result', registrationId: current.id, response });
  }
  scope.addEventListener('message', receive);
  return () => { disposed = true; generation++; registered = null; scope.removeEventListener('message', receive); };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { ngMdpInstallWorker };
