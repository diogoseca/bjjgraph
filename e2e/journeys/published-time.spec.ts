// Deployment gate: execute authored/undated fixtures against the real transformer and
// Head, then inspect actual served output. No browser navigation or harness stubs.
// Covers publication provenance and OG/JSON-LD agreement; does not establish historical
// publication dates or test the live CDN. The unit fixture includes clone/worktree/shallow
// history, but only a pair of full site builds proves whole-corpus reproducibility.
import { test, expect } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(__dirname, "../..")
const requireFromSource = createRequire(path.join(ROOT, "source/package.json"))
const matter = requireFromSource("gray-matter")

test("@curated publication provenance survives clones and worktrees in the real renderer", () => {
  const output = execFileSync(process.execPath, ["--test", "tests/published_time.test.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000,
  })
  expect(output).toMatch(/# pass [1-9]\d*/)
  expect(output).toContain("# fail 0")
})

test("@curated served publication metadata matches authored evidence in OG and JSON-LD", async ({
  request,
}) => {
  const pages = [
    ["Positions/Mount/Top", "Positions/Mount/Top"],
    ["Principles", "Principles"],
    [
      "Submissions/Anaconda-Choke/from-Dead-Orchard/Attacker",
      "Submissions/Anaconda Choke/from Dead Orchard/Attacker",
    ],
    ["Transitions/Mount-to-Armbar/Attacker", "Transitions/Mount to Armbar/Attacker"],
  ]
  for (const [route, source] of pages) {
    const { data } = matter(fs.readFileSync(path.join(ROOT, "content", `${source}.md`), "utf8"))
    const authored = data.publishDate ?? data.date
    const expected = authored === undefined ? undefined : new Date(authored).toISOString()
    const response = await request.get(`/${route}.html`)
    expect(response.ok(), route).toBeTruthy()
    const html = await response.text()
    const publication = html.match(/<meta property="article:published_time" content="([^"]+)"/)
    const publicationTags = html.match(/<meta property="article:published_time"/g) ?? []
    expect(publicationTags.length, `${route}: publication tag count`).toBe(
      expected === undefined ? 0 : 1,
    )
    expect(publication?.[1], `${route}: publication`).toBe(expected)
    const modified = html.match(/<meta property="article:modified_time" content="([^"]+)"/)
    expect(modified?.[1], `${route}: modification retained`).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
      .map((match) => JSON.parse(match[1]))
      .filter((schema) => ["WebPage", "Article", "CollectionPage"].includes(schema["@type"]))
    expect(schemas.length, `${route}: enriched entities`).toBeGreaterThan(0)
    for (const schema of schemas) {
      expect(schema.datePublished, route).toBe(expected)
      expect(schema.dateModified, route).toBe(modified?.[1])
    }
  }
})
