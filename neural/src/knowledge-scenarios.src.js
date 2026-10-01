// Declared hypothetical simulator inputs ONLY. No grades, earned credit, evidence
// writes, exposure, policy evaluation, clocks, randomness, storage or worker calls.
import { NG_KNOWLEDGE_VERSION, NG_KNOWLEDGE_STUDY_POLICY, ngKnowledgeFingerprint,
  ngKnowledgeMastery } from "./knowledge-profile.src.js";

export const NG_KNOWLEDGE_SCENARIOS_VERSION = 1;
export const NG_KNOWLEDGE_SCENARIO_CAPS = Object.freeze({
  permanent: ngKnowledgeMastery(Number.MAX_SAFE_INTEGER),
  sharp: 0.10, // frozen knowledge v1 successful-study refresh cap, not a predicted grade
});

function ngKnowledgeScenarioOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function ngKnowledgeScenarioRequire(ok, reason, details) {
  if (!ok) { const e = new Error(reason); if (details) e.details = details; throw e; }
}
function ngKnowledgeScenarioObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function ngKnowledgeScenarioKeys(value, required, optional = []) {
  return ngKnowledgeScenarioObject(value) && required.every(k => ngKnowledgeScenarioOwn(value, k)) &&
    Object.keys(value).every(k => required.includes(k) || optional.includes(k));
}
function ngKnowledgeScenarioText(value) { return typeof value === "string" && value.trim().length > 0; }
function ngKnowledgeScenarioClone(value, seen = new Set(), depth = 0) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  ngKnowledgeScenarioRequire(depth < 32 && (Array.isArray(value) || ngKnowledgeScenarioObject(value)) &&
    !seen.has(value), "non-json-scenario-input");
  ngKnowledgeScenarioRequire(Object.getOwnPropertySymbols(value).length === 0 &&
    Object.getOwnPropertyNames(value).length === Object.keys(value).length + (Array.isArray(value) ? 1 : 0),
    "non-json-scenario-input");
  seen.add(value);
  const out = Array.isArray(value) ? [] : {};
  // Preserve input object order: shared indexes address the decoded deck order exactly.
  for (const k of Object.keys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, k);
    ngKnowledgeScenarioRequire(d && ngKnowledgeScenarioOwn(d, "value"), "non-json-scenario-input");
    Object.defineProperty(out, k, { value: ngKnowledgeScenarioClone(d.value, seen, depth + 1),
      enumerable: true, writable: true, configurable: true });
  }
  if (Array.isArray(value)) ngKnowledgeScenarioRequire(Object.keys(value).length === value.length &&
    Object.keys(value).every((k, i) => k === String(i)), "non-json-scenario-input");
  seen.delete(value);
  return out;
}
function ngKnowledgeScenarioFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(ngKnowledgeScenarioFreeze); Object.freeze(value);
  }
  return value;
}
function ngKnowledgeScenarioValue(profile, component, key) {
  return ngKnowledgeScenarioOwn(profile[component], key) ? profile[component][key] : 0;
}
function ngKnowledgeScenarioRole(key, role, category) {
  return ngKnowledgeScenarioText(key) && ngKnowledgeScenarioText(role) && key.endsWith("|" + role) &&
    key.slice(0, -role.length - 1).trim().length > 0 &&
    (category === "Position" ? ["Top", "Bottom"] : ["Attacker", "Defender"]).includes(role);
}

/** The content fingerprint alone canonicalizes away shared-ordinal deck order. */
export function ngKnowledgeScenarioManifestHash(manifest) {
  const m = ngKnowledgeScenarioClone(manifest);
  ngKnowledgeScenarioRequire(ngKnowledgeScenarioObject(m.deckIndex) &&
    ngKnowledgeScenarioObject(m.deckIndex.decks), "missing-loaded-manifest");
  delete m.fingerprint;
  return ngKnowledgeFingerprint({ ...m, deckOrder: Object.keys(m.deckIndex.decks) });
}

function ngKnowledgeScenarioProfile(p, day) {
  const fields = ["version", "revision", "contentRevision", "evidenceRevision", "day", "studyPolicy",
    "permanent", "sharp", "userMods", "filmLook", "flowCounts", "status", "diagnostics", "fingerprint"];
  ngKnowledgeScenarioRequire(ngKnowledgeScenarioKeys(p, fields) && p.version === NG_KNOWLEDGE_VERSION &&
    p.status === "ready" && Array.isArray(p.diagnostics) && p.diagnostics.length === 0 &&
    p.studyPolicy === NG_KNOWLEDGE_STUDY_POLICY && Number.isSafeInteger(p.revision) && p.revision >= 0 &&
    ngKnowledgeScenarioText(p.contentRevision) && typeof p.evidenceRevision === "string" &&
    Array.isArray(p.userMods) && ngKnowledgeScenarioObject(p.filmLook) && ngKnowledgeScenarioObject(p.flowCounts),
    "invalid-baseline-profile");
  ngKnowledgeScenarioRequire(Number.isSafeInteger(day) && p.day === day, "stale-profile-day");
  const { fingerprint, ...data } = p;
  ngKnowledgeScenarioRequire(ngKnowledgeFingerprint(data) === fingerprint, "baseline-fingerprint-mismatch");
  for (const component of ["permanent", "sharp"]) {
    ngKnowledgeScenarioRequire(ngKnowledgeScenarioObject(p[component]) && Object.values(p[component]).every(v =>
      typeof v === "number" && v >= 0 && v <= NG_KNOWLEDGE_SCENARIO_CAPS[component]), "baseline-outside-component-caps");
  }
}

function ngKnowledgeScenarioManifest(m, p, bounds) {
  ngKnowledgeScenarioRequire(ngKnowledgeScenarioKeys(m, ["version", "status", "deckIndex", "identity", "fingerprint"]) &&
    m.version === 1 && m.status === "ready", "missing-loaded-manifest");
  const index = m.deckIndex, identity = m.identity;
  // `deckIndex` is the producer's CANONICAL decoded index ({decks: {key: {cat, n}}, shared}), never a
  // raw wire file: the producer owns the wire format and decodes it once (knowledge-scenario-manifest).
  ngKnowledgeScenarioRequire(ngKnowledgeScenarioKeys(index, ["decks", "shared"]) &&
    ngKnowledgeScenarioObject(index.decks) && ngKnowledgeScenarioObject(index.shared), "missing-complete-shared-index");
  ngKnowledgeScenarioRequire(ngKnowledgeScenarioKeys(identity, ["contentRevision", "graphHash", "decks"]) &&
    ngKnowledgeScenarioText(identity.graphHash) && ngKnowledgeScenarioObject(identity.decks), "missing-deck-identity");
  ngKnowledgeScenarioRequire(ngKnowledgeFingerprint(index) === p.contentRevision &&
    identity.contentRevision === p.contentRevision, "manifest-content-mismatch");
  ngKnowledgeScenarioRequire(ngKnowledgeScenarioManifestHash(m) === m.fingerprint, "manifest-fingerprint-mismatch");
  const keys = Object.keys(index.decks), groups = Object.keys(index.shared);
  ngKnowledgeScenarioRequire(keys.length > 0 && keys.length <= bounds.maxDecks &&
    groups.length <= bounds.maxSharedGroups, "manifest-over-limit");
  ngKnowledgeScenarioRequire(Object.keys(identity.decks).length === keys.length &&
    keys.every(k => ngKnowledgeScenarioOwn(identity.decks, k)), "incomplete-deck-identity");
  const incident = new Map(), members = new Map();
  for (const key of keys) {
    const entry = index.decks[key], d = identity.decks[key];
    ngKnowledgeScenarioRequire(ngKnowledgeScenarioKeys(entry, ["cat", "n"]) &&
      ["Position", "Transition", "Submission"].includes(entry.cat) && Number.isSafeInteger(entry.n) && entry.n >= 0 &&
      ngKnowledgeScenarioKeys(d, ["role", "category", "rulesets"]) && d.category === entry.cat &&
      ngKnowledgeScenarioRole(key, d.role, d.category) && ngKnowledgeScenarioKeys(d.rulesets, ["gi", "nogi"]) &&
      [d.rulesets.gi, d.rulesets.nogi].every(v => typeof v === "boolean"), "invalid-deck-role-or-ruleset");
    incident.set(key, []);
  }
  let memberships = 0;
  for (const hash of groups) {
    const row = index.shared[hash];
    ngKnowledgeScenarioRequire(/^[0-9a-f]{8}$/.test(hash) && Array.isArray(row) && row.length >= 2 &&
      new Set(row).size === row.length && row.every(i => Number.isSafeInteger(i) && i >= 0 && i < keys.length),
      "invalid-shared-index");
    memberships += row.length;
    ngKnowledgeScenarioRequire(memberships <= bounds.maxSharedMemberships, "shared-index-over-limit");
    const decks = row.map(i => keys[i]); members.set(hash, decks);
    for (const key of decks) incident.get(key).push(hash);
  }
  return { identity, incident, members };
}

/** One joint declared target profile, never an estimate of earned study rewards.
 * See the Round B API/report for manifest authority and closure semantics.
 */
export function ngKnowledgeScenarioProject(input) {
  try {
    const job = ngKnowledgeScenarioClone(input);
    ngKnowledgeScenarioRequire(ngKnowledgeScenarioKeys(job, ["baselineProfile", "logicalContextHash", "ruleset", "day", "manifest", "targets", "bounds"]) &&
      ["gi", "nogi"].includes(job.ruleset) && ngKnowledgeScenarioText(job.logicalContextHash), "missing-logical-context");
    const b = job.bounds;
    ngKnowledgeScenarioRequire(ngKnowledgeScenarioKeys(b, ["maxTargets", "maxDecks", "maxSharedGroups", "maxSharedMemberships"]) &&
      Object.values(b).every(n => Number.isSafeInteger(n) && n > 0), "missing-or-invalid-scenario-bounds");
    ngKnowledgeScenarioRequire(Array.isArray(job.targets) && job.targets.length > 0 && job.targets.length <= b.maxTargets,
      "empty-or-over-limit-targets");
    const p = job.baselineProfile;
    ngKnowledgeScenarioProfile(p, job.day);
    const m = ngKnowledgeScenarioManifest(job.manifest, p, b);
    const targets = new Map();
    for (const t of job.targets) {
      ngKnowledgeScenarioRequire(ngKnowledgeScenarioKeys(t, ["deckKey", "role"], ["permanentTo", "sharpTo"]) &&
        (ngKnowledgeScenarioOwn(t, "permanentTo") || ngKnowledgeScenarioOwn(t, "sharpTo")) &&
        !targets.has(t.deckKey) && ngKnowledgeScenarioOwn(m.identity.decks, t.deckKey), "invalid-or-duplicate-target");
      const d = m.identity.decks[t.deckKey];
      ngKnowledgeScenarioRequire(t.role === d.role, "target-role-mismatch");
      const row = { ...t, available: d.rulesets[job.ruleset], from: {}, to: {} };
      for (const component of ["permanent", "sharp"]) {
        const from = ngKnowledgeScenarioValue(p, component, t.deckKey);
        const to = ngKnowledgeScenarioOwn(t, component + "To") ? t[component + "To"] : from;
        ngKnowledgeScenarioRequire(typeof to === "number" && to >= from && to <= NG_KNOWLEDGE_SCENARIO_CAPS[component],
          "target-outside-component-headroom", { deckKey: t.deckKey, component });
        row.from[component] = from; row.to[component] = to;
      }
      targets.set(t.deckKey, row);
    }
    // Expand each shared group once. No hydration guess or O(n^2) clique expansion.
    const closure = new Set([...targets.values()].filter(t => t.available && t.to.permanent > t.from.permanent).map(t => t.deckKey));
    const queue = [...closure], visited = new Set();
    for (let i = 0; i < queue.length; i++) for (const hash of m.incident.get(queue[i])) {
      if (visited.has(hash)) continue; visited.add(hash);
      for (const key of m.members.get(hash)) if (!closure.has(key)) { closure.add(key); queue.push(key); }
    }
    const missing = [...closure].filter(k => !targets.has(k) || !ngKnowledgeScenarioOwn(targets.get(k), "permanentTo")).sort();
    ngKnowledgeScenarioRequire(!missing.length, "missing-shared-closure", { deckKeys: missing });
    const profile = ngKnowledgeScenarioClone(p), records = [], deckKeys = [];
    for (const key of [...targets.keys()].sort()) {
      const t = targets.get(key);
      ngKnowledgeScenarioRequire(t.available || closure.has(key), "target-unavailable-in-ruleset", { deckKey: key });
      ngKnowledgeScenarioRequire(t.available || t.to.sharp === t.from.sharp, "inactive-sharp-target", { deckKey: key });
      const componentHeadroom = {}, deltas = {};
      for (const component of ["permanent", "sharp"]) {
        componentHeadroom[component] = NG_KNOWLEDGE_SCENARIO_CAPS[component] - t.from[component];
        deltas[component] = t.to[component] - t.from[component];
        if (t.to[component] !== t.from[component]) {
          profile[component][key] = t.to[component];
          records.push({ deckKey: key, role: t.role, component, from: t.from[component], to: t.to[component] });
        }
      }
      const jointDelta = deltas.permanent + deltas.sharp;
      const headroom = componentHeadroom.permanent + componentHeadroom.sharp;
      ngKnowledgeScenarioRequire(deltas.permanent <= componentHeadroom.permanent && deltas.sharp <= componentHeadroom.sharp &&
        jointDelta <= headroom, "joint-headroom-exceeded");
      if (jointDelta > 0) deckKeys.push({ deckKey: key, role: t.role, available: t.available, headroom,
        headroomSemantics: "joint-permanent-plus-sharp-input-capacity", componentHeadroom, jointDelta });
    }
    ngKnowledgeScenarioRequire(records.length > 0, "no-profile-changes");
    ngKnowledgeScenarioRequire(deckKeys.some(d => d.available), "no-active-profile-changes");
    delete profile.fingerprint;
    profile.fingerprint = ngKnowledgeFingerprint(profile);
    const provenance = { kind: "hypothetical-knowledge-input",
      targetSemantics: "declared-mechanics-input-no-earned-credit", knowledgeVersion: NG_KNOWLEDGE_VERSION,
      baselineProfileHash: p.fingerprint, manifestHash: job.manifest.fingerprint, graphHash: m.identity.graphHash,
      logicalContextHash: job.logicalContextHash, ruleset: job.ruleset, day: job.day,
      caps: { ...NG_KNOWLEDGE_SCENARIO_CAPS },
      sharedClosure: { status: "validated", scope: "transitive-permanent-deck-closure",
        deckKeys: [...closure].sort().map(key => ({ deckKey: key, role: m.identity.decks[key].role })) } };
    const changes = { kind: "hypothetical-knowledge-input", records };
    const id = "knowledge-scenario:" + ngKnowledgeFingerprint({ provenance, profileHash: profile.fingerprint, changes });
    return ngKnowledgeScenarioFreeze({ apiVersion: NG_KNOWLEDGE_SCENARIOS_VERSION, status: "ready",
      scenario: { id, profile, profileHash: profile.fingerprint, deckKeys, changes }, provenance });
  } catch (error) {
    return ngKnowledgeScenarioFreeze({ apiVersion: NG_KNOWLEDGE_SCENARIOS_VERSION, status: "unavailable", scenario: null,
      reason: error.message, ...(error.details ? { details: error.details } : {}) });
  }
}
