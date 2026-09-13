import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { onRequest, prefersMarkdown } from "../site/agent-response.mjs";

function context(
  path = "/Positions/Mount",
  accept = "text/html",
  options = {},
) {
  const calls = [];
  const request = new Request("https://bjjgraph.org" + path, {
    method: options.method || "GET",
    headers: { Accept: accept, ...options.headers },
  });
  return {
    request,
    calls,
    env: {
      ASSETS: {
        fetch: async (r) => {
          calls.push(r);
          return (
            options.asset?.(r) ||
            new Response("# Mount\n\nAn article", {
              headers: {
                "Content-Type": "text/markdown; charset=utf-8",
                ETag: '"md-asset"',
                "Content-Encoding": "gzip",
                "Content-Length": "123",
                "Last-Modified": "yesterday",
                "X-Robots-Tag": "noindex, follow",
              },
            })
          );
        },
      },
    },
    next: async () => {
      calls.push("next");
      return new Response(
        options.body ||
          '<html><script src="/app.js"></script><article>Mount</article></html>',
        {
          status: options.status || 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
            Vary: "Accept-Encoding",
            ETag: '"html"',
            ...options.responseHeaders,
          },
        },
      );
    },
  };
}

test("Accept negotiation respects explicit preferences, quality, wildcards and exclusions", () => {
  for (const value of [
    "",
    "*/*",
    "text/*",
    "text/html,application/xhtml+xml,*/*;q=0.8",
    "text/markdown;q=0",
    "text/markdown;q=0.3,text/html;q=1",
    "text/markdown;q=bad",
    "text/markdown;q=2",
  ]) {
    assert.equal(prefersMarkdown(value), false, value);
  }
  for (const value of [
    "text/markdown",
    "TEXT/MARKDOWN; Q=1",
    "text/markdown,text/html;q=0.9",
    "text/markdown,text/*;q=0.8",
    "text/markdown;q=0.8,text/html;q=0,*/*;q=1",
  ]) {
    assert.equal(prefersMarkdown(value), true, value);
  }
});

test("normal browsers receive the unchanged app HTML with validators and browser cache intact", async () => {
  const ctx = context();
  const res = await onRequest(ctx);
  assert.match(
    await res.text(),
    /<script src="\/app.js"><\/script><article>Mount<\/article>/,
  );
  assert.deepEqual(ctx.calls, ["next"]);
  assert.equal(res.headers.get("etag"), '"html"');
  assert.equal(
    res.headers.get("cache-control"),
    "public, max-age=300, stale-while-revalidate=3600",
  );
  assert.match(res.headers.get("vary"), /accept-encoding, accept/);
  assert.equal(res.headers.get("cloudflare-cdn-cache-control"), "no-store");
  assert.match(res.headers.get("link"), /rel="api-catalog"/);
});

test("Markdown uses the exact article, strips HTML validators and cannot poison caches or noindex the canonical URL", async () => {
  const ctx = context("/Positions/Mount?session=private", "text/markdown", {
    headers: {
      Cookie: "private",
      Authorization: "Bearer private",
      "If-None-Match": '"html"',
      Range: "bytes=0-10",
    },
  });
  const res = await onRequest(ctx);
  assert.equal(await res.text(), "# Mount\n\nAn article");
  assert.equal(
    ctx.calls[0].url,
    "https://bjjgraph.org/markdown/Positions/Mount.md",
  );
  for (const h of ["cookie", "authorization", "if-none-match", "range"])
    assert.equal(ctx.calls[0].headers.has(h), false);
  for (const h of [
    "etag",
    "content-length",
    "content-encoding",
    "last-modified",
    "x-robots-tag",
  ])
    assert.equal(res.headers.has(h), false, h);
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.equal(res.headers.get("cdn-cache-control"), "no-store");
  assert.match(res.headers.get("vary"), /accept/);
  assert.equal(
    res.headers.get("content-location"),
    "/markdown/Positions/Mount.md",
  );
  assert.match(
    res.headers.get("link"),
    /<https:\/\/bjjgraph.org\/Positions\/Mount>; rel="canonical"/,
  );
});

test("missing Markdown, aliases and asset HTML fallbacks preserve original responses", async () => {
  for (const asset of [
    () => new Response("missing", { status: 404 }),
    () =>
      new Response("fallback", { headers: { "Content-Type": "text/html" } }),
  ]) {
    const ctx = context("/Positions/Old-Alias", "text/markdown", {
      asset,
      status: 301,
      responseHeaders: { Location: "/Positions/Mount" },
    });
    const res = await onRequest(ctx);
    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), "/Positions/Mount");
    assert.equal(ctx.calls.at(-1), "next");
  }
});

test("share links, unsubscribe, private paths, assets, invalid paths and writes pass through", async () => {
  for (const [path, method] of [
    ["/l/AQID", "GET"],
    ["/unsubscribe?token=x", "GET"],
    ["/ping", "GET"],
    ["/static/neural/app/neural.js", "GET"],
    ["/private/profile", "GET"],
    ["/Positions/%00Mount", "GET"],
    ["/Positions/%ZZ", "GET"],
    ["/", "POST"],
  ]) {
    const ctx = context(path, "text/markdown", { method });
    await onRequest(ctx);
    assert.deepEqual(ctx.calls, ["next"], path);
  }
});

test("HEAD returns Markdown headers without a body; homepage and Unicode paths map correctly", async () => {
  for (const [path, target] of [
    ["/", "/markdown/index.md"],
    ["/Positions/Mount/", "/markdown/Positions/Mount.md"],
    ["/Learning/Caf%C3%A9", "/markdown/Learning/Caf%C3%A9.md"],
  ]) {
    const ctx = context(path, "text/markdown", { method: "HEAD" });
    const res = await onRequest(ctx);
    assert.equal(await res.text(), "");
    assert.equal(new URL(ctx.calls[0].url).pathname, target);
    assert.match(res.headers.get("content-type"), /^text\/markdown/);
  }
});

test("both negotiated representations deliver every canonical security header", async () => {
  const file = await readFile(
    new URL("../source/quartz/static/_headers", import.meta.url),
    "utf8",
  );
  const security = file
    .split("\n/*\n")[1]
    .trim()
    .split("\n")
    .map((s) => {
      const i = s.indexOf(":");
      return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    });
  for (const accept of ["text/html", "text/markdown"]) {
    const res = await onRequest(context("/", accept));
    for (const [key, value] of security)
      assert.equal(res.headers.get(key), value, `${accept}: ${key}`);
  }
});

test("preview deployments keep their noindex policy for negotiated content", async () => {
  const ctx = context("/", "text/markdown");
  ctx.request = new Request("https://preview.bjjgraph.pages.dev/", {
    headers: { Accept: "text/markdown" },
  });
  const res = await onRequest(ctx);
  assert.equal(res.headers.get("x-robots-tag"), "noindex, follow");
});

test("a failed Markdown asset fetch still serves the existing page", async () => {
  const ctx = context("/", "text/markdown", {
    asset: () => {
      throw new Error("asset unavailable");
    },
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<article>Mount/);
  assert.equal(ctx.calls.at(-1), "next");
});
