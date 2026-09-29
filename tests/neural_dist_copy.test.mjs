// Every package.json script that copies the app bundle out of neural/dist copies ALL of it.
//
// neural/build/build.mjs writes four files (neural.js, neural.css, and the deferred reading.css and
// reference.css), and more may follow. regenerate:neural and e2e-full.yml copy `neural/dist/*`.
// Until v1.204.5, dev:neural and dev:neural:app copied only neural.js and neural.css. That was a
// merge-in regression: c15184d12 (09-21) kept the programme's pre-v1.189.0 line over dev's
// wildcard. So a local :8080 serve had no reading or reference styles, while CI and the deploys did,
// and nothing noticed. The same question answered in three places must give one answer
// (CLAUDE.md §6.5).
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const scripts = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts

test("every script that copies from neural/dist copies the whole directory", () => {
  const copying = Object.entries(scripts).filter(([, cmd]) => /\bcp\b[^&|;]*\bneural\/dist\//.test(cmd))
  const names = copying.map(([name]) => name)
  // Positive coverage: a matcher that stopped matching must not read as clean (CLAUDE.md §6.6).
  for (const required of ["dev:neural", "dev:neural:app", "regenerate:neural"]) {
    assert.ok(names.includes(required), `${required} no longer copies from neural/dist — or this matcher broke`)
  }
  for (const [name, cmd] of copying) {
    const sources = [...cmd.matchAll(/\bcp\b((?:\s+-\S+)*)((?:\s+[^\s&|;]+)+)/g)]
      .flatMap((m) => m[2].trim().split(/\s+/).slice(0, -1))
      .filter((src) => src.startsWith("neural/dist/"))
    assert.ok(sources.length > 0, `${name}: found no neural/dist source in its cp`)
    assert.deepEqual(sources, ["neural/dist/*"], `${name} copies ${sources.join(" ")} — a named subset of the bundle`)
  }
  console.log(`scripts copying the whole of neural/dist: ${names.join(", ")}`)
})
