// Host-only account storage/transition boundary. Never send owner IDs to model workers.
// The integration owner supplies the existing semantic progress merge for explicit import.
export const NG_PROGRESS_OWNER_FORMAT = "bjj-progress-owner-v1";
const NG_PROGRESS_OWNER_PREFIX = "bjj-neural-owner:";
const NG_PROGRESS_LEGACY_KEY = "bjj-neural-progress";
// The facade's two "cannot verify, but this device names the account" failures, which play
// local-only instead of holding: the SDK cannot load (FGLOCAL1, 2026-09-29), and the SDK loaded but
// its session check failed (D3, 2026-09-30). Anything else, a malformed session included, holds.
const NG_PROGRESS_LOCAL_ONLY_CODES = ["sdk-unavailable", "session-unverified"];
// The pre-owner markers were `bjj-neural-ladder` / `-firstroll` / `-coached`.
const NG_PROGRESS_LEGACY_FIELD_PREFIX = "bjj-neural-";

function ngProgressObject(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
function ngProgressClone(value) { return JSON.parse(JSON.stringify(value)); }
// v1.255.2: what a cloud write would store, for "has anything changed since the cloud last held this?". Two things are left out:
// `updatedAt`, the one write-time stamp (`_progressBlob` sets it to the clock on every call, so two writes of the same progress always
// differ there), and key order, at every depth (the database's JSONB reorders keys, and a merge may build them in another order).
// Leaving `updatedAt` out is safe: only two merge steps read it, and neither needs a push that advances nothing else. Settings merge
// per key on `settingsAt` and fall back to the blob's stamp only for keys older than per-key stamps; there a stamp-only push would make
// an unchanged value look newer than another device's real edit. The white-challenge migration stamps what it migrates with it.
// Three arrays are SETS (#360's review): the merge unions them, the local order first, so two devices hold one set in two orders
// and, compared in order, pushed the whole blob on every pull. They are compared as sets here, in the key only (the stored blob keeps
// its order): `explored`, each day's `dayLog[d].k`, and each list's `items` (nothing reorders a list; add and remove only). Every
// other array is ORDERED and compared in order: the srs, moves and flow rows (positional tuples), `dayLog[d].b`, the belt
// grandfather, and any array a setting holds (settings merge by whole value).
export function ngProgressCloudKey(blob) {
  const sorted = (v) => Array.isArray(v) ? v.map(sorted)
    : ngProgressObject(v) ? Object.keys(v).sort().reduce((out, k) => { out[k] = sorted(v[k]); return out; }, {}) : v;
  const set = (v) => Array.isArray(v) ? v.slice().sort() : v;
  const each = (map, field) => ngProgressObject(map) ? Object.fromEntries(Object.entries(map).map(([k, e]) => [k, ngProgressObject(e) ? { ...e, [field]: set(e[field]) } : e])) : map;
  const { updatedAt, ...rest } = ngProgressObject(blob) ? blob : {};
  if ("explored" in rest) rest.explored = set(rest.explored);
  if ("dayLog" in rest) rest.dayLog = each(rest.dayLog, "k");
  if ("lists" in rest) rest.lists = each(rest.lists, "items");
  return JSON.stringify(sorted(rest));
}
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
  for (const key of ["prep", "rec", "stage", "srs", "moves", "units", "belts", "tut", "challenges", "badges", "coins", "lists", "flow", "days", "rollDays", "dayLog", "settings", "settingsAt"]) {
    if (key in value && !ngProgressObject(value[key])) throw new Error("Invalid saved progress field: " + key);
  }
  const map = v => ngProgressObject(v) && Object.getPrototypeOf(v) === Object.prototype;
  const number = v => typeof v === "number" && Number.isFinite(v) && v >= 0;
  for (const key of ["prep", "rec", "days", "rollDays", "settingsAt"]) {
    if (value[key] && Object.values(value[key]).some(v => !number(v))) throw new Error("Invalid progress counter: " + key);
  }
  for (const row of Object.values(value.stage || {})) {
    if (!map(row) || Object.values(row).some(v => !number(v))) throw new Error("Invalid card evidence");
  }
  for (const row of Object.values(value.srs || {})) {
    if (!map(row) || Object.values(row).some(v => !Array.isArray(v) || v.length < 3 || v.some(x => !number(x)))) throw new Error("Invalid review schedule");
  }
  // moves[state][move] = [due, ivl, last, ok] (v1.255.0); a longer row from a later build is kept
  for (const row of Object.values(value.moves || {})) {
    if (!map(row) || Object.values(row).some(v => !Array.isArray(v) || v.length < 4 || v.some(x => !number(x)))) throw new Error("Invalid move record");
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

// THE `moves` MERGE (v1.255.0): moves[state][move] = [due, ivl, last, ok, ...tail], two devices' copies, cell by cell.
// A TOTAL ORDER, so merge(a, b) equals merge(b, a) and two devices always converge (review R1: the first draft let a
// full tie keep whichever copy was LOCAL, so a phone's No and a laptop's first Yes on the same day each kept their own
// and the cloud flipped with every push). The winner is: the later `last`; then the smaller interval (`srs`'s rule);
// then the No (ok 0) — mastery breaks on a No; then the earlier due; then the tail, compared as text. A winner past
// rung 0 keeps the longer interval it beat, which heals a fresh device's 1 -> 3 against a mature schedule. `last` is
// clamped to today on BOTH sides, so a fast clock cannot win forever. A row's tail (cells a later build may add) rides
// with the row that wins, through the heal too (review R5). It lives HERE, beside the blob's validator, because it is
// blob code: knowledge-profile's bytes are pinned by the study engine's law hashes. Returns a new map; inputs untouched.
export function ngProgressMergeMoves(local, cloud, today) {
  const valid = r => Array.isArray(r) && r.length >= 4 && r.slice(0, 4).every(x => typeof x === "number" && Number.isFinite(x));
  const norm = r => [r[0] | 0, r[1] | 0, Math.min(today, r[2] | 0), r[3] ? 1 : 0].concat(r.slice(4));
  const tail = r => JSON.stringify(r.slice(4));
  const first = (a, b) => a[2] !== b[2] ? (a[2] > b[2] ? a : b) : a[1] !== b[1] ? (a[1] < b[1] ? a : b)
    : a[3] !== b[3] ? (a[3] < b[3] ? a : b) : a[0] !== b[0] ? (a[0] < b[0] ? a : b) : tail(a) <= tail(b) ? a : b;
  const out = {};
  for (const side of [local, cloud]) for (const s in side || {}) {
    const l = (out[s] = out[s] || {});
    for (const mv in side[s] || {}) {
      if (!valid(side[s][mv])) continue;
      const c = norm(side[s][mv]), m = l[mv];
      if (!m) { l[mv] = c; continue; }
      let w = first(m, c);
      const o = w === m ? c : m;
      if (w[1] > 1 && o[1] > w[1]) w = [w[2] + o[1], o[1], w[2], w[3]].concat(w.slice(4));
      l[mv] = w;
    }
  }
  return out;
}
// GUEST PRACTICE JOINS THE ACCOUNT AT SIGN-IN (v1.262.0, the owner, 11 Nov, U138 a "Always automatic"). Until v1.261.x
// a guest copy reached an account only through the menu's "Review guest progress" and its dialog, which every
// signed-in player saw for good (the sign-in itself writes a guest copy, and Import kept it). Now `joinGuest` adds the
// browser's guest practice to the account at its first verified mount, once per guest copy and account (the `guest`
// mark), with one line. The guest copy stays byte for byte: signing out still plays it. ON A SHARED BROWSER whoever
// signs in next receives what was practised signed out there, a second account too: the owner's pick, knowing that.
// The rule (`ngProgressGuestMerge`) is the cloud pull's own merge (`_mergeProgressBlobs`: MAX, union, add-wins) with two
// changes that make it ONLY ADD (his standing rule: no account loses a %, a boost, gold or a belt):
//   1. the guest's settings never move (`settings`, `settingsAt`, `updatedAt` are dropped), as the old Import did:
//      the account's email consent, ruleset and goal stay the account's;
//   2. a guest's No never takes an account's Yes (`ngProgressGuestMoves`). The pull's `moves` order lets the later
//      answer win, so a guest's later "Still got it? No" took the account's gold, its +15 and a "Moves known" point
//      through the old Import (U125 b's rule, right inside one account and across its devices, where it still holds).
//      The account's own row is kept. It is the cloud's row ONLY because the join runs after a successful pull
//      (`joinGuest`'s `not-pulled` refusal, `_pullAndMerge`): `live` then holds the cloud's rows, so the next pull,
//      on this device or another, cannot undo it (ORDER1, tests/guest_join_safety.test.mjs 11).
// Every other field of that merge already only adds (prep/rec/stage/days MAX, belts.held MAX and won union,
// badges/coins/explored/tut union, challenges MAX progress, lists add-wins, flow a new device partition, units and
// unknown fields: the account's wins). `srs` keeps the pull's rule: a guest's later miss can bring a card back
// sooner; no figure reads the schedule's interval, and today's count is a union. tests/guest_join_safety.test.mjs.
function ngProgressGuestPart(blob) {
  const out = ngProgressClone(blob);
  delete out.settings; delete out.settingsAt; delete out.updatedAt;
  return out;
}
// FNV-1a over the guest copy's cloud key: the mark that says "this account already took THIS guest copy here".
function ngProgressHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export function ngProgressGuestMoves(account, merged) {
  if (!ngProgressObject(merged)) return merged;
  const out = ngProgressClone(merged);
  for (const s in account || {}) for (const mv in account[s] || {}) {
    const a = account[s][mv], m = out[s] && out[s][mv];
    if (Array.isArray(a) && a[3] && Array.isArray(m) && !m[3]) out[s][mv] = ngProgressClone(a);
  }
  return out;
}
// WHAT COUNTS AS PRACTICE. A guest who only LOOKED (landed, saw a hand) already leaves a trail: the visited states
// (`explored`), the first coach steps (`tut.done.coach1..3`, mirrored as the challenges below by
// `ngMigrateWhiteChallenges`) and the belt grandfather stamp (`belts.gf`). Measured on a bare landing, 11 Nov. That
// trail never triggers a join or the line, or every new account would be told its practice was saved after doing
// none; it rides along only when real practice joins. The three ids are the white track's coach challenges
// (NG_WHITE_CHALLENGES with legacyId coach1..3; tests/guest_join_safety.test.mjs pins them equal).
export const NG_PROGRESS_TRAIL_CHALLENGES = Object.freeze(["white.coach1", "white.coach2", "white.coach3"]);
export function ngProgressPracticeKey(blob) {
  const b = ngProgressGuestPart(blob);
  delete b.explored; delete b.tut;
  if (ngProgressObject(b.belts)) delete b.belts.gf;
  if (ngProgressObject(b.challenges)) for (const id of NG_PROGRESS_TRAIL_CHALLENGES) delete b.challenges[id];
  return ngProgressCloudKey(b);
}
// THE RULE, in one place: what a guest copy adds to an account. `merge` is the app's `_mergeProgressBlobs`.
export function ngProgressGuestMerge(merge, live, guestBlob) {
  const combined = merge(live, ngProgressGuestPart(guestBlob));
  if (combined.moves) combined.moves = ngProgressGuestMoves(live.moves, combined.moves);
  return combined;
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
  // `guest` (v1.262.0): on an account, the hash of the guest copy it last took (or found nothing in) on this device
  if (!["progress", "ladder", "firstroll", "coached", "guest"].includes(field)) throw new TypeError("Unknown account-owned local field");
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
  // `localOnly`: the owner this host restored WITHOUT verified identity (see resume's catch).
  let app = null, recovery = null, resolving = null, resolutionRevision = 0, host, localOnly = null;
  const observed = new Map();
  const semanticMerge = (local, incoming) => {
    if (!app || typeof app._mergeProgressBlobs !== "function") throw new Error("Progress merge is unavailable");
    return app._mergeProgressBlobs(local, incoming);
  };
  const guestMerge = (live, guestBlob) => ngProgressGuestMerge(semanticMerge, live, guestBlob);
  const guestKey = blob => ngProgressHash(ngProgressCloudKey(ngProgressGuestPart(blob)));
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
        localOnly = null;
        // A failed SPA pre-flush still belongs to the outgoing owner, never the SDK's new one.
        if (!recovery && app?._progressStorageError && app._progressLoaded) recovery = { blob: ngProgressClone(app._progressBlob()) };
        const outgoing = controller.recoverySnapshot() || recovery?.blob;
        const result = recovery ? controller.transition(nextOwner, outgoing, true) : controller.restore(nextOwner);
        if (result.status === "ready") { recovery = null; return result; }
        return showHold(result);
      } catch (error) {
        if (!current()) return ngProgressFailure("stale-owner-resolution");
        // LOCAL-ONLY PLAY (owner ruling 2026-09-29, FGLOCAL1). This device holds a session but the
        // sign-in SDK cannot load (the facade says `sdk-unavailable` and names the stored account,
        // unverified). Play on THIS DEVICE's copy of that account: the app is flagged local-only,
        // shows a banner, never pulls or pushes, and re-verifies identity before its first pull,
        // whose merge runs before any push. Only these failures (NG_PROGRESS_LOCAL_ONLY_CODES), only
        // with a named account, and never over a pending recovery; every other failure still holds.
        const stored = error && NG_PROGRESS_LOCAL_ONLY_CODES.includes(error.code) && typeof error.storedUserId === "string" && error.storedUserId ? error.storedUserId : null;
        if (stored && !recovery) {
          localOnly = ngProgressOwner(stored);
          const result = controller.restore(localOnly);
          if (result.status === "ready") return { ...result, localOnly: true };
          localOnly = null;
          return showHold(result);
        }
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
      inst._progressLocalOnly = !!localOnly && ngProgressSameOwner(boot.owner, localOnly);
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
      // Any VERIFIED answer ends local-only play: the same account stays mounted (the app then
      // pulls and merges before its first push); another account or a guest switches as usual.
      localOnly = null; inst._progressLocalOnly = false;
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
    // ── v1.262.0: the guest copy joins the account (see ngProgressGuestMerge) ──
    // Called by the app at the end of the account's first SUCCESSFUL pull (`_pullAndMerge`), never before it: the rule
    // must meet the cloud's rows, and the local copy holds them only after a pull (ORDER1: joined before the pull, a
    // guest's later "No" beat a "Yes" only the cloud held). So a local-only account (identity unverified), a held switch
    // and an account whose pull has not succeeded join nothing and mark nothing; this refuses them too, a second guard.
    // Statuses: `joined` (with the blob to hydrate), `none` (no guest copy), `seen` (this guest copy already taken here),
    // `nothing` (no practice in it: marked, silent), or a failure (nothing written, nothing marked).
    joinGuest(inst) {
      if (!host.current(inst) || inst._progressOwner?.kind !== "account") return ngProgressFailure("not-an-account");
      if (inst._progressLocalOnly) return ngProgressFailure("identity-unverified");
      if (inst._pulled !== true || inst._pulledUserId !== inst._progressOwner.id) return ngProgressFailure("not-pulled");
      const found = store.read(ngProgressOwner());
      if (found.status === "empty") return { status: "none" };
      if (found.status !== "ready") return found;
      const key = guestKey(found.blob), mark = ngProgressLocalKey(inst._progressOwner, "guest");
      let seen; try { seen = storage.getItem(mark); } catch { return ngProgressFailure("storage-unreadable"); }
      if (seen === key) return { status: "seen" };
      let live, combined, adds;
      try {
        live = inst._progressBlob(); combined = guestMerge(live, found.blob);
        adds = ngProgressPracticeKey(combined) !== ngProgressPracticeKey(semanticMerge(live, { v: 2 }));
      } catch { return ngProgressFailure("merge-failed"); }
      if (!adds) { try { storage.setItem(mark, key); } catch { /* looked at again next time: harmless */ } return { status: "nothing" }; }
      if (!ngProgressBlob(combined)) return ngProgressFailure("merge-failed");
      const saved = preservingStore.write(inst._progressOwner, combined);
      if (saved.status !== "saved") { inst._progressStorageError = saved.reason; return saved; }   // nothing marked
      // Marked only after the account's copy holds the practice. A mark that fails to write joins again next time,
      // which adds nothing new (every merge step is idempotent) but says the line once more.
      try { storage.setItem(mark, key); } catch { /* see above */ }
      return { status: "joined", blob: saved.blob || combined };
    },
  };
  return host;
}
