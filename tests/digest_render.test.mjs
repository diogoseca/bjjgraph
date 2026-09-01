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
import { FIXTURES, byId, hostileStrings } from "../workers/digest/fixtures.js";
import { renderHtml, renderText, renderSubject, renderPreheader, esc, hdr, plain, SUBJECT_MAX, beltEta, prettyKey } from "../workers/digest/render.js";

/**
 * Text content with tags removed — for asserting what a READER sees, not what the markup is.
 * The preheader is cut out FIRST: it is display:none in every client, so it is not something a
 * reader sees, and leaving it in would let its copy satisfy an assertion about the body (the
 * delta test would pass on a build that deleted the visible delta, because the preheader still
 * carried "% today)"). `preheaderOf` is the one place that knows the marker.
 */
const PREHEADER_RE = /<div[^>]*\bdata-preheader\b[^>]*>([\s\S]*?)<\/div>/g;
/** Entities back to characters, AFTER the tags are gone — so an escaped `&lt;b&gt;` reads as
 *  the literal text `<b>` a reader would see, and a raw `<b>` was stripped as a tag. That
 *  order is what lets a hostile fixture satisfy "the headline says what the data says"
 *  without the assertion ever mistaking escaped markup for markup (v1.164.2). */
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const visible = (html) =>
  decode(html.replace(PREHEADER_RE, " ").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/** The preheader's own text as a reader would see it — decoded, whitespace-collapsed, minus the
 *  gap-stuffing that follows it. One marker, owned here. */
const preheaderOf = (html) => {
  const all = [...html.matchAll(PREHEADER_RE)];
  return all.length === 1 ? decode(all[0][1].replace(/(?:&zwnj;|&nbsp;|\s)+$/, "")).replace(/\s+/g, " ").trim() : null;
};

/** The fixtures whose numeric fields are numbers — the ones a claim ABOUT NUMBERS can read. The
 *  hostile-numbers case has strings there on purpose, and its own tests below say what must
 *  hold for those; a numeric claim asserted on a string would be asserting on a coincidence. */
const numeric = (d) => ["count", "score"].every((k) => typeof d[k] === "number") && (d.delta == null || typeof d.delta === "number");

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
    if (numeric(f.digest)) assert.ok(s.includes(String(f.digest.score)), f.id + ": subject lost the score");
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

// ── how the markup survives real clients (v1.164.1) ─────────────────────────────────────
//
// Mutants: 44 run against render.js, 43 killed. The one survivor is EQUIVALENT and recorded so
// nobody reads it as coverage: "delta span dropped, colour inherited from the body" — that is
// still one neutral colour, which is the whole claim, and the delta test accepts it on purpose
// (an assertion that demanded the span would go red on that correct build — §6.3).
//
// These pin SHAPE, not copy: nothing below reads a sentence that was not already in the
// email. The four claims, each with the client that punished the old markup:
//   preheader — Gmail and Apple Mail scrape the first body line as preview text, which was
//               "TODAY AT BJJGRAPH …", an echo of the subject sitting right beside it;
//   the button — padding on a bare <a> is ignored by Outlook's Word engine, so the CTA
//               rendered there as an underlined link on white;
//   the rule  — a bare <hr> is a 3D bevel in Outlook desktop;
//   the delta — the green/red pair inverts into mud under dark-mode recolouring and is one of
//               the pairs ~1 in 12 men cannot separate. The sign already carries the meaning.

test("a preheader opens the body, is hidden from the reader, and repeats a line the email already says", () => {
  for (const f of FIXTURES) {
    const { digest: d } = f;
    const html = renderHtml(d);
    const marks = (html.match(/data-preheader/g) || []).length;
    assert.equal(marks, 1, f.id + ": exactly one preheader marker (§6.7 — own the selector)");

    // FIRST in the body — what the client scrapes is whatever comes first, so a preheader that
    // sits after the headline is a preheader the client never reads.
    assert.ok(/<body[^>]*>\s*<div[^>]*data-preheader/.test(html),
      f.id + ": the preheader must be the first element inside <body>");
    assert.ok(html.indexOf("data-preheader") < html.indexOf("TODAY AT BJJGRAPH"),
      f.id + ": the preheader must precede the visible headline");

    // hidden every way a client can be hidden from — Outlook Word engine ignores display:none
    // (hence mso-hide), some clients ignore max-height (hence the zeros).
    const style = (html.match(/<div[^>]*data-preheader[^>]*>/) || [""])[0];
    for (const rule of ["display:none", "max-height:0", "overflow:hidden", "mso-hide:all", "opacity:0"]) {
      assert.ok(style.includes(rule), f.id + ": preheader style lost " + rule);
    }
    assert.ok(/font-size:(0|1px)/.test(style) && /line-height:(0|1px)/.test(style),
      f.id + ": preheader must be sized to nothing");

    // gap-stuffed — without the run of blanks a client backfills its preview pane from the
    // visible body, which lands "TODAY AT BJJGRAPH" back in the preview. 70 pairs is 140
    // characters, the longest preview pane in common use (Apple Mail on iPad).
    const inner = (html.match(/data-preheader[^>]*>([\s\S]*?)<\/div>/) || [, ""])[1];
    const pairs = (inner.match(/&zwnj;&nbsp;/g) || []).length;
    assert.ok(pairs >= 70, f.id + ": preheader gap-stuffing is too short to block backfill (" + pairs + " pairs)");

    // derived, not invented — the preheader's words must already be words the reader sees.
    const pre = preheaderOf(html);
    assert.ok(pre && pre.length > 0, f.id + ": preheader is empty");
    assert.ok(visible(html).includes(pre),
      f.id + ": the preheader says something the body does not — \"" + pre + "\"");
    assert.notEqual(pre, renderSubject(d), f.id + ": the preheader must not echo the subject");
    assert.ok(!pre.includes("TODAY AT BJJGRAPH"), f.id + ": the preheader is the headline again");

    // the choice: the weak spot when there is one (the thing the subject does NOT say),
    // otherwise the Game Knowledge line.
    if (d.weakTop.length) {
      assert.ok(pre.includes(prettyKey(d.weakTop[0])), f.id + ": the preheader should name the weak spot");
    } else {
      // the WHOLE line as the reader sees it — the delta is the one part of it the subject does
      // not already say, so a preheader that trims it is a preheader that echoes the subject.
      const line = visible((html.replace(PREHEADER_RE, "").match(/<p[^>]*>Game Knowledge:[\s\S]*?<\/p>/) || [""])[0]);
      assert.equal(pre, line, f.id + ": with no weak spot, the preheader is the Game Knowledge line, whole");
    }
    assert.ok(!/undefined|NaN|\[object/.test(pre), f.id + ": preheader carries a placeholder word");
  }
});

test("the CTA is a table button — background and padding on the td, the anchor a block inside it", () => {
  const TEXT = "Keep it — do your maintenance";
  for (const f of FIXTURES) {
    const html = renderHtml(f.digest);
    // the anchor: same href, same text, and the look it always had — this is what the other
    // agent's CTA work must be able to change on purpose, so it is pinned by value, not by shape.
    const a = (html.match(/<a href="([^"]*)"([^>]*)>([^<]*)<\/a>/g) || [])
      .map((m) => m.match(/<a href="([^"]*)"([^>]*)>([^<]*)<\/a>/))
      .find((m) => m[3] === TEXT);
    assert.ok(a, f.id + ": the CTA anchor with its exact text is gone");
    assert.equal(a[1], "https://bjjgraph.org", f.id + ": the CTA href changed");
    for (const rule of ["display:block", "color:#fff", "font-weight:700", "font-size:14px", "text-decoration:none"]) {
      assert.ok(a[2].includes(rule), f.id + ": the CTA anchor lost " + rule);
    }
    assert.ok(!/padding/.test(a[2]), f.id + ": padding on the anchor is the Outlook bug this replaces");

    // the cell: the anchor's nearest enclosing td carries the colour as an ATTRIBUTE (the only
    // form Outlook honours) and the padding that gives the button its box.
    const at = html.indexOf(a[0]);
    const before = html.slice(0, at);
    const tdOpen = before.slice(before.lastIndexOf("<td"));
    assert.ok(tdOpen.startsWith("<td") && !tdOpen.includes("</td>"), f.id + ": the CTA anchor is not inside a td");
    assert.ok(/bgcolor="#4a6cff"/.test(tdOpen), f.id + ": the button td needs bgcolor=\"#4a6cff\"");
    assert.ok(/style="[^"]*padding:\s*\d+px[^"]*"/.test(tdOpen), f.id + ": the button td needs padding in its style");
    assert.ok(/style="[^"]*background:#4a6cff/.test(tdOpen), f.id + ": the button td needs the background in style too (bgcolor is Outlook's, style is everyone else's)");

    // the table: presentational, so a screen reader does not announce a one-cell grid.
    const tableOpen = before.slice(before.lastIndexOf("<table"));
    assert.ok(tableOpen.startsWith("<table") && !tableOpen.includes("</table>"), f.id + ": the CTA td is not inside a table");
    assert.ok(/role="presentation"/.test(tableOpen), f.id + ": the button table must be role=presentation");
  }
});

test("no <hr> anywhere — the weak-spot rule is a td with a border-top, present exactly when the block is", () => {
  for (const f of FIXTURES) {
    const html = renderHtml(f.digest);
    assert.ok(!/<hr[\s>\/]/i.test(html), f.id + ": a bare <hr> is a bevel in Outlook desktop");
    const rules = (html.match(/<td[^>]*style="[^"]*border-top:\s*1px solid[^"]*"[^>]*>/g) || []).length;
    const has = f.digest.weakTop.length > 0;
    assert.equal(rules, has ? 1 : 0,
      f.id + ": expected " + (has ? "one" : "no") + " border-top rule td, found " + rules);
  }
});

test("the delta is one neutral colour — no green, no red, and the same colour whichever way it points", () => {
  const seen = new Set();
  for (const f of FIXTURES) {
    const html = renderHtml(f.digest);
    assert.ok(!/#188a4c/i.test(html), f.id + ": the green is back");
    assert.ok(!/#b3403a/i.test(html), f.id + ": the red is back");
    // the delta with whatever wraps it — a span with a colour, a span without one, or nothing
    // at all (inheriting the body's ink is also one neutral colour, and must not read as red) —
    // read from the BODY, because the preheader repeats this line, unwrapped, on the days with
    // no weak spot.
    // `[^()]*?` rather than `[\d.]+`: the hostile fixture's delta is not digits, and the
    // colour claim holds for it too — what it renders is escaped text inside the same span.
    const m = html.replace(PREHEADER_RE, "").match(/(?:<span style="([^"]*)">\s*)?\(([+-]?)[^()]*?% today\)/);
    assert.equal(!!m, f.digest.delta != null, f.id + ": delta presence disagrees with the data");
    if (!m) continue;
    const col = ((m[1] || "").match(/color:\s*(#[0-9a-f]{3,6})/i) || [, "inherit"])[1];
    seen.add(col.toLowerCase());
    if (!numeric(f.digest)) continue;   // the sign of a non-number is not a claim
    // the sign is the meaning, and it must survive
    assert.equal(m[2], f.digest.delta >= 0 ? "+" : "-", f.id + ": the delta lost its sign");
    assert.ok(renderText(f.digest).includes("(" + (f.digest.delta >= 0 ? "+" : "") + f.digest.delta + "% today)"),
      f.id + ": plaintext delta drifted");
  }
  assert.equal(seen.size, 1, "the delta must be ONE colour across positive, zero and negative days — saw " + [...seen].join(", "));
  const pos = FIXTURES.some((f) => f.digest.delta > 0), neg = FIXTURES.some((f) => f.digest.delta < 0);
  assert.ok(pos && neg, "the fixture set must carry both signs for this to mean anything");
});

// ── every field is a sink, whatever its type (v1.164.2) ─────────────────────────────────
//
// THE FINDING: the blob is owner-written under an RLS policy that checks no shape, and the
// fields nobody escaped were the ones "known" to be numbers. `renderHtml({count: '<a href=…>'})`
// put an anchor in the <h1>; `score: 'x</b><img …>'` put the img beside it; and
// `renderSubject({score: '0%\r\nBcc: x@y'})` returned a CR LF inside a header line — which is
// the end of the Subject and the start of whatever the attacker wrote next. `hostile-numbers`
// is that digest; these are the three rules, each asserted DIFFERENTIALLY against a control
// digest of the same shape with real numbers (§6.3: what the template draws anyway cancels).
//
// Mutants (v1.164.2): 29 run against render.js, 26 killed, each named beside the test that
// kills it. THREE NON-KILLS, recorded so nobody reads them as covered: dropping `esc` (html)
// or `plain` (text) on `d.streak` survives — the template's own `d.streak > 1` guard is false
// for every string carrying a `<`, `>`, `&`, quote or control character (they all coerce to
// NaN), so no hostile value can reach that interpolation while the guard stands; and dropping
// `esc` on the `…and N more` fold count survives — it is `techniques.length - 10`, an
// arithmetic result, which no value can make anything but a number. All three keep their
// escaper regardless: the guard and the arithmetic are one refactor from gone.

/** The hostile digest with real numbers in the hostile slots — same branches, same markup. */
const controlFor = (d) => ({ ...d, count: 24, score: 33.3, delta: 0, eta: { belt: "blue", days: 15 } });
/** Every element name the document opens or closes, in order — the template's skeleton. */
const tagCensus = (html) => (html.match(/<\/?[a-zA-Z][a-zA-Z0-9]*/g) || []).map((t) => t.toLowerCase());

test("a hostile value in a numeric slot adds no element to the HTML, and the reader sees it as literal text", () => {
  const f = byId("hostile-numbers");
  const html = renderHtml(f.digest);
  const control = renderHtml(controlFor(f.digest));
  // kills: drop `esc` on count / score / delta / eta.belt / eta.days in renderHtml
  assert.deepEqual(tagCensus(html), tagCensus(control),
    "the hostile digest draws a different set of elements than its control — a value became markup");
  // the markup-carrying strings; the CR LF one is whitespace to an HTML parser and is the
  // subject's and the plaintext's problem, asserted below
  for (const hs of hostileStrings(f.digest).filter((x) => /[<>"']/.test(x))) {
    assert.ok(!html.includes(hs), "a hostile value reached the HTML verbatim: " + JSON.stringify(hs));
  }
  assert.ok(!/<a href="https:\/\/evil/.test(html) && !/<img/.test(html) && !/<u>/.test(html), "attacker markup rendered as elements");
  // the "Next stop" branch (no pace) interpolates the belt a second time — kills: drop `esc` there
  const stalled = { ...f.digest, eta: { belt: "blue<u>", days: null } };
  assert.deepEqual(tagCensus(renderHtml(stalled)), tagCensus(renderHtml({ ...stalled, ...controlFor(f.digest), eta: { belt: "blue", days: null } })),
    "the Next stop line rendered the belt as markup");
  // the delta with markup in it — the fixture's delta is the CR LF payload, which an HTML
  // parser reads as whitespace, so this branch needs its own probe — kills: drop `esc` on delta
  assert.deepEqual(tagCensus(renderHtml({ ...f.digest, delta: "<u>1</u>" })), tagCensus(renderHtml(controlFor(f.digest))),
    "the delta rendered as markup");
  // a duck-typed `techniques` whose length is the payload — kills: drop `esc` on techniques.length
  const duck = (len) => ({ ...f.digest, techniques: { length: len, slice: () => [] } });
  assert.deepEqual(tagCensus(renderHtml(duck("<u>2</u>"))), tagCensus(renderHtml(duck(2))), "the technique count rendered as markup");
  // escaped, not dropped: what the reader sees is the literal string, brackets and all
  const seen = visible(html);
  assert.ok(seen.includes(String(f.digest.count) + " cards"), "the count was not rendered as literal text");
  assert.ok(seen.includes("Game Knowledge: " + f.digest.score + "%"), "the score was not rendered as literal text");
});

test("the preheader fallback escapes too — it is the one copy of the score line the weak-spot branch never shows", () => {
  const f = byId("hostile-numbers");
  assert.equal(f.digest.weakTop.length, 0, "this fixture must take the fallback branch for the claim to mean anything");
  const pre = renderPreheader(f.digest);
  // kills: drop `esc` on score / delta in renderPreheader
  for (const hs of hostileStrings(f.digest).filter((x) => /[<>"']/.test(x))) assert.ok(!pre.includes(hs), "the preheader carries a hostile value verbatim");
  assert.ok(!/<[a-z]/i.test(pre), "the preheader opened an element: " + pre);
});

test("the subject carries no control character from any field it reads, and is capped", () => {
  const f = byId("hostile-numbers");
  const CTRL = /[\x00-\x1f\x7f]/;
  assert.ok(!CTRL.test(renderSubject(f.digest)), "a control character reached the subject from the fixture");
  // every input renderSubject concatenates, fed the CR LF payload in turn (the fixture carries
  // it in `delta`, which the subject does not read — this is what makes the claim total).
  // kills: drop `hdr` on score; drop `hdr` on techniques.length (the third probe is a
  // duck-typed `techniques` whose `length` is the payload — not a digest shape runDigest can
  // build, but exactly the "regardless of expected type" the rule is about)
  const crlf = f.digest.delta;
  assert.ok(/\r\n/.test(crlf), "the fixture must carry a CR LF for this to test anything");
  const probes = [
    { ...f.digest, score: crlf },
    { ...f.digest, score: "0%\r\nBcc: x@y\tX\x00Y\x7f" },
    { ...f.digest, techniques: { length: crlf } },
  ];
  for (const d of probes) {
    const s = renderSubject(d);
    assert.ok(!CTRL.test(s), "control character in the subject: " + JSON.stringify(s));
    assert.ok(s.startsWith("Today at BJJGraph: "), "the subject lost its opening");
  }
  // kills: drop the SUBJECT_MAX slice
  const long = renderSubject({ ...f.digest, score: "9".repeat(5000) });
  assert.ok(long.length <= SUBJECT_MAX, "a 5,000-character score produced a " + long.length + "-character subject");
  assert.ok(SUBJECT_MAX >= 60 && SUBJECT_MAX <= 998, "the cap must fit a real subject and an RFC 5322 line");
});

test("the plaintext body carries no CR, and no value can add a line to it", () => {
  const f = byId("hostile-numbers");
  const text = renderText(f.digest);
  // kills: drop `plain` on delta (the fixture's CR LF lives there)
  assert.ok(!/\r/.test(text), "a CR reached the plaintext body");
  // differential: same skeleton as the control, so a value cannot smuggle a line — kills: drop
  // `plain` on any renderText value that the fixture makes hostile
  const lines = (t) => t.split("\n").length;
  assert.equal(lines(text), lines(renderText(controlFor(f.digest))),
    "the hostile body has a different number of lines than its control — a value carried a line break");
  // and the other fields, fed the CR LF in turn (count, score, eta.belt, eta.days, a technique,
  // a weak spot, the unsubscribe URL) — kills: drop `plain` on any one of them
  const crlf = f.digest.delta;
  const probes = [
    { ...f.digest, count: crlf }, { ...f.digest, score: crlf },
    { ...f.digest, eta: { belt: crlf, days: crlf } },
    { ...f.digest, techniques: [crlf + "|Top"] },
    { ...f.digest, weakTop: [crlf + "|Top", crlf + "|Bottom"], clip: { id: crlf, who: crlf, title: "t", dur: null } },
    { ...f.digest, streak: 5, unsubUrl: f.digest.unsubUrl + crlf },
    { ...f.digest, techniques: { length: crlf, slice: () => [] } },
  ];
  for (const d of probes) {
    assert.ok(!/\r/.test(renderText(d)), "a CR reached the plaintext body through " + JSON.stringify(Object.keys(d).filter((k) => JSON.stringify(d[k]).includes("\\r"))));
  }
});

test("hdr and plain remove every C0 control and DEL, and nothing else", () => {
  const all = Array.from({ length: 33 }, (_, i) => String.fromCharCode(i === 32 ? 127 : i)).join("");
  assert.equal(hdr("a" + all + "b"), "ab");
  assert.equal(plain("a" + all + "b"), "ab");
  assert.equal(hdr("Mount (top) · 41.5% — ünïcödé"), "Mount (top) · 41.5% — ünïcödé", "printable text must pass through untouched");
  assert.equal(hdr(41.5), "41.5", "a number is stringified, not refused");
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
  assert.ok(has((d) => !numeric(d)), "need a case whose numeric fields are not numbers");
  assert.ok(FIXTURES.length >= 9 && new Set(FIXTURES.map((f) => f.id)).size === FIXTURES.length,
    "fixture ids must be unique");
});
