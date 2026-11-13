// .claude/settings.json (v1.264.6): the project's permission rules, under the key Claude Code reads.
//
// Claude Code reads permission rules from `permissions.allow|ask|deny`. A rule under any other key is read by nothing
// and protects nothing, and it looks exactly like protection; and an untracked settings file reaches no worktree and no
// CI job. So the file is tracked, and its push rules sit under the key the tool reads, narrowed to FORCE PUSHES:
// `git push` with --force, --force-with-lease, --force-if-includes, -f (alone or first in a bundle such as -fu), or a
// +refspec. Rule syntax is the CLI's: `*` matches any text; a Bash deny applies to every subcommand of a compound
// command and past wrappers and leading env assignments.
// Proof with the real CLI (claude -p, project settings only, a throwaway repo whose origin is a local bare repo): each
// form above refused, its command listed in permission_denials and origin unchanged; the previous rules, kept in a
// top-level `deny` array, let the same force push through.
//
// Mutants, each applied alone, killed at:
//   the deny block moved back to the top level -> "only known top-level keys" and "permissions.deny holds every..."
//   one force-push rule dropped                 -> "permissions.deny holds every force-push rule"
//   the file untracked again (.gitignore)        -> "the settings file is tracked"
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const FILE = ".claude/settings.json";
const KNOWN_TOP_LEVEL = ["permissions"];
const FORCE_PUSH = [
  "Bash(git push --force*)", // --force, --force-with-lease, --force-if-includes, first
  "Bash(git push * --force*)", // the same, later
  "Bash(git push -f*)", // -f first, alone or the head of a bundle (-fu)
  "Bash(git push * -f*)", // -f later
  "Bash(git push * +*)", // a +refspec
];
const settings = () => JSON.parse(readFileSync(FILE, "utf8"));

test("the settings file is tracked, so every checkout and CI job reads it", () => {
  const r = spawnSync("git", ["ls-files", "--error-unmatch", FILE], { encoding: "utf8" });
  assert.equal(r.status, 0, `${FILE} is not tracked: ${r.stderr}`);
});

test("only known top-level keys: a rule under a key Claude Code does not read protects nothing", () => {
  const keys = Object.keys(settings());
  assert.ok(keys.length > 0, "positive coverage: the file has keys");
  for (const key of keys) assert.ok(KNOWN_TOP_LEVEL.includes(key), `unknown top-level key "${key}" in ${FILE}: rules belong under permissions`);
});

test("permissions.deny holds every force-push rule", () => {
  const deny = settings().permissions?.deny;
  assert.ok(Array.isArray(deny), `${FILE}: permissions.deny is not an array`);
  for (const rule of FORCE_PUSH) assert.ok(deny.includes(rule), `${FILE}: permissions.deny lacks ${rule}`);
  console.log(`# ${FILE}: ${FORCE_PUSH.length} force-push rules under permissions.deny`);
});
