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
