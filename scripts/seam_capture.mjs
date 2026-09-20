#!/usr/bin/env node
/**
 * Observe the incumbent's real parse/transform boundaries without a site build.
 *
 * node scripts/seam_capture.mjs parse --out /path/to/seams [--file Positions/Mount.md]
 *   [--file ...] [--limit N] [--plain] [--mutant no-trim|yaml-default]
 *
 * All inputs and ctx.allSlugs come from the incumbent's own glob/config. The actual
 * createProcessor/createFileParser entry points run; appended observer plugins only
 * serialize what they received. Raw parse is mdast. Markdown plugins produce mdast,
 * then remark-rehype produces hast, then HTML plugins produce hast, in actual phase
 * order. Calling a markdown-stage snapshot "hast" would invent a boundary Quartz
 * does not have. Each snapshot names its phase and predecessor. Parse records carry
 * frontmatter plus the raw mdast; transform records carry VFile.data and the tree.
 * Dates/undefined are explicitly tagged, not normalized. Filesystem timestamps and
 * source hashes are captured as inputs because CreatedModifiedDate consumes them.
 *
 * Each .json.gz is independent; seam_golden.py verify reads just the selected record.
 * The data object is the candidate interchange format; tagged Date = {$date: ISO},
 * tagged undefined = {$undefined: true}. Object key order is not an AST contract;
 * array order, positions and all values are. No normalization is permitted.
 *
 * Partially pinned: --selftest in seam_golden_selftest.py covers render records;
 * pipeline red proofs are in emit_mutation_test.py. A one-file/boundary pass does
 * not prove siblings, final render bytes, emitter scheduling, browser behavior or
 * keyed deployment. This parse-only bundle deliberately empties CSS/inline-script
 * imports like the incumbent parse worker; it MUST NOT be used to render/emit.
 * --mutant modifies only the temporary bundle, never product source or goldens.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { Worker, isMainThread, workerData, parentPort, threadId } from 'node:worker_threads';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'source');
const sourceRequire = createRequire(new URL('../source/package.json', import.meta.url));
const { build } = sourceRequire('esbuild');
const args = process.argv.slice(2);
const value = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const sha = x => createHash('sha256').update(x).digest('hex');
const filesWanted = args.flatMap((v, i) => v === '--file' ? [args[i + 1]] : []);
const output = value('--out') && path.resolve(value('--out'));
const mutant = value('--mutant');
const compressed = !args.includes('--plain');
const NativeDate = Date;
const maxBytes = Number(value('--max-bytes') || 10 * 1024 ** 3);
const budget = workerData ? new BigInt64Array(workerData.budget) : null;

function serial(value) {
  if (value === undefined) return { $undefined: true };
  if (value instanceof NativeDate) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(serial);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, serial(value[k])]));
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') throw new Error(`unsupported seam value: ${typeof value}`);
  return value;
}

function countNodes(tree) {
  let n = 0;
  function walk(v) {
    if (!v || typeof v !== 'object') return;
    if (typeof v.type === 'string') n++;
    for (const child of v.children || []) walk(child);
  }
  walk(tree);
  return n;
}

async function main() {
  if (args[0] !== 'parse' || !output) throw new Error('usage: seam_capture.mjs parse --out DIR [--file RELATIVE.md] [--limit N]');
  if (mutant && !['no-trim', 'yaml-default'].includes(mutant)) throw new Error('unknown mutant');
  const start = performance.now();
  if (isMainThread) process.chdir(source);
  // These are inputs, not normalization: the captured incumbent config is keyless.
  // Refuse an ambient keyed run instead of silently changing its environment.
  for (const key of ['POSTHOG_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'AFFILIATE_REF']) {
    if (process.env[key]) throw new Error(`keyless parse capture requires ${key} unset`);
  }
  const bundleDir = path.join(source, 'quartz/.quartz-cache');
  mkdirSync(bundleDir, { recursive: true });
  const bundle = path.join(bundleDir, `seam-capture-${process.pid}-${threadId}.mjs`);
  let mutations = 0;
  try {
    const compiled = await build({
      stdin: { contents: 'export {default as cfg} from "./quartz.config"; export {createProcessor, createFileParser} from "./quartz/processors/parse"; export {glob} from "./quartz/util/glob"; export {slugifyFilePath} from "./quartz/util/path";', resolveDir: source, loader: 'ts' },
      absWorkingDir: source, outfile: bundle, bundle: true, keepNames: true, platform: 'node', format: 'esm', packages: 'external',
      tsconfig: path.join(source, 'tsconfig.json'), metafile: true,
      plugins: [{ name: 'seam-observation-bundle', setup(b) {
        b.onLoad({ filter: /\.(scss|inline\.(ts|js))$/ }, () => ({ contents: '', loader: 'text' }));
        if (mutant) b.onLoad({ filter: /(?:processors\/parse|transformers\/frontmatter)\.ts$/ }, a => {
          let text = readFileSync(a.path, 'utf8');
          const before = mutant === 'no-trim' ? 'file.value.toString().trim()' : 'yaml.JSON_SCHEMA';
          const after = mutant === 'no-trim' ? 'file.value.toString()' : 'yaml.DEFAULT_SCHEMA';
          if (text.includes(before)) { text = text.replace(before, after); mutations++; }
          return { contents: text, loader: 'ts' };
        });
      } }],
    });
    if (mutant && mutations !== 1) throw new Error(`mutation coverage=${mutations}; expected 1`);
    const incumbent = await import(pathToFileURL(bundle).href);
    const { cfg, createProcessor, createFileParser, glob, slugifyFilePath } = incumbent;
    const allFiles = workerData?.allFiles || await glob('**/*.*', '../content', cfg.configuration.ignorePatterns);
    if (workerData?.discover) { parentPort.postMessage({ allFiles }); return; }
    const allMarkdown = allFiles.filter(f => f.endsWith('.md')).sort();
    let selected = filesWanted.length ? [...new Set(filesWanted)].sort() : allMarkdown;
    for (const f of selected) if (!allMarkdown.includes(f)) throw new Error(`selected file absent from incumbent glob: ${f}`);
    const limit = value('--limit');
    if (limit !== undefined) {
      if (!/^\d+$/.test(limit) || Number(limit) < 1) throw new Error('--limit must be positive');
      selected = selected.slice(0, Number(limit));
    }
    // Match production chunk size; each worker retains its own transformer closures.
    if (workerData) selected = selected.filter((_f, i) => Math.floor(i / 128) % workerData.concurrency === workerData.slot);
    // A small explicit-concurrency probe still exercises every actual worker.
    if (workerData?.probe) {
      const selection = filesWanted.length ? [...new Set(filesWanted)].sort() : allMarkdown.slice(0, Number(limit));
      selected = selection.filter((_f, i) => i % workerData.concurrency === workerData.slot);
    }
    if (!selected.length || !allFiles.length) throw new Error('zero files/slugs selected');
    const ctx = { buildId: 'seam-capture', argv: { directory: '../content', output: 'public', verbose: false, concurrency: workerData?.concurrency || 1, serve: false, fastRebuild: false }, cfg, allSlugs: allFiles.map(fp => slugifyFilePath(fp)) };
    const sourceHashes = Object.fromEntries(Object.keys(compiled.metafile.inputs).filter(f => f !== '<stdin>').sort().map(f => [path.relative(root, path.resolve(source, f)), sha(readFileSync(path.resolve(source, f)))]));
    function packageVersion(name) {
      let dir = path.dirname(sourceRequire.resolve(name));
      while (dir !== path.dirname(dir)) {
        const p = path.join(dir, 'package.json');
        if (existsSync(p)) { const m = JSON.parse(readFileSync(p)); if (m.name === name) return m.version; }
        dir = path.dirname(dir);
      }
      throw new Error(`cannot identify resolved version of ${name}`);
    }
    const mode = { path: isMainThread ? 'main-thread' : 'worker-thread', entry: 'incumbent createFileParser/createProcessor', inline_ts_and_scss: 'empty string, exactly as transpileWorkerScript', concurrency: workerData?.concurrency || 1, worker: workerData?.slot ?? null, chunk_size: 128 };
    const versions = Object.fromEntries(['js-yaml', 'gray-matter', 'unified', 'remark-parse', 'remark-rehype'].map(n => [n, packageVersion(n)]));
    const provenance = { git_head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), source_hashes: sourceHashes, mode, versions, mutant: mutant || null };
    let records = 0, storedBytes = 0, rawBytes = 0, nodes = 0, active;
    const stages = [], coverage = {};
    function write(seam, key, data, counts) {
      const payload = serial(data), dataBytes = JSON.stringify(payload);
      const record = { schema: 'quartz-seam-v1', seam, key, data: payload, data_sha256: sha(dataBytes), coverage: { files: 1, ...counts }, provenance: { git_head: provenance.git_head, capture: 'pipeline.json', mode, versions, mutant: mutant || null } };
      const bytes = Buffer.from(JSON.stringify(record) + '\n');
      const dest = path.join(output, seam, key + (compressed ? '.json.gz' : '.json'));
      const stored = compressed ? gzipSync(bytes, { level: 6 }) : bytes;
      // Reserve allocated blocks plus directory overhead BEFORE writing, across workers.
      const cost = BigInt((Math.ceil(stored.length / 4096) + 1) * 4096);
      if (budget && Atomics.add(budget, 0, cost) + cost > BigInt(maxBytes)) throw new Error(`hard stop: capture storage budget exceeds ${maxBytes} bytes`);
      mkdirSync(path.dirname(dest), { recursive: true });
      if (existsSync(dest)) throw new Error(`refusing to overwrite golden ${dest}`);
      writeFileSync(dest, stored, { flag: 'wx' });
      records++; storedBytes += stored.length; rawBytes += bytes.length;
    }
    function stage(phase, name, kind) {
      const id = `${String(stages.length + 1).padStart(2, '0')}-${phase}-${name}`;
      stages.push({ id, phase, name, kind }); coverage[id] = 0; return id;
    }
    function snapshot(id, tree, file) {
      const n = countNodes(tree);
      if (!n) throw new Error(`${id}: zero AST nodes`);
      const data = { stage: id, previous: active.previous, tree, file: { data: file.data }, identity: { htmlAstIsTree: file.data.htmlAst === tree } };
      write('transform', `${active.key}/${id}`, data, { nodes: n });
      coverage[id]++; nodes += n; active.previous = id;
    }
    const textStages = new Map(), mdStages = new Map(), htmlStages = new Map();
    for (const p of cfg.plugins.transformers) if (p.textTransform) textStages.set(p, stage('text', p.name, 'text'));
    const parseId = stage('parse', 'remark-parse', 'mdast');
    for (const p of cfg.plugins.transformers) if (p.markdownPlugins) mdStages.set(p, stage('markdown', p.name, 'mdast'));
    const bridgeId = stage('bridge', 'remark-rehype', 'hast');
    for (const p of cfg.plugins.transformers) if (p.htmlPlugins) htmlStages.set(p, stage('html', p.name, 'hast'));
    for (const p of cfg.plugins.transformers) {
      if (p.textTransform) {
        const original = p.textTransform;
        p.textTransform = (...v) => {
          const text = original(...v), id = textStages.get(p);
          if (!text.length) throw new Error(`${id}: empty text transform`);
          write('transform', `${active.key}/${id}`, { stage: id, previous: active.previous, text }, { characters: text.length });
          active.previous = id; coverage[id]++; return text;
        };
      }
      for (const [method, stageMap] of [['markdownPlugins', mdStages], ['htmlPlugins', htmlStages]]) {
        if (!p[method]) continue;
        const original = p[method];
        p[method] = (...v) => {
          const plugins = original(...v), id = stageMap.get(p);
          // The first HTML plugin observes the actual remark-rehype result.
          const bridge = method === 'htmlPlugins' && p === htmlStages.keys().next().value ? [() => (tree, file) => snapshot(bridgeId, tree, file)] : [];
          return [...bridge, ...plugins, () => (tree, file) => {
            if (p.name === 'FrontMatter' && method === 'markdownPlugins') {
              if (!file.data.frontmatter || !Object.keys(file.data.frontmatter).length) throw new Error('zero frontmatter coverage');
              write('parse', active.key, { source: active.source, input: active.input, mdast: active.mdast, frontmatter: file.data.frontmatter, file: active.baseFile }, { nodes: countNodes(active.mdast), frontmatter_keys: Object.keys(file.data.frontmatter).length });
            }
            snapshot(id, tree, file);
          }];
        };
      }
    }
    function makeProcessor() {
      const processor = createProcessor(ctx);
      const originalParse = processor.parse.bind(processor);
      processor.parse = file => {
        const tree = originalParse(file);
        active.mdast = serial(tree); active.input = file.value.toString(); active.baseFile = serial({ data: file.data });
        snapshot(parseId, tree, file);
        return tree;
      };
      return processor;
    }
    let processor;
    const inputManifest = {};
    for (const [index, key] of selected.entries()) {
      // worker.ts creates a fresh processor for each 128-file parseFiles call.
      if (index % 128 === 0) processor = makeProcessor();
      const fp = `../content/${key}`, raw = readFileSync(fp), stat = statSync(fp);
      active = { key, source: raw.toString('utf8'), previous: null, clock: [] };
      inputManifest[key] = { sha256: sha(raw), size: raw.length, birthtimeMs: stat.birthtimeMs, mtimeMs: stat.mtimeMs };
      // Record wall-clock inputs; replay uses these exact inputs, never a date normalization.
      globalThis.Date = class extends NativeDate {
        constructor(...v) {
          if (v.length) super(...v);
          else { const ms = NativeDate.now(); super(ms); active.clock.push({ call: 'new Date()', value: ms }); }
        }
        static now() { const ms = NativeDate.now(); active.clock.push({ call: 'Date.now()', value: ms }); return ms; }
      };
      let result;
      try { result = await createFileParser(ctx, [fp])(processor); }
      finally { globalThis.Date = NativeDate; }
      inputManifest[key].clock = active.clock;
      if (result.length !== 1) throw new Error(`${key}: parser coverage=${result.length}, expected 1`);
      if (Object.values(coverage).some(n => n !== Object.keys(inputManifest).length)) throw new Error(`${key}: incomplete stage coverage`);
      if (Object.keys(inputManifest).length % 100 === 0) console.log(`coverage: files=${Object.keys(inputManifest).length}/${selected.length}, snapshots=${records}, bytes=${storedBytes}`);
    }
    const manifest = { schema: 'quartz-pipeline-capture-v1', provenance, stages, allSlugs: ctx.allSlugs, inputs: inputManifest, coverage: { files: selected.length, corpus_files: allMarkdown.length, snapshots: records, nodes, by_stage: coverage }, storage: { bytes: storedBytes, uncompressed_bytes: rawBytes }, elapsed_seconds: (performance.now() - start) / 1000 };
    mkdirSync(output, { recursive: true });
    writeFileSync(path.join(output, workerData ? `pipeline-worker-${workerData.slot}.json` : 'pipeline.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    console.log(`PASS coverage: files=${selected.length}/${allMarkdown.length}, stages=${stages.length}, snapshots=${records}, nodes=${nodes}; bytes=${storedBytes}; uncompressed_bytes=${rawBytes}; elapsed=${manifest.elapsed_seconds.toFixed(3)}s`);
    if (parentPort) parentPort.postMessage(manifest);
  } finally { rmSync(bundle, { force: true }); }
}

async function coordinator() {
  const concurrency = Number(value('--concurrency') || 4);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('--concurrency must be 1..4');
  if (!Number.isFinite(maxBytes) || maxBytes <= 0 || maxBytes > 10 * 1024 ** 3) throw new Error('--max-bytes must be positive and <=10 GiB');
  if (!output) throw new Error('--out is required');
  process.chdir(source);
  const start = performance.now(), shared = new SharedArrayBuffer(8), workers = [];
  const selectedCount = filesWanted.length || Number(value('--limit') || Infinity);
  const active = Math.min(concurrency, selectedCount);
  try {
    // Production discovers once and passes this exact ordered list to every worker.
    const { allFiles } = await new Promise((resolve, reject) => {
      const w = new Worker(new URL(import.meta.url), { argv: args, workerData: { discover: true, budget: shared } });
      workers.push(w); let result;
      w.on('message', m => { result = m; }); w.on('error', reject);
      w.on('exit', code => code === 0 && result ? resolve(result) : reject(new Error('input discovery failed')));
    });
    const results = await Promise.all(Array.from({ length: active }, (_, slot) => new Promise((resolve, reject) => {
      const w = new Worker(new URL(import.meta.url), { argv: args, workerData: { slot, concurrency: active, budget: shared, allFiles, probe: selectedCount < 128 * active } });
      workers.push(w);
      let result;
      w.on('message', m => { result = m; });
      w.on('error', reject);
      w.on('exit', code => code === 0 && result ? resolve(result) : reject(new Error(`capture worker ${slot} exited ${code} without complete coverage`)));
    })));
    const first = results[0];
    const merged = { ...first, provenance: { ...first.provenance, mode: { ...first.provenance.mode, worker: 'all' } }, inputs: {}, coverage: { ...first.coverage, files: 0, snapshots: 0, nodes: 0, by_stage: {} }, storage: { bytes: 0, uncompressed_bytes: 0, reserved_bytes: Number(new BigInt64Array(shared)[0]) } };
    for (const r of results) {
      if (JSON.stringify(r.stages) !== JSON.stringify(first.stages) || JSON.stringify(r.allSlugs) !== JSON.stringify(first.allSlugs)) throw new Error('workers disagree on stage/slug inventory');
      for (const [k, v] of Object.entries(r.inputs)) { if (k in merged.inputs) throw new Error(`duplicate file ${k}`); merged.inputs[k] = v; }
      for (const k of ['files', 'snapshots', 'nodes']) merged.coverage[k] += r.coverage[k];
      for (const [k, v] of Object.entries(r.coverage.by_stage)) merged.coverage.by_stage[k] = (merged.coverage.by_stage[k] || 0) + v;
      for (const k of ['bytes', 'uncompressed_bytes']) merged.storage[k] += r.storage[k];
    }
    if (Object.values(merged.coverage.by_stage).some(n => n !== merged.coverage.files)) throw new Error('incomplete merged stage coverage');
    merged.elapsed_seconds = (performance.now() - start) / 1000;
    writeFileSync(path.join(output, 'pipeline.json'), JSON.stringify(merged, null, 2) + '\n', { flag: 'wx' });
    console.log(`PASS WORKER CAPTURE coverage: ${JSON.stringify(merged.coverage)}; storage=${JSON.stringify(merged.storage)}; wall=${merged.elapsed_seconds.toFixed(3)}s`);
  } finally { await Promise.all(workers.map(w => w.terminate())); }
}

(isMainThread ? coordinator() : main()).catch(e => { console.error(`ERROR instrument coverage incomplete: ${e.stack || e}`); process.exitCode = 2; });
