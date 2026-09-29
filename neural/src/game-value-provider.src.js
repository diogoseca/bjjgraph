/* Main-thread bridge only. No solver, graph traversal, fetch, Worker creation at
 * import, or invented game values. Root injects verified deferred registration,
 * bounded current-hand metadata, the native identity helpers and the real client.
 * The separate worker owns full mechanics metadata and state expansion.
 */
function ngGameValueCopy(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(ngGameValueCopy));
  if (value && typeof value === 'object') {
    const out = Object.create(null);
    for (const key of Object.keys(value)) Object.defineProperty(out, key, {
      value: ngGameValueCopy(value[key]), enumerable: true,
    });
    return Object.freeze(out);
  }
  return value;
}
function ngGameValueFail(reason) { const e = new Error(reason); e.code = reason; throw e; }
function ngGameValueInteger(value, reason) {
  if (!Number.isSafeInteger(value) || value < 0) ngGameValueFail(reason);
  return value;
}
function ngGameValueRegistrationKey(registration, stable) {
  return stable(['game-value-registration-v1', registration.modelHash,
    registration.mechanicsHash, registration.graphHash, registration.opponentPolicyHash,
    registration.ruleset, registration.evFrame, registration.evIndex, registration.lossAversion,
    registration.metadataHash, registration.metadataUrl, registration.manifestHash,
    registration.manifestUrl, registration.manifestBytes]);
}
function ngGameValueKind(opt) {
  if (opt.action === 'escape') return 'escape';
  if (opt.action === 'finish') return 'finish';
  if (opt.action === 'enter' || (!opt.action && opt.node.ty === 'submissions')) return 'entry';
  if (!opt.action || opt.action === 'transition') return 'transition';
  ngGameValueFail('unsupported-live-action');
}
function ngGameValueCreateProvider(deps) {
  const M = deps.mdp, K = deps.knowledge;
  for (const name of ['ngMdpStable', 'ngMdpDigest', 'ngMdpStateId', 'ngMdpActionId', 'ngMdpContractHash', 'ngMdpNormalizeRootSnapshot', 'ngMdpDefenseId'])
    if (typeof M?.[name] !== 'function') ngGameValueFail('missing-mdp-helper:' + name);
  for (const name of ['getRegistration', 'getResidency', 'createClient'])
    if (typeof deps[name] !== 'function') ngGameValueFail('missing-provider-dependency:' + name);
  for (const name of ['ngKnowledgeExplainMove', 'ngKnowledgeExplainEscape'])
    if (typeof K?.[name] !== 'function') ngGameValueFail('missing-knowledge-helper:' + name);
  if (typeof deps.instanceId !== 'string' || !deps.instanceId) ngGameValueFail('missing-provider-instance-id');
  const stable = M.ngMdpStable;
  let dead = false, client = null, registration = null, registrationPromise = null;
  let serial = 0, transportEpoch = 0, invalidation = 0, latest = null, issued = null, preparing = null;
  let rootDescription = null, installedSnapshot = null;
  const getProfile = deps.getProfile || (app => app.knowledgeProfile());
  const activeHand = (app, options, handId) => {
    if (dead || app.__ngDestroyed || app._execution || app._waitingSubmission || app._sweep
      || app._choiceValueSource !== provider || app._choiceHandId !== handId
      || typeof app._optPick !== 'function' || !app._decision || !Array.isArray(app._optList)) return false;
    const mounted = (app._optionCards || []).filter(c => !c.opt.threat);
    return mounted.length === options.length && options.length > 0 && options.every((opt, i) =>
      !opt.threat && mounted[i].opt === opt && app._optList.includes(opt)
      && (!mounted[i].card || mounted[i].card.isConnected !== false));
  };
  function describe(app, options, handId) {
    if (typeof handId !== 'string' || !activeHand(app, options, handId)) ngGameValueFail('no-current-playable-hand');
    if (!app._progressLoaded) ngGameValueFail('progress-not-loaded');
    const reg = deps.getRegistration(app);
    if (!reg || reg.verified !== true || reg.coverage?.status !== 'COMPLETE') ngGameValueFail('unverified-mechanics-registration');
    for (const key of ['modelHash', 'mechanicsHash', 'graphHash', 'opponentPolicyHash', 'metadataHash', 'metadataUrl'])
      if (typeof reg[key] !== 'string' || !reg[key]) ngGameValueFail('missing-registration-' + key);
    // Full data belongs in the worker; do not silently regress to runtime capture.
    if (reg.nodes || reg.hands || reg.states) ngGameValueFail('full-model-on-host');
    if (!['gi', 'nogi'].includes(app._giMode) || reg.ruleset !== app._giMode
      || reg.evFrame !== app._evFrame || reg.evIndex !== app._evLamIdx()) ngGameValueFail('stale-mechanics-selector');
    const key = ngGameValueRegistrationKey(reg, stable);
    const rootKey = stable([key, app.nodes?.[app.currentPos]?.id, app.playerRole]);
    const projection = deps.getRootMetadata ? deps.getRootMetadata(app, reg)
      : rootDescription?.key === rootKey ? rootDescription.value : null;
    if (!projection) ngGameValueFail('root-metadata-pending');
    if (projection.registrationKey !== key || projection.coverage?.status !== 'COMPLETE'
      || !Array.isArray(projection.hand)) ngGameValueFail('stale-root-metadata');
    for (const name of ['modelHash', 'mechanicsHash', 'graphHash', 'opponentPolicyHash', 'ruleset', 'evFrame'])
      if (projection[name] !== reg[name]) ngGameValueFail('stale-root-' + name);
    const profile = getProfile(app);
    if (!profile || profile.status !== 'ready' || typeof profile.fingerprint !== 'string') ngGameValueFail('unavailable-profile');
    const runtime = deps.getResidency(app, reg);
    if (!runtime || !runtime.deckReady || typeof runtime.deckReady !== 'object') ngGameValueFail('missing-residency');
    ngGameValueInteger(runtime.residencyRevision, 'invalid-residency-revision');
    for (const value of Object.values(runtime.deckReady)) if (typeof value !== 'boolean') ngGameValueFail('invalid-deck-readiness');
    const count = ngGameValueInteger(app.moveCount, 'invalid-live-move-count');
    const cap = ngGameValueInteger(app.maxMoves, 'invalid-live-move-cap');
    if (!cap || !Number.isFinite(app.aiSkill)) ngGameValueFail('invalid-live-roll-context');
    const here = app.nodes?.[app.currentPos];
    if (!here?.id || !['top', 'bottom'].includes(app.playerRole)) ngGameValueFail('missing-live-state');
    const sub = app.submissionNode(here);
    const canonical = app.nodes[app.canonicalState(app.currentPos, app.playerRole)];
    if (!canonical?.id || canonical.id !== projection.canonicalNodeId) ngGameValueFail('stale-root-canonical-state');
    const raw = { nodeId: canonical.id, role: app.playerRole, phase: 'user', moveCount: count,
      arrivalAge: 0, qMod: app._qMod || 0, combo: app._combo || 0,
      positionKey: app._posKey || null,
      panicKey: sub && app.playerRole !== sub.fromRole ? app._panicKey || null : null };
    const horizon = { kind: 'actual-roll', episodeCap: cap, moveCount: count };
    // Root age is exactly zero: current sharpness is already decayed. No need to
    // scan every future state/profile age or instantiate the adapter on the host.
    const snapshot = M.ngMdpNormalizeRootSnapshot(raw, horizon);
    const challenge = app._beltTest ? {
      names: app._beltTest.names?.slice(), pointsWin: app._beltTest.pointsWin,
      maxMoves: app._beltTest.maxMoves ?? null, beltId: app._beltTest.beltId ?? null,
    } : null;
    if (challenge && (!Array.isArray(challenge.names) || !challenge.names.every(n => typeof n === 'string')
      || !Number.isFinite(challenge.pointsWin))) ngGameValueFail('invalid-live-challenge');
    const host = { instanceId: deps.instanceId, handId,
      rollRevision: ngGameValueInteger(app._gameValueRollRevision, 'missing-roll-revision'),
      contextRevision: ngGameValueInteger(app._gameValueContextRevision, 'missing-context-revision'),
      invalidation };
    // THREAT CARDS (v1.207.0, owner 2026-09-29): the opponent's options from here, the same list the
    // threat cards render (`opponentThreats`), valued by the worker as probes (adapter `threats`).
    // While you apply a submission they are the defender's escapes. None while you are DEFENDING
    // one: that card is the finish you are already in, valued as this decision's own win chance.
    const threatIds = sub && app.playerRole !== sub.fromRole ? [] : [...new Set((app.opponentThreats ? app.opponentThreats(app.currentPos) : [])
      .map(o => o && o.node && (typeof app.threatIdOf === 'function' ? app.threatIdOf(o) : o.node.id)).filter(id => typeof id === 'string' && id))];
    return { reg: ngGameValueCopy(reg), key, projection, profile, runtime, snapshot, horizon,
      challenge, aiSkill: app.aiSkill, host, options, handId, app, threatIds };
  }
  function snapshotPayload(d) {
    // Native transport derives/validates snapshotHash; this content-derived ID
    // itself binds profile and complete runtime residency before any async work.
    const id = M.ngMdpDigest({ profile: d.profile, runtime: d.runtime });
    return ngGameValueCopy({ id, profileHash: d.profile.fingerprint, profile: d.profile, runtime: d.runtime });
  }
  function requestBody(d, payload) {
    return { apiVersion: 2, modelHash: d.reg.modelHash, mechanicsHash: d.reg.mechanicsHash,
      graphHash: d.reg.graphHash, profileHash: d.profile.fingerprint,
      opponentPolicyHash: d.reg.opponentPolicyHash, ruleset: d.reg.ruleset,
      objective: 'max-win/min-loss/min-nontermination', futureStudyPolicy: 'no-additional-study-events',
      horizon: d.horizon, state: { id: M.ngMdpStateId(d.snapshot), snapshot: d.snapshot,
        snapshotId: payload.id, snapshotHash: payload.id, aiSkill: d.aiSkill, challenge: d.challenge, host: d.host },
      ...(d.threatIds && d.threatIds.length ? { threatIds: d.threatIds.slice() } : {}) };
  }
  function actionRecords(d) {
    const stateId = M.ngMdpStateId(d.snapshot), used = new Set();
    const rows = d.projection.hand.map(row => ({ ...row, actionId: M.ngMdpActionId(stateId,
      row.techniqueId, row.kind, row.destinationId, row.defenseId || row.defense || null) }));
    return d.options.map(opt => {
      const kind = ngGameValueKind(opt), techniqueId = opt.node.id;
      const destinationId = opt.res >= 0 ? d.app.nodes[opt.res]?.id : null;
      if (!techniqueId || (opt.res >= 0 && !destinationId)) ngGameValueFail('missing-action-identity');
      let liveDefenseId = null;
      if (kind === 'escape') {
        if (!opt.defense) ngGameValueFail('missing-live-defense-identity');
        const source = d.app.nodes[opt.submission ?? d.app._defendSub];
        let detail = null;
        if (Object.prototype.hasOwnProperty.call(opt.defense, 'detail')) {
          const index = opt.defense.detail;
          if (!Number.isSafeInteger(index) || index < 0 || !source?._defenseDetails
            || !Object.prototype.hasOwnProperty.call(source._defenseDetails, index)) ngGameValueFail('missing-live-defense-detail');
          detail = source._defenseDetails[index];
        }
        liveDefenseId = M.ngMdpDefenseId(opt.defense, detail);
        if (opt.defenseId != null && opt.defenseId !== liveDefenseId) ngGameValueFail('stale-live-defense-id');
      }
      const matches = rows.filter(row => row.techniqueId === techniqueId && row.kind === kind
        && (row.destinationId || null) === (destinationId || null)
        && (kind !== 'escape' || row.defenseId === liveDefenseId));
      if (matches.length !== 1) ngGameValueFail(matches.length ? 'ambiguous-action-identity' : 'unregistered-live-action');
      const row = matches[0];
      if (used.has(row.actionId)) ngGameValueFail('duplicate-live-action');
      used.add(row.actionId);
      if (kind === 'entry') return { actionId: row.actionId, immediateExecutionKind: kind, immediateExecutionChance: 1 };
      const app = d.app, here = app.nodes[app.currentPos];
      // Live calSuccess uses legal gi mode. Keep the separate legacy EV frame
      // bound in registration; it does not select immediate probability here.
      const context = { ruleset: app._giMode, positionKey: app._posKey || null,
        noPositionBonus: app._posKey == null, techniqueKey: app.deckKeyFor(opt.node).key,
        opponentValue: app.oppVal(here), aiSkill: app.aiSkill, qMod: app._qMod || 0,
        combo: app._combo || 0, arrivalAge: 0 };
      let explanation;
      if (kind === 'escape') {
        const sub = app.nodes[app._defendSub];
        if (!sub) ngGameValueFail('missing-live-defense');
        Object.assign(context, { defenderKey: app.defendKeyFor(sub), panicKey: app._panicKey || null,
          submissionValue: app.myVal(sub), destinationValue: app.myVal(app.nodes[opt.res] || opt.node) });
        explanation = K.ngKnowledgeExplainEscape(d.profile, context, sub);
      } else explanation = K.ngKnowledgeExplainMove(d.profile, context, opt.node);
      if (explanation.status !== 'ready') ngGameValueFail(explanation.reason || 'unavailable-immediate-law');
      const liveChance = kind === 'escape' ? app.escapeChance(opt) : app.moveChance(opt.node);
      if (!Number.isFinite(liveChance) || liveChance !== explanation.chance) ngGameValueFail('live-knowledge-probability-mismatch');
      return { actionId: row.actionId, immediateExecutionKind: kind, immediateExecutionChance: liveChance, explanation };
    });
  }
  async function register(d) {
    if (dead) ngGameValueFail('provider-destroyed');
    if (!client) client = deps.createClient(); // lazy: only a real hand starts transport
    if (!client?.updateSnapshot) ngGameValueFail('snapshot-transport-not-available');
    if (registration?.key !== d.key) {
      client.cancel('metadata-changed');
      registration = { key: d.key, descriptor: ngGameValueCopy(d.reg) }; installedSnapshot = null;
      registrationPromise = Promise.resolve(client.register(registration.descriptor));
    }
    await registrationPromise;
    if (dead || registration?.key !== d.key) ngGameValueFail('superseded-registration');
  }
  const provider = {
    capture(app, options, handId) {
      let d;
      try { d = describe(app, options, handId); }
      catch (error) {
        if (error.code === 'root-metadata-pending') void provider.prepare(app).catch(() => {});
        throw error;
      }
      const payload = snapshotPayload(d), body = requestBody(d, payload), actions = actionRecords(d);
      body.requestedActionIds = actions.map(a => a.actionId);
      const identity = stable(body);
      if (latest && !latest.cancelled && latest.identity === identity
        && latest.options.every((opt, i) => opt === options[i])) return latest.capture;
      const request = { ...body, requestId: deps.instanceId + ':' + (++serial), revision: serial };
      if (!Number.isSafeInteger(serial)) ngGameValueFail('request-revision-overflow');
      request.contractHash = M.ngMdpContractHash(request);
      const capture = ngGameValueCopy({ request, actions });
      latest = { ...d, payload, identity, capture, options: options.slice(), cancelled: false };
      return capture;
    },
    isCurrent(app, request, handId) {
      const record = latest;
      if (!record || record.cancelled || record.app !== app || request.requestId !== record.capture.request.requestId
        || request.revision !== record.capture.request.revision || request.contractHash !== record.capture.request.contractHash) return false;
      try {
        if (stable(request) !== stable(record.capture.request)) return false;
        if (request.contractHash !== M.ngMdpContractHash(request)) return false;
        const d = describe(app, record.options, handId), body = requestBody(d, snapshotPayload(d));
        body.requestedActionIds = actionRecords(d).map(a => a.actionId);
        return stable(body) === record.identity;
      } catch (_) { return false; }
    },
    evaluate(request) {
      const record = latest;
      if (!record || !provider.isCurrent(record.app, request, record.handId)) ngGameValueFail('stale-provider-request');
      if (record.evaluation) return record.evaluation;
      const epoch = transportEpoch;
      issued = record;
      record.evaluation = (async () => {
        await register(record);
        if (epoch !== transportEpoch || !provider.isCurrent(record.app, request, record.handId)) ngGameValueFail('cancelled-before-snapshot');
        if (installedSnapshot?.registrationKey !== record.key || installedSnapshot.id !== record.payload.id) {
          const ack = await client.updateSnapshot(record.payload);
          if (ack.snapshotId !== record.payload.id || ack.snapshotHash !== record.payload.id) ngGameValueFail('snapshot-ack-mismatch');
          installedSnapshot = { registrationKey: record.key, id: record.payload.id };
        }
        if (epoch !== transportEpoch || !provider.isCurrent(record.app, request, record.handId)) ngGameValueFail('cancelled-before-evaluate');
        const result = await client.evaluate(request);
        if (epoch !== transportEpoch || !provider.isCurrent(record.app, request, record.handId)) ngGameValueFail('stale-provider-response');
        return result; // native client and consumer validate ALL echoed result fields
      })();
      return record.evaluation;
    },
    cancel(reason = 'cancelled') {
      transportEpoch++;
      if (issued) { issued.cancelled = true; issued = null; }
      client?.cancel(reason);
      // Consumer.begin calls cancel AFTER capture(new). Do not retire that new,
      // not-yet-issued record while cancelling the previous controller token.
    },
    invalidate(reason = 'context-changed') {
      invalidation++;
      if (latest) latest.cancelled = true;
      provider.cancel(reason);
    },
    resetClient(reason = 'transport-reset') {
      // Hard worker termination is not a game outcome. Host may retry on the
      // next hand or an explicit refresh, without an unbounded automatic loop.
      provider.invalidate(reason);
      const old = client;
      client = null; registration = null; registrationPromise = null;
      installedSnapshot = null; rootDescription = null; preparing = null;
      old?.destroy();
    },
    async prepare(app) {
      if (dead || app.__ngDestroyed || app._execution || app._waitingSubmission || app._sweep
        || app._choiceValueSource !== provider || !app._optList?.length) return;
      const reg = ngGameValueCopy(deps.getRegistration(app));
      if (!reg || reg.verified !== true || reg.coverage?.status !== 'COMPLETE') return;
      const key = ngGameValueRegistrationKey(reg, stable);
      const root = { nodeId: app.nodes[app.currentPos]?.id, role: app.playerRole };
      const prepareKey = stable([key, root.nodeId, root.role]);
      if (preparing?.key === prepareKey) return preparing.promise;
      const pending = { key: prepareKey };
      pending.promise = (async () => {
        await register({ key, reg });
        const value = deps.prepareRootMetadata
          ? await deps.prepareRootMetadata({ client, registration: reg, registrationKey: key, root })
          : await client.describeRoot(root);
        if (!value || value.registrationKey !== key || value.coverage?.status !== 'COMPLETE') ngGameValueFail('unverified-root-description');
        for (const name of ['modelHash', 'mechanicsHash', 'graphHash', 'opponentPolicyHash', 'ruleset', 'evFrame'])
          if (value[name] !== reg[name]) ngGameValueFail('stale-root-' + name);
        if (registration?.key === key && preparing === pending
          && app.nodes[app.currentPos]?.id === root.nodeId && app.playerRole === root.role)
          rootDescription = { key: prepareKey, value: ngGameValueCopy(value) };
        if (preparing === pending && !dead && !app.__ngDestroyed && app._choiceValueSource === provider
          && app.nodes[app.currentPos]?.id === root.nodeId && app.playerRole === root.role) app.refreshChoiceValues?.();
      })().finally(() => { if (preparing === pending) preparing = null; });
      preparing = pending;
      return pending.promise;
    },
    destroy() {
      if (dead) return;
      provider.invalidate('destroyed'); dead = true; preparing = null;
      client?.destroy(); client = null; registration = null; registrationPromise = null; latest = null; rootDescription = null; installedSnapshot = null;
    },
  };
  return provider;
}
export {
  ngGameValueCreateProvider, ngGameValueRegistrationKey,
};
