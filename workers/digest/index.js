/**
 * THE TRAINING-DAY DIGEST WORKER (v1.105.7, owner-approved design 2026-08-16).
 *
 * A scheduled Cloudflare Worker that mails each opted-in player a digest of THEIR OWN DAY at
 * bjjgraph.org — after active days only. The data is the same v2 progress blob everything else
 * uses (the app records a per-day `dayLog` when `settings.emailDigest` is on; nothing here is a
 * second source of truth).
 *
 * PIPELINE, once a day (cron in wrangler.toml):
 *   1. Supabase (service role): rows of user_training_data where the blob opts in.
 *   2. For each: the latest `dayLog` day with techniques that has NOT been mailed (digest_sent
 *      table dedupes; the client writes LOCAL dates, so "today" needs no timezone math here).
 *   3. Suppression check (one-click unsubscribe writes digest_suppress).
 *   4. Compose: techniques · count · Game Knowledge % (+delta) · NEXT-BELT ETA at the recent
 *      pace · streak · the weak-spots MAGAZINE section (top spot with an attributed clip when
 *      the public content chunk carries one; the second as "an extra").
 *   5. Send via Cloudflare Email (the EMAIL binding). If the binding is absent or rejects
 *      arbitrary recipients (Email Sending still rolling out), every send fails LOUDLY with a
 *      clear log line — never silently — and the runbook's fallback question goes to the owner.
 *
 * Secrets (wrangler secret put): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UNSUB_HMAC_SECRET.
 * The service key lives ONLY here (Workers secrets) — never in the repo, never in the client.
 */

import {
  SITE, beltEta, streakOf, renderText, renderHtml, renderSubject,
} from "./render.js";

// THE TWO ADDRESSES THE MAIL CARRIES, and they are deliberately the same mailbox.
//   From:     who it is from, and where a reply goes when a client ignores Reply-To.
//   Reply-To: where a reply goes explicitly. Stated even though it duplicates From, because
//             the moment either changes (a no-reply sender, a different brand address) the
//             replies must keep landing in a human inbox — and a Reply-To that was never
//             there is the kind of omission nobody notices until the replies stop.
// coach@bjjgraph.org is Email Routing -> the owner's personal inbox. Replies are read by a
// person by design; there is no processing worker and must not be one without saying so.
// The binding also accepts { email, name } here if a display name is ever wanted.
const FROM = "coach@bjjgraph.org";
const REPLY_TO = "coach@bjjgraph.org";

// fnv1a32, byte-identical to the app's qhash — content chunks are addressed by it. It stays
// HERE rather than in render.js: it addresses the content chunk the Worker fetches, so it
// belongs with the fetching, not with the pure view.
const fnv1a32 = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
};

async function sb(env, path, init = {}) {
  const r = await fetch(env.SUPABASE_URL + path, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!r.ok) throw new Error("supabase " + path.split("?")[0] + " -> " + r.status);
  // PostgREST answers a plain POST with `Prefer: return=minimal` semantics — 201 and an EMPTY
  // body — so `r.json()` threw "Unexpected end of JSON input" on every successful digest_sent
  // write. The row landed and the mail had already gone, but the throw was caught per-user into
  // `failures`, so `sent` never incremented: a working run reported {sent:0, failures:[...]},
  // which is exactly the reading the runbook's dry-run tells the owner to trust. Parse only
  // when there is something to parse.
  if (r.status === 204) return null;
  const body = await r.text();
  return body ? JSON.parse(body) : null;
}

async function clipFor(deckKey) {
  const tryKeys = [deckKey, String(deckKey).split("|")[0]];
  for (const k of tryKeys) {
    try {
      const r = await fetch(SITE + "/static/neural/content/" + fnv1a32(k) + ".json", {
        cf: { cacheTtl: 86400 },
      });
      if (!r.ok) continue;
      const j = await r.json();
      const entry = j && (j[k] || j[Object.keys(j)[0]]);
      const clips = entry && entry.clips;
      if (Array.isArray(clips) && clips.length) {
        const c = clips[0];
        // the emitted clip shape carries `by` (instructor attribution) and has NO duration
        // field — real keys are by/id/title/vertical ± start/end. `start`/`end` give a length
        // when both exist; anything else and the duration is simply omitted.
        if (c && c.id && (c.by || c.title)) {
          const dur =
            typeof c.start === "number" && typeof c.end === "number" && c.end > c.start
              ? Math.round(c.end - c.start) + "s"
              : null;
          return { id: c.id, title: c.title || "", who: c.by || "", dur: dur };
        }
      }
    } catch (e) {
      /* content chunk miss — the magazine section degrades to text */
    }
  }
  return null;
}

async function hmacToken(env, userId) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.UNSUB_HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// Exported for `tests/digest_suppress_sync.test.mjs`, which drives it against a PostgREST
// double. The Workers runtime only ever reaches it through the two handlers below.
export async function runDigest(env) {
  // 1. opted-in blobs. PostgREST jsonb path filter; the blob column is `neural`.
  const rows = await sb(
    env,
    "/rest/v1/user_training_data?select=user_id,neural&neural->settings->>emailDigest=eq.true",
  );
  if (!rows || !rows.length) return { sent: 0, reason: "nobody opted in" };

  // WHEN they unsubscribed, not just that they did — a suppression is a stop, never a life
  // sentence (the confirmation page promises Settings can turn it back on).
  const suppressed = new Map(
    ((await sb(env, "/rest/v1/digest_suppress?select=user_id,at").catch(() => [])) || [])
      .map((r) => [r.user_id, Date.parse(r.at) || 0]),
  );
  const sentRows = (await sb(env, "/rest/v1/digest_sent?select=user_id,day").catch(() => [])) || [];
  const sentSet = new Set(sentRows.map((r) => r.user_id + "|" + r.day));

  let sent = 0;
  const failures = [];
  for (const row of rows) {
    try {
      const blob = row.neural || {};
      // RE-SUBSCRIBING. Every row here already has `emailDigest === true` (it is the query's
      // filter), so intent alone cannot distinguish "turned it back on" from "unsubscribed and
      // the blob was never told" — which is every user suppressed before the blob write below
      // existed. The per-key LWW stamp the settings sync already maintains is the discriminator:
      // a stamp LATER than the suppression is a deliberate flip that came after it. Two guards
      // keep that honest — a legacy row's `at` is newer than its stale stamp, so it keeps
      // blocking; and `set()` stamps the CLIENT clock, so a stamp in the FUTURE is refused
      // rather than trusted (a fast device must not be able to re-subscribe its owner).
      if (suppressed.has(row.user_id)) {
        const at = suppressed.get(row.user_id);
        const stamp = (blob.settingsAt || {}).emailDigest;
        if (!(typeof stamp === "number" && stamp > at && stamp <= Date.now())) continue;
        // lifted — clear it, or tomorrow's run blocks them all over again
        await sb(env, "/rest/v1/digest_suppress?user_id=eq." + row.user_id, { method: "DELETE" });
      }
      const dayLog = blob.dayLog || {};
      const days = Object.keys(dayLog).filter((d) => (dayLog[d].k || []).length).sort();
      const day = days[days.length - 1];
      if (!day || sentSet.has(row.user_id + "|" + day)) continue;
      // never mail about the day still in progress somewhere: only days at least 1 behind the
      // NEWEST utc date — the client's local midnight has certainly passed by then.
      if (day >= new Date().toISOString().slice(0, 10)) continue;

      // the address: auth admin API, service role only
      const user = await sb(env, "/auth/v1/admin/users/" + row.user_id);
      const email = user && user.email;
      if (!email) continue;

      const e = dayLog[day];
      const prevDay = days[days.length - 2];
      const delta = prevDay && typeof dayLog[prevDay].s === "number"
        ? Math.round((e.s - dayLog[prevDay].s) * 10) / 10
        : null;
      const deltas = days.slice(-7).slice(0, -1).map((d, i, a) =>
        i > 0 ? (dayLog[a[i]].s - dayLog[a[i - 1]].s) / 100 : 0).filter((x) => x > 0);
      const weakTop = (e.w || []).slice(2);
      const digest = {
        count: (blob.days || {})[day] || e.k.length,
        techniques: e.k,
        score: e.s,
        delta,
        eta: beltEta((e.s || 0) / 100, deltas),
        streak: streakOf(blob.days, day),
        weakTop,
        clip: weakTop[0] ? await clipFor(weakTop[0]) : null,
        unsubUrl: SITE + "/unsubscribe?u=" + row.user_id + "&t=" + (await hmacToken(env, row.user_id)),
      };

      // 5. send — the Email Service binding's options API (owner's dashboard snippet,
      // 2026-08-17; field list confirmed against Cloudflare's Workers API reference 2026-09-01:
      // to/from/subject/html/text/cc/bcc/replyTo/headers/attachments, returns {messageId}).
      // `replyTo` is CAMELCASE on the binding — the REST API spells the same field `reply_to`,
      // and getting that backwards fails silently: an unknown key is simply ignored, the mail
      // still sends, and the header is quietly absent. LOUD on absence: the runbook's one gate.
      // Replies go to coach@bjjgraph.org, which Email Routing forwards to the owner's inbox —
      // deliberately human-read, no processing worker.
      //
      // LIST-UNSUBSCRIBE, finally. This comment used to say "when the simple API grows a headers
      // field, add List-Unsubscribe one-click there too" — it has one, so here it is. RFC 8058:
      // `List-Unsubscribe-Post` is what turns the mailbox provider's own Unsubscribe button into
      // a single click, and Gmail and Yahoo have required it of bulk senders since 2024. The URL
      // is the same HMAC-signed endpoint as the body link. Since v1.164.0 that endpoint honours
      // ONLY a POST whose form body carries the marker below (or its own confirm button); a GET
      // — a prefetcher's, a gateway's, a scanner's — renders a confirm page and mutates nothing,
      // and a bare POST is treated the same. So the header's silent-POST hazard is closed at
      // the endpoint, and the suppression stays LIFTABLE from Settings (since v1.149.1).
      if (!env.EMAIL || typeof env.EMAIL.send !== "function")
        throw new Error("EMAIL binding missing — connect Email Service and copy the binding stanza from the dashboard's wrangler tab (see RUNBOOK.md)");
      const sent1 = await env.EMAIL.send({
        to: email,
        from: FROM,
        replyTo: REPLY_TO,
        subject: renderSubject(digest),
        html: renderHtml(digest),
        text: renderText(digest),
        headers: {
          "List-Unsubscribe": "<" + digest.unsubUrl + ">",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      if (!sent1 || !sent1.messageId) throw new Error("send returned no messageId");

      await sb(env, "/rest/v1/digest_sent", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ user_id: row.user_id, day }),
      });
      sent++;
    } catch (err) {
      failures.push(row.user_id + ": " + (err && err.message));
    }
  }
  const result = { sent, of: rows.length, failures };
  console.log("[digest] " + JSON.stringify(result));
  return result;
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runDigest(env));
  },
  // manual trigger for testing: authenticated by the same service key
  async fetch(req, env) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY) return new Response("no", { status: 401 });
    return Response.json(await runDigest(env));
  },
};
