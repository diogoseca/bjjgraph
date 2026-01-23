import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/editOnGithub.scss"

interface Options {
  repoUrl: string
  branch: string
}

const defaultOptions: Options = {
  repoUrl: "https://github.com/diogoseca/bjjgraph",
  branch: "main",
}

export default ((userOpts?: Partial<Options>) => {
  const opts = { ...defaultOptions, ...userOpts }

  const EditOnGithub: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    // Use relativePath which preserves original filename with spaces
    const relativePath = fileData.relativePath ?? ""
    const slug = fileData.slug ?? ""

    // Determine if this is templated content (has JSON source)
    const templatedPrefixes = ["Positions/", "Transitions/", "Submissions/", "Principles/", "Systems/"]
    const isTemplated = templatedPrefixes.some((prefix) => relativePath.startsWith(prefix))

    // Build the GitHub edit URL
    let sourcePath: string

    if (isTemplated) {
      // For role pages (Top/Bottom), link to parent JSON
      if (relativePath.match(/\/(Top|Bottom)\.md$/)) {
        // "Positions/Mount/Bottom.md" -> "Positions/Mount.json"
        const parentPath = relativePath.replace(/\/[^/]+\.md$/, ".json")
        sourcePath = `source/content/${parentPath}`
      } else {
        // "Transitions/Hip Bump Sweep.md" -> "Transitions/Hip Bump Sweep.json"
        sourcePath = `source/content/${relativePath.replace(/\.md$/, ".json")}`
      }
    } else {
      // Non-templated content: link to .md file directly
      sourcePath = `source/content/${relativePath}`
    }

    // Handle index page
    if (slug === "index" || slug === "") {
      sourcePath = "source/content/index.md"
    }

    // URL encode path segments for GitHub (handles spaces -> %20)
    const encodedPath = sourcePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")
    const editUrl = `${opts.repoUrl}/edit/${opts.branch}/${encodedPath}`

    return (
      <a
        href={editUrl}
        class="edit-on-github"
        target="_blank"
        rel="noopener noreferrer"
        title={`Edit ${isTemplated ? "JSON source" : "this page"} on GitHub`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        <span>Edit this page</span>
      </a>
    )
  }

  EditOnGithub.css = style
  return EditOnGithub
}) satisfies QuartzComponentConstructor
