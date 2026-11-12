// SHORT1 mutants for e2e/journeys/short-phone-answers.spec.ts. Each mutant edits the SERVED bundle as text (source/public, this
// worktree's own copy), runs the ONE test that names its claim, and counts as killed only when that test goes red AT the named
// assertion; the bundle is restored after every mutant, even on a throw. Run inside the build lock, after `npm run dev:neural:app`
// and a green baseline of the spec, never beside another Playwright run (CLAUDE.md §6.4):
//   source /home/user/bjj-orchestrator/quartz/acquire-build-lock.sh <seat> "SHORT1 mutants" && node tests/artifacts/short_phone_mutants.mjs
// Local names are minified and renamed between builds, so every target is a regex over `[\w$]+` that must match EXACTLY once;
// a target that matches nothing or twice throws, and a throw is never a kill.
//
// Recorded non-kill, not coverage: a press on the game part falling through to the reader (gameInput ignored) survives the card
// journey by construction, because with an answer out of view such a press is a reach under SHORT1 too. The journey's claim
// ("a finger on the card declines nothing") is held by scroll-declines instead, the regression this note in card-fold.spec.ts feared.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"

const root = resolve(import.meta.dirname, "../..")
const app = resolve(root, "source/public/static/neural/app")
const out = process.env.SHORT1_MUTANT_OUT || resolve(process.env.TMPDIR || "/tmp", "short1-mutants")
mkdirSync(out, { recursive: true })
const SPEC = "journeys/short-phone-answers\\.spec"
const files = ["reader.js", "neural.js", "neural.css"].map(f => resolve(app, f))
const originals = new Map(files.map(p => [p, readFileSync(p, "utf8")]))

const once = (text, re, to, name) => {
  const n = (text.match(new RegExp(re.source, "g")) || []).length
  if (n !== 1) throw Error(`${name}: target matched ${n} times: ${re}`)
  return text.replace(re, to)
}
const MUTANTS = [
  { name: "reach-off", file: "reader.js", why: "the article reach never starts: a press on the article is reading at once (the old rule)",
    edit: t => once(t, /if\(([\w$]+)&&\1\.on&&!\1\.all\)\{this\.reachQ=this\.app\._landQ;return\}/, "if(!1){this.reachQ=this.app._landQ;return}", "reach-off"),
    tests: [["past the answers, a drag from the article back", "a drag from the article back toward the answers is reaching"],
            ["the escape drill's card", "the drill keeps its clock"]] },
  { name: "reach-ignores-view", file: "reader.js", why: "a press on the article is a reach even with every answer in view",
    edit: t => once(t, /if\(([\w$]+)&&\1\.on&&!\1\.all\)\{this\.reachQ=this\.app\._landQ;return\}/, (m, v) => `if(${v}&&${v}.on){this.reachQ=this.app._landQ;return}`, "reach-ignores-view"),
    tests: [["control: with every answer in view", "with every answer in view, a drag from the article is reading"]] },
  { name: "reach-never-leaves", file: "reader.js", why: "a reach that carries the card off the screen never becomes reading",
    edit: t => once(t, /reachLeft\(\)\{/, "reachLeft(){return;", "reach-never-leaves"),
    tests: [["carries the card off the screen", "carried off the screen, it is reading"]] },
  { name: "scroll-declines", file: "reader.js", why: "every scroll of the reader declines the question, wherever the finger began",
    edit: t => once(t, /this\.layout\(\),this\.reachQ&&this\.reachLeft\(\)/, 'this.layout(),this.app._declineLandQ("reading"),this.reachQ&&this.reachLeft()', "scroll-declines"),
    tests: [["a finger on the card reaches every answer of a taken-up question.*390x631", "a finger on the card declines nothing"]] },
  { name: "card-eats-touch", file: "neural.css", why: "the card refuses to scroll the reader under a finger",
    edit: t => t + "\n.ng-landcard{touch-action:none!important}\n",
    tests: [["a finger on the card reaches every answer of a taken-up question.*390x631", "every answer comes into view"]] },
  { name: "drill-excluded", file: "neural.js", why: "the reach seam ignores a catch's drill",
    edit: t => once(t, /(_landView\(\)\{(?:var [\w$,]+;)?let [\w$]+=this\._landQ,[\w$]+=this\._landEl;if\()/, '$1this._landMode==="defense"||', "drill-excluded"),
    tests: [["the escape drill's card", "the drill keeps its clock"]] },
]

const only = process.env.SHORT1_MUTANT_ONLY ? new Set(process.env.SHORT1_MUTANT_ONLY.split(",")) : null
const results = []
try {
  for (const m of MUTANTS) {
    if (only && !only.has(m.name)) continue
    const path = resolve(app, m.file)
    for (const [grep, claim] of m.tests) {
      writeFileSync(path, m.edit(originals.get(path)))
      const log = resolve(out, `${m.name}--${claim.replace(/[^a-z]+/gi, "-").slice(0, 40)}.log`)
      const r = spawnSync("npx", ["playwright", "test", "-c", "e2e/playwright.config.ts", SPEC, "-g", grep, "--reporter=line", `--output=${resolve(out, "results")}`],
        { cwd: root, encoding: "utf8", env: { ...process.env }, maxBuffer: 64 << 20 })
      writeFileSync(path, originals.get(path))
      const text = (r.stdout || "") + (r.stderr || "")
      writeFileSync(log, text)
      const ran = /(\d+) (failed|passed)/.test(text)
      const killed = r.status !== 0 && text.includes(claim)
      results.push({ mutant: m.name, test: grep, claim, status: r.status, ran, killed })
      console.log(`${killed ? "KILLED  " : "SURVIVED"} ${m.name} → "${claim}" (exit ${r.status}${ran ? "" : ", NOTHING RAN"}) — ${m.why}`)
    }
  }
} finally {
  for (const [p, t] of originals) writeFileSync(p, t)
}
writeFileSync(resolve(out, "summary.json"), JSON.stringify(results, null, 2))
const bad = results.filter(r => !r.killed)
console.log(`${results.length - bad.length} of ${results.length} killed at their named claim; bundle restored`)
process.exit(bad.length ? 1 : 0)
