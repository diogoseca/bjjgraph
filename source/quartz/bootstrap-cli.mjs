#!/usr/bin/env node
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { handleBuild } from "./cli/build.js"
// Non-build commands load their own dependencies only when explicitly invoked.
const handler = async (name, argv) => (await import("./cli/handlers.js"))[name](argv)
import { CommonArgv, BuildArgv, CreateArgv, SyncArgv } from "./cli/args.js"
import { version } from "./cli/constants.js"

yargs(hideBin(process.argv))
  .scriptName("quartz")
  .version(version)
  .usage("$0 <cmd> [args]")
  .command("create", "Initialize Quartz", CreateArgv, async (argv) => {
    await handler("handleCreate", argv)
  })
  .command("update", "Get the latest Quartz updates", CommonArgv, async (argv) => {
    await handler("handleUpdate", argv)
  })
  .command(
    "restore",
    "Try to restore your content folder from the cache",
    CommonArgv,
    async (argv) => {
      await handler("handleRestore", argv)
    },
  )
  .command("sync", "Sync your Quartz to and from GitHub.", SyncArgv, async (argv) => {
    await handler("handleSync", argv)
  })
  .command("build", "Build Quartz into a bundle of static HTML files", BuildArgv, async (argv) => {
    await handleBuild(argv)
  })
  .showHelpOnFail(false)
  .help()
  .strict()
  .demandCommand().argv
