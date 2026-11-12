// SHORT4 mutants for e2e/journeys/question-off-screen.spec.ts (owner, U146 a: a taken-up question whose card wholly leaves the
// screen is put down free, however the scroll began). Same runner as short_phone_mutants.mjs: each mutant edits the SERVED bundle as
// text (source/public, this worktree's own copy), runs the ONE test that names its claim, and counts as killed only when that test
// goes red AT the named assertion; the bundle is restored after every mutant, even on a throw. Run inside the build lock, after
// `npm run dev:neural:app` and a green baseline of the spec:
//   source /home/user/bjj-orchestrator/quartz/acquire-build-lock.sh <seat> "SHORT4 mutants" && node tests/artifacts/question_off_screen_mutants.mjs
// Local names are minified, so every target is a regex over `[\w$]+` that must match EXACTLY once; a throw is never a kill.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"

const root = resolve(import.meta.dirname, "../..")
const app = resolve(root, "source/public/static/neural/app")
const out = process.env.SHORT4_MUTANT_OUT || resolve(process.env.TMPDIR || "/tmp", "short4-mutants")
mkdirSync(out, { recursive: true })
const SPEC = "journeys/question-off-screen\\.spec"
const files = ["reader.js", "neural.js", "neural.css"].map(f => resolve(app, f))
const originals = new Map(files.map(p => [p, readFileSync(p, "utf8")]))

const once = (text, re, to, name) => {
  const n = (text.match(new RegExp(re.source, "g")) || []).length
  if (n !== 1) throw Error(`${name}: target matched ${n} times: ${re}`)
  return text.replace(re, to)
}
const MUTANTS = [
  { name: "off-never-declines", file: "neural.js", why: "a card carried off the screen is never declined (the clock runs on, as before U146 a)",
    edit: t => once(t, /_offTick\(\)\{/, "_offTick(){return;", "off-never-declines"),
    tests: [["carried off from the card, a taken-up question", "carried off from the card, it is put down free"],
            ["carried off by the wheel over the card", "carried off by the wheel, it is put down free"],
            ["the escape drill is put down free", "the drill is put down free: its clock stops"]] },
  { name: "half-off-declines", file: "neural.js", why: "a card counts as gone once any part of it leaves the visible box",
    edit: t => once(t, /([\w$]+)\.bottom>([\w$]+)\+\.5&&\1\.top<([\w$]+)-\.5/, "$1.top>=$2-.5&&$1.bottom<=$3+.5", "half-off-declines"),
    tests: [["partly off screen, a taken-up question is untouched", "partly off screen, it is untouched"]] },
  { name: "park-not-decline", file: "neural.js", why: "off screen the clock only stops; the question stays live and comes back with the card",
    edit: t => once(t, /this\._declineLandQ\("off_screen"\)/, '(this.fx("land_q_declined",{deckKey:null,reason:"off_screen"}),this._disarmLandClock())', "park-not-decline"),
    tests: [["carried off from the card, a taken-up question", "coming back does not resurrect it"]] },
  { name: "drill-excluded", file: "neural.js", why: "the off-screen check skips a catch's drill",
    edit: t => once(t, /(_landView\([\w$]*\)\{(?:var [\w$,]+;)?let [\w$]+=this\._landQ,[\w$]+=this\._landEl;if\()/, '$1this._landMode==="defense"||', "drill-excluded"),
    tests: [["the escape drill is put down free", "the drill is put down free: its clock stops"]] },
  { name: "reach-ignores-view", file: "neural.js", why: "a scroll on the article is a reach even with every answer in view (the reading rule lost)",
    edit: t => once(t, /(_rch\(\)\{[^}]*?\.on)&&![\w$]+\.all/, "$1", "reach-ignores-view"),
    tests: [["the reading rule holds", "the reading rule: declined at once, free"]] },
  // RECORDED NON-KILL, not coverage (SHORT4, measured): the reader returns to the top synchronously at the start of `open()`, so no
  // judging frame falls between a new landing's mount and the reset in this harness, and the journey stays green without the guard.
  // The guard stays because it is what "has left the screen" means and costs two lines; a survivor here is reported, not failed.
  { name: "seen-guard-off", expectSurvive: true, file: "neural.js", why: "a card never yet on screen can be declined (the new-landing reset could put down the question it brings)",
    edit: t => once(t, /([\w$]+)\.seen&&\(\1\.gone=!0,/, "($1.gone=!0,", "seen-guard-off"),
    tests: [["a new landing reached with the reader scrolled far down", "the new landing does not decline the question it brings"]] },
]

const only = process.env.SHORT4_MUTANT_ONLY ? new Set(process.env.SHORT4_MUTANT_ONLY.split(",")) : null
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
      results.push({ mutant: m.name, test: grep, claim, status: r.status, ran, killed, expectSurvive: !!m.expectSurvive })
      console.log(`${killed ? "KILLED  " : m.expectSurvive && ran ? "SURVIVED (recorded non-kill)" : "SURVIVED"} ${m.name} → "${claim}" (exit ${r.status}${ran ? "" : ", NOTHING RAN"}) — ${m.why}`)
    }
  }
} finally {
  for (const [p, t] of originals) writeFileSync(p, t)
}
writeFileSync(resolve(out, "summary.json"), JSON.stringify(results, null, 2))
const bad = results.filter(r => !r.killed && !(r.expectSurvive && r.ran))
const noted = results.filter(r => !r.killed && r.expectSurvive && r.ran).length
console.log(`${results.filter(r => r.killed).length} of ${results.length} killed at their named claim${noted ? `, ${noted} recorded non-kill` : ""}; bundle restored`)
process.exit(bad.length ? 1 : 0)
