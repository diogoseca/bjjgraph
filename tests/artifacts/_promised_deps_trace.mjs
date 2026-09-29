// ── PROMISED-DEPS TRACE: what a test's transformer path RESOLVES at runtime ────────────────────
//
// The manifest a test hands tests/_deps_promised.mjs must name every module the TRANSPILED
// transformer path resolves, not only what the test file imports (v1.195.12). The canonical
// miss: @napi-rs/simple-git appears in no grep of tests/, because lastmod.ts resolves it, not
// the test — so a guard listing only the test's own requires let a partial install fail INSIDE a
// case with a raw `Cannot find module` instead of being NAMED by the guard. Measured on
// 2026-09-21 with only that package hidden: tests/published_time.test.mjs red at import,
// tests/quartz_sanitizer_ping.test.mjs 4 of 5 cases red, both guards silent.
//
// This preload registers a SYNCHRONOUS resolve hook (module.registerHooks, Node >= 22.15), which
// sees both require() and import — including imports made by tsx-transpiled .ts files and by an
// esbuild bundle with `packages: "external"`. It records every BARE specifier that lands under
// source/node_modules when the importer is NOT itself inside node_modules: the test file, a
// Quartz source, or a bundle in source/.quartz-cache or source/.date-worker-*. Transitive
// dependencies (unified -> bail) are npm's business and are excluded by that parent filter.
//
// USE — run the test file DIRECTLY, not through `node --test` (children do not inherit --import):
//   TRACE_OUT=/tmp/trace.json node --import tests/artifacts/_promised_deps_trace.mjs tests/<file>.test.mjs
//   python3 -c 'import json;[print(k,"<-",", ".join(v)) for k,v in json.load(open("/tmp/trace.json")).items()]'
// Needs a full source/node_modules (a missing module cannot be traced to its importer). A test
// whose manifest drifts from its trace is degraded, not broken: a partial install then fails
// inside a case rather than at the guard. Re-trace after any change to the modules a
// transformer, processor or the bundled config imports.
import module from "node:module";
import fs from "node:fs";

const OUT = process.env.TRACE_OUT;
if (!OUT) throw new Error("_promised_deps_trace: set TRACE_OUT=<path> — a trace with nowhere to go is not a trace");

const seen = new Map(); // package -> Set(importer)
const pkgOf = (p) => {
  const i = p.lastIndexOf("/node_modules/");
  if (i < 0) return null;
  const parts = p.slice(i + "/node_modules/".length).split("/");
  return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
};
const short = (p) =>
  p.replace(/^.*\/bjjgraph\/[^/]+\//, "").replace(/-[A-Za-z0-9]+\/worker\.mjs$/, "-<tmp>/worker.mjs").replace(/-\d+\.mjs$/, "-<pid>.mjs");

module.registerHooks({
  resolve(specifier, context, nextResolve) {
    const r = nextResolve(specifier, context);
    try {
      const url = typeof r?.url === "string" ? r.url : "";
      const p = url.startsWith("file:") ? decodeURIComponent(new URL(url).pathname) : url;
      const parent = context?.parentURL ? decodeURIComponent(new URL(context.parentURL).pathname) : "";
      const bare = !/^(\.|\/|node:|file:|data:)/.test(specifier);
      if (bare && p.includes("/source/node_modules/") && !parent.includes("/node_modules/")) {
        const pkg = pkgOf(p);
        if (pkg) {
          if (!seen.has(pkg)) seen.set(pkg, new Set());
          seen.get(pkg).add(short(parent) || "(entry)");
        }
      }
    } catch {
      /* a resolution we cannot classify is not a reason to alter the test's outcome */
    }
    return r;
  },
});

process.on("exit", () => {
  const obj = Object.fromEntries([...seen].sort().map(([k, v]) => [k, [...v].sort()]));
  fs.writeFileSync(OUT, JSON.stringify(obj, null, 1) + "\n");
  process.stderr.write(`[promised-deps-trace] ${Object.keys(obj).length} direct modules -> ${OUT}\n`);
});
