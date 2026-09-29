// Choice-value presentation consumes a complete solve; it contains no game probabilities.
// The host supplies ngMdpContractHash(request), canonical action IDs and the knowledge
// explanation for that same snapshot. No layout index, drawn outcome or RNG enters here.
// Real ES module for node tests; the browser build strips exports into its shared scope.
export const NG_CHOICE_VALUE = Object.freeze({
  apiVersion: 2,
  objective: "max-win/min-loss/min-nontermination",
  futureStudyPolicy: "no-additional-study-events",
});

function ngChoiceValueCopy(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(ngChoiceValueCopy));
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, ngChoiceValueCopy(v)])));
  }
  return value;
}

function ngChoiceValueJSON(value) {
  if (Array.isArray(value)) return "[" + value.map(ngChoiceValueJSON).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + ngChoiceValueJSON(value[k])).join(",") + "}";
  return JSON.stringify(value);
}

function ngChoiceValueProbability(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
}

function ngChoiceValueVector(o) {
  return !!o && [o.win, o.loss, o.explicitNoResult, o.nontermination].every(ngChoiceValueProbability)
    && Math.abs(o.win + o.loss + o.explicitNoResult + o.nontermination - 1) <= 1e-7;
}

function ngChoiceValueBounds(bounds) {
  return Array.isArray(bounds) && bounds.length === 2 && bounds.every(ngChoiceValueProbability) && bounds[0] <= bounds[1];
}

const NG_CHOICE_VALUE_CERTIFICATES = new Set([
  "exact-rational-all-action-drift+common-policy-residual+Bellman-supersolution",
  "outward-interval-all-action-drift+common-policy-residual+Bellman-supersolution",
]);
const NG_CHOICE_VALUE_OUTCOMES = ["win", "loss", "explicitNoResult", "nontermination"];
// Schema admission for the trusted worker certificate; not a second math proof.
function ngChoiceValueCertifiedQuality(response, request) {
  const q = response.quality, p = request.precision || { absoluteProbabilityError: 1e-4, policyRegret: 1e-4 };
  const slack = 16 * Number.EPSILON;
  return q?.numericalStatus === "certified"
    && NG_CHOICE_VALUE_CERTIFICATES.has(response.diagnostics?.certificate)
    && q.secondaryStatus === "unresolved-primary-ties"
    && q.tertiaryStatus === "unresolved-primary-loss-ties"
    && ngChoiceValueProbability(q.maxWinError) && ngChoiceValueProbability(q.policyRegretBound)
    && ngChoiceValueProbability(q.coordinateErrorBound)
    && Number.isFinite(p.absoluteProbabilityError) && p.absoluteProbabilityError > 0
    && Number.isFinite(p.policyRegret) && p.policyRegret > 0
    && q.policyRegretBound <= p.policyRegret + slack
    && q.coordinateErrorBound <= p.absoluteProbabilityError + slack
    && q.maxWinError <= Math.max(p.absoluteProbabilityError, p.policyRegret) + slack;
}
function ngChoiceValueCertifiedRecord(r, request) {
  const tolerance = request.precision?.absoluteProbabilityError ?? 1e-4;
  const slack = 16 * Number.EPSILON;
  return r?.status === "bounded" && r.secondaryStatus === "unresolved-primary-ties"
    && ngChoiceValueVector(r.outcomes) && ngChoiceValueBounds(r.winBounds)
    && NG_CHOICE_VALUE_OUTCOMES.every(k => {
      const b = r.outcomeBounds?.[k];
      return ngChoiceValueBounds(b) && b[0] <= r.outcomes[k] && r.outcomes[k] <= b[1]
        && Math.max(r.outcomes[k] - b[0], b[1] - r.outcomes[k]) <= tolerance + slack;
 }) && r.winBounds[0] <= r.outcomeBounds.win[1] && r.winBounds[1] >= r.outcomeBounds.win[0];
}

function ngChoiceValueReason(reason) {
  return ({
    "not-wired": "Win chance is unavailable for this roll. You can still choose this move.",
    "pending": "Calculating for this roll and your current practice. You can choose a move now.",
    "requires-context": "Choose a player seat and a live roll to calculate this value.",
    "incomplete": "This choice is still unresolved. Missing information is never counted as a loss or no result.",
    "missing-action": "Win chance is unavailable for this move.",
    "invalid-result": "Win chance could not be verified. You can still choose this move.",
    "evaluation-failed": "Win chance could not be calculated. You can still choose this move.",
    "unsupported-horizon": "Win chance for this roll is unavailable.",
    "unavailable": "A value for this choice is unavailable.",
    "stale": "The roll or your practice changed. This value needs a new calculation.",
  })[reason] || "Win chance is unavailable with the current information.";
}

// Whole percentages, with honest endpoints. A tiny positive chance is not impossible,
// nor is a rounded 100 a guarantee. A bound crossing a display bin stays an interval.
export function ngChoiceValuePercent(value, bounds) {
  if (bounds != null) {
    if (!ngChoiceValueBounds(bounds)) return "—";
    const lo = ngChoiceValuePercent(bounds[0]), hi = ngChoiceValuePercent(bounds[1]);
    if (lo === hi) return lo;
    return Math.floor(bounds[0] * 100) + "–" + Math.ceil(bounds[1] * 100) + "%";
  }
  if (!ngChoiceValueProbability(value)) return "—";
  if (value > 0 && value < .005) return "<1%";
  if (value < 1 && value >= .995) return ">99%";
  return Math.round(value * 100) + "%";
}

// Endpoint labels carry meaning too: <1% is above 0%, and 100% is above >99%.
// Use these same display bins for ordering and tie prose.
function ngChoiceValueBin(value) {
  if (value > 0 && value < .005) return .5;
  if (value < 1 && value >= .995) return 99.5;
  return Math.round(value * 100);
}

function ngChoiceValuePoints(value) {
  const points = Math.round(value * 1000) / 10;
  return (points > 0 ? "+" : "") + points + " pp";
}

const NG_CHOICE_VALUE_ECHO = Object.freeze([
  "apiVersion", "requestId", "revision", "contractHash", "modelHash", "mechanicsHash",
  "graphHash", "profileHash", "opponentPolicyHash", "ruleset", "objective", "horizon", "futureStudyPolicy",
]);

export function ngChoiceValueStamp(request) {
  if (!request || request.apiVersion !== 2 || !Number.isSafeInteger(request.revision) || request.revision < 0
    || !["gi", "nogi"].includes(request.ruleset) || request.objective !== NG_CHOICE_VALUE.objective
    || request.futureStudyPolicy !== NG_CHOICE_VALUE.futureStudyPolicy
    || typeof request.state?.id !== "string" || !request.state.id || !request.horizon || request.horizon.kind !== "actual-roll"
    || !Number.isSafeInteger(request.horizon.episodeCap) || !Number.isSafeInteger(request.horizon.moveCount)
    || request.horizon.episodeCap < 0 || request.horizon.moveCount < 0
    || !["requestId", "contractHash", "modelHash", "mechanicsHash", "graphHash", "profileHash", "opponentPolicyHash"].every(k => typeof request[k] === "string" && request[k].length)
    || !Array.isArray(request.requestedActionIds) || !request.requestedActionIds.length
    || !request.requestedActionIds.every(id => typeof id === "string" && id.length)
    || new Set(request.requestedActionIds).size !== request.requestedActionIds.length) return null;
  // The full state covers phase, role, cap-check ordering and transient modifiers, even
  // if a producer accidentally reuses a revision. Over-cap opportunities remain legal.
  return ngChoiceValueJSON(request);
}

function ngChoiceValueUnavailable(actionId, reason, immediate) {
  return { actionId, status: "unavailable", reason, ...(immediate || {}) };
}

// A small lifecycle controller: generation ownership is separate from content identity.
// Superseded work may physically finish, but can never repaint the new/committed hand.
// The engine's landed/missed regrouping of the card's own rows (mdp-model `ngMdpSplit`). It is shown
// only if it adds back up to the card's total within the result's own error bound; a split that
// does not reconcile is dropped, never displayed as an explanation of a number it does not make.
function ngChoiceValueSplit(r, quality) {
  const s = r && r.split;
  if (!s || !ngChoiceValueProbability(s.lands) || !ngChoiceValueVector(r.outcomes)) return null;
  const landsOk = s.lands > 0 ? ngChoiceValueProbability(s.winIfLands) : s.winIfLands == null;
  const missesOk = s.lands < 1 ? ngChoiceValueProbability(s.winIfMisses) : s.winIfMisses == null;
  if (!landsOk || !missesOk) return null;
  const total = (s.lands > 0 ? s.lands * s.winIfLands : 0) + (s.lands < 1 ? (1 - s.lands) * s.winIfMisses : 0);
  const tolerance = 1e-9 + (ngChoiceValueProbability(quality && quality.maxWinError) ? quality.maxWinError : 0);
  return Math.abs(total - r.outcomes.win) <= tolerance
    ? { lands: s.lands, winIfLands: s.lands > 0 ? s.winIfLands : null, winIfMisses: s.lands < 1 ? s.winIfMisses : null } : null;
}

export function ngChoiceValueController({ publish = () => {}, isCurrent = () => true, cancel = () => {} } = {}) {
  let active = null, sequence = 0, destroyed = false, snapshot = null;
  const emit = value => { snapshot = ngChoiceValueCopy(value); publish(snapshot); return snapshot; };
  const current = token => !destroyed && token && active === token && isCurrent(token.request, token.handId);
  const retire = reason => {
    const old = active; active = null;
    if (old) cancel(reason, old.request);
  };
  return {
    snapshot: () => snapshot,
    begin(request, { handId, immediate = {} } = {}) {
      if (destroyed) return null;
      const stamp = ngChoiceValueStamp(request);
      if (!stamp || typeof handId !== "string" || !handId) {
        retire("invalid-request");
        emit({ status: "unavailable", reason: request?.horizon?.kind === "eventual" ? "unsupported-horizon" : "requires-context", actions: [], handId });
        return null;
      }
      if (active && active.stamp === stamp && active.handId === handId && current(active)) return active;
      retire("superseded");
      const token = Object.freeze({ sequence: ++sequence, handId, stamp, request: ngChoiceValueCopy(request), immediate: ngChoiceValueCopy(immediate) });
      active = token;
      emit({ status: "pending", handId, request: token.request, actions: request.requestedActionIds.map(actionId => ({ ...immediate[actionId], actionId, status: "pending", reason: "pending" })) });
      return token;
    },
    accept(token, response) {
      if (!current(token)) return false;
      const request = token.request;
      // All stamps are echoed, not just the worker's latest request counter. Hash changes
      // include profile reset, role, clock, ruleset, content, difficulty and opponent.
      if (!response || !NG_CHOICE_VALUE_ECHO.every(k => ngChoiceValueJSON(response[k]) === ngChoiceValueJSON(request[k]))) return false;
      const rows = response.actions;
      const quality = response.quality;
      const validQuality = quality && ["exact-rational", "certified", "checked-float", "incomplete"].includes(quality.numericalStatus);
      if (!Array.isArray(rows) || rows.some(r => !r || typeof r.actionId !== "string")
        || new Set(rows.map(r => r.actionId)).size !== rows.length || !validQuality
        || (quality.maxWinError != null && !ngChoiceValueProbability(quality.maxWinError))) return this.fail(token, "invalid-result");
      if (quality.numericalStatus === "checked-float") return this.fail(token, "invalid-result");
      const certified = quality.numericalStatus === "certified";
      if (certified && (!ngChoiceValueCertifiedQuality(response, request) || !ngChoiceValueCertifiedRecord(response.root, request))) return this.fail(token, "invalid-result");
      const byId = new Map(rows.map(r => [r.actionId, r]));
      const actions = request.requestedActionIds.map(id => {
        const r = byId.get(id), immediate = token.immediate[id];
        if (!r) return ngChoiceValueUnavailable(id, "missing-action", immediate);
        if (!["ready", "bounded"].includes(r.status)) {
          return { ...immediate, actionId: id, status: ["pending", "requires-context", "unavailable"].includes(r.status) ? r.status : "unavailable", reason: r.reason || r.status };
        }
        if (certified && !ngChoiceValueCertifiedRecord(r, request)) return ngChoiceValueUnavailable(id, "invalid-result", immediate);
        if (quality.numericalStatus === "incomplete" && r.status !== "bounded") return ngChoiceValueUnavailable(id, "incomplete", immediate);
        if (r.stateId !== request.state.id || response.root?.stateId !== request.state.id || !ngChoiceValueVector(r.outcomes) || !ngChoiceValueVector(response.root?.outcomes) || !r.policyId || r.policyId !== response.root?.policyId
          || (r.status === "bounded" && !ngChoiceValueBounds(r.winBounds))
          || (r.winBounds != null && (!ngChoiceValueBounds(r.winBounds) || (!certified && (r.outcomes.win < r.winBounds[0] || r.outcomes.win > r.winBounds[1]))))
          || (r.immediateExecutionChance != null && !ngChoiceValueProbability(r.immediateExecutionChance))) return ngChoiceValueUnavailable(id, "invalid-result", immediate);
        if (response.root.selectedActionId === id && ["win", "loss", "explicitNoResult", "nontermination"].some(k => certified ? Math.max(r.outcomeBounds[k][0], response.root.outcomeBounds[k][0]) > Math.min(r.outcomeBounds[k][1], response.root.outcomeBounds[k][1]) : Math.abs(r.outcomes[k] - response.root.outcomes[k]) > 1e-7)) return ngChoiceValueUnavailable(id, "invalid-result", immediate);
        const winBounds = r.winBounds || (quality.maxWinError > 0 ? [Math.max(0, r.outcomes.win - quality.maxWinError), Math.min(1, r.outcomes.win + quality.maxWinError)] : undefined);
        return { ...immediate, ...r, split: ngChoiceValueSplit(r, quality), ...(winBounds ? { winBounds } : {}), primaryCertified: certified };
      });
      const ready = actions.filter(r => ["ready", "bounded"].includes(r.status));
      // THREAT CARDS: your outcome if the opponent tries that move now (engine threat probes). Held
      // to the same bar as a card: same state, same selected future play as the root, certified
      // enclosures where certified. A threat that fails it is unavailable, never guessed.
      const threatRows = new Map((Array.isArray(response.threats) ? response.threats : [])
        .filter(t => t && typeof t.techniqueId === "string").map(t => [t.techniqueId, t]));
      const threats = (Array.isArray(request.threatIds) ? request.threatIds : []).map(id => {
        const t = threatRows.get(id);
        if (!t) return { techniqueId: id, status: "unavailable", reason: "missing-threat" };
        if (!["ready", "bounded"].includes(t.status)) return { techniqueId: id, status: "unavailable", reason: t.reason || t.status };
        if (t.stateId !== request.state.id || !t.policyId || t.policyId !== response.root?.policyId || !ngChoiceValueVector(t.outcomes)
          || (certified && !ngChoiceValueCertifiedRecord(t, request))) return { techniqueId: id, status: "unavailable", reason: "invalid-result" };
        return { ...t, primaryCertified: certified };
      });
      emit({ status: ready.length === actions.length ? (ready.some(r => r.status === "bounded") ? "bounded" : "ready") : ready.length ? "partial" : "unavailable",
        handId: token.handId, request, quality, root: response.root, actions, threats });
      return true;
    },
    fail(token, reason = "evaluation-failed") {
      if (!current(token)) return false;
      emit({ status: "error", handId: token.handId, request: token.request, reason,
        actions: token.request.requestedActionIds.map(id => ({ ...ngChoiceValueUnavailable(id, reason, token.immediate[id]), status: "error" })) });
      return true;
    },
    unavailable(handId, reason = "not-wired", actions = []) {
      if (destroyed) return;
      retire(reason);
      return emit({ status: "unavailable", handId, reason, actions: actions.map(r => ({ ...r, status: "unavailable", reason })) });
    },
    cancel(reason = "stale") { retire(reason); snapshot = null; },
    destroy() { retire("destroyed"); destroyed = true; snapshot = null; },
  };
}

// Sorting is opt-in and belongs ONLY to a new deal or an explicit player action. Bins
// match the visible headline; equal rounded values are ties for presentation, never an
// assertion of exact Bellman equality. Ambiguous intervals retain their existing order.
export function ngChoiceValueOrder(ids, snapshot) {
  // Bounded (certified) values sort too (owner, 2026-09-29: "sort once automatically when the values
  // arrive"). Their enclosures are ~1e-14 wide, so they almost never straddle a display bin; one that
  // does returns no key below, and an unkeyed option keeps the whole hand in its dealt order.
  const byId = new Map((snapshot?.actions || []).map(r => [r.actionId, r]));
  const key = id => {
    const r = byId.get(id);
    if (!r || !["ready", "bounded"].includes(r.status) || !ngChoiceValueVector(r.outcomes)) return null;
    if (r.winBounds && ngChoiceValuePercent(r.winBounds[0]) !== ngChoiceValuePercent(r.winBounds[1])) return null;
    return ngChoiceValueBin(r.outcomes.win);
  };
  // Unknown scores do not earn last place. Ranking a partial hand would imply evidence
  // against the missing options; wait until every displayed option can be compared.
  if (ids.some(id => key(id) == null)) return [...ids];
  // Equal display bins keep their DEALT order. Only an exact result may lift its verified
  // recommendation within a tie: a certified suggestion is within the regret bound of its peers,
  // not proven better, so promoting it would reorder cards the evidence cannot separate.
  const exact = snapshot?.quality?.numericalStatus === "exact-rational", selected = snapshot?.root?.selectedActionId;
  const dealt = new Map(ids.map((id, i) => [id, i]));
  return [...ids].sort((a, b) => key(b) - key(a)
    || (exact ? Number(selected === b) - Number(selected === a) : 0)
    || dealt.get(a) - dealt.get(b));
}

// Threat cards sort MOST DANGEROUS FIRST: ascending by YOUR win chance, same display bins and the
// same rule as own cards — an unkeyed threat keeps the whole group in its dealt order, and equal
// bins keep the dealt order.
export function ngChoiceValueThreatOrder(ids, snapshot) {
  const byId = new Map((snapshot?.threats || []).map(t => [t.techniqueId, t]));
  const key = id => {
    const t = byId.get(id);
    if (!t || !["ready", "bounded"].includes(t.status) || !ngChoiceValueVector(t.outcomes)) return null;
    if (t.winBounds && ngChoiceValuePercent(t.winBounds[0]) !== ngChoiceValuePercent(t.winBounds[1])) return null;
    return ngChoiceValueBin(t.outcomes.win);
  };
  if (ids.some(id => key(id) == null)) return [...ids];
  const dealt = new Map(ids.map((id, i) => [id, i]));
  return [...ids].sort((a, b) => key(a) - key(b) || dealt.get(a) - dealt.get(b));
}

// A threat card's number is YOUR win chance if the opponent tries that move now — the same kind
// of number as your own cards, so the hand shows one kind of number (owner, 2026-09-29).
export function ngChoiceValueThreatView(record, snapshot) {
  const t = record || { status: "unavailable", reason: "not-wired" };
  if (!["ready", "bounded"].includes(t.status) || !ngChoiceValueVector(t.outcomes))
    return { status: t.status || "unavailable", value: "—", tooltip: "Your win chance if they try this is unavailable." };
  const certified = t.primaryCertified === true && snapshot?.quality?.numericalStatus === "certified";
  const o = t.outcomes, value = ngChoiceValuePercent(o.win, certified ? t.outcomeBounds.win : t.winBounds);
  const loss = ngChoiceValuePercent(o.loss, certified ? t.outcomeBounds.loss : undefined);
  const none = ngChoiceValuePercent(o.explicitNoResult + o.nontermination);
  return { status: t.status, value,
    tooltip: "If they try this, you win " + value + " (you get submitted " + loss + ", nobody taps " + none + "), with your best play from there." };
}

export function ngChoiceValueKnowledge(explanation, kind) {
  const k = explanation?.knowledge;
  if (!k || k.status === "unavailable") return { summary: "Practice effect unavailable", lines: [] };
  if (k.status === "bypassed") return { summary: kind === "entry" ? "Custom finish odds apply" : "Custom odds apply", lines: ["Your odds override replaces the usual technique chance, so practice bonuses do not change it."] };
  if (k.status !== "applied" || !Array.isArray(k.components) || !k.components.every(c =>
    typeof c.deckKey === "string" && c.deckKey && typeof c.role === "string" && c.role
    && ["practice", "sharpness"].includes(c.source) && ngChoiceValueProbability(c.bonus))) return { summary: "Practice effect unavailable", lines: [] };
  const lines = k.components.filter(c => c.bonus !== 0).map(c =>
    (c.source === "practice" ? "Practice" : "Recent study") + " · " + c.deckKey.replace(/\|[^|]+$/, "") + " (" + c.role + "): " + ngChoiceValuePoints(c.bonus) + " input.");
  const comparison = explanation.comparison;
  if (comparison?.kind === "same-context-no-knowledge" && ngChoiceValueProbability(explanation.chance)
    && ngChoiceValueProbability(comparison.chance) && Number.isFinite(comparison.effectiveDelta)
    && Math.abs(explanation.chance - comparison.chance - comparison.effectiveDelta) < 1e-7) {
    lines.push((kind === "entry" ? "Finish chance at these conditions: " : "Immediate chance: ") + ngChoiceValuePercent(explanation.chance) + " with practice; " + ngChoiceValuePercent(comparison.chance) + " without practice, with all other conditions unchanged.");
  }
  if (kind === "entry") lines.push("Entry itself is automatic. The finish comparison uses these conditions, not the conditions of a later attempt.");
  if (explanation.clamp?.applied) lines.push("The game's probability limit applies. These bonuses do not simply add to the displayed chance.");
  lines.push("These are in-game modifiers, not measured grappling ability. Recent study fades on later arrivals; practice credit stays.");
  return { summary: k.components.some(c => c.bonus > 0) ? "Your practice is included" : "No practice bonus yet", lines };
}

export function ngChoiceValueView(record, snapshot) {
  const r = record || { status: "unavailable", reason: "not-wired" };
  const ready = ["ready", "bounded"].includes(r.status) && ngChoiceValueVector(r.outcomes);
  const knowledge = ngChoiceValueKnowledge(r.explanation, r.immediateExecutionKind || r.kind);
  const reason = r.reason || r.status;
  const view = {
    status: r.status, label: "Win chance", value: "—", detail: ngChoiceValueReason(reason),
    state: r.status === "pending" ? "Calculating…" : r.status === "error" ? "Could not calculate" : "Unavailable",
    immediate: ngChoiceValuePercent(r.immediateExecutionChance),
    immediateLabel: ({ entry: "Entry", enter: "Entry", finish: "Finish", escape: "Escape", transition: "Move" })[r.immediateExecutionKind || r.kind] || "Move",
    knowledge, outcomes: [], notes: [], recommended: false,
  };
  if (!ready) return view;
  const o = r.outcomes;
  const certified = r.primaryCertified === true && snapshot?.quality?.numericalStatus === "certified";
  const exact = snapshot?.quality?.numericalStatus === "exact-rational" && r.status === "ready";
  view.value = ngChoiceValuePercent(o.win, certified ? r.outcomeBounds.win : r.winBounds);
  view.state = r.status === "bounded" ? "Estimated range" : "This roll";
  view.detail = exact
    ? "Choose this move, then take the best legal moves against the game's opponent, using your current practice and this roll's remaining limits."
    : "Choose this move, then follow the suggested future play against the game's opponent, using your current practice and this roll's remaining limits.";
  view.outcomes = [
    { label: "Win", value: view.value },
    { label: "Loss", value: ngChoiceValuePercent(o.loss, certified ? r.outcomeBounds.loss : undefined) },
    { label: "No result", value: ngChoiceValuePercent(o.explicitNoResult + o.nontermination, certified ? [Math.max(0, r.outcomeBounds.explicitNoResult[0] + r.outcomeBounds.nontermination[0]), Math.min(1, r.outcomeBounds.explicitNoResult[1] + r.outcomeBounds.nontermination[1])] : undefined) },
  ];
  view.notes.push("Win, loss and no result describe that same future play. Percentages are rounded.");
  view.notes.push("No additional study is assumed before later moves. A new answer recalculates the values.");
  if (certified ? r.outcomeBounds.explicitNoResult[1] > 0 || r.outcomeBounds.nontermination[1] > 0 : o.explicitNoResult > 0 || o.nontermination > 0) view.notes.push("No result: " + ngChoiceValuePercent(o.explicitNoResult, certified ? r.outcomeBounds.explicitNoResult : undefined) + " game reset; " + ngChoiceValuePercent(o.nontermination, certified ? r.outcomeBounds.nontermination : undefined) + " play that never ends.");
  // THE TOOLTIP (owner, 2026-09-29): how the card number is made, in plain words. Q = P(lands) x
  // [win if it lands] + P(misses) x [win if it misses], from the engine's own rows (ngMdpSplit).
  const sp = r.split, kind = view.immediateLabel;
  if (sp) {
    const pct = ngChoiceValuePercent, lines = [];
    const landWord = { Entry: "Entry is automatic", Finish: "The finish lands", Escape: "The escape works", Move: "The move lands" }[kind] || "The move lands";
    const missWord = { Finish: "The finish misses", Escape: "The escape fails", Move: "The move misses" }[kind] || "The move misses";
    const then = w => w === 1 ? "you win" : w === 0 ? (kind === "Escape" ? "you are submitted" : "you do not win") : "then you win " + pct(w);
    if (sp.lands > 0) lines.push(landWord + " (" + pct(sp.lands) + "): " + then(sp.winIfLands) + ".");
    if (sp.lands < 1) lines.push(missWord + " (" + pct(1 - sp.lands) + "): " + then(sp.winIfMisses) + ".");
    if (sp.lands > 0 && sp.lands < 1) lines.push(pct(sp.lands) + " × " + pct(sp.winIfLands) + " + " + pct(1 - sp.lands) + " × " + pct(sp.winIfMisses) + " ≈ " + view.value + " win chance.");
    lines.push("You get submitted " + view.outcomes[1].value + " · nobody taps " + view.outcomes[2].value + ".");
    view.split = lines;
    view.tooltip = "Win chance " + view.value + "\n" + lines.join("\n");
  }
  const h = snapshot?.request?.horizon;
  if (h?.kind === "actual-roll") view.notes.push("Move counter " + h.moveCount + " / " + h.episodeCap + ". Includes any final response the game allows at the limit.");
  // Evidence must be supplied by the solver, not inferred from odds or node strength.
  const opportunities = r.explanation?.opportunities;
  for (const e of Array.isArray(opportunities) ? opportunities : []) {
    if (e.kind === "delayed-win" && e.policyId === r.policyId && e.contractHash === snapshot?.request?.contractHash
      && typeof e.stateId === "string" && typeof e.label === "string" && ngChoiceValueProbability(e.probability)) {
      view.notes.push("Later opportunity: " + e.label + " (" + ngChoiceValuePercent(e.probability) + " chance of reaching it with that future play).");
    }
  }
  const peers = (snapshot?.actions || []).filter(p => ["ready", "bounded"].includes(p.status) && ngChoiceValueVector(p.outcomes));
  if (!r.winBounds && peers.some(p => p.actionId !== r.actionId && !p.winBounds && ngChoiceValueBin(p.outcomes.win) === ngChoiceValueBin(o.win))) {
    view.notes.push("Some choices round to the same win chance. That does not make their exact values equal.");
  }
  if (exact && snapshot?.root?.selectedActionId === r.actionId) view.notes.push("The recommended future play starts with this move, favoring wins, then fewer losses and less play that never ends.");
  if (certified && snapshot?.root?.selectedActionId === r.actionId) view.notes.push("The suggested play is within the stated accuracy of the highest win chance.");
  if (certified) view.notes.push("Loss and no-result tie-breaks are not verified.");
  view.recommended = (exact || certified) && snapshot?.root?.selectedActionId === r.actionId;
  view.recommendationLabel = certified ? "Suggested" : "Recommended";
  return view;
}

function ngChoiceValueEscape(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function ngChoiceValueHTML(view, detail = false) {
  const esc = ngChoiceValueEscape;
  if (!detail) return '<div class="ngcv-line"><span>Win chance</span><strong data-choice-win>' + esc(view.value) + '</strong></div>';
  return '<section class="ngcv-detail" aria-label="Expected roll outcomes"><div class="ngcv-line"><span>Win chance <small>· ' + esc(view.state) + '</small></span><strong data-choice-win>' + esc(view.value) + '</strong></div>'
    + '<p>' + esc(view.detail) + '</p>'
    + '<p><b>' + esc(view.immediateLabel) + ' chance now: ' + esc(view.immediate) + '</b></p>'
    + (view.split ? '<div class="ngcv-split" data-choice-split><b>How the win chance is made</b>' + view.split.map(line => '<p>' + esc(line) + '</p>').join("") + '</div>' : '')
    + (view.outcomes.length ? '<dl class="ngcv-outcomes">' + view.outcomes.map(o => '<div><dt>' + esc(o.label) + '</dt><dd>' + esc(o.value) + '</dd></div>').join("") + '</dl>' : '')
    + '<p><b>' + esc(view.knowledge.summary) + '</b></p>'
    + view.knowledge.lines.map(line => '<p>' + esc(line) + '</p>').join("")
    + view.notes.map(line => '<p class="ngcv-note">' + esc(line) + '</p>').join("") + '</section>';
}

// The standalone verification bundle installs this namespace eagerly. Production may
// omit the entire module and pass its imported namespace to setChoiceValueRuntime.
export const NG_CHOICE_VALUE_RUNTIME = Object.freeze({ ngChoiceValueController, ngChoiceValueView, ngChoiceValueHTML, ngChoiceValueOrder,
  ngChoiceValueThreatView, ngChoiceValueThreatOrder, ngChoiceValuePercent });
