// SET1 (v1.295.3): the mutants of Settings' new layout, each run against the NAMED test of e2e/journeys/settings-tabs.spec.ts
// that must turn red. A mutant edits the BUILT bundle as text (`settings-ui.js`, or `neural.js` for the eager half) in this
// worktree's served tree, runs its one test, and puts the file back byte for byte. Targets are string literals and property names,
// which survive minification; a target that is absent, or present more than once, throws (a mutant that changes nothing is not
// a kill). Every test first runs once on the clean build and must pass: a red baseline makes its mutants unreportable.
//
// Run under the build lock (core suite port :8133, this worktree's source/public), after `npm run dev:neural:app`:
//   source /home/user/bjj-orchestrator/quartz/acquire-build-lock.sh <seat> "settings mutants" && \
//     TMPDIR=/home/user/tmp-pw SET1_MUTANT_OUT=/home/user/tmp-pw/settings/mutants node tests/artifacts/settings_layout_mutants.mjs
// SET1_MUTANT_ONLY=name,name runs a subset. The results land in $SET1_MUTANT_OUT/results.json; the archive's SET1 entry has the table.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const root = resolve(import.meta.dirname, "../..");
const out = process.env.SET1_MUTANT_OUT;
if (!out) throw Error("SET1_MUTANT_OUT (a scratch directory) is required");
mkdirSync(out, { recursive: true });
const app = resolve(root, "source/public/static/neural/app");
const files = { settings: resolve(app, "settings-ui.js"), neural: resolve(app, "neural.js") };
const SPEC = "journeys/settings-tabs\\.spec", CHOICES = "journeys/settings-choices\\.spec";
// [name, file, test title (a regex), from, to, expect = "red", spec = SPEC]: the seventh field (v1.298.2) names another spec file
const MUTANTS = [
  ["frame-440", "settings", "at 1440x900: the frame", "min(760px,calc(100vw - 96px))", "min(440px,calc(100vw - 96px))"],
  ["frame-440-his-window", "settings", "at 1074x796: the frame", "min(760px,calc(100vw - 96px))", "min(440px,calc(100vw - 96px))"],
  ["frame-edge-800", "settings", "at 800x900: the frame", "width:min(760px,calc(100vw - 64px))", "width:min(760px,calc(100vw - 16px))"],
  ["no-phone-sheet", "settings", "at 390x631: the frame", "width:100vw!important", "width:92vw!important"],
  ["rail-as-row", "settings", "at 1074x796: the frame", "flex-direction:column;justify-content:flex-start", "flex-direction:row;justify-content:flex-start"],
  ["choices-small", "settings", "at 1440x900: the frame", ".ng-set-seg>button,.ng-set-num{min-height:40px;min-width:40px}", ".ng-set-seg>button,.ng-set-num{min-height:32px;min-width:32px}"],
  ["ticks-small", "settings", "at 800x900: the frame", ".ng-set-tick{flex:none;width:40px;height:40px;", ".ng-set-tick{flex:none;width:24px;height:24px;"],
  ["phone-choices-narrow", "settings", "at 390x631: the frame", ".ng-set-seg>button{min-width:44px}", ""],
  ["help-unbounded", "settings", "at 1440x900: the frame", ".ng-set-h{margin-top:4px;font-size:13px;line-height:1.5;color:#93a0bd;max-width:60ch}", ".ng-set-h{margin-top:4px;font-size:13px;line-height:1.5;color:#93a0bd}"],
  ["note-twice-on-phone", "settings", "at 390x631: the frame", ".ng-set-head .ng-set-note{display:none}", ""],
  ["note-words", "settings", "at 1074x796: the frame", "being continuously fine-tuned", "being fine-tuned"],
  ["jump-goes-nowhere", "settings", "at 1440x900: a press on each group", "[data-settings-group=\"'", "[data-settings-groupX=\"'"],
  ["jump-goes-nowhere-phone", "settings", "at 390x631: a press on each group", "[data-settings-group=\"'", "[data-settings-groupX=\"'"],
  ["hold-ends-on-arrival", "settings", "at 1440x900: a press on each group", "arrived=!0;return", "arrived=!0"],
  ["spy-dead", "settings", "scrolling lights the group in view", "\"[data-settings-group]\"", "\"[data-settings-groupX]\""],
  ["old-id-not-opened", "settings", "scrolling lights the group in view", "this._settingsJump(", "(()=>0)("],
  ["redraw-jumps", "settings", "scrolling lights the group in view", "this._settingsRowX==null", "!0"],
  ["keys-no-down", "settings", "keyboard: the list keeps its keys", "ArrowDown:", "ArrowDownX:"],
  ["frame-leaks-to-dialogs", "neural", "another dialog opened after Settings", "removeAttribute(\"data-settings-card\")", "getAttribute(\"data-settings-card\")"],
  // SETH1 (v1.298.2): the group's heading put back in the option title's look (14 px / 600 / #eef1f6, no case change): the heading step
  // of the frame test goes red at his window and on the phone. And the spy blinded: the every-group wheel walk goes red.
  ["heads-as-options", "settings", "at 1074x796: the frame", ".ng-set-grp>h3{position:relative;margin:0;padding-bottom:8px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#96b4ff;", ".ng-set-grp>h3{position:relative;margin:0;padding-bottom:8px;font-size:14px;line-height:16px;font-weight:600;color:#eef1f6;"],
  ["heads-as-options-phone", "settings", "at 390x631: the frame", ".ng-set-grp>h3{position:relative;margin:0;padding-bottom:8px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#96b4ff;", ".ng-set-grp>h3{position:relative;margin:0;padding-bottom:8px;font-size:14px;line-height:16px;font-weight:600;color:#eef1f6;"],
  ["spy-dead-every-group", "settings", "at 1074x796: a real wheel to each group", "\"[data-settings-group]\"", "\"[data-settings-groupX]\""],
  // SETH2 B (v1.298.2): one mutant per mapping of "During a roll, each place shows", red in e2e/journeys/settings-choices.spec.ts.
  ["shows-question-asks-nothing", "settings", "at 1074x796: each place shows", '&&this.set("landQuestions",', '&&this.set("landQuestions",!', "red", CHOICES],
  ["shows-card-keeps-question", "settings", "at 1074x796: each place shows", '!=="none"&&this.get("landQuestions"', '==="question"&&this.get("landQuestions"', "red", CHOICES],
  ["shows-none-keeps-card", "settings", "at 1074x796: each place shows", '!=="none","settings")', '!=="nonX","settings")', "red", CHOICES],
  // SETH4 (v1.298.2): the choice cards' claims, red in the same spec. Reverting SETH4's commit removes these with the cards.
  ["cards-lines-hidden", "settings", "at 1074x796: choice cards", ".ng-set-cline{grid-column:2;", ".ng-set-cline{display:none;grid-column:2;", "red", CHOICES],
  ["cards-lines-hidden-phone", "settings", "at 390x631: choice cards", ".ng-set-cline{grid-column:2;", ".ng-set-cline{display:none;grid-column:2;", "red", CHOICES],
  ["cards-never-checked", "settings", "at 1074x796: choice cards", '("aria-checked",', '("aria-checked","false")||(', "red", CHOICES],
  ["cards-arrows-choose-nothing", "settings", "choice cards by keyboard", "{ArrowDown:1,ArrowRight:1,", "{ArrowDownX:1,ArrowRightX:1,", "red", CHOICES],
  ["cards-focus-lost-on-redraw", "settings", "choice cards by keyboard", "[aria-checked=\"true\"]');", "[aria-checkedX=\"true\"]');", "red", CHOICES],
  // SET1-RED (PR #451's first CI run): CONTROLS THAT MUST STAY GREEN (the sixth field). The card's entrance slowed to 1.2 s: the frame
  // step must still read the card where it RESTS. The step as first shipped read it mid-slide on CI (30.68 px from the bottom at 800,
  // [0, 1, 390, 632] at 390) and goes red here; the step that waits for the card's animations holds.
  ["slow-entrance-800", "settings", "at 800x900: the frame", ".ng-modal>[data-settings-card]{display:flex;", ".ng-modal>[data-settings-card]{animation-duration:1.2s!important;display:flex;", "green"],
  ["slow-entrance-390", "settings", "at 390x631: the frame", ".ng-modal>[data-settings-card]{display:flex;", ".ng-modal>[data-settings-card]{animation-duration:1.2s!important;display:flex;", "green"],
];
const only = (process.env.SET1_MUTANT_ONLY || "").split(",").filter(Boolean);
const chosen = MUTANTS.filter((m) => !only.length || only.includes(m[0]));
if (!chosen.length) throw Error("no mutant selected");
const originals = Object.fromEntries(Object.entries(files).map(([k, p]) => [k, readFileSync(p)]));
const restore = () => { for (const [k, p] of Object.entries(files)) writeFileSync(p, originals[k]); };
process.on("exit", restore);
// One test, by title, on the served tree as it stands. Returns the counts Playwright's JSON reporter gives; zero ran is an error.
const run = (title, tag, spec = SPEC) => {
  const json = resolve(out, tag + ".json");
  rmSync(json, { force: true });
  const r = spawnSync("npx", ["playwright", "test", "-c", "e2e/playwright.config.ts", spec, "-g", title, "--reporter=json", "--retries=0", "--workers=1", "--output", resolve(out, "pw-" + tag)],
    { cwd: root, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: json }, encoding: "utf8", timeout: 600000 });
  let stats;
  try { stats = JSON.parse(readFileSync(json, "utf8")).stats; } catch { throw Error(`${tag}: no JSON report (exit ${r.status}): ${(r.stderr || "").slice(-400)}`); }
  const ran = stats.expected + stats.unexpected + stats.flaky;
  if (!ran) throw Error(`${tag}: the title /${title}/ ran no test`);
  return { ran, passed: stats.expected, failed: stats.unexpected + stats.flaky };
};
const results = [];
const baselines = new Map();
for (const [name, file, title, from, to, expect = "red", spec = SPEC] of chosen) {
  const key = spec + " " + title;
  if (!baselines.has(key)) {
    restore();
    const b = run(title, "baseline-" + baselines.size, spec);
    if (b.failed) throw Error(`baseline red for /${title}/: ${JSON.stringify(b)}; no mutant of it is reportable`);
    baselines.set(key, b);
    console.log(`baseline ${spec} /${title}/: ${b.passed} passed`);
  }
  const text = originals[file].toString("utf8");
  const n = text.split(from).length - 1;
  if (n !== 1) throw Error(`${name}: target found ${n} times in ${file} (need exactly 1): ${from}`);
  restore();
  writeFileSync(files[file], text.replace(from, to));
  const m = run(title, name, spec);
  restore();
  const killed = m.failed > 0;
  // a control that must stay green counts as a pass when it held, and as a failure (`killed: false` is not enough) when it went red
  const ok = expect === "green" ? !killed : killed;
  results.push({ name, file, title, expect, killed, ok, ...m });
  console.log(`${expect === "green" ? (ok ? "HELD   " : "BROKE  ") : (ok ? "KILLED " : "SURVIVED")} ${name} (/${title}/: ${m.failed} red of ${m.ran})`);
}
restore();
writeFileSync(resolve(out, "results.json"), JSON.stringify({ baselines: Object.fromEntries(baselines), results }, null, 1));
const bad = results.filter((r) => !r.ok).map((r) => r.name);
const kills = results.filter((r) => r.expect !== "green"), holds = results.filter((r) => r.expect === "green");
console.log(`${kills.filter((r) => r.ok).length} of ${kills.length} killed; ${holds.filter((r) => r.ok).length} of ${holds.length} controls held` + (bad.length ? `; NOT as expected: ${bad.join(", ")}` : ""));
if (bad.length) process.exitCode = 1;
