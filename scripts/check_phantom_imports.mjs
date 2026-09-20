#!/usr/bin/env node
/**
 * D-11: audit JS/TS import specifiers against package manifests, never installed deps.
 *
 * node scripts/check_phantom_imports.mjs [--root REPO] [--selftest]
 * Exit 0 = all selected specifiers justified; 1 = undeclared dependency; 2 = no
 * verdict (zero coverage, syntax error, or unresolved dynamic import/require base).
 * All tracked AND untracked, nonignored JS/TS in source/, scripts/, neural/src/,
 * neural/build/, forward/ are scanned. Generated static/, dist/, public/, caches,
 * tests, and node_modules are excluded. This is conservative build/tooling coverage,
 * not a reachability proof; even type imports must be declared (or their @types
 * package must be declared). Transitive packages are not a direct-import contract.
 * Source issuers may use source/package.json and ancestor package.json; root
 * issuers cannot borrow source deps unless createRequire explicitly roots there.
 * Literal ESM imports/exports, dynamic imports, CommonJS requires, import types,
 * and import-equals are parsed with TypeScript, not regex. Nonliteral imports are
 * statically evaluated, or explicitly fail. Generated local cache imports are
 * counted and disclosed; their producers are themselves in the scanned source set.
 * Disk resolution is diagnostic ONLY: a disk-resolving undeclared import still fails.
 *
 * Partially pinned - JS/TS only; Python provisioning is F's check_build_chains.py.
 * D-11 remains in force until BOTH gates exist. This gate does not verify lockfile
 * consistency, package export maps, runtime conditionals, npm-script CLI binaries,
 * eval-generated modules, HTML/CDN imports, CSS/Sass imports, browser execution, or
 * Python provisioning. A selected-file pass says nothing about unselected files.
 * --selftest pins disk-only toml, scoped/subpath imports, ancestor boundaries,
 * type imports, dynamic-import absence, empty coverage, and comment false positives.
 */
import assert from 'node:assert/strict';
import { builtinModules, createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRequire = createRequire(new URL('../source/package.json', import.meta.url));
const ts = sourceRequire('typescript');
const builtins = new Set(builtinModules.flatMap(n => [n, n.replace(/^node:/, ''), `node:${n}`]));
const argv = process.argv.slice(2);
const rootArg = argv.indexOf('--root');
const root = rootArg < 0 ? toolRoot : path.resolve(argv[rootArg + 1]);

function packageName(spec) {
  return spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
}

function parse(file, text) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  if (ast.parseDiagnostics.length) throw new Error(`${file}: JS/TS parse errors=${ast.parseDiagnostics.length}`);
  const constants = new Map();
  const requireBases = new Map([['require', file]]);
  const rows = [];
  function collect(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) constants.set(n.name.text, n.initializer);
    ts.forEachChild(n, collect);
  }
  collect(ast);
  // Resolve imported literal constants (e.g. the incumbent bootstrap's cacheFile)
  // from source text, without executing or consulting node_modules.
  for (const n of ast.statements) {
    if (!ts.isImportDeclaration(n) || !n.moduleSpecifier.text.startsWith('.') || !n.importClause?.namedBindings || !ts.isNamedImports(n.importClause.namedBindings)) continue;
    const stem = path.resolve(path.dirname(file), n.moduleSpecifier.text);
    const target = [stem, stem + '.ts', stem + '.js', path.join(stem, 'index.ts')].find(p => existsSync(p) && statSync(p).isFile());
    if (!target) continue;
    const other = ts.createSourceFile(target, readFileSync(target, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const s of other.statements) {
      if (!ts.isVariableStatement(s) || !s.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
      for (const d of s.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer || !ts.isStringLiteralLike(d.initializer)) continue;
        for (const binding of n.importClause.namedBindings.elements) {
          if ((binding.propertyName || binding.name).text === d.name.text) constants.set(binding.name.text, d.initializer);
        }
      }
    }
  }

  function evaluate(n, seen = new Set()) {
    if (!n) return undefined;
    if (ts.isStringLiteralLike(n)) return n.text;
    if (ts.isIdentifier(n) && constants.has(n.text) && !seen.has(n.text)) {
      return evaluate(constants.get(n.text), new Set([...seen, n.text]));
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const a = evaluate(n.left, seen), b = evaluate(n.right, seen);
      if (a !== undefined && b !== undefined) return a + b;
    }
    if (n.getText(ast) === 'import.meta.url') return pathToFileURL(file).href;
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'href') return evaluate(n.expression, seen);
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const args = [...(n.arguments || [])].map(a => evaluate(a, seen));
      const name = n.expression.getText(ast).split('.').at(-1);
      if (args.some(a => a === undefined)) return undefined;
      if (name === 'URL') return new URL(...args).href;
      if (name === 'fileURLToPath') return fileURLToPath(args[0]);
      if (name === 'pathToFileURL') return pathToFileURL(args[0]).href;
      if (name === 'dirname') return path.dirname(args[0]);
      if (name === 'resolve') return path.resolve(...args);
      if (name === 'join') return path.join(...args);
    }
    if (ts.isTemplateExpression(n)) {
      let value = n.head.text;
      for (const s of n.templateSpans) {
        const v = evaluate(s.expression, seen);
        // Query suffixes do not select a different module/package.
        if (v === undefined && value.includes('?')) return value.split('?')[0];
        if (v === undefined) return undefined;
        value += v + s.literal.text;
      }
      return value;
    }
    return undefined;
  }

  for (const [name, value] of constants) {
    if (ts.isCallExpression(value) && /(?:^|\.)createRequire$/.test(value.expression.getText(ast))) {
      let base = evaluate(value.arguments[0]);
      if (base?.startsWith('file:')) base = fileURLToPath(base);
      requireBases.set(name, base);
    }
  }
  function add(n, expr, kind, issuer = file) {
    const pos = ast.getLineAndCharacterOfPosition(n.getStart(ast));
    rows.push({ file, line: pos.line + 1, spec: evaluate(expr), expression: expr?.getText(ast), kind, issuer });
  }
  function visit(n) {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) {
      if (n.moduleSpecifier) add(n, n.moduleSpecifier, 'esm');
    } else if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference)) {
      add(n, n.moduleReference.expression, 'import-equals');
    } else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument)) {
      add(n, n.argument.literal, 'type');
    } else if (ts.isCallExpression(n)) {
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword) add(n, n.arguments[0], 'dynamic');
      else if (ts.isIdentifier(n.expression) && requireBases.has(n.expression.text)) {
        add(n, n.arguments[0], 'require', requireBases.get(n.expression.text) ?? null);
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(ast);
  return rows;
}

function audit(rows, manifests, repoRoot) {
  if (!rows.length) throw new Error('zero import specifiers checked');
  const problems = [], unresolved = [], counts = { specifiers: rows.length, builtin: 0, local: 0, declared: 0, generated: 0 };
  for (const row of rows) {
    let { spec, issuer } = row;
    if (!spec || !issuer) { unresolved.push({ ...row, reason: 'nonliteral specifier or unresolved createRequire base' }); continue; }
    if (builtins.has(spec)) { counts.builtin++; continue; }
    if (/^(?:https?:|data:)/.test(spec)) { unresolved.push({ ...row, reason: 'network/data import has no manifest contract' }); continue; }
    if (spec.startsWith('file:')) spec = fileURLToPath(spec);
    // A direct node_modules path must not bypass manifest checking.
    if (spec.startsWith('.') || path.isAbsolute(spec)) {
      const target = path.resolve(path.dirname(issuer), spec.split('?')[0]);
      const marker = `${path.sep}node_modules${path.sep}`;
      if (!target.includes(marker)) {
        counts.local++;
        if (target.includes(`${path.sep}.quartz-cache${path.sep}`)) counts.generated++;
        continue;
      }
      const at = target.indexOf(marker);
      issuer = path.join(target.slice(0, at), 'package.json');
      spec = target.slice(at + marker.length).split(path.sep).join('/');
    }
    const pkg = packageName(spec);
    const typePkg = '@types/' + (pkg.startsWith('@') ? pkg.slice(1).replace('/', '__') : pkg);
    const eligible = manifests.filter(m => issuer === m.file || path.dirname(issuer).startsWith(path.dirname(m.file) + path.sep) || path.dirname(issuer) === path.dirname(m.file));
    const allowed = eligible.some(m => m.deps.has(pkg) || (row.kind !== 'require' && m.deps.has(typePkg)));
    if (allowed) { counts.declared++; continue; }
    let onDisk = false;
    try { createRequire(issuer).resolve(spec); onDisk = true; } catch { /* diagnostic only */ }
    problems.push({ ...row, spec, package: pkg, onDisk, manifests: eligible.map(m => path.relative(repoRoot, m.file)) });
  }
  return { counts, problems, unresolved, exit: unresolved.length ? 2 : problems.length ? 1 : 0 };
}

function selftest() {
  const base = '/fixture', source = `${base}/source`, deps = new Set(['preact', '@scope/pkg', '@types/hast']);
  const manifests = [{ file: `${base}/package.json`, deps: new Set() }, { file: `${source}/package.json`, deps }];
  let checked = 0;
  const proof = (name, text, want, file = `${source}/case.ts`) => {
    const result = audit(parse(file, text), manifests, base);
    assert.equal(result.exit, want, name);
    assert.ok(result.counts.specifiers > 0);
    checked++;
    console.log(`PASS ${name}: coverage=${result.counts.specifiers}, exit=${want}`);
    return result;
  };
  proof('declared scoped/subpath/builtins', 'import "preact/jsx-runtime"; export {} from "@scope/pkg/sub"; import "node:fs"', 0);
  proof('phantom toml', 'import toml from "toml"', 1);
  proof('comment/string are not imports', '// import "toml"\nconst x="require(\\"toml\\")"; import "preact"', 0);
  proof('root cannot borrow source manifest', 'import "preact"', 1, `${base}/script.mjs`);
  proof('dynamic literal phantom', 'await import("toml")', 1);
  proof('unknown dynamic fails closed', 'await import(process.env.PACKAGE)', 2);
  proof('type-only phantom', 'import type { X } from "toml"; type Y = import("toml").Y', 1);
  proof('declared type package', 'import type {Root} from "hast"', 0);
  proof('require phantom', 'const t = require("toml")', 1);
  proof('explicit createRequire source boundary', 'import {createRequire} from "node:module"; const r=createRequire(new URL("./source/package.json", import.meta.url)); r("preact")', 0, `${base}/tool.mjs`);
  proof('node_modules path is no bypass', 'import "../node_modules/toml/index.js"', 1);
  assert.throws(() => audit([], manifests, base), /zero/); checked++;
  const realManifest = JSON.parse(readFileSync(path.join(toolRoot, 'source/package.json')));
  const actual = [{ file: path.join(toolRoot, 'source/package.json'), deps: new Set(Object.keys({ ...realManifest.dependencies, ...realManifest.devDependencies })) }];
  const real = audit(parse(path.join(toolRoot, 'source/phantom-proof.ts'), 'import "toml"'), actual, toolRoot);
  assert.equal(real.exit, 1);
  assert.equal(real.problems[0].package, 'toml');
  console.log(`PASS actual toml: disk=${real.problems[0].onDisk}, manifest=undeclared, exit=1`); checked++;
  console.log(`PASS coverage: ${checked} phantom-import assertions`);
}

function main() {
  if (argv.includes('--selftest')) return selftest();
  const manifests = ['package.json', 'source/package.json'].map(p => {
    const file = path.join(root, p), m = JSON.parse(readFileSync(file));
    return { file, deps: new Set(Object.keys({ ...m.dependencies, ...m.devDependencies, ...m.optionalDependencies })) };
  });
  const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  const files = [...new Set(tracked.split('\0'))].filter(p =>
    /^(?:source\/|scripts\/|neural\/(?:src|build)\/|forward\/)/.test(p) && /\.(?:[cm]?js|jsx|tsx?)$/.test(p) &&
    !/(?:^|\/)(?:node_modules|public|static|dist|\.quartz-cache|\.worktrees)\//.test(p) && !/\.(?:test|spec)\.[^.]+$/.test(p));
  if (!files.length) throw new Error('zero JS/TS build inputs selected');
  const rows = files.flatMap(p => parse(path.join(root, p), readFileSync(path.join(root, p), 'utf8')));
  const result = audit(rows, manifests, root);
  console.log(`coverage: files=${files.length}, manifests=${manifests.length}, ${JSON.stringify(result.counts)}`);
  for (const p of result.problems) console.log(`FAIL ${path.relative(root, p.file)}:${p.line} ${p.spec}: undeclared in ${p.manifests.join(' + ')}; installed-only=${p.onDisk}`);
  for (const p of result.unresolved) console.log(`ERROR ${path.relative(root, p.file)}:${p.line}: ${p.reason}; ${p.expression}`);
  console.log(`${result.exit === 0 ? 'PASS' : result.exit === 1 ? 'FAIL' : 'NO VERDICT'} JS/TS manifest audit; Python provisioning: check_build_chains.py`);
  process.exitCode = result.exit;
}

try { main(); } catch (e) { console.error(`ERROR coverage incomplete: ${e.message}`); process.exitCode = 2; }
