/* Live law adapter. Imports are injected (knowledge arithmetic has ONE owner).
 * ngMdpCaptureGameGraph(app) is a read-only, once-per-content/frame projection;
 * it does not fetch, mutate the app, copy decks, or serialize the layout graph.
 * Graph/profile are registered once in the worker. ngMdpCreateGameAdapter(graph,
 * profile, knowledge) enumerates all choices and actual fixed opponent reactions.
 *
 * State: nodeId (authored seat ID), physical role, phase user/opponent, moveCount,
 * arrivalAge, qMod, combo, positionKey, panicKey. Request fixes sampled cap,
 * opponent skill, challenge pool/points classifier, frame and content residency.
 * Future study = immediate commitment with no further grades/expiry. Loading a
 * deck is a new content revision; deck availability is frozen during each solve.
 * This is a conditional snapshot, not a prediction of future network timing.
 *
 * Counter compression proof: all future moveCount reads affecting probabilities
 * or terminal classes are >= episodeCap. Values above that cap are equivalent,
 * but reaching the cap is NOT itself terminal. Only the source's explicit check
 * sites end the round. Eventual ignores this cap. Arrival age can be saturated
 * only once ALL snapshot sharpness has reached zero under repeated live decay.
 */
var NG_MDP_ADAPTER_VERSION = 1;
function ngMdpSharpnessAgeCap(profile, knowledge) {
  let cap = 0;
  for (const sharp of Object.values(profile.sharp || {})) {
    let age = 0; while (knowledge.ngKnowledgeSharpAfter(sharp, age) > 0 && age < 256) age++;
    if (age === 256) throw new Error('sharpness-state-budget'); cap = Math.max(cap, age);
  }
  return cap;
}
function ngMdpNormalizeSnapshot(input, request, metadata, ageCap) {
  if (!input || !['top', 'bottom'].includes(input.role) || !['user', 'opponent'].includes(input.phase)) throw new Error('requires-context');
  const s = { ...input }; delete s.id; delete s.aiSkill; delete s.challenge;
  if (request.horizon.kind === 'eventual' && s.moveCount == null) s.moveCount = 0;
  if (!Number.isSafeInteger(s.moveCount) || s.moveCount < 0 || !Number.isSafeInteger(s.arrivalAge) || s.arrivalAge < 0) throw new Error('invalid-mechanical-clock');
  if (!Number.isFinite(s.qMod) || !Number.isSafeInteger(s.combo) || s.combo < 0) throw new Error('invalid-transient-context');
  s.nodeId = metadata.canonical[ngMdpStable([s.nodeId, s.role])] || s.nodeId;
  s.moveCount = request.horizon.kind === 'eventual' ? 0 : Math.min(s.moveCount, request.horizon.episodeCap);
  s.arrivalAge = Math.min(s.arrivalAge, ageCap);
  return s;
}
// Cheap host identity mapping over the CURRENT hand only. Metadata owns stable
// defenseId; live detail/to can be joined to it within the same verified artifact.
// Caller must reject zero/multiple matches, never choose the first same-name card.
function ngMdpRootActions(metadata, normalizedSnapshot) {
  if (!metadata.coverage || metadata.coverage.status !== 'COMPLETE') throw new Error('incomplete-mechanics-metadata');
  const hand = metadata.hands[ngMdpStable([normalizedSnapshot.nodeId, normalizedSnapshot.role])];
  if (!hand) throw new Error('requires-context');
  const stateId = ngMdpStateId(normalizedSnapshot);
  return hand.map(a => ({ ...a, stateId, actionId: ngMdpActionId(stateId, a.techniqueId, a.kind, a.destinationId, a.defenseId || a.defense || null) }));
}
function ngMdpCaptureGameGraph(app) {
  const fork = Object.create(app); fork.fx = () => {}; fork._relaxedBeat = 1;
  const nodes = [], hands = {}, canonical = {}, destinations = {}, evHands = {};
  const idOf = i => i >= 0 && app.nodes[i] ? app.nodes[i].id : null;
  const resolve = to => {
    if (Object.prototype.hasOwnProperty.call(destinations, to)) return;
    const r = app.resolveOutcomeTo(to);
    destinations[to] = { nodeId: idOf(r.idx), role: r.role || null, terminal: !!r.terminal };
  };
  for (const n of app.nodes) {
    if (!n.id) throw new Error('missing-authored-node-id');
    const sub = app.submissionNode(n);
    const cal = n.cal ? JSON.parse(JSON.stringify(n.cal)) : null;
    for (const o of cal && cal.outcomes || []) resolve(o.to);
    for (const d of cal && cal.defenses || []) resolve(d.to);
    nodes.push({ id: n.id, t: n.t, ty: n.ty, role: n.role || null, fromRole: n.fromRole || null,
      pairId: idOf(n.pi), submissionId: sub ? sub.id : null, posId: n.posId || null,
      fromPositionId: n.fromPositionId || null, s: n.s || null, dom: n.dom || 0,
      allowed: !!app.rsAllows(n), cal, deckKey: app.deckKeyFor(n).key,
      fallbackRole: app.performerRole(n.t, n.ty), poolName: app.splitName(n.t).main.toLowerCase() });
    for (const role of ['top', 'bottom']) {
      const key = ngMdpStable([n.id, role]); canonical[key] = idOf(app.canonicalState(n.idx, role));
      if (n.ty !== 'positions' && n.ty !== 'submissions') continue;
      fork.currentPos = n.idx; fork.playerRole = role;
      const opts = fork.optionsFor(n.idx, role);
      hands[key] = opts.map(o => ({ techniqueId: o.node.id, destinationId: idOf(o.res), destinationRole: o.destinationRole || null,
        kind: o.action === 'enter' ? 'entry' : o.action || (o.node.ty === 'submissions' ? 'entry' : 'transition'),
        defense: o.defense || null, defenseId: o.defense ? ngMdpDefenseId(o.defense, app.nodes[o.submission]._defenseDetails && app.nodes[o.submission]._defenseDetails[o.defense.detail]) : null,
        relaxed: !!o.relaxed, ev: o.ev ? { e0: o.ev.e0, c1: o.ev.c1, att: o.ev.att } : null }));
      const m = app._ev && app._ev.get(n.idx + '/' + role), k = app._evLamIdx();
      if (m && k >= 0) evHands[key] = [...m].filter(([, r]) => r.lam[k]).map(([idx, r]) => ({ techniqueId: idOf(idx), att: r.att, c1: r.lam[k][1] }));
    }
  }
  const deckReady = {};
  for (const n of nodes) {
    deckReady[n.deckKey] = !!app._deckHasCards(n.deckKey);
    if (n.ty === 'submissions') deckReady[n.t + '|Defender'] = !!app._deckHasCards(n.t + '|Defender');
  }
  const unloadedSubmissions = nodes.filter(n => n.ty === 'submissions' && n.submissionId === n.id && !(n.cal && n.cal.defenses)).map(n => n.id);
  return { version: 1, ruleset: app._giMode, evFrame: app._evFrame, nodes, hands, canonical, destinations, evHands, deckReady,
    coverage: { status: unloadedSubmissions.length ? 'INCOMPLETE' : 'COMPLETE', source: 'runtime-reference-snapshot', nodes: nodes.length, hands: Object.keys(hands).length,
      actions: Object.values(hands).reduce((sum, a) => sum + a.length, 0),
      unloadedSubmissions } };
}
function ngMdpCaptureDecision(app) {
  if (!Number.isFinite(app.aiSkill)) throw new Error('missing-sampled-opponent-skill');
  const sub = app.submissionNode(app.nodes[app.currentPos]);
  return { nodeId: app.nodes[app.currentPos].id, role: app.playerRole, phase: 'user', moveCount: app.moveCount,
    arrivalAge: 0, qMod: app._qMod || 0, combo: app._combo || 0, positionKey: app._posKey || null,
    panicKey: sub && app.playerRole !== sub.fromRole ? (app._panicKey || null) : null,
    aiSkill: app.aiSkill, challenge: app._beltTest ? { names: app._beltTest.names.slice(), pointsWin: app._beltTest.pointsWin } : null };
}
function ngMdpCreateGameAdapter(graph, profile, knowledge, runtime) {
  if (!graph.coverage || graph.coverage.status !== 'COMPLETE') throw new Error('incomplete-mechanics-metadata');
  if (!profile || profile.status === 'unavailable') throw new Error('unavailable-profile');
  const deckReady = runtime && runtime.deckReady || graph.deckReady || {};
  const K = knowledge, nodes = new Map(graph.nodes.map(n => [n.id, n]));
  const flip = role => role === 'top' ? 'bottom' : 'top';
  const node = id => { const n = nodes.get(id); if (!n) throw new Error('unknown-node:' + id); return n; };
  const sub = n => n && n.submissionId ? node(n.submissionId) : null;
  const canonical = (id, role) => graph.canonical[ngMdpStable([id, role])] || id;
  const value = (n, role, opposite) => {
    const i = n.ty === 'positions' ? (role === 'bottom' ? 1 : 0) : (n.fromRole ? (n.fromRole === role ? 0 : 1) : (role === 'bottom' ? 1 : 0));
    if (n.s && typeof n.s[opposite ? 1 - i : i] === 'number') return n.s[opposite ? 1 - i : i];
    return (opposite ? -1 : role === 'bottom' ? -1 : 1) * n.dom;
  };
  const ageCap = ngMdpSharpnessAgeCap(profile, K);
  const chanceCache=new Map(),handCache=new Map(),bonusCache=new Map(),outcomeCache=new Map(),massCache=new Map();
  function bonusTotal(key,age){
    let ages=bonusCache.get(key);if(!ages){ages=new Map();bonusCache.set(key,ages);}
    if(!ages.has(age))ages.set(age,K.ngKnowledgeBonus(profile,key,age).total);
    return ages.get(age);
  }
  function chanceContextKey(s,request){
    const ai=request.state.aiSkill==null?request.state.snapshot&&request.state.snapshot.aiSkill:request.state.aiSkill;
    if(!Number.isFinite(ai))throw new Error('missing-sampled-opponent-skill');
    return ngMdpStable([s.nodeId,s.role,s.arrivalAge,s.qMod,s.combo,bonusTotal(s.positionKey,s.arrivalAge),ai]);
  }
  function normalize(input, request) {
    const s = ngMdpNormalizeSnapshot(input, request, graph, ageCap); node(s.nodeId); return s;
  }
  function context(s, request, act, destination) {
    const n = node(s.nodeId), submission = sub(n);
    const aiSkill = request.state.aiSkill == null ? request.state.snapshot && request.state.snapshot.aiSkill : request.state.aiSkill;
    if (!Number.isFinite(aiSkill)) throw new Error('missing-sampled-opponent-skill');
    return { ruleset: request.ruleset, positionKey: s.positionKey, techniqueKey: act ? act.deckKey : null,
      noPositionBonus: s.positionKey == null,
      defenderKey: submission ? submission.t + '|Defender' : null, panicKey: s.panicKey,
      opponentValue: value(n, s.role, true), aiSkill,
      qMod: s.qMod, combo: s.combo, arrivalAge: s.arrivalAge,
      submissionValue: submission ? value(submission, s.role) : 0,
      destinationValue: destination ? value(destination, s.role) : 0 };
  }
  function defend(s, submission) {
    const key = submission.t + '|Defender';
    const panicKey = deckReady[key] ? key : deckReady[s.positionKey] ? s.positionKey : null;
    return { ...s, nodeId: submission.pairId || submission.id, role: flip(submission.fromRole), phase: 'user', panicKey, positionKey: key };
  }
  function arrive(s) {
    s = { ...s, nodeId: canonical(s.nodeId, s.role), phase: 'user' };
    const n = node(s.nodeId), submission = sub(n);
    // enterLand returns into enterDefense BEFORE clearing qMod or decaying sharpness.
    if (submission && s.role !== submission.fromRole) return defend(s, submission);
    if (submission) s.nodeId = submission.id;
    const projected = K.ngKnowledgeAdvance({ arrivalAge: s.arrivalAge, qMod: s.qMod, combo: s.combo }, { type: 'arrival', first: false });
    return { ...s, arrivalAge: projected.arrivalAge, qMod: projected.qMod, combo: projected.combo, positionKey: node(s.nodeId).deckKey, panicKey: null };
  }
  function classify(s, kind, subtype, request) {
    const challenge = request.state.challenge || request.state.snapshot && request.state.snapshot.challenge;
    // Pins the current endRound defect, including lose -> points win. A gameplay
    // fix must change BOTH consumers and mechanicsHash; never "repair" only here.
    if (challenge) {
      const dominance = Math.round(value(node(s.nodeId), s.role) * 100) / 100;
      if (kind !== 'win' && dominance >= challenge.pointsWin) return { terminal: 'win', subtype: 'challenge-points-win' };
      if (kind === 'reset') return { terminal: 'loss', subtype: 'challenge-reset-loss' };
    }
    return { terminal: kind === 'win' ? 'win' : kind === 'lose' ? 'loss' : 'explicitNoResult', subtype };
  }
  function cap(s, request) { return request.horizon.kind === 'actual-roll' && s.moveCount >= request.horizon.episodeCap; }
  function destination(out) {
    if (!out) return { nodeId: null, role: null, terminal: false };
    if (!Object.prototype.hasOwnProperty.call(graph.destinations, out.to)) throw new Error('unknown-destination:' + out.to);
    return graph.destinations[out.to];
  }
  function rows(act, branch, s) {
    const cacheKey=ngMdpStable([act.id,branch,K.ngKnowledgeSkew(s.combo)]);
    if(outcomeCache.has(cacheKey))return outcomeCache.get(cacheKey);
    const table = K.ngKnowledgeOutcomeWeights(act, branch, K.ngKnowledgeSkew(s.combo));
    if (!table || !table.outcomes || !table.outcomes.length) return [{ p: ngMdpRat(1), out: null }];
    if (!(table.total > 0)) return [{ p: ngMdpRat(1), out: table.outcomes[0] }];
    // The source schema calls these RAW weights. Normalize them explicitly, not
    // a purported compiled probability row or missing outcome mass.
    const weights = table.weights.map(ngMdpRat), total = weights.reduce(ngMdpAdd, ngMdpRat(0));
    const result=table.outcomes.map((out, i) => ({ out, p: ngMdpDiv(weights[i], total) })).filter(r => r.p[0]);
    outcomeCache.set(cacheKey,result);return result;
  }
  function weightedRows(act,success,s,chance){
    const key=ngMdpStable([act.id,success,K.ngKnowledgeSkew(s.combo),chance]);
    if(!massCache.has(key)){
      const p=ngMdpRat(chance),factor=success?p:ngMdpSub(ngMdpRat(1),p);
      massCache.set(key,rows(act,success,s).map(row=>({out:row.out,mass:ngMdpMul(factor,row.p)})));
    }
    return massCache.get(key);
  }
  function moveChance(s, act, request) {
    const key=ngMdpStable([chanceContextKey(s,request),act.id]);
    if(chanceCache.has(key))return chanceCache.get(key);
    const r = K.ngKnowledgeExplainMove(profile, context(s, request, act), act);
    if (r.status !== 'ready') throw new Error(r.reason || 'missing-move-profile-context');chanceCache.set(key,r.chance);return r.chance;
  }
  function hand(s, role, request) {
    const id = canonical(s.nodeId, role), n = node(id), submission = sub(n);
    if (submission && !(submission.cal && submission.cal.defenses)) throw new Error('unloaded-submission-choices:' + submission.id);
    const source = graph.hands[ngMdpStable([id, role])];
    if (!source) throw new Error('unavailable-hand:' + id + '/' + role);
    const cacheKey=ngMdpStable([id,role,submission?null:chanceContextKey(s,request)]);
    if(handCache.has(cacheKey))return handCache.get(cacheKey);
    const result = source.filter(o => node(o.techniqueId).allowed).map(o => ({ ...o }));
    if (submission) {handCache.set(cacheKey,result);return result;}
    const evp = act => {
      const c = act.cal, br = c && c.successRateByRuleset;
      const p = br && br[graph.evFrame] != null ? br[graph.evFrame] : c && c.successRate;
      return typeof p === 'number' ? Math.max(0, Math.min(1, p / 100)) : null;
    };
    const evRows = graph.evHands[ngMdpStable([id, role])] || [];
    let total = 0, shift = 0;
    for (const r of evRows) { const act = node(r.techniqueId), p = evp(act); if (p == null) continue; total += r.att; shift += r.att * (moveChance(s, act, request) - p) * r.c1; }
    shift = total > 0 ? shift / total : 0;
    for (const o of result) {
      const act = node(o.techniqueId), p0 = evp(act); o.chance = moveChance(s, act, request);
      o.order = o.ev ? p0 == null ? o.ev.e0 : o.ev.e0 + (o.chance - p0) * o.ev.c1 - shift : null;
    }
    result.sort((a, b) => {
      const an = node(a.techniqueId), bn = node(b.techniqueId), name = an.t < bn.t ? -1 : an.t > bn.t ? 1 : 0;
      if (a.relaxed || b.relaxed) return value(bn, s.role) - value(an, s.role) || name;
      if ((a.order == null) !== (b.order == null)) return a.order == null ? 1 : -1;
      return (a.order != null ? b.order - a.order : 0) || b.chance - a.chance || ((b.ev && b.ev.att) || 0) - ((a.ev && a.ev.att) || 0) || name;
    });
    handCache.set(cacheKey,result);return result;
  }
  function endpointOf(request, probability, next, events, terminal) {
    return { probability: ngMdpFraction(probability), ...(terminal || { next: normalize(next, request) }), events };
  }
  function finishMoveOf(request, p, next, events) {
    return cap(next, request)
      ? endpointOf(request, p, null, events.concat('cap-check', 'terminal'), classify(next, 'reset', 'cap-reset', request))
      : endpointOf(request, p, arrive(next), events.concat('cap-check', 'arrival'));
  }
  // The live opponent's resolution of ONE positional technique `a` from state `s` (dev's
  // opponentDefend: the whole outcome table is drawn; a terminal row leaves you in place), each row
  // scaled by `weight`. The forced opponent action weights it by the policy's choice mass; a threat
  // probe weights it 1. One implementation for both, so a threat card and the game cannot disagree.
  function opponentPositionalRows(s, a, weight, request) {
    const out = [], act = node(a.techniqueId);
    for (const row of rows(act, null, s)) {
      const r = destination(row.out), dest = r.terminal ? s.nodeId : r.nodeId || a.destinationId || s.nodeId;
      const target = node(dest), caught = sub(target);
      const role = caught ? flip(caught.fromRole) : r.role ? flip(r.role) : act.fallbackRole ? flip(act.fallbackRole) : s.role;
      out.push(finishMoveOf(request, ngMdpMul(weight, row.p), { ...s, nodeId: dest, role, moveCount: s.moveCount + 1 }, ['opponent-positional', 'increment']));
    }
    return out;
  }
  // THREAT PROBES (v1.207.0; owner 2026-09-29: a threat card shows YOUR win chance if the opponent
  // tries that move). From the current decision's node, with the opponent to move now: a submission
  // enters your defense; a positional move resolves exactly as the forced opponent action resolves
  // a chosen technique (`opponentPositionalRows`), without the policy's choice weight. Probes are
  // evaluation seeds (ngMdpExpandSteps), never player actions, and change no root value: optimal
  // values are per state. While you are already defending a submission there is no separate threat
  // to value, so those probes are unavailable with that reason.
  function threats(input, request, ids) {
    if (graph.ruleset !== request.ruleset) throw new Error('stale-graph-ruleset');
    const s = { ...normalize(input, request), phase: 'opponent' }, here = node(s.nodeId), out = [];
    const options = sub(here) ? new Map() : new Map(hand(s, flip(s.role), request).map(a => [a.techniqueId, a]));
    for (const id of ids) {
      const a = options.get(id);
      if (!a) { out.push({ techniqueId: id, status: 'unavailable', reason: sub(here) ? 'defending-now' : 'not-an-opponent-option' }); continue; }
      const act = node(a.techniqueId);
      const branches = act.ty === 'submissions'
        ? [endpointOf(request, ngMdpRat(1), defend(s, act), ['opponent-submission', 'enter-defense'])]
        : opponentPositionalRows(s, a, ngMdpRat(1), request);
      out.push({ techniqueId: id, status: 'ready', branches });
    }
    return out;
  }
  function enumerate(input, request) {
    if (graph.ruleset !== request.ruleset) throw new Error('stale-graph-ruleset');
    const s = normalize(input, request), stateId = ngMdpStateId(s), n = node(s.nodeId), submission = sub(n);
    const out = { id: stateId, snapshot: s, actions: [] };
    const endpoint = (...args) => endpointOf(request, ...args), finishMove = (...args) => finishMoveOf(request, ...args);
    if (s.phase === 'opponent') {
      const branches = [], actionId = ngMdpActionId(stateId, n.id, 'forced', null, 'actual-opponent');
      out.actions.push({ id: actionId, branches });
      if (submission) {
        if (s.role !== submission.fromRole) branches.push(endpoint(ngMdpRat(1), defend(s, submission), ['enter-defense']));
        else {
          const responses = hand(s, flip(s.role), request);
          if (!responses.length) branches.push(endpoint(ngMdpRat(1), arrive(s), ['arrival']));
          for (const response of responses) {
            const target = node(response.destinationId), role = flip(response.destinationRole);
            const id = target.role === role ? target.id : target.pairId || target.id;
            branches.push(endpoint(ngMdpRat('1/' + responses.length), arrive({ ...s, nodeId: id, role, moveCount: s.moveCount + 1 }), ['opponent-escape', 'increment', 'arrival']));
          }
        }
        return out;
      }
      const options = hand(s, flip(s.role), request), challenge = request.state.challenge || request.state.snapshot && request.state.snapshot.challenge;
      const poolAllows = a => !challenge || challenge.names.includes(node(a.techniqueId).poolName);
      const subs = options.filter(a => node(a.techniqueId).ty === 'submissions' && poolAllows(a));
      let trans = options.filter(a => node(a.techniqueId).ty !== 'submissions');
      if (challenge) { const eligible = trans.filter(poolAllows); if (eligible.length) trans = eligible; }
      if (!subs.length && !trans.length) {
        branches.push(endpoint(ngMdpRat(1), null, ['terminal'], classify(s, 'reset', 'no-action-reset', request))); return out;
      }
      const pf = ngMdpRat(subs.length ? trans.length ? Math.max(.18, Math.min(.85, .34 + value(n, s.role, true) * .55)) : .9 : 0);
      for (const a of subs) branches.push(endpoint(ngMdpDiv(pf, ngMdpRat(subs.length)), defend(s, node(a.techniqueId)), ['opponent-submission', 'enter-defense']));
      trans.sort((a,b) => value(node(b.destinationId || b.techniqueId), s.role, true) - value(node(a.destinationId || a.techniqueId), s.role, true));
      const fallback = (trans.length ? trans : subs).slice(0, 3);
      for (const a of fallback) branches.push(...opponentPositionalRows(s, a, ngMdpDiv(ngMdpSub(ngMdpRat(1), pf), ngMdpRat(fallback.length)), request));
      return out;
    }
    const actions = hand(s, s.role, request);
    if (!actions.length) {
      // User enterLand starts a NEW roll directly; it does not call endRound,
      // award points, or record a failed belt attempt. Opponent no-choice differs.
      out.actions.push({ id: ngMdpActionId(stateId, n.id, 'forced', null, 'no-choices'), branches: [endpoint(ngMdpRat(1), null, ['auto-restart'], { terminal: 'explicitNoResult', subtype: 'user-no-action-restart' })] }); return out;
    }
    for (const a of actions) {
      const act = node(a.techniqueId), branches = [];
      const id = ngMdpActionId(stateId, act.id, a.kind, a.destinationId, a.defenseId || a.defense || null);
      const result = { id, kind: a.kind, immediateExecutionKind: a.kind, branches }; out.actions.push(result);
      if (a.kind === 'entry') {
        result.immediateExecutionChance = 1;
        branches.push(endpoint(ngMdpRat(1), arrive({ ...s, nodeId: act.id, role: act.fromRole, moveCount: s.moveCount + 1 }), ['commit', 'entry', 'increment', 'arrival'])); continue;
      }
      if (a.kind === 'escape') {
        const explained = K.ngKnowledgeExplainEscape(profile, context(s, request, act, node(a.destinationId)), submission);
        if (explained.status !== 'ready') throw new Error(explained.reason || 'missing-defense-profile-context');
        result.immediateExecutionChance = explained.chance;
        const p = ngMdpRat(explained.chance);
        branches.push(endpoint(p, arrive({ ...s, nodeId: canonical(a.destinationId, a.destinationRole), role: a.destinationRole, moveCount: s.moveCount + 1, panicKey: null }), ['commit', 'escape', 'increment', 'arrival']));
        branches.push(endpoint(ngMdpSub(ngMdpRat(1), p), null, ['commit', 'failed-escape', 'terminal'], classify(s, 'lose', 'submission-loss', request))); continue;
      }
      const chance = moveChance(s, act, request); result.immediateExecutionChance = chance;
      for (const success of [true, false]) for (const row of weightedRows(act, success, s,chance)) {
        const mass = row.mass, r = destination(row.out);
        if (success && (r.terminal || (!row.out && act.ty === 'submissions'))) {
          branches.push(endpoint(mass, null, ['commit', 'success', 'terminal'], classify(s, 'win', 'submission-win', request))); continue;
        }
        if (success) {
          const id = r.nodeId ? canonical(r.nodeId, r.role || s.role) : a.destinationId || s.nodeId, target = node(id), nextSub = sub(target);
          const role = r.role || (nextSub ? nextSub.fromRole : act.fallbackRole || s.role);
          branches.push(finishMove(mass, { ...s, nodeId: id, role, moveCount: s.moveCount + 1 }, ['commit', 'success', 'increment']));
        } else {
          const id = r.nodeId ? canonical(r.nodeId, r.role || s.role) : s.nodeId;
          if (id === s.nodeId) branches.push(endpoint(mass, { ...s, phase: 'opponent' }, ['commit', 'same-state-miss', 'opponent']));
          else {
            const nextSub = sub(node(id)), role = r.role || (nextSub ? flip(nextSub.fromRole) : s.role);
            branches.push(endpoint(mass, { ...s, nodeId: id, role, phase: 'opponent', moveCount: s.moveCount + 1 }, ['commit', 'changed-state-miss', 'increment', 'opponent']));
          }
        }
      }
    }
    return out;
  }
  // Position/panic key TEXT is not an additional mechanical state once its
  // current effect and fallback availability agree. Age cannot change while a
  // position key survives: non-defense arrival changes age AND replaces the key;
  // defense replaces it without decay, freezing the selected panic bonus until
  // that defense ends. Node/role/phase/count/age/qMod/combo remain exact. This is
  // a profile/residency-conditional bisimulation, not a persisted deck identity.
  function normalizedBehaviorKey(s){
    return ngMdpStable([s.nodeId,s.role,s.phase,s.moveCount,s.arrivalAge,s.qMod,s.combo,
      bonusTotal(s.positionKey,s.arrivalAge),!!deckReady[s.positionKey],
      s.panicKey==null?null:bonusTotal(s.panicKey,s.arrivalAge)]);
  }
  const behaviorKey=(input,request)=>normalizedBehaviorKey(normalize(input,request));
  return { normalize, enumerate, threats, behaviorKey, normalizedBehaviorKey,normalizedStateId:ngMdpStateId,
    stateId: (s, request) => ngMdpStateId(normalize(s, request)), graphCoverage: graph.coverage,
    semantics: { clock: 'live-selective-checks', futureStudy: 'no-additional-study-events', futureContent: 'snapshot-residency', counterSaturation: 'at-cap-equivalence', sharpnessAgeCap: ageCap, stateEquivalence:'same-mechanical-context+current-deck-effects+residency', equivalenceScope:'terminal-outcomes-only', exposureLabelsPreserved:false } };
}

function* ngMdpExpandSteps(adapter, request, options) {
  const limits = { maxStates: 20000, maxBranches: 200000, maxMilliseconds: 30000, ...(options || {}) };
  for(const key of ['maxStates','maxBranches','maxMilliseconds'])if(!Number.isSafeInteger(limits[key])||limits[key]<=0)throw new Error('invalid-budget:'+key);
  const started = Date.now(), pending = [adapter.normalize(request.state.snapshot, request)], states = [], seen = new Map(), classes=new Map(),positive=new Map();
  // The live adapter guarantees enumerate().branches[].next is normalized.
  // Generic adapters without this seam retain the validating public methods.
  const stateId=s=>adapter.normalizedStateId?adapter.normalizedStateId(s):adapter.stateId(s,request);
  const classKey=s=>limits.behaviorCompression!==false&&adapter.behaviorKey?(adapter.normalizedBehaviorKey?adapter.normalizedBehaviorKey(s):adapter.behaviorKey(s,request)):stateId(s);
  const model = { apiVersion: 2, states, contractHash: ngMdpContractHash(request) };
  for (const key of ['modelHash', 'mechanicsHash', 'graphHash', 'profileHash', 'opponentPolicyHash', 'ruleset']) model[key] = request[key];
  const expected = adapter.stateId(request.state.snapshot, request);
  if (request.horizon.kind === 'actual-roll' && request.state.snapshot.moveCount !== request.horizon.moveCount) throw new Error('stale-root-move-count');
  if (request.state.id !== expected) throw new Error('stale-state-identity');
  seen.set(expected,expected);classes.set(classKey(pending[0]),expected); let branchCount = 0,aliases=0;
  const failure=reason=>{const error=new Error(reason);error.coverage={status:'INCOMPLETE',states:states.length,discoveredStates:seen.size,branches:branchCount};throw error;};
  // One linker for every row, action branch or threat-probe row alike: count it, drop a zero row's
  // successor, map the successor to its canonical (behaviour-class) ID and queue it once.
  const link=b=>{
    branchCount++; if (branchCount > limits.maxBranches) failure('expansion-branch-budget');
    if(!positive.has(b.probability))positive.set(b.probability,!!ngMdpRat(b.probability)[0]);
    if (!b.next || !positive.get(b.probability)) { delete b.next; return; }
    const identity=stateId(b.next),behavior=classKey(b.next);
    b.to=classes.get(behavior)||identity;if(b.to!==identity)aliases++;
    if (!seen.has(b.to)) {
      if (seen.size >= limits.maxStates) failure('expansion-state-budget');
      seen.set(b.to,b.to);classes.set(behavior,b.to);pending.push(b.next);
    }
    b.to=seen.get(b.to); // reuse canonical ID strings instead of per-branch JSON copies
    delete b.next;
  };
  // THREAT PROBES seed the expansion (adapter `threats`): their successors are expanded and solved
  // like any reachable state, so each threat card can be backed up with the same Σ P·V as a card.
  // Adding states cannot change the root's value (optimal values are per state); it costs states.
  const threatIds=Array.isArray(request.threatIds)?request.threatIds:[];
  if(threatIds.length){
    if(typeof adapter.threats!=='function')throw new Error('threat-probes-unsupported');
    model.probes=adapter.threats(request.state.snapshot,request,threatIds);
    for(const probe of model.probes)for(const b of probe.branches||[])link(b);
  }
  for (let i = 0; i < pending.length; i++) {
    if (limits.cancelled && limits.cancelled()) throw new Error('cancelled');
    if (Date.now() - started > limits.maxMilliseconds) failure('expansion-time-budget');
    const snapshot = pending[i], id = stateId(snapshot);
    let state;
    try { state = adapter.enumerate(snapshot, request); }
    catch (error) { states.push({ id, actions: [{ id: 'unavailable', status: 'unavailable', reason: error.message }] }); yield; continue; }
    for (const a of state.actions) for (const b of a.branches) link(b);
    delete state.snapshot; states.push(state); yield;
  }
  model.adapterCoverage = { states: states.length, branches: branchCount, equivalentDestinationRedirects:aliases, graph: adapter.graphCoverage, semantics: {...adapter.semantics,behaviorCompression:limits.behaviorCompression!==false} };
  model.stateEquivalence={scope:limits.behaviorCompression===false?'literal-state':'terminal-outcomes-only',rootIdentityPreserved:true,
    exposureLabelsPreserved:limits.behaviorCompression===false,futureExplanationLabelsPreserved:limits.behaviorCompression===false,
    replayLabelsPreserved:limits.behaviorCompression===false,profileConditional:true,residencyConditional:true};
  if(limits.cancelled&&limits.cancelled())throw new Error('cancelled');
  if(Date.now()-started>limits.maxMilliseconds)failure('expansion-time-budget');
  return model;
}
function ngMdpExpand(adapter, request, options) { const it = ngMdpExpandSteps(adapter, request, options); let x; do { x = it.next(); } while (!x.done); return x.value; }
async function ngMdpExpandAsync(adapter, request, options) {
  const it = ngMdpExpandSteps(adapter, request, options); let x, last = Date.now();
  do { x = it.next(); if (!x.done && Date.now() - last >= 8) { await new Promise(resolve => setTimeout(resolve, 0)); last = Date.now(); } } while (!x.done);
  return x.value;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { NG_MDP_ADAPTER_VERSION, ngMdpNormalizeSnapshot, ngMdpRootActions, ngMdpSharpnessAgeCap, ngMdpCaptureGameGraph, ngMdpCaptureDecision, ngMdpCreateGameAdapter, ngMdpExpand, ngMdpExpandAsync, ngMdpExpandSteps };
