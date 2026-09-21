import fs from "fs"
import path from "path"
import { Repository } from "@napi-rs/simple-git"
import { QuartzTransformerPlugin } from "../types"
import chalk from "chalk"
import { gitPublicationDates } from "../../util/publication"

export interface Options {
  priority: ("frontmatter" | "git" | "filesystem")[]
}

const defaultOptions: Options = {
  priority: ["frontmatter", "git", "filesystem"],
}

// An untracked file is normal in a vault (a note you have not committed yet) but it is one line
// of noise per file, and this repo builds 4,618 of them. Say it in full a few times, then count.
const UNTRACKED_WARN_LIMIT = 5

// Each parser worker loads this module once, even though it creates a transformer per
// chunk. Report the missing provenance once rather than once for every undated page.
let reportedMissingPublicationDate = false

// libgit2 pathspecs are always "/"-separated. `fullFp` below is assembled with `path.posix.join`,
// so this is a no-op on posix and repairs the mixed separators on Windows.
const toPosix = (p: string) => p.split(path.sep).join("/")

function coerceDate(fp: string, d: any): Date | undefined {
  const dt = new Date(d)
  const invalidDate = isNaN(dt.getTime()) || dt.getTime() === 0
  if (invalidDate && d !== undefined) {
    console.log(
      chalk.yellow(
        `\nWarning: found invalid date "${d}" in \`${fp}\`. Supported formats: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format`,
      ),
    )
  }

  return invalidDate ? undefined : dt
}

type MaybeDate = undefined | string | number
export const CreatedModifiedDate: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "CreatedModifiedDate",
    markdownPlugins(ctx) {
      return [
        () => {
          let repo: Repository | undefined = undefined
          let repoWorkdir: string | undefined = undefined
          let gitUnavailable = false
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
                published ||= (file.data.frontmatter.publishDate ??
                  file.data.frontmatter.date) as MaybeDate
              } else if (source === "git") {
                if (!repo && !gitUnavailable) {
                  // Get a reference to the main git repo.
                  // It's either the same as the workdir,
                  // or 1+ level higher in case of a submodule/subtree setup
                  try {
                    repo = Repository.discover(file.cwd)
                  } catch {
                    gitUnavailable = true
                    console.warn("Git repository unavailable; unauthored publication stays absent")
                    continue
                  }
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
                if (!repo) continue

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

                if (published === undefined && repoWorkdir) {
                  const dates = ctx.gitPublicationDates ?? (await gitPublicationDates(repoWorkdir))
                  published = dates[gitFp]
                }

                try {
                  // D-202/D-195: the driver walks git ONCE for the whole corpus and hands the
                  // result down as `ctx.gitModifiedDates`. This transformer dominates parse cost,
                  // and effectively all of it is the per-file libgit2 lookup on the next line, so
                  // taking the batched value is the single largest saving on this surface.
                  //
                  // THE SHARE, with the correction that matters if anyone plans against it. The
                  // first figure here was 90.4% / 444 ms per file at N=300 — and that sample
                  // STRIDED across the sorted corpus, which is pessimal for git's pack cache while
                  // a real build walks the list in order. Measured directly, the same native
                  // lookup costs 266.3 ms/file strided and 86.3 ms/file contiguous: a 3.09x
                  // penalty belonging to the SAMPLING, not to the transformer. Corrected share
                  // ~75%, and the corrected model predicts a post-fix parse of 3.94 min against
                  // 4.00 measured on a full incumbent build (D-221) — a 1.4% residual, where the
                  // uncorrected model was out by 1.87 min. A stride is the right shape for
                  // comparing transformers to each other and the wrong one for the absolute cost
                  // of a cache-sensitive one.
                  //
                  // ONE EXCEPTION, which is why this is a conditional and not a substitution: a
                  // path whose date came from a COMBINED MERGE DIFF is named in
                  // `ctx.gitModifiedDatesFromMerge`, and those fall through to the native per-file
                  // lookup unchanged. Three things about that map are load-bearing and none of
                  // them survive being paraphrased:
                  //   · it is `Record<string, true>`, so this is a PRESENCE test — never a
                  //     truthiness test on a value that could legitimately be `false`;
                  //   · it is keyed by the SAME key space as `gitModifiedDates`, i.e. `gitFp`,
                  //     relative to `repo.workdir()` — not `fp`, which is relative to the content
                  //     directory. Keying this on `fp` finds nothing and reads exactly like a
                  //     corpus with no merge-origin entries (CLAUDE.md §6.6);
                  //   · absence of the whole map is normal, not an error: a driver that does not
                  //     supply it leaves every path on the native path, which is the incumbent.
                  //
                  // Parity is therefore BY CONSTRUCTION rather than by tolerance. Every path
                  // either takes a value the walk derived the same way, or takes the native call
                  // untouched; there is no third case and no tolerance band to tune.
                  const batched =
                    ctx.gitModifiedDates && !ctx.gitModifiedDatesFromMerge?.[gitFp]
                      ? ctx.gitModifiedDates[gitFp]
                      : undefined
                  modified ||= batched ?? (await repo.getFileLatestModifiedDateAsync(gitFp))
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

            // Publication is authored or the earliest recorded page history across Git
            // renames/copies. Unknown Git history must remain absent: filesystem birthtime
            // and the build clock are never publication evidence.
            // Pinned through the real transformer and Head by published_time.test.mjs.
            const publicationDate = coerceDate(fp, published)
            if (!publicationDate && !reportedMissingPublicationDate) {
              reportedMissingPublicationDate = true
              console.log(
                `Publication dates: no authored or complete Git date for ${fp}; undated pages omit ` +
                  `article:published_time and datePublished (reported once per worker)`,
              )
            }
            file.data.dates = {
              created: coerceDate(fp, created) ?? new Date(),
              modified: coerceDate(fp, modified) ?? new Date(),
              published: publicationDate,
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
      published?: Date
    }
  }
}
