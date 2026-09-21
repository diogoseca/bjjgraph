// Real Git histories exercise the shared driver index. RED controls: missing sibling,
// add-only history, author/committer confusion, oldest-as-latest, repeated cold walks,
// and fabricated unknown dates. Merge resolutions are pinned explicitly: the batched
// map includes them; the native modified reader does not. Since D-195 / D-208 (v1.195.8)
// the transformer's git tier READS the batched map for unflagged paths and DEFERS to the
// native per-file reader for merge-flagged ones; both directions are pinned below.
// Sparse merge-origin flags identify ONLY the selected modified entry, not any older
// merge in a path's history. RED controls also cover missing/stale flags and lost driver /
// worker propagation. A flagged path must never take the batched value: that is what keeps
// the owner's merge-resolution dates (Kimura, Americana) untouched.
// This does not assert universal equivalence to libgit2 on arbitrary merged histories.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { depsPromised, SOURCE_DEPS } from "./_deps_promised.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// source/node_modules is PROMISED by ci-validate.yml (v1.195.9). Under CI an absent module
// fails this file on this line with the install step named; at home it skips every case
// below with the same reason, and the count line at the end says what ran.
// THE MANIFEST IS WHAT THE TRANSFORMER PATH RESOLVES, NOT WHAT THIS FILE IMPORTS (v1.195.12).
// This file requires two packages; lastmod.ts, the util modules, parse.ts and the bundled
// worker resolve twelve more, none of which a grep of tests/ can see. Listing only the two let
// a partial install fail INSIDE a case with a raw module error instead of being named here.
// Traced at runtime (direct resolutions from non-node_modules code); recompute with
//   TRACE_OUT=/tmp/t.json node --import tests/artifacts/_promised_deps_trace.mjs tests/git_date_maps.test.mjs
const deps = depsPromised(import.meta.url, {
  ...SOURCE_DEPS,
  modules: [
    "tsx/esm/api", "esbuild", // this file
    "@napi-rs/simple-git", "chalk", "github-slugger", "rfdc", // lastmod.ts, util/path.ts
    "cli-spinner", "pretty-time", "workerpool", // util/log.ts, util/perf.ts, util/trace.ts
    "remark-parse", "remark-rehype", "to-vfile", "unified", // processors/parse.ts
    "source-map-support", // the bundled worker
  ],
});
const { test, assert, require } = deps;
const opts = {
  parentURL: import.meta.url,
  tsconfig: path.join(ROOT, "source/tsconfig.json"),
};
const { tsImport, api, CreatedModifiedDate } = await deps.setup(async () => {
  const { tsImport } = require("tsx/esm/api");
  const api = await tsImport("../source/quartz/util/publication.ts", opts);
  const { CreatedModifiedDate } = await tsImport(
    "../source/quartz/plugins/transformers/lastmod.ts",
    opts,
  );
  return { tsImport, api, CreatedModifiedDate };
});
const gitBinary = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
const iso = (year) => `${year}-02-03T04:05:06.000Z`;
function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "git-date-maps-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync(gitBinary, args, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Date Fixture");
  git("config", "user.email", "fixture@example.invalid");
  fs.mkdirSync(path.join(cwd, "content"));
  fs.mkdirSync(path.join(cwd, "source"));
  const write = (name, text) =>
    fs.writeFileSync(path.join(cwd, "content", name), text);
  const commit = (name, author, committer = author) => {
    git("add", "--all");
    execFileSync(gitBinary, ["commit", "-qm", name], {
      cwd,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: iso(author),
        GIT_COMMITTER_DATE: iso(committer),
      },
    });
  };
  return { cwd, git, write, commit };
}
function mergedFixture(t) {
  const f = fixture(t);
  f.write("Note.md", "base\n");
  f.write("Other.md", "untouched\n");
  f.commit("base", 2020);
  f.git("checkout", "-b", "side");
  f.write("Note.md", "side\n");
  f.commit("side", 2021);
  f.git("checkout", "main");
  f.write("Note.md", "main\n");
  f.commit("main", 2022);
  assert.throws(() => f.git("merge", "--no-ff", "side"));
  f.write("Note.md", "resolved\n");
  f.commit("resolve", 2023);
  return f;
}

async function maps(cwd) {
  assert.equal(
    typeof api.gitDateMaps,
    "function",
    "the shared collector must expose both maps",
  );
  return api.gitDateMaps(cwd);
}

test("latest modifications include M-only commits and use committer dates without changing publication", async (t) => {
  const f = fixture(t);
  const name = " spaced\tname.md";
  f.write(name, "original\n");
  f.commit("add", 2020, 2021);
  f.write(name, "edited\n");
  f.commit("edit with older author date", 2019, 2023);
  f.write("untracked.md", "unknown\n");
  const result = await maps(f.cwd);
  assert.deepEqual(result.published, { [`content/${name}`]: iso(2020) });
  assert.deepEqual(result.modified, { [`content/${name}`]: iso(2023) });
  // Even a clock-skewed descendant is the last commit, not the maximum timestamp.
  f.write(name, "edited again\n");
  f.commit("backdated committer", 2018, 2022);
  const next = await maps(f.cwd);
  assert.equal(next.modified[`content/${name}`], iso(2022));
  assert.equal(next.published[`content/${name}`], iso(2020));
  // D-195 / D-208: the git tier now READS the batched sibling. An UNFLAGGED path with a
  // batched value present takes that value; the 1999 sentinel is read, not ignored. Until
  // v1.195.8 this assertion expected iso(2022), the native value, as a tripwire for exactly
  // this migration; the migration is the explicit act it was waiting for.
  const unflagged = {
    cwd: path.join(f.cwd, "source"),
    data: { filePath: `../content/${name}` },
  };
  await CreatedModifiedDate().markdownPlugins({
    gitPublicationDates: next.published,
    gitModifiedDates: { [`content/${name}`]: iso(1999) },
  })[0]()({}, unflagged);
  assert.equal(
    unflagged.data.dates.modified.toISOString(),
    iso(1999),
    "an unflagged path with a batched value present takes the batched value",
  );
  // The reverse tripwire, the direction that still matters: the SAME path flagged as a
  // merge-origin entry must NOT take the batched value. It defers to the native reader.
  const flagged = {
    cwd: path.join(f.cwd, "source"),
    data: { filePath: `../content/${name}` },
  };
  await CreatedModifiedDate().markdownPlugins({
    gitPublicationDates: next.published,
    gitModifiedDates: { [`content/${name}`]: iso(1999) },
    gitModifiedDatesFromMerge: { [`content/${name}`]: true },
  })[0]()({}, flagged);
  assert.equal(
    flagged.data.dates.modified.toISOString(),
    iso(2022),
    "a merge-flagged path must never take the batched value; it defers to the native reader",
  );
});

test("rename/copy publication lineage stays oldest while modifications retain each current path's last commit", async (t) => {
  const f = fixture(t);
  const body = Array.from(
    { length: 50 },
    (_, i) => `original line ${i}\n`,
  ).join("");
  f.write("Old.md", body);
  f.commit("add", 2020, 2021);
  f.git("mv", "content/Old.md", "content/Renamed.md");
  f.commit("rename", 2022);
  f.write("Copied.md", body);
  f.commit("copy unchanged source", 2023);
  f.write("Renamed.md", body + "later edit\n");
  f.commit("modify only", 2024);
  const result = await maps(f.cwd);
  assert.deepEqual(result.published, {
    "content/Renamed.md": iso(2020),
    "content/Copied.md": iso(2020),
  });
  assert.deepEqual(result.modified, {
    "content/Renamed.md": iso(2024),
    "content/Copied.md": iso(2023),
  });
});

test("merge does not restamp unchanged files but records a resolution that changes both parents", async (t) => {
  const f = mergedFixture(t);
  const result = await maps(f.cwd);
  assert.equal(result.modified["content/Note.md"], iso(2023));
  assert.equal(result.modified["content/Other.md"], iso(2020));
  assert.equal(result.published["content/Note.md"], iso(2020));
  assert.deepEqual(result.modifiedFromMerge, { "content/Note.md": true });
  f.write("Note.md", "later non-merge edit\n");
  f.commit("edit after resolution", 2024);
  const later = await maps(f.cwd);
  assert.equal(later.modified["content/Note.md"], iso(2024));
  assert.equal(later.published["content/Note.md"], iso(2020));
  assert.deepEqual(
    later.modifiedFromMerge,
    {},
    "an older merge must not flag a newer non-merge date",
  );
});

test("concurrent driver and legacy getters share exactly one history walk and one copy-detection batch", async (t) => {
  const f = fixture(t);
  f.write("Note.md", "note\n");
  f.commit("add", 2020);
  const bin = path.join(f.cwd, "bin"),
    trace = path.join(f.cwd, "calls.jsonl");
  fs.mkdirSync(bin);
  const wrapper = `#!${process.execPath}\nimport fs from 'node:fs';import {spawnSync} from 'node:child_process';\nconst args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify(args)+'\\n');const r=spawnSync(${JSON.stringify(gitBinary)},args,{stdio:'inherit'});process.exit(r.status??1);\n`;
  fs.writeFileSync(path.join(bin, "package.json"), '{"type":"module"}');
  fs.writeFileSync(path.join(bin, "git"), wrapper, { mode: 0o755 });
  const oldPath = process.env.PATH;
  process.env.PATH = bin + path.delimiter + oldPath;
  try {
    assert.equal(
      typeof api.gitModifiedDates,
      "function",
      "sibling getter must share the cache",
    );
    assert.equal(
      typeof api.gitModifiedDatesFromMerge,
      "function",
      "merge-origin getter must share the cache",
    );
    const [both, published, modified, modifiedFromMerge] = await Promise.all([
      maps(f.cwd),
      api.gitPublicationDates(f.cwd),
      api.gitModifiedDates(f.cwd),
      api.gitModifiedDatesFromMerge(f.cwd),
    ]);
    assert.strictEqual(published, both.published);
    assert.strictEqual(modified, both.modified);
    assert.strictEqual(modifiedFromMerge, both.modifiedFromMerge);
    const calls = fs
      .readFileSync(trace, "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(
      calls.filter((args) => args.includes("log")).length,
      1,
      "one graph walk across all getters",
    );
    assert.equal(
      calls.filter((args) => args.includes("diff-tree")).length,
      1,
      "one batched rename/copy pass",
    );
  } finally {
    process.env.PATH = oldPath;
  }
});

test("shallow, unavailable and unborn history supplies neither date map", async (t) => {
  const f = fixture(t);
  assert.deepEqual(await maps(f.cwd), {
    published: {},
    modified: {},
    modifiedFromMerge: {},
  });
  f.write("Note.md", "note\n");
  f.commit("base", 2020);
  f.write("Note.md", "edited\n");
  f.commit("later", 2021);
  const shallow = path.join(f.cwd, "shallow");
  f.git("clone", "--depth=1", `file://${f.cwd}`, shallow);
  assert.deepEqual(await maps(shallow), {
    published: {},
    modified: {},
    modifiedFromMerge: {},
  });
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "no-git-dates-"));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  assert.deepEqual(await maps(outside), {
    published: {},
    modified: {},
    modifiedFromMerge: {},
  });
});

test("driver preparation exposes both maps and merge-origin flags to a real Markdown plugin", async (t) => {
  const f = mergedFixture(t);
  const { parseMarkdown } = await tsImport(
    "../source/quartz/processors/parse.ts",
    opts,
  );
  const observer = {
    name: "CreatedModifiedDate",
    markdownPlugins: (ctx) => [
      () => (_tree, file) => {
        file.data.seen = {
          published: ctx.gitPublicationDates,
          modified: ctx.gitModifiedDates,
          modifiedFromMerge: ctx.gitModifiedDatesFromMerge,
        };
      },
    ],
  };
  const ctx = {
    buildId: "date-fixture",
    allSlugs: [],
    argv: {
      directory: path.join(f.cwd, "content"),
      concurrency: 1,
      verbose: false,
    },
    cfg: { plugins: { transformers: [observer] } },
  };
  const result = await parseMarkdown(ctx, [
    path.join(f.cwd, "content/Note.md"),
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0][1].data.seen, {
    published: { "content/Note.md": iso(2020), "content/Other.md": iso(2020) },
    modified: { "content/Note.md": iso(2023), "content/Other.md": iso(2020) },
    modifiedFromMerge: { "content/Note.md": true },
  });
});

test("real worker forwards the seventh merge-origin map and accepts old five/six argument calls", async (t) => {
  const f = fixture(t);
  f.write("Note.md", "# Note\n");
  // Replace only site configuration, so the real worker, processor and file parser run.
  // The observer reads the same BuildCtx seam that production plugins receive.
  const temp = fs.mkdtempSync(path.join(ROOT, "source/.date-worker-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const outfile = path.join(temp, "worker.mjs");
  await require("esbuild").build({
    entryPoints: [path.join(ROOT, "source/quartz/worker.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    plugins: [
      {
        name: "fixture-config",
        setup(build) {
          build.onResolve({ filter: /quartz\.config$/ }, () => ({
            path: "fixture-config",
            namespace: "fixture",
          }));
          build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents: `export default {plugins:{transformers:[{name:'Observer',markdownPlugins:ctx=>[()=> (_tree,file)=>{file.data.seen={published:ctx.gitPublicationDates,modified:ctx.gitModifiedDates,modifiedFromMerge:ctx.gitModifiedDatesFromMerge}}]}]}}`,
          }));
        },
      },
    ],
  });
  const { parseFiles } = await import(outfile);
  const argv = { directory: path.join(f.cwd, "content"), verbose: false };
  const paths = [path.join(f.cwd, "content/Note.md")];
  const published = { "content/Note.md": iso(2020) },
    modified = { "content/Note.md": iso(2021) };
  const result = await parseFiles(
    "fixture",
    argv,
    paths,
    [],
    published,
    modified,
  );
  assert.deepEqual(result[0][1].data.seen, {
    published,
    modified,
    modifiedFromMerge: undefined,
  });
  const legacy = await parseFiles("fixture", argv, paths, [], published);
  assert.deepEqual(legacy[0][1].data.seen, {
    published,
    modified: undefined,
    modifiedFromMerge: undefined,
  });
  const modifiedFromMerge = { "content/Note.md": true };
  const flagged = await parseFiles(
    "fixture",
    argv,
    paths,
    [],
    published,
    modified,
    modifiedFromMerge,
  );
  assert.deepEqual(flagged[0][1].data.seen, {
    published,
    modified,
    modifiedFromMerge,
  });
});
