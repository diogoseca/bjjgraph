import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"

const exec = promisify(execFile)
export interface GitDateMaps {
  published: Record<string, string>
  modified: Record<string, string>
}

const pending = new Map<string, Promise<GitDateMaps>>()
const emptyDates = (): GitDateMaps => ({ published: {}, modified: {} })

async function git(cwd: string, args: string[], input?: string): Promise<string> {
  if (input === undefined) {
    const result = await exec("git", ["-c", "log.showSignature=false", ...args], {
      cwd,
      maxBuffer: 64 * 1024 * 1024,
      encoding: "utf8",
    })
    return result.stdout
  }
  return new Promise((resolve, reject) => {
    const child = execFile(
      "git",
      ["-c", "log.showSignature=false", ...args],
      { cwd, maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    )
    child.stdin!.end(input)
  })
}

/**
 * Earliest recorded Markdown history, following Git's rename/copy detection. Markdown
 * predates the JSON migration for some pages and is the published page's own history.
 * This is the site's publication policy, not a claim about an observed first CDN deploy.
 *
 * A first-add lookup loses the 2026 bulk refactor. Walking --follow separately for every
 * page repeats history thousands of times. Instead walk Markdown history once for last modifications and addition-commit IDs,
 * then let ONE diff-tree process detect their renames/copies, including unchanged copy
 * sources. Apply each commit's path changes simultaneously, and continue across deleted /
 * regenerated Markdown just as --follow does. The complete corpus is checked against
 * individual --follow results in the investigation; fixtures pin those transitions.
 *
 * No filesystem or clock fallback. Shallow/unavailable history is unknown. Preparation
 * runs once before parser workers and its immutable lookup is passed to each worker.
 */
async function collect(cwd: string, head: string): Promise<GitDateMaps> {
  const started = performance.now()
  if ((await git(cwd, ["rev-parse", "--is-shallow-repository"])).trim() === "true") {
    console.log("Git date history is shallow; both derived date maps stay absent")
    return emptyDates()
  }
  const paths = (await git(cwd, ["ls-tree", "-rz", "--name-only", head]))
    .split("\0")
    .filter((name) => name.endsWith(".md"))
  const changes = await git(cwd, [
    "log",
    "--topo-order",
    "--format=%x00COMMIT %H %cI",
    "--no-renames",
    "--diff-merges=combined",
    "--name-status",
    "-z",
    head,
    "--",
    "*.md",
  ])
  const { modified, additionCommits } = modificationDatesFromHistory(changes, paths)
  if (!additionCommits.length) return { published: {}, modified }
  const history = await git(
    cwd,
    [
      "-c",
      "diff.renameLimit=0",
      "diff-tree",
      "--stdin",
      "--root",
      "-r",
      "--format=%x00COMMIT %H %aI",
      "--name-status",
      "-z",
      "--find-renames",
      "--find-copies",
      "--find-copies-harder",
      "--diff-filter=ARC",
      "--",
      "*.md",
    ],
    additionCommits.join("\n") + "\n",
  )
  const dates = publicationDatesFromHistory(history, paths)
  console.log(
    `Publication history: ${Object.keys(dates).length}/${paths.length} Markdown paths, ` +
      `${new Set(Object.values(dates)).size} publication timestamps; ` +
      `${Object.keys(modified).length} modification dates in ${((performance.now() - started) / 1000).toFixed(2)}s`,
  )
  return { published: dates, modified }
}

/**
 * First path change in reverse topological history, using the COMMITTER date. Do not
 * take the maximum timestamp: a descendant can have a backdated clock. Combined merge
 * diffs record resolutions that differ from every parent, without restamping files
 * merely brought in by a merge. This is a driver index, not a switch of lastmod's
 * native reader (which skips merge resolutions). Missing paths have no invented date.
 * Addition IDs retain their old topological order for the publication copy/rename pass;
 * combined merge records are deliberately excluded from that existing publication policy.
 */
function modificationDatesFromHistory(history: string, paths: string[]) {
  const tracked = new Set(paths)
  const modified: Record<string, string> = {}
  const additionCommits = new Set<string>()
  let commit = ""
  let date = ""
  const tokens = history.split("\0")
  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i++].replace(/^\n+/, "")
    if (!token) continue
    if (token.startsWith("COMMIT ")) {
      const [, hash, timestamp] = token.split(" ")
      const parsed = new Date(timestamp)
      if (!Number.isFinite(parsed.getTime())) throw new Error("Invalid Git modification timestamp")
      commit = hash
      date = parsed.toISOString()
    } else if (/^[AMDT]+$/.test(token)) {
      const name = tokens[i++]
      if (tracked.has(name) && !Object.hasOwn(modified, name)) modified[name] = date
      if (token === "A") additionCommits.add(commit)
    } else {
      throw new Error(`Unexpected Git modification record: ${token}`)
    }
  }
  return { modified, additionCommits: [...additionCommits] }
}

export function publicationDatesFromHistory(
  history: string,
  paths: string[],
): Record<string, string> {
  let active = new Map(paths.map((name) => [name, [name]]))
  const dates: Record<string, string> = {}
  let date = ""
  let changes: { kind: string; before: string; after?: string }[] = []
  const apply = () => {
    // Read the post-commit names from a snapshot: rename chains/cycles must not cause
    // an earlier record to redirect the aliases that a later record still needs.
    const next = new Map(active)
    for (const change of changes) if (change.after) next.delete(change.after)
    for (const change of changes) {
      if (change.kind === "A") {
        for (const current of active.get(change.before) ?? []) dates[current] = date
      } else {
        const names = active.get(change.after!)
        if (names) next.set(change.before, [...(next.get(change.before) ?? []), ...names])
      }
    }
    active = next
    changes = []
  }
  const tokens = history.split("\0")
  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i++].replace(/^\n+/, "")
    if (!token) continue
    if (token.startsWith("COMMIT ")) {
      apply()
      const parsed = new Date(token.split(" ")[2])
      if (!Number.isFinite(parsed.getTime())) throw new Error("Invalid Git publication timestamp")
      date = parsed.toISOString()
    } else if (token === "A") {
      changes.push({ kind: "A", before: tokens[i++] })
    } else if (/^[RC]\d+$/.test(token)) {
      changes.push({ kind: token[0], before: tokens[i++], after: tokens[i++] })
    } else {
      throw new Error(`Unexpected Git publication record: ${token}`)
    }
  }
  apply()
  return dates
}

export async function gitDateMaps(directory: string): Promise<GitDateMaps> {
  try {
    const cwd = path.resolve((await git(directory, ["rev-parse", "--show-toplevel"])).trim())
    const head = (await git(cwd, ["rev-parse", "HEAD"])).trim()
    const key = `${cwd}\0${head}`
    if (!pending.has(key)) {
      pending.set(
        key,
        collect(cwd, head).catch((error) => {
          console.warn(
            `Git date history unavailable; both derived date maps stay absent: ${error.message}`,
          )
          return emptyDates()
        }),
      )
    }
    return await pending.get(key)!
  } catch {
    console.warn("Git date history unavailable; both derived date maps stay absent")
    return emptyDates()
  }
}

// Preserve the publication API and map semantics; all callers share one root+HEAD cache.
export async function gitPublicationDates(directory: string): Promise<Record<string, string>> {
  return (await gitDateMaps(directory)).published
}

export async function gitModifiedDates(directory: string): Promise<Record<string, string>> {
  return (await gitDateMaps(directory)).modified
}
