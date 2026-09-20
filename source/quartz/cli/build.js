import { promises } from "fs"
import fs from "fs"
import path from "path"
import esbuild from "esbuild"
import chalk from "chalk"
import { sassPlugin } from "esbuild-sass-plugin"
import chokidar from "chokidar"
import prettyBytes from "pretty-bytes"
import http from "http"
import serveHandler from "serve-handler"
import { WebSocketServer } from "ws"
import { randomUUID } from "crypto"
import { Mutex } from "async-mutex"
import { version, fp, cacheFile } from "./constants.js"

/**
 * Handles `npx quartz build`
 * @param {*} argv arguments for `build`
 */
export async function createBuildContexts() {
  const main = await esbuild.context({
    entryPoints: {
      "transpiled-build": fp,
      "transpiled-emit-worker": "./quartz/worker.ts",
    },
    outdir: path.dirname(cacheFile),
    outExtension: { ".js": ".mjs" },
    splitting: true,
    bundle: true,
    keepNames: true,
    minifyWhitespace: true,
    minifySyntax: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "preact",
    packages: "external",
    metafile: true,
    sourcemap: true,
    sourcesContent: false,
    plugins: [
      sassPlugin({
        type: "css-text",
        cssImports: true,
      }),
      {
        name: "inline-script-loader",
        setup(build) {
          build.onLoad({ filter: /\.inline\.(ts|js)$/ }, async (args) => {
            let text = await promises.readFile(args.path, "utf8")

            // remove default exports that we manually inserted
            text = text.replace("export default", "")
            text = text.replace("export", "")

            const sourcefile = path.relative(path.resolve("."), args.path)
            const resolveDir = path.dirname(sourcefile)
            const transpiled = await esbuild.build({
              stdin: {
                contents: text,
                loader: "ts",
                resolveDir,
                sourcefile,
              },
              write: false,
              bundle: true,
              minify: true,
              platform: "browser",
              format: "esm",
            })
            const rawMod = transpiled.outputFiles[0].text
            return {
              contents: rawMod,
              loader: "text",
            }
          })
        },
      },
    ],
  })

  // D-22: the incumbent PARSE worker loads styles and inline scripts as EMPTY TEXT.
  // ofm.ts imports callout/checkbox scripts as values; never execute these as modules,
  // and do not silently make parsing use the main-thread resource strings. Emit workers
  // use the full bundle above; their resource input comes from the main context.
  const parse = await esbuild.context({
    entryPoints: ["./quartz/worker.ts"],
    outfile: path.join(path.dirname(cacheFile), "transpiled-worker.mjs"),
    bundle: true,
    keepNames: true,
    platform: "node",
    format: "esm",
    packages: "external",
    sourcemap: true,
    sourcesContent: false,
    plugins: [
      {
        name: "parse-worker-empty-resources",
        setup(build) {
          build.onLoad({ filter: /\.scss$|\.inline\.(ts|js)$/ }, () => ({
            contents: "",
            loader: "text",
          }))
        },
      },
    ],
  })
  return { main, parse }
}

export async function handleBuild(argv) {
  console.log(chalk.bgGreen.black(`\n Quartz v${version} \n`))
  const { main: ctx, parse: parseCtx } = await createBuildContexts()
  const buildMutex = new Mutex()
  // A hard rebuild owns the whole watcher lifetime, including cleanup and replacement.
  // Keep this separate from buildMutex: cleanup waits for content rebuilds that need it.
  const hardBuildMutex = new Mutex()
  let latestBuild = 0
  let cleanupBuild = null
  const build = (clientRefresh) => {
    const generation = ++latestBuild
    return hardBuildMutex.runExclusive(async () => {
      // Source events can arrive in the same millisecond; use a generation, not a timestamp.
      if (generation !== latestBuild) return
      if (cleanupBuild) {
        await cleanupBuild()
        cleanupBuild = null
        console.log(chalk.yellow("Detected a source code change, doing a hard rebuild..."))
      }
      const release = await buildMutex.acquire()

      let result
      try {
        result = await ctx.rebuild()
        await parseCtx.rebuild()
      } finally {
        release()
      }

      if (argv.bundleInfo) {
        const outputFileName = "quartz/.quartz-cache/transpiled-build.mjs"
        const meta = result.metafile.outputs[outputFileName]
        console.log(
          `Successfully transpiled ${Object.keys(meta.inputs).length} files (${prettyBytes(
            meta.bytes,
          )})`,
        )
        console.log(await esbuild.analyzeMetafile(result.metafile, { color: true }))
      }

      // bypass module cache
      // https://github.com/nodejs/modules/issues/307
      const { default: buildQuartz } = await import(`../../${cacheFile}?update=${randomUUID()}`)
      // ^ this import is relative, so base "cacheFile" path can't be used

      cleanupBuild = await buildQuartz(argv, buildMutex, clientRefresh)
      clientRefresh()
    })
  }

  if (argv.serve) {
    const connections = []
    const clientRefresh = () => connections.forEach((conn) => conn.send("rebuild"))

    argv.baseDir ??= ""
    if (argv.baseDir !== "" && !argv.baseDir.startsWith("/")) {
      argv.baseDir = "/" + argv.baseDir
    }

    await build(clientRefresh)
    const server = http.createServer(async (req, res) => {
      if (argv.baseDir && !req.url?.startsWith(argv.baseDir)) {
        console.log(
          chalk.red(
            `[404] ${req.url} (warning: link outside of site, this is likely a Quartz bug)`,
          ),
        )
        res.writeHead(404)
        res.end()
        return
      }

      // strip baseDir prefix
      req.url = req.url?.slice(argv.baseDir.length)

      const serve = async () => {
        const release = await buildMutex.acquire()
        try {
          await serveHandler(req, res, {
            public: argv.output,
            directoryListing: false,
            headers: [
              {
                source: "**/*.*",
                headers: [{ key: "Content-Disposition", value: "inline" }],
              },
            ],
          })
          const status = res.statusCode
          const statusString =
            status >= 200 && status < 300 ? chalk.green(`[${status}]`) : chalk.red(`[${status}]`)
          console.log(statusString + chalk.grey(` ${argv.baseDir}${req.url}`))
        } finally {
          release()
        }
      }

      const redirect = (newFp) => {
        newFp = argv.baseDir + newFp
        res.writeHead(302, {
          Location: newFp,
        })
        console.log(chalk.yellow("[302]") + chalk.grey(` ${argv.baseDir}${req.url} -> ${newFp}`))
        res.end()
      }

      let fp = req.url?.split("?")[0] ?? "/"

      // handle redirects
      if (fp.endsWith("/")) {
        // /trailing/
        // does /trailing/index.html exist? if so, serve it
        const indexFp = path.posix.join(fp, "index.html")
        if (fs.existsSync(path.posix.join(argv.output, indexFp))) {
          req.url = fp
          return serve()
        }

        // does /trailing.html exist? if so, redirect to /trailing
        let base = fp.slice(0, -1)
        if (path.extname(base) === "") {
          base += ".html"
        }
        if (fs.existsSync(path.posix.join(argv.output, base))) {
          return redirect(fp.slice(0, -1))
        }
      } else {
        // /regular
        // does /regular.html exist? if so, serve it
        let base = fp
        if (path.extname(base) === "") {
          base += ".html"
        }
        if (fs.existsSync(path.posix.join(argv.output, base))) {
          req.url = fp
          return serve()
        }

        // does /regular/index.html exist? if so, redirect to /regular/
        let indexFp = path.posix.join(fp, "index.html")
        if (fs.existsSync(path.posix.join(argv.output, indexFp))) {
          return redirect(fp + "/")
        }
      }

      return serve()
    })
    server.listen(argv.port)
    const wss = new WebSocketServer({ port: argv.wsPort })
    wss.on("connection", (ws) => connections.push(ws))
    console.log(
      chalk.cyan(
        `Started a Quartz server listening at http://localhost:${argv.port}${argv.baseDir}`,
      ),
    )
    console.log("hint: exit with ctrl+c")
    chokidar
      .watch(["**/*.ts", "**/*.tsx", "**/*.scss", "package.json"], {
        ignoreInitial: true,
      })
      .on("all", () => {
        void build(clientRefresh).catch((error) => {
          console.error("[build] Source rebuild failed; waiting for a source change", error)
        })
      })
  } else {
    try {
      await build(() => {})
    } finally {
      await Promise.all([ctx.dispose(), parseCtx.dispose()])
    }
  }
}
