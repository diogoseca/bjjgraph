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
await build(JSON.parse(process.argv[2]), new Mutex(), () => {})
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

function runBuild(f, concurrency, output = "public") {
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
    [path.join(f.source, "run.mjs"), JSON.stringify(argv)],
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
