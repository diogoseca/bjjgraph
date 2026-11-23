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
  NG_LIST_MARK_CAP,
  ngListMarksNormalize,
  ngListMarksMerge,
  ngListMarksSet,
  ngListMarksCount,
  ngListMarksNewest,
  ngListsApplyMarks,
  NG_LIST_ORDER_CAP,
  ngListOrderNormalize,
  ngListOrderMerge,
  ngListOrderSet,
  ngListOrderNewest,
  ngListsApplyOrder,
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


// ─────────────────────────────────────────────── a MOVE between lists: the item cells (LISTS-R, ruling 2)
// Two devices in sync hold S = {X, Y} and T = {Z}. Device A moves X from S to T (one stamp: out of S, into T). Before
// these cells, B's next pull put X back in S (the union), and A's next pull took it from B's push: a move became a copy
// (LISTS-A measured it with this very function). Each case below is one of the orchestrator's invariants.
const L = (items, t, name = "L") => ({ name, items, t });
const synced = () => ({ S: L(["X", "Y"], 100, "Monday"), T: L(["Z"], 90, "Guard") });
const moveOnA = () => {
  const lists = synced();
  lists.T.items.push("X"); lists.T.t = 201;
  lists.S.items = ["Y"]; lists.S.t = 201;
  let marks = ngListMarksSet({}, "S", "X", 201, 0);
  marks = ngListMarksSet(marks, "T", "X", 201, 1);
  return { lists, marks };
};
const items = (lists) => Object.fromEntries(Object.keys(lists).sort().map((k) => [k, lists[k].items.slice().sort()]));

test("a move stays a move on the other device: X in the target only, in both merge orders", () => {
  const A = moveOnA();
  const B = synced(); // B never saw the move: its copy still holds X in S
  for (const [l, c] of [[B, A.lists], [A.lists, B]]) {
    const merged = ngMergeLists(l, c, A.marks);
    assert.deepEqual(items(merged), { S: ["Y"], T: ["X", "Z"] });
  }
  // and the union alone (no cells) is today's add-wins: the move would have come back as a copy
  assert.deepEqual(items(ngMergeLists(B, A.lists)), { S: ["X", "Y"], T: ["X", "Z"] });
});

test("an older build's union is healed by the next current merge (it re-adds X to S and pushes that)", () => {
  const A = moveOnA();
  const older = ngMergeLists(synced(), A.lists); // an older client: no cells read, X back in S, and it pushes this
  const healed = ngMergeLists(A.lists, older, A.marks);
  assert.deepEqual(items(healed), { S: ["Y"], T: ["X", "Z"] });
});

test("moving a list's last item: the source is gone on every device, not resurrected by a stale copy", () => {
  const before = { S: L(["X"], 100), T: L(["Z"], 90) };
  const after = { T: L(["Z", "X"], 201) }; // removeFromList drops an emptied list
  let marks = ngListMarksSet({}, "S", "X", 201, 0);
  marks = ngListMarksSet(marks, "T", "X", 201, 1);
  assert.deepEqual(items(ngMergeLists(before, after, marks)), { T: ["X", "Z"] });
  assert.deepEqual(items(ngMergeLists(after, before, marks)), { T: ["X", "Z"] });
});

test("THE NO-LOSS GUARD: an 'out' never removes an item's last place", () => {
  // the target is gone on every device (deleted twice): X stays in the source
  const lists = { S: L(["X", "Y"], 100) };
  const marks = ngListMarksSet(ngListMarksSet({}, "S", "X", 201, 0), "T", "X", 201, 1);
  assert.deepEqual(items(ngListsApplyMarks(lists, marks)), { S: ["X", "Y"] });
  // the target was capped by the union (both devices filled it): X is not in T, so it stays in S
  const full = Array.from({ length: NG_LIST_ITEM_CAP }, (_, i) => "n" + i);
  const a = { S: L(["X"], 100), T: L(full, 300) };
  const b = { S: L(["X"], 100), T: L(["X"], 201) };
  const merged = ngMergeLists(a, b, marks);
  assert.equal(merged.T.items.length, NG_LIST_ITEM_CAP);
  assert.equal(merged.T.items.indexOf("X"), -1, "the cap kept the earlier picks");
  assert.deepEqual(merged.S.items, ["X"], "X keeps its last place");
});

test("a re-add after a move beats the old 'out'; a tie goes to 'in'", () => {
  const out = ngListMarksSet({}, "S", "X", 201, 0);
  const back = ngListMarksSet(out, "S", "X", 305, 1);
  const lists = { S: L(["X", "Y"], 305), T: L(["X"], 201) };
  assert.deepEqual(items(ngListsApplyMarks(lists, ngListMarksMerge(out, back))), { S: ["X", "Y"], T: ["X"] });
  assert.deepEqual(items(ngListsApplyMarks(lists, ngListMarksMerge(back, out))), { S: ["X", "Y"], T: ["X"] });
  const tieOut = ngListMarksSet({}, "S", "X", 400, 0), tieIn = ngListMarksSet({}, "S", "X", 400, 1);
  assert.deepEqual(ngListMarksMerge(tieOut, tieIn), { S: { X: [400, 1] } });
  assert.deepEqual(ngListMarksMerge(tieIn, tieOut), { S: { X: [400, 1] } });
});

test("two devices moving different items at once both land", () => {
  const base = { S: L(["X", "Y"], 100), T: L(["Z"], 90), U: L(["W"], 80) };
  const a = JSON.parse(JSON.stringify(base)); a.S.items = ["Y"]; a.T.items.push("X");
  const b = JSON.parse(JSON.stringify(base)); b.S.items = ["X"]; b.U.items.push("Y");
  const ma = ngListMarksSet(ngListMarksSet({}, "S", "X", 201, 0), "T", "X", 201, 1);
  const mb = ngListMarksSet(ngListMarksSet({}, "S", "Y", 202, 0), "U", "Y", 202, 1);
  const marks = ngListMarksMerge(ma, mb);
  // S loses both items, so S is gone; X in T, Y in U
  assert.deepEqual(items(ngMergeLists(a, b, marks)), { T: ["X", "Z"], U: ["W", "Y"] });
  assert.deepEqual(items(ngMergeLists(b, a, marks)), { T: ["X", "Z"], U: ["W", "Y"] });
});

test("an Undo writes newer cells, so it syncs like the move did", () => {
  const A = moveOnA();
  // undo on A: X back in S, out of T (T had no X before)
  let marks = ngListMarksSet(A.marks, "S", "X", 250, 1);
  marks = ngListMarksSet(marks, "T", "X", 250, 0);
  const aUndone = { S: L(["X", "Y"], 250), T: L(["Z"], 250) };
  const bMoved = A.lists; // B had pulled the move before the undo
  assert.deepEqual(items(ngMergeLists(bMoved, aUndone, marks)), { S: ["X", "Y"], T: ["Z"] });
  assert.deepEqual(items(ngMergeLists(aUndone, bMoved, ngListMarksMerge(A.marks, marks))), { S: ["X", "Y"], T: ["Z"] });
});

test("the cells merge commutatively and idempotently, and the trim keeps the same set on every device", () => {
  const mk = (n, base, f, p) => { let m = {}; for (let i = 0; i < n; i++) m = ngListMarksSet(m, "L" + (i % 7), p + i, base + i, f); return m; };
  const a = mk(150, 1000, 0, "a"), b = mk(150, 1100, 1, "b"); // 300 distinct cells between them
  const ab = ngListMarksMerge(a, b), ba = ngListMarksMerge(b, a);
  assert.deepEqual(ab, ba);
  assert.deepEqual(ngListMarksMerge(ab, ab), ab);
  assert.equal(ngListMarksCount(ab), NG_LIST_MARK_CAP, "trimmed to the cap");
  assert.equal(ngListMarksNewest(ab), 1249);
  // the oldest go first: every kept stamp is above every dropped one
  const kept = []; for (const l of Object.keys(ab)) for (const n of Object.keys(ab[l])) kept.push(ab[l][n][0]);
  // the 200 newest of 1000..1149 and 1100..1249 start at 1100 (b's 150, and a's 50 newest)
  assert.equal(Math.min(...kept), 1100);
  // equal stamps: the order is total (list id, then item id), so a trim of a tie is the same on both sides
  let ties = {}; for (let i = 0; i < NG_LIST_MARK_CAP + 5; i++) ties = ngListMarksSet(ties, "L" + (i % 3), "t" + i, 777, 0);
  const t1 = ngListMarksMerge(ties, {}), t2 = ngListMarksMerge({}, ties);
  assert.deepEqual(t1, t2);
  assert.equal(ngListMarksCount(t1), NG_LIST_MARK_CAP);
  // a trimmed 'out' cell returns its pair to add-wins: it never removes anything
  const lists = { S: L(["X"], 1), T: L(["X"], 1) };
  assert.deepEqual(items(ngListsApplyMarks(lists, {})), { S: ["X"], T: ["X"] });
});

test("junk cells are dropped, never thrown on, and an unsafe key never reaches a prototype", () => {
  const raw = JSON.parse('{"S":{"X":[201,0],"Y":[0,0],"Z":[201,2],"W":"x","V":[NaN,1]},"__proto__":{"X":[1,1]},"T":[],"U":{"__proto__":[5,0]}}'.replace("NaN", "null"));
  const m = ngListMarksNormalize(raw);
  assert.deepEqual(m, { S: { X: [201, 0] } });
  assert.equal(({}).X, undefined);
  for (const junk of [null, undefined, 3, "x", [], [[1, 0]]]) assert.deepEqual(ngListMarksNormalize(junk), {});
  assert.deepEqual(items(ngMergeLists({ S: L(["X"], 1) }, {}, "junk")), { S: ["X"] });
});

test("without cells the merge is exactly today's add-wins (an account that never moved is untouched)", () => {
  const a = { S: L(["X", "Y"], 100), T: L(["Z"], 90) }, b = { S: L(["Y", "Q"], 120), T: L(["Z"], 95) };
  assert.deepEqual(ngMergeLists(a, b, {}), ngMergeLists(a, b));
  assert.deepEqual(ngMergeLists(a, b, undefined), ngMergeLists(a, b));
});


// ─────────────────────────────────────────────── a list's ORDER: the record (ORDER-OK)
// A and B in sync hold S = [X, Y, Z]. A moves Z up twice: [Z, X, Y], recorded as listOrderAt.S = [t, [Z, X, Y]].
const ordered = (lists) => Object.fromEntries(Object.keys(lists).sort().map((k) => [k, lists[k].items.slice()]));
const reorderA = () => ({ lists: { S: L(["Z", "X", "Y"], 100, "Monday") }, order: ngListOrderSet({}, "S", 300, ["Z", "X", "Y"]) });

test("a reorder stays a reorder on the other device, in both merge orders", () => {
  const A = reorderA(), B = { S: L(["X", "Y", "Z"], 100, "Monday") };
  for (const [l, c] of [[B, A.lists], [A.lists, B]]) assert.deepEqual(ordered(ngMergeLists(l, c, {}, A.order)), { S: ["Z", "X", "Y"] });
  // and without the record, today's rule: each copy keeps its own order
  assert.deepEqual(ordered(ngMergeLists(B, A.lists)), { S: ["X", "Y", "Z"] });
});

test("an add made on the other device at the same time lands after the reorder (the later t alone would have lost it)", () => {
  const A = reorderA();
  const B = { S: L(["X", "Y", "Z", "W"], 400, "Monday") }; // B added W, LATER than A's reorder, without having seen it
  for (const [l, c] of [[B, A.lists], [A.lists, B]]) assert.deepEqual(ordered(ngMergeLists(l, c, {}, A.order)), { S: ["Z", "X", "Y", "W"] });
});

test("an older build's stale order is never adopted: the order is derived from the record, not the copy", () => {
  const A = reorderA();
  // an older build: it merged local first (its old order) and kept the record untouched through its extras, then pushed
  const older = { S: L(["X", "Y", "Z"], 500, "Monday") };
  const third = { S: L(["X", "Y", "Z"], 100, "Monday") }; // a current device that never held the reorder
  assert.deepEqual(ordered(ngMergeLists(third, older, {}, A.order)), { S: ["Z", "X", "Y"] });
  assert.deepEqual(ordered(ngListsApplyOrder(older, A.order)), { S: ["Z", "X", "Y"] }, "and on a plain load of that copy");
});

test("the order only sorts: nothing is dropped, and items the record lacks keep their order after it", () => {
  const order = ngListOrderSet({}, "S", 300, ["Z", "X", "GONE"]);
  const lists = { S: L(["A1", "X", "B1", "Z"], 1) };
  assert.deepEqual(ordered(ngListsApplyOrder(lists, order)), { S: ["Z", "X", "A1", "B1"] });
  assert.equal(ngListsApplyOrder(lists, order).S.items.length, 4);
  // with the move's cells: X moved out of S to T; the order applies to what is left
  const marks = ngListMarksSet(ngListMarksSet({}, "S", "X", 400, 0), "T", "X", 400, 1);
  const merged = ngMergeLists({ S: L(["A1", "X", "B1", "Z"], 1), T: L(["Q"], 1) }, { T: L(["Q", "X"], 400) }, marks, order);
  assert.deepEqual(ordered(merged), { S: ["Z", "A1", "B1"], T: ["Q", "X"] });
});

test("the records merge by the later stamp; an exact tie goes the same way on both sides; the trim keeps the newest", () => {
  const a = ngListOrderSet({}, "S", 300, ["Z", "X", "Y"]), b = ngListOrderSet({}, "S", 400, ["Y", "X", "Z"]);
  assert.deepEqual(ngListOrderMerge(a, b), { S: [400, ["Y", "X", "Z"]] });
  assert.deepEqual(ngListOrderMerge(b, a), { S: [400, ["Y", "X", "Z"]] });
  const t1 = ngListOrderSet({}, "S", 500, ["Z", "X"]), t2 = ngListOrderSet({}, "S", 500, ["X", "Z"]);
  assert.deepEqual(ngListOrderMerge(t1, t2), ngListOrderMerge(t2, t1));
  assert.deepEqual(ngListOrderMerge(t1, t1), t1, "idempotent");
  let many = {}; for (let i = 0; i < NG_LIST_ORDER_CAP + 7; i++) many = ngListOrderSet(many, "L" + i, 1000 + i, ["x"]);
  assert.equal(Object.keys(many).length, NG_LIST_ORDER_CAP);
  assert.equal(many.L0, undefined, "the oldest record goes first");
  assert.equal(ngListOrderNewest(many), 1000 + NG_LIST_ORDER_CAP + 6);
});

test("junk records are dropped, never thrown on; no record means today's merge", () => {
  assert.deepEqual(ngListOrderNormalize({ S: [0, ["x"]], T: [5, "x"], U: [5, []], V: "x", __proto__: [5, ["x"]], W: [7, ["a", "a", 3, "b"]] }), { W: [7, ["a", "b"]] });
  for (const junk of [null, 3, "x", [], [[1, ["a"]]]]) assert.deepEqual(ngListOrderNormalize(junk), {});
  const a = { S: L(["X", "Y"], 100) }, b = { S: L(["Y", "Q"], 120) };
  assert.deepEqual(ngMergeLists(a, b, {}, {}), ngMergeLists(a, b));
});

// MOVE-R1, F5: a stamp of 2^53 or more can never be beaten (`t + 1 === t` there), so a damaged one would freeze its cell or
// record for good, and through a list's `t` every later stamp of the device. Each reader takes a SAFE integer only.
test("a stamp of 2^53 or more, or not an integer, is dropped by every reader (it could never be beaten)", () => {
  const big = 2 ** 53;
  for (const t of [big, big + 2, 1e308, 1.5, -1]) {
    assert.deepEqual(ngListMarksNormalize({ S: { X: [t, 1] } }), {}, "a cell stamped " + t);
    assert.deepEqual(ngListOrderNormalize({ S: [t, ["X"]] }), {}, "a record stamped " + t);
  }
  assert.deepEqual(ngListMarksNormalize({ S: { X: [big - 1, 1] } }), { S: { X: [big - 1, 1] } }, "2^53 - 1 is still a stamp");
  assert.deepEqual(ngListOrderNormalize({ S: [big - 1, ["X"]] }), { S: [big - 1, ["X"]] });
  assert.equal(ngListsNormalize({ S: { name: "Monday", items: ["X"], t: big } }).S.t, 0, "a list's own t past 2^53 - 1 reads as 0");
  assert.equal(ngListsNormalize({ S: { name: "Monday", items: ["X"], t: big - 1 } }).S.t, big - 1);
  // and a later write beats what is left: a merge of a dropped damaged cell with a real one keeps the real one
  assert.deepEqual(ngListMarksMerge({ S: { X: [big, 1] } }, { S: { X: [1795400000000, 0] } }), { S: { X: [1795400000000, 0] } });
});
