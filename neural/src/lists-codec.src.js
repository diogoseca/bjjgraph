// lists-codec.src.js — the share-link wire codec (format v1). PURE. No DOM, no globals.
//
// A share link carries a LIST OF GRAPH NODES in its URL ("these are the techniques we
// learned in today's class"). Two hard rules shape this file:
//
//  1. The wire encodes ORDINALS from node_ordinals.json — never a node's index in the
//     layout `nodes` array. That array is filesystem-ordered (graph.json is built from
//     an unsorted rglob), so one new content file silently renumbers it and an
//     index-encoded link would decode to a DIFFERENT set of techniques with no error.
//     Lists are STORED as node ids; only the wire uses ordinals.
//
//  2. Decoding is for UNTRUSTED input (a URL a stranger pasted). Nothing here throws on
//     decode — it returns {ok:false, error}. Recipients degrade, they never crash.
//
// Format v2 (current), bytes:
//     [0x02] varint(n-1) varint(d0) varint(d1) … varint(d(n-1))     base64url, unpadded
//   ordinals are sorted ascending and unique; d0 = o0, di = oi - o(i-1) - 1.
//   The "-1" is what makes duplicates and out-of-order sets UNREPRESENTABLE, so the
//   encoding is CANONICAL: one set of nodes has exactly one spelling, on every device.
//   That canonicality is also what makes analytics work — creator and recipient events
//   join on ngListShareId(code) for free, with no server round-trip.
//
//   `n` is the ITEM COUNT and it exists for exactly one reason: TRUNCATION MUST BE
//   DETECTABLE. WhatsApp, Telegram and mail clients clip and re-wrap long URLs — a real
//   event, not a theoretical one. Under v1 (no count, no checksum) a clipped code decoded
//   perfectly cleanly into a strict PREFIX of the class: measured, 198 of 955 prefixes of
//   real 2-13 item codes decoded silently, one of them turning a 12-technique class into a
//   1-technique one. With the count, the payload must hold EXACTLY n deltas and end there,
//   so every clipped code fails as `count_mismatch` / `truncated_varint` and the recipient
//   is told the link arrived damaged. Cost: ONE byte (2 base64 chars) per link.
//
//   Format v1 = the same thing without the count byte. It still DECODES (a code is a
//   permanent promise — links already pasted into group chats keep working) but is never
//   minted. Canonicality is per-version, and only v2 is ever emitted, so every code this
//   app produces is still the one spelling of its set.
//
// THREE CONSUMERS, ONE SOURCE: this file is a real ES module. `node --test` imports it
// directly (tests/share_lists_codec.test.mjs); a Cloudflare Pages Function can import it
// with a relative path; neural/build/build.mjs strips the `export ` keywords when it
// concatenates the file into the browser IIFE (it asserts the strip worked). Do not add
// `import` statements here — the bundle path cannot resolve them.

export const NG_LIST_WIRE_VERSION = 2;

// Versions this build can READ. Encoding always uses NG_LIST_WIRE_VERSION; decoding accepts
// every version ever minted, forever, for the same reason ordinals are never reused.
export const NG_LIST_WIRE_VERSIONS_READ = [1, 2];

// A gym class is 3-8 techniques. 60 is generous headroom and bounds the decoder's work.
export const NG_LIST_MAX_ITEMS = 60;

// A hostile URL must not be able to make us do real work. 512 chars is ~8x the longest
// legitimate 60-item code, and well inside every proxy/browser URL limit.
export const NG_LIST_MAX_CODE_CHARS = 512;

// ── WHAT A CLIPPED LINK LOOKS LIKE FROM THE OUTSIDE ─────────────────────────────────────────
// Detecting truncation is only half the job: the recipient has to be TOLD, and the caller can
// only tell them if it can recognise the shape. Chopping a code does NOT reliably produce a
// count error — measured over every prefix of a real 8-item code (23 chars, 22 prefixes):
//     not_base64url 10 · truncated_varint 7 · count_mismatch 4 · truncated 1
// The base64 layer refuses first the moment a cut lands mid-quantum (length % 4 == 1) or on
// non-zero trailing bits, and that is the MAJORITY of real clip positions. So `not_base64url`
// belongs in this set: it is what most cut links actually look like. Errors that a cut cannot
// produce (bad_version, too_long, too_many_items, non_canonical_varint, ordinal_out_of_range)
// stay out — those are a mistyped or hostile code, a different sentence to the user.
// Pinned by tests/share_lists_codec.test.mjs, which walks every prefix of real codes and
// asserts each failure lands in one bucket or the other.
export const NG_LIST_CLIP_ERRORS = [
  "count_mismatch",
  "truncated",
  "truncated_varint",
  "trailing_bytes",
  "not_base64url",
];

// Ordinals are minted 0,1,2,… and appended forever; 2^28 is ~180,000 years of content
// growth at this repo's rate, and it caps a varint at 4 bytes.
const MAX_ORDINAL = 0x0fffffff;

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64URL_INV = (() => {
  const inv = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64URL.length; i++) inv[B64URL.charCodeAt(i)] = i;
  return inv;
})();

// ---------------------------------------------------------------- base64url
// Hand-rolled rather than atob/btoa/Buffer: identical in a browser, a Worker and node,
// and — unlike atob — it can REJECT non-canonical spellings (padding, whitespace,
// non-zero trailing bits), which is what keeps one set == one string.

function bytesToB64url(bytes) {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64URL[(n >>> 18) & 63] + B64URL[(n >>> 12) & 63] + B64URL[(n >>> 6) & 63] + B64URL[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64URL[(n >>> 18) & 63] + B64URL[(n >>> 12) & 63];
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64URL[(n >>> 18) & 63] + B64URL[(n >>> 12) & 63] + B64URL[(n >>> 6) & 63];
  }
  return out;
}

function b64urlToBytes(code) {
  const len = code.length;
  if (len % 4 === 1) return null; // impossible length: 1 leftover char encodes nothing
  const full = len >> 2;
  const rem = len & 3;
  const bytes = new Uint8Array(full * 3 + (rem === 2 ? 1 : rem === 3 ? 2 : 0));
  let bi = 0;
  let ci = 0;
  const sextet = (k) => {
    const c = code.charCodeAt(k);
    return c < 128 ? B64URL_INV[c] : -1;
  };
  for (let g = 0; g < full; g++, ci += 4) {
    const a = sextet(ci), b = sextet(ci + 1), c = sextet(ci + 2), d = sextet(ci + 3);
    if (a < 0 || b < 0 || c < 0 || d < 0) return null;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    bytes[bi++] = (n >>> 16) & 255;
    bytes[bi++] = (n >>> 8) & 255;
    bytes[bi++] = n & 255;
  }
  if (rem === 2) {
    const a = sextet(ci), b = sextet(ci + 1);
    if (a < 0 || b < 0) return null;
    if (b & 15) return null; // non-canonical: trailing bits must be zero
    bytes[bi++] = ((a << 2) | (b >>> 4)) & 255;
  } else if (rem === 3) {
    const a = sextet(ci), b = sextet(ci + 1), c = sextet(ci + 2);
    if (a < 0 || b < 0 || c < 0) return null;
    if (c & 3) return null; // non-canonical: trailing bits must be zero
    bytes[bi++] = ((a << 2) | (b >>> 4)) & 255;
    bytes[bi++] = ((b << 4) | (c >>> 2)) & 255;
  }
  return bytes;
}

// ---------------------------------------------------------------- varint (LEB128)

function pushVarint(out, value) {
  let v = value;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v);
}

// ---------------------------------------------------------------- ordinals <-> code

/** Normalize any ordinal-ish input to a sorted unique int array, or null if unusable. */
export function ngListNormalizeOrdinals(ordinals) {
  if (!Array.isArray(ordinals)) return null;
  const seen = new Set();
  for (const raw of ordinals) {
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > MAX_ORDINAL) return null;
    seen.add(raw);
  }
  return Array.from(seen).sort((a, b) => a - b);
}

/**
 * Encode a set of ordinals into a share code. Throws on programmer error (an invalid
 * ordinal, an empty list, over the item cap) — encoding input is OUR data, not a stranger's.
 * Canonical: any permutation, with any duplicates, yields the identical string.
 */
export function ngListEncodeOrdinals(ordinals) {
  const sorted = ngListNormalizeOrdinals(ordinals);
  if (!sorted) throw new Error("ngListEncodeOrdinals: ordinals must be integers in [0, 2^28)");
  if (sorted.length === 0) throw new Error("ngListEncodeOrdinals: refusing to encode an empty list");
  if (sorted.length > NG_LIST_MAX_ITEMS) {
    throw new Error(`ngListEncodeOrdinals: ${sorted.length} items exceeds the cap of ${NG_LIST_MAX_ITEMS}`);
  }
  const bytes = [NG_LIST_WIRE_VERSION];
  pushVarint(bytes, sorted.length - 1); // count-1: a 0-item list is unrepresentable
  let prev = -1;
  for (const o of sorted) {
    pushVarint(bytes, o - prev - 1);
    prev = o;
  }
  return bytesToB64url(Uint8Array.from(bytes));
}

/**
 * Decode a share code. NEVER throws.
 * → {ok:true, ordinals:[…], version} | {ok:false, error:"<machine-readable reason>"}
 */
export function ngListDecodeOrdinals(code) {
  if (typeof code !== "string" || code.length === 0) return { ok: false, error: "empty" };
  if (code.length > NG_LIST_MAX_CODE_CHARS) return { ok: false, error: "too_long" };
  const bytes = b64urlToBytes(code);
  if (!bytes) return { ok: false, error: "not_base64url" };
  if (bytes.length < 2) return { ok: false, error: "truncated" };
  const version = bytes[0];
  if (NG_LIST_WIRE_VERSIONS_READ.indexOf(version) < 0) return { ok: false, error: "bad_version" };

  let i = 1;
  // one varint reader for the count and the deltas: the same minimality rule must apply to
  // both, or the count byte becomes a second spelling of a set.
  const readVarint = () => {
    let value = 0;
    let shift = 1;
    let consumed = 0;
    for (;;) {
      if (i >= bytes.length) return { error: consumed ? "truncated_varint" : "out_of_bytes" };
      const b = bytes[i++];
      consumed++;
      if (consumed > 4) return { error: "varint_overflow" };
      value += (b & 0x7f) * shift;
      if (!(b & 0x80)) break;
      shift *= 128;
    }
    if (consumed > 1 && bytes[i - 1] === 0) return { error: "non_canonical_varint" };
    return { value };
  };

  // v2 declares the item count up front — that declaration is the truncation detector.
  let declared = null;
  if (version >= 2) {
    const c = readVarint();
    if (c.error) return { ok: false, error: c.error === "out_of_bytes" ? "count_mismatch" : c.error };
    declared = c.value + 1;
    if (declared > NG_LIST_MAX_ITEMS) return { ok: false, error: "too_many_items" };
  }

  const ordinals = [];
  let prev = -1;
  while (declared == null ? i < bytes.length : ordinals.length < declared) {
    const d = readVarint();
    // out_of_bytes here means the wire promised N items and delivered fewer: a clipped link.
    if (d.error) return { ok: false, error: d.error === "out_of_bytes" ? "count_mismatch" : d.error };
    const ordinal = prev + 1 + d.value;
    if (ordinal > MAX_ORDINAL) return { ok: false, error: "ordinal_out_of_range" };
    ordinals.push(ordinal);
    prev = ordinal;
    if (ordinals.length > NG_LIST_MAX_ITEMS) return { ok: false, error: "too_many_items" };
  }
  if (declared != null && i !== bytes.length) return { ok: false, error: "trailing_bytes" };
  if (ordinals.length === 0) return { ok: false, error: "empty_list" };
  return { ok: true, ordinals, version };
}

// ---------------------------------------------------------------- ids <-> code
// `byId` / `byOrdinal` are the two directions of the ordinal manifest. Both a Map and a
// plain object are accepted so a caller can pass a fetched JSON blob unchanged.

function lookup(map, key) {
  if (!map) return undefined;
  if (typeof map.get === "function") return map.get(key);
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

/**
 * Node ids → share code. → {code, ids, missing}
 * `missing` = ids with no ordinal (a node from a newer build than the manifest); they are
 * OMITTED rather than fatal, so a stale manifest costs one technique, not the whole link.
 * `code` is "" when nothing resolved.
 */
export function ngListEncodeIds(ids, byId) {
  const list = Array.isArray(ids) ? ids : [];
  const ordinals = [];
  const missing = [];
  const kept = [];
  for (const id of list) {
    const o = lookup(byId, id);
    if (typeof o === "number" && Number.isInteger(o) && o >= 0) {
      ordinals.push(o);
      kept.push(id);
    } else {
      missing.push(id);
    }
  }
  if (ordinals.length === 0) return { code: "", ids: [], missing };
  return { code: ngListEncodeOrdinals(ordinals), ids: kept, missing };
}

/**
 * Share code → node ids. NEVER throws.
 * → {ok:true, ids:[…], ordinals:[…], unknown:[…]} | {ok:false, error}
 * `unknown` = ordinals this build has no node for (a link from a NEWER build, or a
 * retired node). The list still opens with what it could resolve — forward compatibility
 * is the whole reason ordinals are permanent and never reused.
 */
export function ngListDecodeIds(code, byOrdinal) {
  const res = ngListDecodeOrdinals(code);
  if (!res.ok) return res;
  const ids = [];
  const unknown = [];
  for (const o of res.ordinals) {
    const id = lookup(byOrdinal, o) ?? lookup(byOrdinal, String(o));
    if (typeof id === "string" && id) ids.push(id);
    else unknown.push(o);
  }
  return { ok: true, ids, ordinals: res.ordinals, unknown };
}

/**
 * Build the ordinal→id direction from an id→ordinal manifest (the lockfile's `ordinals`
 * block, or the `o` field carried on graph-data nodes).
 */
export function ngListOrdinalIndex(byId) {
  const out = new Map();
  const entries = byId && typeof byId.entries === "function" ? byId.entries() : Object.entries(byId || {});
  for (const [id, o] of entries) {
    if (typeof o === "number" && Number.isInteger(o) && o >= 0 && !out.has(o)) out.set(o, id);
  }
  return out;
}

/**
 * The analytics join key: first 12 chars of the code. Because the encoding is canonical,
 * the creator's share_id and every recipient's share_id are the same string for the same
 * set of techniques — a real viral funnel with no server state.
 *
 * CANONICALITY IS PER-VERSION, so one set of techniques has a v1 spelling and a v2 spelling and
 * therefore TWO share_ids. How the funnel handles that, stated once so nobody has to guess:
 *
 *   · v1 is never MINTED (see NG_LIST_WIRE_VERSION) — it only ever decodes. So no new link, and
 *     no `neural_share_list_created` event, can carry a v1 id. Every creator↔recipient join
 *     from here on is within v2, and joins exactly.
 *   · A v1 code can therefore only appear on the RECIPIENT side, from a link pasted into a group
 *     chat before the format bump. Those `neural_share_list_opened` rows join to no creator row
 *     and are counted as what they are: an unattributed open of a legacy link. They are NOT
 *     re-keyed to the v2 id — deriving one would mean re-encoding a stranger's ordinals and
 *     asserting the two ids are the same event, which is a guess dressed as data.
 *   · The two ids never COLLIDE: the version byte LEADS the wire, so the ids diverge within
 *     their first two characters (base64 packs 3 bytes into 4 chars, so 0x01 and 0x02 share the
 *     first char and differ in the second). A legacy open can never be conflated with a v2 one.
 *   · Consequence to expect in the dashboard: a small, decaying tail of creator-less opens. If
 *     that tail is ever big enough to matter, the fix is a `wire_version` property on the event
 *     (already available as `ngListDecodeOrdinals().version`), not a synthetic join.
 */
export function ngListShareId(code) {
  return typeof code === "string" ? code.slice(0, 12) : "";
}
