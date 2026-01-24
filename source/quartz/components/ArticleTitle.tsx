import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const ArticleTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const title = fileData.frontmatter?.title
  const isHomepage = fileData.slug === "index"

  if (isHomepage) {
    return (
      <h1 class={classNames(displayClass, "article-title", "homepage-title")}>
        BJJGraph<span class="title-tld">.org</span>
      </h1>
    )
  }

  if (title) {
    // Strip everything after the first " | " for cleaner display
    const displayTitle = title.includes(" | ") ? title.split(" | ")[0] : title
    return <h1 class={classNames(displayClass, "article-title")}>{displayTitle}</h1>
  } else {
    return null
  }
}

ArticleTitle.css = `
.article-title {
  margin: 2rem 0 0 0;
}

.homepage-title {
  font-size: 2.5rem;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.homepage-title .title-tld {
  font-size: 0.8em;
  opacity: 0.7;
}
`

export default (() => ArticleTitle) satisfies QuartzComponentConstructor
