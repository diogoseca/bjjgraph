// One real scheduled driver run must produce all three seams. The four-file fixture exercises
// worker parsing, every configured transform boundary and four ContentPage shards; no standalone
// capture entry is invoked. Resource text is stubbed exactly as quartz_driver.test.mjs does:
// this proves observer boundaries and retention, not full-site client-bundle byte parity.
// Each fixture has its own committed content AND copied real source inputs. Its provenance is
// checked against that repository, never against the production corpus it did not parse.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { depsPromised, SOURCE_DEPS } from "./_deps_promised.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(REPO, "source");
const deps = depsPromised(import.meta.url, {
  ...SOURCE_DEPS,
  modules: ["esbuild"],
});
const { test, assert, require: requireFromSource } = deps;
const { build: bundle } = await deps.setup(() => requireFromSource("esbuild"));
const STAGES = [
  "01-text-ObsidianFlavoredMarkdown",
  "02-parse-remark-parse",
  "03-markdown-FrontMatter",
  "04-markdown-CreatedModifiedDate",
  "05-markdown-ObsidianFlavoredMarkdown",
  "06-markdown-GitHubFlavoredMarkdown",
  "07-markdown-TableOfContents",
  "08-bridge-remark-rehype",
  "09-html-SyntaxHighlighting",
  "10-html-ObsidianFlavoredMarkdown",
  "11-html-GitHubFlavoredMarkdown",
  "12-html-LinkProcessing",
  "13-html-SchemaExtractor",
  "14-html-Description",
];
const EMITTERS = [
  "404Page",
  "AliasRedirects",
  "Assets",
  "ComponentResources",
  "ContentIndex",
  "ContentPage",
  "FolderPage",
  "Static",
  "TagPage",
];
const frontmatter = (title, extra = "") => `---
title: ${title}
date: 2024-01-02T03:04:05Z
lastmod: 2024-02-03T04:05:06Z
publishDate: 2024-01-02T03:04:05Z
tags: [fixture]
${extra}---
`;

function files(root, relative = "") {
  return fs
    .readdirSync(path.join(root, relative), { withFileTypes: true })
    .flatMap((entry) => {
      const name = path.join(relative, entry.name);
      return entry.isDirectory() ? files(root, name) : [name];
    })
    .sort();
}

function readRecord(file) {
  const raw = fs.readFileSync(file);
  return JSON.parse(file.endsWith(".gz") ? gunzipSync(raw) : raw);
}

function command(program, args, cwd, options = {}) {
  const result = spawnSync(program, args, {
    cwd,
    encoding: "utf8",
    timeout: 90_000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `${program} killed: ${result.signal}`);
  return { ...result, log: `${result.stdout}\n${result.stderr}` };
}

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bjj-quartz-observer-"));
  t.after(() => {
    if (process.env.BJJ_KEEP_OBSERVER_FIXTURE === "1") {
      console.log(`observer fixture retained: ${root}`);
    } else {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  const put = (relative, data) => {
    const fp = path.join(root, relative);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, data);
  };
  fs.cpSync(path.join(SOURCE, "quartz"), path.join(root, "source/quartz"), {
    recursive: true,
    filter: (fp) => ![".quartz-cache", "static"].includes(path.basename(fp)),
  });
  for (const name of [
    "quartz.config.ts",
    "quartz.layout.ts",
    "tsconfig.json",
    "package.json",
  ]) {
    put(`source/${name}`, fs.readFileSync(path.join(SOURCE, name)));
  }
  // The build reads the REPO-ROOT package.json too: NeuralMount.tsx stamps the deploy's version into
  // /postscript.js (window.__NEURAL_BUILD, v1.205.1), so the fixture carries it where the build looks.
  put("package.json", fs.readFileSync(path.join(REPO, "package.json")));
  for (const name of ["seam_record.mjs", "emit_seam_capture.mjs"]) {
    put(`scripts/${name}`, fs.readFileSync(path.join(REPO, "scripts", name)));
  }
  put(
    "content/index.md",
    ` \n\t${frontmatter("Observer home", "aliases: [fixture-home]\n")}\n# Home\n\n![[Positions/Mount#^fixture-block]]\n`,
  );
  put(
    "content/Positions/Mount.md",
    `${frontmatter("Mount")}\n# Mount\n\nRetained transclusion marker. ^fixture-block\n`,
  );
  put(
    "content/Positions/Mount/Top.md",
    `${frontmatter("Mount Top")}\n# Top\n\n[[Positions/Mount]]\n`,
  );
  put(
    "content/Systems/Control.md",
    `${frontmatter("Control")}\n# Control\n\nA final fixture page.\n`,
  );
  put("content/visible.txt", "positive Assets output\n");
  put("source/quartz/static/fixture.txt", "positive Static output\n");
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
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Quartz observer fixture");
  git("add", "content", "graph.json", "source", "scripts");
  git("commit", "-qm", "exact observer fixture input tree");
  fs.symlinkSync(
    path.join(SOURCE, "node_modules"),
    path.join(root, "source/node_modules"),
    "dir",
  );
  const source = path.join(root, "source");
  // Sequential bundling bounds the fixture's peak; main/emit and parse keep separate entries.
  for (const entry of ["build", "worker"]) {
    await bundle({
      entryPoints: [path.join(source, "quartz", `${entry}.ts`)],
      outfile: path.join(
        source,
        "quartz/.quartz-cache",
        `transpiled-${entry}.mjs`,
      ),
      absWorkingDir: source,
      bundle: true,
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
  }
  fs.copyFileSync(
    path.join(source, "quartz/.quartz-cache/transpiled-worker.mjs"),
    path.join(source, "quartz/.quartz-cache/transpiled-emit-worker.mjs"),
  );
  put(
    "source/run.mjs",
    `import build from "./quartz/.quartz-cache/transpiled-build.mjs";
import { Mutex } from "async-mutex";
await build(JSON.parse(process.argv[2]), new Mutex(), () => {});
`,
  );
  return { root, source };
}

function runBuild(f, observed, output) {
  const env = {
    ...process.env,
    POSTHOG_API_KEY: "",
    POSTHOG_API_HOST: "",
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: "",
    AFFILIATE_REF: "",
    SHOW_BREADCRUMBS: "true",
    BJJ_CONTENT_RECEIPT: path.join(f.root, "capture.content.json"),
    BJJ_CAPTURE_ID: path.basename(f.root),
  };
  delete env.BJJ_PARSE_OBSERVER;
  delete env.BJJ_EMIT_LEDGER_DIR;
  if (observed) {
    env.BJJ_PARSE_OBSERVER = path.join(f.root, "seams/pipeline");
    env.BJJ_EMIT_LEDGER_DIR = path.join(f.root, "seams/emit-ledger");
  }
  return command(
    process.execPath,
    [
      path.join(f.source, "run.mjs"),
      JSON.stringify({
        directory: "../content",
        output,
        concurrency: 4,
        verbose: false,
        serve: false,
        fastRebuild: false,
        port: 8080,
        wsPort: 3001,
      }),
    ],
    f.source,
    { env },
  );
}

function contentReceipt(f, finish = false) {
  const script = `import json,sys
from hashlib import sha256
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from golden_provenance import begin_capture, finish_capture, output_identity
root = Path(sys.argv[2])
receipt = root / 'capture.content.json'
value = finish_capture(json.loads(receipt.read_text()), root) if sys.argv[3] == 'finish' else begin_capture(root, root.name)
if sys.argv[3] == 'finish':
    raw = root / 'seams/emit-ledger/raw-output'
    inventory = {p.relative_to(raw).as_posix(): {'size': p.stat().st_size, 'sha256': sha256(p.read_bytes()).hexdigest()} for p in raw.rglob('*') if p.is_file()}
    value.update(output_roots=[str(raw)], output_identity=output_identity(inventory))
receipt.write_text(json.dumps(value) + '\\n')
`;
  const result = command(
    "python3",
    [
      "-c",
      script,
      path.join(REPO, "scripts"),
      f.root,
      finish ? "finish" : "begin",
    ],
    f.root,
  );
  assert.equal(result.status, 0, result.log);
}

test("one scheduled worker build captures all three seams with checked provenance", async (t) => {
  const f = await fixture(t);
  contentReceipt(f);
  const result = runBuild(f, true, "observed-public");
  assert.equal(result.status, 0, result.log);
  // The canonical envelope remains capturing throughout the driver and raw emit join.
  // Finalize only after this SAME scheduled run completes; never stamp a historic artifact.
  contentReceipt(f, true);
  assert.match(result.log, /\[workers:parse\].*4\/4 jobs on 4 threads/);
  assert.match(result.log, /\[workers:emit\].*4\/4 jobs on 4 threads/);
  const pipeline = path.join(f.root, "seams/pipeline");
  const parse = files(path.join(pipeline, "parse"));
  const transform = files(path.join(pipeline, "transform"));
  const recordRoot = path.join(f.root, "seams/emit-ledger/records");
  const emitted = fs
    .readdirSync(recordRoot)
    .filter((name) => !name.startsWith("_") && name.endsWith(".json"))
    .sort();
  assert.equal(parse.length, 4, "exact discovered Markdown coverage");
  assert.equal(
    transform.length,
    4 * 14,
    "all configured boundaries for every input",
  );
  assert.deepEqual(
    emitted,
    EMITTERS.map((name) => `${name}.json`),
  );
  const readers = [];
  for (const name of parse) {
    const p = readRecord(path.join(pipeline, "parse", name));
    assert.equal(p.seam, "parse");
    assert.equal(p.provenance.mode.path, "worker-thread");
    assert.equal(
      p.data.source,
      fs.readFileSync(path.join(f.root, "content", p.key), "utf8"),
    );
    // Parse input is AFTER text transforms. OFM expands the embed's displayed alias,
    // so source.trim() alone is deliberately not the expected parser input.
    assert.ok(p.data.input.startsWith("---\n"));
    assert.equal(p.data.mdast.type, "root");
    assert.equal(p.data.mdast.children[0].type, "yaml");
    assert.ok(p.data.frontmatter.title.length > 0);
    let previous = null;
    for (const stage of STAGES) {
      const suffix = `${p.key}/${stage}.json.gz`;
      const r = readRecord(path.join(pipeline, "transform", suffix));
      assert.equal(r.provenance.mode.path, "worker-thread");
      assert.equal(r.data.stage, stage);
      assert.equal(r.data.previous, previous);
      if (stage.includes("-text-")) {
        assert.ok(r.data.text.length > 0);
        assert.equal(p.data.input, r.data.text);
      } else if (stage.includes("-parse-") || stage.includes("-markdown-")) {
        assert.equal(r.data.tree.type, "root");
        assert.ok(
          r.data.tree.children.every((child) => child.type !== "element"),
        );
      } else {
        assert.equal(r.data.tree.type, "root");
        assert.ok(
          r.data.tree.children.some((child) => child.type === "element"),
        );
      }
      previous = stage;
    }
  }
  const dateRecord = readRecord(
    path.join(
      pipeline,
      "transform",
      transform.find((name) =>
        name.includes("04-markdown-CreatedModifiedDate"),
      ),
    ),
  );
  assert.equal(
    dateRecord.data.file.data.dates.created.$date,
    "2024-01-02T03:04:05.000Z",
  );
  assert.equal(
    dateRecord.data.file.data.dates.modified.$date,
    "2024-02-03T04:05:06.000Z",
  );
  for (const record of [
    path.join(pipeline, "parse", parse[0]),
    path.join(pipeline, "transform", transform[0]),
    path.join(recordRoot, emitted[0]),
  ]) {
    const read = command(
      "python3",
      [
        path.join(REPO, "scripts/seam_golden.py"),
        "verify",
        "--golden",
        record,
        "--candidate",
        record,
        "--source-repo",
        f.root,
      ],
      REPO,
    );
    assert.equal(read.status, 0, read.log);
    assert.match(read.log, /CONTENT golden: MATCH/);
    assert.match(read.log, /PASS NO DIFFERENCES; compared=1/);
    readers.push(read.status);
  }
  const joined = command(
    process.execPath,
    [
      path.join(f.root, "scripts/emit_seam_capture.mjs"),
      "--check-provenance",
      recordRoot,
    ],
    f.root,
  );
  assert.equal(joined.status, 0, joined.log);
  assert.match(joined.log, /inputs UNCHANGED across all 10 parity roots/);
  const rawRoot = path.join(f.root, "seams/emit-ledger/raw-output");
  const raw = new Map(
    files(rawRoot).map((name) => [
      name,
      fs.readFileSync(path.join(rawRoot, name)),
    ]),
  );
  assert.ok(raw.size > 0);
  assert.deepEqual(files(path.join(f.source, "observed-public")), [
    ...raw.keys(),
  ]);
  const claimed = new Map();
  for (const name of emitted) {
    const record = readRecord(path.join(recordRoot, name));
    assert.equal(record.provenance.output_root, rawRoot);
    assert.equal(record.provenance.output_root_retained, true);
    assert.equal(record.coverage.emitter_runs, 1);
    assert.equal(record.coverage.files, Object.keys(record.data.files).length);
    assert.ok(record.coverage.files > 0, `${name}: positive fixture output`);
    for (const [relative, fingerprint] of Object.entries(record.data.files)) {
      assert.equal(
        claimed.has(relative),
        false,
        `${relative}: competing emitters`,
      );
      claimed.set(relative, record.key);
      const bytes = raw.get(relative);
      assert.ok(
        bytes,
        `${relative}: claimed output must exist in retained census`,
      );
      assert.equal(bytes.length, fingerprint.size);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        fingerprint.sha256,
      );
    }
  }
  assert.deepEqual(
    [...claimed.keys()].sort(),
    [...raw.keys()],
    "attributed union must equal the entire retained raw tree",
  );
  const sample = [...raw.keys()].find((name) => name.endsWith(".html"));
  assert.ok(sample, "positive retained HTML witness");
  fs.writeFileSync(
    path.join(f.source, "observed-public", sample),
    "post-processor overwrite\n",
  );
  assert.deepEqual(
    fs.readFileSync(path.join(rawRoot, sample)),
    raw.get(sample),
    "retained raw bytes must survive in-place post-processing",
  );
  fs.writeFileSync(
    path.join(f.source, "observed-public", sample),
    raw.get(sample),
  );
  assert.deepEqual(
    fs.readFileSync(path.join(f.source, "observed-public", sample)),
    raw.get(sample),
    "fixture output restoration must restore the original bytes",
  );
  console.log(
    `observer coverage: parse=${parse.length}, transform=${transform.length}, boundaries=${STAGES.length}, emit=${emitted.length}, reader exits=${readers.join(",")}/${joined.status}, retained files=${raw.size}, retained overwrite witnesses=1`,
  );
});
