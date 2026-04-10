import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import explorerStyle from "./styles/explorer.scss"

// @ts-ignore
import script from "./scripts/explorer.inline"
import { ExplorerNode, FileNode, Options } from "./ExplorerNode"
import { QuartzPluginData } from "../plugins/vfile"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"

// Options interface defined in `ExplorerNode` to avoid circular dependency
const defaultOptions = {
  folderClickBehavior: "collapse",
  folderDefaultState: "collapsed",
  useSavedState: true,
  mapFn: (node) => {
    return node
  },
  sortFn: (a, b) => {
    // Sort order: folders first, then files. Sort folders and files alphabetically
    if ((!a.file && !b.file) || (a.file && b.file)) {
      // numeric: true: Whether numeric collation should be used, such that "1" < "2" < "10"
      // sensitivity: "base": Only strings that differ in base letters compare as unequal. Examples: a ≠ b, a = á, a = A
      return a.displayName.localeCompare(b.displayName, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    }

    if (a.file && !b.file) {
      return 1
    } else {
      return -1
    }
  },
  filterFn: (node) => {
    // Hide tags folder
    if (node.name === "tags") return false

    // Hide terminal state page (Game Over is a sink node, not navigable from explorer)
    // node.name is a slug segment where spaces become hyphens
    if (node.name === "Game-Over") return false

    // Hide Training page (accessed via TopBar/homepage pill, not explorer)
    if (node.name === "Training") return false
    if (node.name === "Tree") return false

    // Hide role folders (case-insensitive)
    // Top/Bottom for Positions, Attacker/Defender for Transitions/Submissions
    const nodeName = node.name.toLowerCase()
    if (
      nodeName === "bottom" ||
      nodeName === "top" ||
      nodeName === "attacker" ||
      nodeName === "defender"
    ) {
      return false
    }

    // Hide role files under category folders (playing_as / attacker-defender model)
    if (node.file?.slug) {
      const slug = node.file.slug.toLowerCase()
      if ((slug.endsWith("/bottom") || slug.endsWith("/top")) && slug.includes("positions/")) {
        return false
      }
      if (
        (slug.endsWith("/attacker") || slug.endsWith("/defender")) &&
        (slug.includes("transitions/") || slug.includes("submissions/"))
      ) {
        return false
      }
    }

    return true
  },
  order: ["filter", "map", "sort"],
} satisfies Options

export default ((userOpts?: Partial<Options>) => {
  // Parse config
  const opts: Options = { ...defaultOptions, ...userOpts }

  // memoized
  let fileTree: FileNode
  let jsonTree: string
  let lastBuildId: string = ""

  function constructFileTree(allFiles: QuartzPluginData[]) {
    // Construct tree from allFiles
    fileTree = new FileNode("")
    allFiles.forEach((file) => fileTree.add(file))

    // Execute all functions (sort, filter, map) that were provided (if none were provided, only default "sort" is applied)
    if (opts.order) {
      // Order is important, use loop with index instead of order.map()
      for (let i = 0; i < opts.order.length; i++) {
        const functionName = opts.order[i]
        if (functionName === "map") {
          fileTree.map(opts.mapFn)
        } else if (functionName === "sort") {
          fileTree.sort(opts.sortFn)
        } else if (functionName === "filter") {
          fileTree.filter(opts.filterFn)
        }
      }
    }

    // Get all folders of tree. Initialize with collapsed state
    // Stringify to pass json tree as data attribute ([data-tree])
    const folders = fileTree.getFolderPaths(opts.folderDefaultState === "collapsed")
    jsonTree = JSON.stringify(folders)
  }

  const Explorer: QuartzComponent = ({
    ctx,
    cfg,
    allFiles,
    displayClass,
    fileData,
  }: QuartzComponentProps) => {
    if (ctx.buildId !== lastBuildId) {
      lastBuildId = ctx.buildId
      constructFileTree(allFiles)
    }

    return (
      <div
        class={classNames(displayClass, "explorer")}
        id="explorer"
        data-behavior={opts.folderClickBehavior}
        data-collapsed={opts.folderDefaultState}
        data-savestate={opts.useSavedState}
        data-tree={jsonTree}
      >
        <div id="explorer-content">
          <ul class="overflow" id="explorer-ul">
            <ExplorerNode node={fileTree} opts={opts} fileData={fileData} />
            <li id="explorer-end" />
          </ul>
        </div>
      </div>
    )
  }

  Explorer.css = explorerStyle
  Explorer.afterDOMLoaded = script
  return Explorer
}) satisfies QuartzComponentConstructor
