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
      t: Number.isFinite(t) && t > 0 ? t : 0,
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
 * that is already posted in a WhatsApp group) is not.
 */
export function ngMergeLists(local, cloud) {
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
