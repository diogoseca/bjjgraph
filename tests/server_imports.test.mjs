// The suites' static servers import only what the root package.json declares (v1.265.3).
//
// scripts/e2e-serve.mjs (every Playwright config's webServer) and scripts/dev-serve.mjs (`npm run serve`) run from the
// root tree, which CI and both deploys install with `npm ci --ignore-scripts` from the root lockfile. A package one of
// them imports but the root does not declare is there only because something else depends on it, and it goes the day
// that something does. So every bare specifier either file imports is a Node builtin or a direct root dependency.
// It reads `import … from "x"`, `import "x"`, `export … from "x"`, `import("x")`, `require("x")` and
// `createRequire(…)("x")`; an `import(` or `createRequire` it cannot read as one of those fails (the count below fails
// on zero).
//
// Mutants, each applied alone, killed at "every package the servers import is declared by the root":
//   `compression` dropped from devDependencies; `serve-handler` dropped from devDependencies;
//   each of `import mime from "mime-types"`, `await import("mime-types")`, `createRequire(import.meta.url)("mime-types")`
//   and `export { default as mime } from "mime-types"` added to e2e-serve.mjs (a package that arrives only through
//   serve-handler); `const r = createRequire(import.meta.url)` and `await import(name)` (forms it cannot read).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";

const SERVERS = ["scripts/e2e-serve.mjs", "scripts/dev-serve.mjs"];

function bareImports(text, file) {
  const specs = [];
  const LIT = String.raw`\(\s*["']([^"']+)["']\s*\)`;
  for (const m of text.matchAll(/^\s*(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/gm)) specs.push(m[1]);
  for (const m of text.matchAll(new RegExp(String.raw`(?:\bimport|\brequire|\bcreateRequire\([^()]*(?:\([^()]*\))?[^()]*\))` + LIT, "g"))) specs.push(m[1]);
  // a form whose specifier is not a literal at the call cannot be checked here, so it fails
  const dynamic = [...text.matchAll(/\bimport\s*\((?!\s*["'][^"']+["']\s*\))/g)].length;
  const built = [...text.matchAll(/\bcreateRequire\([^()]*(?:\([^()]*\))?[^()]*\)(?!\s*\(\s*["'])/g)].length;
  assert.equal(dynamic + built, 0, `${file}: an import() or createRequire whose specifier is not a literal at the call`);
  return specs.filter((s) => !s.startsWith(".") && !s.startsWith("/"));
}
const packageOf = (spec) => (spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);

test("every package the servers import is declared by the root", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const declared = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
  const builtins = new Set(builtinModules);
  let packages = 0, specs = 0;
  for (const file of SERVERS) {
    const found = bareImports(readFileSync(file, "utf8"), file);
    specs += found.length;
    for (const spec of found) {
      if (spec.startsWith("node:") || builtins.has(spec)) continue;
      packages++;
      assert.ok(declared.has(packageOf(spec)), `${file} imports "${spec}", which the root package.json does not declare`);
    }
  }
  assert.ok(specs >= 8 && packages >= 3, `positive coverage: ${specs} bare imports read, ${packages} of them packages`);
  console.log(`# ${SERVERS.length} servers: ${specs} bare imports, ${packages} packages, each declared by the root`);
});
