// tests/share_lists_store.test.mjs — the share-lists STORAGE + MERGE + link-text layer.
//
// The codec (tests/share_lists_codec.test.mjs) proves the wire format. This file proves the
// layer above it: what a coach's list looks like in the v2 progress blob, how two devices
// reconcile without a version bump, how a `/l/<code>` URL is parsed, and what a WhatsApp
// preview actually says. All pure — no browser, no build, no network.
//
// One source, three consumers: neural/src/lists.src.js is imported here, concatenated into
// the browser bundle by neural/build/build.mjs (exports stripped), and imported by the
// Cloudflare Pages Function at functions/l/[[path]].js. A second implementation of the
// merge rule or the og text would drift; there is deliberately only one.

import test from "node:test";
import assert from "node:assert/strict";

import {
  NG_LIST_NAME_MAX,
  NG_LIST_ITEM_CAP,
  NG_LIST_CODE_CHAR_CAP,
  ngListsNormalize,
  ngMergeLists,
  ngListDefaultName,
  ngListParseSharePath,
  ngShareOgTitle,
  ngShareOgDescription,
} from "../neural/src/lists.src.js";

import {
  NG_LIST_MAX_ITEMS,
  NG_LIST_MAX_CODE_CHARS,
} from "../neural/src/lists-codec.src.js";

// The two files share ONE scope in the browser bundle, so the caps cannot share a name (two
// `const NG_LIST_MAX_ITEMS` is a SyntaxError that deletes the whole app). They must still be
// the same number: a list the store accepts must be a list the wire can encode.
test("the store's cap mirrors the codec's cap exactly", () => {
  assert.equal(NG_LIST_ITEM_CAP, NG_LIST_MAX_ITEMS);
  assert.equal(NG_LIST_CODE_CHAR_CAP, NG_LIST_MAX_CODE_CHARS);
});

// ─────────────────────────────────────────────────────────── normalize (untrusted blob)

test("normalize accepts a well-formed lists blob unchanged in substance", () => {
  const out = ngListsNormalize({
    l1: {
      name: "Tuesday class",
      items: ["Positions/Mount", "Transitions/Armbar-from-Mount"],
      t: 17,
    },
  });
  assert.deepEqual(Object.keys(out), ["l1"]);
  assert.equal(out.l1.name, "Tuesday class");
  assert.deepEqual(out.l1.items, [
    "Positions/Mount",
    "Transitions/Armbar-from-Mount",
  ]);
  assert.equal(out.l1.t, 17);
});

test("normalize survives every corrupt shape rather than throwing", () => {
  // localStorage is user-writable and cloud rows outlive schema changes: a bad blob must
  // cost the lists, never the app.
  for (const bad of [
    null,
    undefined,
    42,
    "lists",
    [],
    { l1: null },
    { l1: 7 },
    { l1: { items: "x" } },
  ]) {
    const out = ngListsNormalize(bad);
    assert.equal(typeof out, "object");
    assert.ok(!Array.isArray(out));
  }
  assert.deepEqual(ngListsNormalize({ l1: { items: "x" } }), {});
  // a list with no usable items is dropped, not kept as an empty husk
  assert.deepEqual(
    ngListsNormalize({ l1: { name: "n", items: [1, 2, {}] } }),
    {},
  );
});

test("normalize clamps the name, dedupes items and enforces the item cap", () => {
  const long = "x".repeat(400);
  const many = Array.from(
    { length: NG_LIST_MAX_ITEMS + 25 },
    (_, i) => "N" + i,
  );
  const out = ngListsNormalize({
    a: { name: long, items: [...many, "N0", "N1"], t: 3 },
  });
  assert.equal(out.a.name.length, NG_LIST_NAME_MAX);
  assert.equal(out.a.items.length, NG_LIST_MAX_ITEMS);
  assert.equal(
    new Set(out.a.items).size,
    NG_LIST_MAX_ITEMS,
    "no duplicates survive",
  );
  assert.deepEqual(
    out.a.items.slice(0, 3),
    ["N0", "N1", "N2"],
    "the earliest picks win the cap",
  );
});

// ─────────────────────────────────────────────────────────── add-wins merge

test("merge is ADD-WINS: the union of lists and the union of their items", () => {
  const local = {
    a: { name: "Mine", items: ["X", "Y"], t: 10 },
    only_local: { name: "L", items: ["Z"], t: 1 },
  };
  const cloud = {
    a: { name: "Theirs", items: ["Y", "W"], t: 20 },
    only_cloud: { name: "C", items: ["Q"], t: 2 },
  };
  const out = ngMergeLists(local, cloud);
  assert.deepEqual(Object.keys(out).sort(), ["a", "only_cloud", "only_local"]);
  assert.deepEqual(
    out.a.items,
    ["X", "Y", "W"],
    "local order first, cloud extras appended",
  );
  assert.equal(out.a.name, "Theirs", "the later rename wins the name");
  assert.equal(out.a.t, 20);
  assert.deepEqual(out.only_local.items, ["Z"]);
  assert.deepEqual(out.only_cloud.items, ["Q"]);
});

test("merge is commutative in CONTENT and idempotent", () => {
  const local = { a: { name: "Mine", items: ["X", "Y"], t: 10 } };
  const cloud = {
    a: { name: "Theirs", items: ["Y", "W"], t: 20 },
    b: { name: "B", items: ["Q"], t: 5 },
  };
  const ab = ngMergeLists(local, cloud);
  const ba = ngMergeLists(cloud, local);
  assert.deepEqual(new Set(ab.a.items), new Set(ba.a.items));
  assert.equal(
    ab.a.name,
    ba.a.name,
    "name resolution is by timestamp, not by argument order",
  );
  assert.equal(ab.a.t, ba.a.t);
  assert.deepEqual(ngMergeLists(ab, ab), ab, "idempotent");
});

test("merge NEVER resurrects an item beyond the cap and never throws on junk", () => {
  const big = Array.from({ length: NG_LIST_MAX_ITEMS }, (_, i) => "A" + i);
  const out = ngMergeLists(
    { a: { name: "a", items: big, t: 1 } },
    { a: { name: "a", items: ["B0", "B1"], t: 2 } },
  );
  assert.equal(
    out.a.items.length,
    NG_LIST_MAX_ITEMS,
    "a merge cannot push a list over the wire cap",
  );
  assert.deepEqual(ngMergeLists(null, undefined), {});
  assert.deepEqual(ngMergeLists("x", 7), {});
});

test("a deletion loses to an add — that is the documented cost of add-wins", () => {
  // Deliberate: a coach who shares a list must never find it silently gone because another
  // device had an older blob. Losing a delete is recoverable (delete again); losing the
  // list a class was built from is not.
  const afterDeleteLocally = {};
  const cloudStillHasIt = { a: { name: "Tuesday", items: ["X"], t: 5 } };
  assert.deepEqual(
    Object.keys(ngMergeLists(afterDeleteLocally, cloudStillHasIt)),
    ["a"],
  );
});

// ─────────────────────────────────────────────────────────── default name

test("the default list name reads like a class, not like an id", () => {
  const name = ngListDefaultName(new Date("2026-08-09T19:30:00Z"));
  assert.match(name, /Aug/);
  assert.ok(name.length <= NG_LIST_NAME_MAX);
});

// ─────────────────────────────────────────────────────────── /l/<code> parsing

test("share path parsing accepts the shapes a real link arrives in", () => {
  assert.equal(ngListParseSharePath("/l/AQID"), "AQID");
  assert.equal(ngListParseSharePath("/l/AQID/"), "AQID");
  assert.equal(ngListParseSharePath("https://bjjgraph.org/l/AQID"), "AQID");
  assert.equal(
    ngListParseSharePath("https://bjjgraph.org/l/AQID?utm_source=whatsapp"),
    "AQID",
  );
  assert.equal(ngListParseSharePath("/l/AQID#x"), "AQID");
  // the no-Function fallback also honours a query form, so a link can be pasted anywhere
  assert.equal(ngListParseSharePath("/?l=AQID"), "AQID");
  assert.equal(ngListParseSharePath("/Positions/Mount?l=AQID"), "AQID");
});

test("share path parsing rejects everything that is not a share link", () => {
  for (const p of [
    "/",
    "/l",
    "/l/",
    "/list/AQID",
    "/Positions/Mount",
    "",
    null,
    undefined,
    7,
  ]) {
    assert.equal(ngListParseSharePath(p), "", `not a share link: ${String(p)}`);
  }
  // a hostile code never reaches the decoder as an over-long string
  assert.equal(ngListParseSharePath("/l/" + "A".repeat(9000)), "");
  // path segments are not URL-decoded into slashes
  assert.equal(ngListParseSharePath("/l/AQ%2FID"), "");
});

// ─────────────────────────────────────────────────────────── the WhatsApp preview text

test("og title NAMES the techniques — that is the whole point of the Function tier", () => {
  const names = ["Armbar from Mount", "Cross Collar Choke", "Mount"];
  const title = ngShareOgTitle(names, names.length);
  assert.match(title, /Armbar from Mount/);
  assert.match(title, /Cross Collar Choke/);
  assert.ok(
    title.length <= 90,
    `og:title must survive WhatsApp truncation, got ${title.length}`,
  );
});

test("og text degrades in every direction instead of lying", () => {
  assert.match(
    ngShareOgTitle([], 0),
    /technique/i,
    "no resolved names: still a sane title",
  );
  const many = Array.from({ length: 12 }, (_, i) => "Technique Number " + i);
  const t = ngShareOgTitle(many, 12);
  assert.match(t, /12 techniques/);
  assert.ok(t.length <= 90);
  const d = ngShareOgDescription(many, 12);
  assert.match(d, /Technique Number 0/);
  assert.ok(d.length <= 200, `og:description got ${d.length}`);
  // one technique reads singular
  assert.match(ngShareOgDescription(["Kimura"], 1), /1 technique\b/);
});

test("og text is PLAIN TEXT with markup characters stripped, never pre-escaped", () => {
  // The Function writes these through HTMLRewriter's setAttribute, which does its own
  // escaping — pre-escaping here would ship a visible `&amp;` in a WhatsApp preview. So the
  // contract is: strip the characters that could ever matter, escape nothing.
  const evil = 'Guard "pass" & <script>alert(1)</script>';
  for (const s of [
    ngShareOgTitle([evil], 1),
    ngShareOgDescription([evil], 1),
  ]) {
    assert.ok(
      !s.includes("<") && !s.includes(">"),
      "no angle brackets survive",
    );
    assert.ok(!s.includes('"'), "no double quote survives");
    assert.ok(
      !s.includes("&amp;"),
      "not pre-escaped (setAttribute owns escaping)",
    );
    assert.ok(!/\s{2,}/.test(s), "whitespace collapsed — a name is one line");
  }
});
