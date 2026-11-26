// THE ONE-STEP CLIENT (v1.281.3 to v1.304.0), run from its capture (tests/artifacts/schedule_onestep_client.json, cut from
// git by tests/artifacts/_capture_onestep_schedule.mjs, never re-typed): the schedule in which a late right answer earns
// exactly one step. Not a test (the suite collects tests/*.test.mjs only).
//
// `doubled(prior, day)` says whether the late answer's doubled wait (v1.305.0, LATE1) DECIDED one right answer: the writer
// as shipped and the one-step client write different schedules (`schedulePart`) from the same prior on the same day. It is a differential against
// the captured code, never a second copy of the rule. A history none of whose answers it decided is, row for row, the one the
// one-step client writes, so every claim the one-step schedule proved still holds on it exactly; the path searches of
// tests/schedule_rung.test.mjs and tests/schedule_linear.test.mjs count those histories apart from the ones it decided.
import { readFileSync } from "node:fs";
import * as K from "../neural/src/knowledge-profile.src.js";

export const ONESTEP = JSON.parse(readFileSync(new URL("./artifacts/schedule_onestep_client.json", import.meta.url), "utf8"));
export const onestep = new Function(ONESTEP.knowledge.ladder + "\n" + ONESTEP.knowledge.schedule +
  "\nreturn { write: ngKnowledgeScheduleRow, merge: ngKnowledgeMergeRow, interval: ngKnowledgeInterval, next: ngKnowledgeNextInterval };")();
export const onestepRecall = new Function([ONESTEP.rating.base, ONESTEP.rating.num, ONESTEP.rating.interval, ONESTEP.rating.recall].join("\n") +
  "\nreturn ngRatingRecall;")();
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
// THE SCHEDULE PART of a stored row: its head ([due, cell, last], + a move's answer) and its pair when it has one, never
// the cells after the pair's slot (v1.305.0's late mark, which the schedule never reads, and which the one-step client
// copies forward as a later build's cells) nor the [0, 0] that fills an empty pair slot
export function schedulePart(row, at = 3) {
  const head = row.slice(0, at);
  return row.length >= at + 2 && !(row[at] === 0 && row[at + 1] === 0) ? head.concat(row[at], row[at + 1]) : head;
}
// true when the doubled wait decided this right answer: the shipped writer and the one-step client schedule it differently
export function doubled(prior, day, at = 3) {
  return !same(schedulePart(K.ngKnowledgeScheduleRow(prior, true, day, at), at), schedulePart(onestep.write(prior, true, day, at), at));
}
// true when it decided any answer of the history `days` (right answers) from `start`
export function doubledPath(start, days, at = 3) {
  let r = start;
  for (const d of days) { if (doubled(r, d, at)) return true; r = K.ngKnowledgeScheduleRow(r, true, d, at); }
  return false;
}
