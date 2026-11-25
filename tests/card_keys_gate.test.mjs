// CARD1-S2 (v1.303.0): THE CARD-KEY GATE, scripts/check_card_keys.py (ci-validate: `--baseline-ref HEAD^1`), run on fixture
// git repositories: a base commit holding one content file, then an edit in the working tree, then the gate.
//   · a question reworded without its id FAILS (kept answer: found by its answer, even moved; a new answer: by its place)
//     and names the id to write; with `id: <the old text's hash>` it passes;
//   · an id dropped or changed on an unchanged question FAILS (the card would lose its key);
//   · a card added or deleted passes, counted; a new card in a deleted one's place passes with an id of its own;
//   · in one array: two different questions under one key (a duplicate id, or an id equal to another card's text hash) and
//     a malformed id FAIL;
//   · ABSENCE IS NEVER A PASS: no content at all, a base that is not a commit, a base with no card to compare: each FAILS;
//   · a renamed file is followed (a reword inside it still fails); without a base, only the arrays are checked.
// MUTANTS (scripts/check_card_keys.py's header; each red here): the id check dropped from `array_faults` → "malformed";
// step 1 (the same answer) dropped from `pair_changes` → "reworded and moved"; the zero-compared floor removed → "a base
// with no card".
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ngKnowledgeQuestionHash as H } from "../neural/src/knowledge-profile.src.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = resolve(ROOT, "scripts/check_card_keys.py");
const ENV = { ...process.env, GIT_AUTHOR_NAME: "fixture", GIT_AUTHOR_EMAIL: "", GIT_COMMITTER_NAME: "fixture", GIT_COMMITTER_EMAIL: "" };
const card = (i, extra = {}) => ({ question: `What does the fixture card number ${i} ask?`, answer: `The fixture card number ${i} answers at length.`, ...extra });
const record = () => ({ name: "Fixture", top: { flashcards: [card(1), card(2), card(3)] }, flashcards_position: [card(4), card(5)] });
const FILE = "content/Positions/Fixture.json";

/** a repository whose base commit holds `base` (null: no content), and whose working tree holds `edit(clone of base)` */
function run(edit, { base = record(), args = ["--baseline-ref", "HEAD"], rename = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "card-keys-"));
  try {
    const git = (...a) => { const r = spawnSync("git", a, { cwd: dir, env: ENV, encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); return r; };
    git("init", "-q");
    mkdirSync(join(dir, "content/Positions"), { recursive: true });
    writeFileSync(join(dir, "content/README.md"), "fixture\n");
    if (base) writeFileSync(join(dir, FILE), JSON.stringify(base, null, 2));
    git("add", "-A"); git("commit", "-q", "-m", "base");
    if (edit) {
      const now = edit(JSON.parse(JSON.stringify(base || {})));
      if (now === null) rmSync(join(dir, FILE), { force: true });
      else writeFileSync(join(dir, FILE), JSON.stringify(now, null, 2));
      if (rename) { renameSync(join(dir, FILE), join(dir, "content/Positions/Renamed.json")); git("add", "-A"); }
    }
    const r = spawnSync("python3", ["-B", GATE, "--root", dir, ...args], { cwd: ROOT, encoding: "utf8" });
    return { status: r.status, out: r.stdout + r.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const pass = (r, what) => assert.equal(r.status, 0, `${what}: should pass\n${r.out}`);
const fail = (r, re, what) => { assert.equal(r.status, 1, `${what}: should fail\n${r.out}`); assert.match(r.out, re, what); };

test("unchanged: every card compared and kept (a positive count)", () => {
  const r = run((d) => d);
  pass(r, "unchanged");
  assert.match(r.out, /card keys: 5 cards in 2 flashcards arrays of 1 files \(0 carry an id\)/);
  assert.match(r.out, /5 cards compared \(5 kept by their key, 0 of them reworded/);
});

test("a question reworded without its id fails and names the id; with it, it passes", () => {
  const old = card(2).question;
  const r = run((d) => { d.top.flashcards[1].question = "Shorter: what does card two ask?"; return d; });
  fail(r, /its question was reworded without its id/, "reworded, answer kept");
  assert.ok(r.out.includes(`"id": "${H(old)}"`), "the message names the id to write");
  const ok = run((d) => { Object.assign(d.top.flashcards[1], { question: "Shorter: what does card two ask?", id: H(old) }); return d; });
  pass(ok, "reworded with its id");
  assert.match(ok.out, /1 of them reworded with their id/);
});

test("reworded and moved: found by its answer", () => {
  const r = run((d) => { const c = d.top.flashcards.splice(0, 1)[0]; c.question = "Moved and reworded?"; d.top.flashcards.push(c); return d; });
  fail(r, /its question was reworded without its id/, "reworded and moved");
});

test("reworded with its answer: found by its place", () => {
  const r = run((d) => { d.flashcards_position[0] = { question: "A new question?", answer: "A new answer, at some length." }; return d; });
  fail(r, /its question \(and answer\) were reworded without its id/, "same place, both texts new");
  const own = run((d) => { d.flashcards_position[0] = { question: "A new question?", answer: "A new answer, at some length.", id: "0badc0de" }; return d; });
  pass(own, "a new card in a deleted one's place, with an id of its own");
});

test("an id dropped or changed on an unchanged question fails", () => {
  const base = record(); Object.assign(base.top.flashcards[0], { question: "Reworded once?", id: H(card(1).question) });
  fail(run((d) => { delete d.top.flashcards[0].id; return d; }, { base }), /its id was dropped or changed/, "dropped");
  fail(run((d) => { d.top.flashcards[0].id = "0badc0de"; return d; }, { base }), /its id was dropped or changed/, "changed");
  pass(run((d) => d, { base }), "kept");
});

test("a card added or deleted passes, counted", () => {
  const add = run((d) => { d.top.flashcards.push(card(9)); return d; });
  pass(add, "added"); assert.match(add.out, /0 deleted, 1 added/);
  const del = run((d) => { d.top.flashcards.splice(1, 1); return d; });
  pass(del, "deleted"); assert.match(del.out, /1 deleted, 0 added/);
});

test("one array: two questions under one key, or a malformed id, fail", () => {
  fail(run((d) => { d.top.flashcards[0].id = "0badc0de"; d.top.flashcards[1].id = "0badc0de"; return d; }, { args: [] }), /held by 2 different questions/, "a duplicate id");
  fail(run((d) => { d.top.flashcards[0].id = H(card(2).question); return d; }, { args: [] }), /held by 2 different questions/, "an id equal to another card's text hash");
  fail(run((d) => { d.top.flashcards[0].id = "0BADC0DE"; return d; }, { args: [] }), /not 8 lowercase hex digits/, "malformed");
});

test("absence is never a pass: no content, a base that is not a commit, a base with no card", () => {
  fail(run(() => null, { args: [] }), /nothing was checked/, "no content at all");
  fail(run((d) => d, { args: ["--baseline-ref", "no-such-ref"] }), /is not a commit here/, "an unknown base");
  fail(run(() => record(), { base: null }), /no card was compared against the base/, "a base with no card");
});

test("a renamed file is followed; without a base only the arrays are checked", () => {
  fail(run((d) => { d.top.flashcards[2].question = "Renamed and reworded?"; return d; }, { rename: true }), /Renamed\.json .*reworded without its id/, "renamed");
  const r = run((d) => { d.top.flashcards[2].question = "Reworded, no base given?"; return d; }, { args: [] });
  pass(r, "no base"); assert.doesNotMatch(r.out, / vs /);
});
