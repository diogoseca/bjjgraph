/**
 * One-click digest unsubscribe (v1.105.7) — the List-Unsubscribe target. GET or POST
 * /unsubscribe?u=<user_id>&t=<hmac>. Verifies the HMAC (so an address can only unsubscribe
 * itself), writes digest_suppress via the service key, and answers with a tiny page. Secrets
 * come from the Pages project's environment variables (Settings > Environment variables):
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UNSUB_HMAC_SECRET — same values as the Worker's.
 */
// The 6 site-wide security headers, BYTE-IDENTICAL to `_headers` /* and to the /l/ Function —
// a Pages Function response never inherits `_headers`, and check_headers_cache derives this
// route from the filename and fails the build if the block is missing or drifts.
const SHARE_STATIC_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy-Report-Only": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://*.posthog.com https://*.i.posthog.com https://www.clarity.ms; connect-src 'self' https://api.github.com https://*.supabase.co https://*.posthog.com https://*.i.posthog.com https://www.clarity.ms; worker-src 'self' blob:; manifest-src 'self'; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
};

const token = async (secret, userId) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
};

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const u = url.searchParams.get("u") || "";
  const t = url.searchParams.get("t") || "";
  const ok = u && t && env.UNSUB_HMAC_SECRET && t === (await token(env.UNSUB_HMAC_SECRET, u));
  if (!ok) return new Response("Invalid unsubscribe link.", { status: 400, headers: SHARE_STATIC_HEADERS });
  const r = await fetch(env.SUPABASE_URL + "/rest/v1/digest_suppress", {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ user_id: u }),
  });
  if (!r.ok && r.status !== 409) return new Response("Could not unsubscribe — try again later.", { status: 502, headers: SHARE_STATIC_HEADERS });
  return new Response(
    "<!doctype html><body style=\"font-family:sans-serif;max-width:420px;margin:80px auto;text-align:center;\"><h2>Unsubscribed.</h2><p>No more training-day emails. You can turn them back on any time in Settings.</p></body>",
    { headers: { "content-type": "text/html; charset=utf-8", ...SHARE_STATIC_HEADERS } },
  );
}
