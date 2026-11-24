// WHAT AN OLDER BUILD DOES WITH THE MODIFIERS' SETTINGS KEYS (v1.301.0, MODS1; progress-owner.src.js above NG_MOD_PREFIX).
// Each older release's REAL app class, built from git's own copy of its sources (never re-typed), is handed records that
// carry `settings["mod:…"]` keys, live and removed, and checked: its load then save writes every key and stamp back; a pull
// TAKES the cloud's newer removal and its new modifier; its own newer edit stays while the cloud's newer one wins, per
// technique; a copy without the keys takes them; its merge is idempotent; and it never writes such a key itself. Then two
// CONTROLS on the newest release: a mutant whose settings merge keeps its own copy must fail checks (so the checks can fail),
// and the same class handed the modifiers as a TOP-LEVEL key keeps its own old copy (the reason they are settings: PR #452's
// loop). Not a test (`node --test tests/*.test.mjs` does not collect it): it reads release tags, which a shallow CI checkout
// lacks. Run from the repo root:
//   node tests/artifacts/_old_settings_carry.mjs
// It prints one line per check and exits non-zero if any release fails, or if a control does not do what it must.
import { execFileSync } from "node:child_process";

const RELEASES = [["v1.298.0", "v2026.11.23"], ["v1.294.0", "v2026.11.19.1"], ["v1.293.3", "v2026.11.19"], ["v1.280.4", "ed701b3b5"], ["v1.252.0", "v2026.11.09"]];
const DEPS = ["lists-codec", "lists", "belt", "knowledge-profile", "rating", "challenge-definitions", "challenge-engine"];
const strip = (t) => t.replace(/^export (function|const|let|var|class) /gm, "$1 ");
const show = (rev, path) => { try { return execFileSync("git", ["show", `${rev}:${path}`], { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };
globalThis.ngGameplanReviewed = () => false;   // read only by practiceToday, which nothing here calls
globalThis.document = globalThis.document || { querySelectorAll: () => [], querySelector: () => null, body: null, activeElement: null };
function classAt(rev, edit = (s) => s) {
  const deps = DEPS.map((n) => show(rev, `neural/src/${n}.src.js`)).filter(Boolean).map(strip).join("\n");
  const app = show(rev, "neural/src/app.src.jsx"), owner = show(rev, "neural/src/progress-owner.src.js");
  if (!app || !owner) throw new Error("no app source at " + rev);
  return new Function("DCLogic", "React", strip(owner) + "\n" + deps + "\n" + edit(app) + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
}
const t = 1795500000000, live = (p, on = 1, c = "S", born = t - 86400000) => [p, on, c, born];
const blob = (settings, settingsAt) => ({ v: 2, prep: { "Mount|Top": 3 }, settings, settingsAt, updatedAt: t });
const mods = (b) => Object.fromEntries(Object.entries(b.settings || {}).filter(([k]) => k.startsWith("mod:")).sort().map(([k, v]) => [k, [v, (b.settingsAt || {})[k]]]));
const J = (x) => JSON.stringify(x);
function checks(C, label, quiet = false) {
  const inst = () => { const a = Object.create(C.prototype); a._publishKnowledge = () => {}; a.fx = () => {}; return a; };
  const app = inst();
  let fails = 0, n = 0;
  const check = (name, got, want) => { n++; const ok = J(got) === J(want); if (!ok) fails++; if (!quiet) console.log(label.padEnd(9), ok ? "ok  " : "FAIL", name); };
  { const s = inst(), b = blob({ goal: 20, "mod:Armbar from Mount": live(62), "mod:Knee Slice Pass": 0 }, { goal: t - 9e6, "mod:Armbar from Mount": t, "mod:Knee Slice Pass": t + 1 });
    s._hydrateProgressBlob(JSON.parse(J(b)));
    check("its load then save writes every modifier key and stamp back", mods(s._progressBlob()), mods(b)); }
  { const local = blob({ "mod:Armbar from Mount": live(50) }, { "mod:Armbar from Mount": t });
    const cloud = blob({ "mod:Armbar from Mount": 0, "mod:Triangle Choke": live(70) }, { "mod:Armbar from Mount": t + 10, "mod:Triangle Choke": t + 20 });
    check("a pull takes the cloud's newer removal and its new modifier", mods(app._mergeProgressBlobs(local, cloud)), mods(cloud)); }
  { const local = blob({ "mod:Armbar from Mount": live(55), "mod:Triangle Choke": live(40) }, { "mod:Armbar from Mount": t + 50, "mod:Triangle Choke": t });
    const cloud = blob({ "mod:Armbar from Mount": 0, "mod:Triangle Choke": live(70) }, { "mod:Armbar from Mount": t + 10, "mod:Triangle Choke": t + 20 });
    check("per technique: its own newer edit stays, the cloud's newer one wins", mods(app._mergeProgressBlobs(local, cloud)),
      { "mod:Armbar from Mount": [live(55), t + 50], "mod:Triangle Choke": [live(70), t + 20] }); }
  { const local = blob({ goal: 20 }, { goal: t - 9e6 }), cloud = blob({ goal: 20, "mod:Kimura": live(33, 0) }, { goal: t - 9e6, "mod:Kimura": t });
    check("a copy without the keys takes them", mods(app._mergeProgressBlobs(local, cloud)), mods(cloud)); }
  { const m = app._mergeProgressBlobs(blob({ "mod:Armbar from Mount": live(55) }, { "mod:Armbar from Mount": t + 50 }), blob({ "mod:Triangle Choke": live(70) }, { "mod:Triangle Choke": t + 20 }));
    check("its merge is idempotent", mods(app._mergeProgressBlobs(m, m)), mods(m));
    check("a merge with nothing keeps them", mods(app._mergeProgressBlobs(m, { v: 2 })), mods(m)); }
  return { fails, n };
}
let bad = 0;
for (const [name, rev] of RELEASES) {
  const C = classAt(rev), r = checks(C, name);
  const writes = /["'`]mod:/.test(show(rev, "neural/src/app.src.jsx"));
  console.log(name.padEnd(9), writes ? "FAIL" : "ok  ", "it writes no mod: key itself");
  if (r.fails || r.n !== 6 || writes) bad++;
}
// CONTROL 1: the newest release with its settings merge made local-wins; the checks must catch it
const LWW = "if (!(sk in merged) || ct > lt) { merged[sk] = cloud.settings[sk]; mAt[sk] = ct; }";
const mutant = classAt(RELEASES[0][1], (s) => { if (s.split(LWW).length !== 2) throw new Error("the settings merge line is not where it was"); return s.replace(LWW, "if (!(sk in merged)) { merged[sk] = cloud.settings[sk]; mAt[sk] = ct; }"); });
const m = checks(mutant, "mutant", true);
console.log("control 1: a local-wins settings merge fails", m.fails, "of", m.n, "checks", m.fails ? "(as it must)" : "(IT MUST FAIL SOME)");
if (!m.fails) bad++;
// CONTROL 2: the newest release handed the modifiers as a new TOP-LEVEL key keeps its own old copy
{ const C = classAt(RELEASES[0][1]), a = Object.create(C.prototype); a._publishKnowledge = () => {}; a.fx = () => {};
  const local = { v: 2, mods: { "Armbar from Mount": [50, 1, "S", 1, t] } };
  const merged = a._mergeProgressBlobs(local, { v: 2, mods: { "Armbar from Mount": [0, 0, "S", 1, t + 9e5], "Triangle Choke": [70, 1, "S", 1, t + 9e5] } });
  const pinned = J(merged.mods) === J(local.mods);
  console.log("control 2: as a top-level key,", RELEASES[0][0], pinned ? "keeps its own old copy (pinned): why the modifiers are settings" : "TOOK THE CLOUD'S (the reason for settings no longer holds: re-read MODS1)");
  if (!pinned) bad++; }
console.log(bad ? "FAILED: " + bad : "every release carries and takes the keys; both controls hold");
process.exit(bad ? 1 : 0);
