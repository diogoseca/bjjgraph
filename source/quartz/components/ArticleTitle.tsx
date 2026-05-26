import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
// @ts-ignore
import titleAddScript from "./scripts/titleAddTraining.inline"

const ArticleTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const title = fileData.frontmatter?.title
  const slug = fileData.slug ?? ""
  const isHomepage = slug === "index"

  if (isHomepage) {
    return (
      <>
        <h1 class={classNames(displayClass, "article-title", "homepage-title")}>
          BJJ Graph<span class="title-tld">.org</span>
        </h1>
        <p class="tagline">
          <span class="tagline-line tagline-line-1">BJJ game, mapped.</span>
          <span class="tagline-line tagline-line-2">Find a position, or try random roll.</span>
        </p>
      </>
    )
  }

  const isContentPage =
    slug.startsWith("Positions/") ||
    slug.startsWith("Transitions/") ||
    slug.startsWith("Submissions/")

  if (title) {
    // Strip everything after the first " | " for cleaner display
    const displayTitle = title.includes(" | ") ? title.split(" | ")[0] : title

    // Detect role suffix from slug for visual differentiation
    const roleSuffixes = ["/Top", "/Bottom", "/Attacker", "/Defender"]
    const matchedSuffix = isContentPage ? roleSuffixes.find((s) => slug.endsWith(s)) : undefined
    const roleWord = matchedSuffix ? matchedSuffix.slice(1) : undefined
    const hasRole = roleWord && displayTitle.endsWith(roleWord)
    const titleMain = hasRole ? displayTitle.slice(0, -roleWord.length).trimEnd() : displayTitle

    return (
      <h1 class={classNames(displayClass, "article-title")}>
        {titleMain}
        {hasRole && <span class="title-role"> {roleWord}</span>}
        {isContentPage && <span class="title-add-training" id="title-add-training"></span>}
      </h1>
    )
  } else {
    return null
  }
}

ArticleTitle.css = `
.article-title {
  margin: 2rem 0 0 0;
}

.homepage-title {
  font-size: 2rem;
  margin-top: 0;
  margin-bottom: 0.25rem;
}

.homepage-title .title-tld {
  font-size: 0.8em;
  opacity: 0.7;
}

.title-role {
  font-size: 0.5em;
  font-weight: 400;
  opacity: 0.5;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-left: 0.4em;
}
`

ArticleTitle.afterDOMLoaded = titleAddScript
export default (() => ArticleTitle) satisfies QuartzComponentConstructor
