// CARD1-S1a (v1.301.4; the orchestrator's ruling on CARD1): two guards on the prompts the content tools send.
//
// 1. THE WEEKLY CONTENT BOT ADDS FLASHCARDS AND NEVER REWORDS ONE. A card's progress (its grade and review schedule, for every
//    player) is keyed by a hash of its exact question text, so a reworded question resets that card for everyone (CARD1;
//    the v1.182.2 rewrite orphaned 10,679 questions, DUE1). Until the card key ships (CARD1 slice 2), every flashcards
//    section of scripts/regenerate_content_json.py's *_PROMPT templates must keep each existing question character for
//    character, only add, and hold new questions to a soft 70 characters. Read from the file's text; each section found is
//    counted, and none found is a failure (CLAUDE.md §6: "found nothing" and "never looked" must not read the same).
// 2. NO REAL COACH IS NAMED AS A STYLE IN ANY PROMPT (the owner's rule: archetypes only, never named people). The names this
//    PR removed (two from scripts/rewrite_questions.py's style line, three from the content bot's EXPERT_GUIDELINES, one of
//    them the same, and that one from scripts/draft_curriculum.py's rubric) are kept out of the tree: only the SHA-256 of
//    each, lowercased "first last", is here, taken from the removed lines' git blobs. Every two-word sequence of every file
//    under scripts/ is hashed and compared; a hit names the file and line, never the name. THREE FILES KEEP NAMES ON PURPOSE,
//    listed below with why (each is a decision of its own, not this guard's): a hit there is counted, never a failure.
//    Mutants: the old "Add/Improve flashcards" heading back → the first test red; the removed style line back → the second.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BOT = readFileSync(resolve(ROOT, "scripts/regenerate_content_json.py"), "utf8");

test("the content bot's flashcards sections keep every existing question and only add (CARD1-S1a)", () => {
  // each *_PROMPT template's flashcards section: from its "### N. … flashcards" heading to the next heading
  const sections = [];
  for (const m of BOT.matchAll(/^([A-Z_]+_PROMPT) = '''([\s\S]*?)'''/gm)) {
    const lines = m[2].split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!/^###\s.*flashcards/i.test(lines[i])) continue;
      let j = i + 1;
      while (j < lines.length && !/^#{2,3}\s/.test(lines[j])) j++;
      sections.push({ prompt: m[1], heading: lines[i], body: lines.slice(i, j).join("\n") });
    }
  }
  assert.ok(sections.length >= 4, `premise: the four flashcards sections found (positions, transitions, submissions, principles): ${sections.length}`);
  for (const s of sections) {
    assert.doesNotMatch(s.heading, /improve/i, `${s.prompt}: its flashcards heading tells the bot to improve existing cards: "${s.heading}"`);
    assert.doesNotMatch(s.body, /(improve|rewrite|reword|rephrase|shorten)\s+(the\s+)?(existing\s+)?(flashcards?|questions?)/i, `${s.prompt}: its flashcards section asks for existing questions to be changed`);
    assert.match(s.body, /KEEP every existing flashcard's `question` EXACTLY as it is written/, `${s.prompt}: the keep rule`);
    assert.match(s.body, /70 characters or fewer/, `${s.prompt}: the soft target for new questions`);
  }
});

// the removed names' SHA-256, each lowercased "first last" (taken from the removed lines' git blobs, never written here)
const NAMES = new Set([
  "4a7e8b46a83c6e4f7b0745b934900e60cc25131a99392545d7bf1dbf81fb53d5",
  "a57f9280158f83a35b719d9965615446c6babaf5318750cc9c74469631cdd58c",
  "c2d53fb80471ba5031876f88ab2589b7d97e5609ead070be62c5d4665269e252",
  "3e2ec6ba6c15484a46b814b131280fdd5de5880422350ef681ddfb0a681937f4",
]);
// files that name real people ON PURPOSE, and why; not a style the tools are told to imitate
const KEEPS = new Map([
  ["scripts/source_clips.py", "LEGEND_GUIDANCE: whose footage to SEARCH for (a real instructor's own clips); the names are the search target"],
  ["scripts/calibrate_probabilities.py", "the calibration panel's personas: changing them changes future calibration numbers, which are the owner's call (CARD1-S1a report)"],
  ["scripts/solve_flow.py", "a review note's factual attribution (who created a technique, read from its clips), not a prompt and not a style"],
]);
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = resolve(dir, f);
  if (f === "node_modules" || f === "__pycache__" || f.startsWith(".")) return [];
  return statSync(p).isDirectory() ? walk(p) : [p];
});

test("no prompt under scripts/ names a real coach as a style (CARD1-S1a; the owner's archetypes-only rule)", () => {
  const files = walk(resolve(ROOT, "scripts")).filter((p) => /\.(py|mjs|js|ts|md|txt|json|sh)$/.test(p));
  assert.ok(files.length > 50, `premise: the scripts read (${files.length})`);
  const hits = [], kept = [];
  let pairs = 0;
  for (const p of files) {
    readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      const words = line.toLowerCase().match(/[a-z]+/g) || [];
      for (let k = 0; k + 1 < words.length; k++) {
        pairs++;
        if (!NAMES.has(createHash("sha256").update(words[k] + " " + words[k + 1]).digest("hex"))) continue;
        const where = relative(ROOT, p);
        (KEEPS.has(where) ? kept : hits).push(`${where}:${i + 1}`);
      }
    });
  }
  assert.ok(pairs > 100000, `premise: the word pairs hashed (${pairs})`);
  assert.deepEqual(hits, [], "a real coach is named in a prompt (archetypes only)");
  // the kept files still hold what they hold (a KEEPS row that matches nothing is stale and fails)
  for (const f of KEEPS.keys()) assert.ok(kept.some((h) => h.startsWith(f + ":")), `${f} is listed as keeping names, and names none: drop its row`);
});
