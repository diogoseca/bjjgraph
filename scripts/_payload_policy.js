/**
 * The three-band payload policy — JS twin of scripts/_payload_policy.py.
 *
 * The python file carries the full rationale (the owner's words, why a self-advancing baseline
 * is a delta check that never runs, why a missing baseline is a hard fail). READ THAT ONE. This
 * file exists only because the browser gate — e2e/journeys/payload-first-hand.spec.ts — cannot
 * call python, and the policy has to be identical on both sides.
 *
 * TWO IMPLEMENTATIONS, PINNED EQUAL: tests/payload_policy.test.mjs runs this file and
 * scripts/_payload_policy.py over the same committed case table
 * (tests/artifacts/payload_policy_cases.json) and fails on the first disagreement. That test is
 * in `npm run test:units`, so it fires on a push to dev. Change a band here and you must change
 * it there, or the unit suite says so before a deploy does.
 *
 * CommonJS on purpose: the repo has no `"type": "module"` and no tsconfig, so Playwright
 * transpiles the spec's `import` to `require()` — an .mjs here would fail to load at collection
 * time, which is the one failure mode a gate must not have.
 */
"use strict"

const FORMAT = 1
const PASS = "pass"
const WARN = "warn"
const FAIL = "fail"

const fmt = (n) => `${Number(n).toLocaleString("en-US")} B`

/** Thrown when the policy file is missing, unreadable or malformed. Always fatal. */
class PolicyError extends Error {}

const isInt = (v) => typeof v === "number" && Number.isInteger(v)

function validateSpec(name, spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec))
    throw new PolicyError(`metric ${JSON.stringify(name)}: expected an object`)
  for (const k of ["target", "action", "delta_cap"]) {
    const v = spec[k]
    if (!isInt(v) || v <= 0)
      throw new PolicyError(
        `metric ${JSON.stringify(name)}: ${k} must be a positive integer, got ${JSON.stringify(v)}`,
      )
  }
  if (spec.target > spec.action)
    throw new PolicyError(
      `metric ${JSON.stringify(name)}: target ${spec.target} is above action ${spec.action} — ` +
        `the warn band would be empty and every overage would be a hard fail`,
    )
  if (typeof spec.gate !== "string" || !spec.gate)
    throw new PolicyError(`metric ${JSON.stringify(name)}: \`gate\` must name the enforcing gate`)
}

/** Read and structurally validate the policy. Never returns a default. */
function load(path) {
  const { readFileSync, existsSync } = require("node:fs")
  if (!existsSync(path))
    throw new PolicyError(`no payload policy at ${path} — it is committed state, not a cache`)
  let doc
  try {
    doc = JSON.parse(readFileSync(path, "utf8"))
  } catch (e) {
    throw new PolicyError(`${path} is not valid JSON: ${e.message}`)
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc))
    throw new PolicyError(`${path} must be a JSON object`)
  if (doc.format !== FORMAT)
    throw new PolicyError(`${path} is format ${JSON.stringify(doc.format)}, this gate needs ${FORMAT}`)
  const metrics = doc.metrics
  if (!metrics || typeof metrics !== "object" || !Object.keys(metrics).length)
    throw new PolicyError(`${path} carries no metrics — a policy over nothing is not a policy`)
  for (const [name, spec] of Object.entries(metrics)) validateSpec(name, spec)
  return doc
}

/** The metrics one gate owns. Its length is that gate's coverage floor. */
function metricsFor(doc, gate) {
  return Object.fromEntries(Object.entries(doc.metrics).filter(([, s]) => s.gate === gate))
}

/**
 * Apply the three bands plus the delta cap to one metric.
 * `value` is judged by the bands; `delta_value` is what the delta is measured on (the same
 * number for most metrics, deliberately not for first_hand_gzip_bytes — see the policy file's
 * `delta_measured_on`). Returns {verdict, delta, lines, failures}.
 */
function evaluate(name, spec, value, deltaValue) {
  const { target, action, delta_cap: cap } = spec
  const baseline = spec.baseline
  const lines = []
  const failures = []

  if (!isInt(baseline)) {
    failures.push(
      `${name}: NO DELTA BASELINE — \`baseline\` is ${JSON.stringify(baseline)} in ` +
        `tests/artifacts/payload_policy.json. The delta cap cannot run without one, and a delta ` +
        `check that did not run must not look like one that passed. Seed it with ` +
        `\`python3 scripts/check_payload_budget.py --accept-baseline ${name} --reason "..."\`.`,
    )
    return { verdict: FAIL, delta: null, lines, failures }
  }

  const delta = deltaValue - baseline
  let deltaTxt = `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toLocaleString("en-US")} B since baseline ${fmt(baseline)}`
  if (spec.baseline_ref) deltaTxt += ` (${spec.baseline_ref})`

  if (delta > cap)
    failures.push(
      `${name}: GREW ${deltaTxt}, over the ${fmt(cap)} per-change cap. Absolute figure ` +
        `${fmt(value)} is ${value <= action ? "under" : "over"} the ${fmt(action)} action ` +
        `threshold — the cap is about the SIZE OF THE STEP, not where it landed. Either shed ` +
        `the bytes or accept the step deliberately: ` +
        `\`python3 scripts/check_payload_budget.py --accept-baseline ${name} --reason "..."\`.`,
    )

  let verdict
  if (value > action) {
    failures.push(
      `${name}: ${fmt(value)} is over the ${fmt(action)} ACTION threshold (target ${fmt(target)}). ` +
        `This band is a hard stop, not an indication.`,
    )
    verdict = FAIL
  } else if (value > target) {
    lines.push(
      `⚠ ${name}: ${fmt(value)} is over the ${fmt(target)} target (action at ${fmt(action)}, ` +
        `${fmt(action - value)} of room) · ${deltaTxt}`,
    )
    verdict = WARN
  } else {
    lines.push(`${name}: ${fmt(value)} / target ${fmt(target)} · ${deltaTxt}`)
    verdict = PASS
  }
  if (failures.length) verdict = FAIL
  return { verdict, delta, lines, failures }
}

module.exports = { FORMAT, PASS, WARN, FAIL, PolicyError, load, metricsFor, evaluate, validateSpec, fmt }
