// site/redirect-fallback.mjs answers every fallback wildcard exactly as the Python port of
// Cloudflare's matcher does, and the middleware serves it only after a 404 (v1.237.1, RDR546).
//
// The table is emitted from THIS checkout's content by regenerate_redirects.py (no build), and the
// expected Location for every rule comes from scripts/check_redirect_limits.py, the port the gate
// runs, so the JS and the Python cannot drift apart without this file going red.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { onRequest } from "../site/agent-response.mjs";
import {
  FALLBACK_HEADER,
  FALLBACK_TABLE,
  _resetFallback,
  compileRules,
  resolveRedirect,
} from "../site/redirect-fallback.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ORIGIN = "https://bjjgraph.org";
const CHILDREN = ["", "Attacker", "Defender", "x/y"];

function python(code, args = [], input = undefined) {
  const run = spawnSync("python3", ["-B", "-c", code, ...args], { cwd: ROOT, encoding: "utf8", input });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  return run.stdout;
}

const dir = mkdtempSync(join(tmpdir(), "redirect-fallback-"));
let tableText;
let expected;
const requests = [];
try {
  python(
    "import sys; sys.path.insert(0, 'scripts'); import check_redirect_limits as c; from pathlib import Path; " +
      "c.emit_from_source(Path(sys.argv[1]))",
    [dir],
  );
  const tablePath = join(dir, "static/redirect-fallback.json");
  tableText = readFileSync(tablePath, "utf8");
  // Every rule's children, with and without a query string.
  for (const [source] of JSON.parse(tableText).rules) {
    for (const child of CHILDREN) {
      const path = source.replace("*", child);
      requests.push({ path, search: "" }, { path, search: "?utm_source=x" });
    }
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
} finally {
  rmSync(dir, { recursive: true, force: true });
}
const table = JSON.parse(tableText);

test("the emitted table is non-empty and every rule is a category wildcard redirect", () => {
  assert.equal(table.version, 1);
  assert.ok(table.rules.length > 0, "the fallback table holds no rules: nothing was checked");
  for (const [source, , status] of table.rules) {
    assert.match(source, /^\/(Positions|Transitions|Submissions)\/.+\/\*$/, source);
    assert.ok([301, 302, 303, 307, 308].includes(status), `${source}: ${status}`);
  }
  assert.equal(compileRules(table).length, table.rules.length, "a rule failed to compile and was dropped");
});

test("JS resolves every rule's children exactly as the Python port of Cloudflare's matcher", () => {
  const rules = compileRules(table);
  let compared = 0;
  for (const [i, { path, search }] of requests.entries()) {
    const got = resolveRedirect(rules, ORIGIN + path + search);
    assert.deepEqual(got && [got.status, got.location], expected[i], path + search);
    compared += 1;
  }
  assert.ok(expected.filter(Boolean).length === compared, "every request matched a rule");
  console.log(`redirect fallback: ${compared} requests over ${table.rules.length} rules agree with the Python port`);
});

function context(path, { status = 404, method = "GET", tableStatus = 200, accept = "text/html" } = {}) {
  const calls = [];
  let cancelled = false;
  const request = new Request(ORIGIN + path, { method, headers: { Accept: accept } });
  return {
    request,
    calls,
    cancelled: () => cancelled,
    env: {
      ASSETS: {
        fetch: async (r) => {
          const url = new URL(r.url);
          calls.push(url.pathname);
          if (url.pathname === FALLBACK_TABLE) {
            return new Response(tableStatus === 200 ? tableText : "missing", { status: tableStatus });
          }
          return new Response("not found", { status: 404 });
        },
      },
    },
    next: async () => {
      calls.push("next");
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("<html>404 page</html>"));
          controller.close();
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(status === 200 ? "<html>page</html>" : body, {
        status,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  };
}

test("the middleware answers every fallback rule after a 404, says so, and drops the 404 body", async () => {
  _resetFallback();
  let served = 0;
  for (const [i, { path, search }] of requests.entries()) {
    if (search || !path.endsWith("/Attacker")) continue;
    const ctx = context(path);
    const response = await onRequest(ctx);
    assert.equal(response.status, expected[i][0], path);
    assert.equal(response.headers.get("Location"), expected[i][1], path);
    assert.equal(response.headers.get(FALLBACK_HEADER), "fallback", path);
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=300, stale-while-revalidate=3600");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), "no-store");
    assert.ok(ctx.cancelled(), `${path}: the 404 page's body was never cancelled`);
    served += 1;
  }
  assert.equal(served, table.rules.length);
  console.log(`redirect fallback: ${served} rules answered through onRequest`);
});

test("a live page never consults the table; a 404 with no rule stays the 404", async () => {
  _resetFallback();
  const page = context("/Positions/Mount", { status: 200 });
  assert.equal((await onRequest(page)).status, 200);
  assert.deepEqual(page.calls, ["next"], "a 200 must not fetch the redirect table");

  const miss = context("/Positions/No-Such-Page");
  const response = await onRequest(miss);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "<html>404 page</html>");
  assert.equal(response.headers.get(FALLBACK_HEADER), null);

  const outside = context("/l/abc");
  assert.equal((await onRequest(outside)).status, 404);
  assert.ok(!outside.calls.includes(FALLBACK_TABLE), "a path outside the categories never reaches the fallback");
});

test("HEAD gets the redirect with no body, and the query string survives", async () => {
  _resetFallback();
  const [source, , status] = table.rules.at(-1);
  const path = source.replace("*", "Defender");
  const head = await onRequest(context(path, { method: "HEAD" }));
  assert.equal(head.status, status);
  assert.equal(head.body, null);
  const i = requests.findIndex((r) => r.path === path && r.search);
  const withQuery = await onRequest(context(path + requests[i].search));
  assert.equal(withQuery.headers.get("Location"), expected[i][1]);
  assert.ok(expected[i][1].endsWith("?utm_source=x"), expected[i][1]);
});

test("a missing table leaves the 404 standing and says why", async () => {
  _resetFallback();
  const errors = [];
  const original = console.error;
  console.error = (message) => errors.push(String(message));
  try {
    const [source] = table.rules[0];
    const response = await onRequest(context(source.replace("*", "Attacker"), { tableStatus: 404 }));
    assert.equal(response.status, 404);
  } finally {
    console.error = original;
  }
  assert.equal(errors.length, 1);
  assert.match(errors[0], /redirect fallback unavailable/);
  _resetFallback();
});
