// Loads the REAL Quartz emitter modules so a plain `node --test` suite can assert on them.
//
// WHY THIS EXISTS AT ALL
// ---------------------
// `npm run test:units` is `node --test tests/*.test.mjs` — plain node, no TypeScript loader —
// and every emitter under `source/quartz/plugins/emitters/` is `.ts`/`.tsx` whose import graph
// reaches `.scss` (componentResources.ts imports `styles/custom.scss`) and `.inline.ts` client
// scripts. Neither loads under plain node, and `tsx` alone does not handle the `.scss`.
//
// The alternative — a regex or AST sweep over the source to read plugin names — is a SECOND
// IMPLEMENTATION written from the same reading of the code under test. It agrees with the code by
// construction and reports green on a build already broken (CLAUDE.md §6.3). So this probe loads
// the real modules and reads the real values off them instead.
//
// HOW
// ---
// It reuses the project's OWN esbuild configuration — `packages: "external"`, `platform: node`,
// `format: esm`, `jsx: automatic` with `jsxImportSource: preact`, `sassPlugin({type:"css-text",
// cssImports:true})`, and the `inline-script-loader` that transpiles `*.inline.ts` for the browser
// and hands it back as TEXT — so the module graph this probe loads is the module graph the build
// loads. That config is defined ONCE, in `scripts/emit_seam_capture.mjs`'s `bundleQuartzEntry`,
// which this file delegates to; it is copied from `source/quartz/cli/handlers.js` (`handleBuild`).
// Bundling costs ~2s and is cached per entry source for the lifetime of the process.
//
// Nothing is written inside the repository. The bundle lands in an OS temp directory carrying a
// `node_modules` symlink back to `source/node_modules`, so the `packages: "external"` bare
// specifiers still resolve at run time.
//
// WHAT THIS PROBE MAY AND MAY NOT BE USED FOR  (D-23, quartz-cto)
// --------------------------------------------------------------
// It runs the MAIN-THREAD transpile path, where `*.inline.ts` files carry their real transpiled
// script text. The build's WORKER path substitutes an empty string for them. Emission always runs
// on the main thread (`build.ts:95` calls `emitContent` in-process; only `parseMarkdown` fans out
// to workers), so for the emitter surface this probe is the right path. It is NOT the right path
// for a claim about bytes a worker parsed — never use it to report on callout-bearing page bytes
// as though they were the worker's.
//
// FAILURE POLICY
// --------------
// Every failure here throws. Nothing is skipped and nothing is caught and turned into an empty
// result: a probe that quietly returns nothing would make "the emitters are fine" and "the probe
// never ran" print the same thing, which is the single most repeated defect class in this repo
// (CLAUDE.md §6.6).

import { execFileSync } from "node:child_process"
import path from "node:path"
import { bundleQuartzEntry, REPO_ROOT, SOURCE_DIR } from "../scripts/emit_seam_capture.mjs"

export { REPO_ROOT, SOURCE_DIR }
export const EMITTER_DIR = path.join(SOURCE_DIR, "quartz", "plugins", "emitters")

/**
 * Bundle one TypeScript snippet against the real Quartz module graph. Cached by source text, so a
 * snippet that takes its parameters from the environment is bundled once per process.
 *
 * The esbuild configuration itself lives in `scripts/emit_seam_capture.mjs` and is shared with the
 * emit-seam capture: ONE copy of Quartz's own build config, two callers. A second copy here would
 * be the classic "when one question is answered in two places, one of them is already wrong".
 * @returns {string} path to the runnable ESM bundle
 */
export function bundleProbe(tsSource) {
  return bundleQuartzEntry(tsSource)
}

/**
 * Bundle (or reuse) and run one TypeScript snippet against the real Quartz module graph.
 *
 * The snippet must print exactly one line beginning `__JSON__` followed by JSON; that value is
 * returned. Anything else it writes to stdout is returned as `stdout` for diagnostics.
 *
 * @param {string} tsSource TypeScript source. Import the real modules by absolute path, e.g.
 *   `import config from ${JSON.stringify(path.join(SOURCE_DIR, "quartz.config"))}`.
 * @param {{ env?: Record<string,string>, cwd?: string }} [opts] extra environment for the run, so
 *   one cached bundle can be driven against many fixtures.
 * @returns {{ value: unknown, stdout: string }}
 */
export function probe(tsSource, opts = {}) {
  const out = bundleProbe(tsSource)
  const stdout = execFileSync(process.execPath, [out], {
    cwd: opts.cwd ?? SOURCE_DIR,
    env: { ...process.env, ...(opts.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 256 * 1024 * 1024,
  })

  const line = stdout.split("\n").find((l) => l.startsWith("__JSON__"))
  if (!line) {
    throw new Error(
      `_emitter_probe: the probe produced no __JSON__ line. stdout was:\n${stdout.slice(0, 4000)}`,
    )
  }
  return { value: JSON.parse(line.slice("__JSON__".length)), stdout }
}

/** Absolute-path import statement for a module under `source/`, for use inside probe snippets. */
export function importFromSource(name, spec) {
  return `import ${name} from ${JSON.stringify(path.join(SOURCE_DIR, spec))}`
}

/** Absolute-path named-import statement for a module under `source/`. */
export function importNamedFromSource(names, spec) {
  return `import { ${names.join(", ")} } from ${JSON.stringify(path.join(SOURCE_DIR, spec))}`
}
