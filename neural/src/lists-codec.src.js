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
// Format v1, bytes:
//     [0x01] varint(d0) varint(d1) …            base64url, unpadded
//   ordinals are sorted ascending and unique; d0 = o0, di = oi - o(i-1) - 1.
//   The "-1" is what makes duplicates and out-of-order sets UNREPRESENTABLE, so the
//   encoding is CANONICAL: one set of nodes has exactly one spelling, on every device.
//   That canonicality is also what makes analytics work — creator and recipient events
//   join on ngListShareId(code) for free, with no server round-trip.
//
// THREE CONSUMERS, ONE SOURCE: this file is a real ES module. `node --test` imports it
// directly (tests/share_lists_codec.test.mjs); a Cloudflare Pages Function can import it
// with a relative path; neural/build/build.mjs strips the `export ` keywords when it
// concatenates the file into the browser IIFE (it asserts the strip worked). Do not add
// `import` statements here — the bundle path cannot resolve them.

export const NG_LIST_WIRE_VERSION = 1;

// A gym class is 3-8 techniques. 60 is generous headroom and bounds the decoder's work.
export const NG_LIST_MAX_ITEMS = 60;

// A hostile URL must not be able to make us do real work. 512 chars is ~8x the longest
// legitimate 60-item code, and well inside every proxy/browser URL limit.
export const NG_LIST_MAX_CODE_CHARS = 512;

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
  if (bytes[0] !== NG_LIST_WIRE_VERSION) return { ok: false, error: "bad_version" };

  const ordinals = [];
  let prev = -1;
  let i = 1;
  while (i < bytes.length) {
    let delta = 0;
    let shift = 1;
    let consumed = 0;
    for (;;) {
      if (i >= bytes.length) return { ok: false, error: "truncated_varint" };
      const b = bytes[i++];
      consumed++;
      if (consumed > 4) return { ok: false, error: "varint_overflow" };
      delta += (b & 0x7f) * shift;
      if (!(b & 0x80)) break;
      shift *= 128;
    }
    if (consumed > 1 && bytes[i - 1] === 0) return { ok: false, error: "non_canonical_varint" };
    const ordinal = prev + 1 + delta;
    if (ordinal > MAX_ORDINAL) return { ok: false, error: "ordinal_out_of_range" };
    ordinals.push(ordinal);
    prev = ordinal;
    if (ordinals.length > NG_LIST_MAX_ITEMS) return { ok: false, error: "too_many_items" };
  }
  if (ordinals.length === 0) return { ok: false, error: "empty_list" };
  return { ok: true, ordinals, version: NG_LIST_WIRE_VERSION };
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
 */
export function ngListShareId(code) {
  return typeof code === "string" ? code.slice(0, 12) : "";
}
