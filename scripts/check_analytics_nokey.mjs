#!/usr/bin/env node
/**
 * THE KEYLESS HALF OF THE ANALYTICS CONTRACT — the direction a deploy can never exercise.
 *
 * `scripts/check_analytics_surface.py` grades the built site against the key the build ran with,
 * and both deploy workflows always carry `secrets.POSTHOG_API_KEY`. So the deploys only ever prove
 * the WITH-key direction: exactly one `posthog.init()` carrying that key. That is worth gating —
 * a build that silently stops injecting stops collecting analytics and nothing errors (CLAUDE.md
 * §6.7, "deleting an emitter deletes its telemetry") — but it is only half the contract, and it is
 * not the half the gate was written for.
 *
 * The bug that started this (v1.136.1) was a KEYLESS build emitting `posthog.init("")`, which makes
 * posthog-js log a console.error on every page load after fetching array.js from the CDN. The
 * mutant for it is deleting `&& cfg.analytics.apiKey` from the emitter's provider branch — and that
 * mutant changes NOTHING when a key is present. With a key on every CI path, it survives everywhere:
 * green on PRs (ci-validate never builds) and green on both deploys. A gate that cannot fail for
 * the defect it names is the shape §6.6 is about.
 *
 * So this builds the fixture the environment refuses to provide: a one-file corpus, built with
 * POSTHOG_API_KEY removed from the environment, graded by the same Python gate. Removed, not
 * emptied — `quartz.config.ts` reads `process.env.POSTHOG_API_KEY || ""`, so both spellings reach
 * the emitter as the empty string, but only deletion also proves the gate itself takes the keyless
 * branch rather than being told to.
 *
 * Cheap on purpose: one markdown file, not the 4,600-file corpus, because the emitter's decision
 * does not depend on content. Measured at ~1s versus ~10min for the real build.
 *
 * Run: npm run validate:analytics:nokey
 * Mutate to check it still bites: delete `&& cfg.analytics.apiKey` from the posthog branch of
 * source/quartz/plugins/emitters/componentResources.ts and run this — it must go red.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "analytics-nokey-"));
const corpus = join(work, "content");
const out = join(work, "public");

// The env the fixture build and the gate BOTH see. Deleting the key is the whole point: a build
// that inherited it would take the with-key branch and this file would prove nothing at all.
const env = { ...process.env };
delete env.POSTHOG_API_KEY;

try {
  mkdirSync(corpus, { recursive: true });
  writeFileSync(
    join(corpus, "index.md"),
    "---\ntitle: Analytics gate fixture\n---\n\nOne file is enough: the emitter's analytics branch does not read content.\n",
  );

  console.log("[analytics-nokey] building a one-file corpus with POSTHOG_API_KEY unset…");
  const build = spawnSync("npx", ["quartz", "build", "-d", corpus, "-o", out], {
    cwd: join(ROOT, "source"),
    env,
    encoding: "utf8",
  });
  if (build.status !== 0) {
    console.error(
      `[analytics-nokey] FAIL — the fixture build did not complete (exit ${build.status}).\n` +
        `${(build.stderr || build.stdout || "").slice(-2000)}`,
    );
    process.exit(1);
  }
  // The emitter prints its own skip line; surfacing it here makes the branch taken visible in the
  // CI log rather than inferable from a silent pass (§6.6).
  for (const line of (build.stdout || "").split("\n")) {
    if (/posthog/i.test(line)) console.log(`[analytics-nokey]   emitter said: ${line.trim()}`);
  }

  const gate = spawnSync("python3", [join(ROOT, "scripts", "check_analytics_surface.py"), "--out", out], {
    cwd: ROOT,
    env,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (gate.status !== 0) {
    console.error(
      "[analytics-nokey] FAIL — a build with no POSTHOG_API_KEY did not produce a clean analytics " +
        "surface. That is the v1.136.1 bug: posthog.init(\"\") ships, posthog-js rejects the empty " +
        "token with a console.error on every page load, and the CDN is fetched for nothing. Check " +
        "the `&& cfg.analytics.apiKey` guard in the posthog branch of componentResources.ts.",
    );
    process.exit(1);
  }
  console.log("[analytics-nokey] OK — a keyless build injects no analytics at all.");
} finally {
  rmSync(work, { recursive: true, force: true });
}
