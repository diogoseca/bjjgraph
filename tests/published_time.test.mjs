// Exercises the real transformer AND rendered Head, not a source-text approximation.
// Full-history clone, linked worktree, shallow clone, and untracked local notes all lack
// publication provenance unless frontmatter supplies it. Commit/checkout time is not
// publication time. A fixed clock, git's first/last commit, or dates.created in Head must
// fail these tests. The companion @curated journey checks the built site on deploys.
// Not covered: actual first-publication dates, live CDN output, or git modification-date
// fidelity with shallow history (publication metadata must still be honest there).
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(path.join(ROOT, "source/package.json"))
const { tsImport } = require("tsx/esm/api")
const options = { parentURL: import.meta.url, tsconfig: path.join(ROOT, "source/tsconfig.json") }
const { CreatedModifiedDate } = await tsImport(
  "../source/quartz/plugins/transformers/lastmod.ts",
  options,
)
const { default: makeHead } = await tsImport("../source/quartz/components/Head.tsx", options)
const { render } = require("preact-render-to-string")

const COMMITTED = "2020-02-03T04:05:06.000Z"
const AUTHORED = "2018-06-07T08:09:10.000Z"

async function transform(cwd, frontmatter = {}, filename = "Note.md") {
  const file = {
    cwd: path.join(cwd, "source"),
    data: {
      filePath: `../content/${filename}`,
      slug: "Note",
      frontmatter: { title: "Note", ...frontmatter },
      schemas: ["WebPage", "Article", "CollectionPage"].map((type) => ({ "@type": type })),
    },
  }
  await CreatedModifiedDate().markdownPlugins({})[0]()({}, file)
  return file.data
}

function head(data) {
  const html = render(
    makeHead()({
      cfg: { locale: "en-US", baseUrl: "example.invalid", theme: { cdnCaching: false } },
      fileData: data,
      externalResources: { css: [], js: [] },
    }),
  )
  const publication = html.match(/<meta property="article:published_time" content="([^"]+)"/)
  const publicationTags = (html.match(/<meta property="article:published_time"/g) ?? []).length
  const modification = html.match(/<meta property="article:modified_time" content="([^"]+)"/)
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]))
    .filter((schema) => ["WebPage", "Article", "CollectionPage"].includes(schema["@type"]))
  assert.equal(schemas.length, 3, "all enriched entity types must actually be rendered")
  return {
    html,
    publication: publication?.[1],
    publicationTags,
    modification: modification?.[1],
    schemas,
  }
}

function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "published-time-"))
  const original = path.join(tmp, "original")
  fs.mkdirSync(path.join(original, "content"), { recursive: true })
  fs.mkdirSync(path.join(original, "source"))
  fs.writeFileSync(path.join(original, "source/.keep"), "")
  fs.writeFileSync(path.join(original, "content/Note.md"), "# Note\n")
  const git = (...args) =>
    execFileSync("git", ["-C", original, ...args], {
      env: { ...process.env, GIT_AUTHOR_DATE: COMMITTED, GIT_COMMITTER_DATE: COMMITTED },
      stdio: ["ignore", "pipe", "pipe"],
    })
  git("init", "-q")
  git("add", "content/Note.md", "source/.keep")
  git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "Add note")
  return { tmp, original, git }
}

test("publication metadata never invents checkout or commit dates across repository shapes", async () => {
  const { tmp, original, git } = fixture()
  try {
    const clone = path.join(tmp, "clone")
    const worktree = path.join(tmp, "worktree")
    const shallow = path.join(tmp, "shallow")
    git("clone", "-q", original, clone)
    git("worktree", "add", "-q", "--detach", worktree)
    git("clone", "-q", "--depth=1", `file://${original}`, shallow)
    assert.ok(fs.statSync(path.join(clone, ".git")).isDirectory())
    assert.ok(fs.statSync(path.join(worktree, ".git")).isFile())
    assert.equal(
      execFileSync("git", ["-C", shallow, "rev-parse", "--is-shallow-repository"])
        .toString()
        .trim(),
      "true",
    )
    for (const cwd of [original, clone, worktree, shallow]) {
      const data = await transform(cwd)
      assert.equal(data.dates.modified.toISOString(), COMMITTED, cwd)
      const result = head(data)
      assert.equal(
        result.publication,
        undefined,
        "unknown publication must be omitted, not checkout birthtime",
      )
      assert.equal(
        result.publicationTags,
        0,
        "unknown publication must not leave an empty meta tag",
      )
      assert.equal(
        data.dates.published,
        undefined,
        "missing publishDate must not become the build clock",
      )
      assert.equal(result.modification, COMMITTED)
      for (const schema of result.schemas) {
        assert.equal(schema.datePublished, undefined)
        assert.equal(schema.dateModified, COMMITTED)
      }
      const authored = head(await transform(cwd, { publishDate: AUTHORED }))
      assert.equal(authored.publication, AUTHORED)
      for (const schema of authored.schemas) assert.equal(schema.datePublished, AUTHORED)
    }
    fs.writeFileSync(path.join(original, "content/Untracked.md"), "# Not published\n")
    assert.equal(head(await transform(original, {}, "Untracked.md")).publication, undefined)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test("authored publication wins over creation; missing and invalid publication stay absent", async () => {
  const { tmp, original } = fixture()
  try {
    for (const [frontmatter, expected] of [
      [{ publishDate: AUTHORED, date: "2017-01-01" }, AUTHORED],
      [{ date: "2017-01-01" }, "2017-01-01T00:00:00.000Z"],
      [{ publishDate: "2018-06-07T10:09:10+02:00" }, AUTHORED],
      [{ publishDate: "not a date" }, undefined],
      [{}, undefined],
    ]) {
      const data = await transform(original, frontmatter)
      const result = head(data)
      assert.equal(result.publication, expected, JSON.stringify(frontmatter))
      assert.equal(result.publicationTags, expected === undefined ? 0 : 1)
      assert.equal(data.dates.published?.toISOString(), expected)
      for (const schema of result.schemas) assert.equal(schema.datePublished, expected)
      assert.equal(result.modification, COMMITTED)
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
