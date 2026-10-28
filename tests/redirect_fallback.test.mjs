// site/redirect-fallback.mjs answers every category rule exactly as the Python port of Cloudflare's
// matcher does, and the middleware answers it BEFORE context.next() (v1.237.2, RDR546, RDR-R2).
//
// The table is emitted from THIS checkout's content by regenerate_redirects.py (no build), and the
// expected Location for every rule comes from scripts/check_redirect_limits.py, the port the gate
// runs, so the JS and the Python cannot drift apart without this file going red. The Function entry
// that bundles the built table is exercised by tests/redirect_fallback_bundle.test.mjs.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { onRequest, withRedirects } from "../site/agent-response.mjs";
import {
  CATEGORY_PREFIXES,
  FALLBACK_HEADER,
  compileRules,
  resolveRedirect,
} from "../site/redirect-fallback.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ORIGIN = "https://bjjgraph.org";
const CHILDREN = ["", "Attacker", "Defender", "x/y"];
const PAGE_CACHE = "public, max-age=300, stale-while-revalidate=3600";
const isWild = (source) => /\*|:[A-Za-z]/.test(source);

function python(code, args = [], input = undefined) {
  const run = spawnSync("python3", ["-B", "-c", code, ...args], { cwd: ROOT, encoding: "utf8", input });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  return run.stdout;
}

const dir = mkdtempSync(join(tmpdir(), "redirect-fallback-"));
let tableText;
let expected;
let prefixes;
const requests = [];
try {
  python(
    "import sys; sys.path.insert(0, 'scripts'); import check_redirect_limits as c; from pathlib import Path; " +
      "c.emit_from_source(Path(sys.argv[1]))",
    [dir],
  );
  const tablePath = join(dir, "static/redirect-fallback.json");
  tableText = readFileSync(tablePath, "utf8");
  // Every exact rule, and every wildcard's children, with and without a query string.
  for (const [source] of JSON.parse(tableText).rules) {
    const paths = isWild(source) ? CHILDREN.map((child) => source.replace("*", child)) : [source];
    for (const path of paths) requests.push({ path, search: "", rule: source }, { path, search: "?utm_source=x", rule: source });
  }
  expected = JSON.parse(
    python(
      [
        "import sys, json",
        "sys.path.insert(0, 'scripts')",
        "import check_redirect_limits as c",
        "_, _, fallback = c.load_fallback(open(sys.argv[1]).read())",
        "hits = [fallback.resolve(r['path'], r['search']) for r in json.load(sys.stdin)]",
        "print(json.dumps([None if h is None else [h[0], h[1]] for h in hits]))",
      ].join("\n"),
      [tablePath],
      JSON.stringify(requests),
    ),
  );
  prefixes = JSON.parse(
    python(
      "import sys, json; sys.path.insert(0, 'scripts'); import regenerate_redirects as r, check_redirect_limits as c; " +
        "print(json.dumps([list(r.FALLBACK_PREFIXES), list(c.CATEGORY_PREFIXES)]))",
    ),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
const table = JSON.parse(tableText);

test("the table holds every category rule, exact rules first, and the three lists of prefixes agree", () => {
  assert.equal(table.version, 1);
  assert.ok(table.rules.length > 0, "the category table holds no rules: nothing was checked");
  assert.deepEqual(prefixes[0], CATEGORY_PREFIXES, "regenerate_redirects.FALLBACK_PREFIXES");
  assert.deepEqual(prefixes[1], CATEGORY_PREFIXES, "check_redirect_limits.CATEGORY_PREFIXES");
  const firstWild = table.rules.findIndex(([source]) => isWild(source));
  assert.ok(firstWild > 0, "the table carries exact rules and then wildcards");
  assert.ok(table.rules.slice(firstWild).every(([source]) => isWild(source)), "no exact rule follows a wildcard");
  for (const [source, , status] of table.rules) {
    assert.ok(CATEGORY_PREFIXES.some((p) => source.startsWith(p)), source);
    assert.ok([301, 302, 303, 307, 308].includes(status), `${source}: ${status}`);
  }
  assert.equal(compileRules(table).size, table.rules.length, "a rule failed to compile and was dropped");
});

test("JS resolves every rule exactly as the Python port of Cloudflare's matcher", () => {
  const compiled = compileRules(table);
  let compared = 0;
  for (const [i, { path, search }] of requests.entries()) {
    const got = resolveRedirect(compiled, ORIGIN + path + search);
    assert.deepEqual(got && [got.status, got.location], expected[i], path + search);
    compared += 1;
  }
  assert.ok(expected.every(Boolean), "every request matched a rule");
  console.log(`redirect fallback: ${compared} requests over ${table.rules.length} rules agree with the Python port`);
});

function context(path, { status = 200, method = "GET", accept = "text/html" } = {}) {
  const calls = [];
  const request = new Request(ORIGIN + path, { method, headers: { Accept: accept } });
  return {
    request,
    calls,
    env: {
      ASSETS: {
        fetch: async (r) => {
          calls.push("ASSETS " + new URL(r.url).pathname);
          return new Response("not found", { status: 404 });
        },
      },
    },
    next: async () => {
      calls.push("next");
      return new Response(status === 200 ? "<html>page</html>" : "<html>404 page</html>", {
        status,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  };
}

const middleware = withRedirects(table);

test("the middleware answers every category rule BEFORE any page lookup, and says so", async () => {
  let served = 0;
  for (const [source] of table.rules) {
    const path = isWild(source) ? source.replace("*", "Attacker") : source;
    const i = requests.findIndex((r) => r.path === path && r.rule === source && !r.search);
    // A page that a deploy removed may still be in Cloudflare's retention cache, so next() would
    // answer 200 noindex (RDR-R2): the redirect must not wait for a 404.
    const ctx = context(path, { status: 200 });
    const response = await middleware(ctx);
    assert.equal(response.status, expected[i][0], path);
    assert.equal(response.headers.get("Location"), expected[i][1], path);
    assert.equal(response.headers.get(FALLBACK_HEADER), "fallback", path);
    assert.equal(response.headers.get("Cache-Control"), PAGE_CACHE);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), "no-store");
    assert.deepEqual(ctx.calls, [], `${path}: neither context.next() nor ASSETS may run before the redirect`);
    served += 1;
  }
  assert.equal(served, table.rules.length);
  console.log(`redirect fallback: ${served} category rules answered before any page lookup`);
});

test("a live page, an unknown page and a non-category path all reach the page lookup unchanged", async () => {
  const live = context("/Positions/Mount");
  const page = await middleware(live);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "<html>page</html>");
  assert.equal(page.headers.get(FALLBACK_HEADER), null);
  assert.deepEqual(live.calls, ["next"]);

  const unknown = context("/Positions/No-Such-Page", { status: 404 });
  const missing = await middleware(unknown);
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), "<html>404 page</html>");
  assert.equal(missing.headers.get(FALLBACK_HEADER), null);

  for (const path of ["/l/abc", "/positions/grasshopper-guard/top", "/Tree/x"]) {
    const outside = context(path, { status: 404 });
    assert.equal((await middleware(outside)).headers.get(FALLBACK_HEADER), null, path);
    assert.deepEqual(outside.calls, ["next"], path);
  }
});

test("HEAD, a query string, Markdown and a POST behave as the edge rule did", async () => {
  const [source, , status] = table.rules.at(-1);
  const path = source.replace("*", "Defender");
  const head = await middleware(context(path, { method: "HEAD" }));
  assert.equal(head.status, status);
  assert.equal(head.body, null);
  const i = requests.findIndex((r) => r.path === path && r.search);
  const withQuery = await middleware(context(path + requests[i].search));
  assert.equal(withQuery.headers.get("Location"), expected[i][1]);
  assert.ok(expected[i][1].endsWith("?utm_source=x"), expected[i][1]);
  const markdown = context(path, { accept: "text/markdown" });
  assert.equal((await middleware(markdown)).status, status);
  assert.deepEqual(markdown.calls, [], "a negotiated request is redirected before its Markdown is looked up");
  // A non-GET request skipped negotiation before and still does; the edge redirected it anyway.
  const post = context(path, { method: "POST" });
  assert.equal((await middleware(post)).status, status);
  assert.deepEqual(post.calls, []);
});

test("the plain onRequest (no table) redirects nothing: content negotiation alone", async () => {
  const [source] = table.rules[0];
  const ctx = context(source, { status: 404 });
  assert.equal((await onRequest(ctx)).status, 404);
  assert.deepEqual(ctx.calls, ["next"]);
});
