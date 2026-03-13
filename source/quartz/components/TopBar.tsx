import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { pathToRoot } from "../util/path"

const TopBar: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const baseDir = pathToRoot(fileData.slug!)
  const trainingHref = `${baseDir}/Training`

  return (
    <nav class="top-bar">
      <a href={trainingHref} class="top-bar-link">
        Training
      </a>
      <a href="#" class="top-bar-signin" aria-label="Sign in">
        Sign in
      </a>
    </nav>
  )
}

TopBar.css = `
/* Styles defined in custom.scss */
`

export default (() => TopBar) satisfies QuartzComponentConstructor
