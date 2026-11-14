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
// rung 0 keeps the longer interval it beat, which heals a fresh device's 1 -> 3 against a mature schedule; since
// v1.279.0 both are read as TRUE intervals (`due − last`), the cell being floored to the seven-rung ladder. `last` is
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
      // the heal by TRUE intervals, `due − last` (v1.279.0: `ngKnowledgeInterval`'s reading, which this group file
      // cannot import; tests/knowledge_profile.test.mjs pins the two equal), the beaten row's own cell kept
      const tw = Math.max(w[1] >= 1 ? w[1] : 1, w[0] - w[2]), to = Math.max(o[1] >= 1 ? o[1] : 1, o[0] - o[2]);
      if (tw > 1 && to > tw) w = [w[2] + to, o[1], w[2], w[3]].concat(w.slice(4));
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
//   1. the guest's settings never move (`settings`, `settingsAt`, `updatedAt` are dropped; `openAt`, the open rule's
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
// Every other field of that merge already only adds (prep/rec/stage/days MAX, belts.held MAX and won union,
// badges/coins/explored/tut union, challenges MAX progress, lists add-wins). Units, `belts.won` records, `dayLog.w` and
// fields from later builds keep the account's value where it has one: the account's value AFTER the first pull, i.e.
// the cloud's too, because the join runs only then (the second reader: "holds only against the local copy" was true of
// the first build). `srs` keeps the pull's rule: a guest's later miss can bring a card back sooner; no figure reads the
// schedule's interval, and today's count is a union. tests/guest_join_safety.test.mjs.
// THE OPEN RULE'S TWO VALUES (v1.270.0, U163 c; the app's `_syncBelt`, `_recallCarried`). `openAt`, when the open rule
// first ran for an owner, is left out of the guest PART, so it is neither in the copy's hash nor in the practice key (a
// bare landing writes one: tests/guest_join_safety.test.mjs 20). It joins the MERGE all the same (`ngProgressGuestMerge`
// puts it back on the part it merges): the EARLIER of the two stamps, so a guest's belt earned under the guest's own rule
// is judged against a stamp no later than the guest's and is not carried (the read of PR #404's delta, D1: OPEN2B had
// dropped it, and a guest who earned blue under the rule got timed recall switched on at sign-in). The account's own
// carry is frozen before the join (`_joinGuestPractice`), so the earlier stamp cannot un-carry the account's own pre-rule
// belt. `recallCarry` (only ever `true`: a belt held before the rule kept timed recall) joins as an OR with the belt it
// came from (MAX): the join only adds. Tests 20, 21 and R1, R1b, R3.
function ngProgressGuestPart(blob) {
  const out = ngProgressClone(blob);
  delete out.settings; delete out.settingsAt; delete out.updatedAt; delete out.openAt;
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
export const NG_PROGRESS_TRAIL_CHALLENGES = Object.freeze(["white.coach1", "white.coach2", "white.coach3"]);
export function ngProgressPracticeKey(blob) {
  const b = ngProgressGuestPart(blob);
  delete b.explored; delete b.tut; delete b.recallCarry;
  if (ngProgressObject(b.belts)) delete b.belts.gf;
  if (ngProgressObject(b.challenges)) for (const id of NG_PROGRESS_TRAIL_CHALLENGES) delete b.challenges[id];
  return ngProgressCloudKey(b);
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

export function ngProgressLocalKey(owner, field = "progress") {
  // `guest` (v1.262.0): on an account, the hash of the guest copy it last took (or found nothing in) on this device
  // `device` (v1.262.11): this browser's code for the owner's roll-ledger partition (host `flowDevice`, below)
  if (!["progress", "ladder", "firstroll", "coached", "guest", "device"].includes(field)) throw new TypeError("Unknown account-owned local field");
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
      let live, combined, adds;
      try {
        live = inst._progressBlob(); combined = guestMerge(live, found.blob);
        adds = ngProgressPracticeKey(combined) !== ngProgressPracticeKey(semanticMerge(live, { v: 2 }));
      } catch { return ngProgressFailure("merge-failed"); }
      if (!adds) { try { storage.setItem(mark, key); } catch { /* looked at again next time: harmless */ } return { status: "nothing" }; }
      if (!ngProgressBlob(combined)) return ngProgressFailure("merge-failed");
      const saved = preservingStore.write(inst._progressOwner, combined);
      if (saved.status !== "saved") { inst._progressStorageError = saved.reason; return saved; }   // nothing marked
      // Marked only after the account's copy holds the practice. A mark that fails to write (or is lost) is looked at
      // again after the next pull: the account then already holds this practice, so the join finds nothing to add, is
      // marked and stays silent; it says the line again only if the practice is in neither this browser's account copy
      // nor the cloud (the push failed and the copy was lost). Every merge step is idempotent, so nothing counts twice.
      try { storage.setItem(mark, key); } catch { /* see above */ }
      return { status: "joined", blob: saved.blob || combined };
    },
  };
  return host;
}
