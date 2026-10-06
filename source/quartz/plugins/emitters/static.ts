import { FilePath, QUARTZ, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import fs from "fs"
import { glob } from "../../util/glob"
import { recordPaths, track } from "./emitLedger"

/** Every regular file under `root`, relative and posix-separated. Attribution only. */
function walkRelative(root: string): string[] {
  const out: string[] = []
  const rec = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = joinSegments(dir, ent.name)
      if (ent.isDirectory()) rec(fp)
      else out.push(fp.slice(root.length + 1))
    }
  }
  if (fs.existsSync(root)) rec(root)
  return out
}

export const Static: QuartzEmitterPlugin = () => ({
  name: "Static",
  getQuartzComponents() {
    return []
  },
  async emit({ argv, cfg }, _content, _resources): Promise<FilePath[]> {
    return track("Static", async () => {
      const staticPath = joinSegments(QUARTZ, "static")
      const fps = await glob("**", staticPath, cfg.configuration.ignorePatterns)
      await fs.promises.cp(staticPath, joinSegments(argv.output, "static"), {
        recursive: true,
        dereference: true,
      })
      // This emitter bypasses write(), so it claims its own paths — and it must claim the WHOLE
      // copied tree, not `fps`. The glob returns 9 while the copy moves 4,952 (D-20), which is
      // the very divergence this seam exists to expose, so attributing only the returned set
      // would leave 4,943 files unclaimed and land them in the "no emitter wrote this" finding.
      recordPaths(walkRelative(joinSegments(argv.output, "static")).map((rel) => `static/${rel}`))
      return fps.map((fp) => joinSegments(argv.output, "static", fp)) as FilePath[]
    })
  },
})
