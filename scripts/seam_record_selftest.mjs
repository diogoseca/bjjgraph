#!/usr/bin/env node
/**
 * Tiny fixtures for seam_record.mjs; no parser, site build or dependency install.
 * Run: node scripts/seam_record_selftest.mjs [--golden-dir /path/to/seams-v1]
 *
 * Preconditions: fixtures contain Dates, undefined, ordered arrays, AST positions,
 * one parse and 14 distinct transform boundaries, duplicate destinations and a
 * shared budget too small for two records. These are asserted, not inferred from
 * a green writer. Optional golden checking re-encodes ONE retained source file's
 * 15 records byte-for-byte, including gzip; it does not recapture any boundary.
 *
 * Kills (temporary module copies): import-time chdir, reversed array order,
 * untagged Date, overwrite instead of exclusive create, and bypassed storage cap.
 * No surviving mutants are accepted. No tracked source is mutated or reverted;
 * source hashes are asserted in finally (COORDINATION 7I), and each mutant gets a
 * fresh fixture tree. This proves the named record/writer boundaries only, not
 * all 4,600 files, observer hook placement, the build, final HTML or browser use.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { gzipSync, gunzipSync } from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];

async function probe(moduleFile, fixture) {
  const cwd = process.cwd(), before = readdirSync(cwd), nativeDate = Date;
  const originalChdir = process.chdir, originalWrite = process.stdout.write;
  let noise = '';
  process.chdir = () => { throw new Error('import changed cwd'); };
  process.stdout.write = chunk => { noise += chunk; return true; };
  let api;
  try { api = await import(pathToFileURL(moduleFile).href); }
  finally { process.chdir = originalChdir; process.stdout.write = originalWrite; }
  assert.equal(process.cwd(), cwd, 'import changed cwd');
  assert.deepEqual(readdirSync(cwd), before, 'import wrote files');
  assert.equal(Date, nativeDate, 'import changed the clock');
  assert.equal(noise, '', 'import ran a CLI');
  const { serial, countNodes, serializeRecord, createRecordWriter } = api;
  let checks = 1;
  const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
  const provenance = { git_head: 'fixture', capture: 'pipeline.json', mode: {
    path: 'main-thread', entry: 'fixture', concurrency: 1, worker: null,
  }, versions: {}, mutant: null };
  const tree = { type: 'root', children: [{ type: 'text', value: ' two\n', position: {
    start: { line: 2, column: 3, offset: 7 }, end: { line: 2, column: 8, offset: 12 },
  } }] };
  const data = { z: undefined, a: [new Date('2020-01-02T03:04:05.000Z'), false, 0, 'é\n'], tree };
  const expected = { a: [{ $date: '2020-01-02T03:04:05.000Z' }, false, 0, 'é\n'], tree: {
    children: [{ position: { end: { column: 8, line: 2, offset: 12 },
      start: { column: 3, line: 2, offset: 7 } }, type: 'text', value: ' two\n' }], type: 'root',
  }, z: { $undefined: true } };
  check('tagged values, array order, positions and all string bytes', () => {
    assert.deepEqual(serial(data), expected);
    assert.equal(countNodes(tree), 2);
    assert.equal(countNodes(undefined), 0);
    assert.deepEqual(serial(serial(data)), expected);
    for (const value of [() => {}, Symbol('bad'), 1n]) assert.throws(() => serial(value), /unsupported seam value/);
  });
  const counts = { nodes: 2, frontmatter_keys: 1 };
  check('exact v1 envelope and independently hashed expected data', () => {
    const bytes = serializeRecord('parse', 'Fixture.md', data, counts, provenance);
    const wanted = { schema: 'quartz-seam-v1', seam: 'parse', key: 'Fixture.md', data: expected,
      data_sha256: hash(JSON.stringify(expected)), coverage: { files: 1, ...counts }, provenance };
    assert.equal(bytes.toString(), JSON.stringify(wanted) + '\n');
  });
  const output = path.join(fixture, 'records');
  const budget = new BigInt64Array(new SharedArrayBuffer(8));
  const writer = createRecordWriter({ output, provenance, budget });
  check('unstarted writer cannot issue a positive receipt', () => {
    assert.throws(() => writer.receipt(), /zero record coverage/);
    assert.equal(existsSync(output), false, 'factory performed IO');
  });
  writer.write('parse', 'Fixture.md', data, counts);
  for (let i = 1; i <= 14; i++) {
    const stage = String(i).padStart(2, '0') + '-fixture';
    writer.write('transform', `Fixture.md/${stage}`, { stage, tree }, { nodes: 2 });
  }
  check('15 successful writes, 14 named boundaries, small detached receipt', () => {
    const receipt = writer.receipt();
    assert.equal(receipt.coverage.parse, 1);
    assert.equal(receipt.coverage.transform, 14);
    assert.equal(receipt.coverage.snapshots, 15);
    assert.equal(Object.keys(receipt.coverage.by_stage).length, 14);
    assert.ok(Object.values(receipt.coverage.by_stage).every(n => n === 1));
    assert.ok(receipt.storage.bytes > 0 && receipt.storage.uncompressed_bytes > receipt.storage.bytes);
    assert.equal(BigInt(receipt.storage.reserved_bytes), Atomics.load(budget, 0));
    assert.ok(Buffer.byteLength(JSON.stringify(receipt)) < 2048);
    receipt.coverage.by_stage['01-fixture'] = 999;
    assert.equal(writer.receipt().coverage.by_stage['01-fixture'], 1);
  });
  check('gzip bytes and exclusive destination with hash-checked rejection', () => {
    const dest = path.join(output, 'parse/Fixture.md.json.gz'), bytes = readFileSync(dest);
    const encoded = serializeRecord('parse', 'Fixture.md', data, counts, provenance);
    assert.deepEqual(bytes, gzipSync(encoded, { level: 6 }));
    const beforeHash = hash(bytes), receipt = writer.receipt(), reserved = Atomics.load(budget, 0);
    assert.throws(() => writer.write('parse', 'Fixture.md', { changed: true }, counts), /EEXIST|overwrite/);
    assert.equal(hash(readFileSync(dest)), beforeHash, 'duplicate damaged existing record');
    assert.deepEqual(writer.receipt(), receipt, 'failed write counted as completed');
    assert.equal(Atomics.load(budget, 0), reserved, 'failed write leaked a reservation');
  });
  check('plain record bytes', () => {
    const plain = createRecordWriter({ output: path.join(fixture, 'plain'), provenance, compressed: false });
    plain.write('parse', 'Fixture.md', data, counts);
    assert.deepEqual(readFileSync(path.join(fixture, 'plain/parse/Fixture.md.json')),
      serializeRecord('parse', 'Fixture.md', data, counts, provenance));
  });
  check('unsafe keys, missing execution path, false coverage and non-pipeline seam rejected', () => {
    for (const key of ['', '/escape', '../escape', 'a/../escape', 'a//b', 'a\\b', 'a/./b']) {
      assert.throws(() => writer.write('parse', key, data, counts), /relative POSIX/);
    }
    assert.throws(() => createRecordWriter({ output: 'relative', provenance }), /absolute output/);
    assert.throws(() => createRecordWriter({ output, provenance: { ...provenance, mode: {} } }), /execution path/);
    assert.throws(() => writer.write('parse', 'bad.md', data, { ...counts, files: 0 }), /file coverage/);
    assert.throws(() => writer.write('parse', 'bad.md', data, { nodes: 0, frontmatter_keys: 1 }), /positive/);
    assert.throws(() => writer.write('render', 'bad.md', data, counts), /pipeline seam/);
    assert.throws(() => writer.write('transform', 'bad.md/stage', { stage: 'different', tree }, { nodes: 2 }), /stage identity/);
  });
  check('shared budget rejects before IO, without consuming reservation', () => {
    const shared = new BigInt64Array(new SharedArrayBuffer(8));
    const first = createRecordWriter({ output: path.join(fixture, 'cap-first'), provenance, budget: shared, maxBytes: 8192 });
    const second = createRecordWriter({ output: path.join(fixture, 'cap-second'), provenance, budget: shared, maxBytes: 8192 });
    first.write('parse', 'First.md', data, counts);
    assert.equal(Atomics.load(shared, 0), 8192n);
    assert.throws(() => second.write('parse', 'Second.md', data, counts), /hard stop/);
    assert.equal(Atomics.load(shared, 0), 8192n);
    assert.equal(existsSync(path.join(fixture, 'cap-second')), false);
    assert.throws(() => second.receipt(), /zero record coverage/);
    const local = createRecordWriter({ output: path.join(fixture, 'cap-local'), provenance, maxBytes: 1 });
    assert.throws(() => local.write('parse', 'First.md', data, counts), /hard stop/);
    assert.equal(existsSync(path.join(fixture, 'cap-local')), false);
  });
  check('IO failure rolls back its reservation and cannot earn a receipt', () => {
    const target = path.join(fixture, 'not-a-directory'); writeFileSync(target, 'sentinel');
    const shared = new BigInt64Array(new SharedArrayBuffer(8));
    const failed = createRecordWriter({ output: target, provenance, budget: shared });
    assert.throws(() => failed.write('parse', 'Fixture.md', data, counts), /ENOTDIR|EEXIST/);
    assert.equal(Atomics.load(shared, 0), 0n);
    assert.throws(() => failed.receipt(), /zero record coverage/);
    assert.equal(readFileSync(target, 'utf8'), 'sentinel');
  });
  const shared = new SharedArrayBuffer(8);
  const receipts = await Promise.all([0, 1].map(slot => new Promise((resolve, reject) => {
    const worker = new Worker(`const { workerData: d, parentPort } = require('node:worker_threads');
      import(d.module).then(({ createRecordWriter }) => {
        const writer = createRecordWriter({ output: d.output, provenance: d.provenance,
          maxBytes: 8192, budget: new BigInt64Array(d.shared) });
        try { writer.write('parse', 'Worker.md', { source: 'fixture' }, { nodes: 1, frontmatter_keys: 1 });
          parentPort.postMessage({ success: true, receipt: writer.receipt() });
        } catch (e) { parentPort.postMessage({ success: false, error: e.message }); }
      }).catch(e => { throw e; });`, { eval: true, workerData: {
        module: pathToFileURL(moduleFile).href, shared, output: path.join(fixture, `worker-${slot}`),
        provenance: { ...provenance, mode: { ...provenance.mode, path: 'worker-thread', concurrency: 2, worker: slot } },
      } });
    let result; worker.on('message', r => { result = r; }); worker.on('error', reject);
    worker.on('exit', code => code === 0 && result ? resolve(result) : reject(new Error(`worker exit ${code}`)));
  })));
  check('two actual workers share one atomic cap and send small receipts', () => {
    assert.equal(receipts.filter(r => r.success).length, 1);
    assert.match(receipts.find(r => !r.success).error, /hard stop/);
    assert.equal(Atomics.load(new BigInt64Array(shared), 0), 8192n);
    assert.ok(receipts.every(r => JSON.stringify(r).length < 2048));
  });
  console.log(`PASS coverage: ${checks} record/writer controls; no build, no corpus-coverage claim`);
}

function retainedRecords(api, root) {
  const key = 'Positions/Mount.md';
  const stages = readdirSync(path.join(root, 'transform', key)).filter(n => n.endsWith('.json.gz')).sort();
  assert.equal(stages.length, 14, 'retained stage precondition');
  const files = [path.join(root, 'parse', key + '.json.gz'), ...stages.map(s => path.join(root, 'transform', key, s))];
  for (const file of files) {
    const stored = readFileSync(file), bytes = gunzipSync(stored), record = JSON.parse(bytes);
    const reencoded = api.serializeRecord(record.seam, record.key, record.data, record.coverage, record.provenance);
    assert.deepEqual(reencoded, bytes, `record bytes changed: ${file}`);
    assert.deepEqual(gzipSync(reencoded, { level: 6 }), stored, `gzip changed: ${file}`);
  }
  console.log(`PASS retained compatibility: parse=1 transform=14 bytes+gzip=15, source=${key}, capture=${JSON.parse(gunzipSync(readFileSync(files[0]))).provenance.git_head}`);
}

if (args[0] === '--probe') {
  await probe(args[1], args[2]);
} else {
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--golden-dir'), 'unknown arguments');
  const modulePath = path.join(here, 'seam_record.mjs'), cliPath = path.join(here, 'seam_capture.mjs');
  const tracked = [modulePath, cliPath], before = tracked.map(file => hash(readFileSync(file)));
  const temp = mkdtempSync(path.join(tmpdir(), 'v-seam-record-'));
  try {
    const original = readFileSync(modulePath, 'utf8');
    const run = (name, code, want, needle) => {
      const base = path.join(temp, name); mkdirSync(base);
      const module = path.join(base, 'seam_record.mjs'); writeFileSync(module, code);
      const proc = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--probe', module, base], {
        cwd: base, encoding: 'utf8', timeout: 15000,
      });
      assert.equal(proc.error, undefined, `${name}: ${proc.error}`);
      assert.equal(proc.status, want, `${name}: ${proc.stdout}\n${proc.stderr}`);
      if (needle) assert.match(proc.stderr, needle, `${name} died for the wrong reason`);
      if (!want) process.stdout.write(proc.stdout);
      else console.log(`KILLED ${name}: exit=${proc.status}`);
    };
    run('clean', original, 0);
    const mutate = (before, after) => {
      assert.equal(original.split(before).length - 1, 1, 'mutant anchor is not unique');
      return original.replace(before, after);
    };
    run('import-chdir', original + '\nprocess.chdir("/");\n', 1, /import changed cwd/);
    run('array-order', mutate('value.map(serial)', 'value.map(serial).reverse()'), 1, /deep-equal/);
    run('date-tag', mutate('return { $date: value.toISOString() }', 'return value.toISOString()'), 1, /deep-equal/);
    run('overwrite', mutate("openSync(dest, 'wx')", "openSync(dest, 'w')"), 1, /Missing expected exception/);
    run('storage-cap', mutate('used + cost > limit', 'false'), 1, /Missing expected exception/);
    // A CLI import also must not trigger discovery, cwd changes or esbuild lookup.
    const guarded = path.join(temp, 'guarded'); mkdirSync(guarded);
    writeFileSync(path.join(guarded, 'seam_record.mjs'), original);
    writeFileSync(path.join(guarded, 'seam_capture.mjs'), readFileSync(cliPath));
    const cli = spawnSync(process.execPath, ['--input-type=module', '-e',
      'const cwd=process.cwd(); await import("./seam_capture.mjs"); if(process.cwd()!==cwd) throw Error("CLI import changed cwd");'],
      { cwd: guarded, encoding: 'utf8', timeout: 15000 });
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(cli.stdout + cli.stderr, '', 'CLI import ran work');
    assert.deepEqual(readdirSync(guarded).sort(), ['seam_capture.mjs', 'seam_record.mjs']);
    console.log('PASS guarded CLI import: no cwd change, discovery, writes or esbuild dependency');
    if (args.includes('--golden-dir')) await retainedRecords(await import(pathToFileURL(modulePath).href), option('--golden-dir'));
    console.log('PASS coverage: 5/5 temporary-copy mutants killed; source reverts=0');
  } finally {
    assert.deepEqual(tracked.map(file => hash(readFileSync(file))), before, 'source changed during fixture/mutant run');
    rmSync(temp, { recursive: true, force: true });
    console.log('PASS source hashes unchanged: files=2');
  }
}
