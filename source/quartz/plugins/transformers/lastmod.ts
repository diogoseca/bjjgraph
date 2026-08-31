import fs from "fs"
import path from "path"
import { Repository } from "@napi-rs/simple-git"
import { QuartzTransformerPlugin } from "../types"
import chalk from "chalk"

export interface Options {
  priority: ("frontmatter" | "git" | "filesystem")[]
}

const defaultOptions: Options = {
  priority: ["frontmatter", "git", "filesystem"],
}

// An untracked file is normal in a vault (a note you have not committed yet) but it is one line
// of noise per file, and this repo builds 4,618 of them. Say it in full a few times, then count.
const UNTRACKED_WARN_LIMIT = 5

// libgit2 pathspecs are always "/"-separated. `fullFp` below is assembled with `path.posix.join`,
// so this is a no-op on posix and repairs the mixed separators on Windows.
const toPosix = (p: string) => p.split(path.sep).join("/")

function coerceDate(fp: string, d: any): Date {
  const dt = new Date(d)
  const invalidDate = isNaN(dt.getTime()) || dt.getTime() === 0
  if (invalidDate && d !== undefined) {
    console.log(
      chalk.yellow(
        `\nWarning: found invalid date "${d}" in \`${fp}\`. Supported formats: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format`,
      ),
    )
  }

  return invalidDate ? new Date() : dt
}

type MaybeDate = undefined | string | number
export const CreatedModifiedDate: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "CreatedModifiedDate",
    markdownPlugins() {
      return [
        () => {
          let repo: Repository | undefined = undefined
          let repoWorkdir: string | undefined = undefined
          let untracked = 0
          return async (_tree, file) => {
            let created: MaybeDate = undefined
            let modified: MaybeDate = undefined
            let published: MaybeDate = undefined

            const fp = file.data.filePath!
            const fullFp = path.isAbsolute(fp) ? fp : path.posix.join(file.cwd, fp)
            for (const source of opts.priority) {
              if (source === "filesystem") {
                const st = await fs.promises.stat(fullFp)
                created ||= st.birthtimeMs
                modified ||= st.mtimeMs
              } else if (source === "frontmatter" && file.data.frontmatter) {
                created ||= file.data.frontmatter.date as MaybeDate
                modified ||= file.data.frontmatter.lastmod as MaybeDate
                modified ||= file.data.frontmatter.updated as MaybeDate
                modified ||= file.data.frontmatter["last-modified"] as MaybeDate
                published ||= file.data.frontmatter.publishDate as MaybeDate
              } else if (source === "git") {
                if (!repo) {
                  // Get a reference to the main git repo.
                  // It's either the same as the workdir,
                  // or 1+ level higher in case of a submodule/subtree setup
                  repo = Repository.discover(file.cwd)
                  repoWorkdir = repo.workdir() ?? undefined
                  if (!repoWorkdir) {
                    // A bare repo has no workdir to resolve a pathspec against, so every lookup
                    // below is going to throw and every date is about to come from the filesystem.
                    // That is the exact failure this block was rewritten to stop being silent
                    // about — see the comment on `gitFp`. Say it once, plainly.
                    console.log(
                      chalk.yellow(
                        `\nWarning: git repo at ${repo.path()} reports no working directory; ` +
                          `"git" dates are unavailable and every page will fall back to filesystem mtime`,
                      ),
                    )
                  }
                }

                // ── THE PATH GIT WANTS IS WORKDIR-RELATIVE, NOT THE ONE QUARTZ CARRIES ──
                //
                // `file.data.filePath` is `joinSegments(argv.directory, fp)` (processors/parse.ts
                // via build.ts), so under this repo's `quartz build -d ../content` — run from
                // `source/` — it reads `../content/Positions/Mount.md`. libgit2 resolves a
                // pathspec against the repo WORKDIR and cannot follow a `..` out of it, so the
                // lookup threw for EVERY file and fell through to the filesystem mtime below.
                // It failed silently in the way that costs months: the fallback returns a
                // perfectly plausible date, so nothing downstream looked wrong.
                //
                // Measured on v1.148.0 immediately before this fix: 4,618 of 4,618 markdown
                // files warned, and every emitted `article:modified_time` equalled the source
                // file's mtime to the millisecond rather than its last commit date
                // (`Positions/Mount/Top.html` said 2026-08-22T17:54:17.524Z; `stat` on
                // `content/Positions/Mount/Top.md` said .524000000; `git log -1` said
                // 2026-07-16). So the "git" priority had never once worked since it was added
                // in v1.37.0 — the commit titled "Accurate 'Last modified' date" — and the
                // identical-dates-everywhere bug it was written to fix was still live.
                //
                // Derive from `repo.workdir()` rather than from `argv.directory`: the workdir is
                // wherever libgit2 actually rooted the repo, which is the only frame its
                // pathspecs are ever resolved in, and it stays correct for the submodule/subtree
                // case the `discover()` comment above is about.
                //
                // Pinned by tests/lastmod_git_path.test.mjs.
                const gitFp = repoWorkdir
                  ? path.posix.relative(toPosix(repoWorkdir), toPosix(fullFp))
                  : fp

                try {
                  modified ||= await repo.getFileLatestModifiedDateAsync(gitFp)
                } catch {
                  // With the path right, the only cause left is a file git genuinely does not
                  // know — a note not committed yet. Normal; just not 4,618 times.
                  untracked += 1
                  if (untracked <= UNTRACKED_WARN_LIMIT) {
                    console.log(
                      chalk.yellow(
                        `\nWarning: ${gitFp} isn't yet tracked by git, last modification date is not available for this file`,
                      ),
                    )
                  } else if (untracked === UNTRACKED_WARN_LIMIT + 1) {
                    console.log(
                      chalk.yellow(
                        `\nWarning: more untracked files found; suppressing further per-file warnings from this worker`,
                      ),
                    )
                  }
                }
              }
            }

            file.data.dates = {
              created: coerceDate(fp, created),
              modified: coerceDate(fp, modified),
              published: coerceDate(fp, published),
            }
          }
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    dates: {
      created: Date
      modified: Date
      published: Date
    }
  }
}
