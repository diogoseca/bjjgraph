import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/developmentBanner.scss"

interface Options {
  githubRepo: string
}

export default ((opts?: Options) => {
  const DevelopmentBanner: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    const repo = opts?.githubRepo ?? "diogoseca/bjjgraph"
    const bugUrl = `https://github.com/${repo}/issues/new?labels=bug&title=%5BBug%5D%20`
    const enhancementUrl = `https://github.com/${repo}/issues/new?labels=enhancement&title=%5BSuggestion%5D%20`

    return (
      <div class={`development-banner ${displayClass ?? ""}`}>
        <div class="banner-content">
          <span class="banner-text">
            <span class="banner-emoji">🚧</span>
            <span class="banner-message">Rapid Development</span>
          </span>
          <div class="banner-actions">
            <a href={bugUrl} target="_blank" rel="noopener noreferrer" class="banner-button bug">
              Report Issue
            </a>
            <a href={enhancementUrl} target="_blank" rel="noopener noreferrer" class="banner-button enhancement">
              Suggest Improvement
            </a>
          </div>
        </div>
      </div>
    )
  }

  DevelopmentBanner.css = style
  return DevelopmentBanner
}) satisfies QuartzComponentConstructor
