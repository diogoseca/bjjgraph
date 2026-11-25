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
// its order): `explored`, each day's `dayLog[d].k`, and each list's `items`. A list's ORDER is not lost by that: since v1.296.1
// it travels in `listOrderAt` ({ list: [t, [ids]] }, LISTS-R Slice 2), an ordered array compared in order, so a reorder alone
// still changes this key and is pushed (tests/list_moves_sync.test.mjs, 6). Every other array is ORDERED and compared in
// order: the srs, moves and flow rows (positional tuples), `dayLog[d].b`, the belt grandfather, `listOrderAt`, and any array
// a setting holds (settings merge by whole value).
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
  // THE INVARIANT (L1-R3, the orchestrator's ruling, 17 Nov 2026, taking back L1-R2's): `explored` holds unique strings, each a place's key, and nothing else, for good. A build that needs more stores it
  // under a new key: every validator shipped before v1.290.0 refuses anything else here, so a non-string kept in this list
  // locks older devices out of their own record.
  // WHAT THIS LINE ACCEPTS IS WIDER THAN WHAT IS EVER WRITTEN, on purpose (L1-R1, the first reader of PR #434, measured on
  // dev v1.287.0 too): a damaged entry (42, null, {}) made the stored envelope "invalid" and the app held before it drew,
  // every other field with it. So a list with such an entry is READ (its strings are the places, the rest counted:
  // `ngProgressExploredKeys`), and the very next save writes the unique strings only (app.src.jsx, `_progressBlob`), which
  // every captured validator accepts (tests/progress_owner.integration.test.mjs runs them). The list itself must be a list.
  if ("explored" in value && !Array.isArray(value.explored)) throw new Error("Invalid explored history");
  return value;
}

// THE SCHEDULE'S EXACT INTERVAL (v1.281.0, LIN1), a copy of knowledge-profile's `ngKnowledgeInterval` (that file's bytes
// are pinned by the study engine's law hashes, and a group file cannot import): the ladder, one step on along the straight
// line between rungs, and the pair at `at` read only when it reproduces the row's due day. tests/schedule_linear.test.mjs
// pins it equal to the original over every row shape the writer makes.
const NG_PROGRESS_SCHED_LADDER = (() => { const L = [1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922]; while (L.length < 24) L.push(L[L.length - 1] * 2); return L; })();
function ngProgressSchedStep(ivl) {
  const L = NG_PROGRESS_SCHED_LADDER, n = L.length - 1, x = Math.max(L[0], ivl);
  for (let i = 0; i < n; i++) {
    if (x < L[i + 1]) return i + 1 >= n ? L[n] : x === L[i] ? L[i + 1] : L[i + 1] + ((x - L[i]) * (L[i + 2] - L[i + 1])) / (L[i + 1] - L[i]);
  }
  return L[n];
}
// the pair's exact interval when it checks itself against the row, else null
function ngProgressSchedPair(row, at = 4) {
  const last = row[2], A = row[at], t0 = row[at + 1];
  if (Number.isFinite(A) && A >= 1 && Number.isFinite(t0) && t0 <= last && last - t0 < A) {
    const ivl = A + ((last - t0) * (ngProgressSchedStep(A) - A)) / A;
    if (Math.ceil(last + ivl - 1e-6) === row[0]) return ivl;
  }
  return null;
}
export function ngProgressSchedInterval(row, at) {
  const p = ngProgressSchedPair(row, at);
  if (p !== null) return p;
  const t = row[0] - row[2], c = Number.isFinite(row[1]) && row[1] >= 1 ? row[1] : 1;
  return Number.isFinite(t) ? Math.max(c, t) : c;
}
// THE `moves` MERGE (v1.255.0): moves[state][move] = [due, ivl, last, ok, ...tail], two devices' copies, cell by cell.
// A TOTAL ORDER, so merge(a, b) equals merge(b, a) and two devices always converge (review R1: the first draft let a
// full tie keep whichever copy was LOCAL, so a phone's No and a laptop's first Yes on the same day each kept their own
// and the cloud flipped with every push). The winner is: the later `last`; then the smaller interval (`srs`'s rule);
// then the No (ok 0) — mastery breaks on a No; then the earlier due; then the tail, compared as text. A winner past
// rung 0 keeps the longer interval it beat, which heals a fresh device's 1 -> 3 against a mature schedule; since
// v1.279.0 both are read as TRUE intervals (`due − last`), the cell being floored to the seven-rung ladder. `last` is
// clamped to today on BOTH sides, so a fast clock cannot win forever. A row's tail (cells a later build may add) rides
// with the row that wins, through the heal too (review R5). It lives HERE, beside the blob's validator, because it is
// blob code: knowledge-profile's bytes are pinned by the study engine's law hashes. Returns a new map; inputs untouched.
export function ngProgressMergeMoves(local, cloud, today) {
  const valid = r => Array.isArray(r) && r.length >= 4 && r.slice(0, 4).every(x => typeof x === "number" && Number.isFinite(x));
  const norm = r => [r[0] | 0, r[1] | 0, Math.min(today, r[2] | 0), r[3] ? 1 : 0].concat(r.slice(4));
  const tail = r => JSON.stringify(r.slice(4)), ed = r => r[2] + ngProgressSchedInterval(r, 4);
  const first = (a, b) => a[2] !== b[2] ? (a[2] > b[2] ? a : b) : a[1] !== b[1] ? (a[1] < b[1] ? a : b)
    : a[3] !== b[3] ? (a[3] < b[3] ? a : b) : ed(a) !== ed(b) ? (ed(a) < ed(b) ? a : b)
    : a[0] !== b[0] ? (a[0] < b[0] ? a : b) : tail(a) <= tail(b) ? a : b;
  const out = {};
  for (const side of [local, cloud]) for (const s in side || {}) {
    const l = (out[s] = out[s] || {});
    for (const mv in side[s] || {}) {
      if (!valid(side[s][mv])) continue;
      const c = norm(side[s][mv]), m = l[mv];
      if (!m) { l[mv] = c; continue; }
      let w = first(m, c);
      const o = w === m ? c : m;
      // the heal by EXACT intervals (v1.281.0; `ngKnowledgeInterval`'s reading, which this group file cannot import:
      // tests/schedule_linear.test.mjs pins the two equal), the beaten row's own cell kept: a beaten row of the winner's own
      // day as it is, its pair with it (a second pull then writes nothing); one from an earlier day as a fresh anchor at the
      // winner's last, a pair only when that interval is not whole; the winner's answer and its cells after the pair ride
      const tw = ngProgressSchedInterval(w, 4), to = ngProgressSchedInterval(o, 4);
      if (tw > 1 && to > tw) {
        const rest = w.length > 6 ? w.slice(6) : [], none = rest.length ? [0, 0] : [];
        if (o[2] === w[2]) w = o.slice(0, 3).concat(w[3], ngProgressSchedPair(o) ? o.slice(4, 6) : none, rest);
        else {
          const A = to;   // the beaten interval as read, not rounded (v1.281.3, as `ngKnowledgeMergeRow`)
          w = [Math.ceil(w[2] + A - 1e-6), o[1], w[2], w[3]].concat(Number.isInteger(A) ? none : [A, w[2]], rest);
        }
      }
      l[mv] = w;
    }
  }
  return out;
}
// THE ANSWERS A COPY HAS NOT YET DELIVERED (v1.280.2, NEXT2, ruled NEXT2-GO and NEXT2-R1). A schedule row written WITHOUT
// having seen another copy's row of the same card used to meet it in a merge that keeps "the later answer": a first right
// answer ([d+1, 1, d]: the same row a miss writes) given before a device's first pull, offline, by a guest before signing
// in, or in a second tab that never saw the first tab's row, replaced a mature schedule with one day, and nothing stored
// can say whether that answer was right (proven, v1.279.0). So each owner keeps, on THIS browser only, the answers it has
// not yet seen delivered, and wherever its copy meets another copy's rows (the cloud's at a pull, the account's at the
// guest join, another tab's at a save) those cards are rebuilt: the other copy's row with these answers applied to it again
// by the writer (`ngKnowledgeScheduleRow`, passed in: this group file cannot import it), in the order they were given.
//   · ONLY A NEWER ANSWER (NEXT2-R1, the reader's finding 1): an entry is replayed only when it was made ON OR AFTER the
//     other copy's row's `last`. The journal protects a newer answer from being flattened into a blind one-day row; it
//     never lets an older answer override a newer one. An entry older than the other row's last answer meets it by the
//     merge's own rule, as before v1.280.2: a miss made after the other copy's last answer counts; a miss made before it is
//     superseded by that later answer, as on dev (once a guest's miss of months ago reset every account's mature card at
//     its first join). At a pull such an entry leaves the journal: the cloud's later answer superseded it for good.
//   · STORED under `ngProgressLocalKey(owner, "pending")`: local, never synced, never in the blob or the practice key, one
//     owner's only (another account's or the guest's answers are never replayed onto this owner's rows; the guest join is
//     the one crossing, and it is the join's own purpose). It survives a reload; a browser that clears its site data loses it
//     with the copy it belongs to. Written only when an answer is given or delivered: never on a passive boot. A journal of
//     a version this build does not know is never written over: the build journals nothing for that owner until it can
//     read it. A damaged one is replaced; ids come from the clock, so a new one never restarts below an id already used
//     (an account's guest high-water `g` included).
//   · AN ENTRY: [id, field (0 srs, 1 moves), bucket (deck or seat), item (question or move), ok (1/0), day, after, src?],
//     `after` the row this entry left (updated when a replay rebuilds it), `src` the guest entry it came from (an account's
//     copy of a guest answer it took in at the join). The journal: {v: 1, n: next id, g: the highest guest entry id an
//     account has taken in (accounts only), e: entries in the order given}. The guest rows an account took in live under
//     their own key (`ngProgressTakenParse`), so no answer rewrites them.
//   · DELIVERED, and gone from the journal, when a copy the cloud accepted (a push that returned true and ran alone in its
//     tab) or holds (a pulled blob) has, for the entry's card, EXACTLY the row that entry or a later entry of the same card
//     left (NEXT2-R1, finding 7: "one more answer on top" counted any miss row as holding it). A push that landed but was
//     answered false stays right through the rule above: another device's answer on top of it is later than the entry,
//     which then meets it by the merge's rule, never twice. A guest entry an account took in leaves the GUEST journal when
//     that account's cloud holds what it rebuilt. A card the other copy has no row of is not rebuilt.
//   · BOUNDED at NG_PROGRESS_JOURNAL_CAP entries, so no answer rewrites more than about 20 KB: beyond it the oldest go, and
//     their cards meet other copies by the merge's rule, as before v1.280.2 (180 entries of about 110 bytes with a long deck
//     key: about three days offline at 60 answers a day, nine at Practice's 20).
// NOT COVERED: answers given before v1.280.2 (no journal: a guest's old 1-day rows can still shorten an account's card at
// its first join); an older client's answers; two tabs appending in the same instant (one entry can be lost: that answer
// meets other copies by the merge's rule); another DEVICE that pulled before this device's push and then pushes its own
// older-based copy over it (the cloud push is a whole-blob upsert: until a conditional push exists, this device's next
// pull meets that device's row by the merge's rule once the entry was delivered); the merge's heal, which can still erase
// a miss in some orders of syncs (the reader's D2: 48 of 27,000 two-device runs where dev counts the miss, against 597
// the other way); D1's rule, which cannot tell from the rows alone a set-aside right answer that earned more from one
// that another device's miss of the same day undid (16 of 168,912 three-device runs end later than both dev and the
// in-time-order result); and a tab whose save is still in its 400 ms delay while another tab pulls, rebuilds and delivers
// (the reader's D4: the one-day row comes back, as on dev).
export const NG_PROGRESS_JOURNAL_CAP = 180;
const NG_PROGRESS_JOURNAL_TAKEN = 500;   // an account's taken guest rows (`t`), oldest dropped beyond it
const NG_PROGRESS_JOURNAL_FIELDS = ["srs", "moves"];
export function ngProgressJournalEmpty(now = Date.now()) { return { v: 1, n: Math.max(1, Math.floor(now)), g: 0, e: [] }; }
function ngProgressJournalEntry(e) {
  return Array.isArray(e) && (e.length === 7 || (e.length === 8 && Number.isSafeInteger(e[7]) && e[7] > 0))
    && Number.isSafeInteger(e[0]) && e[0] > 0 && (e[1] === 0 || e[1] === 1)
    && typeof e[2] === "string" && typeof e[3] === "string" && (e[4] === 0 || e[4] === 1) && Number.isSafeInteger(e[5])
    && Array.isArray(e[6]) && e[6].length >= (e[1] ? 4 : 3) && e[6].every(x => typeof x === "number" && Number.isFinite(x));
}
// null for a journal of a version this build does not know (left alone); a damaged one reads as a new, empty one
export function ngProgressJournalParse(raw, now = Date.now()) {
  if (typeof raw !== "string") return ngProgressJournalEmpty(now);
  let j;
  try { j = JSON.parse(raw); } catch { return ngProgressJournalEmpty(now); }
  if (ngProgressObject(j) && j.v !== undefined && j.v !== 1) return null;
  if (!ngProgressObject(j) || !Array.isArray(j.e)) return ngProgressJournalEmpty(now);
  const e = j.e.filter(ngProgressJournalEntry);
  const n = Math.max(Number.isSafeInteger(j.n) ? j.n : 0, ...e.map(x => x[0] + 1), 1);
  return { v: 1, n, g: Number.isSafeInteger(j.g) && j.g > 0 ? j.g : 0, e };
}
// THE GUEST ROWS AN ACCOUNT TOOK IN (NEXT2-R1 finding 3, its own key since NEXT2-R2, the reader's D3: beside the entries
// they made every answer rewrite up to about 48 KB): {card: the guest's row as taken}, under `ngProgressLocalKey(account,
// "taken")`, local only, one account's, never in the synced blob or the practice key, read and written only at a guest
// join, bounded at NG_PROGRESS_JOURNAL_TAKEN cards (the oldest go: their guest rows then meet the account by the merge's
// rule). Unreadable or damaged reads as empty; another format is never written over.
export function ngProgressTakenParse(raw) {
  if (typeof raw !== "string") return {};
  let j;
  try { j = JSON.parse(raw); } catch { return {}; }
  if (ngProgressObject(j) && j.v !== undefined && j.v !== 1) return null;
  const t = {};
  if (ngProgressObject(j) && ngProgressObject(j.t)) for (const k of Object.keys(j.t)) if (Array.isArray(j.t[k]) && j.t[k].every(x => typeof x === "number" && Number.isFinite(x))) ngProgressPut(t, k, j.t[k]);
  return t;
}
// the card an entry is about, as one string
export function ngProgressJournalCard(e) { return e[1] + "\u0000" + e[2] + "\u0000" + e[3]; }
// the other copy's row as the merges read it (the cloud's `| 0` and today's clamp), or null when it has none
function ngProgressJournalRow(blob, field, bucket, item, today) {
  const map = blob && blob[NG_PROGRESS_JOURNAL_FIELDS[field]], b = ngProgressObject(map) && Object.prototype.hasOwnProperty.call(map, bucket) ? map[bucket] : null;
  const r = ngProgressObject(b) && Object.prototype.hasOwnProperty.call(b, item) ? b[item] : null;
  if (!Array.isArray(r) || r.length < (field ? 4 : 3) || !r.slice(0, field ? 4 : 3).every(x => typeof x === "number" && Number.isFinite(x))) return null;
  const head = [r[0] | 0, r[1] | 0, Math.min(today, r[2] | 0)];
  return field ? head.concat(r[3] ? 1 : 0, r.slice(4)) : head.concat(r.slice(3));   // the schedule's pair rides (v1.281.0)
}
// a card's row as a blob holds it, untouched (null when it has none)
function ngProgressJournalRaw(blob, field, bucket, item) {
  const map = blob && blob[NG_PROGRESS_JOURNAL_FIELDS[field]], b = ngProgressObject(map) && Object.prototype.hasOwnProperty.call(map, bucket) ? map[bucket] : null;
  return ngProgressObject(b) && Object.prototype.hasOwnProperty.call(b, item) && Array.isArray(b[item]) ? b[item] : null;
}
function ngProgressPut(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true }); }
// set a card's row in a blob being built (define, never assign: a deck name is data, `__proto__` included)
function ngProgressJournalSet(out, field, bucket, item, row) {
  const name = NG_PROGRESS_JOURNAL_FIELDS[field];
  if (!ngProgressObject(out[name])) out[name] = {};
  if (!ngProgressObject(Object.prototype.hasOwnProperty.call(out[name], bucket) ? out[name][bucket] : null)) ngProgressPut(out[name], bucket, {});
  ngProgressPut(out[name][bucket], item, row);
}
const ngProgressSameRow = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
// THE REPLAY, pure. `entries` (journal order) meet `other`'s rows; `target` is the blob being built (a merge's result).
// For each card the entries touch and `other` holds: the entries up to the last one whose `after` IS other's row are
// in other's copy (`inCopy`, never `held`: a name the reader's build mangles); of the rest, those made before other's
// row's `last` are `older` (the merge's rule decides them, NEXT2-R1) and the others are applied again to other's row with
// `write` (the schedule writer; a moves row carries its answer and its tail as `_gradeMove` writes it), the card's row in
// `target` becoming the result. Returns {blob, inCopy, older, rebuilt: id -> the row it now leaves, was: card -> the rows
// those entries left before (the one-day rows a stale copy may still present)}. Inputs untouched; the caller decides what
// "in copy" means: delivered when `other` is the cloud's, nothing more for another tab's.
export function ngProgressReplay(target, other, entries, write, today) {
  const out = ngProgressClone(target), inCopy = [], older = [], rebuilt = new Map(), was = new Map(), byCard = new Map();
  for (const e of entries || []) {
    const k = ngProgressJournalCard(e);
    (byCard.get(k) || byCard.set(k, []).get(k)).push(e);
  }
  for (const [card, list] of byCard) {
    const [, field, bucket, item] = list[0], base = ngProgressJournalRow(other, field, bucket, item, today);
    if (!base) continue;
    let at = -1;
    for (let i = 0; i < list.length; i++) if (ngProgressSameRow(base, list[i][6])) at = i;
    for (let i = 0; i <= at; i++) inCopy.push(list[i][0]);
    let row = base, any = false, allRight = true, setAside = false, last = null;
    const before = [];
    for (let i = at + 1; i < list.length; i++) {
      const e = list[i];
      if (e[5] < base[2]) { older.push(e[0]); setAside = true; continue; }
      row = write(row, e[4] === 1, e[5], field ? 4 : 3);   // the whole row, its pair read and written by the writer (v1.281.0)
      rebuilt.set(e[0], row); before.push(e[6]); last = e[0];
      if (e[4] !== 1) allRight = false;
      any = true;
    }
    if (!any) continue;
    // NEXT2-R2 (the reader's D1): when every entry replayed is a RIGHT answer and some of this copy's earlier answers of the
    // card were set aside by the day rule, the card keeps the later-due of the replay's row and the merge's: the answers
    // set aside earned an interval the replay no longer sees (a right answer replayed onto another copy's answer of the
    // same day earns nothing), and the merge (its heal) holds it. The blind one-day row the journal exists for is always the
    // shorter, so the replay still wins there; a miss among them keeps the replay's row. When nothing was set aside the
    // replay holds every answer of this copy, in order, and is kept: there the merge's row is this copy's answer on the old
    // row, and preferring it erased another device's miss in between (88 of 168,912 three-device runs measured).
    const merged = ngProgressJournalRaw(target, field, bucket, item);
    if (allRight && setAside && merged && merged.length >= (field ? 4 : 3) && merged[0] > row[0]) { rebuilt.set(last, ngProgressClone(merged)); continue; }
    for (const r of before) (was.get(card) || was.set(card, []).get(card)).push(r);
    ngProgressJournalSet(out, field, bucket, item, row);
  }
  return { blob: out, inCopy, older, rebuilt, was };
}
// the journal after a replay: entries in the other copy, and (`drop`, the cloud's) those it superseded, gone; rebuilt
// entries carrying the row they now leave
export function ngProgressJournalAfter(journal, replay, drop) {
  const gone = new Set(drop ? replay.inCopy.concat(replay.older) : []);
  const e = journal.e.filter(x => !gone.has(x[0])).map(x => replay.rebuilt.has(x[0]) ? x.slice(0, 6).concat([replay.rebuilt.get(x[0])], x.slice(7)) : x);
  return { ...journal, e };
}
// GUEST PRACTICE JOINS THE ACCOUNT AT SIGN-IN (v1.262.0, the owner, 11 Nov, U138 a "Always automatic"). Until v1.261.x
// a guest copy reached an account only through the menu's "Review guest progress" and its dialog, which every
// signed-in player saw for good (the sign-in itself writes a guest copy, and Import kept it). Now `joinGuest` adds the
// browser's guest practice to the account at its first verified mount, once per guest copy and account (the `guest`
// mark), with one line. The guest copy stays byte for byte: signing out still plays it. ON A SHARED BROWSER whoever
// signs in next receives what was practised signed out there, a second account too: the owner's pick, knowing that.
// The rule (`ngProgressGuestMerge`) is the cloud pull's own merge (`_mergeProgressBlobs`: MAX, union, add-wins) with two
// changes that make it ONLY ADD (his standing rule: no account loses a %, a boost, gold or a belt):
//   1. the guest's settings never move, its modifiers apart (4) (`settings`, `settingsAt`, `updatedAt` are dropped; `openAt`, the open rule's
//      stamp, is left out of the part's hash and practice key but joins the merge as the earlier stamp, see
//      `ngProgressGuestPart`), as the old Import did:
//      the account's email consent, ruleset and goal stay the account's;
//   2. a guest's No never takes an account's Yes (`ngProgressGuestMoves`). The pull's `moves` order lets the later
//      answer win, so a guest's later "Still got it? No" took the account's gold, its +15 and a "Moves known" point
//      through the old Import (U125 b's rule, right inside one account and across its devices, where it still holds).
//      The account's own row is kept. It is the cloud's row ONLY because the join runs after a successful pull
//      (`joinGuest`'s `not-pulled` refusal, `_pullAndMerge`): `live` then holds the cloud's rows, so the next pull,
//      on this device or another, cannot undo it (ORDER1, tests/guest_join_safety.test.mjs 11).
//   3. the guest's roll ledger never evicts one of the account's and is never counted twice (`ngProgressGuestFlow`):
//      the ledger then kept the 6 newest device partitions (NG_FLOW_CAP, 32 since v1.262.11), so a guest partition added
//      to an account already at the cap pushed its oldest out (the second reader: 60 rolls became 51). The guest's partition joins as itself while there is
//      room or while the account already holds it; at the cap it is not joined (its rolls stay in the guest copy).
//   4. the guest's modifiers, "Your odds" (v1.301.0, MODS1), are the one setting that moves, and only into a technique the
//      account has no key for, live or removed: the account wins on a clash (`ngProgressGuestMerge`; the part keeps the
//      guest's live keys, `ngProgressGuestPart`); and only while the account holds fewer than NG_MOD_CAP keys (MODS1-R1). They are not practice: a copy holding only modifiers joins them and says
//      nothing (`joinGuest`'s `quiet`, ruling 2 a). tests/guest_join_safety.test.mjs M1 to M5.
// Every other field of that merge already only adds (prep/rec/stage/days MAX, belts.held MAX and won union,
// badges/coins/explored/tut union, challenges MAX progress, lists add-wins). Units, `belts.won` records, `dayLog.w` and
// fields from later builds keep the account's value where it has one: the account's value AFTER the first pull, i.e.
// the cloud's too, because the join runs only then (the second reader: "holds only against the local copy" was true of
// the first build). `srs` keeps the pull's rule, except for the cards the guest answered since v1.280.2: those are rebuilt
// on the account's rows from the guest's journal (`joinGuest`, `ngProgressReplay`), so a guest's first right answer no
// longer turns the account's mature card into one day, and a guest's miss still brings it back. The rating reads the
// schedule's interval since v1.279.0, so a shortened row cost a player rating. tests/guest_join_safety.test.mjs,
// tests/answers_before_sync.test.mjs.
// ═══ THE PLAYER'S MODIFIERS, "Your odds" (v1.301.0, MODS1: the owner's U212 a "Save them"; the orchestrator's MODS1-GO) ═══
// A modifier replaces one move's chance (`ngKnowledgeOverride`, matched by the move's exact title). Until v1.301.0 the list
// lived in memory only and was gone after a reload. It is stored as SETTINGS, one key per technique, each stamped in
// `settingsAt` at the press:
//   settings["mod:" + name] = [pct, on, cat, born]   live: pct 0..100, on 1|0, cat "S"|"T"|"P", born = when first added (ms)
//   settings["mod:" + name] = 0                       removed
// WHY SETTINGS AND NOT A NEW TOP-LEVEL KEY (MODS1 Part A, proved on production's own source, v1.298.0 and v1.294.0): the
// settings merge is per key, the later stamp winning (`_mergeProgressFields`), in every build since before v1.252.0, so "the
// later press on a technique wins, per technique" needs no new merge, and a removal is a later press of its own key (the
// stamped 0), which no device still holding the old value can bring back. An older build keeps the keys through its load and
// save and TAKES a newer one at a pull. Given a top-level key instead it keeps its own first copy for good (`_progressExtras`
// merges local-wins) and pushes it back on every pull: the loop PR #452 had to back off from (`_onlyListFieldsBehind`).
// A KEY IS NEVER DELETED (CLAUDE.md §6.6: the settings merge has no tombstone, so a deleted key comes back from the next pull;
// the 0 IS the tombstone). tests/mods_sync.test.mjs; tests/artifacts/_old_settings_carry.mjs runs the older builds' classes.
// THE BOUND: a name of at most NG_MOD_NAME_MAX characters, and at most NG_MOD_CAP keys, live and removed together. A NEW name
// past it is refused at Add, for good on that account (no slot ever frees: a key is never deleted), and the line says so;
// a removed name comes back under its own key, so it always can. Two devices adding at once can
// merge past the cap, and nothing is trimmed then (a trim is a delete). THE READ NEVER THROWS: a value that is not a live row
// reads as removed, a name that breaks the bound is skipped; both are counted (`bad`), so a damaged key never stops a load.
// The order is `born`, then the name (a strict total order, its last key content: every device shows one order, and a press
// on − or + never moves a row, because it keeps `born`).
export const NG_MOD_PREFIX = "mod:";
export const NG_MOD_CAP = 200;
export const NG_MOD_NAME_MAX = 80;
const NG_MOD_CATS = Object.freeze({ S: "Submission", T: "Transition", P: "Position" });
export function ngModLive(v) { return Array.isArray(v) && typeof v[0] === "number" && Number.isFinite(v[0]); }
export function ngModsRead(settings) {
  const mods = [];
  let keys = 0, bad = 0;
  if (!ngProgressObject(settings)) return { mods, keys, bad };
  for (const k of Object.keys(settings)) {
    if (!k.startsWith(NG_MOD_PREFIX)) continue;
    keys++;
    const name = k.slice(NG_MOD_PREFIX.length), v = settings[k];
    if (!name || name.length > NG_MOD_NAME_MAX) { bad++; continue; }
    if (!ngModLive(v)) { if (v !== 0) bad++; continue; }
    mods.push({ name, cat: NG_MOD_CATS[v[2]] || "Transition", pct: Math.max(0, Math.min(100, Math.round(v[0]))), on: v[1] === 1,
      born: Number.isSafeInteger(v[3]) && v[3] > 0 ? v[3] : 0 });
  }
  mods.sort((a, b) => a.born - b.born || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { mods, keys, bad };
}
// AN EQUAL STAMP ON A `mod:` KEY (v1.301.0, MODS1-R1, the sync reader's F2): REACHABLE. A press stamps one past the newest
// stamp its device holds (`ngModStamp`), so two devices whose clocks are behind that stamp both write `held + 1` (the reader:
// one device an hour ahead presses, two on-time devices pull it and press four minutes apart, and end at 65% and 55% for
// good). The settings merge keeps the local value on a tie, so they never agreed. For these keys only, a tie is decided the
// same way on every device: a removal (0) wins, and between two live values the smaller JSON string. Every other setting
// keeps today's rule. Does the cloud's value take the local one's place on that tie?
export function ngModTieTakes(local, cloud) {
  const rank = (v) => (v === 0 ? "0" : "1" + JSON.stringify(v));
  return rank(cloud) < rank(local);
}
// a press's stamp: later than any this device holds for that key, one from a clock that runs ahead included (else the press
// would lose to it at the next merge, as a list move once did: tests/list_moves_sync.test.mjs 18); a damaged stamp (not a
// positive safe integer below 2^52, PR #452's F5) is not built on
export function ngModStamp(held, now) {
  const ok = Number.isSafeInteger(held) && held > 0 && held < 2 ** 52;
  return Math.max(Math.floor(now), ok ? held + 1 : 0);
}
// THE OPEN RULE'S TWO VALUES (v1.270.0, U163 c; the app's `_syncBelt`, `_recallCarryLive`; read by nothing since v1.282.0). `openAt`, when the open rule
// first ran for an owner, is left out of the guest PART, so it is neither in the copy's hash nor in the practice key (a
// bare landing writes one: tests/guest_join_safety.test.mjs 20). It joins the MERGE all the same (`ngProgressGuestMerge`
// puts it back on the part it merges): the EARLIER of the two stamps, so a guest's belt earned under the guest's own rule
// is judged against a stamp no later than the guest's and is not carried (the read of PR #404's delta, D1: OPEN2B had
// dropped it, and a guest who earned blue under the rule got timed recall switched on at sign-in). The account's own
// carry is frozen before the join (`_joinGuestPractice`), so the earlier stamp cannot un-carry the account's own pre-rule
// belt. `recallCarry` (only ever `true`: a belt held before the rule kept timed recall) joins as an OR with the belt it
// came from (MAX): the join only adds. Tests 20, 21 and R1, R1b, R3.
// THE GUEST'S MODIFIERS (v1.301.0, MODS1; NG_MOD_PREFIX above) are the one kind of setting the part keeps: its LIVE `mod:` keys
// and their stamps, never a removed one (a guest's removal has nothing to take from an account: the join only adds). So they
// enter the copy's hash (a modifier set after a join is new) and the merge. A copy with none keeps no `settings` at all, so
// every guest copy saved before v1.301.0 hashes exactly as it did, and no "seen" mark changes. What the merge does with them
// (the account wins on a clash) is `ngProgressGuestMerge`'s; they are not practice (`ngProgressPracticeKey`).
function ngProgressGuestPart(blob) {
  const out = ngProgressClone(blob);
  const settings = ngProgressObject(out.settings) ? out.settings : {}, at = ngProgressObject(out.settingsAt) ? out.settingsAt : {};
  const mods = Object.keys(settings).filter((k) => k.startsWith(NG_MOD_PREFIX) && ngModLive(settings[k]));
  delete out.settings; delete out.settingsAt; delete out.updatedAt; delete out.openAt;
  // THE CARRY'S DONE MARKER (CARD1-S3, `cardCarry`, below at NG_CARRY_BEFORE) is the copy's own, never the account's: a
  // guest's carried rows join as grades, and the account carries its own rows (joined, its marker would tell a fresh browser
  // that the account's older rows were carried when no device of the account ever did). So it is not practice either.
  delete out.cardCarry;
  if (mods.length) {
    out.settings = {}; out.settingsAt = {};
    for (const k of mods) { out.settings[k] = settings[k]; if (typeof at[k] === "number" && Number.isFinite(at[k]) && at[k] >= 0) out.settingsAt[k] = at[k]; }
  }
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
// DERIVED VALUES ARE NEVER PRACTICE (v1.270.0): the open rule's `openAt` (stamped on every owner's first sync, so a bare
// landing writes it; the guest part drops it) and `recallCarry` (derived from `belts.held`, which counts on its own).
// v1.270.0's first build missed `openAt` here, and a guest who only looked was told their practice was saved (PR #404's
// CI, guest-join.spec.ts): this list is hand-maintained (CLAUDE.md §6.7), so tests/guest_join_safety.test.mjs 20 builds
// a bare landing's blob through the app's own save, and the next key a bare landing writes fails there.
// THE HELD LEVEL `belts.lvl` (v1.276.0) is derived too: seeded on every owner's first belt sync (a bare landing writes
// it, at level 0) and raised from the Path and the number, both of which count on their own. Dropped here; the test
// above (20) builds the bare landing through the app's own save, and a unit pins that it holds the value.
export const NG_PROGRESS_TRAIL_CHALLENGES = Object.freeze(["white.coach1", "white.coach2", "white.coach3"]);
// `explored` as the record holds it: the seats you landed on, by their deck key.
// THE INVARIANT (L1-R3): `explored` holds unique strings, each a place's key, and nothing else, for good. A build that needs more stores it
// under a new key: every validator shipped before v1.290.0 refuses anything else here, so a non-string kept in this list
// locks older devices out of their own record.
// So a copy is READ here and nowhere else: its places are its non-empty strings, each once, in their order (`keys`); an
// entry that is not a string is counted (`bad`: Master the game says them with the places that no longer resolve) and an
// empty string is dropped without a count (it was never a place). The save writes `keys` (app.src.jsx, `_progressBlob`),
// a merge is the union of two copies' keys (`_mergeProgressFields`), so two devices settle on one list.
// HISTORY, so nobody tries it again: L1-R2 kept and wrote back the entries it did not read ("a build never removes what it
// does not understand"). Measured by the third read of PR #434: every record saved that way was refused by every older
// build's validator (6 of 6: "pull-failed", and that device could push nothing), a guest carried the damage into the
// account at the join, and two devices holding a repeated entry pushed for ever (8 pushes in 8 idle pulls).
export function ngProgressExploredKeys(list) {
  const keys = new Set();
  let bad = 0;
  for (const k of Array.isArray(list) ? list : []) { if (typeof k !== "string") bad++; else if (k) keys.add(k); }
  return { keys: [...keys], bad };
}
export function ngProgressPracticeKey(blob) {
  const b = ngProgressGuestPart(blob);
  // CARD1-S0-R1 (v1.301.5): the marker of grades gone is this browser's, never in a record (`goneRead` below). A record that
  // already carries a synced `stageGone` (the preview's, written by this PR's first CI builds; none in production) is not
  // practice: the key ignores it, and nothing deletes it (it rides `_progressExtras` like any field a build does not know).
  delete b.stageGone;
  // the modifiers (v1.301.0, MODS1) are odds a player SET, not practice: they join (`joinGuest` counts them apart, as
  // `ngProgressModsKey`), but alone they never say "Your practice from before you signed in is saved" (ruling 2 a)
  delete b.settings; delete b.settingsAt;
  delete b.explored; delete b.tut; delete b.recallCarry;
  if (ngProgressObject(b.belts)) { delete b.belts.gf; delete b.belts.lvl; }
  if (ngProgressObject(b.challenges)) for (const id of NG_PROGRESS_TRAIL_CHALLENGES) delete b.challenges[id];
  return ngProgressCloudKey(b);
}
// ═══ THE ONE-TIME CARRY (CARD1-S3, v1.304.0; the owner's U220 a, the orchestrator's CARD1-S3-GO) ══════════════════════
// v1.182.2 (90ceb6207) rewrote about half the corpus's questions; it reached the dev preview on 10 Sept 2026 and production
// on 15 Sept (v1.182.13, main 7494c317c). A card's progress was keyed by its question's hash, so a player's grade (`stage`)
// and schedule (`srs`) on a reworded card stayed under the OLD key, which no deck holds since (DUE1). The carry gives them
// back ONCE, additively, to the card's key today: per (deck, old key -> new key) pair of the build's carry chunks (scripts/
// regenerate_neural_data.py `write_card_carry`, from the committed neural/card-carry.json),
//     srs[deck][new]   = ngKnowledgeMergeRow(srs[deck][new], srs[deck][old], today)   the later answer wins, as at a pull
//     stage[deck][new] = max(stage[deck][new], stage[deck][old])
// and NOTHING is deleted: the old rows stay (hidden as today: no deck holds their key). A player who already answered the new
// text keeps the later row. A second run changes nothing, byte for byte. The app drives it (`_carryMaybe`, app.src.jsx):
//   · WHO FETCHES (the orchestrator's ruling 1 on CARD1-S3 Part A): only a record that may hold an old key, known from its
//     own dates (`ngCarryDecks`): a schedule row last answered before NG_CARRY_BEFORE (15 Oct 2026: production's release
//     plus a month for stale tabs and cached chunks), or a grade with no schedule row (a record from before v1.105.0
//     wrote none). It is a SUPERSET of the records that hold one: no fetch to decide, no live set, no eager byte. A record
//     begun after the rewrite never fetches; one from before it with nothing reworded fetches once, carries nothing, and is
//     marked done. Only the files its candidate decks fall in are asked for (`ngCarryFiles`).
//   · WHEN, DECIDED BY CONTENT ON THIS BROWSER (CARD1-S3-R1, the sync reader of PR #471, F1): per owner, this browser keeps
//     `{n, pending, tries}` (`<owner>:carry`, host `carryRead`/`carryWrite`, never in the record): `n` the record's
//     `ngCarryCount` at this browser's last SUCCESSFUL step, `pending` a need it has not met yet. It carries when `pending`, or
//     when the record now holds MORE September rows than `n` (they came in since: a pull, another tab, a guest joined); a pull
//     that grows the count sets `pending` at once (so answers given in the same session cannot cancel it out); a record holding
//     FEWER (rows answered since) brings `n` down to it. A need is kept until a step succeeds, across failures and reboots. A
//     browser with no state starts at n = 0, so every browser of an account from before the rewrite fetches ONCE (at most the
//     files its decks fall in): the synced marker is never what decides, because an older build's device keeps it whether or
//     not THIS browser carried (the reader's traces, seeds 26 and 75: tests/card_carry.test.mjs 15 and 16).
//   · THE BOUND (F2): NG_CARRY_TRIES answers FROM THE SERVER that were not a carry (a 404, a file not the one asked for, a
//     malformed one), per owner, cleared by a success; one attempt a boot. A network failure (the fetch rejected, or the
//     browser offline) is not a try. A fetch, a file or a storage that fails leaves the record exactly as it was.
//   · THE DONE MARKER, `cardCarry: 1`, a top-level field. IT IS A CONSTANT, ON PURPOSE, AND FROZEN: an older build keeps a
//     top-level field it does not know through `_progressExtras` LOCAL-WINS and pushes its own copy back at every pull (the
//     loop PR #452 backed off from; MODS1 Part A, above at NG_MOD_PREFIX), so a marker two devices could write differently
//     (a day, a list, the carry's id) could ping-pong between an older device and a newer one for good. One value can
//     never differ. A later carry, if ever, takes a key of its own. Merged as an OR; dropped from the guest part (above).
//   · ALL AT ONCE (the owner's U222 a, 25 Nov 2026): a carried row is owed by its own schedule from the moment it lands, like
//     any row, so a returning player's due count rises by every carried row already due (most of them: the old ladder's
//     steps up to 60 days have all elapsed since September). Nothing paces them, and the marker holds nothing for it.
//     tests/card_carry.test.mjs.
export const NG_CARRY_BEFORE = 20741;          // epoch day of 2026-10-15
export const NG_CARRY_TRIES = 10;
export const NG_CARRY_MAX_FILES = 64;          // what the emitter can write (write_card_carry); a claim of more is refused
export const NG_CARRY_DONE = 1;
// the decks of a record that may hold a key the rewrite orphaned (a Set; empty: nothing to fetch)
export function ngCarryDecks(blob, before = NG_CARRY_BEFORE) {
  const out = new Set();
  if (!ngProgressObject(blob)) return out;
  const srs = ngProgressObject(blob.srs) ? blob.srs : {}, stage = ngProgressObject(blob.stage) ? blob.stage : {};
  for (const dk of Object.keys(srs)) {
    const m = srs[dk];
    if (!ngProgressObject(m)) continue;
    for (const q of Object.keys(m)) { const r = m[q]; if (Array.isArray(r) && typeof r[2] === "number" && r[2] < before) { out.add(dk); break; } }
  }
  for (const dk of Object.keys(stage)) {
    const s = stage[dk], m = ngProgressObject(srs[dk]) ? srs[dk] : {};
    if (!ngProgressObject(s)) continue;
    for (const q of Object.keys(s)) if (s[q] > 0 && !Object.prototype.hasOwnProperty.call(m, q)) { out.add(dk); break; }
  }
  return out;
}
// how many rows of a record may hold a key the rewrite orphaned (the same test, counted): a pull that makes this GROW brought
// in rows another copy kept to itself since September (an older build's device that synced late): carried then, too (the
// app's `_pullAndMerge`)
export function ngCarryCount(blob, before = NG_CARRY_BEFORE) {
  if (!ngProgressObject(blob)) return 0;
  const srs = ngProgressObject(blob.srs) ? blob.srs : {}, stage = ngProgressObject(blob.stage) ? blob.stage : {};
  let n = 0;
  for (const dk of Object.keys(srs)) { const m = srs[dk]; if (ngProgressObject(m)) for (const q of Object.keys(m)) { const r = m[q]; if (Array.isArray(r) && typeof r[2] === "number" && r[2] < before) n++; } }
  for (const dk of Object.keys(stage)) {
    const s = stage[dk], m = ngProgressObject(srs[dk]) ? srs[dk] : {};
    if (ngProgressObject(s)) for (const q of Object.keys(s)) if (s[q] > 0 && !Object.prototype.hasOwnProperty.call(m, q)) n++;
  }
  return n;
}
// the carry files those decks fall in: a deck is in file int(fnv1a32(deck key), 16) % n (`hash` is the app's qhash)
export function ngCarryFiles(decks, n, hash) {
  if (!Number.isInteger(n) || n < 1 || n > NG_CARRY_MAX_FILES) return [];
  const out = new Set();
  for (const dk of decks) out.add(parseInt(hash(dk), 16) % n);
  return [...out].sort((a, b) => a - b);
}
// one carry file, read only if it is the one asked for (its own id, n and i), every deck in its own file, every pair 16 hex:
// Map(deck hash -> [[old, new], …]), or null (the whole attempt then fails and nothing is applied)
export function ngCarryRead(body, want) {
  if (!ngProgressObject(body) || !want || body.v !== 1 || body.id !== want.id || body.n !== want.n || body.i !== want.i || !ngProgressObject(body.d)) return null;
  const out = new Map();
  for (const h of Object.keys(body.d)) {
    const s = body.d[h];
    if (!/^[0-9a-f]{8}$/.test(h) || parseInt(h, 16) % want.n !== want.i) return null;
    if (typeof s !== "string" || !s.length || s.length % 16 || !/^[0-9a-f]+$/.test(s)) return null;
    const pairs = [];
    for (let i = 0; i < s.length; i += 16) pairs.push([s.slice(i, i + 8), s.slice(i + 8, i + 16)]);
    out.set(h, pairs);
  }
  return out;
}
// THE STEP, pure: {stage, srs} in, {stage, srs, carried, rows} out (new objects for every deck it touched, the input
// untouched). `carried`: every [deck, new key, moved, old key] whose old key held a row; `rows`: the targets that changed. `mergeRow`
// is the knowledge law's ngKnowledgeMergeRow(local, cloud, today), the pull's own row merge.
export function ngCarryApply(rec, pairs, hash, today, mergeRow) {
  const srs = Object.assign({}, (rec && rec.srs) || {}), stage = Object.assign({}, (rec && rec.stage) || {});
  const carried = [];
  let rows = 0;
  for (const dk of [...new Set([...Object.keys(srs), ...Object.keys(stage)])].sort()) {
    const P = pairs.get(hash(dk));
    if (!P) continue;
    for (const [old, nu] of P) {
      if (old === nu) continue;
      const so = ngProgressObject(srs[dk]) ? srs[dk][old] : undefined, st = ngProgressObject(stage[dk]) ? stage[dk][old] : undefined;
      const hasRow = Array.isArray(so), hasStage = typeof st === "number" && st > 0;
      if (!hasRow && !hasStage) continue;
      let moved = false;
      if (hasRow) {
        const cur = Array.isArray(srs[dk][nu]) ? srs[dk][nu] : null, m = mergeRow(cur, so, today);
        if (!cur || JSON.stringify(cur) !== JSON.stringify(m)) { srs[dk] = Object.assign({}, srs[dk], { [nu]: m }); moved = true; }
      }
      if (hasStage && !((ngProgressObject(stage[dk]) ? stage[dk][nu] || 0 : 0) >= st)) {
        stage[dk] = Object.assign({}, stage[dk], { [nu]: st }); moved = true;
      }
      carried.push([dk, nu, moved, old]);
      if (moved) rows++;
    }
  }
  return { srs, stage, carried, rows };
}
export function ngCarryDone(v) { return v === NG_CARRY_DONE; }
// this browser's carry state for an owner, read leniently: {n: September rows at the last successful step, pending, tries}
export function ngCarryStateRead(v) {
  const o = ngProgressObject(v) ? v : {}, int = (x) => (Number.isSafeInteger(x) && x >= 0 ? x : 0);
  return { n: int(o.n), pending: o.pending === true, tries: Math.min(int(o.tries), NG_CARRY_TRIES) };
}
// what a copy holds of the modifiers, for "did the join add any?": every `mod:` key, its value and its stamp
export function ngProgressModsKey(blob) {
  const s = ngProgressObject(blob) && ngProgressObject(blob.settings) ? blob.settings : {};
  const at = ngProgressObject(blob) && ngProgressObject(blob.settingsAt) ? blob.settingsAt : {};
  const keys = Object.keys(s).filter((k) => k.startsWith(NG_MOD_PREFIX)).sort();
  return JSON.stringify(keys.map((k) => [k, s[k], at[k] == null ? null : at[k]]));
}
// ═══ THE ROLL LEDGER'S PARTITIONS: the window, the cap and the trim (v1.262.11, FLOW1 + FLOW2) ═══════════════════════
// `flow[code][state][move] = [tries, worked, lastDay]`: a G-counter, one partition per writer, MAX per partition on
// merge, read as the sum. Since v1.262.11 a writer is (browser, owner) and its code is `b` + 16 hex, kept in that
// browser (the host's `flowDevice` below); before, every browser of an account shared the synced setting's code. The
// app's `_trimFlow`, its read (`flowCounts`) and the guest join's room count (`ngProgressGuestFlow`) all go through
// these, so the three agree by construction. tests/flow_device_per_browser.test.mjs.
//
// THE CAP COUNTS ONLY PARTITIONS MINTED SINCE v1.262.11 (M2, the second reader of PR #384). Every other id is from before:
// the account's shared partition (the old setting's code), a guest copy's old code, a code an older build minted in a
// tab not yet reloaded. Those are frozen and few, and the shared one holds the account's whole history to that day, so
// they are never evicted and take no slot. Counted like the others, the shared partition was the FIRST one any eviction
// removed: once frozen it is the least recently touched (the reader's S1b: 125 rolls read 30 at a sixth private session).
export const NG_FLOW_CAP = 32;   // the app's NG_FLOW_DEVICES; one source. Was 6 (owner's orchestrator, FLOW2: at 6 a player
// whose browser loses its storage weekly, as Safari's seven-day cap does to a site not visited, lost rolls within two
// months). Worst case, a partition holds every state-move cell: 2,417 at v1.262.11, 62 KB at three-digit tallies (67 KB
// at four), so 32 of them about 2.0 MB in the synced row and in each owner's local copy, plus the few uncapped ones. A
// storage lifetime's real partition is a handful of cells, about 100 B.
// KNOWN, NOT RAMPED (the reader's A6, FLOW3): a tab opened before v1.262.11 and never reloaded still runs the old trim, six
// partitions over all ids, by each row's own day. Any ledger it pulls it trims to its six newest, the shared partition
// first, and pushes that. It is permanent only for an account with more than six partitions whose other browsers all
// lose their storage (private windows, cleared data); a lasting browser on this build still holds every partition and
// puts them back at its next sync. Never above the truth. A ramp (the slotted cap held at 6 less the old ids until a
// date) would avoid it only by making every player who churns storage lose post-change sessions meanwhile: a certain
// loss traded for this narrow one, so the cap is 32 from the start (the orchestrator's call, on the reader's numbers).
// A LATER ID FORMAT MUST BE ADDED HERE, or its partitions read as pre-v1.262.11 ones: never evicted, taking no slot.
export function ngFlowCapped(id) { return /^b[0-9a-f]{16}$/.test(id); }
// THE WINDOW IS THE CELL'S, NOT THE ROW'S (M1). A (state, move) counts, in every partition, while ANY partition rolled it
// within the window: the old single partition's rule, where each roll refreshed the cell's one row. By its own row's
// day alone, a frozen partition's tally on a move still rolled every day expired 180 days after the switch (the
// reader's S2: 456 rolls read 356 at day +178).
function ngFlowCellKey(pk, ord) { return pk + "\u0000" + ord; }
export function ngFlowCellNewest(flow) {
  const out = new Map();
  for (const D of Object.values(ngProgressObject(flow) ? flow : {})) for (const pk of Object.keys(ngProgressObject(D) ? D : {})) {
    const P = D[pk];
    for (const ord of Object.keys(ngProgressObject(P) ? P : {})) {
      const k = ngFlowCellKey(pk, ord), d = (Array.isArray(P[ord]) && P[ord][2]) || 0;
      if (!(out.get(k) >= d)) out.set(k, d);
    }
  }
  return out;
}
// The read's view: every row carries its CELL's newest day, so the summing law's own per-row window (knowledge-profile
// `ngKnowledgeFlowCounts`, whose bytes are a pinned law: mdp-exposure) is exactly the cell window. Never stored.
export function ngFlowWindowView(flow) {
  const cell = ngFlowCellNewest(flow), out = {};
  for (const dev of Object.keys(ngProgressObject(flow) ? flow : {})) {
    const D = flow[dev], V = (out[dev] = {});
    for (const pk of Object.keys(ngProgressObject(D) ? D : {})) {
      const P = D[pk], W = (V[pk] = {});
      for (const ord of Object.keys(ngProgressObject(P) ? P : {})) { const r = P[ord]; W[ord] = [r[0], r[1], cell.get(ngFlowCellKey(pk, ord))]; }
    }
  }
  return out;
}
// The partitions that take a slot: minted since v1.262.11 and not empty. The trim keeps `cap` of them; the guest join's
// room is `cap` less their count. One definition, so the two can never disagree.
export function ngFlowSlotted(flow) {
  return Object.keys(ngProgressObject(flow) ? flow : {}).filter(dev => ngFlowCapped(dev) && ngProgressObject(flow[dev]) && Object.keys(flow[dev]).length > 0);
}
// THE TRIM, in place; answers how many rows and partitions it dropped (the app's `flow_trimmed` beat). In order:
//   1. a row goes when its CELL was rolled by no partition within the window (M1);
//   2. a partition left empty goes, and takes no slot (F2; empty shells used to count toward the cap and the join's room);
//   3. of the slotted partitions, the `cap` with the newest row stay; ties go by id, so every device evicts the SAME one
//      (F1: by key order alone, two devices holding one ledger in two key orders kept different sets, the reader's S5);
//   4. a pre-v1.262.11 partition is never evicted (M2, above).
// What eviction still costs (stated, not fixed here): a device whose copy predates an eviction brings the partition back
// by MAX, so after one the read depends on the order of syncs, though never above the truth (the reader's S4); and the
// beat stays in the page, no eviction reaches analytics (F7).
export function ngFlowTrim(flow, day, windowDays, cap = NG_FLOW_CAP) {
  if (!ngProgressObject(flow)) return 0;
  const cut = day - windowDays, cell = ngFlowCellNewest(flow), newest = new Map();
  let dropped = 0;
  for (const dev of Object.keys(flow)) {
    const D = flow[dev];
    if (!ngProgressObject(D)) continue;
    let top = 0;
    for (const pk of Object.keys(D)) {
      const P = D[pk];
      if (!ngProgressObject(P)) continue;
      for (const ord of Object.keys(P)) {
        if ((cell.get(ngFlowCellKey(pk, ord)) || 0) < cut) { delete P[ord]; dropped++; continue; }
        if ((P[ord][2] || 0) > top) top = P[ord][2];
      }
      if (!Object.keys(P).length) delete D[pk];
    }
    if (!Object.keys(D).length) { delete flow[dev]; continue; }
    newest.set(dev, top);
  }
  const ranked = ngFlowSlotted(flow).sort((a, b) => newest.get(b) - newest.get(a) || (a < b ? -1 : a > b ? 1 : 0));
  for (const dev of ranked.slice(Math.max(0, cap))) { delete flow[dev]; dropped++; }
  return dropped;
}
// Rule 3, the roll ledger (FOLD2, the second reader's re-check, 12 Nov). `cap` is NG_FLOW_CAP, the app's NG_FLOW_DEVICES
// (one source since v1.262.11). A guest partition joins AS ITSELF, under its own device id, which never changes:
//   - the account already holds it (an earlier join, the mark lost, or the guest copy changed): it merges with itself
//     by MAX per cell, so a re-join can never count a roll twice;
//   - the account has room (fewer than `cap` partitions): it is added, and the ledger sums it exactly at read;
//   - the account is at the cap: it is NOT joined. Its rolls stay in the guest copy and the account does not count
//     them: an undercount, which the owner's orchestrator accepted; a double count is not acceptable.
// No memory, no choice that can drift. The first build of the fix folded the guest's rows into "the account's newest
// partition", chosen again at every join; when another device became the newest between two joins of one guest copy,
// the same rolls landed in a second partition and were summed twice (6 real rolls read 11, 5 read 10, and the line was
// said again: tests/guest_join_safety.test.mjs 19). Known and kept (the reader's N2): a guest partition added below
// the cap takes one of the slots, so a later new device of the account evicts one of the account's partitions one
// device sooner than it would have; that is the ledger's own cap rule (`ngFlowTrim`), reached one partition earlier.
// THE ROOM IS THE TRIM'S (v1.262.11, M2): `cap` less the account's SLOTTED partitions (`ngFlowSlotted`: minted since
// v1.262.11, not empty), the very set `ngFlowTrim` keeps `cap` of, so a join can never add what the next trim evicts.
// A guest partition from before v1.262.11 (an old guest code) joins outside the cap, as the trim keeps it outside: at
// the switch each browser's guest mints a new code too, so a guest who plays again afterwards brings TWO partitions to
// its next join, the old one (frozen, no slot) and the new one (a slot).
// KNOWN (the reader's A1, FLOW3): the join reads the guest copy as stored, untrimmed. A copy not loaded for over 180 days
// can hold rows past the window, and the cell window keeps them counting when the account rolled that move recently:
// real rolls, never above the truth, the same rule the shared partition gets. Trimming the guest part first would need
// the day and the window here, which the join's callers (the legacy import's included) do not carry.
export function ngProgressGuestFlow(account, guest, cap = NG_FLOW_CAP) {
  const acct = ngProgressObject(account) ? account : {}, out = {}, g = ngProgressObject(guest) ? guest : {};
  let room = cap - ngFlowSlotted(acct).length;
  // FLOW3 (the reader's A4b): the room goes to the partition rolled most recently first, ties by id, the order
  // `ngFlowTrim` keeps partitions in. By id alone a partition whose rows had all expired could take the last slot, be
  // trimmed away at once, and leave a partition still rolled outside (its rolls stayed in the guest copy).
  const top = new Map(Object.keys(g).map(dev => [dev, Math.max(0, ...ngFlowCellNewest({ [dev]: g[dev] }).values())]));
  for (const dev of Object.keys(g).sort((a, b) => top.get(b) - top.get(a) || (a < b ? -1 : a > b ? 1 : 0))) {
    const G = guest[dev];
    if (!ngProgressObject(G) || !Object.keys(G).length) continue;
    if (dev in acct || !ngFlowCapped(dev)) { out[dev] = ngProgressClone(G); continue; }
    if (room > 0) { room--; out[dev] = ngProgressClone(G); }
  }
  return out;
}
// THE RULE, in one place: what a guest copy adds to an account. `merge` is the app's `_mergeProgressBlobs`; `flowCap` its
// NG_FLOW_DEVICES. The explicit legacy import (`confirmImport`) goes through this too, so the two cannot differ.
export function ngProgressGuestMerge(merge, live, guestBlob, flowCap = NG_FLOW_CAP) {
  const part = ngProgressGuestPart(guestBlob);
  // the guest's open-rule stamp joins the MERGE only (as the earlier stamp), never the copy's hash or the practice key
  if (ngProgressObject(guestBlob) && typeof guestBlob.openAt === "number" && Number.isFinite(guestBlob.openAt) && guestBlob.openAt > 0) part.openAt = guestBlob.openAt;
  if (ngProgressObject(part.flow)) part.flow = ngProgressGuestFlow(live && live.flow, part.flow, flowCap);
  // 4. the guest's modifiers join only where the ACCOUNT has no key for that technique, live or removed (v1.301.0, MODS1,
  // the orchestrator's lean, ruled): the account wins on a clash, whatever the stamps. The account's keys are the cloud's
  // too, because the join runs only after a successful pull; the merge then takes each remaining key as the account lacks it
  // ...and only while the account is under NG_MOD_CAP keys, removed ones counted (MODS1-R1, the sync reader: an account at
  // 200 went to 201 at a join). The account's own keys count first; the guest's join in the list's own order (`born`, then
  // the name) until the account holds 200; the rest stay on the guest copy, untouched.
  if (ngProgressObject(part.settings)) {
    const held = live && ngProgressObject(live.settings) ? live.settings : {};
    for (const k of Object.keys(part.settings)) if (Object.prototype.hasOwnProperty.call(held, k)) { delete part.settings[k]; delete part.settingsAt[k]; }
    let room = NG_MOD_CAP - Object.keys(held).filter((k) => k.startsWith(NG_MOD_PREFIX)).length;
    const joins = new Set();
    for (const m of ngModsRead(part.settings).mods) if (room > 0) { room--; joins.add(NG_MOD_PREFIX + m.name); }
    for (const k of Object.keys(part.settings)) if (!joins.has(k)) { delete part.settings[k]; delete part.settingsAt[k]; }
    if (!Object.keys(part.settings).length) { delete part.settings; delete part.settingsAt; }
  }
  const combined = merge(live, part);
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

// THE GRADES MARKED GONE (CARD1-S0, v1.301.5), as this browser keeps them (host `goneRead`): {deck: {8-hex question hash: 1}},
// read leniently from a stored string or an object. Anything else is dropped, never a reason to refuse: a non-object, a
// key that is not a question hash, a 0, and `__proto__` / `constructor` / `prototype` at either level (the list cells'
// guard, `NGLM_UNSAFE`: a parsed `{"__proto__": {...}}` must never reach a prototype). Built on `Object.create(null)` at both
// levels (CARD1-S0-R2, the reader's R4): a key like `toString` must find nothing inherited to write into.
export function ngProgressGoneParse(v) {
  const out = Object.create(null), unsafe = ["__proto__", "constructor", "prototype"];
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return out; } }
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const dk of Object.keys(v)) {
    if (!dk || unsafe.indexOf(dk) >= 0) continue;
    const m = v[dk];
    if (!m || typeof m !== "object" || Array.isArray(m)) continue;
    for (const qh of Object.keys(m)) if (unsafe.indexOf(qh) < 0 && /^[0-9a-f]{8}$/.test(qh) && m[qh]) (out[dk] = out[dk] || Object.create(null))[qh] = 1;
  }
  return out;
}
export function ngProgressLocalKey(owner, field = "progress") {
  // `guest` (v1.262.0): on an account, the hash of the guest copy it last took (or found nothing in) on this device
  // `device` (v1.262.11): this browser's code for the owner's roll-ledger partition (host `flowDevice`, below)
  // `pending` (v1.280.2): the owner's answers this browser has not yet seen delivered (`ngProgressReplay`, host `journal`)
  // `taken` (v1.280.2): on an account, the guest rows it took in at a join, by card (`ngProgressTakenParse`)
  // `gone` (v1.301.5, CARD1-S0-R1): the grades this browser marked gone from their decks (`ngProgressGoneParse`, host `goneRead`)
  // `carry` (v1.304.0, CARD1-S3-R1): this browser's carry state for the owner (`ngCarryStateRead`, host `carryRead`)
  if (!["progress", "ladder", "firstroll", "coached", "guest", "device", "pending", "taken", "gone", "carry"].includes(field)) throw new TypeError("Unknown account-owned local field");
  return NG_PROGRESS_OWNER_PREFIX + ngProgressOwnerId(owner) + ":" + field;
}
// A stored roll-ledger code: `b` + 16 hex as minted since v1.262.11, or any later short id (tolerant on purpose: a later
// format must not be re-minted). Anything else (absent, damaged) is not a code, and a new one is minted in its place:
// one more partition, never a shared one.
function ngProgressDeviceCode(value) { return typeof value === "string" && /^[A-Za-z0-9_-]{2,64}$/.test(value); }

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
    // v1.262.0: only the pre-v1.207 unowned copy. The guest kind is deleted with the dialog that used it: guest practice
    // joins at sign-in (`joinGuest`), and the old path merged without the join's rule (it could lower known moves).
    importSource(kind) {
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
      // Unowned legacy progress imports into an account; a guest has already adopted it automatically
      // (store.adoptLegacyGuest), so it is never offered to one. No app surface calls this (v1.224.13 removed the row).
      if (kind !== "legacy") return ngProgressFailure("unsupported-import-source");
      if (!active || owner.kind !== "account") return ngProgressFailure("import-not-available");
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
      // The join's rule (v1.262.0): settings and consent never move, a No never takes the account's Yes, the roll
      // ledger never evicts. The host calls this only after a successful pull, so `liveBlob` holds the cloud's rows.
      try { combined = ngProgressGuestMerge(merge, ngProgressClone(liveBlob), source.blob); }
      catch { return ngProgressFailure("merge-failed"); }
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
  // FLOW2 F4: an instance whose ledger code could not be stored (`flowDevice`) -> that code, stored at its next good save
  const unstoredCode = new WeakMap();
  const storeCode = (inst, code) => {
    const key = ngProgressLocalKey(inst._progressOwner, "device");
    try {
      // never over a code another tab of this browser stored meanwhile: that one is the browser's from its next page on
      if (!ngProgressDeviceCode(storage.getItem(key))) storage.setItem(key, code);
      unstoredCode.delete(inst);
    } catch { unstoredCode.set(inst, code); }
  };
  const observed = new Map();
  const semanticMerge = (local, incoming) => {
    if (!app || typeof app._mergeProgressBlobs !== "function") throw new Error("Progress merge is unavailable");
    return app._mergeProgressBlobs(local, incoming);
  };
  const guestMerge = (live, guestBlob) => ngProgressGuestMerge(semanticMerge, live, guestBlob, app && app.NG_FLOW_DEVICES);
  const guestKey = blob => ngProgressHash(ngProgressCloudKey(ngProgressGuestPart(blob)));
  // THE JOURNAL (v1.280.2, `ngProgressReplay`): the owner's answers this browser has not yet seen delivered. A damaged
  // journal reads as a new one (the merge's rule, as before, for what it held); an unreadable store, or a journal of a
  // version this build does not know, reads as null: nothing is replayed, journaled or written for that owner (NEXT2-R1).
  const journalKey = owner => ngProgressLocalKey(owner, "pending");
  const readJournal = owner => { try { return ngProgressJournalParse(storage.getItem(journalKey(owner))); } catch { return null; } };
  const writeJournal = (owner, j) => {
    try {
      if (!j || ngProgressJournalParse(storage.getItem(journalKey(owner))) === null) return false;   // never over another format
      storage.setItem(journalKey(owner), JSON.stringify(j)); return true;
    } catch { return false; }
  };
  // the ids THIS tab appended since it last wrote the owner's copy: the answers another tab's rows have not seen
  const mine = new Map();
  // NEXT2-R1 (the reader's finding 2): the rows a replay in THIS tab replaced, by owner and card (the blind one-day rows
  // the stored copy, written by another tab, may still present); a stored row among them yields to this tab's rebuilt row
  const superseded = new Map();
  const replayer = inst => inst && typeof inst._scheduleWrite === "function" && typeof inst._epochDay === "function"
    ? { write: (p, ok, d, at) => inst._scheduleWrite(p, ok, d, at), today: inst._epochDay() } : null;   // `at`: the pair's place (v1.281.0)
  const mergeExternal = (owner, live, saved, commit = false) => {
    const raw = observed.get(ngProgressOwnerId(owner));
    if (!saved.blob || raw === saved.raw) return live;
    let combined = semanticMerge(live, saved.blob), base = null;
    if (raw) {
      base = JSON.parse(raw).blob;
      // A change in unrelated evidence is not a concurrent edit of this field.
      // Preserve ordinary local deletes/resets when that field on disk still equals
      // our observed base. Concurrent edits of the SAME field retain existing merge policy.
      // NOT `settings` AND `settingsAt` (v1.301.0, MODS1-R1, the sync reader's F1). Taken one field at a time they came apart:
      // when the other tab's writes took a value A→B→A, the stored `settings` equalled this tab's base again while
      // `settingsAt` did not, so this tab's stale value was kept under the newer stamp, and a tie keeps the local copy: the
      // two tabs never agreed (dev's `dailyGoal` stuck at 35 in one tab and 25 in the other; a removed modifier came back).
      // They need nothing from this loop: each key carries its own stamp, which the merge above already decides by, and no
      // settings key is ever deleted (CLAUDE.md §6.6), so there is no local removal to preserve.
      // Every other field still needs it: its merge can only ADD, so a removal made here would come back from the other
      // tab's copy. prep, rec, stage, days, rollDays: per-key MAX (a stale grade's prune, `_pruneStaleGrades`); srs, moves:
      // per-row recency (a pruned row); units, tut, challenges, badges, coins, belts: union or MAX; lists: add-wins (a
      // deleted list or a removed item); listItemAt, listOrderAt: the cells and records (their trims at the caps); flow:
      // per-partition MAX (its window and cap trims); dayLog: per-day union (its 30-day trim); explored: a union. openAt
      // (MIN) and recallCarry (OR) have no removal, and keeping them whole here is harmless.
      // tests/mods_sync.test.mjs 17 and 18 (a modifier, then an ordinary setting, through the A→B→A sequence).
      for (const key of new Set([...Object.keys(base), ...Object.keys(live)])) {
        if (key === "settings" || key === "settingsAt") continue;
        if (JSON.stringify(saved.blob[key]) === JSON.stringify(base[key])
          && JSON.stringify(live[key]) !== JSON.stringify(base[key])) {
          if (Object.prototype.hasOwnProperty.call(live, key)) combined[key] = ngProgressClone(live[key]);
          else delete combined[key];
        }
      }
    }
    // v1.280.2, NEXT2-R1 (the reader's finding 2), two rules for the schedule rows, then the replay:
    //   · a row THIS tab has not touched since it last read or wrote the stored copy yields to the stored row: another tab
    //     wrote it since, from a merge that saw this tab's row, so a stale one-day row held in this tab's memory never comes
    //     back over a row another tab's replay rebuilt;
    //   · a stored row that a replay in this tab replaced (`superseded`) yields to this tab's row.
    // A snapshot (`cloudSnapshot`) decides the same and writes nothing.
    const key = ngProgressOwnerId(owner), gone = superseded.get(key);
    for (let field = 0; field < NG_PROGRESS_JOURNAL_FIELDS.length; field++) {
      const L = live[NG_PROGRESS_JOURNAL_FIELDS[field]];
      if (!ngProgressObject(L)) continue;
      for (const bucket of Object.keys(L)) if (ngProgressObject(L[bucket])) for (const item of Object.keys(L[bucket])) {
        const mineRow = L[bucket][item], storedRow = ngProgressJournalRaw(saved.blob, field, bucket, item);
        if (!storedRow) continue;
        const was = base && ngProgressJournalRaw(base, field, bucket, item), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        const stale = gone && gone.get(field + "\u0000" + bucket + "\u0000" + item);
        if (was && same(mineRow, was) && !same(storedRow, was)) ngProgressJournalSet(combined, field, bucket, item, ngProgressClone(storedRow));
        else if (stale && stale.some(r => same(r, storedRow)) && !stale.some(r => same(r, mineRow))) ngProgressJournalSet(combined, field, bucket, item, ngProgressClone(mineRow));
      }
    }
    // the answers this tab gave since it last wrote meet the other tab's rows rebuilt on them, never merged (a tab that
    // never saw the other's row of a card no longer turns it into one day). Rows in the other copy stay in the journal:
    // the other tab's copy is not the cloud.
    const ids = mine.get(key), R = ids && ids.size ? replayer(app) : null, jr = R ? readJournal(owner) : null;
    if (R && jr) {
      const j = jr, entries = j.e.filter(e => ids.has(e[0]));
      if (entries.length) {
        const r = ngProgressReplay(combined, saved.blob, entries, R.write, R.today);
        combined = r.blob;
        if (commit && r.rebuilt.size) writeJournal(owner, ngProgressJournalAfter(j, r, false));
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
        const combined = merged ? mergeExternal(owner, blob, previous, true) : blob;
        const saved = store.write(owner, combined);
        if (saved.status === "saved") { observed.set(key, saved.raw); mine.delete(key); superseded.delete(key); }
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
        if (unstoredCode.has(inst)) storeCode(inst, unstoredCode.get(inst));   // F4: the code the mint could not store
      }
      return result;
    },
    // ── v1.262.11 (FLOW1): THIS BROWSER'S CODE FOR THE OWNER'S ROLL LEDGER ──
    // The ledger is a G-counter, one partition per writer, merged per partition by MAX and read as the sum; MAX is exact
    // only while a partition has ONE writer. Until v1.262.10 the code was the setting `flowDevice`, and settings sync per
    // key (last writer wins), so every browser of an account converged on one code and wrote one partition from many
    // places: two browsers rolling the same move between syncs kept only the larger of their two tallies. Now the code is
    // kept HERE, in this browser's storage beside the owner's copy (`<owner>:device`), and never in the progress blob, so
    // it never syncs and never joins. Per OWNER, not per browser: the guest copy joins every account on this browser
    // under the guest's code (ngProgressGuestFlow: "a partition joins as itself, merges with itself by MAX"), so an
    // account's code must never be the guest's, nor another account's. Minted once, at the owner's first roll here
    // (`mint` is the app's). A code this browser loses (site data cleared, a private window, Safari's seven-day cap) is
    // gone with it, and the next roll mints another: one more partition, which takes a slot of NG_FLOW_CAP; the old one
    // stays, frozen, counting while its moves are rolled within the window by any partition (`ngFlowTrim`), and is the
    // first the cap evicts. Answers null when it cannot say (a stale instance, unreadable storage); the app then keeps a
    // code for that instance only. KNOWN, NOT FIXED HERE (F5): two tabs of one browser share this one code, as they share
    // its local copy, and `mergeExternal` merges their two copies by MAX, so the two tabs rolling one move each keep the
    // larger tally (so before v1.262.11 too). tests/flow_device_per_browser.test.mjs.
    flowDevice(inst, mint) {
      if (!host.current(inst) || typeof mint !== "function") return null;
      const key = ngProgressLocalKey(inst._progressOwner, "device");
      let code;
      try { code = storage.getItem(key); } catch { return null; }
      if (ngProgressDeviceCode(code)) return code;
      code = mint();
      if (!ngProgressDeviceCode(code)) return null;
      // F4 (FLOW2): a write that fails (a full storage) is tried again at this instance's next good save (`persist`), so
      // a browser does not mint a partition per page load while its progress still saves (the reader's S7b: 8 page loads,
      // 8 partitions). Until it is stored, this instance keeps the code in memory.
      storeCode(inst, code);
      return code;
    },
    // ── CARD1-S0-R1 (v1.301.5; the sync reader of PR #468, F1): THE GRADES THIS BROWSER MARKED GONE ──
    // `{deck: {question hash: 1}}`, the app's `_pruneStaleGrades`: the grade of a question the deck no longer holds, as THIS
    // browser loaded the deck. KEPT HERE, beside `<owner>:device`, and never in the progress blob: never merged, never pushed,
    // never joined at sign-in. A synced marker let a browser on older content (a tab open across a content deploy, or
    // production against the preview on one account) hide a grade that is live on an up-to-date browser, at every pull; let
    // a browser that never loaded the deck read LOWER than dev (the reader's 95 of 100 records); and production's build
    // pinned its first copy and pushed it back. The grades themselves stay in `stage`, synced and merged by MAX, which is
    // all CARD1's recovery needs. A marker this browser loses (site data cleared) costs a recount until the deck lands
    // again, never a grade. Answers {} when it cannot say; a write that fails is not retried (the next landing writes it).
    goneRead(inst) {
      if (!host.current(inst)) return null;
      try { return ngProgressGoneParse(storage.getItem(ngProgressLocalKey(inst._progressOwner, "gone"))); } catch { return {}; }
    },
    // ONE DECK AT A TIME (CARD1-S0-R2, the reader's R3): `deck`'s marks are written over the map the store holds NOW, so two
    // tabs of one browser never drop each other's decks (a tab's older copy of the whole map used to win). Answers the map
    // as stored, so the tab sees the other tabs' decks too; false when the store cannot be read or written (nothing thrown).
    goneWrite(inst, marks, deck) {
      if (!host.current(inst) || typeof deck !== "string") return false;
      const key = ngProgressLocalKey(inst._progressOwner, "gone");
      try {
        const stored = ngProgressGoneParse(storage.getItem(key)), m = marks && marks[deck];
        if (m && Object.keys(m).length) { stored[deck] = Object.create(null); for (const qh of Object.keys(m)) stored[deck][qh] = 1; }
        else delete stored[deck];
        if (Object.keys(stored).length) storage.setItem(key, JSON.stringify(stored)); else storage.removeItem(key);
        return stored;
      } catch { return false; }
    },
    // CARD1-S3-R1: the carry's state for this owner ON THIS BROWSER (`ngCarryStateRead`), never in the record; answers null when
    // it cannot say (the app then decides on its in-memory copy); a write that fails is not retried (the next decision writes it)
    carryRead(inst) {
      if (!host.current(inst)) return null;
      try { return ngCarryStateRead(JSON.parse(storage.getItem(ngProgressLocalKey(inst._progressOwner, "carry")) || "null")); } catch { return null; }
    },
    carryWrite(inst, state) {
      if (!host.current(inst)) return false;
      try { storage.setItem(ngProgressLocalKey(inst._progressOwner, "carry"), JSON.stringify(ngCarryStateRead(state))); return true; } catch { return false; }
    },
    // ── v1.280.2 (NEXT2): the owner's undelivered answers (`ngProgressReplay`) ──
    // `rows`: [[field, bucket, item, ok, day, after], …] as the app's writers leave them. Appended in order, persisted at
    // once (an app closed before its next save keeps the answer), capped; this tab remembers its own ids for the tab merge.
    journal(inst, rows) {
      if (!host.current(inst) || !Array.isArray(rows) || !rows.length) return [];
      const owner = inst._progressOwner, j = readJournal(owner), ids = [];
      if (!j) return [];   // a journal this build cannot read is left alone (NEXT2-R1)
      for (const r of rows) {
        // ids from the clock: a journal replaced after damage never restarts below an id already used (an account's `g`)
        const id = Math.max(j.n, Math.floor(Date.now())), e = [id].concat(Array.isArray(r) ? r : []);
        if (!ngProgressJournalEntry(e)) continue;
        j.n = id + 1; j.e.push(ngProgressClone(e)); ids.push(id);
      }
      if (!ids.length) return [];
      if (j.e.length > NG_PROGRESS_JOURNAL_CAP) j.e = j.e.slice(j.e.length - NG_PROGRESS_JOURNAL_CAP);
      if (!writeJournal(owner, j)) return [];
      const key = ngProgressOwnerId(owner), set = mine.get(key) || new Set();
      for (const id of ids) set.add(id);
      mine.set(key, set);
      return ids;
    },
    // L2 (v1.292.0): AN UNDO TAKES ITS ANSWERS BACK OUT, by their ids, so no later merge gives an undone answer again
    // (`ngProgressReplay` would rebuild it on the other copy's row). Only entries still here: a delivered one is gone, the
    // cloud holds its row, and the app keeps the push waiting while an Undo is offered so that does not happen
    // (app.src.jsx, `_undoHold`). The entries left are exactly the ones that were there; the id counter `n` only moves
    // forward (an id is never given twice). Returns how many left.
    // L2-R1 (the reader of PR #438, findings 1 and j): AND THE JOURNAL IS PUT BACK WHOLE. `mark` is the journal as it was
    // stored before the confirm (`journalMark`: the text, or null when there was no key). When the entries left are
    // exactly the mark's, the mark itself goes back: no key where there was none (the first Done of a browser made it),
    // else the same text, its counter included. Ids come from the clock (`journal`), and the ids taken back were never
    // delivered (the push waits while an Undo is offered), so a counter put back hands out nothing a cloud has seen.
    // When another writer added an entry meanwhile, the mark no longer describes the journal: the entries are filtered
    // and the counter stays where it is.
    unjournal(inst, ids, mark) {
      if (!host.current(inst) || !Array.isArray(ids) || !ids.length) return 0;
      const owner = inst._progressOwner, j = readJournal(owner), gone = new Set(ids);
      if (!j) return 0;
      const e = j.e.filter(x => !gone.has(x[0])), n = j.e.length - e.length;
      if (!n) return 0;
      j.e = e;
      let whole = false;
      if (mark === null && !e.length) { try { storage.removeItem(journalKey(owner)); whole = true; } catch { whole = false; } }
      else if (typeof mark === "string") {
        const was = (() => { try { return ngProgressJournalParse(mark); } catch { return null; } })();
        if (was && JSON.stringify(was.e) === JSON.stringify(e)) { try { storage.setItem(journalKey(owner), mark); whole = true; } catch { whole = false; } }
      }
      if (!whole && !writeJournal(owner, j)) return 0;
      const set = mine.get(ngProgressOwnerId(owner));
      if (set) for (const id of ids) set.delete(id);
      return n;
    },
    // the journal as it is stored now: its text, or null when there is no key (undefined: it cannot be read)
    journalMark(inst) {
      if (!host.current(inst)) return undefined;
      try { return storage.getItem(journalKey(inst._progressOwner)); } catch { return undefined; }
    },
    // AT A PULL: `next` is the pull's merge of this copy with `cloud`. The journal's cards the cloud holds are rebuilt on
    // the cloud's rows from the entries made on or after its row's last answer; entries the cloud already holds are
    // delivered, and entries older than its last answer superseded (NEXT2-R1): both leave the journal; the rebuilt ones
    // carry the rows they now leave, so the push that follows delivers them. The rows they replaced are remembered for
    // this tab's next save (`superseded`).
    replayCloud(inst, next, cloud) {
      const R = host.current(inst) ? replayer(inst) : null;
      if (!R) return next;
      const owner = inst._progressOwner, j = readJournal(owner);
      if (!j || !j.e.length) return next;
      const r = ngProgressReplay(next, cloud, j.e, R.write, R.today);
      if (r.inCopy.length || r.older.length || r.rebuilt.size) writeJournal(owner, ngProgressJournalAfter(j, r, true));
      if (r.was.size) {
        const key = ngProgressOwnerId(owner), m = superseded.get(key) || new Map();
        for (const [card, rows] of r.was) m.set(card, (m.get(card) || []).concat(rows));
        superseded.set(key, m);
      }
      ngProgressValidateBlob(r.blob);
      return r.blob;
    },
    // AFTER A PUSH the cloud accepted, alone in this tab: the entries whose rows that copy holds are delivered.
    delivered(inst, snap) {
      const R = host.current(inst) ? replayer(inst) : null;
      if (!R) return 0;
      const owner = inst._progressOwner, j = readJournal(owner);
      if (!j || !j.e.length) return 0;
      const r = ngProgressReplay(snap, snap, j.e, R.write, R.today);
      if (!r.inCopy.length) return 0;
      const gone = new Set(r.inCopy), src = new Set(j.e.filter(e => gone.has(e[0]) && e.length === 8).map(e => e[7]));
      writeJournal(owner, { ...j, e: j.e.filter(e => !gone.has(e[0])) });
      // NEXT2-R1: a guest answer this account took in leaves the GUEST's journal once this account's cloud holds it
      if (src.size && owner.kind === "account") {
        const G = ngProgressOwner(), gj = readJournal(G);
        if (gj) writeJournal(G, { ...gj, e: gj.e.filter(e => !src.has(e[0])) });
      }
      return r.inCopy.length;
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
      // as `joinGuest`: the rule must meet the cloud's rows, which this browser's copy holds only after a pull
      if (inst._pulled !== true || inst._pulledUserId !== inst._progressOwner.id) return ngProgressFailure("not-pulled");
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
      let live, combined, adds, practised = false, taken = null;
      try {
        live = inst._progressBlob(); combined = guestMerge(live, found.blob);
        // v1.280.2: the guest's answers the account has not taken in yet (ids above the account journal's `g`) meet the
        // account's rows rebuilt on them, never merged: a guest's first right answer no longer turns the account's mature
        // card into one day. Only answers made on or after the account row's last answer (NEXT2-R1, finding 1: a guest's
        // miss of months ago no longer resets an account's card it has answered since). They then become the account's own
        // undelivered answers, so its push delivers them. And while the guest's row of a card is the one this account took
        // in (its `taken` key), the account keeps its own row (finding 3: the guest's one-day row came back at a second join).
        const R = replayer(inst), gj = R ? readJournal(ngProgressOwner()) : null, aj = R ? readJournal(inst._progressOwner) : null;
        let tk = null;
        try { tk = R ? ngProgressTakenParse(storage.getItem(ngProgressLocalKey(inst._progressOwner, "taken"))) : null; } catch { tk = null; }
        if (R && gj && aj && tk) {
          const fresh = gj.e.filter(e => e[0] > aj.g), r = ngProgressReplay(combined, live, fresh, R.write, R.today);
          combined = r.blob;
          const freshCards = new Set(fresh.map(ngProgressJournalCard));
          for (const card of Object.keys(tk)) {
            if (freshCards.has(card)) continue;
            const [f, b, i] = card.split("\u0000"), field = +f, guestRow = ngProgressJournalRaw(found.blob, field, b, i), ownRow = ngProgressJournalRaw(live, field, b, i);
            if (guestRow && ownRow && JSON.stringify(guestRow) === JSON.stringify(tk[card])) ngProgressJournalSet(combined, field, b, i, ngProgressClone(ownRow));
          }
          if (fresh.length) taken = { aj, tk, fresh, freshCards, r };
        }
        const base = semanticMerge(live, { v: 2 });
        practised = ngProgressPracticeKey(combined) !== ngProgressPracticeKey(base);
        // the guest's modifiers (v1.301.0, MODS1) join too, and a copy holding nothing else joins them QUIETLY (ruling 2 a)
        adds = practised || ngProgressModsKey(combined) !== ngProgressModsKey(base);
      } catch { return ngProgressFailure("merge-failed"); }
      if (!adds) { try { storage.setItem(mark, key); } catch { /* looked at again next time: harmless */ } return { status: "nothing" }; }
      if (!ngProgressBlob(combined)) return ngProgressFailure("merge-failed");
      const saved = preservingStore.write(inst._progressOwner, combined);
      if (saved.status !== "saved") { inst._progressStorageError = saved.reason; return saved; }   // nothing marked
      if (taken) {
        const { aj, tk, fresh, freshCards, r } = taken, skip = new Set(r.inCopy.concat(r.older));
        for (const e of fresh) {
          if (skip.has(e[0])) continue;
          const id = Math.max(aj.n, Math.floor(Date.now()));
          aj.n = id + 1; aj.e.push([id].concat(e.slice(1, 6), [r.rebuilt.get(e[0]) || e[6]], [e[0]]));
        }
        if (aj.e.length > NG_PROGRESS_JOURNAL_CAP) aj.e = aj.e.slice(aj.e.length - NG_PROGRESS_JOURNAL_CAP);
        aj.g = Math.max(aj.g, ...fresh.map(e => e[0]));
        writeJournal(inst._progressOwner, aj);
        for (const card of freshCards) {
          const [f, b, i] = card.split("\u0000"), guestRow = ngProgressJournalRaw(found.blob, +f, b, i);
          if (guestRow) { delete tk[card]; ngProgressPut(tk, card, ngProgressClone(guestRow)); }
        }
        const cards = Object.keys(tk);
        for (const card of cards.slice(0, Math.max(0, cards.length - NG_PROGRESS_JOURNAL_TAKEN))) delete tk[card];
        try { storage.setItem(ngProgressLocalKey(inst._progressOwner, "taken"), JSON.stringify({ v: 1, t: tk })); } catch { /* the next join reads none: the merge's rule, as before */ }
      }
      // Marked only after the account's copy holds the practice. A mark that fails to write (or is lost) is looked at
      // again after the next pull: the account then already holds this practice, so the join finds nothing to add, is
      // marked and stays silent; it says the line again only if the practice is in neither this browser's account copy
      // nor the cloud (the push failed and the copy was lost). Every merge step is idempotent, so nothing counts twice.
      try { storage.setItem(mark, key); } catch { /* see above */ }
      // `quiet`: only modifiers joined, so the app says nothing (the line speaks of practice)
      return { status: "joined", blob: saved.blob || combined, quiet: !practised };
    },
  };
  return host;
}
