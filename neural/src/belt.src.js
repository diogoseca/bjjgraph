// THE BELT A PLAYER WEARS (v1.209.0, owner ruling 2026-09-30) — pure, stateless, and shared by
// the app (concatenated into the bundle by neural/build/build.mjs, exports stripped), the unit
// suite (imported as a module) and the digest Worker (workers/digest, which names the next belt
// in the training-day email). One definition, three readers: none of them may compute it again.
//
// THE RULE. Everyone starts in white. You wear the belt AFTER the last belt — in an unbroken run
// from white — whose units are ALL proven (every live lesson done AND the unit's checkpoint
// passed). Clearing black leaves you in black. The capstone stays optional; Game Knowledge (the
// score) stays a percentage and decides no belt.
//
// WHY UNITS AND NOT LESSONS. Until v1.209.0 the Challenges tab's colour moved on lessons alone
// while its stripes needed checkpoints, so a player could wear blue with none of White's units
// proven — and lessons finish INCIDENTALLY (any correct answer anywhere bumps `prep`). The owner
// removed exactly that from the stripes in v1.95.3 ("a guest wore stripes he never earned"); the
// colour now follows the same rule, so the two finally agree.
//
// THE BELT IS STICKY. `held` is a high-water mark persisted in the v2 progress blob
// (`belts.held = {id, t}`) and merged as MAX across devices (`ngMergeHeldBelt`). The worn belt is
// never below it, whatever the rule computes later: a gi↔no-gi toggle (five units change size
// between rulesets), a failed card, a curriculum edit (the curriculum is still provisional) or a
// stale device merging can never lower it. A belt BELOW the held one counts as proven, so a
// curriculum edit that reopens an old belt cannot stall the next promotion either.
//
// research: docs/Changelog-Archive.md (v1.209.0) and tests/artifacts/_belt_alignment_probe.mjs.

/** The belts, bottom to top. curriculum.json, NG_CHALLENGE_TRACKS and the digest all spell these. */
export const NG_BELT_IDS = Object.freeze(["white", "blue", "purple", "brown", "black"]);

/** 0 (white) … 4 (black); -1 for anything that is not a belt id — never a guess. */
export function ngBeltRank(id) {
  return typeof id === "string" ? NG_BELT_IDS.indexOf(id) : -1;
}

/**
 * The belt you wear.
 *   cleared  booleans aligned with NG_BELT_IDS: every unit of that belt proven (missing = false)
 *   heldId   the persisted high-water mark (null/unknown = none)
 * Returns {id, rank}. Never below `heldId`; a belt below it counts as proven, so a belt reopened
 * underneath (a curriculum edit, a ruleset flip) never stalls the next promotion.
 */
export function ngWornBelt(cleared, heldId) {
  const held = ngBeltRank(heldId);
  const top = NG_BELT_IDS.length - 1;
  let run = -1;
  for (let i = 0; i <= top; i++) {
    if (i < held || (cleared && cleared[i] === true)) run = i;
    else break;
  }
  const rank = Math.max(0, held, Math.min(top, run + 1));
  return { id: NG_BELT_IDS[rank], rank: rank };
}

/** Stripes on a belt: its proven units scaled to 0–4 (the formula the tab has used since v1.95.3). */
export function ngBeltStripes(done, total) {
  if (!(total > 0)) return 0;
  return Math.max(0, Math.min(4, Math.floor((done / total) * 4)));
}

function ngBeltStamp(t) {
  return typeof t === "number" && Number.isFinite(t) && t > 0 ? t : 0;
}

/**
 * MAX BY RANK — the merge for `belts.held`. A belt the player held on ANY device is held on all of
 * them; an unknown id is no belt (never a guess, never a demotion of the other side). A tie keeps
 * the EARLIER stamp: the moment the belt was first earned. Returns undefined when neither side
 * holds a belt, so the caller can leave the key absent rather than write an empty one.
 */
export function ngMergeHeldBelt(a, b) {
  const ra = a && typeof a === "object" ? ngBeltRank(a.id) : -1;
  const rb = b && typeof b === "object" ? ngBeltRank(b.id) : -1;
  if (ra < 0 && rb < 0) return undefined;
  if (ra !== rb) {
    const w = ra > rb ? a : b;
    return { id: w.id, t: ngBeltStamp(w.t) };
  }
  const ts = [ngBeltStamp(a.t), ngBeltStamp(b.t)].filter((t) => t > 0);
  return { id: a.id, t: ts.length ? Math.min(...ts) : 0 };
}

/**
 * THE ONE-TIME GRANDFATHER MARK (`belts.gf`) SURVIVES A MERGE ONLY WHEN BOTH SIDES CARRY IT. A
 * side without it is progress written by a client that predates the rule (or never ran the
 * grandfather), so the merged state is grandfathered AGAIN — which can only raise `held`, because
 * the grandfather takes a MAX. Keeping one side's mark would silently skip the progress the other
 * side brought: a stale device that boots first must not under-grandfather an account.
 */
export function ngMergeBeltGrandfather(a, b) {
  const ta = ngBeltStamp(a), tb = ngBeltStamp(b);
  return ta > 0 && tb > 0 ? Math.min(ta, tb) : undefined;
}

/**
 * The training-day email's belt line, `dayLog[day].b = [beltId, provenUnits, units]`. A line is
 * AHEAD of another when its belt ranks higher, or the same belt with more units proven — the
 * later of two snapshots of one day, since the worn belt never falls. A malformed line is never
 * ahead (the dayLog merge keeps what it has, the Worker prints no belt line).
 */
export function ngBeltLine(v) {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const [id, done, total] = v;
  if (ngBeltRank(id) < 0) return null;
  if (!Number.isInteger(done) || !Number.isInteger(total) || total < 1 || total > 50 || done < 0 || done > total) return null;
  return { id: id, rank: ngBeltRank(id), done: done, total: total };
}
export function ngBeltLineAhead(a, b) {
  const x = ngBeltLine(a);
  if (!x) return false;
  const y = ngBeltLine(b);
  return !y || x.rank > y.rank || (x.rank === y.rank && x.done > y.done);
}
