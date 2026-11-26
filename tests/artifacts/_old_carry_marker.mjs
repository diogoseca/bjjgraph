// WHAT AN OLDER BUILD DOES WITH THE CARRY'S DONE MARKER AND ITS ROWS (CARD1-S3, v1.304.0; progress-owner.src.js above
// NG_CARRY_BEFORE). Each older release's REAL app class, built from git's own copy of its sources (never re-typed; the
// pattern of tests/artifacts/_old_settings_carry.mjs), is handed records that carry `cardCarry: 1` and the carried rows:
//   · its load then save writes the marker and every row back;
//   · a pull: a copy without the marker takes the cloud's; a copy with it keeps it against a cloud without;
//   · its merge is idempotent, and it never writes the marker itself;
//   · NO LOOP, NO LOSS: an older device that has NOT carried (its own September rows, unmarked) and this build's device
//     that HAS (marked, the rows carried) pull from one cloud in turn, pushing whenever their merge differs from what the
//     cloud holds; the pushes stop within two rounds, and the cloud ends with the marker and every row of both.
// Not a test (`node --test tests/*.test.mjs` does not collect it): it reads release tags, which a shallow CI checkout lacks.
// Run from the repo root after the neural emit (it reads no wire):
//   node tests/artifacts/_old_carry_marker.mjs
// It prints one line per check and exits non-zero if any release fails a check.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const RELEASES = [["v1.298.0", "v2026.11.23", "production"], ["v1.301.5", "0a4a55e70", "dev"], ["v1.303.0", "3947d4418", "dev"]];
const DEPS = ["lists-codec", "lists", "belt", "knowledge-profile", "rating", "challenge-definitions", "challenge-engine"];
const strip = (t) => t.replace(/^export (function|const|let|var|class) /gm, "$1 ");
const show = (rev, path) => { try { return execFileSync("git", ["show", `${rev}:${path}`], { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };
const here = (path) => readFileSync(path, "utf8");
globalThis.ngGameplanReviewed = () => false;
globalThis.document = globalThis.document || { querySelectorAll: () => [], querySelector: () => null, body: null, activeElement: null };
function classOf(read, edit = (s) => s) {
  const deps = DEPS.map((n) => read(`neural/src/${n}.src.js`)).filter(Boolean).map(strip).join("\n");
  const app = edit(read("neural/src/app.src.jsx") || ""), owner = read("neural/src/progress-owner.src.js");
  if (!app || !owner) throw new Error("no app source");
  return new Function("DCLogic", "React", strip(owner) + "\n" + deps + "\n" + app + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
}
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const J = (x) => JSON.stringify(canon(x));
const bare = (b) => { const c = JSON.parse(JSON.stringify(b)); delete c.updatedAt; return c; };
const inst = (C) => { const a = Object.create(C.prototype); a._publishKnowledge = () => {}; a.fx = () => {}; a._progressHost = { goneRead: () => ({}), goneWrite: () => ({}) }; return a; };
const D = "Mount|Top", OLD = ["0a0a0a0a", "0b0b0b0b"], NEW = ["1a1a1a1a", "1b1b1b1b"], t = 1795500000000;
// this build's device: carried (the marker, the rows under today's keys, the old rows kept)
const carried = () => ({ v: 2, cardCarry: 1, updatedAt: t,
  stage: { [D]: { [OLD[0]]: 2, [NEW[0]]: 2 } }, srs: { [D]: { [OLD[0]]: [20703, 3, 20700], [NEW[0]]: [20703, 3, 20700] } } });
// an older device's own copy: not carried, one September row the carrying device never saw
const theirs = () => ({ v: 2, updatedAt: t - 5,
  stage: { [D]: { [OLD[0]]: 2, [OLD[1]]: 1 } }, srs: { [D]: { [OLD[0]]: [20703, 3, 20700], [OLD[1]]: [20701, 1, 20700] } } });

const NOW = classOf(here);
let bad = 0;
for (const [name, rev, where] of RELEASES) {
  const C = classOf((p) => show(rev, p)), label = `${name} (${where})`;
  let fails = 0;
  const check = (what, ok) => { if (!ok) fails++; console.log(label.padEnd(22), ok ? "ok  " : "FAIL", what); };
  { const s = inst(C); s._hydrateProgressBlob(JSON.parse(J(carried()))); const out = s._progressBlob();
    check("its load then save writes the marker and every row back", out.cardCarry === 1 && J(out.stage) === J(carried().stage) && J(out.srs) === J(carried().srs)); }
  { const m = inst(C)._mergeProgressBlobs(theirs(), carried());
    check("a pull into a copy without the marker takes it", m.cardCarry === 1); }
  { const m = inst(C)._mergeProgressBlobs(carried(), { v: 2, updatedAt: t + 9 });
    check("a copy with the marker keeps it against a cloud without", m.cardCarry === 1); }
  { const a = inst(C), m = a._mergeProgressBlobs(theirs(), carried());
    check("its merge is idempotent", J(bare(a._mergeProgressBlobs(m, m))) === J(bare(m))); }
  check("it writes no cardCarry itself", !/cardCarry/.test((show(rev, "neural/src/app.src.jsx") || "") + (show(rev, "neural/src/progress-owner.src.js") || "")));
  // NO LOOP, NO LOSS: the older device and this build's pull from one cloud in turn, each pushing when its merge differs
  {
    let cloud = carried(), olds = theirs(), mine = carried();
    const pushes = [];
    for (let round = 0; round < 6; round++) {
      let n = 0;
      for (const side of ["old", "new"]) {
        const a = inst(side === "old" ? C : NOW), local = side === "old" ? olds : mine;
        const m = a._mergeProgressBlobs(local, cloud);
        if (J(bare(m)) !== J(bare(cloud))) { cloud = m; n++; }
        if (side === "old") olds = m; else mine = m;
      }
      pushes.push(n);
    }
    check(`pushes stop within two rounds (per round: ${pushes.join(", ")})`, pushes.slice(2).every((n) => n === 0));
    const S = cloud.stage[D] || {}, R = cloud.srs[D] || {};
    check("the cloud ends with the marker and every row of both copies", cloud.cardCarry === 1
      && [OLD[0], OLD[1], NEW[0]].every((k) => R[k]) && S[OLD[1]] === 1 && S[NEW[0]] === 2);
  }
  if (fails) bad++;
}
// CONTROL: this build with a marker that DIFFERS at every save (what a day, a list or a carry id could do across devices):
// the loop check must catch it, against the newest older release, or it proves nothing
{
  const SAVE = "if (this._cardCarry) out.cardCarry = NG_CARRY_DONE;";
  const LOOPY = classOf(here, (s) => { if (!s.includes(SAVE)) throw new Error("control: the save line moved"); return s.replace(SAVE, "out.cardCarry = (globalThis.__cc = (globalThis.__cc || 0) + 1);"); });
  const C = classOf((p) => show("3947d4418", p));
  let cloud = carried(), olds = theirs(), mine = carried();
  const pushes = [];
  for (let round = 0; round < 6; round++) {
    let n = 0;
    for (const side of ["old", "new"]) {
      const m = inst(side === "old" ? C : LOOPY)._mergeProgressBlobs(side === "old" ? olds : mine, cloud);
      if (J(bare(m)) !== J(bare(cloud))) { cloud = m; n++; }
      if (side === "old") olds = m; else mine = m;
    }
    pushes.push(n);
  }
  const caught = !pushes.slice(2).every((n) => n === 0);
  console.log("CONTROL".padEnd(22), caught ? "ok  " : "FAIL", `a marker that differs per save keeps pushing (per round: ${pushes.join(", ")})`);
  if (!caught) bad++;
}
process.exit(bad ? 1 : 0);
