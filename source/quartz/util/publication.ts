import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"

const exec = promisify(execFile)
const pending = new Map<string, Promise<Record<string, string>>>()

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
 * page repeats history thousands of times. Instead enumerate Markdown-add commits once,
 * then let ONE diff-tree process detect their renames/copies, including unchanged copy
 * sources. Apply each commit's path changes simultaneously, and continue across deleted /
 * regenerated Markdown just as --follow does. The complete corpus is checked against
 * individual --follow results in the investigation; fixtures pin those transitions.
 *
 * No filesystem or clock fallback. Shallow/unavailable history is unknown. Preparation
 * runs once before parser workers and its immutable lookup is passed to each worker.
 */
async function collect(cwd: string, head: string): Promise<Record<string, string>> {
  const started = performance.now()
  if ((await git(cwd, ["rev-parse", "--is-shallow-repository"])).trim() === "true") {
    console.log("Publication history is shallow; unauthored publication dates stay absent")
    return {}
  }
  const paths = (await git(cwd, ["ls-tree", "-rz", "--name-only", head]))
    .split("\0")
    .filter((name) => name.endsWith(".md"))
  const commits = await git(cwd, [
    "log",
    "--topo-order",
    "--format=%H",
    "--no-renames",
    "--diff-filter=A",
    head,
    "--",
    "*.md",
  ])
  if (!commits.trim()) return {}
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
    commits,
  )
  const dates = publicationDatesFromHistory(history, paths)
  console.log(
    `Publication history: ${Object.keys(dates).length}/${paths.length} Markdown paths, ` +
      `${new Set(Object.values(dates)).size} timestamps in ${((performance.now() - started) / 1000).toFixed(2)}s`,
  )
  return dates
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

export async function gitPublicationDates(directory: string): Promise<Record<string, string>> {
  try {
    const cwd = path.resolve((await git(directory, ["rev-parse", "--show-toplevel"])).trim())
    const head = (await git(cwd, ["rev-parse", "HEAD"])).trim()
    const key = `${cwd}\0${head}`
    if (!pending.has(key)) {
      pending.set(
        key,
        collect(cwd, head).catch((error) => {
          console.warn(
            `Publication history unavailable; unauthored dates stay absent: ${error.message}`,
          )
          return {}
        }),
      )
    }
    return await pending.get(key)!
  } catch {
    console.warn("Publication history unavailable; unauthored dates stay absent")
    return {}
  }
}
