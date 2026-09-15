/**
 * THE DIGEST EMAIL, AS PURE FUNCTIONS (v1.159.0).
 *
 * Everything here takes a digest object and returns a string. No env, no fetch, no secrets,
 * no Workers globals — which is the whole point: the Worker imports it to send, `node --test`
 * imports it to check it, and `/dev/email/` imports it IN A BROWSER to show you the real
 * email before anyone receives one. One implementation, three readers. The alternative was a
 * preview that re-implements the email, which is the §6.3 trap: it would agree with itself
 * and diverge from what actually sends.
 *
 * Composition helpers (`beltEta`, `streakOf`) live here too. They are pure, they are what the
 * numbers in the copy MEAN, and a fixture cannot exercise the copy honestly without them.
 *
 * The digest object, as `runDigest` builds it:
 *   { count, techniques: string[], score, delta, eta, streak, weakTop: string[], clip, unsubUrl }
 * Technique and weak-spot entries are deck keys — "Mount|Top", "Kimura|Attacker".
 *
 * EVERY FIELD IS A SINK, WHATEVER ITS EXPECTED TYPE (v1.164.2). The digest is composed from a
 * blob the OWNER of the row writes, with the public key every browser ships, under an
 * owner-writable RLS policy that checks no shape. Until v1.164.2 `count`, `score`, `delta`,
 * `eta`, `streak` and the fold count were interpolated raw because "they are numbers" — and
 * `renderHtml({count: '<a href=…>'})` put the anchor in the <h1>, `score: 'x</b><img …>'`
 * put the img beside it, and `renderSubject({score: '0%\r\nBcc: x@y'})` returned a CR LF
 * inside a header line. `runDigest` now coerces and clamps before anything reaches here,
 * and this module STILL escapes every interpolation: two layers, so a new caller (the
 * preview, a test, tomorrow's second Worker) cannot re-open the sink by skipping the first.
 * The three rules, each pinned by tests/digest_render.test.mjs on the `hostile-numbers`
 * fixture: (1) `esc()` on every value in `renderHtml` and `renderPreheader`; (2) `hdr()` on
 * every value in `renderSubject` — no control characters, capped length — because a subject
 * is a HEADER and CR LF there ends it; (3) `plain()` on every value in `renderText`, so no
 * value can carry a CR into the body (a bare CR is what a lenient MIME parser reads as a
 * line ending). The one deliberate exception is `unsubUrl` in its href — RAW, since v1.159.0,
 * for a reason a test explains — and the Worker pins its only variable part to a UUID.
 */

export const SITE = "https://bjjgraph.org";

// The knowledge-band thresholds — MUST match BELT_SCORE in neural/src/app.src.jsx.
export const BELTS = [
  ["white", 0.2],
  ["blue", 0.4],
  ["purple", 0.6],
  ["brown", 0.7],
  ["black", 0.8],
];

/**
 * ATTRIBUTE-SAFE, not just text-safe. This escaped only `<>&` while its output goes into
 * `href="…"` (the clip link) as well as into text, so a value carrying a double quote could
 * close the attribute. Clip ids and titles come from YouTube metadata via the clips pipeline,
 * so nothing hostile has ever reached it — but an escaper that is unsafe in one of the two
 * places it is used is a trap sitting and waiting, and the fix is four characters.
 */
export const esc = (t) =>
  String(t).replace(/[<>&"']/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;",
  }[c]));

/**
 * HEADER-SAFE (v1.164.2). A subject is one line of a MIME header block: a CR LF inside it
 * ends the Subject and starts whatever follows — `Bcc:`, a second `To:`, anything. Every C0
 * control (0x00–0x1f, so CR, LF and TAB) and DEL is removed, not replaced, so no value can
 * fold or terminate the line. Used on every piece `renderSubject` concatenates, numbers
 * included — the type a value is EXPECTED to be is not a property this function can see.
 */
export const hdr = (t) => String(t).replace(/[\x00-\x1f\x7f]/g, "");

/**
 * BODY-SAFE for plaintext (v1.164.2). The plaintext body's line structure belongs to the
 * template, not to a value: a value carrying LF would add lines ("Unsubscribe: <theirs>"),
 * and a value carrying CR is what a lenient parser treats as a line ending. Same character
 * class as `hdr`; a separate name because the two rules will be read from different places.
 */
export const plain = (t) => String(t).replace(/[\x00-\x1f\x7f]/g, "");

/** The most a subject may be. RFC 5322 caps a header line at 998 octets; 200 characters is
 *  five times the longest subject this template can produce from clamped numbers. */
export const SUBJECT_MAX = 200;

/** "Kimura|Attacker" -> "Kimura (attacking)"; "Mount|Top" -> "Mount (top)" */
export const prettyKey = (k) => {
  const [fam, role] = String(k).split("|");
  const r = (role || "").toLowerCase();
  return fam + (r === "attacker" ? " (attacking)" : r ? " (" + r + ")" : "");
};

export const beltEta = (score01, dailyDeltas) => {
  const next = BELTS.find(([, t]) => t > score01);
  if (!next) return null;
  const pace = dailyDeltas.length
    ? dailyDeltas.reduce((a, b) => a + b, 0) / dailyDeltas.length
    : 0;
  if (pace <= 0) return { belt: next[0], days: null };
  return { belt: next[0], days: Math.max(1, Math.round((next[1] - score01) / pace)) };
};

export const streakOf = (days, endDay) => {
  if (!days) return 0;
  let n = 0;
  const d = new Date(endDay + "T00:00:00Z");
  for (;;) {
    const k = d.toISOString().slice(0, 10);
    if (!days[k]) break;
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
};

export function renderText(d) {
  const p = plain;
  const eta = d.eta && d.eta.days ? "At this pace: " + p(String(d.eta.belt).toUpperCase()) + " BELT in ~" + p(d.eta.days) + " days\n" : "";
  const weak = d.weakTop.length
    ? "\nWeak spot: " + p(prettyKey(d.weakTop[0])) +
      (d.clip ? "\n  A great video from " + p(d.clip.who || "a top instructor") + ": https://www.youtube.com/watch?v=" + p(d.clip.id) : "") +
      (d.weakTop[1] ? "\n  And one for the road: " + p(prettyKey(d.weakTop[1])) : "") + "\n"
    : "";
  return "TODAY AT BJJGRAPH\n" +
    p(d.count) + " cards · " + p(d.techniques.length) + " techniques\n" +
    "Game Knowledge: " + p(d.score) + "%" + (d.delta != null ? " (" + (d.delta >= 0 ? "+" : "") + p(d.delta) + "% today)" : "") + "\n" +
    eta + (d.streak > 1 ? p(d.streak) + " training days in a row\n" : "") +
    "\nWhat you reviewed:\n" + d.techniques.slice(0, 10).map((t) => "  · " + p(prettyKey(t))).join("\n") +
    (d.techniques.length > 10 ? "\n  · …and " + p(d.techniques.length - 10) + " more" : "") +
    weak + "\n" + SITE + "\n\nUnsubscribe (one click to confirm): " + p(d.unsubUrl) + "\n";
}

/**
 * THE PREVIEW LINE, TAKEN FROM THE EMAIL ITSELF (v1.164.1).
 *
 * Gmail and Apple Mail show a snippet beside the subject, and with nothing set they scrape
 * the first body line — "TODAY AT BJJGRAPH 24 cards · 6 techniques", which is the subject
 * again. This picks the one line the SUBJECT does not already say: the weak-spot sentence
 * when there is one, otherwise the Game Knowledge line. Both are strings the body renders
 * verbatim; nothing here is new prose, and the test pins that by requiring the preheader to
 * be a substring of the visible body. It is rendered into a div that every client hides
 * (`display:none` for most, `mso-hide:all` for Outlook's Word engine, the zeros for the
 * clients that ignore one of those), followed by a run of zwnj/nbsp pairs so a client cannot
 * backfill its preview pane from the body after the text runs out.
 */
export function renderPreheader(d) {
  if (d.weakTop.length) return esc(prettyKey(d.weakTop[0])) + " is your softest spot right now.";
  return "Game Knowledge: " + esc(d.score) + "%" +
    (d.delta != null ? " (" + (d.delta >= 0 ? "+" : "") + esc(d.delta) + "% today)" : "");
}

/** 100 pairs = 200 blank characters; the longest preview pane in common use is ~140. */
const PREHEADER_GAP = "&zwnj;&nbsp;".repeat(100);

export function renderHtml(d) {
  const li = d.techniques.slice(0, 10).map((t) => "<li>" + esc(prettyKey(t)) + "</li>").join("");
  const more = d.techniques.length > 10 ? "<li>…and " + esc(d.techniques.length - 10) + " more</li>" : "";
  const eta = d.eta && d.eta.days
    ? `<p style="margin:14px 0 0;font-size:15px;"><b>At this pace: ${esc(String(d.eta.belt).toUpperCase())} BELT in ~${esc(d.eta.days)} days</b></p>`
    : d.eta
      ? `<p style="margin:14px 0 0;font-size:14px;">Next stop: <b>${esc(d.eta.belt)} belt</b></p>`
      : "";
  const clipBlock = d.clip
    ? `<p style="margin:6px 0 0;font-size:13px;">Here's a great video from <b>${esc(d.clip.who || "a top instructor")}</b> explaining ${esc(d.weakTop[0] ? prettyKey(d.weakTop[0]) : "it")}${d.clip.dur ? " (" + esc(String(d.clip.dur)) + ")" : ""}: <a href="https://www.youtube.com/watch?v=${esc(d.clip.id)}">${esc(d.clip.title || "watch")}</a></p>`
    : "";
  const extra = d.weakTop[1]
    ? `<p style="margin:10px 0 0;font-size:12px;color:#555;">And one for the road: <b>${esc(prettyKey(d.weakTop[1]))}</b> — worth a look next session.</p>`
    : "";
  // The rule is a td with a border-top, not an <hr>: Outlook desktop draws a bare <hr> as a
  // 3D bevel and ignores its border/margin styles. Every client draws a td border flat.
  const weakBlock = d.weakTop.length
    ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0;"><tr><td style="border-top:1px solid #ddd;font-size:1px;line-height:1px;height:1px;">&nbsp;</td></tr></table>
       <p style="margin:0;font-size:11px;letter-spacing:.1em;color:#888;">WEAK SPOTS</p>
       <p style="margin:6px 0 0;font-size:14px;"><b>${esc(prettyKey(d.weakTop[0]))}</b> is your softest spot right now.</p>
       ${clipBlock}${extra}`
    : "";
  // Layout notes, each one a client that punished the plainer markup (v1.164.1):
  //  · the delta is ONE neutral colour. Green/red inverted into mud under dark-mode recolouring,
  //    ~1 in 12 men cannot tell the pair apart, and the plaintext twin never had it — the sign
  //    is what carries the meaning, and it is kept.
  //  · the CTA is a table button. Padding on a bare <a> is ignored by Outlook's Word engine,
  //    which rendered it as an underlined link on white; the colour goes on the td as a
  //    bgcolor ATTRIBUTE (the form Outlook honours) and again in style for everyone else, the
  //    padding goes on the td, and the anchor is display:block so the whole box is the link.
  //    Text and href are pinned by tests/digest_render.test.mjs — change them on purpose.
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c2130;max-width:520px;margin:0 auto;padding:24px 18px;">
  <div data-preheader="1" style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;opacity:0;color:transparent;">${renderPreheader(d)}${PREHEADER_GAP}</div>
  <p style="font-size:11px;letter-spacing:.14em;color:#888;margin:0;">TODAY AT BJJGRAPH</p>
  <h1 style="font-size:20px;margin:6px 0 14px;">${esc(d.count)} card${d.count === 1 ? "" : "s"} · ${esc(d.techniques.length)} technique${d.techniques.length === 1 ? "" : "s"}</h1>
  <p style="margin:0;font-size:15px;">Game Knowledge: <b>${esc(d.score)}%</b>${d.delta != null ? ` <span style="color:#555;">(${d.delta >= 0 ? "+" : ""}${esc(d.delta)}% today)</span>` : ""}</p>
  ${eta}
  ${d.streak > 1 ? `<p style="margin:10px 0 0;font-size:13px;">🔥 ${esc(d.streak)} training days in a row</p>` : ""}
  <p style="margin:16px 0 6px;font-size:12px;letter-spacing:.08em;color:#888;">WHAT YOU REVIEWED</p>
  <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;">${li}${more}</ul>
  ${weakBlock}
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:22px 0 0;border-collapse:separate;"><tr><td bgcolor="#4a6cff" style="background:#4a6cff;border-radius:9px;padding:10px 18px;"><a href="${SITE}" style="display:block;color:#fff;text-decoration:none;font-weight:700;font-size:14px;">Keep it — do your maintenance</a></td></tr></table>
  <p style="margin:26px 0 0;font-size:11px;color:#999;">You asked for this after active days (Settings → Training-day email · Beta).
  <a href="${d.unsubUrl}" style="color:#999;">Unsubscribe</a> (one click to confirm).</p>
  </body></html>`;
}

/** The subject line, exactly as `runDigest` composes it — the preview would otherwise guess. */
export function renderSubject(d) {
  // `hdr` on EVERY piece, the count included (v1.164.2): the type a field arrives as is the
  // blob owner's choice, not this function's knowledge. Then the cap, applied to the whole.
  return ("Today at BJJGraph: " + hdr(d.techniques.length) + " technique" +
    (d.techniques.length === 1 ? "" : "s") + ", " + hdr(d.score) + "%").slice(0, SUBJECT_MAX);
}
