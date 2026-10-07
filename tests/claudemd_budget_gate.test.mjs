// Pure-unit suite for the CLAUDE.md budget gate's scoped-canon checks:
//   node --test tests/claudemd_budget_gate.test.mjs
//
// WHAT THIS IS FOR. At v1.224.3 §5 and most of §6 moved out of CLAUDE.md into path-scoped
// `.claude/rules/*.md` files that Claude Code loads only when a session touches their folders.
// CLAUDE.md shrinking is the goal, so every way that split can quietly come UNDONE also makes
// CLAUDE.md look better. Each test below is one of those ways, and the gate must refuse it:
//   - a rules file without `paths:` loads in EVERY session (root weight the root ceiling misses);
//   - a glob that matches no tracked file means the rule never loads;
//   - a deleted rules file takes its traps with it (its ceiling is left naming nothing);
//   - a rules file CLAUDE.md does not name cannot be found by a reader who has not opened its
//     folder (Grep and Glob do not trigger a load);
//   - an @-import re-attaches whatever it names, everywhere;
//   - the catalogue floor counts root AND rules entries, so moving a trap changes nothing and
//     gutting the catalogue still fails.
//
// It drives the REAL script, copied into a throwaway repo so its ROOT (derived from its own
// path) is the fixture; never a re-implementation of its rules (CLAUDE.md §6.3). Needs python3
// and git, as tests/claudemd_refs_gate.test.mjs already does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = resolve(ROOT, "scripts/check_claudemd_budget.py");

const entries = (n, tag) => Array.from({ length: n }, (_, i) => `- **${tag} trap ${i}.** body\n`).join("\n");
const RULE = (globs, n = 15) =>
  `---\npaths:\n${globs.map((g) => `  - "${g}"`).join("\n")}\n---\n\n` +
  `## 6. THOUGHT TRAPS — scoped\n\n### 6.1 Before you touch src\n\n${entries(n, "scoped")}`;
const ROOT_DOC = (extra = "") =>
  `# Probe canon\n\n## 1. Rules\n\ntext\n\n## 6. THOUGHT TRAPS\n\n### About to…\n\n` +
  `- …touch src → **§6.1** in \`.claude/rules/scoped.md\`\n\n### 6.8 Before you delete\n\n${entries(5, "root")}${extra}\n## 7. After\n\ntext\n`;

/** Build a throwaway repo: CLAUDE.md, the companions, a budget, one tracked source file, and
 *  the given rules files; `git add` them so the gate's `git ls-files` sees a tracked tree. */
function fixture({ root = ROOT_DOC(), rules = { "scoped.md": RULE(["src/**"]) }, ceilings } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "claudemd-budget-"));
  mkdirSync(join(dir, "scripts"));
  mkdirSync(join(dir, "docs"));
  mkdirSync(join(dir, "src"));
  mkdirSync(join(dir, "tests/artifacts"), { recursive: true });
  mkdirSync(join(dir, ".claude/rules"), { recursive: true });
  copyFileSync(GATE, join(dir, "scripts/check_claudemd_budget.py"));
  writeFileSync(join(dir, "CLAUDE.md"), root);
  writeFileSync(join(dir, "docs/Neural.md"), "n\n");
  writeFileSync(join(dir, "docs/Changelog-Archive.md"), "a\n");
  writeFileSync(join(dir, "src/app.js"), "// tracked\n");
  for (const [name, text] of Object.entries(rules)) writeFileSync(join(dir, ".claude/rules", name), text);
  const caps = ceilings ?? {
    "CLAUDE.md": 10000, "docs/Neural.md": 100, "docs/Changelog-Archive.md": 100,
    ...Object.fromEntries(Object.keys(rules).map((n) => [`.claude/rules/${n}`, 10000])),
  };
  writeFileSync(join(dir, "tests/artifacts/budget_docs.json"), JSON.stringify({ ceilings: caps }));
  const git = (...a) => spawnSync("git", a, { cwd: dir, encoding: "utf8" });
  assert.equal(git("init", "-q").status, 0, "git init");
  assert.equal(git("add", "-A").status, 0, "git add");
  return dir;
}

function run(dir) {
  const r = spawnSync("python3", [join(dir, "scripts/check_claudemd_budget.py")], { cwd: dir, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}

function gate(opts, after) {
  const dir = fixture(opts);
  try {
    if (after) after(dir);
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the clean split passes and counts the catalogue across CLAUDE.md and the rules files", () => {
  const r = gate();
  assert.equal(r.code, 0, `clean fixture must pass:\n${r.out}`);
  // 5 root + 15 scoped = 20, exactly the floor: neither file alone would reach it
  assert.match(r.out, /trap entries 20 \(CLAUDE\.md 5 \+ \.claude\/rules\/ 15\)/, r.out);
  assert.match(r.out, /\.claude\/rules\/scoped\.md\s+1 glob\(s\) matching 1 tracked files · 15 trap entries/, r.out);
});

test("a rules file with no `paths:` fails: it would load in every session", () => {
  const r = gate({ rules: { "scoped.md": RULE(["src/**"]).replace(/^---[\s\S]*?---\n/, "") } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /scoped\.md has no `paths:` globs/, r.out);
});

test("a `paths:` glob that matches no tracked file fails: the rule would never load", () => {
  const r = gate({ rules: { "scoped.md": RULE(["src/**", "nowhere/**"]) } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /glob 'nowhere\/\*\*' matches no tracked file/, r.out);
  assert.doesNotMatch(r.out, /'src\/\*\*' matches no/, "the live glob is not reported");
});

test("a deleted rules file fails while its ceiling still names it", () => {
  const r = gate({}, (dir) => rmSync(join(dir, ".claude/rules/scoped.md")));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\.claude\/rules\/scoped\.md has a committed ceiling but no longer exists/, r.out);
});

test("a rules file CLAUDE.md does not name fails", () => {
  const r = gate({ root: ROOT_DOC().replace("`.claude/rules/scoped.md`", "the scoped file") });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /scoped\.md is not named in CLAUDE\.md/, r.out);
});

test("an @-import inside a rules file fails", () => {
  const r = gate({ rules: { "scoped.md": RULE(["src/**"]) + "\n@docs/Changelog-Archive.md\n" } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /scoped\.md contains @-prefixed import/, r.out);
});

test("a rules file over its ceiling, or with none, fails", () => {
  const over = gate({ ceilings: { "CLAUDE.md": 10000, "docs/Neural.md": 100, "docs/Changelog-Archive.md": 100, ".claude/rules/scoped.md": 50 } });
  assert.equal(over.code, 1, over.out);
  assert.match(over.out, /\.claude\/rules\/scoped\.md: [\d,]+ chars exceeds the ceiling 50/, over.out);
  const none = gate({ ceilings: { "CLAUDE.md": 10000, "docs/Neural.md": 100, "docs/Changelog-Archive.md": 100 } });
  assert.equal(none.code, 1, none.out);
  assert.match(none.out, /\.claude\/rules\/scoped\.md: no ceiling committed/, none.out);
});

test("gutting the catalogue still fails: the floor counts both halves, and one short is red", () => {
  const r = gate({ rules: { "scoped.md": RULE(["src/**"], 14) } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /catalogue holds only 19 entries \(CLAUDE\.md 5 \+ \.claude\/rules\/ 14\)/, r.out);
});
