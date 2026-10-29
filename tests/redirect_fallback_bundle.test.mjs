// functions/_middleware.js bundles the build's own category table, and a bundle without it cannot be
// built (v1.237.2, RDR-R2). The real entry file and the real site/ modules are bundled with esbuild,
// the bundler wrangler drives (wrangler 4.154.0's `pages functions build` was checked by hand on this
// branch: "Compiled Worker successfully", table inlined), in a temp layout whose
// source/public/static/redirect-fallback.json comes from THIS checkout's emit. The bundle then answers
// a category redirect before context.next() with no ASSETS fetch: the table is in the bundle.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { depsPromised, SOURCE_DEPS } from "./_deps_promised.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deps = depsPromised(import.meta.url, { ...SOURCE_DEPS, modules: ["esbuild"] });
const { test, assert, require: requireFromSource } = deps;
const { build } = await deps.setup(() => requireFromSource("esbuild"));

function layout(withTable) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "redirect-bundle-"));
  for (const rel of ["functions/_middleware.js", "site/agent-response.mjs", "site/redirect-fallback.mjs"]) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.copyFileSync(path.join(REPO, rel), path.join(root, rel));
  }
  if (withTable) {
    const run = spawnSync("python3", ["-B", "-c",
      "import sys; sys.path.insert(0, 'scripts'); import check_redirect_limits as c; from pathlib import Path; " +
      "c.emit_from_source(Path(sys.argv[1]))", path.join(root, "source/public")], { cwd: REPO, encoding: "utf8" });
    assert.equal(run.status, 0, run.stdout + run.stderr);
  }
  return root;
}

const options = (root) => ({
  entryPoints: [path.join(root, "functions/_middleware.js")], bundle: true, format: "esm",
  platform: "neutral", write: false, logLevel: "silent",
});

test("the Function entry bundles the built table and answers a category rule before any lookup", async () => {
  const root = layout(true);
  try {
    const table = JSON.parse(fs.readFileSync(path.join(root, "source/public/static/redirect-fallback.json"), "utf8"));
    const result = await build(options(root));
    const code = result.outputFiles[0].text;
    const [lastSource, lastTarget] = table.rules.at(-1);
    assert.ok(code.includes(JSON.stringify(lastSource)), "the table's last rule is inlined in the bundle");
    const out = path.join(root, "bundle.mjs");
    fs.writeFileSync(out, code);
    const { onRequest } = await import(pathToFileURL(out));
    const calls = [];
    const request = new Request("https://bjjgraph.org" + lastSource.replace("*", "Attacker"));
    const response = await onRequest({
      request,
      env: { ASSETS: { fetch: async () => { calls.push("ASSETS"); return new Response("", { status: 404 }); } } },
      next: async () => { calls.push("next"); return new Response("retained page", { status: 200 }); },
    });
    assert.equal(response.status, table.rules.at(-1)[2]);
    assert.equal(response.headers.get("Location"), lastTarget.replace(":splat", "Attacker"));
    assert.equal(response.headers.get("X-Redirect-Source"), "fallback");
    assert.deepEqual(calls, [], "no page lookup and no table fetch: the table is in the bundle");
    console.log(`redirect bundle: ${table.rules.length} rules inlined, ${code.length} B bundle`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a build that did not write the table cannot bundle the Function (fail closed)", async () => {
  const root = layout(false);
  try {
    await assert.rejects(build(options(root)), /redirect-fallback\.json/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
