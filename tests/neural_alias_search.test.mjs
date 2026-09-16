import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Execute the production methods; the index fixtures isolate transport, cache and pairing rules.
const src = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const Component = new Function("DCLogic", "React", "NG_APP_VERSION", `${src}\nreturn Component;`)(
  class {}, { createRef: () => ({ current: null }) }, "alias-test",
);
const ID = "Submissions/Rear-Naked-Choke/from-Back-Control";
const INDEX = { [ID]: { aka: [], family: { name: "Rear Naked Choke", aka: ["Mata Leão", "RNC"] } } };

function app() {
  const a = Object.create(Component.prototype);
  a.nodes = [
    { id: ID, t: "Rear Naked Choke from Back Control", idx: 0, pi: 1, role: "attacker", ty: "submissions" },
    { id: `${ID}/Defender`, t: "Rear Naked Choke from Back Control", idx: 1, pi: 0, role: "defender", ty: "submissions" },
  ];
  a._idIndex = new Map(a.nodes.map((n) => [n.id, n.idx]));
  a._dataBase = () => "/static/neural/";
  return a;
}

test("alias loading shares a versioned request, populates both seats and invalidates folded candidates", async (t) => {
  const a = app();
  const before = a.nodes.map((n) => ({ ...n }));
  let release;
  const requested = [];
  t.mock.method(globalThis, "fetch", (url) => {
    requested.push(url);
    return new Promise((resolve) => { release = resolve; });
  });
  assert.equal(a.nodeMatches(a.nodes[0], "mata leao"), false);
  const pending = a._ensureAliases();
  assert.equal(a._ensureAliases(), pending);
  release({ ok: true, json: async () => INDEX });
  assert.equal(await pending, true);
  assert.equal(await a._ensureAliases(), true);
  assert.deepEqual(requested, ["/static/neural/aliases.json?v=alias-test"]);
  for (let i = 0; i < a.nodes.length; i++) {
    const n = a.nodes[i];
    assert.equal(a.nodeMatches(n, "MATA LEÃO"), true);
    assert.equal(a.nodeMatches(n, "mata leao"), true);
    assert.equal(a.nodeMatches(n, "rnc"), true);
    assert.equal(a.nodeMatches(n, "leao rnc"), false, "aliases remain separate candidates");
    assert.equal(a.nodeQual(n), "from Back Control", "origin still wins over family aliases");
    for (const [key, value] of Object.entries(before[i])) assert.equal(n[key], value, `${key} stays unchanged`);
  }
  assert.deepEqual(a.nodes[0].aliasMeta, INDEX[ID]);
  assert.equal(a.nodes[0].aliases, a.nodes[1].aliases);
});

test("matching is pure and caches case/diacritic folding while preserving the scalar wire fallback", () => {
  const a = app(), n = { t: "Knee on Belly Top", aka: "Knee Mount", aliases: ["KOB", "Joelho na Barriga"] };
  let folds = 0;
  const fold = a._foldSearch;
  a._foldSearch = (s) => { folds++; return fold(s); };
  assert.equal(a.nodeMatches(n, "KOB"), true);
  const initial = folds;
  assert.equal(a.nodeMatches(n, "KOB"), true);
  assert.equal(folds, initial, "same query/node does not normalize again");
  assert.equal(a.nodeMatches(n, "knee mount"), true);
  assert.equal(folds, initial + 1, "only the new query is folded");
  assert.equal(a.nodeMatches(n, "JOELHO"), true);
  assert.equal(a.nodeQual(n), "aka Knee Mount");
  assert.equal(a._aliasesWait, undefined, "matching never starts transport");
});

test("qualifiers distinguish own aliases from family aliases and return raw text for their callers", () => {
  const a = app(), n = { t: "Variant", aliasMeta: { aka: ["Own <alias>"], family: { name: "Family", aka: ["Inherited"] } } };
  assert.equal(a.nodeQual(n), "aka Own <alias>");
  n.aliasMeta.aka = [];
  assert.equal(a.nodeQual(n), "Family family: Inherited");
});

test("three failed attempts stop until explicit Retry and a later successful chain recovers", async (t) => {
  const a = app();
  let calls = 0, healthy = false;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    if (healthy) return { ok: true, json: async () => INDEX };
    if (calls === 1) throw new Error("offline");
    if (calls === 2) return { ok: false, status: 503 };
    return { ok: true, json: async () => { throw new Error("invalid JSON"); } };
  });
  assert.equal(await a._ensureAliases(), false);
  assert.equal(calls, 3);
  assert.equal(a._aliasesWait, null);
  assert.equal(a._aliasesFailed, true);
  assert.equal(await a._ensureAliases(), false);
  assert.equal(calls, 3, "renders cannot turn failure into a request loop");
  healthy = true;
  a._aliasesFailed = false; // the production Retry button's action
  assert.equal(await a._ensureAliases(), true);
  assert.equal(calls, 4);
  assert.equal(a.nodeMatches(a.nodes[1], "mata leao"), true);
});

test("malformed indexes apply nothing, while unknown IDs in a valid newer index are harmless", async (t) => {
  const a = app();
  let payload = { ...INDEX, "Positions/Bad": { aka: "not an array" } };
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => payload }));
  assert.equal(await a._ensureAliases(), false);
  assert.equal(a.nodes[0].aliasMeta, undefined, "validation precedes every mutation");
  a._aliasesFailed = false;
  payload = { ...INDEX, "Positions/New-Site": { aka: ["New alias"] } };
  assert.equal(await a._ensureAliases(), true);
  assert.equal(a.nodeMatches(a.nodes[0], "RNC"), true);
});
