// PROBE (evidence for v1.204.3's commit message, not a gate): the OLD name-keyed wire against the
// NEW ordinal-keyed one, both ingested by the app's real methods.
//
//   node tests/artifacts/_wire_keys_differential.mjs <old emit dir> <new emit dir>
//
// Each dir holds graph-data.json, curriculum.json and flashcards/_index.json (+ the chunks are not
// needed). The old dir is an emit of the parent commit (format 3 + scoreWeightsByRuleset); the new
// one this commit's (format 4 + scoreWeightsByOrd). Reports, and exits non-zero on any difference:
//   · the deck manifest map — every key, its cat and n, the key ORDER, and the shared-question index;
//   · scoreWeights("gi") / ("nogi") — every key and value; the key order, where it may differ ONLY
//     inside a tie (the old emitter ordered ties by PYTHONHASHSEED);
//   · gameScore on 400 seeded synthetic progress states per frame — max |Δscore|, and whether any
//     belt or stripe changed;
//   · non-triviality floors on all of it.
// The permanent gate is tests/neural_wire_keys.test.mjs, which needs no old emit. Its companion
// tests/artifacts/_emit_determinism.sh emits twice under two PYTHONHASHSEED values and requires the
// boot files byte-equal — the old emitter's tie order failed it (curriculum.json DIFFERS).
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { knowledgeSource } from "../_knowledge_profile_harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const [oldDir, newDir] = process.argv.slice(2);
if (!oldDir || !newDir) { console.error("usage: _wire_keys_differential.mjs <old emit dir> <new emit dir>"); process.exit(2); }
const load = (dir, f) => JSON.parse(readFileSync(resolve(dir, f), "utf8"));
const src = readFileSync(resolve(ROOT, "neural/src/app.src.jsx"), "utf8");
// The bundle's prelude (wire-keys + knowledge-profile) above the class, from the one shared harness.
const Component = new Function("DCLogic", "React", `${knowledgeSource}\n${src}\nreturn Component;`)(
  class DCLogic {}, { createRef: () => ({ current: null }) });

function boot(dir) {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {}; a.noteChallenges = () => {};
  a.get = (_k, d) => d; a.set = () => {};
  a.ingest(load(dir, "graph-data.json"));
  a._ingestDeckManifest(load(dir, "flashcards/_index.json"));
  a.curriculum = load(dir, "curriculum.json");
  return a;
}
const fail = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fail.push(msg); };

const oldRaw = readFileSync(resolve(oldDir, "graph-data.json"), "utf8");
const newRaw = readFileSync(resolve(newDir, "graph-data.json"), "utf8");
check(oldRaw === newRaw, `graph-data.json byte-identical (${newRaw.length} B) — the trims leave the node wire alone`);
const OLD = boot(oldDir), NEW = boot(newDir);
const om = load(oldDir, "flashcards/_index.json"), nm = load(newDir, "flashcards/_index.json");
check(om._meta && om._meta.format === 3 && nm._meta.format === 4, `formats: old ${om._meta && om._meta.format}, new ${nm._meta.format}`);

console.log("decks");
const ok = Object.keys(OLD.flashcards.decks), nk = Object.keys(NEW.flashcards.decks);
check(ok.length >= 2896 && nk.length === ok.length, `${nk.length} decks new, ${ok.length} old (floor 2,896)`);
check(JSON.stringify(ok) === JSON.stringify(nk), "key ORDER identical (shared indexes into it)");
let deckDiff = 0;
for (const k of ok) if (JSON.stringify(OLD.flashcards.decks[k]) !== JSON.stringify(NEW.flashcards.decks[k])) deckDiff++;
check(deckDiff === 0, `${ok.length - deckDiff}/${ok.length} decks deep-equal ({cat, n})`);
const sq = (a) => JSON.stringify([...(a._sharedQ || new Map())]);
check(OLD._sharedQ && OLD._sharedQ.size > 100 && sq(OLD) === sq(NEW), `shared-question index identical (${OLD._sharedQ && OLD._sharedQ.size} questions)`);
const cats = {};
for (const k of nk) cats[NEW.flashcards.decks[k].cat] = (cats[NEW.flashcards.decks[k].cat] || 0) + 1;
console.log("       by category:", JSON.stringify(cats), "· cards:", nk.reduce((s, k) => s + NEW.flashcards.decks[k].n, 0));

console.log("score weights");
const oldCur = load(oldDir, "curriculum.json");
const rankOf = new Map();
{
  const sw = oldCur.scoreWeightsByRuleset;
  sw.p.k.forEach((k, i) => rankOf.set(k, Math.max(sw.p.gi[i], sw.p.nogi[i])));
  sw.t.k.forEach((k, i) => {
    const r = Math.max(sw.t.gi[i], sw.t.nogi[i]);
    rankOf.set(k + "|Attacker", r); rankOf.set(k + "|Defender", r);
  });
}
for (const fr of ["gi", "nogi"]) {
  const wo = OLD.scoreWeights(fr), wn = NEW.scoreWeights(fr);
  const ko = Object.keys(wo), kn = Object.keys(wn);
  check(ko.length > 1000 && ko.length === kn.length, `${fr}: ${kn.length} keys new, ${ko.length} old`);
  let vd = 0;
  for (const k of ko) if (wo[k] !== wn[k]) vd++;
  check(vd === 0 && kn.every((k) => k in wo), `${fr}: every key present both sides and every value bit-identical (${vd} differ)`);
  // order may differ only inside a TIE of the SORT KEY both emitters use: the larger of the
  // key's two per-frame integers (a key is ranked by its heavier ruleset, not by this frame's)
  const q = (k) => rankOf.get(k);
  let moved = 0, badMove = 0;
  for (let i = 0; i < ko.length; i++) if (ko[i] !== kn[i]) { moved++; if (q(ko[i]) !== q(kn[i])) badMove++; }
  // `badMove` counts a slot where the two orders hold keys of DIFFERENT rank. The old emitter ranked
  // floats and broke exact ties by hash order; the new one ranks the shipped integers and breaks
  // ties by name — so the only legitimate reorderings are between keys of equal shipped rank.
  console.log(`       ${fr}: ${moved} key slot(s) reordered, ${badMove} of them between unequal shipped ranks`);
  check(badMove === 0, `${fr}: every reordering is inside a tie`);
}

console.log("gameScore on seeded synthetic progress");
let seed = 20260929;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const qh = Object.create(Component.prototype).qhash("q");
for (const fr of ["gi", "nogi"]) {
  let maxd = 0, beltDiff = 0, n = 0;
  for (let s = 0; s < 400; s++) {
    const stage = {};
    const share = rnd();
    for (const k of nk) if (rnd() < share) stage[k] = { [qh]: 1 + Math.floor(rnd() * 3) };
    const score = (a) => { a._giMode = fr; a.stage = stage; a._scoreCache = null; a._stageVer = s + 1; return a.gameScore(); };
    const go = score(OLD), gn = score(NEW);
    maxd = Math.max(maxd, Math.abs(go.score - gn.score));
    if (go.belt !== gn.belt || go.stripes !== gn.stripes) beltDiff++;
    n++;
  }
  console.log(`       ${fr}: ${n} states, max |Δscore| = ${maxd.toExponential(2)}, belt/stripe changes: ${beltDiff}`);
  check(beltDiff === 0 && maxd < 1e-12, `${fr}: no belt or stripe moves; the score agrees to ${maxd.toExponential(1)}`);
}
check(OLD.beats.concat(NEW.beats).every((b) => b.beat !== "wire_key_unresolved"), "no wire_key_unresolved beat on either side");
console.log(fail.length ? `\nDIFFERENTIAL RED: ${fail.length} check(s) failed` : "\nDIFFERENTIAL GREEN");
process.exit(fail.length ? 1 : 0);
