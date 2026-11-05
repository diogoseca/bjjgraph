#!/usr/bin/env node
// Run under the shared build lock. Concrete source mutations; positive counts,
// named assertion failures, and clean baselines are required. Always restore source.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const out = path.resolve(process.env.P1_MUTANT_OUT || ".ladder-p1/mutants");
fs.mkdirSync(out, { recursive: true });
const app = "neural/src/app.src.jsx", ui = "neural/src/challenge-ui.src.js", debt = "neural/src/gameplan-debt.src.js";
const originals = new Map([app, ui, debt].map(f => [f, fs.readFileSync(f, "utf8")]));
fs.mkdirSync(path.join(out, "originals"), { recursive: true });
for (const [f, s] of originals) fs.writeFileSync(path.join(out, "originals", path.basename(f)), s);
const hash = s => createHash("sha256").update(s).digest("hex");
const pageSpec = "practice-page.spec.ts";
const mutants = [];
function browser(id, file, from, to, spec, grep, assertion) { mutants.push({ id, file, from, to, spec, grep, assertion, kind: "browser" }); }
function unit(id, file, from, to, spec, assertion) { mutants.push({ id, file, from, to, spec, assertion, kind: "unit" }); }
const first = "P1-A: 390×631 warm new";
browser("A-intro-before-card", app, "this._practiceCorridor(); this._practiceRows(s);", "this._practiceCorridor(); this._practiceRows(s); list.prepend(s.explanation);", pageSpec, first, "P1-A: planning prose follows the question");
browser("A-covering-footer", app, 'const foot = this.drillFootRef.current; if (foot) foot.style.display = "none";', 'const foot = this.drillFootRef.current; if (foot) foot.style.cssText = "display:block;position:absolute;bottom:0;left:0;width:100%;height:70vh;z-index:999;background:#111";', pageSpec, first, "P1-A: primary response is hit-testable");
browser("A-no-first-opener", app, "this._sessionOpeners[Math.max(0, Math.min(s.keys.length - 1, s.idx || 0))]?.();", "void 0;", pageSpec, first, "P1-A: first question opens");
unit("B-selection-guard", ui, 'selectChallengeTrack(trackId) {\n    if (!this.beltUnlocked(trackId)) return;', 'selectChallengeTrack(trackId) {', "tests/belt_worn.test.mjs", "P1-B");
browser("B-enabled-locked-chevron", ui, 'locked.innerHTML = "<b>"', 'locked.innerHTML = "<button aria-label=Open>›</button><b>"', pageSpec, first, "[data-belt-locked] button");
browser("B-hidden-navigation", app, "return row && row.row && row.row.offsetParent !== null ? reg : null;", "return reg;", "keyboard.spec.ts", "a corridor repaint leaves no dead keys behind", "→ walks nothing once the deck is folded away");
browser("B-earlier-always-shown", ui, "if (practice && index < rank && !this._session.earlier) continue;", "void 0;", pageSpec, "P1-B:", '[data-belt="white"]');
browser("B-global-advanced-lock", app, "openStudy(key) {", "openStudy(key) { if (this._lessonIndex?.[key] && !this.beltUnlocked(this._lessonIndex[key].belt)) return;", "gameplan-learning-loop.spec.ts", "P1-B: White can study", "P1-B: advanced gameplay study is open");
browser("C-completion-gate", app, "more.disabled = !!s.plan && !s.plan.more.length;", "more.disabled = !s.live.complete || !!s.plan && !s.plan.more.length;", pageSpec, "P1-C: explicit new", "toBeEnabled");
unit("C-goal-cap", app, "if (this._session !== s || !incoming) return;", "if (this._session !== s || !incoming || this.practiceToday().done >= this.practiceToday().goal) return;", "tests/gameplan_runtime.test.mjs", "P1-C duplicate shared copy is not appended");
unit("C-split-session", app, "if (this._session !== s || !incoming) return;", "if (this._session !== s || !incoming) return; this._session = { ...s };", "tests/gameplan_runtime.test.mjs", "P1-C one session at goal");
unit("C-shared-double-credit", debt, "const seen = new Set();", "const seen = []; seen.add = q => seen.push(q);", "tests/gameplan.test.mjs", "Practice: reviewed questions count toward the goal");
browser("D-replace-on-arrival", app, "if ((!old || !s.keys.length) && !engaged) {", "if (!old || !s.keys.length) {", pageSpec, "P1-A/D: recognition at 390×631", "P1-D: selected MC answer keeps focus");
unit("D-skip-engaged-append", app, "if (!old && engaged && active && !due.some(r => r.key === active)) {", "if (engaged) return; if (!old && engaged && active && !due.some(r => r.key === active)) {", "tests/gameplan_runtime.test.mjs", "P1-D new work eventually joins");
browser("D-repaint-during-press", app, "else this._ensureGameplanRuntime().then(ready => { if (ready) this._afterPress(adopt); });", "else this._ensureGameplanRuntime().then(ready => { if (ready) { this.renderSession(); adopt(); } });", pageSpec, "P1-D: a late planner", "P1-D: the answer and pressed button survive arrival");
browser("D-index-focus-theft", app, 'this._afterPress(() => { if (this.deckShown && this._viewMode === "explore") this._renderPaneBody(); }); // payload can land after the pane is already up', 'this._afterPress(() => { if (this.deckShown && this._viewMode === "explore") { this._renderPaneBody(); this.explorerSearchRef.current?.focus(); } }); // payload can land after the pane is already up', "challenges-ui.spec.ts", "keyboard navigation reaches advanced tracks and restores focus on close$", "systems landing preserves the keyboard-selected Path");
browser("E-detached-registry", app, "if (this._sessionInline()) return this._openMini?.rid === rid && this._openMini.el.isConnected && this._openMini.el.offsetParent !== null ? reg : null;", "if (this._sessionInline()) return reg;", pageSpec, "P1-E: detached card", "P1-E: detached registry guard");
browser("E-space-resumes-roll", app, 'else if (e.key === " " && this._focusedMini()) { this._focusedMini().reveal(); }', 'else if (e.key === " " && this._focusedMini()) { this._focusedMini().reveal(); this.setPaused(!this.paused); }', pageSpec, "P1-E: card arrows.*false", "P1-E: Space does not resume play during study");
browser("E-swipe-dismisses", app, "const mini = this._focusedMini(); if (mini) (dx < 0 ? mini.next() : mini.prev());", "this.setDeckOpen(false);", pageSpec, "P1-E: card arrows.*false", "P1-E: a card swipe cannot dismiss Practice");
browser("E-unowned-resume", app, 'if (this._paneAutoPaused) { this._paneAutoPaused = false; this.setPaused(false); this.fx("pane_resumed", {}); }', 'if (true) { this._paneAutoPaused = false; this.setPaused(false); this.fx("pane_resumed", {}); }', pageSpec, "P1-E: card arrows.*true", "P1-E: close restores only its own pause");
browser("F-checkpoint-removed", ui, "this.startCheckpoint(belt.id, unit),", "undefined,", pageSpec, "P1-F: a Practice unit", "P1-F: checkpoint action starts a real quiz");
browser("F-comparison-removed", app, "box.appendChild(this._gameStudyPanel());", "void 0;", pageSpec, "P1-F: Practice retains", "P1-F: comparison controls survive");
browser("F-rewards-removed", ui, "if (shelf) list.appendChild(shelf);", "void 0;", pageSpec, "P1-F: Practice retains", "P1-F: earned rewards have a destination");
browser("F-path-removed", app, "box.append(pr, path, belt);", "box.append(pr, belt);", pageSpec, "P1-F: Practice retains", "P1-F: temporary Path destination remains");
browser("F-debt-filtered-by-belt", app, "const keys = review.rows.map(r => r.key);", "const keys = review.rows.filter(r => this._lessonIndex?.[r.key]?.belt === this.wornBelt().id).map(r => r.key);", pageSpec, "P1-A: 390×631 cold review", "P1-F: due reviews ignore belt locks");
browser("F-double-visit", app, 'this.track("neural_practice_opened", { surface: "practice" });', 'this.track("neural_practice_opened", { surface: "practice" }); this.track("neural_practice_opened", { surface: "practice" });', pageSpec, "P1-F: Practice retains", "P1-F: one event per deliberate surface visit");

const selected = process.env.P1_MUTANT_IDS ? mutants.filter(m => process.env.P1_MUTANT_IDS.split(",").includes(m.id)) : mutants;
if (!selected.length) throw Error("Zero mutation cases selected");
if (process.argv.includes("--list")) {
  for (const m of selected) {
    const sites = originals.get(m.file).split(m.from).length - 1;
    console.log(m.id, "sites=" + sites, m.spec, m.grep || "");
    if (sites !== 1) throw Error("Mutation must match exactly once: " + m.id);
  }
  process.exit(0);
}
const receipts = { at: new Date().toISOString(), source: Object.fromEntries([...originals].map(([f, s]) => [f, hash(s)])), baselines: [], mutants: [] };
const save = () => fs.writeFileSync(path.join(out, "receipts.json"), JSON.stringify(receipts, null, 2) + "\n");
const restore = () => { for (const [f, s] of originals) fs.writeFileSync(f, s); };
function command(args, name, env = {}) {
  const result = spawnSync(args[0], args.slice(1), { encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 32 * 1024 * 1024 });
  const output = (result.stdout || "") + (result.stderr || "");
  fs.writeFileSync(path.join(out, name + ".log"), output);
  return { code: result.status, output };
}
function build(name) {
  const r = command(["npm", "run", "dev:neural:app"], name);
  if (r.code !== 0) throw Error("Build failed: " + name);
}
function run(m, name) {
  if (m.kind === "unit") {
    const r = command(["node", m.spec], name);
    const count = Number(r.output.match(/^# tests (\d+)/m)?.[1] || 0);
    const failures = (r.output.match(/not ok[\s\S]*?(?=(?:# Subtest:|1\.\.|$))/g) || []).join("\n");
    return { code: r.code, count, errors: failures, infra: /SyntaxError|ReferenceError|TypeError|ERR_MODULE_NOT_FOUND/.test(failures) };
  }
  if (!process.env.P1_HEAVY_ADVISORY) throw Error("Set P1_HEAVY_ADVISORY to this box's memory advisory script");
  const go = command(["bash", process.env.P1_HEAVY_ADVISORY, "2048", "P1 named mutation " + name], name + "-advisory");
  if (go.code !== 0 || !/GO/.test(go.output)) throw Error("No browser advisory GO: " + name);
  const json = path.join(out, name + ".json");
  const r = command(["node", "node_modules/@playwright/test/cli.js", "test", "-c", "e2e/playwright.private.config.ts", "--workers=1", "--reporter=line,json", m.spec, "--grep", m.grep], name,
    { PW_PORT: "8276", PW_TESTDIR: "./journeys", TMPDIR: path.resolve(".ladder-p1/tmp"), PLAYWRIGHT_JSON_OUTPUT_NAME: json });
  let report; try { report = JSON.parse(fs.readFileSync(json, "utf8")); } catch { return { code: r.code, count: 0, errors: r.output, infra: true }; }
  const errors = [];
  function walk(suite) {
    for (const s of suite.specs || []) for (const t of s.tests || []) for (const result of t.results || []) for (const e of result.errors || []) errors.push(e.message || e.value || String(e));
    for (const s of suite.suites || []) walk(s);
  }
  for (const s of report.suites || []) walk(s);
  errors.push(...(report.errors || []).map(e => e.message || String(e)));
  const text = errors.join("\n");
  const count = report.stats.expected + report.stats.unexpected + report.stats.flaky;
  return { code: r.code, count, errors: text, infra: /Target.*closed|Target crashed|SIGKILL|browserType.launch|SyntaxError|ReferenceError|TypeError/.test(text) };
}
try {
  build("baseline-build");
  const baselines = new Map(selected.map(m => [m.kind + ":" + m.spec + ":" + (m.grep || ""), m]));
  let n = 0;
  for (const m of baselines.values()) {
    const r = run(m, "baseline-" + ++n);
    receipts.baselines.push({ spec: m.spec, grep: m.grep, code: r.code, count: r.count }); save();
    console.log("BASELINE", m.spec, m.grep || "", r.code, r.count);
    if (r.code !== 0 || !r.count || r.infra) throw Error("Clean baseline failed: " + m.spec + " / " + (m.grep || ""));
  }
  for (const m of selected) {
    restore();
    const original = originals.get(m.file), sites = original.split(m.from).length - 1;
    if (sites !== 1) throw Error(m.id + ": expected one mutation site, got " + sites);
    const changed = original.replace(m.from, m.to);
    fs.writeFileSync(m.file, changed);
    if (m.kind === "browser") build(m.id + "-build");
    const r = run(m, m.id);
    const killed = r.code !== 0 && r.count > 0 && !r.infra && r.errors.includes(m.assertion);
    receipts.mutants.push({ id: m.id, file: m.file, sites, before: m.from, after: m.to, sourceHash: hash(changed), spec: m.spec, grep: m.grep, assertion: m.assertion, code: r.code, count: r.count, killed, infrastructureFailure: r.infra, failure: r.errors.slice(0, 3500) });
    save(); console.log(killed ? "KILLED" : "NON-KILL", m.id, "ran=" + r.count);
  }
} finally {
  restore(); build("restored-build");
  receipts.restored = [...originals].every(([f, s]) => fs.readFileSync(f, "utf8") === s); save();
}
if (receipts.mutants.length !== selected.length || receipts.mutants.some(m => !m.killed)) process.exitCode = 1;
