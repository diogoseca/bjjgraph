// Runs the real Quartz build entry over a throwaway repository, never source/public or the
// authored corpus. Missing/malformed/empty graph input must fail instead of silently dropping
// page-graph-data. The success cases cover discovery, filtering, cleanup and worker transport.
// Fixture-only empty CSS/client-script loaders avoid testing presentation bundles here; bundle
// byte parity belongs to the whole-site emitter gates. The application components still render.
// RED observed before the fix: "real build fails when graph.json is missing" caught status 0
// after the incumbent entry parsed four inputs, filtered one draft and emitted seventeen files.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(REPO, "source");
const requireFromSource = createRequire(path.join(SOURCE, "package.json"));
const { build: bundle } = requireFromSource("esbuild");
const bundles = new Map();

test("actual CLI serializes overlapping source rebuild watcher lifetimes", async (t) => {
  // Retrospective RED on pre-fix 64c058b61: two overlapping source changes installed
  // watchers [1,2,3] but cleaned only [1], leaving [2,3] active. Real CLI control flow
  // runs below; compiler work, content watchers and network listeners are tiny fakes.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quartz-cli-watch-race-"));
  const stateKey = `__quartzCliWatchRace_${path.basename(root)}`;
  t.after(() => {
    delete globalThis[stateKey];
    fs.rmSync(root, { recursive: true, force: true });
  });
  const accessState = `globalThis[${JSON.stringify(stateKey)}]`;
  const cliPath = path.join(SOURCE, "quartz/cli/build.js");
  const source = fs.readFileSync(cliPath, "utf8");
  // The production CLI is unbundled. Preserve its native computed import in this test
  // bundle: esbuild otherwise substitutes a glob dispatcher before the fixture exists.
  // String(string) changes neither the import value nor the rebuild control flow.
  const importExpression =
    "import(`../../${cacheFile}?update=${randomUUID()}`)";
  assert.equal(
    source.split(importExpression).length,
    2,
    "expected exactly one CLI build import",
  );
  const bundleSource = source.replace(
    importExpression,
    "import(String(`../../${cacheFile}?update=${randomUUID()}`))",
  );
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const waitFor = async (predicate, label) => {
    const until = Date.now() + 3000;
    while (!predicate()) {
      assert.ok(Date.now() < until, `timed out waiting for ${label}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };
  let releaseFirstSourceBundle;
  const firstSourceBundle = new Promise((resolve) => {
    releaseFirstSourceBundle = resolve;
  });
  const state = (globalThis[stateKey] = {
    contexts: 0,
    mainBundles: 0,
    parseBundles: 0,
    installs: [],
    cleanup: [],
    active: new Set(),
    sourceChanged: undefined,
    async context() {
      const main = this.contexts++ === 0;
      return {
        async rebuild() {
          if (main) {
            state.mainBundles++;
            if (state.mainBundles === 2) await firstSourceBundle;
          } else {
            state.parseBundles++;
          }
          return { metafile: { outputs: {} } };
        },
        async dispose() {},
      };
    },
    async buildQuartz(_argv, mutex) {
      await mutex.runExclusive(tick);
      const id = this.installs.length + 1;
      this.installs.push(id);
      this.active.add(id);
      return async () => {
        this.cleanup.push(id);
        this.active.delete(id);
        await tick();
      };
    },
  });
  const stubs = {
    esbuild: `export default { context: (...args) => ${accessState}.context(...args) }`,
    chalk:
      "const color = (value) => value; for (const key of ['bgGreen', 'black', 'yellow', 'cyan', 'red', 'grey', 'green']) color[key] = color; export default color",
    "esbuild-sass-plugin": "export const sassPlugin = () => ({})",
    chokidar: `export default { watch() { return { on(_event, handler) { ${accessState}.sourceChanged = handler; return this } } } }`,
    "pretty-bytes": "export default (value) => String(value)",
    http: "export default { createServer() { return { listen() {} } } }",
    "serve-handler": "export default async () => {}",
    ws: "export class WebSocketServer { on() {} }",
    "./constants.js":
      "export const version = 'fixture'; export const fp = './quartz/build.ts'; export const cacheFile = 'quartz/.quartz-cache/transpiled-build.mjs'",
  };
  const out = path.join(root, "source/quartz/cli/build.mjs");
  await bundle({
    entryPoints: [cliPath],
    outfile: out,
    bundle: true,
    platform: "node",
    format: "esm",
    plugins: [
      {
        name: "actual-cli-with-lightweight-dependencies",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (Object.hasOwn(stubs, args.path)) {
              return { path: args.path, namespace: "probe-stub" };
            }
            if (args.path === "async-mutex") {
              return { path: requireFromSource.resolve("async-mutex") };
            }
          });
          build.onLoad({ filter: /.*/, namespace: "probe-stub" }, (args) => ({
            contents: stubs[args.path],
            loader: "js",
          }));
          build.onLoad({ filter: /quartz\/cli\/build\.js$/ }, () => ({
            contents: bundleSource,
            loader: "js",
            resolveDir: path.dirname(cliPath),
          }));
        },
      },
    ],
  });
  const entry = path.join(
    root,
    "source/quartz/.quartz-cache/transpiled-build.mjs",
  );
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(
    entry,
    `export default (...args) => ${accessState}.buildQuartz(...args)\n`,
  );
  const { handleBuild } = await import(pathToFileURL(out).href);
  await handleBuild({
    serve: true,
    output: path.join(root, "public"),
    port: 0,
    wsPort: 0,
    baseDir: "",
    bundleInfo: false,
  });
  assert.deepEqual(
    state.installs,
    [1],
    "initial build must install exactly one content watcher",
  );
  assert.equal(
    typeof state.sourceChanged,
    "function",
    "actual CLI must register its source callback",
  );
  state.sourceChanged();
  await waitFor(
    () => state.mainBundles === 2,
    "first source rebuild to reach delayed bundling",
  );
  assert.deepEqual(
    state.cleanup,
    [1],
    "first rebuild must clean the initial watcher",
  );
  state.sourceChanged();
  await tick();
  releaseFirstSourceBundle();
  await waitFor(
    () => state.installs.length === 3,
    "both source rebuilds to install their watchers",
  );
  await tick();
  assert.deepEqual(
    [...state.active],
    [3],
    "overlapping source changes must leave only the newest content watcher active",
  );
  assert.deepEqual(
    state.cleanup,
    [1, 2],
    "each replaced watcher must be cleaned exactly once",
  );
  assert.equal(state.mainBundles, 3);
  assert.equal(state.parseBundles, 3);
  console.log(
    "CLI watcher coverage: 1 initial build, 2 overlapping source changes, 3 watcher installations, 2 cleanups, 1 active watcher",
  );
});

before(async () => {
  await Promise.all(
    ["build", "worker"].map(async (entry) => {
      const result = await bundle({
        entryPoints: [path.join(SOURCE, "quartz", `${entry}.ts`)],
        bundle: true,
        write: false,
        outfile: `transpiled-${entry}.mjs`,
        sourcemap: true,
        sourcesContent: false,
        platform: "node",
        format: "esm",
        target: "node22",
        packages: "external",
        jsx: "automatic",
        jsxImportSource: "preact",
        plugins: [
          {
            name: "fixture-client-resources",
            setup(build) {
              build.onLoad({ filter: /\.scss$|\.inline\.(?:ts|js)$/ }, () => ({
                contents: "",
                loader: "text",
              }));
            },
          },
        ],
      });
      for (const output of result.outputFiles) {
        bundles.set(path.basename(output.path), output.contents);
      }
    }),
  );
});

const frontmatter = (title, extra = "") => `---
title: ${title}
date: 2024-01-02T03:04:05Z
lastmod: 2024-02-03T04:05:06Z
publishDate: 2024-01-02T03:04:05Z
${extra}---
`;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bjj-quartz-driver-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (relative, contents) => {
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, contents);
  };
  const source = path.join(root, "source");
  fs.mkdirSync(source);
  fs.symlinkSync(
    path.join(SOURCE, "node_modules"),
    path.join(source, "node_modules"),
    "dir",
  );
  for (const [name, bytes] of bundles) {
    put(`source/quartz/.quartz-cache/${name}`, bytes);
  }
  // Production emits through a distinct bundle with real CSS/client imports. Fixture stubs
  // are identical in both bundles, but their paths exercise the driver's actual selection.
  put(
    "source/quartz/.quartz-cache/transpiled-emit-worker.mjs",
    bundles.get("transpiled-worker.mjs"),
  );
  put(
    "source/quartz/.quartz-cache/transpiled-emit-worker.mjs.map",
    bundles.get("transpiled-worker.mjs.map"),
  );
  put(
    "source/run.mjs",
    `import build from "./quartz/.quartz-cache/transpiled-build.mjs"
import { Mutex } from "async-mutex"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
${emittedFiles.toString()}
const argv = JSON.parse(process.argv[2])
const rounds = Number(process.argv[3] ?? "1")
const mutex = new Mutex()
let firstOutput
for (let round = 0; round < rounds; round++) {
  await build(argv, mutex, () => {})
  if (rounds > 1) {
    const snapshot = new Map(emittedFiles(argv.output).map((file) => [file, fs.readFileSync(path.join(argv.output, file))]))
    assert.ok(snapshot.size > 0, "repeat comparison must cover emitted artifacts")
    if (round === 0) firstOutput = snapshot
    else assert.deepEqual(snapshot, firstOutput, "same-process rebuild changed emitted paths or bytes")
  }
}
if (rounds > 1) console.log("[repeat:coverage] rounds=" + rounds + " files=" + firstOutput.size)
`,
  );
  put(
    "content/index.md",
    ` \n\t${frontmatter("Trimmed fixture home")}\n# Home\n\n![[Positions/Mount#^fixture-block]]\n`,
  );
  put(
    "content/Positions/Mount.md",
    `${frontmatter("Mount", "tags: [fixture]\n")}\n# Mount\n\nCross-page fixture marker. ^fixture-block\n`,
  );
  put(
    "content/Positions/Mount/Top.md",
    `${frontmatter("Mount Top", "tags: [fixture]\n")}\n# Top\n\n[[Positions/Mount]]\n`,
  );
  put(
    "content/draft.md",
    `${frontmatter("Draft must not ship", "draft: true\n")}\nprivate draft marker\n`,
  );
  put(
    "content/.obsidian/secret.md",
    `${frontmatter("Hidden must not ship")}\nhidden marker\n`,
  );
  put(
    "content/.obsidian/plugins/obsidian-git/main.js",
    "hidden plugin must not ship\n",
  );
  // This directory is not named in the site's ignorePatterns: directory-level dot exclusion
  // must protect it too, independently of the .obsidian configuration entry.
  put(
    "content/.another-hidden/secret.md",
    `${frontmatter("Also hidden")}\nhidden marker\n`,
  );
  put(
    "content/.another-hidden/private.js",
    "another hidden asset must not ship\n",
  );
  put("content/visible.txt", "visible asset\n");
  put("source/quartz/static/icon.txt", "static fixture\n");
  // Static must finish before ContentIndex: its whole-directory copy contains an older copy.
  put(
    "source/quartz/static/contentIndex.json",
    JSON.stringify({ staleStaticIndex: true }),
  );
  put("source/public/old/deleted.html", "stale output must be removed\n");
  put(
    "graph.json",
    JSON.stringify({
      positions: {
        mount: {
          name: "Mount",
          path: "Mount",
          transitions: [],
          defenses: [],
          flashcards: [],
        },
        "mount/top": {
          name: "Mount Top",
          path: "Mount/Top",
          role: "top",
          transitions: [],
          defenses: [],
          flashcards: [],
        },
      },
      transitions: {},
      submissions: {},
      principles: {},
      systems: {},
    }),
  );
  // Lastmod discovers a real repository even when all date fields were authored. Fixed dates
  // keep serial/worker output comparison independent of filesystem timestamps and wall time.
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Quartz fixture");
  git("add", "content", "graph.json");
  git("commit", "-qm", "fixture inputs");
  return { root, source, put };
}

function runBuild(f, concurrency, output = "public", rounds = 1) {
  const argv = {
    directory: "../content",
    output,
    concurrency,
    verbose: true,
    serve: false,
    fastRebuild: false,
    port: 8080,
    wsPort: 3001,
  };
  const result = spawnSync(
    process.execPath,
    [path.join(f.source, "run.mjs"), JSON.stringify(argv), String(rounds)],
    {
      cwd: f.source,
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        POSTHOG_API_KEY: "",
        POSTHOG_API_HOST: "",
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
        SHOW_BREADCRUMBS: "true",
      },
    },
  );
  assert.ifError(result.error);
  assert.equal(result.signal, null, `build was killed by ${result.signal}`);
  return { ...result, log: `${result.stdout}\n${result.stderr}` };
}

function emittedFiles(directory, relative = "") {
  return fs
    .readdirSync(path.join(directory, relative), { withFileTypes: true })
    .flatMap((entry) => {
      const name = path.join(relative, entry.name);
      return entry.isDirectory() ? emittedFiles(directory, name) : [name];
    })
    .sort();
}

async function isolatedModule(t, options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bjj-quartz-seam-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.symlinkSync(
    path.join(SOURCE, "node_modules"),
    path.join(root, "node_modules"),
    "dir",
  );
  const output = path.join(root, "subject.mjs");
  await bundle({
    ...options,
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    jsx: "automatic",
    jsxImportSource: "preact",
    plugins: [
      ...(options.plugins ?? []),
      {
        name: "seam-client-resources",
        setup(build) {
          build.onLoad({ filter: /\.scss$|\.inline\.(?:ts|js)$/ }, () => ({
            contents: "",
            loader: "text",
          }));
        },
      },
    ],
  });
  return { root, module: await import(pathToFileURL(output).href) };
}

async function instrumentWorkerIdentity(f, mutant) {
  const emitNeedle = "    const tasks = sharded.flatMap((index) =>";
  const workerNeedle = "        resetRenderState()";
  const instrument = {
    name: "worker-identity-witness",
    setup(build) {
      build.onLoad({ filter: /\/processors\/emit\.ts$/ }, (args) => {
        let source = fs.readFileSync(args.path, "utf8");
        assert.equal(
          source.split(emitNeedle).length,
          2,
          "identity witness must match the real serialization site exactly once",
        );
        // Mutate via nodes reached from the live tree AFTER the parser has finished. The
        // transport and receiver must preserve that late mutation through the blocks alias.
        const mutation = `
    for (const [fixtureTree, fixtureFile] of content) {
      fixtureFile.data.fixtureUnknown = { nested: { owner: fixtureFile.data.slug, flag: true } }
      const walk = (node) => {
        const id = node.properties?.id
        if (id && Object.hasOwn(fixtureFile.data.blocks ?? {}, id)) {
          node.properties["data-fixture-late"] = "late:" + fixtureFile.data.slug + "#" + id
        }
        for (const child of node.children ?? []) walk(child)
      }
      walk(fixtureTree)
      ${mutant === "htmlAst" ? "fixtureFile.data.htmlAst = structuredClone(fixtureTree)" : ""}
      ${mutant === "blocks" ? `fixtureFile.data.blocks = Object.fromEntries(Object.entries(fixtureFile.data.blocks ?? {}).map(([id, node]) => [id, structuredClone(node)]))` : ""}
    }
`;
        source = source.replace(emitNeedle, mutation + emitNeedle);
        const corruptions = {
          missingTarget:
            "if (shard.content.length > shard.renderCount) shard.content.pop()",
          emptyShard: "shard.renderCount = 0",
          missingMetadata: "shard.allFiles.pop()",
          missingGuard: "shard.omittedTrees = []",
        };
        if (corruptions[mutant]) {
          const needle = "  const bytes = serialize(shard)";
          assert.equal(source.split(needle).length, 2);
          source = source.replace(
            needle,
            `  ${corruptions[mutant]}\n${needle}`,
          );
        }
        if (mutant === "fullCorpus") {
          const needle =
            "const resident = new Set(owned.map((_, offset) => start + offset))";
          assert.equal(source.split(needle).length, 2);
          source = source.replace(
            needle,
            needle +
              "\n    for (let index = 0; index < content.length; index++) resident.add(index)",
          );
        }
        return { contents: source, loader: "ts" };
      });
      build.onLoad({ filter: /\/quartz\/worker\.ts$/ }, (args) => {
        let source = fs.readFileSync(args.path, "utf8");
        if (mutant === "skippedTargetScan") {
          const scan = "visit(tuple[0], (node) => {";
          assert.equal(source.split(scan).length, 2);
          // In-memory bundle mutation only: the tracked worker is never rewritten.
          source = source.replace(scan, "if (false) " + scan);
        }
        assert.equal(
          source.split(workerNeedle).length,
          2,
          "identity witness must match the real restored-content receiver exactly once",
        );
        source =
          `import fixtureAssert from "node:assert/strict"
import { writeFileSync as fixtureWrite } from "node:fs"
import { join as fixtureJoin } from "node:path"
import { threadId as fixtureThreadId } from "node:worker_threads"
` + source;
        source = source.replace(
          workerNeedle,
          `
  if (init.phase === "emit") {
    ${mutant === "unknownRead" ? "void allFiles[shard.omittedTrees[0].index].htmlAst" : ""}
    const witness = { rendered: shard.renderCount, pages: 0, metadata: allFiles.length, blocks: 0, dates: 0, lateMutations: 0, guardedTrees: 0 }
    for (const [tree, file] of content) {
      fixtureAssert.ok(allFiles.includes(file.data), "resident tuple data must alias its roster entry")
      fixtureAssert.strictEqual(file.data.htmlAst, tree, "htmlAst must alias the live worker tree")
      witness.pages++
      const liveNodes = new Set()
      const walk = (node) => {
        liveNodes.add(node)
        for (const child of node.children ?? []) walk(child)
      }
      walk(tree)
      for (const [id, block] of Object.entries(file.data.blocks ?? {})) {
        fixtureAssert.ok(liveNodes.has(block), "block must alias a node in the live worker tree")
        fixtureAssert.equal(block.properties["data-fixture-late"], "late:" + file.data.slug + "#" + id)
        witness.blocks++
        witness.lateMutations++
      }
    }
    for (const data of allFiles) {
      fixtureAssert.deepEqual(data.fixtureUnknown, { nested: { owner: data.slug, flag: true } }, "unknown metadata remains eager")
      fixtureAssert.ok(data.frontmatter.title, "every metadata entry has its title")
      for (const key of ["created", "modified", "published"]) {
        fixtureAssert.ok(data.dates?.[key] instanceof Date, key + " must remain a Date in the emit worker")
        witness.dates++
      }
    }
    for (const { index, fields } of shard.omittedTrees) {
      for (const field of fields) {
        fixtureAssert.throws(() => allFiles[index][field], /Unplanned shard tree read/)
        witness.guardedTrees++
      }
    }
    fixtureAssert.ok(witness.blocks > 0, "the identity fixture must exercise an authored block")
    // Test witnesses stay outside public: they are not production emitter artifacts.
    fixtureWrite(fixtureJoin(ctx.argv.output, "..", "worker-identity-" + fixtureThreadId + ".json"), JSON.stringify(witness))
  }
` + workerNeedle,
        );
        return { contents: source, loader: "ts" };
      });
    },
  };
  // Leave the parse worker unchanged. Both main and emit-worker bundles below are the actual
  // implementation with observers added around its real V8/shared-buffer/restoreContent path.
  for (const [entry, output] of [
    ["build", "transpiled-build"],
    ["worker", "transpiled-emit-worker"],
  ]) {
    await bundle({
      entryPoints: [path.join(SOURCE, "quartz", entry + ".ts")],
      outfile: path.join(f.source, "quartz/.quartz-cache", output + ".mjs"),
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node22",
      packages: "external",
      sourcemap: true,
      sourcesContent: false,
      jsx: "automatic",
      jsxImportSource: "preact",
      plugins: [
        instrument,
        {
          name: "identity-fixture-client-resources",
          setup(build) {
            build.onLoad({ filter: /\.scss$|\.inline\.(?:ts|js)$/ }, () => ({
              contents: "",
              loader: "text",
            }));
          },
        },
      ],
    });
  }
}

test("real build fails when graph.json is missing", (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.root, "graph.json"));
  const result = runBuild(f);
  assert.notEqual(
    result.status,
    0,
    `missing graph must fail the build, received success:\n${result.log}`,
  );
  assert.match(
    result.log,
    /graph\.json/i,
    "failure must identify the graph input",
  );
});

test("real build fails for malformed and empty graph.json", async (t) => {
  for (const [name, graph] of [
    ["malformed", "{broken"],
    ["empty", "{}"],
    [
      "empty sections",
      JSON.stringify({
        positions: {},
        transitions: {},
        submissions: {},
        principles: {},
        systems: {},
      }),
    ],
  ]) {
    await t.test(name, (t) => {
      const f = fixture(t);
      f.put("graph.json", graph);
      const result = runBuild(f);
      assert.notEqual(
        result.status,
        0,
        `${name} graph must fail the build, received success:\n${result.log}`,
      );
      assert.match(
        result.log,
        /graph\.json/i,
        "failure must identify the graph input",
      );
    });
  }
});

test("real build preserves discovery, draft filtering, trim, transclusions and cleanup", (t) => {
  const f = fixture(t);
  const result = runBuild(f);
  assert.equal(result.status, 0, result.log);
  assert.match(
    result.log,
    /\[parse\] path=main concurrency=1 files=4/,
    "omitted concurrency must use the incumbent small-corpus main-thread default",
  );
  assert.match(result.log, /\[render:coverage\] rendered=8 graphPayloads=2/);
  const output = path.join(f.source, "public");
  const files = emittedFiles(output);
  assert.deepEqual(
    files.filter((name) => name.endsWith(".html")),
    [
      "404.html",
      "Positions/Mount.html",
      "Positions/Mount/Top.html",
      "Positions/Mount/index.html",
      "Positions/index.html",
      "index.html",
      "tags/fixture.html",
      "tags/index.html",
    ],
  );
  assert.ok(
    !files.some((name) => /obsidian|another-hidden|draft|deleted/.test(name)),
    files.join("\n"),
  );
  assert.equal(
    fs.readFileSync(path.join(output, "visible.txt"), "utf8"),
    "visible asset\n",
  );
  assert.equal(
    fs.readFileSync(path.join(output, "static/icon.txt"), "utf8"),
    "static fixture\n",
  );
  const home = fs.readFileSync(path.join(output, "index.html"), "utf8");
  assert.match(home, /<title>Trimmed fixture home<\/title>/);
  assert.match(
    home,
    /Cross-page fixture marker\./,
    "transclusion needs data from another parsed page",
  );
  assert.match(
    home,
    /window\.__rollPositions=\[\{"s":"Positions\/Mount\/Top","n":"Mount Top"\}\]/,
    "allFiles must include the complete published corpus",
  );
  const mount = fs.readFileSync(
    path.join(output, "Positions/Mount.html"),
    "utf8",
  );
  assert.match(mount, /id="page-graph-data"/);
  assert.match(
    mount,
    /property="article:modified_time" content="2024-02-03T04:05:06\.000Z"/,
  );
  const index = JSON.parse(
    fs.readFileSync(path.join(output, "static/contentIndex.json"), "utf8"),
  );
  assert.deepEqual(Object.keys(index).sort(), [
    "Positions/Mount",
    "Positions/Mount/Top",
    "index",
  ]);
  console.log(
    `Fixture coverage: ${files.length} emitted files; ${Object.keys(index).length} published sources; 1 cross-page transclusion`,
  );
});

test("real build emits identical bytes with one and two workers", (t) => {
  const f = fixture(t);
  const serial = runBuild(f, 1, "public-serial");
  assert.equal(serial.status, 0, serial.log);
  assert.match(serial.log, /\[parse\] path=main concurrency=1 files=4/);
  assert.match(serial.log, /\[render:coverage\] rendered=8 graphPayloads=2/);
  const parallel = runBuild(f, 2, "public-parallel");
  assert.equal(parallel.status, 0, parallel.log);
  assert.match(parallel.log, /\[parse\] path=workers concurrency=2 files=4/);
  assert.match(parallel.log, /\[emit\] path=workers concurrency=2 emitters=7/);
  assert.match(parallel.log, /\[render:coverage\] rendered=8 graphPayloads=2/);
  const serialRoot = path.join(f.source, "public-serial");
  const parallelRoot = path.join(f.source, "public-parallel");
  const files = emittedFiles(serialRoot);
  assert.deepEqual(emittedFiles(parallelRoot), files);
  assert.ok(
    files.length > 0,
    "byte parity must cover actual emitted artifacts",
  );
  for (const file of files) {
    assert.deepEqual(
      fs.readFileSync(path.join(parallelRoot, file)),
      fs.readFileSync(path.join(serialRoot, file)),
      `worker byte mismatch: ${file}`,
    );
  }
  console.log(
    `Worker transport coverage: ${files.length} byte-identical files at concurrency 1 and 2`,
  );
});

test("emit transport partitions trees before native worker hydration", (t) => {
  const f = fixture(t);
  const result = runBuild(f, 2);
  assert.equal(result.status, 0, result.log);
  const shards = [
    ...result.log.matchAll(
      /\[emit:hydrate:ready\] thread=\d+ renderPages=(\d+) residentPages=(\d+) metadataPages=(\d+)/g,
    ),
  ].map(([, render, resident, metadata]) => ({
    render: Number(render),
    resident: Number(resident),
    metadata: Number(metadata),
  }));
  assert.equal(
    shards.length,
    2,
    "both native workers must attest their actual hydrated shard",
  );
  assert.deepEqual(shards.map((s) => s.render).sort(), [1, 2]);
  assert.deepEqual(shards.map((s) => s.resident).sort(), [2, 2]);
  assert.ok(
    shards.every((s) => s.metadata === 3),
    "every shard needs the full metadata roster",
  );
  assert.equal(
    [...result.log.matchAll(/targets=1\/1 missing=0 inspectedTrees=2\/2 inspectedNodes=[1-9]\d* references=1 targetStatus=resolved/g)].length,
    1,
    "the cross-shard target must report an executed scan and a resolved reference",
  );
  console.log(
    "Shard coverage: 3 owned pages once; 4 resident trees including 1 cross-shard target; 3 metadata entries per worker (was 6 full trees)",
  );
});

test("four emit workers hydrate four owned trees, with a complete roll roster in each", (t) => {
  const f = fixture(t);
  f.put("content/index.md", `${frontmatter("Home")}\n# Home\n`);
  f.put(
    "content/Positions/Mount/Bottom.md",
    `${frontmatter("Mount Bottom", "tags: [fixture]\n")}\n# Bottom\n`,
  );
  const result = runBuild(f, 4);
  assert.equal(result.status, 0, result.log);
  assert.equal(
    [
      ...result.log.matchAll(
        /\[emit:hydrate:ready\] thread=\d+ renderPages=1 residentPages=1 metadataPages=4/g,
      ),
    ].length,
    4,
  );
  assert.match(
    result.log,
    /\[emit:coverage:plan\] owned=4\/4 shards=4 residentTuples=4 duplication=1\.000/,
  );
  // The corpus has no embeds: 0/0 alone cannot distinguish absence from a skipped
  // traversal. Pin every shard's executed scan and its explicit empty-set reason.
  assert.equal(
    [...result.log.matchAll(/targets=0\/0 missing=0 inspectedTrees=1\/1 inspectedNodes=[1-9]\d* references=0 targetStatus=none:no-transclusion-references/g)].length,
    4,
  );
  for (const page of [
    "index",
    "Positions/Mount",
    "Positions/Mount/Top",
    "Positions/Mount/Bottom",
  ]) {
    const html = fs.readFileSync(
      path.join(f.source, "public", page + ".html"),
      "utf8",
    );
    const roster = html.match(/window\.__rollPositions=(\[[^\n]*?\])/);
    assert.ok(roster, `${page}: roll roster must be present`);
    assert.deepEqual(
      JSON.parse(roster[1]).map((entry) => entry.s),
      ["Positions/Mount/Bottom", "Positions/Mount/Top"],
    );
  }
  console.log(
    "Four-worker coverage: 4 owned/resident trees total (old handoff 16); 4 eager metadata entries and complete 2-role roster in each worker",
  );
});

test("target coverage distinguishes no references from all references unresolved", (t) => {
  const f = fixture(t);
  f.put("content/index.md", `${frontmatter("Home")}\n![[absent-page]]\n`);
  const result = runBuild(f, 2);
  assert.equal(result.status, 0, result.log);
  assert.equal(
    [...result.log.matchAll(/targets=0\/0 missing=1 inspectedTrees=1\/1 inspectedNodes=[1-9]\d* references=1 targetStatus=none:all-references-unresolved/g)].length,
    1,
  );
  assert.equal(
    [...result.log.matchAll(/targets=0\/0 missing=0 inspectedTrees=2\/2 inspectedNodes=[1-9]\d* references=0 targetStatus=none:no-transclusion-references/g)].length,
    1,
  );
});

test("native target scan rejects a skipped traversal", async (t) => {
  const f = fixture(t);
  await instrumentWorkerIdentity(f, "skippedTargetScan");
  const result = runBuild(f, 2);
  assert.notEqual(result.status, 0, "unexecuted target scan must fail even without a target");
  // Either worker may report the first failure; its reachable set was not expanded
  // because the scan was skipped. Both possible ownership counts are explicit.
  assert.match(result.log, /transclusion scan incomplete: trees=(?:1\/1|2\/2) nodes=0/);
});

test("authored tag and folder-index routes keep incumbent overlapping-write behavior", (t) => {
  const f = fixture(t);
  f.put(
    "content/tags/fixture.md",
    `${frontmatter("Authored tag")}\n# Authored\n\nauthored tag description marker\n`,
  );
  f.put(
    "content/Extra/index.md",
    `${frontmatter("Authored folder")}\n# Folder\n\nauthored folder description marker\n`,
  );
  const serial = runBuild(f, 1, "public-serial");
  const parallel = runBuild(f, 4, "public-parallel");
  assert.equal(serial.status, 0, serial.log);
  assert.equal(parallel.status, 0, parallel.log);
  const a = path.join(f.source, "public-serial");
  const b = path.join(f.source, "public-parallel");
  const files = emittedFiles(a);
  assert.deepEqual(emittedFiles(b), files);
  for (const file of files)
    assert.deepEqual(
      fs.readFileSync(path.join(a, file)),
      fs.readFileSync(path.join(b, file)),
      file,
    );
  assert.match(parallel.log, /\[emit:plan\] shardEmitters=0 mainEmitters=7/);
  assert.match(
    fs.readFileSync(path.join(b, "tags/index.html"), "utf8"),
    /authored tag description marker/,
  );
  console.log(
    `Authored description coverage: ${files.length} byte-identical artifacts; overlapping tag/folder routes stay on main`,
  );
});

test("native emit workers preserve live AST, block identity and Dates", async (t) => {
  for (const mutant of [undefined, "htmlAst", "blocks"]) {
    await t.test(
      mutant ? `kills detached ${mutant} clone` : "real worker handoff",
      async (t) => {
        const f = fixture(t);
        await instrumentWorkerIdentity(f, mutant);
        const result = runBuild(f, 2);
        assert.match(
          result.log,
          /\[emit\] path=workers concurrency=2 emitters=7/,
        );
        if (mutant) {
          assert.notEqual(
            result.status,
            0,
            `detached ${mutant} clone survived the identity gate`,
          );
          assert.match(
            result.log,
            mutant === "htmlAst"
              ? /htmlAst must alias the live worker tree/
              : /block must alias a node in the live worker tree/,
          );
          console.log(
            `Identity mutant killed: detached ${mutant} clone; actual worker build exited ${result.status}`,
          );
        } else {
          assert.equal(result.status, 0, result.log);
          const witnesses = fs
            .readdirSync(f.source)
            .filter((name) => /^worker-identity-\d+\.json$/.test(name));
          assert.equal(
            witnesses.length,
            2,
            "both native emit workers must attest their reconstructed graph",
          );
          const records = witnesses.map((file) =>
            JSON.parse(fs.readFileSync(path.join(f.source, file), "utf8")),
          );
          assert.deepEqual(records.map((r) => r.rendered).sort(), [1, 2]);
          for (const { rendered, ...record } of records) {
            assert.deepEqual(record, {
              pages: 2,
              metadata: 3,
              blocks: 1,
              dates: 9,
              lateMutations: 1,
              guardedTrees: 2,
            });
          }
          console.log(
            "Worker identity coverage: 2 native emit workers; 3 owned pages once, 4 live-tree aliases, 2 block aliases, 18 metadata Dates, 2 late mutations, 4 guarded nonresident tree reads",
          );
        }
      },
    );
  }
});

test("native shard boundary rejects missing, extra and unplanned data", async (t) => {
  for (const [mutant, expected] of [
    ["missingTarget", /missing existing transclusion target/],
    [
      "emptyShard",
      /owned output identities must be nonempty|owned tuple count/,
    ],
    ["missingMetadata", /metadata roster length/],
    ["missingGuard", /missing omitted-tree descriptor/],
    ["fullCorpus", /extra resident tuple/],
    ["unknownRead", /Unplanned shard tree read/],
  ]) {
    await t.test(mutant, async (t) => {
      const f = fixture(t);
      await instrumentWorkerIdentity(f, mutant);
      const result = runBuild(f, 2);
      assert.notEqual(result.status, 0, `shard corruption survived: ${mutant}`);
      assert.match(result.log, expected, result.log);
      console.log(
        `Shard mutant killed: ${mutant}; actual native build exit ${result.status}`,
      );
    });
  }
});

test("shards retain cross-boundary heading, page and nested transclusion targets", (t) => {
  const f = fixture(t);
  f.put(
    "content/library/Target.md",
    `${frontmatter("Target")}\n# Intro\n\noutside selected heading\n\n## Selected\n\nheading target marker\n\n![[library/Nested]]\n\n## After\n\nnot inside selected heading\n`,
  );
  f.put(
    "content/library/Nested.md",
    `${frontmatter("Nested")}\n# Nested\n\nnested target marker\n`,
  );
  f.put(
    "content/library/Whole.md",
    `${frontmatter("Whole")}\n# Whole\n\nwhole page marker\n`,
  );
  f.put(
    "content/index.md",
    `${frontmatter("Reference home")}\n# Home\n\n![[Positions/Mount#^fixture-block]]\n\n![[library/Target#Selected]]\n\n![[library/Whole]]\n\n![[missing-target]]\n`,
  );
  const serial = runBuild(f, 1, "public-serial");
  const parallel = runBuild(f, 4, "public-parallel");
  assert.equal(serial.status, 0, serial.log);
  assert.equal(parallel.status, 0, parallel.log);
  assert.match(
    parallel.log,
    /\[emit:coverage:shard\].*targets=[1-9]\d*\/[1-9]\d*/,
  );
  assert.match(parallel.log, /\[emit:coverage:shard\].*missing=1/);
  const a = path.join(f.source, "public-serial");
  const b = path.join(f.source, "public-parallel");
  const files = emittedFiles(a);
  assert.deepEqual(emittedFiles(b), files);
  for (const file of files)
    assert.deepEqual(
      fs.readFileSync(path.join(a, file)),
      fs.readFileSync(path.join(b, file)),
      file,
    );
  const html = fs.readFileSync(path.join(b, "index.html"), "utf8");
  for (const marker of [
    "Cross-page fixture marker",
    "heading target marker",
    "nested target marker",
    "whole page marker",
  ]) {
    assert.ok(html.includes(marker), `transclusion missing: ${marker}`);
  }
  assert.ok(
    !html.includes("not inside selected heading"),
    "heading range must end at its next sibling heading",
  );
  console.log(
    `Transclusion closure coverage: ${files.length} byte-identical artifacts; block, heading, whole-page, nested and genuine-missing targets`,
  );
});

test("global main tag listings retain other pages' tags, titles, links and date ordering", (t) => {
  const f = fixture(t);
  // This fixture alone gives Top a later created date; the shared parity fixture stays fixed.
  // Without corpus-wide dates the alphabetical fallback would put Mount before Mount Top.
  f.put(
    "content/Positions/Mount/Top.md",
    `${frontmatter("Mount Top", "tags: [fixture]\n").replace(
      "date: 2024-01-02T03:04:05Z",
      "date: 2025-01-02T03:04:05Z",
    )}\n# Top\n\n[[Positions/Mount]]\n`,
  );
  const result = runBuild(f, 2);
  assert.equal(result.status, 0, result.log);
  assert.match(result.log, /\[emit\] path=workers concurrency=2 emitters=7/);
  const html = fs.readFileSync(
    path.join(f.source, "public/tags/fixture.html"),
    "utf8",
  );
  const lists = [...html.matchAll(/<ul class="section-ul">([\s\S]*?)<\/ul>/g)];
  assert.equal(
    lists.length,
    1,
    "the synthetic tag page must render exactly one PageList",
  );
  const entries = [
    ...lists[0][1].matchAll(/<li class="section-li">([\s\S]*?)<\/li>/g),
  ];
  assert.equal(
    entries.length,
    2,
    "both other source pages must retain their fixture tag",
  );
  const rows = entries.map(([, markup]) => {
    const link = markup.match(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/);
    const date = markup.match(/<p class="meta">([^<]+)<\/p>/);
    assert.ok(link, "each listed page needs a title and link");
    assert.ok(date, "each listed page needs its created date");
    return { title: link[2], href: link[1], date: date[1] };
  });
  assert.deepEqual(rows, [
    {
      title: "Mount Top",
      href: "../../Positions/Mount/Top",
      date: "Jan 02, 2025",
    },
    { title: "Mount", href: "../../Positions/Mount", date: "Jan 02, 2024" },
  ]);
  console.log(
    "Other-page metadata coverage: 1 synthetic tag page lists 2 source pages with titles, links and distinct dates in descending order",
  );
});

test("real build can clean and rebuild twice in one process", (t) => {
  const f = fixture(t);
  const result = runBuild(f, 1, "public", 2);
  assert.equal(result.status, 0, result.log);
  assert.equal(
    result.log.match(/\[render:coverage\] rendered=8 graphPayloads=2/g)?.length,
    2,
    "both builds must complete rendering over the full fixture",
  );
  assert.match(result.log, /\[repeat:coverage\] rounds=2 files=17/);
});

test("workerCount preserves incumbent default thresholds and explicit overrides", async () => {
  const result = await bundle({
    entryPoints: [path.join(SOURCE, "quartz/processors/workerPool.ts")],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    packages: "external",
  });
  const { workerCount } = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`
  );
  const thresholds = [
    [0, 1],
    [127, 1],
    [128, 1],
    [191, 1],
    [192, 2],
    [319, 2],
    [320, 3],
    [447, 3],
    [448, 4],
    [4600, 4],
  ];
  for (const [files, expected] of thresholds) {
    assert.equal(
      workerCount({}, files),
      expected,
      `default concurrency for ${files} files`,
    );
    for (const concurrency of [1, 4]) {
      assert.equal(
        workerCount({ concurrency }, files),
        concurrency,
        `explicit concurrency ${concurrency} must override the default for ${files} files`,
      );
    }
  }
  console.log(
    "Worker-count coverage: 10 default thresholds and 20 explicit overrides",
  );
});

test("main-thread emit starts phase-two emitters concurrently after shared outputs finish", async (t) => {
  const {
    module: { emitContent },
  } = await isolatedModule(t, {
    entryPoints: [path.join(SOURCE, "quartz/processors/emit.ts")],
  });
  const events = [];
  let componentsDone = false;
  let staticDone = false;
  let bStarted = false;
  const emitter = (name, emit) => ({
    name,
    emit,
    getQuartzComponents: () => [],
  });
  const emitters = [
    emitter("A", async () => {
      assert.ok(
        componentsDone && staticDone,
        "shared outputs must finish before A starts",
      );
      events.push("A:start");
      await Promise.resolve();
      assert.ok(
        bStarted,
        "B must start before A's pending asynchronous work completes",
      );
      events.push("A:end");
      return [];
    }),
    emitter("ComponentResources", async () => {
      events.push("ComponentResources:start");
      await Promise.resolve();
      componentsDone = true;
      events.push("ComponentResources:end");
      return [];
    }),
    emitter("B", async () => {
      assert.ok(
        componentsDone && staticDone,
        "shared outputs must finish before B starts",
      );
      events.push("B:start");
      bStarted = true;
      await Promise.resolve();
      events.push("B:end");
      return [];
    }),
    emitter("Static", async () => {
      assert.ok(
        componentsDone,
        "ComponentResources must finish before Static starts",
      );
      events.push("Static:start");
      await Promise.resolve();
      staticDone = true;
      events.push("Static:end");
      return [];
    }),
  ];
  await emitContent(
    {
      buildId: "overlap-fixture",
      allSlugs: [],
      argv: { concurrency: 1, serve: false, verbose: false, output: "unused" },
      cfg: {
        configuration: {},
        plugins: { transformers: [], filters: [], emitters },
      },
    },
    [],
  );
  assert.deepEqual(events.slice(0, 4), [
    "ComponentResources:start",
    "ComponentResources:end",
    "Static:start",
    "Static:end",
  ]);
  assert.ok(events.indexOf("B:start") < events.indexOf("A:end"));
  assert.ok(events.includes("A:end") && events.includes("B:end"));
  console.log(
    "Emit scheduling coverage: 2 ordered shared emitters and 2 overlapping main emitters",
  );
});

test("parseMarkdown ends its logger once on main and worker failure", async (t) => {
  const parsePath = path.join(SOURCE, "quartz/processors/parse.ts");
  const logPath = path.join(SOURCE, "quartz/util/log.ts");
  const poolPath = path.join(SOURCE, "quartz/processors/workerPool.ts");
  const {
    root,
    module: { parseMarkdown, events },
  } = await isolatedModule(t, {
    stdin: {
      contents: `export { parseMarkdown } from ${JSON.stringify(parsePath)};
export { events } from ${JSON.stringify(logPath)};`,
      loader: "ts",
      resolveDir: SOURCE,
    },
    plugins: [
      {
        name: "parser-lifecycle-observers",
        setup(build) {
          build.onLoad({ filter: /\/quartz\/util\/log\.ts$/ }, () => ({
            contents: `export const events = [];
export class QuartzLogger {
  start() { events.push("start") }
  end() { events.push("end") }
}`,
            loader: "js",
          }));
          // This case isolates lifecycle around a rejecting transport. Native-worker byte/date
          // transport is covered by the real-entry test above; it is deliberately not rerun here.
          build.onResolve({ filter: /^\.\/workerPool$/ }, (args) =>
            args.importer === parsePath
              ? { path: "worker-task-rejection", namespace: "fixture" }
              : undefined,
          );
          build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents: `export { workerCount } from ${JSON.stringify(poolPath)};
export async function runWorkerTasks() { throw new Error("fixture worker rejection") }`,
            loader: "js",
            resolveDir: SOURCE,
          }));
        },
      },
    ],
  });
  for (const concurrency of [1, 2]) {
    await t.test(`concurrency ${concurrency}`, async () => {
      events.length = 0;
      const ctx = {
        buildId: "logger-fixture",
        allSlugs: [],
        argv: { concurrency, directory: root, verbose: false },
        cfg: {
          configuration: {},
          plugins: { transformers: [], filters: [], emitters: [] },
        },
      };
      await assert.rejects(
        parseMarkdown(ctx, [path.join(root, "missing.md")]),
        concurrency === 1 ? /Failed to process/ : /fixture worker rejection/,
      );
      assert.deepEqual(
        events,
        ["start", "end"],
        "failure must stop the logger exactly once",
      );
    });
  }
});

test("actual CLI compiler keeps full main and emit resources but blank parse resources", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bjj-quartz-loaders-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "quartz"));
  fs.symlinkSync(
    path.join(SOURCE, "node_modules"),
    path.join(root, "node_modules"),
    "dir",
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ type: "module", version: "0.0.0" }),
  );
  const entry = `import script from "./probe.inline.ts"
import stylesheet from "./probe.scss"
export default { script, stylesheet }
`;
  fs.writeFileSync(path.join(root, "quartz/build.ts"), entry);
  fs.writeFileSync(path.join(root, "quartz/worker.ts"), entry);
  // If a loader starts executing client scripts during Node imports, the emitted modules fail
  // before assertions. Full bundles must carry this as text, while the parse bundle is empty.
  fs.writeFileSync(
    path.join(root, "quartz/probe.inline.ts"),
    'console.log("fixture-client-marker"); throw new Error("client-code-was-executed"); export default "";',
  );
  fs.writeFileSync(
    path.join(root, "quartz/probe.scss"),
    "$fixture-color: #2468ac;\n.fixture-marker { color: $fixture-color; }\n",
  );
  const script = `import assert from "node:assert/strict"
import path from "node:path"
import { pathToFileURL } from "node:url"
const { createBuildContexts } = await import(process.argv[1])
const { main, parse } = await createBuildContexts()
try {
  await main.rebuild()
  await parse.rebuild()
  const output = async (name) => (await import(pathToFileURL(path.resolve("quartz/.quartz-cache/" + name + ".mjs")).href)).default
  const mainOutput = await output("transpiled-build")
  const emitOutput = await output("transpiled-emit-worker")
  const parseOutput = await output("transpiled-worker")
  assert.match(mainOutput.script, /fixture-client-marker/)
  assert.match(mainOutput.stylesheet, /\\.fixture-marker\\s*\\{\\s*color:\\s*#2468ac;\\s*\\}/)
  assert.doesNotMatch(mainOutput.stylesheet, /\\$fixture-color/)
  assert.deepEqual(emitOutput, mainOutput)
  assert.deepEqual(parseOutput, { script: "", stylesheet: "" })
  console.log("Loader coverage: 3 real compiler outputs; 2 full resources and 2 blank parse resources")
} finally {
  await Promise.all([main.dispose(), parse.dispose()])
}
`;
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      script,
      pathToFileURL(path.join(SOURCE, "quartz/cli/build.js")).href,
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Loader coverage: 3 real compiler outputs/);
  console.log(result.stdout.trim());
});
