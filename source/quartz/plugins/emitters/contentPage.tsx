import { QuartzEmitterPlugin, QuartzEmitterPluginInstance } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { FilePath, FullSlug, pathToRoot } from "../../util/path"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { Content } from "../../components"
import chalk from "chalk"
import { write } from "./helpers"
import { track } from "./emitLedger"

export const ContentPage: QuartzEmitterPlugin<Partial<FullPageLayout>> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultContentPageLayout,
    pageBody: Content(),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  // ONE loop serves both ABIs. `emit` still receives the entire corpus and derives allFiles from
  // it; `emitShard` receives only the pages this shard OWNS plus the complete ordered metadata
  // roster, which is a different set. Everything below is identical for both.
  const emitPages: NonNullable<QuartzEmitterPluginInstance["emitShard"]> = async (
    ctx,
    content,
    resources,
    allFiles,
    shardIndex,
  ) => {
    // Wrapped HERE rather than at each entry point, so emit() and emitShard() are both
    // attributed by one line and a future third caller cannot forget.
    return track("ContentPage", async () => {
      const cfg = ctx.cfg.configuration

      // Build slugMap once for O(1) transclusion lookups (replaces O(n) .find() per page)
      const slugMap = new Map<FullSlug, (typeof allFiles)[0]>()
      for (const f of allFiles) {
        if (f.slug) slugMap.set(f.slug, f)
      }

      // Render all pages (CPU-bound), then batch write to disk
      const WRITE_BATCH = 64
      const fps: FilePath[] = []
      const pendingWrites: Array<{
        ctx: typeof ctx
        content: string
        slug: FullSlug
        ext: ".html"
      }> = []

      // Computed from the WHOLE roster, not from this shard's pages: every shard sees the complete
      // allFiles, so each one can answer "does the corpus have a home page" correctly.
      const containsIndex = allFiles.some((file) => file.slug === "index")

      for (const [tree, file] of content) {
        const slug = file.data.slug!
        const externalResources = pageResources(pathToRoot(slug), resources)
        const componentData: QuartzComponentProps = {
          ctx,
          fileData: file.data,
          externalResources,
          cfg,
          children: [],
          tree,
          allFiles,
          slugMap,
        }

        const rendered = renderPage(cfg, slug, componentData, opts, externalResources)
        pendingWrites.push({ ctx, content: rendered, slug, ext: ".html" })

        // Flush writes in batches to avoid holding too much in memory
        if (pendingWrites.length >= WRITE_BATCH) {
          const batch = pendingWrites.splice(0, pendingWrites.length)
          const results = await Promise.all(batch.map((w) => write(w)))
          fps.push(...results)
        }
      }

      // Flush remaining
      if (pendingWrites.length > 0) {
        const results = await Promise.all(pendingWrites.map((w) => write(w)))
        fps.push(...results)
      }

      // ELECT ONE SHARD TO WARN, BY EXPLICIT INDEX.
      //
      // The warning must print exactly once per build, so exactly one shard may own it. The first
      // proposal elected with `content[0][1].data === allFiles[0]`, an identity test, and the route
      // to rejecting it is worth keeping because reading the code produced two confident wrong
      // answers and running it produced the right one:
      //
      //   * "identity does not survive the worker boundary" — WRONG. `worker.ts` does ONE
      //     `deserialize` of the whole shard and `allFiles` comes out of that same graph, so v8
      //     preserves the internal reference.
      //   * "corpus page 0 may be resident in no shard, so it never fires" — also WRONG. Shard 0
      //     always has `start === 0`, so page 0 is always owned by it.
      //   * A simulation of the real shard construction settled it: the election works TODAY, and
      //     it works by resting on two invariants nothing states — that the resident Set is seeded
      //     from `owned` in ascending order, and that the first shard starts at 0.
      //
      // ROUND-ROBIN OR LOAD-BALANCED SHARDING BREAKS BOTH, and it is the obvious next optimisation
      // once page render costs differ. The failure mode is that the warning silently stops firing
      // EVERYWHERE rather than going red anywhere — a diagnostic that degrades to silence, whose
      // absence then reads as health (CLAUDE.md §6.6).
      //
      // So the driver now passes an explicit `shardIndex` and election costs one comparison with no
      // invariants at all. `emit()` passes 0 because the whole-corpus path is its own shard 0.
      if (!containsIndex && !ctx.argv.fastRebuild && shardIndex === 0) {
        console.log(
          chalk.yellow(
            `\nWarning: you seem to be missing an \`index.md\` home page file at the root of your \`${ctx.argv.directory}\` folder. This may cause errors when deploying.`,
          ),
        )
      }

      return fps
    })
  }

  return {
    name: "ContentPage",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
      ]
    },
    emit(ctx, content, resources): Promise<FilePath[]> {
      return emitPages(
        ctx,
        content,
        resources,
        content.map(([, file]) => file.data),
        0,
      )
    },
    // A custom layout may read arbitrary other-page trees, which the shard transport omits with
    // throwing accessors. Retain complete-content main-thread emission until those reads are
    // audited. Pinned by emitter_contract.test.mjs so this cannot flip silently.
    emitShard: userOpts === undefined ? emitPages : undefined,
  }
}
