#!/usr/bin/env node
// Rewrite every `// census:<key>` literal to today's corpus.
//
// The counterpart to tests/corpus_census.test.mjs. That gate tells you WHICH literals went stale
// and by how much; this rewrites them, so a deliberate content change costs one command instead of
// a hunt across five files — which is how the same class got missed twice (v1.155.2, v1.158.1).
//
// It does NOT excuse you from the commit message. These numbers are tripwires: a drift is a fact
// about the corpus and belongs in the narrative, not absorbed as a chore. The script prints what it
// changed in exactly the shape you want to paste.
//
// Usage:  npm run census:update  [--dry]
import { readFileSync, writeFileSync } from "node:fs";
import { computeCensus, scanMarkers, R } from "../tests/_census.mjs";

const dry = process.argv.includes("--dry");
const census = computeCensus();
const { found, bad } = scanMarkers();

if (bad.length) {
  console.error("Refusing to rewrite — these markers cannot be read unambiguously:");
  for (const b of bad) console.error(`  ${b.file}:${b.line} — ${b.why}`);
  process.exit(1);
}
const unknown = found.filter((f) => !(f.key in census));
if (unknown.length) {
  console.error("Refusing to rewrite — these markers name a key the census does not compute:");
  for (const u of unknown) console.error(`  ${u.file}:${u.line} — census:${u.key}`);
  console.error(`  known keys: ${Object.keys(census).sort().join(", ")}`);
  process.exit(1);
}

const drift = found.filter((f) => f.value !== census[f.key]);
if (!drift.length) {
  console.log(`census up to date — ${found.length} marker(s) match the corpus, nothing to rewrite`);
  process.exit(0);
}

// group by file so each is read and written once
const byFile = new Map();
for (const d of drift) {
  if (!byFile.has(d.file)) byFile.set(d.file, []);
  byFile.get(d.file).push(d);
}
for (const [file, rows] of byFile) {
  const lines = readFileSync(R(file), "utf8").split("\n");
  for (const d of rows) {
    const i = d.line - 1;
    // replace the ONE literal the scan already proved unambiguous, not every digit on the line
    const before = lines[i];
    let replaced = false;
    lines[i] = before.replace(new RegExp(`\\b${d.value}\\b`), (m) => {
      if (replaced) return m;
      replaced = true;
      return String(census[d.key]);
    });
    if (!replaced) {
      console.error(`  ${file}:${d.line} — could not locate ${d.value} to rewrite; left untouched`);
      process.exitCode = 1;
    }
  }
  if (!dry) writeFileSync(R(file), lines.join("\n"), "utf8");
}

const width = Math.max(...drift.map((d) => `${d.file}:${d.line}`.length));
console.log(`${dry ? "[--dry] would rewrite" : "rewrote"} ${drift.length} literal(s):`);
for (const d of drift) {
  console.log(`  ${`${d.file}:${d.line}`.padEnd(width)}  ${d.value} -> ${census[d.key]}   (census:${d.key})`);
}
const keys = [...new Set(drift.map((d) => d.key))].sort();
console.log(`\nfor the commit message — keys that moved:`);
for (const k of keys) console.log(`  ${k} = ${census[k]}`);
console.log(`\nSay WHY the corpus moved. A tripwire that is silently re-armed is not a tripwire.`);
