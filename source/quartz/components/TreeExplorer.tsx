import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/treeExplorer.inline"

const TreeExplorer: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug ?? ""
  if (slug.toLowerCase() !== "tree") return null

  return (
    <div id="tree-explorer" class={classNames(displayClass, "tree-explorer")}>
      <div class="tree-search-area">
        <input
          type="text"
          class="tree-search-input"
          id="tree-search-input"
          placeholder="Search for a position..."
          autocomplete="off"
        />
        <div class="tree-search-results" id="tree-search-results"></div>
      </div>
      <div class="tree-content" id="tree-content"></div>
    </div>
  )
}

TreeExplorer.css = `/* Styles defined in custom.scss */`
TreeExplorer.afterDOMLoaded = script
export default (() => TreeExplorer) satisfies QuartzComponentConstructor
