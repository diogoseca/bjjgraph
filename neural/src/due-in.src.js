// HOW LONG UNTIL A CARD IS DUE, IN WORDS (v1.281.0, LIN1). The owner's rule (15 Nov 2026): "when showing how many days
// until it's due, use days, and only round to weeks when it's more than 30 days, or to months when it's more than 60 days
// or to years when it's more than 365 days".
//   · up to 30 days: days, exact ("1 day", "30 days");
//   · 31 to 60 days: weeks, days ÷ 7 rounded ("4 weeks" at 31, "9 weeks" at 60);
//   · 61 to 365 days: months, days ÷ (365.25 ÷ 12) rounded ("2 months" at 61, "12 months" at 365);
//   · more than 365 days: years, days ÷ 365.25, to ONE decimal under ten years with a trailing .0 dropped ("1 year" at 366,
//     "1.5 years" at 548, "2 years" at 730), whole from ten years on (LIN1-R2: the independent reader found the whole "2
//     years" for 548 days overstated it by a third).
// A schedule's due is a whole day, so `days` is due − today; a fraction counts as the next whole day (the schedule's own
// first whole day at or after). Due now or overdue (0 or less) reads 0 days: what to say about a due card is the caller's.
// Returns {n, unit, text}: `unit` singular ("day", "week", "month", "year"), `text` with the plural form when n is not 1;
// null for a value that is not a finite number. Pure, no clock. Nothing shows a due date yet: the cards view inside Master
// the game will call it (the owner's choice, U193; pinned by tests/due_in.test.mjs, its boundaries 30, 31, 60, 61, 365, 366
// and ten years).
const NG_DUE_IN_UNITS = [
  { over: 365, unit: "year", per: 365.25 },
  { over: 60, unit: "month", per: 365.25 / 12 },
  { over: 30, unit: "week", per: 7 },
];
export function ngDueIn(days) {
  if (typeof days !== "number" || !Number.isFinite(days)) return null;
  const d = Math.max(0, Math.ceil(days));
  let n = d, unit = "day";
  for (const u of NG_DUE_IN_UNITS) if (d > u.over) { const x = d / u.per; n = u.unit === "year" && x < 10 ? Math.round(x * 10) / 10 : Math.round(x); unit = u.unit; break; }
  return { n, unit, text: n + " " + unit + (n === 1 ? "" : "s") };
}
