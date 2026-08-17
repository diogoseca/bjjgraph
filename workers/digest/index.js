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

// The knowledge-band thresholds — MUST match BELT_SCORE in neural/src/app.src.jsx.
const BELTS = [
  ["white", 0.2],
  ["blue", 0.4],
  ["purple", 0.6],
  ["brown", 0.7],
  ["black", 0.8],
];

// fnv1a32, byte-identical to the app's qhash — content chunks are addressed by it.
const fnv1a32 = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
};

const SITE = "https://bjjgraph.org";

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
  return r.status === 204 ? null : r.json();
}

/** "Kimura|Attacker" -> "Kimura (attacking)"; "Mount|Top" -> "Mount (top)" */
const prettyKey = (k) => {
  const [fam, role] = String(k).split("|");
  const r = (role || "").toLowerCase();
  return fam + (r === "attacker" ? " (attacking)" : r ? " (" + r + ")" : "");
};

const beltEta = (score01, dailyDeltas) => {
  const next = BELTS.find(([, t]) => t > score01);
  if (!next) return null;
  const pace = dailyDeltas.length
    ? dailyDeltas.reduce((a, b) => a + b, 0) / dailyDeltas.length
    : 0;
  if (pace <= 0) return { belt: next[0], days: null };
  return { belt: next[0], days: Math.max(1, Math.ceil((next[1] - score01) / pace)) };
};

const streakOf = (days, endDay) => {
  // consecutive calendar days with activity, ending at the digest day
  const have = new Set(Object.keys(days || {}).filter((d) => (days[d] || 0) > 0));
  let n = 0;
  let cur = new Date(endDay + "T12:00:00Z");
  while (have.has(cur.toISOString().slice(0, 10))) {
    n++;
    cur = new Date(cur.getTime() - 86400000);
  }
  return n;
};

/** the top weak spot's clip, from the PUBLIC content chunk — no clip, no video block */
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
        if (c && c.id && (c.who || c.title))
          return { id: c.id, title: c.title || "", who: c.who || "", dur: c.dur || c.duration || null };
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

function renderText(d) {
  const eta = d.eta && d.eta.days ? "At this pace: " + d.eta.belt.toUpperCase() + " BELT in ~" + d.eta.days + " days\n" : "";
  const weak = d.weakTop.length
    ? "\nWeak spot: " + prettyKey(d.weakTop[0]) +
      (d.clip ? "\n  A great video from " + (d.clip.who || "a top instructor") + ": https://www.youtube.com/watch?v=" + d.clip.id : "") +
      (d.weakTop[1] ? "\n  And one for the road: " + prettyKey(d.weakTop[1]) : "") + "\n"
    : "";
  return "TODAY AT BJJGRAPH\n" +
    d.count + " cards · " + d.techniques.length + " techniques\n" +
    "Game Knowledge: " + d.score + "%" + (d.delta != null ? " (" + (d.delta >= 0 ? "+" : "") + d.delta + "% today)" : "") + "\n" +
    eta + (d.streak > 1 ? d.streak + " training days in a row\n" : "") +
    "\nWhat you reviewed:\n" + d.techniques.slice(0, 10).map((t) => "  · " + prettyKey(t)).join("\n") +
    (d.techniques.length > 10 ? "\n  · …and " + (d.techniques.length - 10) + " more" : "") +
    weak + "\n" + SITE + "\n\nUnsubscribe: " + d.unsubUrl + "\n";
}

function renderHtml(d) {
  const esc = (t) => String(t).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const li = d.techniques.slice(0, 10).map((t) => "<li>" + esc(prettyKey(t)) + "</li>").join("");
  const more = d.techniques.length > 10 ? "<li>…and " + (d.techniques.length - 10) + " more</li>" : "";
  const eta = d.eta && d.eta.days
    ? `<p style="margin:14px 0 0;font-size:15px;"><b>At this pace: ${d.eta.belt.toUpperCase()} BELT in ~${d.eta.days} days</b></p>`
    : d.eta
      ? `<p style="margin:14px 0 0;font-size:14px;">Next stop: <b>${d.eta.belt} belt</b></p>`
      : "";
  const clipBlock = d.clip
    ? `<p style="margin:6px 0 0;font-size:13px;">Here's a great video from <b>${esc(d.clip.who || "a top instructor")}</b> explaining ${esc(d.weakTop[0] ? prettyKey(d.weakTop[0]) : "it")}${d.clip.dur ? " (" + esc(String(d.clip.dur)) + ")" : ""}: <a href="https://www.youtube.com/watch?v=${esc(d.clip.id)}">${esc(d.clip.title || "watch")}</a></p>`
    : "";
  const extra = d.weakTop[1]
    ? `<p style="margin:10px 0 0;font-size:12px;color:#555;">And one for the road: <b>${esc(prettyKey(d.weakTop[1]))}</b> — worth a look next session.</p>`
    : "";
  const weakBlock = d.weakTop.length
    ? `<hr style="border:none;border-top:1px solid #ddd;margin:18px 0;">
       <p style="margin:0;font-size:11px;letter-spacing:.1em;color:#888;">WEAK SPOTS</p>
       <p style="margin:6px 0 0;font-size:14px;"><b>${esc(prettyKey(d.weakTop[0]))}</b> is your softest spot right now.</p>
       ${clipBlock}${extra}`
    : "";
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c2130;max-width:520px;margin:0 auto;padding:24px 18px;">
  <p style="font-size:11px;letter-spacing:.14em;color:#888;margin:0;">TODAY AT BJJGRAPH</p>
  <h1 style="font-size:20px;margin:6px 0 14px;">${d.count} card${d.count === 1 ? "" : "s"} · ${d.techniques.length} technique${d.techniques.length === 1 ? "" : "s"}</h1>
  <p style="margin:0;font-size:15px;">Game Knowledge: <b>${d.score}%</b>${d.delta != null ? ` <span style="color:${d.delta >= 0 ? "#188a4c" : "#b3403a"};">(${d.delta >= 0 ? "+" : ""}${d.delta}% today)</span>` : ""}</p>
  ${eta}
  ${d.streak > 1 ? `<p style="margin:10px 0 0;font-size:13px;">🔥 ${d.streak} training days in a row</p>` : ""}
  <p style="margin:16px 0 6px;font-size:12px;letter-spacing:.08em;color:#888;">WHAT YOU REVIEWED</p>
  <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;">${li}${more}</ul>
  ${weakBlock}
  <p style="margin:22px 0 0;"><a href="${SITE}" style="display:inline-block;background:#4a6cff;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:9px;">Keep it — do your maintenance</a></p>
  <p style="margin:26px 0 0;font-size:11px;color:#999;">You asked for this after active days (Settings → Training-day email · Beta).
  <a href="${d.unsubUrl}" style="color:#999;">Unsubscribe with one click</a>.</p>
  </body></html>`;
}

async function runDigest(env) {
  // 1. opted-in blobs. PostgREST jsonb path filter; the blob column is `neural`.
  const rows = await sb(
    env,
    "/rest/v1/user_training_data?select=user_id,neural&neural->settings->>emailDigest=eq.true",
  );
  if (!rows || !rows.length) return { sent: 0, reason: "nobody opted in" };

  const suppressed = new Set(
    ((await sb(env, "/rest/v1/digest_suppress?select=user_id").catch(() => [])) || []).map((r) => r.user_id),
  );
  const sentRows = (await sb(env, "/rest/v1/digest_sent?select=user_id,day").catch(() => [])) || [];
  const sentSet = new Set(sentRows.map((r) => r.user_id + "|" + r.day));

  let sent = 0;
  const failures = [];
  for (const row of rows) {
    try {
      if (suppressed.has(row.user_id)) continue;
      const blob = row.neural || {};
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

      // 5. send — the Email Service binding's simple-options API (verified against the owner's
      // dashboard snippet, 2026-08-17: `env.EMAIL.send({to, from, subject, html, text})` returns
      // {messageId}; no API token, no raw MIME). LOUD on absence: the runbook's one gate.
      // Replies go to coach@bjjgraph.org, which Email Routing forwards to the owner's inbox —
      // deliberately human-read, no processing worker. The unsubscribe link lives in the body;
      // when the simple API grows a headers field, add List-Unsubscribe one-click there too.
      if (!env.EMAIL || typeof env.EMAIL.send !== "function")
        throw new Error("EMAIL binding missing — connect Email Service and copy the binding stanza from the dashboard's wrangler tab (see RUNBOOK.md)");
      const sent1 = await env.EMAIL.send({
        to: email,
        from: "coach@bjjgraph.org",
        subject: "Today at BJJGraph: " + digest.techniques.length + " technique" + (digest.techniques.length === 1 ? "" : "s") + ", " + digest.score + "%",
        html: renderHtml(digest),
        text: renderText(digest),
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
