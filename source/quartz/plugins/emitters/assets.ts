import { FilePath, joinSegments, slugifyFilePath } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import path from "path"
import fs from "fs"
import { glob } from "../../util/glob"
import { recordPaths, track } from "./emitLedger"
import { Argv } from "../../util/ctx"
import { QuartzConfig } from "../../cfg"

const filesToCopy = async (argv: Argv, cfg: QuartzConfig) => {
  // glob all non MD files in content folder and copy it over
  return await glob("**", argv.directory, ["**/*.md", ...cfg.configuration.ignorePatterns])
}

export const Assets: QuartzEmitterPlugin = () => {
  return {
    name: "Assets",
    getQuartzComponents() {
      return []
    },
    async emit({ argv, cfg }, _content, _resources): Promise<FilePath[]> {
      return track("Assets", async () => {
        const assetsPath = argv.output
        const fps = await filesToCopy(argv, cfg)
        const res: FilePath[] = []
        for (const fp of fps) {
          const ext = path.extname(fp)
          const src = joinSegments(argv.directory, fp) as FilePath
          const name = (slugifyFilePath(fp as FilePath, true) + ext) as FilePath

          const dest = joinSegments(assetsPath, name) as FilePath
          const dir = path.dirname(dest) as FilePath
          await fs.promises.mkdir(dir, { recursive: true }) // ensure dir exists
          await fs.promises.copyFile(src, dest)
          res.push(dest)
        }

        recordPaths(res.map((d) => path.relative(argv.output, d).split(path.sep).join("/")))
        return res
      })
    },
  }
}
