// WHAT THE EMAIL SAYS — checked against the awkward days, not the easy one.
//
// `tests/digest_suppress_sync.test.mjs` covers WHO gets mailed. This file covers WHAT they
// read. The two are separate because the failure modes are: that one is about Supabase state,
// this one is about copy that is only ever seen by someone who is not in the room.
//
// The rule here, and the reason there are no golden strings: assert INVARIANTS, not bytes. A
// snapshot of the whole email goes red on every wording tweak, so it gets re-baselined without
// being read, and then it is worth nothing (§6.3 — an assertion stricter than its own claim
// goes red on a correct build). What is pinned instead is what must be TRUE of every email:
// the unsubscribe link is in both bodies, the counts agree with the data, markup cannot be
// broken by a technique name, and each block appears exactly when its data exists.
//
// Every case comes from workers/digest/fixtures.js, which is also what `/dev/email/` renders —
// so a case you can look at in a browser is a case this file is already checking.
//
// Run: node --test tests/digest_render.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURES, byId } from "../workers/digest/fixtures.js";
import { renderHtml, renderText, renderSubject, esc, beltEta, prettyKey } from "../workers/digest/render.js";

/** Text content with tags removed — for asserting what a READER sees, not what the markup is. */
const visible = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

// ── every fixture, every time ────────────────────────────────────────────────────────────

test("every email carries a working unsubscribe in BOTH bodies", () => {
  for (const f of FIXTURES) {
    const { digest: d } = f;
    assert.ok(renderText(d).includes(d.unsubUrl), f.id + ": plaintext lost the unsubscribe");
    // RAW, not escaped — and that asymmetry with the clip href (which IS escaped) is
    // deliberate. `&amp;` in an href is the strictly correct HTML and every compliant parser
    // decodes it, but this link is legally load-bearing and I cannot test it across email
    // clients; a naive client that does not decode would send `amp;t=` to the HMAC check and
    // the unsubscribe would answer "invalid link". A bare `&` is what every client already
    // handles. If this is ever escaped, that decision needs an email-client test behind it.
    assert.ok(renderHtml(d).includes(d.unsubUrl), f.id + ": html lost the unsubscribe");
  }
});

test("no email leaks an unrendered template hole", () => {
  for (const f of FIXTURES) {
    const html = renderHtml(f.digest);
    assert.ok(!html.includes("${"), f.id + ": an unclosed template expression reached the page");
    assert.ok(!/undefined|\[object Object\]|NaN/.test(visible(html)),
      f.id + ": a missing field rendered as a placeholder word");
    assert.ok(!/undefined|\[object Object\]|NaN/.test(renderText(f.digest)),
      f.id + ": same, in plaintext");
  }
});

test("the headline counts are the data's counts, and read as English", () => {
  for (const f of FIXTURES) {
    const { digest: d } = f;
    const seen = visible(renderHtml(d));
    const cards = d.count === 1 ? "1 card ·" : d.count + " cards ·";
    const techs = d.techniques.length === 1 ? "1 technique" : d.techniques.length + " techniques";
    assert.ok(seen.includes(cards), f.id + ": headline card count/plural wrong — " + seen.slice(0, 90));
    assert.ok(seen.includes(techs), f.id + ": headline technique count/plural wrong");
  }
});

test("the subject line is the module's, not a second copy in the Worker", () => {
  // renderSubject exists BECAUSE the Worker used to compose this inline; if it drifts from the
  // body's own numbers the reader gets one count in the inbox and another in the mail.
  for (const f of FIXTURES) {
    const s = renderSubject(f.digest);
    assert.ok(s.includes(String(f.digest.score)), f.id + ": subject lost the score");
    assert.ok(s.includes(String(f.digest.techniques.length)), f.id + ": subject lost the count");
    assert.equal(/technique(?!s)/.test(s), f.digest.techniques.length === 1,
      f.id + ": subject plural disagrees with the count");
  }
});

// ── blocks appear exactly when their data does ───────────────────────────────────────────

test("the weak-spots block is present only when there is a weak spot", () => {
  for (const f of FIXTURES) {
    const has = f.digest.weakTop.length > 0;
    assert.equal(renderHtml(f.digest).includes("WEAK SPOTS"), has, f.id + ": html weak block");
    assert.equal(renderText(f.digest).includes("Weak spot:"), has, f.id + ": text weak block");
  }
});

test("a video is offered only when a clip was actually found", () => {
  for (const f of FIXTURES) {
    const has = !!f.digest.clip;
    assert.equal(/youtube\.com\/watch/.test(renderHtml(f.digest)), has, f.id + ": html clip");
    assert.equal(/youtube\.com\/watch/.test(renderText(f.digest)), has, f.id + ": text clip");
  }
});

test("the belt ETA makes a promise only when it has a pace to back it", () => {
  for (const f of FIXTURES) {
    const seen = visible(renderHtml(f.digest));
    const e = f.digest.eta;
    if (e && e.days) assert.ok(seen.includes("At this pace"), f.id + ": lost its ETA");
    else if (e) {
      assert.ok(seen.includes("Next stop"), f.id + ": should fall back to the quiet line");
      assert.ok(!seen.includes("At this pace"), f.id + ": promised a date it cannot know");
    } else {
      assert.ok(!seen.includes("At this pace") && !seen.includes("Next stop"),
        f.id + ": there is no next belt — both lines must go");
    }
  }
});

test("the streak line needs a streak worth naming", () => {
  for (const f of FIXTURES) {
    const has = f.digest.streak > 1;
    assert.equal(/training days in a row/.test(visible(renderHtml(f.digest))), has, f.id + ": html streak");
    assert.equal(/training days in a row/.test(renderText(f.digest)), has, f.id + ": text streak");
  }
});

test("today's delta shows only when there is a yesterday to compare with", () => {
  for (const f of FIXTURES) {
    const has = f.digest.delta != null;
    assert.equal(/% today\)/.test(visible(renderHtml(f.digest))), has, f.id + ": html delta");
    assert.equal(/% today\)/.test(renderText(f.digest)), has, f.id + ": text delta");
  }
});

// ── the specific cases worth naming ──────────────────────────────────────────────────────

test("a long list folds at ten and counts the remainder correctly", () => {
  const f = byId("forty-techniques");
  const html = renderHtml(f.digest);
  assert.equal((html.match(/<li>/g) || []).length, 11, "ten items plus one fold row");
  assert.ok(visible(html).includes("…and 30 more"), "the fold must count the REMAINDER, not the total");
  assert.ok(renderText(f.digest).includes("…and 30 more"));

  const small = byId("typical");
  assert.ok(!renderHtml(small.digest).includes("more</li>"), "a short list must not fold");
});

test("a technique name cannot break the markup, in text OR in an attribute", () => {
  const f = byId("hostile-text");
  const html = renderHtml(f.digest);

  // the raw hostile strings must not survive anywhere
  assert.ok(!html.includes("<script>"), "a raw script tag reached the document");
  assert.ok(!html.includes('abc"onerror'), "a quote escaped its href and became an attribute");

  // and the reader still sees the real characters, decoded
  const seen = visible(html);
  assert.ok(seen.includes("&amp;") || seen.includes("Kimura"), "the name should still be readable");

  // every href must be a single quoted value with no stray quote inside it
  for (const m of html.matchAll(/href="([^"]*)"/g)) {
    assert.ok(!m[1].includes(">"), "an href carries markup: " + m[1]);
  }
});

test("the escaper covers the five characters, because it is used in two places", () => {
  assert.equal(esc(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
});

// ── the composition helper the copy depends on ───────────────────────────────────────────

test("beltEta names the NEXT band, and refuses to guess without forward progress", () => {
  assert.equal(beltEta(0.5, [0.01, 0.01]).belt, "purple", "0.5 is past blue, so purple is NEXT");
  assert.equal(beltEta(0.5, []).days, null, "no history is not a pace");
  assert.equal(beltEta(0.5, [-0.02]).days, null, "going backwards must not print an arrival date");
  assert.equal(beltEta(0.95, [0.01]), null, "past black there is no next belt");
  assert.ok(beltEta(0.19, [0.01]).days >= 1, "an ETA is never zero days");
});

test("prettyKey turns a deck key into something a person would say", () => {
  assert.equal(prettyKey("Kimura|Attacker"), "Kimura (attacking)");
  assert.equal(prettyKey("Mount|Top"), "Mount (top)");
  assert.equal(prettyKey("Standing"), "Standing", "a key with no role keeps its bare name");
});

// ── the copy must not promise what the endpoint no longer does ──────────────────────────

test("neither body calls the link a one-click unsubscribe — since v1.164.0 it opens a confirm page", () => {
  // The body link is a GET, and /unsubscribe mutates nothing on GET (only the RFC 8058 POST from
  // the mailbox provider's own button is still one click). "Unsubscribe with one click" above a
  // link that asks for a click is a promise the page then breaks.
  for (const f of FIXTURES) {
    assert.ok(!/with one click/i.test(renderHtml(f.digest)), f.id + ": html still promises one click");
    assert.ok(!/with one click/i.test(renderText(f.digest)), f.id + ": plaintext still promises one click");
  }
});

// ── the fixtures themselves have to stay honest ──────────────────────────────────────────

test("the fixture set still reaches every branch it claims to", () => {
  const has = (fn) => FIXTURES.some((f) => fn(f.digest));
  assert.ok(has((d) => d.weakTop.length === 0), "need a no-weak-spot case");
  assert.ok(has((d) => d.weakTop.length > 1), "need a two-weak-spot case");
  assert.ok(has((d) => !!d.clip), "need a with-clip case");
  assert.ok(has((d) => d.weakTop.length > 0 && !d.clip), "need a weak-spot-without-clip case");
  assert.ok(has((d) => d.eta === null), "need a past-black case");
  assert.ok(has((d) => d.eta && !d.eta.days), "need a no-pace case");
  assert.ok(has((d) => d.delta === null), "need a first-day case");
  assert.ok(has((d) => d.delta < 0), "need a losing-ground case");
  assert.ok(has((d) => d.techniques.length > 10), "need a folding case");
  assert.ok(has((d) => d.count === 1), "need a singular case");
  assert.ok(FIXTURES.length >= 8 && new Set(FIXTURES.map((f) => f.id)).size === FIXTURES.length,
    "fixture ids must be unique");
});
