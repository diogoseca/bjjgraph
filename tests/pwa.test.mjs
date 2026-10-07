// Executes the real emitter, checker and Head; malformed/missing assets must go red.
// Workflow fixtures also prove that losing one deploy step or its configuration is red.
// Not covered: live HTTPS headers/redirects, Play signing, device verification, offline
// launch or a service worker. Phase 1 deliberately makes none of those claims.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { depsPromised, SOURCE_DEPS } from "./_deps_promised.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deps = depsPromised(import.meta.url, {
  ...SOURCE_DEPS,
  modules: ["tsx/esm/api", "preact-render-to-string", "preact", "github-slugger", "js-yaml"],
});
const { test, assert, require } = deps;
const { makeHead, render, yaml } = await deps.setup(async () => {
  const { tsImport } = require("tsx/esm/api");
  const { default: makeHead } = await tsImport("../source/quartz/components/Head.tsx", {
    parentURL: import.meta.url,
    tsconfig: path.join(ROOT, "source/tsconfig.json"),
  });
  return { makeHead, render: require("preact-render-to-string").render, yaml: require("js-yaml") };
});
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "pwa/manifest.json")));
const certA = Array(32).fill("AB").join(":");
const certB = Array(32).fill("CD").join(":");
const configured = { TWA_PACKAGE_ID: "org.example.fixture", TWA_SHA256_CERT_FINGERPRINTS: `${certA.toLowerCase()},${certB}\n${certA}` };

function run(script, output, env = {}, release = false) {
  return spawnSync("python3", [path.join(ROOT, "scripts", script), "--output", output, ...(release ? ["--release"] : [])], {
    cwd: ROOT,
    env: { ...process.env, TWA_PACKAGE_ID: "", TWA_SHA256_CERT_FINGERPRINTS: "", ...env },
    encoding: "utf8",
  });
}
function good(result) {
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
}
function bad(result, pattern) {
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, pattern);
}
function head(slug) {
  return render(makeHead()({
    cfg: { locale: "en-US", baseUrl: "bjjgraph.org", theme: { cdnCaching: false } },
    fileData: { slug, frontmatter: { title: "Fixture" } },
    externalResources: { css: [], js: [] },
  }));
}
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pwa-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const slug of ["index", "Positions/Mount/Top", "404"]) {
    const file = path.join(dir, `${slug}.html`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, head(slug));
  }
  fs.copyFileSync(path.join(ROOT, "source/quartz/static/_headers"), path.join(dir, "_headers"));
  return dir;
}

test("real Head resolves install metadata from root, category, deep, trailing slash and arbitrary 404 URLs", () => {
  for (const [slug, route] of [
    ["index", "/"], ["Positions/index", "/Positions/"],
    ["Positions/Mount/Top", "/Positions/Mount/Top"],
    ["Positions/Mount/index", "/Positions/Mount/"],
    ["404", "/missing/deep/path"], ["404", "/missing/deep/path/"],
  ]) {
    const html = head(slug);
    for (const [rel, expected] of [["manifest", "/manifest.webmanifest"], ["apple-touch-icon", "/static/pwa/icon-192.png"]]) {
      const links = [...html.matchAll(new RegExp(`<link rel="${rel}"[^>]*href="([^"]+)"`, "g"))];
      assert.equal(links.length, 1, `${slug} ${rel}`);
      assert.equal(new URL(links[0][1], `https://bjjgraph.org${route}`).href, `https://bjjgraph.org${expected}`, `${slug} ${route}`);
    }
    assert.equal((html.match(/name="theme-color"/g) || []).length, 1);
    assert.ok(html.includes(`name="theme-color" content="${manifest.theme_color}"`));
  }
});

test("default emission is deterministic, preserves other well-known files and cannot pass release", (t) => {
  const dir = fixture(t);
  fs.mkdirSync(path.join(dir, ".well-known"));
  fs.writeFileSync(path.join(dir, ".well-known/api-catalog"), "keep me");
  const emitted = run("regenerate_pwa.py", dir);
  good(emitted);
  assert.match(emitted.stdout, /PLACEHOLDER/);
  good(run("check_pwa.py", dir));
  assert.equal(fs.readFileSync(path.join(dir, ".well-known/api-catalog"), "utf8"), "keep me");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "manifest.webmanifest"))), manifest);
  const links = JSON.parse(fs.readFileSync(path.join(dir, ".well-known/assetlinks.json")));
  assert.equal(links.length, 1);
  assert.deepEqual(links[0].relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(links[0].target.namespace, "android_app");
  assert.equal(links[0].target.package_name, "org.example.bjjgraph");
  assert.deepEqual(links[0].target.sha256_cert_fingerprints, [Array(32).fill("00").join(":")]);
  const before = fs.readFileSync(path.join(dir, ".well-known/assetlinks.json"));
  good(run("regenerate_pwa.py", dir));
  assert.deepEqual(fs.readFileSync(path.join(dir, ".well-known/assetlinks.json")), before);
  bad(run("check_pwa.py", dir, {}, true), /Release requires/);
  bad(run("regenerate_pwa.py", dir, {}, true), /Release requires/);
  assert.deepEqual(fs.readFileSync(path.join(dir, ".well-known/assetlinks.json")), before);
});

test("configured identities support rotation, normalize fingerprints and reject partial or malformed input before writing", (t) => {
  const dir = fixture(t);
  good(run("regenerate_pwa.py", dir, configured, true));
  good(run("check_pwa.py", dir, configured, true));
  const target = JSON.parse(fs.readFileSync(path.join(dir, ".well-known/assetlinks.json")))[0].target;
  assert.equal(target.package_name, configured.TWA_PACKAGE_ID);
  assert.deepEqual(target.sha256_cert_fingerprints, [certA, certB]);
  const before = fs.readFileSync(path.join(dir, ".well-known/assetlinks.json"));
  for (const [env, error] of [
    [{ TWA_PACKAGE_ID: "org.example.fixture" }, /BOTH/],
    [{ TWA_SHA256_CERT_FINGERPRINTS: certA }, /BOTH/],
    [{ ...configured, TWA_PACKAGE_ID: "../../bad" }, /application ID/],
    [{ ...configured, TWA_SHA256_CERT_FINGERPRINTS: "AB:CD" }, /32-byte/],
    [{ ...configured, TWA_SHA256_CERT_FINGERPRINTS: `${certA},` }, /32-byte/],
    [{ ...configured, TWA_SHA256_CERT_FINGERPRINTS: Array(32).fill("00").join(":") }, /example package or zero/],
    [{ ...configured, TWA_PACKAGE_ID: "org.example.bjjgraph" }, /example package or zero/],
  ]) {
    bad(run("regenerate_pwa.py", dir, env), error);
    assert.deepEqual(fs.readFileSync(path.join(dir, ".well-known/assetlinks.json")), before);
  }
  bad(run("check_pwa.py", dir, { ...configured, TWA_PACKAGE_ID: "org.example.wrong" }, true), /does not match/);
});

test("checker rejects absent assets, broken deep links, stale icons, bad DAL and comma-joined headers", (t) => {
  const dir = fixture(t);
  good(run("regenerate_pwa.py", dir));
  for (const relative of ["manifest.webmanifest", ".well-known/assetlinks.json", ...manifest.icons.map(i => i.src.slice(1)), "Positions/Mount/Top.html", "_headers"]) {
    const file = path.join(dir, relative);
    const original = fs.readFileSync(file);
    fs.rmSync(file);
    bad(run("check_pwa.py", dir), /No such file/);
    fs.writeFileSync(file, original);
  }
  for (const [relative, mutate, error] of [
    ["Positions/Mount/Top.html", s => s.replace('rel="manifest"', 'rel="broken"'), /manifest link/],
    ["404.html", s => s.replace('href="/manifest.webmanifest"', 'href="manifest.webmanifest"'), /manifest link/],
    ["index.html", s => s.replace('name="theme-color"', 'name="broken"'), /theme-color/],
    ["manifest.webmanifest", s => s.replace('"standalone"', '"browser"'), /differs/],
    [".well-known/assetlinks.json", s => s.replace('org.example.bjjgraph', 'org.example.wrong'), /does not match/],
    ["_headers", s => s + '\n/*\n  Cache-Control: public, max-age=300\n', /overlapping/],
    ["_headers", s => s.replace('application/manifest+json', 'text/plain'), /Content-Type/],
  ]) {
    const file = path.join(dir, relative);
    const original = fs.readFileSync(file, "utf8");
    const changed = mutate(original);
    assert.notEqual(changed, original, relative);
    fs.writeFileSync(file, changed);
    bad(run("check_pwa.py", dir), error);
    fs.writeFileSync(file, original);
  }
  const file = path.join(dir, "static/pwa/icon-maskable-512.png");
  fs.copyFileSync(path.join(dir, "static/pwa/icon-512.png"), file);
  bad(run("check_pwa.py", dir), /Stale or altered/);
});

function chainError(workflow) {
  const steps = Object.values(workflow.jobs).flatMap(j => j.steps || []);
  const engine = steps.findIndex(s => /quartz build/.test(s.run || ""));
  const pwa = steps.findIndex(s => /npm run regenerate:pwa/.test(s.run || ""));
  const deploy = steps.findIndex(s => /cloudflare\/wrangler-action/.test(s.uses || "") || /pages deploy/.test(s.run || ""));
  if (!(engine >= 0 && pwa > engine && deploy > pwa)) return "missing or misordered PWA emission";
  const step = steps[pwa];
  if (step.run.trim() !== "npm run regenerate:pwa\nnpm run validate:pwa") return "missing checker";
  if (step.if || step["continue-on-error"] || (step["working-directory"] && step["working-directory"] !== ".")) return "conditional or wrong-directory PWA emission";
  for (const key of ["TWA_PACKAGE_ID", "TWA_SHA256_CERT_FINGERPRINTS"]) {
    if (step.env?.[key] !== `\u0024{{ vars.${key} }}`) return `missing public ${key}`;
  }
  const stamps = steps.map((s, i) => /scripts\/apply_affiliate_ref.py/.test(s.run || "") ? i : -1).filter(i => i >= 0);
  if (stamps.length !== 2 || (pwa > stamps[0] && pwa < stamps[1])) return "PWA splits affiliate passes";
  return null;
}

test("root and BOTH explicit deploy chains emit then validate; removal/reordering/env mutants fail", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json")));
  assert.equal(pkg.scripts["regenerate:pwa"], "python3 scripts/regenerate_pwa.py");
  assert.equal(pkg.scripts["validate:pwa"], "python3 scripts/check_pwa.py");
  assert.match(pkg.scripts.build, /build --concurrency 4[\s\S]*npm run regenerate:pwa && npm run validate:pwa[\s\S]*npm run validate:payload/);
  for (const name of ["deploy.yaml", "deploy-dev.yaml"]) {
    const workflow = yaml.load(fs.readFileSync(path.join(ROOT, ".github/workflows", name), "utf8"));
    assert.equal(chainError(workflow), null, name);
    for (const mutation of [
      steps => { steps.splice(steps.findIndex(s => /regenerate:pwa/.test(s.run || "")), 1); },
      steps => { const i = steps.findIndex(s => /regenerate:pwa/.test(s.run || "")); steps.unshift(...steps.splice(i, 1)); },
      steps => { steps.find(s => /regenerate:pwa/.test(s.run || "")).run = "npm run regenerate:pwa"; },
      steps => { delete steps.find(s => /regenerate:pwa/.test(s.run || "")).env.TWA_PACKAGE_ID; },
      steps => { steps.find(s => /regenerate:pwa/.test(s.run || ""))["continue-on-error"] = true; },
    ]) {
      const changed = structuredClone(workflow);
      mutation(Object.values(changed.jobs).find(j => j.steps?.some(s => /regenerate:pwa/.test(s.run || ""))).steps);
      assert.ok(chainError(changed), `workflow mutant must fail: ${name}`);
    }
  }
  const ci = yaml.load(fs.readFileSync(path.join(ROOT, ".github/workflows/ci-validate.yml"), "utf8"));
  for (const input of ["pwa/**", "branding/icon.svg", ".github/workflows/deploy.yaml", ".github/workflows/deploy-dev.yaml"]) {
    assert.ok(ci.on.pull_request.paths.includes(input), input);
  }
});
