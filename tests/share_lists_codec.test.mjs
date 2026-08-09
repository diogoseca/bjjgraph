// Pure-unit suite for the share-link wire codec + the ordinal lockfile it rests on.
// No browser, no build, no network:   node --test tests/share_lists_codec.test.mjs
//
// What these tests are FOR: a share code is a public, permanent promise. If the encoding
// is not canonical, analytics can't join creator to recipient. If it is not stable across
// content additions, a link posted in a gym WhatsApp group silently starts pointing at
// different techniques. If the decoder is not strict, a hostile URL is our problem.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  NG_LIST_WIRE_VERSION,
  NG_LIST_MAX_ITEMS,
  NG_LIST_MAX_CODE_CHARS,
  ngListEncodeOrdinals,
  ngListDecodeOrdinals,
  ngListNormalizeOrdinals,
  ngListEncodeIds,
  ngListDecodeIds,
  ngListOrdinalIndex,
  ngListShareId,
} from "../neural/src/lists-codec.src.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(HERE, "..", p);
const LOCK = JSON.parse(readFileSync(R("node_ordinals.json"), "utf8"));
const LAYOUT = JSON.parse(readFileSync(R("source/quartz/static/globalGraphLayout.json"), "utf8"));
const BY_ID = LOCK.ordinals;
const BY_ORDINAL = ngListOrdinalIndex(BY_ID);

// Deterministic PRNG — no Math.random anywhere in this repo's test surface, so a failure
// is always reproducible from the printed seed.
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function sample(rand, pool, n) {
  const a = pool.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// ---------------------------------------------------------------- lockfile invariant

test("lockfile: every live graph node has a permanent ordinal", () => {
  const live = LAYOUT.nodes.map((n) => n.id);
  assert.equal(new Set(live).size, live.length, "layout must not contain duplicate node ids");
  const missing = live.filter((id) => typeof BY_ID[id] !== "number");
  assert.deepEqual(missing, [], "run `npm run regenerate:ordinals` and commit node_ordinals.json");
  // ordinals are unique, so the reverse index loses nothing
  assert.equal(BY_ORDINAL.size, Object.keys(BY_ID).length, "an ordinal is used by two nodes");
  assert.equal(LOCK.next_ordinal, Math.max(...Object.values(BY_ID)) + 1);
});

// ---------------------------------------------------------------- round-trip

test("round-trip: 400 seeded sets of real ordinals survive encode→decode", () => {
  const all = Object.values(BY_ID);
  const rand = lcg(20260809);
  for (let i = 0; i < 400; i++) {
    const n = 1 + Math.floor(rand() * NG_LIST_MAX_ITEMS);
    const set = sample(rand, all, n);
    const code = ngListEncodeOrdinals(set);
    const back = ngListDecodeOrdinals(code);
    assert.equal(back.ok, true, `decode failed for n=${n}: ${back.error}`);
    assert.deepEqual(back.ordinals, [...new Set(set)].sort((a, b) => a - b));
    assert.equal(back.version, NG_LIST_WIRE_VERSION);
  }
});

test("round-trip: boundary ordinals (0, 127/128 varint seam, max, dense runs)", () => {
  const cases = [
    [0],
    [0, 1],
    [0, 0x0fffffff],
    [126, 127, 128, 129],
    [16383, 16384, 16385],
    [2097151, 2097152],
    Array.from({ length: NG_LIST_MAX_ITEMS }, (_, i) => i), // densest possible list
    Array.from({ length: NG_LIST_MAX_ITEMS }, (_, i) => i * 65536), // sparsest realistic
  ];
  for (const set of cases) {
    const back = ngListDecodeOrdinals(ngListEncodeOrdinals(set));
    assert.equal(back.ok, true, `failed: ${set.slice(0, 4)}… ${back.error}`);
    assert.deepEqual(back.ordinals, set);
  }
});

// ---------------------------------------------------------------- canonicality

test("canonicality: the same SET always encodes to the same string", () => {
  const all = Object.values(BY_ID);
  const rand = lcg(777);
  for (let i = 0; i < 200; i++) {
    const set = sample(rand, all, 1 + Math.floor(rand() * 12));
    const canonical = ngListEncodeOrdinals(set);
    // every permutation
    for (let k = 0; k < 5; k++) {
      assert.equal(ngListEncodeOrdinals(sample(rand, set, set.length)), canonical, "order leaked into the wire");
    }
    // duplicates
    assert.equal(ngListEncodeOrdinals([...set, ...set]), canonical, "duplicates leaked into the wire");
    // pre-sorted
    assert.equal(ngListEncodeOrdinals(set.slice().sort((a, b) => a - b)), canonical);
  }
});

test("canonicality: encode(decode(code)) === code for every code we emit", () => {
  const all = Object.values(BY_ID);
  const rand = lcg(31337);
  for (let i = 0; i < 300; i++) {
    const code = ngListEncodeOrdinals(sample(rand, all, 1 + Math.floor(rand() * 20)));
    const back = ngListDecodeOrdinals(code);
    assert.equal(back.ok, true);
    assert.equal(ngListEncodeOrdinals(back.ordinals), code, "a set has two spellings — analytics would fork");
  }
});

test("canonicality: share_id joins creator and recipient without a server", () => {
  const set = sample(lcg(5), Object.values(BY_ID), 5);
  const creator = ngListEncodeOrdinals(set);
  const recipient = ngListEncodeOrdinals(ngListDecodeOrdinals(creator).ordinals);
  assert.equal(ngListShareId(creator), ngListShareId(recipient));
  assert.equal(ngListShareId(creator).length, 12);
  assert.equal(ngListShareId(undefined), "");
});

// ---------------------------------------------------------------- rejection

// Each case asserts the EXACT reason. Asserting only `ok === false` let a mutant that
// deleted the 512-char cap pass, because an over-length string happened to be caught
// later by the alphabet check — the guard under test was never the one that fired.
test("rejection: malformed, hostile and non-canonical input never throws and never decodes", () => {
  const bad = {
    empty: ["", "empty"],
    not_a_string_null: [null, "empty"],
    not_a_string_number: [42, "empty"],
    // length % 4 == 0 and all-legal characters, so ONLY the length cap can reject it
    too_long: ["A".repeat(NG_LIST_MAX_CODE_CHARS + 4), "too_long"],
    padded_base64: [ngListEncodeOrdinals([5]) + "==", "not_base64url"],
    plain_base64_chars: ["AQ+/", "not_base64url"],
    whitespace: [" AQE", "not_base64url"],
    trailing_newline: [ngListEncodeOrdinals([5]) + "\n", "not_base64url"],
    unicode: ["AQ€", "not_base64url"],
    impossible_length: ["A", "not_base64url"], // 1 leftover char encodes no byte
    header_only: ["AQ", "truncated"], // version byte, no items
    bad_version_0: ["AAE", "bad_version"], // 0x00 0x01
    bad_version_2: ["AgE", "bad_version"], // 0x02 0x01
    bad_version_ff: ["_wE", "bad_version"], // 0xff 0x01
  };
  for (const [name, [code, want]] of Object.entries(bad)) {
    const res = ngListDecodeOrdinals(code);
    assert.equal(res.ok, false, `${name} was ACCEPTED`);
    assert.equal(res.error, want, `${name} rejected for the wrong reason`);
  }
});

// These are byte-level attacks, so build the bytes then base64url them the same way the
// encoder does — proving the DECODER rejects them rather than the alphabet.
function b64url(bytes) {
  return Buffer.from(Uint8Array.from(bytes)).toString("base64url");
}

test("rejection: byte-level attacks (truncation, overflow, non-minimal varints)", () => {
  const attacks = {
    truncated_varint: [[1, 0x80], "truncated_varint"], // continuation bit set, stream ends
    truncated_varint_long: [[1, 0x80, 0x80, 0x80], "truncated_varint"],
    varint_overflow: [[1, 0x80, 0x80, 0x80, 0x80, 0x01], "varint_overflow"], // 5 bytes
    non_minimal_two_byte: [[1, 0x81, 0x00], "non_canonical_varint"], // redundant zero byte
    non_minimal_after_valid: [[1, 0x05, 0x82, 0x00], "non_canonical_varint"],
  };
  for (const [name, [bytes, want]] of Object.entries(attacks)) {
    const res = ngListDecodeOrdinals(b64url(bytes));
    assert.equal(res.ok, false, `${name} was ACCEPTED as ${JSON.stringify(res.ordinals)}`);
    assert.equal(res.error, want, `${name} rejected for the wrong reason (guard under test never fired)`);
  }
  // control: the same shape, spelled minimally, IS accepted (delta 1 + 1*128 = 129)
  assert.deepEqual(ngListDecodeOrdinals(b64url([1, 0x81, 0x01])).ordinals, [129]);
});

test("rejection: non-zero trailing bits are a second spelling and are refused", () => {
  // BOTH partial-group shapes must be covered: a code whose length % 4 is 3 (one spare
  // byte) and one whose length % 4 is 2 (two spare bytes) go through DIFFERENT guards.
  // Testing only one let a mutant that deleted the other survive.
  const codes = { rem3: ngListEncodeOrdinals([5]), rem2: ngListEncodeOrdinals([5, 200]) };
  assert.equal(codes.rem3.length % 4, 3, "expected a 2-byte payload → 3 chars");
  assert.equal(codes.rem2.length % 4, 2, "expected a 4-byte payload → 6 chars");

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  for (const [shape, code] of Object.entries(codes)) {
    let rejected = 0;
    for (const ch of alphabet) {
      const alt = code.slice(0, -1) + ch;
      if (alt === code) continue;
      const res = ngListDecodeOrdinals(alt);
      if (res.ok) {
        // any accepted variant MUST re-encode to itself, or one set has two spellings
        assert.equal(ngListEncodeOrdinals(res.ordinals), alt, `${alt} is a second spelling of a set`);
      } else {
        rejected++;
      }
    }
    assert.ok(rejected > 0, `${shape}: no trailing-bit variant was rejected — the codec is not canonical`);
  }
});

test("rejection: over the item cap, both directions", () => {
  const over = Array.from({ length: NG_LIST_MAX_ITEMS + 1 }, (_, i) => i);
  assert.throws(() => ngListEncodeOrdinals(over), /exceeds the cap/);
  // a hand-built oversize payload is refused by the decoder too
  const bytes = [1];
  for (let i = 0; i < NG_LIST_MAX_ITEMS + 5; i++) bytes.push(0);
  assert.equal(ngListDecodeOrdinals(b64url(bytes)).error, "too_many_items");
});

test("rejection: encoder refuses garbage input rather than emitting a lie", () => {
  for (const bad of [[], [-1], [1.5], [NaN], [Infinity], ["7"], [null], [undefined], [0x10000000], "nope", null]) {
    assert.throws(() => ngListEncodeOrdinals(bad), Error, `accepted ${JSON.stringify(bad)}`);
  }
  assert.equal(ngListNormalizeOrdinals([3, 1, 3, 2]).join(","), "1,2,3");
  assert.equal(ngListNormalizeOrdinals([1, -2]), null);
});

// ---------------------------------------------------------------- THE point of ordinals

test("stability: a content addition renumbers the raw node array but NOT the share code", () => {
  // Five nodes as a coach would pick them after one mount class — real ids from the
  // live layout, deliberately scattered across the ordinal space (76 … 1447).
  const classIds = [
    "Positions/Mount",
    "Submissions/Armbar/from-Mount",
    "Submissions/Cross-Collar-Choke/from-Mount",
    "Transitions/Elbow-Escape-from-Mount",
    "Transitions/Trap-and-Roll-from-Mount",
  ];
  for (const id of classIds) {
    assert.equal(typeof BY_ID[id], "number", `${id} must exist in the lockfile for this test to mean anything`);
  }

  const before = LAYOUT.nodes.map((n) => n.id);
  const idxBefore = new Map(before.map((id, i) => [id, i]));

  // Simulate what regenerate_graph.py's unsorted rglob actually does when one content
  // file is added: a new id appears at an arbitrary position and everything after it
  // shifts. (Verified empirically: adding 1 file to a 7-file dir moved 2 of the 7.)
  const after = before.slice();
  after.splice(3, 0, "Transitions/Brand-New-Technique");
  const idxAfter = new Map(after.map((id, i) => [id, i]));

  const shifted = classIds.filter((id) => idxBefore.get(id) !== idxAfter.get(id));
  assert.ok(shifted.length > 0, "the array-index hazard must be real for this test to mean anything");

  // (a) an index-encoded link would silently change meaning
  const idxCode = (m) => ngListEncodeOrdinals(classIds.map((id) => m.get(id)));
  assert.notEqual(idxCode(idxBefore), idxCode(idxAfter), "expected index encoding to drift");
  // …and decode to the WRONG techniques: the old code read against the new array
  const staleIndices = ngListDecodeOrdinals(idxCode(idxBefore)).ordinals;
  const staleIds = staleIndices.map((i) => after[i]);
  assert.notDeepEqual(
    staleIds.slice().sort(),
    classIds.slice().sort(),
    "index encoding must be shown to corrupt, or fact 1 is not being tested",
  );

  // (b) the ORDINAL encoding is byte-identical, and the lockfile append cannot move it
  const ordCode = ngListEncodeIds(classIds, BY_ID).code;
  const afterLock = { ...BY_ID, "Transitions/Brand-New-Technique": LOCK.next_ordinal };
  assert.equal(ngListEncodeIds(classIds, afterLock).code, ordCode, "ordinal code drifted after an append");
  const decoded = ngListDecodeIds(ordCode, ngListOrdinalIndex(afterLock));
  assert.deepEqual(decoded.ids.slice().sort(), classIds.slice().sort());
  assert.deepEqual(decoded.unknown, []);
});

test("ids: a stale manifest costs one technique, never the whole link", () => {
  const ids = sample(lcg(11), Object.keys(BY_ID), 4);
  const withGhost = [...ids, "Transitions/Node-From-A-Newer-Build"];
  const enc = ngListEncodeIds(withGhost, BY_ID);
  assert.deepEqual(enc.missing, ["Transitions/Node-From-A-Newer-Build"]);
  assert.deepEqual(enc.ids.slice().sort(), ids.slice().sort());

  // recipient on an OLDER build: an ordinal it has never heard of is reported, not fatal
  const older = ngListOrdinalIndex(BY_ID);
  const highest = Math.max(...enc.ids.map((i) => BY_ID[i]));
  older.delete(highest);
  const dec = ngListDecodeIds(enc.code, older);
  assert.equal(dec.ok, true);
  assert.equal(dec.ids.length, enc.ids.length - 1);
  assert.deepEqual(dec.unknown, [highest]);

  assert.deepEqual(ngListEncodeIds([], BY_ID), { code: "", ids: [], missing: [] });
  assert.deepEqual(ngListEncodeIds(["nope"], BY_ID).code, "");
  assert.equal(ngListDecodeIds("!!!", BY_ORDINAL).ok, false);
  // a plain-object manifest (fetched JSON, string keys) works unchanged
  assert.deepEqual(ngListDecodeIds(enc.code, { ...Object.fromEntries([...BY_ORDINAL]) }).ids.sort(), enc.ids.sort());
});

// ---------------------------------------------------------------- measured URL length

test("measured: real 5- and 12-item codes fit a WhatsApp message comfortably", () => {
  const all = Object.values(BY_ID);
  const rand = lcg(4242);
  const base = "https://bjjgraph.org/l/";
  const report = [];
  for (const n of [5, 12]) {
    let sum = 0;
    let max = 0;
    for (let i = 0; i < 2000; i++) {
      const len = ngListEncodeOrdinals(sample(rand, all, n)).length;
      sum += len;
      if (len > max) max = len;
    }
    const mean = sum / 2000;
    report.push(
      `${String(n).padStart(2)} items: code mean ${mean.toFixed(1)} / worst ${max} chars` +
        `  →  URL mean ${(base.length + mean).toFixed(1)} / worst ${base.length + max}`,
    );
    assert.ok(max <= NG_LIST_MAX_CODE_CHARS, "a realistic list must never approach the decoder's cap");
  }
  // the densest legal list is still a short URL
  const worst = ngListEncodeOrdinals(sample(rand, all, NG_LIST_MAX_ITEMS)).length;
  report.push(`${NG_LIST_MAX_ITEMS} items (the cap): ${worst} chars → URL ${base.length + worst}`);
  console.log("\n  MEASURED SHARE-LINK LENGTHS (1467 live nodes, ordinals 0-1466)\n  " + report.join("\n  ") + "\n");
  assert.ok(worst < NG_LIST_MAX_CODE_CHARS);
});

// ---------------------------------------------------------------- bundle safety

test("bundle safety: the codec stays concatenatable into the neural IIFE", () => {
  const src = readFileSync(R("neural/src/lists-codec.src.js"), "utf8");
  // neural/build/build.mjs concatenates raw text; an `import` could not be resolved and an
  // `export` survives into an IIFE as a syntax error. This is the same class of silent
  // breakage as the .gitignore allow-list: it would only surface as a dead bundle.
  assert.equal(/^\s*import\s/m.test(src), false, "no import statements — the bundle path cannot resolve them");
  const stripped = src.replace(/^export (function|const) /gm, "$1 ");
  assert.equal(/^\s*export\s/m.test(stripped), false, "an export survived the build.mjs strip regex");
  assert.notEqual(stripped, src, "the strip regex matched nothing — build.mjs and this file disagree");
  new Function(`${stripped}\nreturn ngListEncodeOrdinals([1,2,3]);`)(); // must parse and run
});
