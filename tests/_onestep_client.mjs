// THE ONE-STEP CLIENT (v1.281.3 to v1.304.0), run from its capture (tests/artifacts/schedule_onestep_client.json, cut from
// git by tests/artifacts/_capture_onestep_schedule.mjs, never re-typed): the schedule in which a late right answer earns
// exactly one step. Not a test (the suite collects tests/*.test.mjs only).
//
// THE ONE-STEP SCHEDULE ON HIS FINAL LADDER (`onestepNow`, v1.305.0, LATE2): the same captured code with ONE substitution,
// checked to match once: the ladder's values are the module's (`NG_KNOWLEDGE_LADDER`, its rungs past 2,922 days made by the
// fitted curve, U226 a, where v1.304.0 doubled). It is the schedule in which a late answer earns one step ON TODAY'S LADDER:
// what the late mark's R holds (`ngKnowledgeShadow`), and the baseline `late` compares against, so the ladder's new top
// (which moves early and on-time answers past 4 years too) is never counted as the late rule's. `onestep` stays the captured
// v1.304.0 client as it ran, an older build every row must still be read by.
//
// `late(prior, day)` says whether THE LATE RULE (v1.305.0, `ngKnowledgeLate`) DECIDED one right answer: the writer as shipped
// and `onestepNow` write different schedules (`schedulePart`) from the same prior on the same day. It is a differential
// against the captured code, never a second copy of the rule. A history none of whose answers it decided is, row for row, the
// one the one-step schedule writes on his ladder, so every claim the one-step schedule proved still holds on it exactly; the
// path searches of tests/schedule_rung.test.mjs and tests/schedule_linear.test.mjs count those histories apart from the ones
// it decided. (LATE1 named these `doubled` and `doubledPath`, against v1.304.0's own ladder, when the rule was twice the wait.)
import { readFileSync } from "node:fs";
import * as K from "../neural/src/knowledge-profile.src.js";

export const ONESTEP = JSON.parse(readFileSync(new URL("./artifacts/schedule_onestep_client.json", import.meta.url), "utf8"));
export const onestep = new Function(ONESTEP.knowledge.ladder + "\n" + ONESTEP.knowledge.schedule +
  "\nreturn { write: ngKnowledgeScheduleRow, merge: ngKnowledgeMergeRow, interval: ngKnowledgeInterval, next: ngKnowledgeNextInterval };")();
export const onestepRecall = new Function([ONESTEP.rating.base, ONESTEP.rating.num, ONESTEP.rating.interval, ONESTEP.rating.recall].join("\n") +
  "\nreturn ngRatingRecall;")();
// v1.304.0's moves merge (LATEFIX1), as captured: it keeps a cloud row's cells after the pair, the late mark among them
export const onestepMergeMoves = new Function(ONESTEP.owner.mergeMoves + "\nreturn ngProgressMergeMoves;")();
// the one substitution: the captured ladder's tail ("then doubling") replaced by the module's rungs, in the writer and in the
// rating's copy alike; each anchor must occur exactly once in the captured text, or the helper refuses to load
const once = (text, anchor, by) => { if (text.split(anchor).length !== 2) throw new Error("onestepNow: anchor not found once: " + anchor); return text.replace(anchor, by); };
const NOW = JSON.stringify(K.NG_KNOWLEDGE_LADDER);
export const onestepNow = new Function(once(ONESTEP.knowledge.ladder, "while (L.length < 24) L.push(L[L.length - 1] * 2);", "L.splice(0, L.length, ..." + NOW + ");") +
  "\n" + ONESTEP.knowledge.schedule + "\nreturn { write: ngKnowledgeScheduleRow, merge: ngKnowledgeMergeRow, interval: ngKnowledgeInterval, next: ngKnowledgeNextInterval, ladder: NG_KNOWLEDGE_LADDER };")();
export const onestepNowRecall = new Function([ONESTEP.rating.base, ONESTEP.rating.num,
  once(ONESTEP.rating.interval, "while (L.length < 24) L.push(L[L.length - 1] * 2);", "L.splice(0, L.length, ..." + NOW + ");"), ONESTEP.rating.recall].join("\n") + "\nreturn ngRatingRecall;")();
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
// THE SCHEDULE PART of a stored row: its head ([due, cell, last], + a move's answer) and its pair when it has one, never
// the cells after the pair's slot (v1.305.0's late mark, which the schedule never reads, and which the one-step client
// copies forward as a later build's cells) nor the [0, 0] that fills an empty pair slot
export function schedulePart(row, at = 3) {
  const head = row.slice(0, at);
  return row.length >= at + 2 && !(row[at] === 0 && row[at + 1] === 0) ? head.concat(row[at], row[at + 1]) : head;
}
// true when the late rule decided this right answer: the shipped writer and the one-step schedule on his ladder schedule it
// differently
export function late(prior, day, at = 3) {
  return !same(schedulePart(K.ngKnowledgeScheduleRow(prior, true, day, at), at), schedulePart(onestepNow.write(prior, true, day, at), at));
}
// true when it decided any answer of the history `days` (right answers) from `start`
export function latePath(start, days, at = 3) {
  let r = start;
  for (const d of days) { if (late(r, d, at)) return true; r = K.ngKnowledgeScheduleRow(r, true, d, at); }
  return false;
}
