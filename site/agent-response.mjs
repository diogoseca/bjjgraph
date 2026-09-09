// Only explicit Markdown preferences opt in; ordinary browser Accept stays HTML.
export function prefersMarkdown(accept = "") {
  const ranges = accept.split(",").map((part) => {
    const [media, ...parameters] = part.trim().toLowerCase().split(";");
    const quality = parameters
      .map((p) => p.trim())
      .find((p) => p.startsWith("q="));
    const q = quality ? Number(quality.slice(2)) : 1;
    return {
      media: media.trim(),
      q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0,
    };
  });
  const quality = (media) => {
    for (const match of [media, "text/*", "*/*"]) {
      const entries = ranges.filter((r) => r.media === match);
      if (entries.length) return Math.max(...entries.map((r) => r.q));
    }
    return 0;
  };
  return (
    ranges.some((r) => r.media === "text/markdown") &&
    quality("text/markdown") > 0 &&
    quality("text/markdown") >= quality("text/html")
  );
}

const CATEGORIES = new Set([
  "Positions",
  "Transitions",
  "Submissions",
  "Principles",
  "Systems",
  "Learning",
]);
const SIGNAL = "search=yes, ai-input=yes";
const DISCOVERY_LINKS =
  '<https://bjjgraph.org/sitemap.xml>; rel="sitemap"; type="application/xml", <https://bjjgraph.org/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json", <https://bjjgraph.org/llms.txt>; rel="describedby"; type="text/plain"';

// Pages does not apply _headers to Function responses. Keep the security policy
// identical to its canonical source; the runtime tests compare every key/value.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "geolocation=(), microphone=(), camera=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy-Report-Only":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://*.posthog.com https://*.i.posthog.com https://www.clarity.ms; connect-src 'self' https://api.github.com https://*.supabase.co https://*.posthog.com https://*.i.posthog.com https://www.clarity.ms; worker-src 'self' blob:; manifest-src 'self'; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  let path;
  try {
    path = decodeURIComponent(url.pathname).replace(/\/$/, "") || "/";
  } catch {
    return context.next();
  }
  const isPublic =
    path === "/" ||
    path === "/terms" ||
    path === "/privacy" ||
    CATEGORIES.has(path.split("/")[1]);
  if (
    !isPublic ||
    !["GET", "HEAD"].includes(request.method) ||
    path.split("/").some((p) => p === "." || p === "..") ||
    /[\\\u0000-\u001f]/.test(path)
  ) {
    return context.next();
  }

  let response;
  let markdown = false;
  const markdownPath =
    "/markdown/" + (path === "/" ? "index" : path.slice(1)) + ".md";
  if (prefersMarkdown(request.headers.get("accept") || "")) {
    const asset = new URL(url.origin);
    asset.pathname = markdownPath;
    // Fresh internal GET: no user credentials, Range, or HTML validators forwarded.
    try {
      const candidate = await env.ASSETS.fetch(
        new Request(asset, { headers: { Accept: "text/markdown" } }),
      );
      if (
        candidate.status === 200 &&
        candidate.headers
          .get("content-type")
          ?.toLowerCase()
          .startsWith("text/markdown")
      ) {
        response = candidate;
        markdown = true;
      } else {
        await candidate.body?.cancel();
      }
    } catch {
      // Asset unavailability must not prevent normal page navigation.
    }
  }
  response ||= await context.next();
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS))
    headers.set(key, value);
  const vary = new Set(
    (headers.get("Vary") || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!vary.has("*")) vary.add("accept");
  headers.set("Vary", [...vary].join(", "));
  // Cloudflare's ordinary cache key does not vary by Accept. Negotiated responses
  // never enter the shared CDN cache; the internal static assets still use it.
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("CDN-Cache-Control", "no-store");
  if (response.ok) {
    headers.set("Content-Signal", SIGNAL);
    const alternate = `<https://bjjgraph.org${new URL(markdownPath, url).pathname}>; rel="alternate"; type="text/markdown"`;
    headers.set(
      "Link",
      [headers.get("Link"), DISCOVERY_LINKS, alternate]
        .filter(Boolean)
        .join(", "),
    );
  }
  if (markdown) {
    headers.set("Content-Type", "text/markdown; charset=utf-8");
    headers.set("Cache-Control", "private, no-store");
    headers.set("Content-Location", new URL(markdownPath, url).pathname);
    // The negotiated URL is the canonical HTML URL: never inherit the direct
    // /markdown/* noindex policy onto it.
    if (url.hostname === "bjjgraph.org") headers.delete("X-Robots-Tag");
    else headers.set("X-Robots-Tag", "noindex, follow");
    // ASSETS returns decoded bytes. Its validators describe the static asset URL.
    for (const key of [
      "content-length",
      "content-encoding",
      "etag",
      "last-modified",
    ])
      headers.delete(key);
    headers.append(
      "Link",
      `<https://bjjgraph.org${url.pathname}>; rel="canonical"`,
    );
  } else if (response.ok && !headers.has("Cache-Control")) {
    headers.set(
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=3600",
    );
  }
  if (request.method === "HEAD") await response.body?.cancel();
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
