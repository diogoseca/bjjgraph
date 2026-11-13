// THE BELT ROW'S MUTANTS (v1.276.0, STAGE2): each claim of tests/belt_row.test.mjs (and the practice key's, in
// tests/guest_join_safety.test.mjs 20) mutated at its source, the files run, the NAMED test required red, the source restored
// and its hash checked. A clean run first: every named test green. Run under the build lock (it runs node suites):
//   node tests/artifacts/belt_row_mutants.mjs
// Each anchor must be found exactly once, or the mutant is refused (a mutant that edits nothing is a check that never ran).
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const APP = "neural/src/app.src.jsx", RATING = "neural/src/rating.src.js", OWNER = "neural/src/progress-owner.src.js";
const ROW = "tests/belt_row.test.mjs", GUEST = "tests/guest_join_safety.test.mjs";
const T = {
  merge: "two devices in both orders, against a fake cloud that HOLDS a level lower and higher than theirs",
  lower: "a lower number never lowers the held level; the dip says so",
  seed: "the first run seeds the held level with the Path's level: no stripe a player wears today is lost",
  higher: "the seed is the higher of what you wear and the number's level, stored (not only drawn)",
  final: "the number is shown only when final, rounded DOWN; until then the belt held and a placeholder",
  guest: "the guest join takes the higher level, whichever side holds it",
  bare: "20. a guest who only looked, as THIS build writes the copy (the app's own belt sync and save), joins nothing and says nothing",
  dip: "the dip's second line: only below the floor of what is worn, never at it",
  flip: "a ruleset flip that lowers the Path's stripes leaves the row's (one level for both rulesets)",
  still: "the number never moves by itself: the row paints the reading it asked for, until the next ask",
  promo: "a promotion by the number: once, saved, one silent beat and one analytics line; nothing on a merge",
  reopen: "a reopen: nothing fetched after a check that landed; one more try after a failed one",
  early: "a drawer opened before the game is in waits, and reads once it lands; a failed check does not ask at a grade",
  flipPaint: "a reading taken in the other ruleset is never painted: the row wears the belt held and waits",
  flipAsk: "a ruleset flip with the drawer shown asks again: the new ruleset's number, never the old one's",
  tabs: "two tabs: a level another tab already saved fires nothing (the stored copy every tab saves to)",
  account: "an account before its first pull: raised, nothing fires until the pull merged; then only if the cloud did not bring it",
};
const MUTANTS = [
  { id: "BELT-M1", what: "the held level's merge keeps the LOCAL value", file: ROW, test: T.merge,
    edits: [[APP, "        if (lvl) this.belts.lvl = lvl; else delete this.belts.lvl;\n", ""]] },
  { id: "BELT-M2", what: "a lower level lowers the held level (`_raiseLevel` sets any other level)", file: ROW, test: T.lower,
    edits: [[APP, "    if (this._heldLevel() >= L) return false;", "    if (this._heldLevel() === L) return false;"]] },
  { id: "BELT-M3", what: "the first run seeds 0, not the Path's level", file: ROW, test: T.seed,
    edits: [[APP, "const lifted = this._raiseLevel(this._pathLevel());", "const lifted = this._raiseLevel(0);"]] },
  { id: "BELT-M4", what: "the seed taken from the number alone (no raise from the Path)", file: ROW, test: T.higher,
    edits: [[APP, "const lifted = this._raiseLevel(this._pathLevel());", "const lifted = false;"]] },
  { id: "BELT-M5", what: "the number shown while not final", file: ROW, test: T.final,
    edits: [[RATING, "  if (r.final !== true) return Object.assign({ state: \"wait\"", "  if (false) return Object.assign({ state: \"wait\""]] },
  { id: "BELT-M6", what: "the number rounded to nearest", file: ROW, test: T.final,
    edits: [[RATING, "  const number = Math.floor(r.points);", "  const number = Math.round(r.points);"]] },
  { id: "BELT-M7", what: "the merge takes the LOWER level", file: ROW, test: T.guest,
    edits: [[RATING, "  if (x.n !== y.n) return x.n > y.n ? x : y;", "  if (x.n !== y.n) return x.n < y.n ? x : y;"]] },
  { id: "BELT-M8", what: "the practice key keeps `belts.lvl`", file: GUEST, test: T.bare,
    edits: [[OWNER, "{ delete b.belts.gf; delete b.belts.lvl; }", "{ delete b.belts.gf; }"]] },
  { id: "BELT-M9", what: "the dip's line printed at the floor itself", file: ROW, test: T.dip,
    edits: [[RATING, "  if (N.toHeld > 0) out.dip", "  if (N.toHeld >= 0) out.dip"]] },
  { id: "BELT-M10", what: "the row wears the Path's level alone", file: ROW, test: T.flip,
    edits: [[APP, "const level = Math.max(0, this._heldLevel(), this._pathLevel())", "const level = Math.max(0, this._pathLevel())"]] },
  { id: "BELT-M11", what: "the row repaints from a live read, not the reading it asked for", file: ROW, test: T.still,
    edits: [[APP, "const r = this._beltReading, frame = this._giMode === \"nogi\" ? \"nogi\" : \"gi\";", "const r = this.rating(), frame = this._giMode === \"nogi\" ? \"nogi\" : \"gi\";"]] },
  { id: "BELT-M12", what: "the promotion fires above the HELD level, not above what is worn", file: ROW, test: T.promo,
    edits: [[APP, "const L = ngRatingLevel(r.points), was = this.beltWorn().level;", "const L = ngRatingLevel(r.points), was = this._heldLevel();"]] },
  { id: "BELT-M13", what: "a reopen fetches again after a check that landed (both guards dropped)", file: ROW, test: T.reopen,
    edits: [[APP, "    if (now.final && !this._beltAskLater) { this._beltReading = now;", "    if (false) { this._beltReading = now;"],
            [APP, "    if (L && L.manifest === decks && L.fp === fp && L.result.status === \"ok\") return Promise.resolve(this.rating());\n", ""]] },
  { id: "BELT-M14", what: "a reopen after a failed check never tries again", file: ROW, test: T.reopen,
    edits: [[APP, "if (L && L.manifest === decks && L.fp === fp && L.result.status === \"ok\") return", "if (L && L.manifest === decks && L.fp === fp) return"]] },
  { id: "BELT-M15", what: "a drawer opened before the game was in never asks again", file: ROW, test: T.early,
    edits: [[APP, "    if (this._beltAskLater && this.deckShown) { this._beltAskLater = false; this._askBeltRow(); }", ""]] },
  // R1, the independent read of PR #412
  { id: "BELT-M16", what: "the row paints a reading taken in the other ruleset", file: ROW, test: T.flipPaint,
    edits: [[APP, "const v = ngRatingRow(this.beltWorn().level, r && r.frame === frame ? r : null);", "const v = ngRatingRow(this.beltWorn().level, r);"]] },
  { id: "BELT-M17", what: "a ruleset flip with the drawer shown does not ask again", file: ROW, test: T.flipAsk,
    edits: [[APP, "    if (this.deckShown) this._askBeltRow();\n    const concept = this._conceptsById", "    const concept = this._conceptsById"]] },
  { id: "BELT-M18", what: "a level another tab already saved fires again", file: ROW, test: T.tabs,
    edits: [[APP, "const fresh = L > this._storedLevel(), o = this._progressOwner;", "const fresh = true, o = this._progressOwner;"]] },
  { id: "BELT-M19", what: "an account fires before its first pull", file: ROW, test: T.account,
    edits: [[APP, "const early = !!o && o.kind === \"account\"", "const early = false && !!o && o.kind === \"account\""]] },
  { id: "BELT-M20", what: "after the pull it fires though the cloud brought the level", file: ROW, test: T.account,
    edits: [[APP, "if (ev && ev.level > (h ? h.n : -1)) this._fireLevel(ev);", "if (ev) this._fireLevel(ev);"]] },
  { id: "BELT-M21", what: "the pull never fires a held-back promotion (its call dropped)", file: ROW, test: T.account,
    edits: [[APP, "      this._afterPullLevel(empty ? null : cloud);   // a promotion held back for this pull (`_noteRatingLevel`)\n", ""]] },
];

const sha = (p) => createHash("sha256").update(readFileSync(ROOT + p)).digest("hex");
function run(file) {
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", file], { cwd: ROOT, encoding: "utf8", timeout: 600_000 });
  const out = (r.stdout || "") + (r.stderr || "");
  const failed = new Set([...out.matchAll(/^(?:\s*)not ok \d+ - (.+)$/gm)].map((m) => m[1].trim()));
  const passed = new Set([...out.matchAll(/^(?:\s*)ok \d+ - (.+)$/gm)].map((m) => m[1].trim()));
  return { failed, passed, code: r.status };
}

// the clean run: every named test green
for (const file of [ROW, GUEST]) {
  const r = run(file);
  const named = Object.values(T).filter((t) => (file === GUEST) === (t === T.bare));
  const red = named.filter((t) => !r.passed.has(t));
  if (r.code !== 0 || red.length) { console.log("CLEAN RUN NOT GREEN:", file, "exit", r.code, red); process.exit(1); }
  console.log("clean:", file, "green,", named.length, "named tests passed");
}
let killed = 0;
for (const m of MUTANTS) {
  const files = [...new Set(m.edits.map((e) => e[0]))], keep = Object.fromEntries(files.map((f) => [f, readFileSync(ROOT + f, "utf8")])), hash = Object.fromEntries(files.map((f) => [f, sha(f)]));
  try {
    const text = { ...keep };
    for (const [f, from, to] of m.edits) {
      const n = text[f].split(from).length - 1;
      if (n !== 1) throw new Error(m.id + ": anchor found " + n + " times in " + f + ": " + from.trim().slice(0, 60));
      text[f] = text[f].replace(from, to);
    }
    for (const f of files) writeFileSync(ROOT + f, text[f]);
    const r = run(m.file);
    const red = r.failed.has(m.test);
    if (red) killed++;
    console.log((red ? "KILLED  " : "SURVIVED") + " " + m.id + " (" + m.what + ") → " + (red ? "red: " : "named test not red: ") + m.test + (red ? "" : " [failed: " + [...r.failed].join(" | ") + "]"));
  } finally {
    for (const f of files) writeFileSync(ROOT + f, keep[f]);
    for (const f of files) if (sha(f) !== hash[f]) { console.log("RESTORE FAILED: " + f); process.exit(2); }
  }
}
console.log(killed + " of " + MUTANTS.length + " killed; sources restored and hash-checked");
process.exit(killed === MUTANTS.length ? 0 : 1);
