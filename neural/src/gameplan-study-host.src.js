// Host lifecycle only. The injected frozen scheduler owns a separate study
// worker; the injected presenter alone turns certified evidence into ordering.
// No start law, target rule, numerical solver or persisted credit lives here.
let nextHost = 0;
const need = (ok, reason) => { if (!ok) throw new Error(reason); };
const text = value => typeof value === "string" && value.length > 0;
const intents = new Set(["open-plan", "refresh-plan", "suggestions", "retry"]);
const messages = {
  idle: "Open your study plan to request suggestions. Due reviews remain available.",
  pending: "Preparing study suggestions. Due reviews remain available.",
  queued: "Study suggestions are waiting for available computing time. Due reviews remain available.",
  ready: "Study suggestions are ready for your next plan. Refresh the plan to use them.",
  partial: "Some study comparisons are ready; other material remains uncertain or unavailable. Refresh the plan to use the available suggestions.",
  unavailable: "Study suggestions are unavailable for this context. Due reviews remain available.",
  error: "Study suggestions could not be calculated. You can retry; due reviews remain available.",
  destroyed: "This study request has closed.",
};

export function ngGameplanStudyLiveBusy(app) {
  return !!(app._gameValueLoading || app._choiceValueQueued ||
    ["scheduled", "loading", "preparing"].includes(app._gameValueState) ||
    app._choiceValues?.snapshot?.()?.status === "pending");
}

/** Deferred construction is inert. Root supplies authoritative input identities,
 * start/target producers, actual admission and a dedicated worker constructor.
 * Reconcile hooks may retire/resume an EXISTING intent; they never create one.
 * A result only updates recommendations/status. Session state is never written.
 */
export function ngGameplanStudyCreateHost(app, deps) {
  const R = deps.runtime, M = deps.identity, serial = ++nextHost;
  for (const name of ["ngGameplanStudyCreateScheduler", "ngGameplanStudyPresent", "ngStudySnapshot"])
    need(typeof R?.[name] === "function", "missing-study-runtime:" + name);
  for (const name of ["ngMdpDigest", "ngMdpStable", "ngMdpContractHash", "ngMdpEnvelope"])
    need(typeof M?.[name] === "function", "missing-study-identity:" + name);
  const build = R.NG_GAMEPLAN_STUDY_BUILD, limits = build?.computation?.study?.scheduler;
  need(limits && Number.isSafeInteger(limits.maxQueueMilliseconds) && limits.maxQueueMilliseconds > 0, "missing-study-host-admission");
  const jsonLimits = { maxNodes: limits.maxResultNodes, maxBytes: limits.maxResultBytes, maxDepth: limits.maxDepth };
  const copy = value => R.ngStudySnapshot(value, jsonLimits), equal = (a, b) => M.ngMdpStable(a) === M.ngMdpStable(b);
  const installBody = () => ({ graphHash: R.NG_GAMEPLAN_STUDY_BUILD.sources.graphHash,
    indexHash: R.NG_GAMEPLAN_STUDY_BUILD.sources.indexHash, lawHashes: R.NG_GAMEPLAN_STUDY_BUILD.sources.lawHashes });
  const body = copy(installBody()), installation = copy({ ...body, id: M.ngMdpDigest(body) });
  const buildKey = M.ngMdpDigest(copy(build));
  const now = deps.now || (() => performance.now()), setTimer = deps.setTimer || setTimeout, clearTimer = deps.clearTimer || clearTimeout;
  let dead = false, active = null, completed = null, scheduler = null, submitting = null, installed = null;
  let sequence = 0, ownerSequence = 0, ownerRef = null, reading = false;
  let state = Object.freeze({ phase: "idle", message: messages.idle, reason: null, dependency: null, provider: null, retryable: false });
  const report = error => { try { deps.reportError?.(error); } catch (_) { /* observers do not own lifecycle */ } };
  const notify = value => {
    try { const p = deps.onState?.(value); if (p?.then) Promise.resolve(p).catch(report); }
    catch (error) { report(error); }
  };
  const ownerCurrent = () => !dead && !app.__ngDestroyed && (!app._gameStudyHost || app._gameStudyHost === host) && app._progressCurrent?.() === true;
  const emit = (phase, extra = {}) => {
    state = Object.freeze({ phase, message: messages[phase], reason: null, dependency: null, provider: null,
      sourceProvenance: active?.sourceProvenance || null, retryable: ["unavailable", "error"].includes(phase), ...extra });
    if (ownerCurrent()) notify(state);
    return state;
  };
  const frame = (includeDecks = false) => {
    need(ownerCurrent() && app._progressLoaded === true && app._progressOwnerStamp, "stale-study-owner");
    need(!reading, "reentrant-study-capture"); reading = true;
    try {
      app._checkKnowledgeDay?.();
      need(deps.runtime === R && equal(installBody(), body) && M.ngMdpDigest(R.NG_GAMEPLAN_STUDY_BUILD) === buildKey, "changed-study-installation");
      need(app._gameValueGraph?.status === "verified" && app._gameValueGraph.hash === installation.graphHash, "unverified-study-graph");
      if (ownerRef !== app._progressOwnerStamp) { ownerRef = app._progressOwnerStamp; ownerSequence++; }
      const profile = app.knowledgeProfile(), day = app._epochDay(), ruleset = app._giMode;
      need(profile?.status === "ready" && profile.day === day && ["gi", "nogi"].includes(ruleset), "unavailable-study-profile");
      need(typeof deps.readInputIdentity === "function", "missing-study-input-producers");
      const inputs = deps.readInputIdentity(app);
      need(inputs?.status === "ready" && text(inputs.startKey) && text(inputs.targetKey), inputs?.reason || "unavailable-study-inputs");
      const deckReady = Object.fromEntries(Object.keys(app.flashcards?.decks || {}).filter(k => app._deckHasCards(k)).map(k => [k, true]));
      const runtime = { residencyRevision: app._gameValueResidencyRevision || 0, deckReady };
      const base = { ownerEpoch: "study-owner:" + serial + ":" + ownerSequence, day, ruleset, profileHash: profile.fingerprint,
        profileRevision: profile.revision, evidenceRevision: profile.evidenceRevision, contentRevision: profile.contentRevision,
        residencyRevision: runtime.residencyRevision, residencyHash: M.ngMdpDigest(runtime),
        installationId: installation.id, graphHash: installation.graphHash, indexHash: installation.indexHash };
      const stamp = app._gameplanStamp(), inputKeys = { startKey: inputs.startKey, targetKey: inputs.targetKey };
      const key = M.ngMdpDigest({ base, stamp, inputKeys });
      const value = { key, base, stamp, inputKeys, profile, runtime, ...(includeDecks ? { decks: app._gameplanDecks() } : {}) };
      return copy(value);
    } finally { reading = false; }
  };
  const fresh = token => {
    if (!token || active !== token || token.done || !ownerCurrent()) return false;
    try { return frame().key === token.frame.key; } catch (_) { return false; }
  };
  const publish = provider => {
    if (!ownerCurrent()) return false;
    if (installed && app._gameplanProvider !== installed) return false;
    if (app.setGameplanRecommendations(provider) !== true) return false;
    installed = provider; return true;
  };
  const placeholder = (phase, reason) => {
    if (!ownerCurrent()) return;
    try { publish(copy({ kind: "learning-opportunity", stamp: app._gameplanStamp(),
      status: ["pending", "queued"].includes(phase) ? "pending" : "unavailable", rows: [], assumptions: [messages[phase]], reason: reason || null })); }
    catch (error) { report(error); }
  };
  const finish = (token, phase, extra = {}) => {
    if (!token || token.done) return;
    token.done = true; token.controller.abort(phase); clearTimer(token.timer);
    if (active === token) active = null;
    if (!["ready", "partial"].includes(phase) && !extra.provider) placeholder(phase, extra.reason);
    const value = emit(phase, { ...extra, capture: token.job?.capture || null,
      sourceProvenance: token.sourceProvenance || null });
    token.resolve(value);
  };
  const queued = (token, dependency) => {
    if (!fresh(token)) return finish(token, "unavailable", { reason: "stale-study-capture" });
    clearTimer(token.timer);
    const left = token.queueDeadline - now();
    if (left <= 0) { scheduler?.invalidate("study-host-queue-deadline"); return finish(token, "unavailable", { reason: "study-host-queue-deadline" }); }
    token.timer = setTimer(() => {
      if (active !== token || token.done) return;
      token.run++; scheduler?.invalidate("study-host-queue-deadline");
      finish(token, "unavailable", { reason: "study-host-queue-deadline" });
    }, left);
    placeholder("queued", dependency); emit("queued", { dependency, reason: "study-admission-deferred" });
  };
  const ensureScheduler = () => {
    if (scheduler) return scheduler;
    need(typeof deps.admit === "function" && typeof deps.createWorker === "function" && typeof deps.fingerprint === "function", "missing-study-host-provider");
    scheduler = R.ngGameplanStudyCreateScheduler({ identity: M, fingerprint: deps.fingerprint, installation, now, setTimer, clearTimer,
      isCurrent: capture => fresh(active) && equal(active.job?.capture, capture),
      async admit(meta, signal) {
        if (ngGameplanStudyLiveBusy(app)) return { status: "deferred", dependency: "live-choice" };
        const lease = await deps.admit(meta, signal);
        // A live solve may have started while root was admitting study. Release
        // only the newly granted STUDY lease; never touch live-card ownership.
        if (ngGameplanStudyLiveBusy(app) && lease?.status === "admitted") {
          lease.release(); return { status: "deferred", dependency: "live-choice" };
        }
        return lease;
      },
      createWorker: () => { need(!ngGameplanStudyLiveBusy(app), "live-choice-priority"); return deps.createWorker(); },
      onStatus(event) {
        const token = active;
        if (!token || !fresh(token) || (!submitting && token.transportId && event.jobId !== token.transportId)) return;
        if (submitting === token) token.transportId = event.jobId;
        if (["complete", "unavailable"].includes(event.phase)) return; // settlement validates the actual result
        if (event.phase === "queued") { queued(token, event.dependency); return; }
        if (["starting", "working"].includes(event.phase)) { token.running = true; clearTimer(token.timer); }
        emit("pending", { stage: event.stage || event.phase });
      },
    }, limits);
    return scheduler;
  };
  const presenterInput = (token, reply) => {
    const result = reply.result, receipts = result.receipts, job = token.job;
    need(result.coordinator && receipts?.manifest && receipts.startAdmission && Array.isArray(receipts.scenarios) && Array.isArray(result.scenarioRequests), "missing-study-result-receipts");
    const admission = receipts.startAdmission, manifest = receipts.manifest;
    need(admission.kind === "verified-study-engine-admission" && admission.installationId === installation.id && admission.demandHash === reply.key &&
      admission.startDistributionHash === job.capture.startDistributionHash && admission.startMappingHash === job.capture.startMappingHash &&
      admission.declaredStarts === job.startDistribution.length && admission.behaviorCompression === false, "unbound-study-result-admission");
    need(manifest.kind === "verified-raw-study-manifest" && manifest.graphHash === installation.graphHash && manifest.indexHash === installation.indexHash &&
      manifest.contentRevision === job.capture.contentRevision && text(manifest.manifestHash), "unbound-study-result-manifest");
    need(receipts.scenarios.length === job.scenarios.length && result.scenarioRequests.length === job.scenarios.length &&
      new Set(receipts.scenarios.map(s => s.id)).size === job.scenarios.length, "incomplete-study-result-scenarios");
    const scenarios = receipts.scenarios.map(receipt => {
      const s = receipt.projection?.scenario;
      need(s && s.id === receipt.id && text(s.profileHash), "missing-study-projection-identity");
      const expected = { ...job.baseline.request, requestId: job.baseline.request.requestId + ":scenario:" + s.id, profileHash: s.profileHash };
      delete expected.contractHash;
      const matches = result.scenarioRequests.filter(r => r.id === s.id);
      need(matches.length === 1 && equal(matches[0].request, expected), "changed-study-scenario-request");
      return { id: s.id, stamp: M.ngMdpEnvelope(expected) };
    });
    return { result: result.coordinator, receipts: receipts.scenarios, bounds: deps.presenterBounds,
      context: { stamp: token.frame.stamp, baselineStamp: M.ngMdpEnvelope(job.baseline.request),
        startDistribution: job.startDistribution, startDistributionHash: job.capture.startDistributionHash,
        exposurePolicyId: result.coordinator.exposurePolicyId, logicalContextHash: job.capture.logicalContextHash,
        manifestHash: manifest.manifestHash, day: job.capture.day, scenarios, decks: token.frame.decks } };
  };
  const submit = token => {
    if (!fresh(token)) return finish(token, "unavailable", { reason: "stale-study-capture" });
    if (ngGameplanStudyLiveBusy(app)) return queued(token, "live-choice");
    if (token.running || token.waiting) return;
    const run = ++token.run; token.waiting = true;
    try {
      const owner = ensureScheduler(); submitting = token;
      const work = owner.submit(token.job); submitting = null;
      Promise.resolve(work).then(reply => {
        if (active !== token || token.done || run !== token.run) return;
        token.waiting = token.running = false;
        if (!fresh(token)) return finish(token, "unavailable", { reason: "stale-study-capture" });
        if (reply.transportStatus !== "complete") return finish(token, /stale|supersed|deadline|missing|unavailable|admission|budget|cancel|destroy|priority|lease/.test(reply.reason || "") ? "unavailable" : "error", { reason: reply.reason || "study-transport-unavailable" });
        need(equal(reply.capture, token.job.capture), "changed-study-result-capture");
        if (reply.result?.status === "unavailable") return finish(token, "unavailable", { reason: reply.result.reason || reply.result.coordinator?.unresolvedReasons?.[0] || "study-evaluation-unavailable", evidence: reply.result });
        const provider = R.ngGameplanStudyPresent(presenterInput(token, reply));
        if (!fresh(token)) return finish(token, "unavailable", { reason: "stale-study-capture" });
        need(provider && ["ready", "partial", "unavailable"].includes(provider.status) && provider.stamp === token.frame.stamp, "invalid-study-presenter-result");
        if (!publish(provider)) return finish(token, "unavailable", { reason: "study-recommendation-owner-changed" });
        completed = { key: token.frame.key, provider, evidence: reply.result, capture: token.job.capture, sourceProvenance: token.sourceProvenance };
        finish(token, provider.status, { provider, evidence: reply.result, reason: provider.study?.reason || null });
      }).catch(error => {
        if (active === token && !token.done && run === token.run) finish(token, "error", { reason: error.message || "study-host-failed" });
      });
    } catch (error) { submitting = null; token.waiting = false; finish(token, "error", { reason: error.message || "study-host-failed" }); }
  };
  const prepare = async token => {
    if (token.startedPreparing || token.done || active !== token) return;
    token.startedPreparing = true;
    try {
      need(typeof deps.produceStarts === "function" && typeof deps.produceTargets === "function", "missing-study-input-producers");
      const base = { app, build, installation, profile: token.frame.profile, runtime: token.frame.runtime,
        requestId: "study-host:" + serial + ":" + token.serial, revision: token.serial };
      const starts = await deps.produceStarts(base, token.controller.signal);
      if (!fresh(token)) return finish(token, "unavailable", { reason: "stale-study-capture" });
      if (starts?.status !== "ready") return finish(token, starts?.status === "error" ? "error" : "unavailable", { reason: starts?.reason || "unavailable-study-start-law" });
      need(starts.identity === token.frame.inputKeys.startKey && starts.request?.requestId === base.requestId && starts.request.revision === base.revision && starts.provenance,
        "unbound-study-start-law");
      const targets = await deps.produceTargets({ ...base, starts }, token.controller.signal);
      if (!fresh(token)) return finish(token, "unavailable", { reason: "stale-study-capture" });
      if (targets?.status !== "ready") return finish(token, targets?.status === "error" ? "error" : "unavailable", { reason: targets?.reason || "unavailable-study-targets" });
      need(targets.identity === token.frame.inputKeys.targetKey && targets.provenance, "unbound-study-targets");
      const byId = (a, b) => a.stateId < b.stateId ? -1 : a.stateId > b.stateId ? 1 : 0;
      need(Array.isArray(starts.startDistribution) && Array.isArray(starts.startSnapshots), "missing-complete-study-starts");
      const capture = { ...token.frame.base, logicalContextHash: M.ngMdpContractHash(starts.request),
        startDistributionHash: M.ngMdpDigest(starts.startDistribution.slice().sort(byId)), startMappingHash: M.ngMdpDigest(starts.startSnapshots.slice().sort(byId)) };
      token.job = copy({ capture, baseline: { request: starts.request, profile: token.frame.profile }, runtime: token.frame.runtime,
        startDistribution: starts.startDistribution, startSnapshots: starts.startSnapshots, scenarios: targets.scenarios });
      token.sourceProvenance = copy({ starts: starts.provenance, targets: targets.provenance });
      token.preparing = false; submit(token);
    } catch (error) {
      if (active === token && !token.done) finish(token, /^(missing|unavailable|stale|changed|unbound|unverified|invalid|non-json)/.test(error.message || "") ? "unavailable" : "error", { reason: error.message || "study-input-producer-failed" });
    }
  };
  const host = Object.freeze({
    request(intent) {
      if (dead) return Promise.resolve(state);
      if (!intents.has(intent)) return Promise.resolve(Object.freeze({ phase: "unavailable", reason: "explicit-study-intent-required", message: messages.unavailable }));
      let captured;
      try { captured = frame(true); }
      catch (error) { host.invalidate(error.message); return Promise.resolve(state); }
      if (active?.frame.key === captured.key) return active.promise;
      if (intent !== "retry" && completed?.key === captured.key && app._gameplanProvider === completed.provider) {
        const { key, ...saved } = completed;
        return Promise.resolve(emit(completed.provider.status, saved));
      }
      host.invalidate("study-superseded", false); installed = null; // explicit intent may take recommendation ownership
      const token = { serial: ++sequence, frame: captured, controller: new AbortController(), done: false,
        run: 0, preparing: true, running: false, waiting: false, queueDeadline: now() + limits.maxQueueMilliseconds };
      token.promise = new Promise(resolve => { token.resolve = resolve; }); active = token;
      token.timer = setTimer(() => {
        if (active !== token || token.done) return;
        token.run++; scheduler?.invalidate("study-host-queue-deadline"); finish(token, "unavailable", { reason: "study-host-queue-deadline" });
      }, limits.maxQueueMilliseconds);
      placeholder("pending"); emit("pending", { stage: "capture" });
      if (ngGameplanStudyLiveBusy(app)) queued(token, "live-choice");
      else void prepare(token);
      return token.promise;
    },
    reconcile(reason = "study-context-changed") {
      if (dead || reading) return state;
      const token = active;
      if (!token && !completed) return state;
      let current;
      try { current = frame(); }
      catch (error) { if (active || completed) host.invalidate(error.message); return state; }
      if ((token && current.key !== token.frame.key) || (completed && current.key !== completed.key)) { host.invalidate(reason); return state; }
      if (!token) return state;
      if (ngGameplanStudyLiveBusy(app)) {
        if (token.waiting || token.running) { token.run++; token.waiting = token.running = false; scheduler?.invalidate("live-choice-priority"); }
        queued(token, "live-choice");
      } else if (!token.resumeQueued) {
        // Let the rest of the live hand/grade transaction establish its pending
        // work before admitting study into a momentary gap between callbacks.
        token.resumeQueued = true;
        Promise.resolve().then(() => {
          token.resumeQueued = false;
          if (!fresh(token)) return;
          if (ngGameplanStudyLiveBusy(app)) return queued(token, "live-choice");
          if (!token.job && token.preparing && !token.startedPreparing) void prepare(token);
          else if (token.job) {
            if (token.waiting && !token.running) scheduler?.retryAdmission(); else submit(token);
          }
        }).catch(error => report(error));
      }
      return state;
    },
    invalidate(reason = "study-context-invalidated", paint = true) {
      completed = null;
      const token = active;
      if (token) { token.run++; scheduler?.invalidate(reason); finish(token, "unavailable", { reason }); }
      else if (paint && !dead) { placeholder("unavailable", reason); emit("unavailable", { reason }); }
      return state;
    },
    destroy() {
      if (dead) return;
      if (installed && app._gameplanProvider === installed) placeholder("unavailable", "study-host-destroyed");
      const token = active; dead = true; completed = null; scheduler?.destroy();
      if (token && !token.done) { token.done = true; token.controller.abort("study-host-destroyed"); clearTimer(token.timer); active = null;
        state = Object.freeze({ phase: "destroyed", reason: "study-host-destroyed", message: messages.destroyed, provider: null, retryable: false }); token.resolve(state); }
      else state = Object.freeze({ phase: "destroyed", reason: "study-host-destroyed", message: messages.destroyed, provider: null, retryable: false });
    },
    snapshot: () => state,
  });
  return host;
}
