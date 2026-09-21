/**
 * Import-safe quartz-seam-v1 parse/transform record encoding and bounded writes.
 * Only Node built-ins: importing performs no IO, chdir, discovery, bundling,
 * worker launch, environment/clock mutation or CLI invocation. The factory also
 * performs no IO; only write() creates output. No pipeline or plugin ABI here.
 *
 * const writer = createRecordWriter({ output: ABSOLUTE_DIRECTORY, provenance,
 *   budget: new BigInt64Array(sharedBuffer), maxBytes: 10 * 1024 ** 3 });
 * writer.write('parse', 'Positions/Mount.md', data, { nodes, frontmatter_keys });
 * writer.write('transform', 'Positions/Mount.md/04-markdown-Example', data, { nodes });
 * parentPort.postMessage(writer.receipt()); // counts/bytes only, never ASTs
 *
 * provenance.mode.path MUST name the actual main-thread or worker-thread path.
 * The caller supplies provenance, ordered boundary observations and file identity;
 * this module never guesses them. Data uses the standalone capture's original
 * tagged Date/undefined serialization. Array order, AST positions and string bytes
 * are preserved; object keys are sorted. No normalization or baseline updates.
 *
 * write() is synchronous, holds only the current record's buffers, and creates
 * each destination exclusively. All workers MUST share one BigInt64Array counter
 * AND the same maxBytes. Reservations happen atomically BEFORE filesystem writes;
 * rejected reservations consume nothing. The budget conservatively charges 4 KiB
 * blocks plus 4 KiB of directory overhead per record, not measured free disk.
 * Without a shared counter, the cap applies to this writer alone. Manifests and
 * other producers' files are outside this counter. Receipts count successful
 * writes; no receipt is available for a writer that completed zero records.
 *
 * BLIND SPOTS: a file/boundary record proves neither its siblings nor the site or
 * browser. Receipt counts cannot prove hooks ran at the correct boundaries, source
 * provenance, absence of extra pre-existing files, or complete corpus coverage.
 * S1 must independently assert exactly 4,600 parse + 64,400 transform records and
 * all 14 named boundaries for the scheduled full capture. No full run is claimed
 * by this module's fixtures. Pinned by seam_record_selftest.mjs: import safety,
 * original record bytes, value preservation, immutable destinations, shared cap,
 * bounded receipts, five temporary-copy mutants and before/after source hashes.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, openSync, writeFileSync, closeSync, rmSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const NativeDate = Date;
const MAX_BYTES = 10 * 1024 ** 3;

export function serial(value) {
  if (value === undefined) return { $undefined: true };
  if (value instanceof NativeDate) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(serial);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, serial(value[k])]));
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') throw new Error(`unsupported seam value: ${typeof value}`);
  return value;
}

export function countNodes(tree) {
  let n = 0;
  function walk(v) {
    if (!v || typeof v !== 'object') return;
    if (typeof v.type === 'string') n++;
    for (const child of v.children || []) walk(child);
  }
  walk(tree);
  return n;
}

function executionPath(provenance) {
  if (!['main-thread', 'worker-thread'].includes(provenance?.mode?.path)) {
    throw new Error('record provenance must declare actual execution path: main-thread or worker-thread');
  }
}

function identity(seam, key) {
  if (!['parse', 'transform'].includes(seam)) throw new Error(`unsupported pipeline seam: ${seam}`);
  if (typeof key !== 'string' || !key || key.includes('\\') || key.includes('\0') ||
      key.startsWith('/') || key.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`expected a relative POSIX record key, got ${JSON.stringify(key)}`);
  }
}

/** Pure encoding: same envelope order, hash, UTF-8 bytes and newline as the CLI. */
export function serializeRecord(seam, key, data, counts, provenance) {
  identity(seam, key);
  executionPath(provenance);
  if (counts?.files !== undefined && counts.files !== 1) throw new Error('record file coverage must equal 1');
  if (!counts || Object.values(counts).some(n => !Number.isSafeInteger(n) || n < 0) ||
      (seam === 'parse' ? !(counts.nodes > 0 && counts.frontmatter_keys > 0) : !(counts.nodes > 0 || counts.characters > 0))) {
    throw new Error(`${seam}: positive measured record coverage required`);
  }
  if (seam === 'transform' && data?.stage !== key.slice(key.lastIndexOf('/') + 1)) {
    throw new Error('transform stage identity does not match record key');
  }
  const payload = serial(data), dataBytes = JSON.stringify(payload);
  const record = { schema: 'quartz-seam-v1', seam, key, data: payload,
    data_sha256: createHash('sha256').update(dataBytes).digest('hex'),
    coverage: { files: 1, ...counts }, provenance };
  return Buffer.from(JSON.stringify(record) + '\n');
}

export function createRecordWriter({ output, provenance, compressed = true, maxBytes = MAX_BYTES,
  budget = new BigInt64Array(new SharedArrayBuffer(8)) }) {
  if (typeof output !== 'string' || !path.isAbsolute(output)) throw new Error('writer requires an absolute output directory');
  executionPath(provenance);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_BYTES) throw new Error('maxBytes must be a positive integer <=10 GiB');
  if (!(budget instanceof BigInt64Array) || !(budget.buffer instanceof SharedArrayBuffer) || budget.length !== 1) {
    throw new Error('budget must be a one-element shared BigInt64Array');
  }
  const recordProvenance = structuredClone(provenance), limit = BigInt(maxBytes);
  let records = 0, parse = 0, transform = 0, bytes = 0, rawBytes = 0, reservedBytes = 0;
  const byStage = Object.create(null);
  return {
    write(seam, key, data, counts) {
      const raw = serializeRecord(seam, key, data, counts, recordProvenance);
      const stored = compressed ? gzipSync(raw, { level: 6 }) : raw;
      const dest = path.join(output, seam, key + (compressed ? '.json.gz' : '.json'));
      const cost = BigInt((Math.ceil(stored.length / 4096) + 1) * 4096);
      for (;;) {
        const used = Atomics.load(budget, 0);
        if (used < 0n || used + cost > limit) throw new Error(`hard stop: capture storage budget exceeds ${maxBytes} bytes`);
        if (Atomics.compareExchange(budget, 0, used, used + cost) === used) break;
      }
      let fd, created = false;
      try {
        mkdirSync(path.dirname(dest), { recursive: true });
        fd = openSync(dest, 'wx'); created = true;
        writeFileSync(fd, stored);
        closeSync(fd); fd = undefined;
      } catch (error) {
        if (fd !== undefined) { try { closeSync(fd); } catch { /* retain the original write failure */ } }
        // Only remove a file this attempt exclusively created, never a prior record.
        // If cleanup itself fails, retain the reservation for bytes still on disk.
        if (created) rmSync(dest, { force: true });
        Atomics.sub(budget, 0, cost);
        throw error;
      }
      records++; bytes += stored.length; rawBytes += raw.length; reservedBytes += Number(cost);
      if (seam === 'parse') parse++;
      else { transform++; byStage[data.stage] = (byStage[data.stage] || 0) + 1; }
      return dest;
    },
    receipt() {
      if (!records) throw new Error('zero record coverage: no completed writes');
      return { coverage: { snapshots: records, parse, transform, by_stage: { ...byStage } },
        storage: { bytes, uncompressed_bytes: rawBytes, reserved_bytes: reservedBytes } };
    },
  };
}
