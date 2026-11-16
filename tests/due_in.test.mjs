// "DUE IN", the owner's rule (v1.281.0, LIN1): days up to 30, weeks over 30, months over 60, years over 365, with plural
// forms. The function is pure and called by nothing yet; these are its boundaries.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ngDueIn } from "../neural/src/due-in.src.js";

const text = (d) => ngDueIn(d).text;

test("days up to 30, then weeks; the boundaries 30 and 31", () => {
  assert.equal(text(1), "1 day");
  assert.equal(text(2), "2 days");
  assert.equal(text(30), "30 days");
  assert.equal(text(31), "4 weeks");
  assert.deepEqual(ngDueIn(31), { n: 4, unit: "week", text: "4 weeks" });
});

test("weeks up to 60, then months; the boundaries 60 and 61", () => {
  assert.equal(text(35), "5 weeks");
  assert.equal(text(60), "9 weeks");
  assert.equal(text(61), "2 months");
  assert.deepEqual(ngDueIn(61), { n: 2, unit: "month", text: "2 months" });
});

test("months up to 365, then years; the boundaries 365 and 366", () => {
  assert.equal(text(182), "6 months");
  assert.equal(text(365), "12 months");
  assert.equal(text(366), "1 year");
  assert.deepEqual(ngDueIn(366), { n: 1, unit: "year", text: "1 year" });
  assert.equal(text(730), "2 years");
  assert.equal(text(2922), "8 years");
});

test("the singular is used exactly when the number is 1", () => {
  for (let d = 0; d <= 3000; d++) {
    const r = ngDueIn(d);
    assert.equal(r.text, r.n + " " + r.unit + (r.n === 1 ? "" : "s"), String(d));
    assert.ok(["day", "week", "month", "year"].includes(r.unit), String(d));
  }
  assert.equal(text(1), "1 day");
  assert.equal(text(366), "1 year");
});

test("every day reads in the unit its band names, and a longer wait never reads as a shorter one", () => {
  const days = { day: 1, week: 7, month: 365.25 / 12, year: 365.25 };
  let prev = null;
  for (let d = 0; d <= 3000; d++) {
    const r = ngDueIn(d), want = d > 365 ? "year" : d > 60 ? "month" : d > 30 ? "week" : "day";
    assert.equal(r.unit, want, String(d));
    assert.ok(Math.abs(r.n * days[r.unit] - d) <= days[r.unit] / 2 + 1e-9, `${d}: ${r.text} is the nearest`);
    if (prev && prev.unit === r.unit) assert.ok(r.n >= prev.n, `${d}: ${r.text} after ${prev.text}`);
    prev = r;
  }
});

test("due now or overdue reads 0 days; a fraction is the next whole day; not a number is null", () => {
  assert.deepEqual(ngDueIn(0), { n: 0, unit: "day", text: "0 days" });
  assert.equal(text(-5), "0 days");
  assert.equal(text(0.2), "1 day");
  assert.equal(text(30.5), "4 weeks");
  for (const bad of [NaN, Infinity, -Infinity, "3", null, undefined, {}]) assert.equal(ngDueIn(bad), null, String(bad));
});

test("the function is pure: no clock, no randomness, no storage", () => {
  const src = readFileSync(new URL("../neural/src/due-in.src.js", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
  for (const word of ["Date", "Math.random", "localStorage", "window", "document"]) assert.ok(!src.includes(word), word);
});
