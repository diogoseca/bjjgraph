import { formatDate } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import style from "./styles/contentMeta.scss"

interface ContentMetaOptions {
  showReadingTime: boolean
  showComma: boolean
}

const defaultOptions: ContentMetaOptions = {
  showReadingTime: false,
  showComma: false,
}

export default ((opts?: Partial<ContentMetaOptions>) => {
  const options: ContentMetaOptions = { ...defaultOptions, ...opts }

  function ContentMetadata({ cfg, fileData, displayClass }: QuartzComponentProps) {
    // No "Last updated" on the graph-as-hero homepage.
    if (fileData.slug === "index") return null

    // "Last updated" = the modified (git last-commit) date, not created. Falls
    // back to created when only one date exists.
    const date = fileData.dates?.modified ?? fileData.dates?.created
    if (!date) return null

    return (
      <p class={classNames(displayClass, "content-meta")}>
        Last updated {formatDate(date, cfg.locale)}
      </p>
    )
  }

  ContentMetadata.css = style

  return ContentMetadata
}) satisfies QuartzComponentConstructor
