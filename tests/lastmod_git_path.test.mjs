// ── THE PATH QUARTZ HANDS GIT (v1.148.2) ────────────────────────────────────────────────────
//
// `CreatedModifiedDate` (source/quartz/plugins/transformers/lastmod.ts) asks libgit2 for a
// file's last-commit date. It used to ask with `file.data.filePath`, which is
// `joinSegments(argv.directory, fp)` — under `quartz build -d ../content` run from `source/`
// that is `../content/Positions/Mount.md`. libgit2 resolves a pathspec against the repo WORKDIR
// and cannot follow a `..` out of it, so every lookup threw and every date silently came from
// the filesystem mtime instead. 4,618 of 4,618 files, from v1.37.0 until v1.148.2.
//
// WHAT THIS FILE COVERS, AND WHAT IT DOES NOT:
//  · It builds a THROWAWAY repo shaped like this one (workdir/content + workdir/source) and
//    drives the real `getFileLatestModifiedDate` (the sync twin of the call lastmod makes, same
//    pathspec resolution), so the rule is proven against libgit2
//    itself rather than against a second reading of the docs. Throwaway because the CI checkout
//    is `fetch-depth: 2` — asserting real dates against this repo's own history would be
//    testing the clone depth, not the fix.
//  · It PINS the call site, so reverting lastmod.ts to `file.data.filePath` turns this red.
//    That pin is a source-level assertion: a root `node --test` runner cannot import a .ts
//    Quartz plugin without a transpile step, so the transformer's own control flow (the
//    untracked-warning cap, the bare-repo warning) is NOT executed here. Those are unguarded.
//  · NON-KILL, recorded so nobody later reads this as broader than it is: a mutant that swaps
//    `repo.workdir()` for a hard-coded correct path would survive both tests.
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const LASTMOD = path.join(REPO, "source/quartz/plugins/transformers/lastmod.ts")

// Same derivation lastmod.ts performs, kept here only so the throwaway-repo test can state the
// expected spelling. The call site itself is pinned separately below.
const toPosix = (p) => p.split(path.sep).join("/")
const gitRelative = (workdir, fullFp) => path.posix.relative(toPosix(workdir), toPosix(fullFp))

function loadRepositoryCtor() {
  // @napi-rs/simple-git is a dependency of the Quartz sub-package, not of the root one.
  try {
    const requireFromSource = createRequire(path.join(REPO, "source/package.json"))
    return requireFromSource("@napi-rs/simple-git").Repository
  } catch (err) {
    return null
  }
}

test("libgit2 resolves a workdir-relative pathspec and rejects a directory-prefixed one", () => {
  const Repository = loadRepositoryCtor()
  if (!Repository) {
    // A skip path PRINTS (CLAUDE.md §6.6): "never looked" must not read like "found no problems".
    console.log("SKIP: @napi-rs/simple-git not installed under source/ — run `npm install` first")
    return
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bjj-lastmod-"))
  try {
    // The shape that broke: content lives beside the directory quartz is invoked from, and is
    // reached with a `..`, so filePath leaves the workdir while the pathspec must not.
    fs.mkdirSync(path.join(tmp, "content"))
    fs.mkdirSync(path.join(tmp, "source"))
    fs.writeFileSync(path.join(tmp, "content", "Note.md"), "# note\n")
    const git = (...args) =>
      execFileSync("git", ["-C", tmp, ...args], { stdio: ["ignore", "pipe", "pipe"] })
    git("init", "-q")
    git("config", "user.email", "test@example.invalid")
    git("config", "user.name", "test")
    git("add", "content/Note.md")
    git("commit", "-qm", "add note")

    const repo = Repository.discover(path.join(tmp, "source"))
    const workdir = repo.workdir()
    assert.ok(workdir, "a non-bare repo must report a workdir")

    // What build.ts hands the transformer, and what the transformer turns it into.
    const filePath = "../content/Note.md"
    const fullFp = path.posix.join(toPosix(path.join(tmp, "source")), filePath)
    const gitFp = gitRelative(workdir, fullFp)
    assert.equal(gitFp, "content/Note.md", "the pathspec must be relative to the repo workdir")
    assert.ok(!gitFp.startsWith(".."), "a pathspec may never leave the workdir")

    // The claim, against the real API: the old spelling throws, the new one returns a date.
    assert.throws(
      () => repo.getFileLatestModifiedDate(filePath),
      /Failed to get commit/,
      "the directory-prefixed spelling must still be rejected — if this ever starts passing, " +
        "the bug this test exists for can no longer be detected by it",
    )
    const when = repo.getFileLatestModifiedDate(gitFp)
    assert.ok(Number.isFinite(when) && when > 0, "the workdir-relative spelling must resolve")
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test("lastmod.ts asks git with a workdir-derived path, not file.data.filePath", () => {
  const src = fs.readFileSync(LASTMOD, "utf8")

  assert.match(
    src,
    /repo\.workdir\(\)/,
    "lastmod.ts must derive its pathspec from the repo workdir",
  )
  assert.match(
    src,
    /getFileLatestModifiedDateAsync\(gitFp\)/,
    "lastmod.ts must pass the workdir-relative path to git",
  )
  assert.doesNotMatch(
    src,
    /getFileLatestModifiedDateAsync\(\s*file\.data\.filePath/,
    "regression: filePath is directory-prefixed and libgit2 cannot resolve it",
  )
})
