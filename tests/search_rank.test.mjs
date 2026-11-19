import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
// SEARCH SHOWS THE BEST MATCH FIRST (v1.257.0) — the order pinned from the wire, through the app's own methods.
//
// Owner, 11 Nov: "when i search for something like Side Control ... Side Control Top and Side Control (Top and
// Bottom) should appear as the first(+second) option(s). instead they apear like as item n20 ... also, when i search
// guillotine, the guillotine choke should show first, and only the the Guillotine Setup". Until v1.257.0 the drawer's
// search was `nodes.filter(nodeMatches).slice(0, 120)`: node-array order, the cap cutting in that order. Measured on
// the v1.256.2 wire before the change: the row a person means for "side control" was row 15, "mount" 13, "kimura" 14,
// "guard" 24, "half" 24, "back" 21; "control side", "50/50" and "guilotine" found nothing.
//
// This drives the REAL `ingest` on the REAL payload (graph-data.json, aliases.json through the real `_ensureAliases`,
// curriculum.json's score table, systems-index.json) and asserts on what `searchRank` RETURNED — never a second copy of
// the ranking (CLAUDE.md §6.3). Each query names the row a person means by its permanent id, in both rulesets, and the
// last test fails unless a positive number of those checks actually ran (§6.6).
//
// MUTANTS (v1.257.0) — 15 run against this file, 14 killed, each by the test named:
//   M1 no sort in searchRank (node order back)         -> "the row a person means is first", and five more
//   M2 kind order position before submission            -> "the row a person means is first" (triangle, guillotine)
//   M3 importance dropped from the comparator           -> "importance orders like with like"
//   M4 a "from X" variant whose bare name IS the query
//      counted as an exact name                         -> "a technique before its variants" (underhook); measured,
//      it reorders the first 12 of 45 of 2,436 queries built from every name and first word in the corpus
//   M5 the canonical key dropped                        -> "a technique before its variants" (knee slice)
//   M6 punctuation not folded                           -> "the row a person means is first" (50/50)
//   M7 any-order words off                              -> "the row a person means is first" (control side)
//   M8 the ruleset filter dropped from searchRank       -> "every row is a rep site this ruleset allows"
//   M10 the alias-exact tier dropped                    -> "the row a person means is first" (kob, rnc, dlr)
//   M11 the head key dropped                            -> "the row a person means is first"
// After the independent review (v1.257.0, D2 and D2b fixed), four more, each killed by the test named:
//   U1 the canonical key back on submissions (stand-alone above every family)  -> "submissions follow importance …"
//   U2 the head key for positions and submissions only (Triangle Escape)       -> "the row a person means is first"
//   U3 the alias arrival keeps the old folded fields                           -> "aliases arriving late re-rank …"
//   U4 the importance cache ignores the ruleset                                -> "a ruleset switch on the same app …"
// NON-KILL, recorded so nobody reads this file as covering it: M9, the comparator's last key (the id), SURVIVES —
// equivalent on this corpus, because no two results share kind, length and folded title. It stays because a future
// duplicate title would otherwise hand the order back to the node index (CLAUDE.md §6.6).
// NOT COVERED here: the DOM (the folded families, the seat presses, the 40-row page, the arrow keys, the keystroke
// budget) is e2e/journeys/search-rank.spec.ts's subject; the one-typo band is pinned here only for "guilotine".
//
// Run: node --test tests/search_rank.test.mjs   (npm run test:units)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const R = (p) => new URL("../" + p, import.meta.url);
const src = readFileSync(R("neural/src/app.src.jsx"), "utf8");
const P = (f) => JSON.parse(readFileSync(R("source/quartz/static/neural/" + f), "utf8"));
const WIRE = P("graph-data.json"), ALIASES = P("aliases.json"), CUR = P("curriculum.json"), SYS = P("systems-index.json");
const Component = new Function("DCLogic", "React", "NG_APP_VERSION", `${knowledgeSource}\n${src}\nreturn Component;`)(
  class {}, { createRef: () => ({ current: null }) }, "search-rank-test",
);

async function app(frame) {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {}; a.fx = (k, d) => a.beats.push([k, d]);
  a.get = (_k, d) => d; a.set = () => {};
  a._giMode = frame;
  a.ingest(JSON.parse(JSON.stringify(WIRE)));
  a._giMode = frame;
  a._dataBase = () => "/static/neural/";
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(ALIASES)) });
  try { assert.equal(await a._ensureAliases(), true, "the real alias loader attached the real index"); } finally { globalThis.fetch = real; }
  a.curriculum = CUR;
  a.systems = SYS.systems.slice();
  return a;
}
const APPS = { gi: await app("gi"), nogi: await app("nogi") };
let checked = 0;

const id = (r) => (r.s || r.n).id;
const fam = (f) => (r) => !!r.n && r.n.id.startsWith("Submissions/" + f + "/");
const is = (x) => (r) => id(r) === x;
// query -> the row a person means. One id, or a whole submission family where every start is the thing.
const MEANT = {
  "side control": is("Positions/Side-Control"), "control side": is("Positions/Side-Control"),
  "guillotine": fam("Guillotine-Choke"), "armbar": fam("Armbar"), "arm bar": fam("Armbar"),
  "triangle": fam("Triangle-Choke"), "mount": is("Positions/Mount"), "guard": is("Positions/Half-Guard"),
  "kimura": fam("Kimura"), "half": is("Positions/Half-Guard"), "back": is("Positions/Back-Control"),
  "rnc": is("Submissions/Rear-Naked-Choke/from-Back-Control"), "mata leao": is("Submissions/Rear-Naked-Choke/from-Back-Control"),
  "darce": fam("Darce-Choke"), "knee slice": is("Transitions/Knee-Slice-Pass"), "keylock": fam("Americana"),
  "kob": is("Positions/Knee-on-Belly"), "x guard": is("Positions/X-Guard"), "50/50": is("Positions/Ashi-Garami/50-50-Guard"),
  "de la riva": is("Positions/De-La-Riva-Guard"), "dlr": is("Positions/De-La-Riva-Guard"),
  "danaher": (r) => !!r.s && /Danaher/.test(r.s.display_title || r.s.name),
  // review D2b: the exact name leads whatever its kind, so the transition beats "Triangle Escape Position"
  "triangle escape": is("Transitions/Triangle-Escape"),
};

test("the row a person means is first, in both rulesets", () => {
  for (const frame of ["gi", "nogi"]) {
    const a = APPS[frame];
    for (const [q, meant] of Object.entries(MEANT)) {
      const { rows } = a.searchRank(q);
      assert.ok(rows.length > 0, `${frame} "${q}" found nothing`);
      assert.ok(meant(rows[0]), `${frame} "${q}": row 1 is ${id(rows[0])}`);
      checked++;
    }
  }
});

test("guillotine: the choke first, and only then the Guillotine Setup (the owner's example)", () => {
  for (const frame of ["gi", "nogi"]) {
    const { rows } = APPS[frame].searchRank("guillotine"), ids = rows.map(id);
    const choke = ids.findIndex((x) => x.startsWith("Submissions/Guillotine-Choke/")), setup = ids.indexOf("Transitions/Guillotine-Setup");
    assert.ok(choke === 0 && setup > 0, `${frame}: choke at ${choke + 1}, setup at ${setup + 1}`);
    // every start of the choke comes before any other guillotine variant (the name STARTS with the query)
    const last = ids.map((x, i) => x.startsWith("Submissions/Guillotine-Choke/") ? i : -1).filter((i) => i >= 0).pop();
    const firstOther = ids.findIndex((x) => /^Submissions\/(High-Elbow|Arm-in|Ten-Finger|Chin-Strap)-Guillotine\//.test(x));
    assert.ok(last < firstOther, `${frame}: a choke start at ${last + 1} after another guillotine at ${firstOther + 1}`);
    checked++;
  }
});

test("importance orders like with like: the three most-occupied guards, the most-travelled start of the RNC", () => {
  for (const frame of ["gi", "nogi"]) {
    const a = APPS[frame];
    assert.deepEqual(a.searchRank("guard").rows.slice(0, 3).map(id), ["Positions/Half-Guard", "Positions/Closed-Guard", "Positions/Open-Guard"], frame);
    assert.equal(id(a.searchRank("rnc").rows[0]), "Submissions/Rear-Naked-Choke/from-Back-Control", frame);
    // the weights are a real table, not a constant with a function around it (§6.6): distinct values over the sites
    const w = a._searchWeights(), vals = new Set(), sites = a.nodes.filter((n) => n.rep);
    for (const n of sites) vals.add(w[n.idx]);
    assert.ok(vals.size > 900, `${frame}: ${vals.size} distinct importance values over ${sites.length} sites`);
    assert.equal(a.beats.filter(([k]) => k === "search_rank_cold").length, 0, "the score table was there, so no cold beat");
    checked++;
  }
});

test("a technique before its variants: Knee Slice Pass before Knee Slice from X; Scissor Sweep before Sweep from X", () => {
  for (const frame of ["gi", "nogi"]) {
    const a = APPS[frame];
    assert.equal(id(a.searchRank("knee slice").rows[0]), "Transitions/Knee-Slice-Pass", frame);
    const sweeps = a.searchRank("sweep").rows.slice(0, 12);
    assert.ok(sweeps.every((r) => r.n && r.n.ty === "transitions" && !/ from /i.test(r.n.t)), `${frame}: ${sweeps.map((r) => r.n && r.n.t).join(" | ")}`);
    // a variant whose PRINTED name is the bare query ("Underhook from Knee Shield" prints "Underhook") is not an exact
    // name: it ranks by importance with the other variants, behind the far more travelled Underhook Sweep from Half
    const u = a.searchRank("underhook").rows.map(id);
    const half = u.indexOf("Transitions/Underhook-Sweep-from-Half"), knee = u.indexOf("Transitions/Underhook-from-Knee-Shield");
    assert.ok(half >= 0 && knee > half, `${frame}: Underhook Sweep from Half at ${half + 1}, Underhook from Knee Shield at ${knee + 1}`);
    checked++;
  }
});

test("absent curriculum is said, not guessed: weights read 0 and the cold beat fires once per frame", async () => {
  const a = await app("gi");
  a.curriculum = null; a._scoreW = null; a._rankW = null;
  const { rows } = a.searchRank("side control");
  assert.equal(id(rows[0]), "Positions/Side-Control", "exactness still leads without the table");
  a.searchRank("mount");
  assert.equal(a.beats.filter(([k]) => k === "search_rank_cold").length, 1);
  checked++;
});

test("submissions follow importance inside a tier: a stand-alone title no longer outranks every family (review D2)", () => {
  // Every family start is titled "X from Y" and five submissions are not; the canonical key used to put those five above
  // every family ("choke" opened on Invisible Collar Choke and Buggy Choke, importance 0, above Rear Naked Choke).
  for (const frame of ["gi", "nogi"]) {
    const a = APPS[frame];
    for (const q of ["choke", "lock", "armbar", "triangle", ...(frame === "gi" ? ["collar"] : [])]) {   // collar chokes are gi
      const subs = a.searchRank(q).rows.filter((r) => r.n && r.n.ty === "submissions");
      assert.ok(subs.length > 3, `${frame} "${q}": premise, several submissions`);
      for (let i = 1; i < subs.length; i++) {
        const p = subs[i - 1], c = subs[i];
        if (p.band === c.band && p.head === c.head && p.ex === c.ex)
          assert.ok(p.w >= c.w, `${frame} "${q}": ${p.n.t} (${p.w}) above ${c.n.t} (${c.w}) in one tier`);
      }
      checked++;
    }
    const choke = a.searchRank("choke").rows.filter((r) => r.n && r.n.ty === "submissions");
    assert.ok(!["Submissions/Buggy-Choke", "Submissions/Invisible-Collar-Choke"].includes(choke[0].n.id), `${frame}: "choke" opens on ${choke[0].n.id}`);
  }
});

test("aliases arriving late re-rank: the folded fields are rebuilt, not kept from before", async () => {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {}; a.fx = (k, d) => a.beats.push([k, d]);
  a.get = (_k, d) => d; a.set = () => {}; a._giMode = "gi";
  a.ingest(JSON.parse(JSON.stringify(WIRE))); a._giMode = "gi"; a.curriculum = CUR; a._dataBase = () => "/static/neural/";
  const before = a.searchRank("rnc").rows.filter((r) => r.n && r.n.id.startsWith("Submissions/Rear-Naked-Choke/"));
  assert.equal(before.length, 0, "premise: before the aliases land, \"rnc\" is no Rear Naked Choke's name");
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(ALIASES)) });
  try { assert.equal(await a._ensureAliases(), true); } finally { globalThis.fetch = real; }
  assert.equal(id(a.searchRank("rnc").rows[0]), "Submissions/Rear-Naked-Choke/from-Back-Control", "after they land, RNC leads");
  checked++;
});

test("a ruleset switch on the same app re-ranks exactly as a fresh app in that ruleset", () => {
  const a = APPS.gi;
  for (const q of ["guard", "lapel", "choke", "sweep"]) {
    a._giMode = "gi"; const gi = a.searchRank(q).rows.map(id);
    a._giMode = "nogi"; const switched = a.searchRank(q).rows.map(id);
    assert.deepEqual(switched, APPS.nogi.searchRank(q).rows.map(id), `"${q}" after gi -> no-gi`);
    a._giMode = "gi";
    assert.deepEqual(a.searchRank(q).rows.map(id), gi, `"${q}" back in gi`);
    checked++;
  }
});

test("one typo is a last band, and only when asked for", () => {
  for (const frame of ["gi", "nogi"]) {
    const a = APPS[frame];
    assert.equal(a.searchRank("guilotine").rows.length, 0, `${frame}: no typo band unless asked`);
    const { rows } = a.searchRank("guilotine", { typo: true });
    assert.ok(rows.length > 0 && fam("Guillotine-Choke")(rows[0]) && rows.every((r) => r.band === 4), frame);
    checked++;
  }
});

test("every row is a rep site this ruleset allows, and nothing the old substring search found is lost", () => {
  for (const frame of ["gi", "nogi"]) {
    const a = APPS[frame];
    for (const q of [...Object.keys(MEANT), "a", "e", "sweep", "choke", "lapel", "100%", "Mata Leão"]) {
      const got = new Set(a.searchRank(q).rows.filter((r) => r.n).map((r) => r.n.idx));
      for (const i of got) assert.ok(a.nodes[i].rep && a.rsAllows(a.nodes[i]), `${frame} "${q}": ${a.nodes[i].id}`);
      const old = a.nodes.filter((n) => n.rep && a.rsAllows(n) && a.nodeMatches(n, q.toLowerCase().trim()));
      const lost = old.filter((n) => !got.has(n.idx)).map((n) => n.id);
      assert.deepEqual(lost, [], `${frame} "${q}": the old search found these and the ranked one does not`);
      checked++;
    }
  }
});

test("a strict total order: no two rows tie, and the order does not depend on node order", () => {
  for (const frame of ["gi", "nogi"]) {
    const a = APPS[frame];
    for (const q of ["guard", "a", "sweep", "danaher"]) {
      const { rows } = a.searchRank(q);
      for (let i = 1; i < rows.length; i++) assert.ok(a._rankCmp(rows[i - 1], rows[i]) < 0, `${frame} "${q}": rows ${i} and ${i + 1} tie`);
      const shuffled = rows.slice().reverse().sort((x, y) => a._rankCmp(x, y));
      assert.deepEqual(shuffled.map(id), rows.map(id), `${frame} "${q}"`);
      checked++;
    }
  }
});

test("a positive number of query checks ran", () => {
  // 2 frames x 23 meant rows + 2 + 2 + 2 + 1 + 9 + 1 + 4 + 2 + 2 x 30 + 2 x 4; a floor, so a MEANT row that
  // silently stops iterating cannot pass as a clean run
  assert.ok(checked >= 130, `only ${checked} checks ran`);
});
