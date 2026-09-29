// Host-only account storage/transition boundary. Never send owner IDs to model workers.
// The integration owner supplies the existing semantic progress merge for explicit import.
export const NG_PROGRESS_OWNER_FORMAT = "bjj-progress-owner-v1";
const NG_PROGRESS_OWNER_PREFIX = "bjj-neural-owner:";
const NG_PROGRESS_LEGACY_KEY = "bjj-neural-progress";
// The pre-owner markers were `bjj-neural-ladder` / `-firstroll` / `-coached`.
const NG_PROGRESS_LEGACY_FIELD_PREFIX = "bjj-neural-";

function ngProgressObject(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
function ngProgressClone(value) { return JSON.parse(JSON.stringify(value)); }
function ngProgressFreeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(ngProgressFreeze); Object.freeze(value); }
  return value;
}
function ngProgressBlob(value) {
  try { ngProgressValidateBlob(value); return true; } catch (_) { return false; }
}
function ngProgressFailure(reason) { return { status: "unavailable", reason }; }

export function ngProgressValidateBlob(value) {
  if (!ngProgressObject(value) || ![1, 2].includes(value.v)) throw new Error("Unsupported saved progress");
  const walk = (v, depth = 0, active = new Set()) => {
    if (depth > 64) throw new Error("Saved progress nesting is invalid");
    if (v === null || ["string", "boolean"].includes(typeof v)) return;
    if (typeof v === "number" && Number.isFinite(v)) return;
    if (!v || typeof v !== "object" || active.has(v)) throw new Error("Saved progress is not JSON");
    if (Object.getPrototypeOf(v) !== (Array.isArray(v) ? Array.prototype : Object.prototype)) throw new Error("Saved progress prototype is invalid");
    active.add(v);
    for (const key of Object.keys(v)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Unsafe saved progress key");
      const desc = Object.getOwnPropertyDescriptor(v, key);
      if (!desc || !("value" in desc)) throw new Error("Saved progress accessor is invalid");
      walk(desc.value, depth + 1, active);
    }
    active.delete(v);
  };
  walk(value);
  for (const key of ["prep", "rec", "stage", "srs", "units", "belts", "tut", "challenges", "badges", "coins", "lists", "flow", "days", "dayLog", "settings", "settingsAt"]) {
    if (key in value && !ngProgressObject(value[key])) throw new Error("Invalid saved progress field: " + key);
  }
  const map = v => ngProgressObject(v) && Object.getPrototypeOf(v) === Object.prototype;
  const number = v => typeof v === "number" && Number.isFinite(v) && v >= 0;
  for (const key of ["prep", "rec", "days", "settingsAt"]) {
    if (value[key] && Object.values(value[key]).some(v => !number(v))) throw new Error("Invalid progress counter: " + key);
  }
  for (const row of Object.values(value.stage || {})) {
    if (!map(row) || Object.values(row).some(v => !number(v))) throw new Error("Invalid card evidence");
  }
  for (const row of Object.values(value.srs || {})) {
    if (!map(row) || Object.values(row).some(v => !Array.isArray(v) || v.length < 3 || v.some(x => !number(x)))) throw new Error("Invalid review schedule");
  }
  for (const device of Object.values(value.flow || {})) {
    if (!map(device)) throw new Error("Invalid flow device");
    for (const row of Object.values(device)) {
      if (!map(row) || Object.values(row).some(v => !Array.isArray(v) || v.length !== 3 || v.some(x => !number(x)))) throw new Error("Invalid flow ledger");
    }
  }
  if ("explored" in value && (!Array.isArray(value.explored) || value.explored.some(x => typeof x !== "string"))) throw new Error("Invalid explored history");
  return value;
}

export function ngProgressOwner(userId = null) {
  if (userId === null) return Object.freeze({ kind: "guest" });
  if (typeof userId !== "string" || !userId) throw new TypeError("A verified account ID is required");
  return Object.freeze({ kind: "account", id: userId });
}
function ngProgressOwnerId(owner) {
  if (owner?.kind === "guest" && !Object.prototype.hasOwnProperty.call(owner, "id")) return "guest";
  if (owner?.kind === "account" && typeof owner.id === "string" && owner.id) return "account:" + encodeURIComponent(owner.id);
  throw new TypeError("Invalid progress owner");
}
function ngProgressSameOwner(a, b) { return ngProgressOwnerId(a) === ngProgressOwnerId(b); }

export function ngProgressLocalKey(owner, field = "progress") {
  if (!["progress", "ladder", "firstroll", "coached"].includes(field)) throw new TypeError("Unknown account-owned local field");
  return NG_PROGRESS_OWNER_PREFIX + ngProgressOwnerId(owner) + ":" + field;
}

export function ngProgressCreateStore(storage, now = Date.now) {
  const rawRead = key => {
    try { return { status: "ready", raw: storage.getItem(key) }; }
    catch { return ngProgressFailure("storage-unreadable"); }
  };
  const read = owner => {
    const found = rawRead(ngProgressLocalKey(owner));
    if (found.status !== "ready") return found;
    if (found.raw === null) return { status: "empty", raw: null, blob: null };
    try {
      const envelope = JSON.parse(found.raw);
      if (!ngProgressObject(envelope) || envelope.format !== NG_PROGRESS_OWNER_FORMAT
        || !ngProgressSameOwner(envelope.owner, owner) || !ngProgressBlob(envelope.blob)) return ngProgressFailure("invalid-owner-envelope");
      return { status: "ready", raw: found.raw, blob: ngProgressFreeze(envelope.blob), savedAt: envelope.savedAt };
    } catch { return ngProgressFailure("invalid-owner-envelope"); }
  };
  return {
    read,
    write(owner, blob) {
      if (!ngProgressBlob(blob)) return ngProgressFailure("unsupported-progress");
      // Never replace an unreadable/corrupt/unknown-version cache with a guessed empty one.
      const previous = read(owner); if (previous.status === "unavailable") return previous;
      try {
        const envelope = { format: NG_PROGRESS_OWNER_FORMAT, owner: ngProgressClone(owner), blob, savedAt: now() };
        const raw = JSON.stringify(envelope);
        storage.setItem(ngProgressLocalKey(owner), raw);
        return { status: "saved", raw };
      } catch { return ngProgressFailure("storage-unwritable"); }
    },
    importSource(kind) {
      if (kind === "guest") return read(ngProgressOwner());
      if (kind !== "legacy") return ngProgressFailure("unsupported-import-source");
      const found = rawRead(NG_PROGRESS_LEGACY_KEY);
      if (found.status !== "ready") return found;
      if (found.raw === null) return { status: "empty", raw: null, blob: null };
      try {
        const blob = JSON.parse(found.raw);
        return ngProgressBlob(blob) ? { status: "ready", raw: found.raw, blob: ngProgressFreeze(blob) }
          : ngProgressFailure("unsupported-legacy-progress");
      } catch { return ngProgressFailure("unreadable-legacy-progress"); }
    },
    // ONE-TIME ADOPTION OF PRE-OWNER PROGRESS (v1.207.0, owner, 2026-09-29). Before per-owner
    // storage every visitor's progress lived in one unowned blob, and that is exactly what a
    // returning player saw. Loading it only through an explicit import made every existing player
    // boot as a white belt with the newcomer intro. So the FIRST guest load on a device with no
    // guest envelope adopts a valid legacy blob as the guest profile, plus the small legacy
    // markers (ladder rank, first roll, coached) the returning-visitor check reads. Nothing is
    // deleted: the legacy keys stay byte-identical. Malformed legacy bytes are never adopted, and
    // an account never adopts unowned progress automatically (it can import it explicitly).
    adoptLegacyGuest() {
      const guest = ngProgressOwner();
      const current = read(guest);
      if (current.status !== "empty") return { status: "skipped", reason: current.status === "ready" ? "guest-exists" : current.reason };
      const legacy = this.importSource("legacy");
      if (legacy.status !== "ready") return { status: "skipped", reason: legacy.status === "empty" ? "no-legacy" : legacy.reason };
      try {
        for (const field of ["ladder", "firstroll", "coached"]) {
          const old = storage.getItem(NG_PROGRESS_LEGACY_FIELD_PREFIX + field);
          if (old !== null && storage.getItem(ngProgressLocalKey(guest, field)) === null) storage.setItem(ngProgressLocalKey(guest, field), old);
        }
        const envelope = { format: NG_PROGRESS_OWNER_FORMAT, owner: ngProgressClone(guest), blob: ngProgressClone(legacy.blob), savedAt: now(), adoptedFrom: "legacy" };
        storage.setItem(ngProgressLocalKey(guest), JSON.stringify(envelope));
        return { status: "adopted" };
      } catch { return ngProgressFailure("storage-unwritable"); }
    },
  };
}

export function ngProgressCreateOwnerController({ store, initialOwner = ngProgressOwner(), invalidate, install, merge }) {
  if (!store || typeof invalidate !== "function" || typeof install !== "function") throw new TypeError("Owner lifecycle hooks are required");
  let owner = initialOwner, epoch = 0, active = true, pending = null;
  const state = () => ngProgressFreeze({ owner: ngProgressClone(owner), epoch, active, pending: pending && { reason: pending.reason } });
  const current = stamp => !!stamp && active && stamp.epoch === epoch && ngProgressSameOwner(stamp.owner, owner);
  const retire = reason => {
    epoch++; active = false;
    invalidate({ reason, epoch, owner: ngProgressClone(owner) });
  };
  const activate = (nextOwner, blob, reason) => {
    const target = ngProgressFreeze(ngProgressClone(nextOwner));
    // install MUST destroy the old instance and create a new owner-pinned instance.
    // It receives only this owner's cache or an explicit empty account, never prior state.
    try {
      // Installation boots synchronously; its saves and auth read the new stamp.
      owner = target; active = true;
      install({ owner: target, epoch, blob: blob === null ? null : ngProgressClone(blob), reason });
      pending = null;
      return { status: "ready", ...state() };
    } catch {
      active = false;
      if (pending?.outgoingOwner) owner = pending.outgoingOwner;
      pending = { ...(pending || {}), reason: "install-failed" };
      return { status: "held", ...state() };
    }
  };
  return {
    state, current,
    stamp: () => ngProgressFreeze({ owner: ngProgressClone(owner), epoch }),
    restore(nextOwner) {
      ngProgressOwnerId(nextOwner);
      retire("verified-owner-restore");
      pending = { reason: "restoring", nextOwner };
      const incoming = store.read(nextOwner);
      if (incoming.status === "unavailable") { pending.reason = incoming.reason; return { status: "held", ...state() }; }
      return activate(nextOwner, incoming.blob, "verified-owner-restore");
    },
    transition(nextOwner, outgoingBlob, force = false) {
      ngProgressOwnerId(nextOwner);
      if (!force && active && ngProgressSameOwner(owner, nextOwner)) return { status: "unchanged", ...state() };
      retire("identity-change");
      // Preserve the snapshot in memory as well as storage until transition is complete.
      pending = { reason: "switching", outgoingOwner: owner, outgoingBlob: ngProgressClone(outgoingBlob), nextOwner };
      const saved = store.write(owner, pending.outgoingBlob);
      if (saved.status !== "saved") { pending.reason = saved.reason; return { status: "held", ...state() }; }
      if (saved.blob) pending.outgoingBlob = ngProgressClone(ngProgressValidateBlob(saved.blob));
      const incoming = store.read(nextOwner);
      if (incoming.status === "unavailable") { pending.reason = incoming.reason; return { status: "held", ...state() }; }
      return activate(nextOwner, incoming.blob, "identity-change");
    },
    recoverySnapshot() {
      // For the paused outgoing identity only. A download/export can preserve it when
      // quota or a corrupt incoming envelope prevents a safe automatic switch.
      return pending?.outgoingBlob ? ngProgressClone(pending.outgoingBlob) : null;
    },
    previewImport(kind) {
      // Guest progress imports into an account; so does unowned legacy progress, which a guest
      // has already adopted automatically (store.adoptLegacyGuest), so it is never offered to one.
      if (!active || ((kind === "guest" || kind === "legacy") && owner.kind !== "account")) return ngProgressFailure("import-not-available");
      const source = store.importSource(kind);
      if (source.status !== "ready") return source;
      return ngProgressFreeze({ status: "preview", kind, owner: ngProgressClone(owner), epoch,
        sourceRaw: source.raw, sourceBlob: ngProgressClone(source.blob) });
    },
    confirmImport(preview, { confirmed = false, liveBlob } = {}) {
      if (!confirmed || preview?.status !== "preview") return ngProgressFailure("confirmation-required");
      if (!current(preview)) return ngProgressFailure("stale-import-target");
      const source = store.importSource(preview.kind);
      if (source.status !== "ready" || source.raw !== preview.sourceRaw) return ngProgressFailure("import-source-changed");
      if (!ngProgressBlob(liveBlob) || typeof merge !== "function") return ngProgressFailure("merge-unavailable");
      let combined;
      try {
        const incoming = ngProgressClone(source.blob);
        // Email consent and other account settings cannot migrate with practice evidence.
        delete incoming.settings; delete incoming.settingsAt; delete incoming.updatedAt;
        combined = merge(ngProgressClone(liveBlob), incoming);
      } catch { return ngProgressFailure("merge-failed"); }
      if (!ngProgressBlob(combined)) return ngProgressFailure("merge-failed");
      const saved = store.write(owner, combined);
      if (saved.status !== "saved") return saved;
      const accepted = saved.blob ? ngProgressValidateBlob(saved.blob) : combined;
      pending = { outgoingOwner: owner, outgoingBlob: ngProgressClone(accepted), nextOwner: owner };
      retire("explicit-progress-import");
      return activate(owner, accepted, "explicit-progress-import");
    },
  };
}

// Concrete page host: a full fresh app instance is the account/session boundary.
// The caller supplies DOM installation/recovery; this module performs no network I/O.
export function ngProgressCreateHost({ storage, mount, hold, resolveUser }) {
  if (typeof resolveUser !== "function") throw new TypeError("Authoritative owner resolution is required");
  const store = ngProgressCreateStore(storage);
  let app = null, recovery = null, resolving = null, resolutionRevision = 0, host;
  const observed = new Map();
  const semanticMerge = (local, incoming) => {
    if (!app || typeof app._mergeProgressBlobs !== "function") throw new Error("Progress merge is unavailable");
    return app._mergeProgressBlobs(local, incoming);
  };
  const mergeExternal = (owner, live, saved) => {
    const raw = observed.get(ngProgressOwnerId(owner));
    if (!saved.blob || raw === saved.raw) return live;
    const combined = semanticMerge(live, saved.blob);
    if (raw) {
      const base = JSON.parse(raw).blob;
      // A change in unrelated evidence is not a concurrent edit of this field.
      // Preserve ordinary local deletes/resets when that field on disk still equals
      // our observed base. Concurrent edits of the SAME field retain existing merge policy.
      for (const key of new Set([...Object.keys(base), ...Object.keys(live)])) {
        if (JSON.stringify(saved.blob[key]) === JSON.stringify(base[key])
          && JSON.stringify(live[key]) !== JSON.stringify(base[key])) {
          if (Object.prototype.hasOwnProperty.call(live, key)) combined[key] = ngProgressClone(live[key]);
          else delete combined[key];
        }
      }
    }
    return combined;
  };
  const preservingStore = {
    ...store,
    read(owner) {
      const found = store.read(owner);
      if (found.status !== "unavailable") observed.set(ngProgressOwnerId(owner), found.raw);
      return found;
    },
    write(owner, blob) {
      const previous = store.read(owner);
      if (previous.status === "unavailable") return previous;
      try {
        const key = ngProgressOwnerId(owner);
        // Our own persisted base must not be unioned back into deliberate deletes/resets.
        // Merge only evidence written since the cache this instance last observed.
        const merged = !!previous.blob && observed.get(key) !== previous.raw;
        const combined = merged ? mergeExternal(owner, blob, previous) : blob;
        const saved = store.write(owner, combined);
        if (saved.status === "saved") observed.set(key, saved.raw);
        return { ...saved, merged, blob: combined };
      }
      catch { return ngProgressFailure("local-merge-failed"); }
    },
  };
  const controller = ngProgressCreateOwnerController({ store: preservingStore,
    invalidate() {
      if (!app) return;
      app._progressHeld = true;
      if (app._invalidateCloudSync) app._invalidateCloudSync();
      clearTimeout(app._saveT); clearTimeout(app._flowSaveT);
      app._saveT = app._flowSaveT = null;
      // The app owns model/provider/session cleanup in componentWillUnmount.
      if (app.destroy) app.destroy();
    },
    install(boot) { mount({ ...boot, host }); },
    merge: semanticMerge,
  });
  const showHold = result => { if (typeof hold === "function") hold(result, host); return result; };
  const resume = () => {
    if (resolving?.revision === resolutionRevision) return resolving.promise;
    const attempt = { revision: ++resolutionRevision, promise: null };
    const current = () => resolving === attempt && attempt.revision === resolutionRevision;
    // Enter on a microtask so the attempt identity is installed even if the resolver throws.
    attempt.promise = Promise.resolve().then(async () => {
      try {
        const user = await resolveUser();
        if (user !== null && (!user || typeof user.id !== "string" || !user.id)) throw new Error("Invalid verified user");
        const nextOwner = ngProgressOwner(user === null ? null : user.id);
        if (!current()) return ngProgressFailure("stale-owner-resolution");
        if (nextOwner.kind === "guest") store.adoptLegacyGuest();
        // A failed SPA pre-flush still belongs to the outgoing owner, never the SDK's new one.
        if (!recovery && app?._progressStorageError && app._progressLoaded) recovery = { blob: ngProgressClone(app._progressBlob()) };
        const outgoing = controller.recoverySnapshot() || recovery?.blob;
        const result = recovery ? controller.transition(nextOwner, outgoing, true) : controller.restore(nextOwner);
        if (result.status === "ready") { recovery = null; return result; }
        return showHold(result);
      } catch {
        if (!current()) return ngProgressFailure("stale-owner-resolution");
        return showHold({ status: "held", reason: "identity-unavailable" });
      } finally { if (resolving === attempt) resolving = null; }
    });
    resolving = attempt;
    return attempt.promise;
  };
  host = {
    store, controller,
    current(inst) { return inst === app && !inst.__ngDestroyed && !inst._progressHeld && controller.current(inst._progressOwnerStamp); },
    bind(inst, boot) {
      app = inst; inst._progressHost = host; inst._progressOwner = boot.owner;
      inst._progressOwnerStamp = { owner: boot.owner, epoch: boot.epoch };
      inst._progressBootBlob = boot.blob === null ? null : ngProgressClone(boot.blob);
    },
    mountFailed(inst) {
      if (inst !== app || inst.__ngDestroyed) return;
      inst._progressHeld = true;
      if (inst.destroy) inst.destroy();
      showHold({ status: "held", reason: "mount-failed" });
    },
    bootstrap() {
      if (app && host.current(app)) return Promise.resolve({ status: "unchanged" });
      return resume();
    },
    persist(inst, blob) {
      if (!host.current(inst)) return ngProgressFailure("stale-owner");
      const result = preservingStore.write(inst._progressOwner, blob);
      if (result.status !== "saved") inst._progressStorageError = result.reason;
      else {
        inst._progressStorageError = null;
        if (result.merged) inst._hydrateProgressBlob(result.blob);
      }
      return result;
    },
    cloudSnapshot(inst) {
      if (!host.current(inst)) throw new Error("Stale progress owner");
      const saved = store.read(inst._progressOwner);
      if (saved.status === "unavailable") throw new Error("Local progress cannot be read");
      const live = inst._progressBlob();
      return mergeExternal(inst._progressOwner, live, saved);
    },
    authenticate(inst, user) {
      if (!host.current(inst)) return ngProgressFailure("stale-owner");
      resolutionRevision++;
      const nextOwner = ngProgressOwner(user ? user.id : null);
      if (ngProgressSameOwner(inst._progressOwner, nextOwner)) return { status: "unchanged" };
      if (nextOwner.kind === "guest") store.adoptLegacyGuest();
      recovery = { nextOwner, blob: ngProgressClone(inst._progressBlob()) };
      const result = controller.transition(nextOwner, recovery.blob);
      if (result.status === "ready") recovery = null;
      else showHold(result);
      return result;
    },
    retry() {
      return resume();
    },
    recoverySnapshot() { return controller.recoverySnapshot() || (recovery && ngProgressClone(recovery.blob)); },
    previewImport(inst, kind) { return host.current(inst) ? controller.previewImport(kind) : ngProgressFailure("stale-owner"); },
    confirmImport(inst, preview) {
      if (!host.current(inst)) return ngProgressFailure("stale-owner");
      recovery = { nextOwner: inst._progressOwner, blob: ngProgressClone(inst._progressBlob()) };
      const result = controller.confirmImport(preview, { confirmed: true, liveBlob: recovery.blob });
      if (result.status === "ready") recovery = null;
      else if (result.status === "held") showHold(result);
      else recovery = null;
      return result;
    },
  };
  return host;
}
