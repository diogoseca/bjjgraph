import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/footer.scss"

interface Options {
  links: Record<string, string>
}

export default ((opts?: Options) => {
  const Footer: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    const year = new Date().getFullYear()
    const links = opts?.links ?? {}
    return (
      <footer class={`${displayClass ?? ""}`}>
        <div class="footer-beta">
          <span class="beta-badge">BETA</span>
          <span>This project is under active development</span>
        </div>
        <div class="footer-cta">
          <a href="https://github.com/diogoseca/bjjgraph" class="footer-link">
            Star on GitHub
          </a>
          <a href="https://github.com/diogoseca/bjjgraph/issues" class="footer-link">
            Report Issues
          </a>
          <a
            href="https://github.com/diogoseca/bjjgraph/blob/main/README.md#contributing"
            class="footer-link"
          >
            Contribute
          </a>
        </div>
        {Object.keys(links).length > 0 && (
          <ul>
            {Object.entries(links).map(([text, link]) => (
              <li>
                <a href={link}>{text}</a>
              </li>
            ))}
          </ul>
        )}
        <p class="footer-copyright">BJJGraph.org © {year}</p>
      </footer>
    )
  }

  Footer.css = style
  return Footer
}) satisfies QuartzComponentConstructor
