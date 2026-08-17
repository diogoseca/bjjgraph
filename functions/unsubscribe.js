/**
 * One-click digest unsubscribe (v1.105.7) — the List-Unsubscribe target. GET or POST
 * /unsubscribe?u=<user_id>&t=<hmac>. Verifies the HMAC (so an address can only unsubscribe
 * itself), writes digest_suppress via the service key, and answers with a tiny page. Secrets
 * come from the Pages project's environment variables (Settings > Environment variables):
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UNSUB_HMAC_SECRET — same values as the Worker's.
 */
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
  if (!ok) return new Response("Invalid unsubscribe link.", { status: 400 });
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
  if (!r.ok && r.status !== 409) return new Response("Could not unsubscribe — try again later.", { status: 502 });
  return new Response(
    "<!doctype html><body style=\"font-family:sans-serif;max-width:420px;margin:80px auto;text-align:center;\"><h2>Unsubscribed.</h2><p>No more training-day emails. You can turn them back on any time in Settings.</p></body>",
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
