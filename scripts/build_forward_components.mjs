import { cp, mkdir, rm } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = resolve(root, "forward")
const output = resolve(root, "source/public/dev")

await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
await cp(source, output, {
  recursive: true,
  filter: (path) => !path.endsWith(".DS_Store"),
})

console.log("[forward] /dev/components/ and /dev/screens/ written")
