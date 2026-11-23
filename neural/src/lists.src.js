// lists.src.js — share-lists DOMAIN layer (storage shape, merge rule, link parsing, preview
// text). PURE: no DOM, no globals, no imports.
//
// lists-codec.src.js owns the WIRE (ordinals ⇄ base64url). This file owns everything around
// it: what a coach's list looks like in the v2 progress blob, how two devices reconcile it,
// how a `/l/<code>` URL is recognised, and what a WhatsApp preview says.
//
// THREE CONSUMERS, ONE SOURCE (same contract as the codec):
//   · tests/share_lists_store.test.mjs imports it directly under `node --test`
//   · neural/build/build.mjs concatenates it into the browser IIFE, stripping `export `
//   · functions/l/[[path]].js imports it in the Cloudflare Pages Function
// Consequences, both load-bearing:
//   1. NO `import` statements — the bundle path is text concatenation, not a module graph.
//   2. Every top-level name here shares ONE scope with lists-codec.src.js in the bundle, so
//      no identifier may collide with that file. That is why the item cap below is called
//      NG_LIST_ITEM_CAP and not NG_LIST_MAX_ITEMS: two `const NG_LIST_MAX_ITEMS` in one
//      scope is a SyntaxError, which deletes the entire app. The two constants are pinned
//      equal by a test.

export const NG_LIST_NAME_MAX = 60;

// Mirror of the codec's NG_LIST_MAX_ITEMS (see the scope note above). Pinned equal by
// tests/share_lists_store.test.mjs — if you change one, that test goes red.
export const NG_LIST_ITEM_CAP = 60;

// Mirror of the codec's NG_LIST_MAX_CODE_CHARS: a hostile URL must not reach the decoder.
export const NG_LIST_CODE_CHAR_CAP = 512;

const NGL_CODE_RE = /^[A-Za-z0-9_-]+$/;
const NGL_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// og:title is truncated hard by WhatsApp/Telegram previews; og:description gets more room.
const NGL_OG_TITLE_MAX = 90;
const NGL_OG_DESC_MAX = 200;

function nglText(v) {
  // Plain, single-line, markup-free. NOT escaped: the Function writes these through
  // HTMLRewriter's setAttribute, which escapes on its own — pre-escaping here would ship a
  // literal "&amp;" into a link preview.
  return String(v == null ? "" : v)
    .replace(/[<>"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nglClamp(s, max) {
  const t = nglText(s);
  return t.length <= max ? t : t.slice(0, max);
}

// ─────────────────────────────────────────────────────────────── storage shape
// A list lives in the EXISTING v2 progress blob under `lists`:
//   { "<listId>": { name: string, items: [nodeId], t: epochMs } }
// Items are NODE IDS, never ordinals and never array indices — ordinals are a wire detail and
// indices are unstable. `t` is the last-touched time; it settles name conflicts on merge.

/** Sanitize an untrusted lists blob (localStorage is user-writable; cloud rows outlive
 *  schemas). Never throws; drops what it cannot understand. */
export function ngListsNormalize(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const id of Object.keys(raw)) {
    if (!id || typeof id !== "string") continue;
    const entry = raw[id];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    if (!Array.isArray(entry.items)) continue;
    const items = [];
    for (const nid of entry.items) {
      if (typeof nid !== "string" || !nid) continue;
      if (items.indexOf(nid) >= 0) continue;
      items.push(nid);
      if (items.length >= NG_LIST_ITEM_CAP) break; // the earliest picks win the cap
    }
    if (!items.length) continue; // an empty list is not a list
    const t = Number(entry.t);
    out[id] = {
      name: nglClamp(entry.name, NG_LIST_NAME_MAX) || "Class list",
      items: items,
      // at most 2^53 - 1 (MOVE-R1, F5): `_listStamp` adds 1 to the newest `t`, and past that `n + 1 === n`, so one damaged
      // stamp would freeze every later list, cell and record stamp of this device. No clock gets near it.
      t: Number.isFinite(t) && t > 0 && t <= Number.MAX_SAFE_INTEGER ? t : 0,
    };
  }
  return out;
}

/**
 * ADD-WINS reconciliation, beside ngMergeCollectibles' UNION rule for badges/coins.
 * Union of lists, union of each list's items, name from whichever side was touched later.
 *
 * The documented cost: a DELETE loses to a stale device that still has the list. That is the
 * deliberate trade — deleting again is trivial; losing the list a class was built from (and
 * that is already posted in a WhatsApp group) is not. It reaches further than "stale" suggests:
 * every other device that holds the list carries its own copy into its next merge, so on an
 * account used on two devices a × or a delete comes back at the other's next pull, unless both
 * did it (measured with this function, LISTS-A).
 *
 * `marks` (optional): the item cells of a MOVE (`listItemAt`, below). With them, an item that left
 * a list by a move stays out of it, however many devices still hold the old copy.
 * `order` (optional): the ORDER records (`listOrderAt`, below), the merged ones. With them, a list's order is derived
 * from its record, not from whichever copy the union started from.
 */
export function ngMergeLists(local, cloud, marks, order) {
  const a = ngListsNormalize(local);
  const b = ngListsNormalize(cloud);
  const out = {};
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    const l = a[id];
    const c = b[id];
    if (!l) { out[id] = c; continue; }
    if (!c) { out[id] = l; continue; }
    const items = l.items.slice();
    for (const nid of c.items) {
      if (items.length >= NG_LIST_ITEM_CAP) break; // a merge may never exceed the wire cap
      if (items.indexOf(nid) < 0) items.push(nid);
    }
    out[id] = {
      name: c.t > l.t ? c.name : l.name,
      items: items,
      t: Math.max(l.t, c.t),
    };
  }
  const moved = marks ? ngListsApplyMarks(out, marks) : out;
  return order ? ngListsApplyOrder(moved, order) : moved;
}

// ─────────────────────────────────────────────────────────────── a MOVE between lists (LISTS-R, ruling 2)
// The owner, 19 Nov: "how can i rename a list? or move items between lists like drag and drop?". A move is "add there,
// take out here", and the take-out is what the add-wins union above cannot keep: the other device still holds the item
// in the source, so the union put it back and a move became a copy (if the source was emptied, the whole source came
// back). So a move records itself in a new top-level key of the progress blob, `listItemAt`:
//   { "<listId>": { "<nodeId>": [t, 0|1] } }
// one CELL per (list, item) that a move touched: the last time that item ENTERED (1) or LEFT (0) that list.
//   · WRITTEN by a move (out of the source, into the target, one stamp), and by an add into a list that already has a
//     cell for that item (so a re-add after a move beats the old "out"). Nothing else writes one: × and a list's
//     delete keep the add-wins rule above, deliberately.
//   · MERGED per cell: the later `t` wins; a tie goes to "in" (add-wins, like everything else here).
//   · READ after the union (`ngListsApplyMarks`): an item whose winning cell for a list says "out" is taken out of
//     that list, UNLESS it would then stand in no list at all (THE NO-LOSS GUARD: a target capped by the union, a
//     target deleted on every device). A list the cells empty is gone, as an empty list always is.
//   · TRIMMED to the NG_LIST_MARK_CAP newest cells, by a total order every device computes alike. A trimmed cell only
//     returns its (list, item) to the add-wins rule above; it can never take an item out.
// TOP LEVEL, NOT INSIDE A LIST: `ngListsNormalize` rebuilds each list as {name, items, t}, so a field inside a list is
// dropped on load by every build ever shipped; an unknown top-level key is kept whole by every build since v1.207.0
// (`_progressExtras`), which is how an older client carries the cells it cannot read.
export const NG_LIST_MARK_CAP = 200;
const NGLM_UNSAFE = ["__proto__", "constructor", "prototype"];

function nglmTrim(m) {
  const all = [];
  for (const lid of Object.keys(m)) for (const nid of Object.keys(m[lid])) all.push([m[lid][nid][0], lid, nid]);
  if (all.length <= NG_LIST_MARK_CAP) return m;
  // newest first; equal stamps by list id, then item id: one order on every device, so two devices keep one set
  all.sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));
  const out = {};
  for (const [, lid, nid] of all.slice(0, NG_LIST_MARK_CAP)) (out[lid] = out[lid] || {})[nid] = m[lid][nid];
  return out;
}

/** Sanitize an untrusted `listItemAt` (user-writable storage; a cloud row from any build). Never throws; a fresh copy. */
export function ngListMarksNormalize(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const lid of Object.keys(raw)) {
    const row = raw[lid];
    if (!lid || NGLM_UNSAFE.indexOf(lid) >= 0 || !row || typeof row !== "object" || Array.isArray(row)) continue;
    for (const nid of Object.keys(row)) {
      const c = row[nid];
      if (!nid || NGLM_UNSAFE.indexOf(nid) >= 0 || !Array.isArray(c) || c.length < 2) continue;
      const t = c[0], f = c[1];
      // a SAFE integer only (MOVE-R1, F5): at 2^53 or more `t + 1 === t`, so no later write could ever beat a damaged
      // stamp, and the cell would be frozen for good (the reader's freeze.mjs). Every stamp a build writes is an integer.
      if (!Number.isSafeInteger(t) || t <= 0 || (f !== 0 && f !== 1)) continue;
      (out[lid] = out[lid] || {})[nid] = [t, f];
    }
  }
  return nglmTrim(out);
}

/** Two copies' cells: per cell the later stamp wins, a tie goes to "in". Commutative, idempotent, trimmed alike. */
export function ngListMarksMerge(a, b) {
  const A = ngListMarksNormalize(a), B = ngListMarksNormalize(b), out = {};
  for (const M of [A, B]) for (const lid of Object.keys(M)) for (const nid of Object.keys(M[lid])) {
    const c = M[lid][nid], row = (out[lid] = out[lid] || {}), o = row[nid];
    if (!o || c[0] > o[0] || (c[0] === o[0] && c[1] > o[1])) row[nid] = [c[0], c[1]];
  }
  return nglmTrim(out);
}

/** One cell written (a copy; `f` 1 = entered, 0 = left). */
export function ngListMarksSet(marks, lid, nid, t, f) {
  const out = ngListMarksNormalize(marks);
  if (!lid || !nid || NGLM_UNSAFE.indexOf(lid) >= 0 || NGLM_UNSAFE.indexOf(nid) >= 0 || !(t > 0)) return out;
  (out[lid] = out[lid] || {})[nid] = [t, f ? 1 : 0];
  return nglmTrim(out);
}

/** How many cells, and the newest stamp among them (a new cell must be later than every cell held). */
export function ngListMarksCount(marks) {
  let n = 0;
  for (const lid of Object.keys(marks || {})) n += Object.keys(marks[lid] || {}).length;
  return n;
}
export function ngListMarksNewest(marks) {
  let hi = 0;
  for (const lid of Object.keys(marks || {})) for (const nid of Object.keys(marks[lid] || {})) {
    const c = marks[lid][nid];
    if (Array.isArray(c) && c[0] > hi) hi = c[0];
  }
  return hi;
}

/**
 * The cells applied to normalized lists (a copy). Lists in id order, so every device takes the same item out of the
 * same list when the guard has to choose. THE NO-LOSS GUARD: an "out" never removes an item's last place.
 */
export function ngListsApplyMarks(lists, marks) {
  const M = ngListMarksNormalize(marks), out = {};
  for (const id of Object.keys(lists || {})) out[id] = { name: lists[id].name, items: lists[id].items.slice(), t: lists[id].t };
  const elsewhere = (lid, nid) => {
    for (const k of Object.keys(out)) if (k !== lid && out[k].items.indexOf(nid) >= 0) return true;
    return false;
  };
  for (const lid of Object.keys(M).sort()) {
    const l = out[lid];
    if (!l) continue;
    for (const nid of Object.keys(M[lid]).sort()) {
      if (M[lid][nid][1] !== 0) continue;
      const at = l.items.indexOf(nid);
      if (at < 0 || !elsewhere(lid, nid)) continue;
      l.items.splice(at, 1);
    }
    if (!l.items.length) delete out[lid];
  }
  return out;
}

/** "Class · Aug 9" — a name a coach recognises in a list of lists. */
export function ngListDefaultName(date) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  return nglClamp("Class · " + NGL_MONTHS[d.getMonth()] + " " + d.getDate(), NG_LIST_NAME_MAX);
}

// ─────────────────────────────────────────────────────────────── /l/<code> parsing

/**
 * Recognise a share link. Accepts a full URL, a path, `/l/<code>` (the canonical form the
 * Function and the static-shell rewrite both serve) and `?l=<code>` (so a code still works
 * when pasted onto any page — the last degradation rung). Returns "" for everything else,
 * including anything too long to be a legitimate code.
 */
export function ngListParseSharePath(input) {
  if (typeof input !== "string" || !input) return "";
  let rest = input;
  const origin = rest.match(/^[a-z][a-z0-9+.\-]*:\/\/[^/]*(\/[\s\S]*)?$/i);
  if (origin) rest = origin[1] || "/";
  const hash = rest.indexOf("#");
  if (hash >= 0) rest = rest.slice(0, hash);
  let query = "";
  const q = rest.indexOf("?");
  if (q >= 0) { query = rest.slice(q + 1); rest = rest.slice(0, q); }

  const path = rest.match(/^\/l\/([^/]+)\/?$/);
  if (path) return nglValidCode(path[1]);

  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    if (pair.slice(0, eq) !== "l") continue;
    return nglValidCode(pair.slice(eq + 1));
  }
  return "";
}

function nglValidCode(code) {
  if (typeof code !== "string" || !code) return "";
  if (code.length > NG_LIST_CODE_CHAR_CAP) return "";
  return NGL_CODE_RE.test(code) ? code : "";
}

/** The canonical share URL for a code. */
export function ngListShareUrl(origin, code) {
  return String(origin || "").replace(/\/+$/, "") + "/l/" + String(code || "");
}

// ─────────────────────────────────────────────────────────────── link-preview text
// This is the ONLY thing the Cloudflare Function adds over the static shell: WhatsApp,
// Telegram and X fetch a shared link server-side and never run JavaScript, so the names of
// the techniques can only reach a preview from the edge.

function nglJoinWithin(names, prefix, budget) {
  let out = prefix;
  let used = 0;
  for (const raw of names) {
    const name = nglText(raw);
    if (!name) continue;
    const sep = used === 0 ? "" : ", ";
    if (out.length + sep.length + name.length > budget - (used === 0 ? 0 : 2)) break;
    out += sep + name;
    used++;
  }
  return { text: out, used: used };
}

export function ngShareOgTitle(names, total) {
  const list = Array.isArray(names) ? names : [];
  const n = Number.isFinite(total) && total > 0 ? Math.floor(total) : list.length;
  if (!n) return "A shared technique list · BJJGraph";
  const head = n === 1 ? "1 technique" : n + " techniques";
  const joined = nglJoinWithin(list, head + ": ", NGL_OG_TITLE_MAX - 2);
  if (!joined.used) return nglClamp(head + " shared on BJJGraph", NGL_OG_TITLE_MAX);
  return nglClamp(joined.used < n ? joined.text + " …" : joined.text, NGL_OG_TITLE_MAX);
}

export function ngShareOgDescription(names, total) {
  const list = Array.isArray(names) ? names : [];
  const n = Number.isFinite(total) && total > 0 ? Math.floor(total) : list.length;
  const tail = " — open to see them lit up on the BJJ knowledge graph, and drill them.";
  if (!n) return nglClamp("A shared technique list on the BJJ knowledge graph." + tail, NGL_OG_DESC_MAX);
  const head = n === 1 ? "1 technique" : n + " techniques";
  const joined = nglJoinWithin(list, head + " from this class: ", NGL_OG_DESC_MAX - tail.length - 2);
  const body = joined.used ? (joined.used < n ? joined.text + " …" : joined.text) : head + " from this class";
  return nglClamp(body + tail, NGL_OG_DESC_MAX);
}


// ─────────────────────────────────────────────────────────────── a list's ORDER (ORDER-OK, 23 Nov 2026)
// Move up / Move down change a list's order. The union above keeps THIS copy's order and appends the other's extras, and
// the no-echo key compares a list's items as a set, so before this an order never synced on purpose. A reorder records
// the list's whole order in a new top-level key of the progress blob, `listOrderAt`:
//   { "<listId>": [t, ["<nodeId>", …]] }
// ONE REGISTER PER LIST: the later `t` wins; on an exact tie the record whose array is first in string order wins, so
// every device keeps the same one. Written ONLY by a reorder. A list's shown order is DERIVED from its winning record
// (`ngListsApplyOrder`): its items, the union's and the move cells' result, sorted by their place in the record; items the
// record does not hold keep their relative order after it, so an add made after a reorder lands at the end, as adds do.
// Nothing is ever dropped: the derivation only sorts. The `lists` order is then a cache every current build re-derives, so
// an older build's stale order (it merges local first and keeps this key untouched through `_progressExtras`) is never
// adopted. WHY THE ORDER ITSELF AND NOT A STAMP ALONE: with a stamp alone an older build pushes its old order under the
// new stamp and a third device adopts it; with a stamp plus a fingerprint, two current devices each recompute a valid
// claim under one stamp and push them back and forth (both worked through before this was written; the report's
// "## Order, a hole in my own plan" and its correction). Trimmed to the NG_LIST_ORDER_CAP most recently reordered lists;
// a trimmed list falls back to the union's order.
export const NG_LIST_ORDER_CAP = 100;

function ngloTrim(m) {
  const ids = Object.keys(m);
  if (ids.length <= NG_LIST_ORDER_CAP) return m;
  ids.sort((a, b) => m[b][0] - m[a][0] || (a < b ? -1 : a > b ? 1 : 0));
  const out = {};
  for (const id of ids.slice(0, NG_LIST_ORDER_CAP)) out[id] = m[id];
  return out;
}

/** Sanitize an untrusted `listOrderAt`. Never throws; a fresh copy. */
export function ngListOrderNormalize(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const lid of Object.keys(raw)) {
    const rec = raw[lid];
    if (!lid || NGLM_UNSAFE.indexOf(lid) >= 0 || !Array.isArray(rec) || rec.length < 2) continue;
    const t = rec[0];
    if (!Number.isSafeInteger(t) || t <= 0 || !Array.isArray(rec[1])) continue;   // a safe integer only, as the cells (F5)
    const ids = [];
    for (const nid of rec[1]) {
      if (typeof nid !== "string" || !nid || ids.indexOf(nid) >= 0) continue;
      ids.push(nid);
      if (ids.length >= NG_LIST_ITEM_CAP) break;
    }
    if (ids.length) out[lid] = [t, ids];
  }
  return ngloTrim(out);
}

/** Two copies' records: per list the later stamp; an exact tie, the array first in string order. Commutative. */
export function ngListOrderMerge(a, b) {
  const A = ngListOrderNormalize(a), B = ngListOrderNormalize(b), out = {};
  for (const M of [A, B]) for (const lid of Object.keys(M)) {
    const r = M[lid], o = out[lid];
    if (!o || r[0] > o[0] || (r[0] === o[0] && JSON.stringify(r[1]) < JSON.stringify(o[1]))) out[lid] = [r[0], r[1].slice()];
  }
  return ngloTrim(out);
}

/** A reorder's record: the list's whole order now (a copy). */
export function ngListOrderSet(order, lid, t, ids) {
  const out = ngListOrderNormalize(order);
  if (!lid || NGLM_UNSAFE.indexOf(lid) >= 0 || !(t > 0) || !Array.isArray(ids)) return out;
  const clean = ngListOrderNormalize({ x: [t, ids] }).x;
  if (clean) out[lid] = clean;
  return ngloTrim(out);
}

/** The newest stamp among the records (a new record must be later than every record held). */
export function ngListOrderNewest(order) {
  let hi = 0;
  for (const lid of Object.keys(order || {})) { const r = order[lid]; if (Array.isArray(r) && r[0] > hi) hi = r[0]; }
  return hi;
}

/** Lists in their derived order (a copy): each list's items sorted by their place in its record; the rest after, in order. */
export function ngListsApplyOrder(lists, order) {
  const O = ngListOrderNormalize(order), out = {};
  for (const id of Object.keys(lists || {})) {
    const l = lists[id], rec = O[id];
    let items = l.items.slice();
    if (rec) {
      const pos = new Map(rec[1].map((nid, i) => [nid, i]));
      items = items.map((nid, i) => [nid, pos.has(nid) ? pos.get(nid) : rec[1].length + i]).sort((x, y) => x[1] - y[1]).map((x) => x[0]);
    }
    out[id] = { name: l.name, items: items, t: l.t };
  }
  return out;
}
