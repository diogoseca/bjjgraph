import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { SimpleSlug, resolveRelative } from "../util/path"

// Static six-link category nav for the left sidebar. Replaces the Explorer there: the file
// tree rendered ~4,600 links (~648KB) into EVERY page — 3.7GB of the 4.7GB build output and
// most of its emit time. Deep navigation lives in Search, the graph, TreeDrawer and the
// category hub pages this links to. Pure static markup: no data-tree, no client script.
const CATEGORIES = [
  "Learning",
  "Principles",
  "Positions",
  "Transitions",
  "Submissions",
  "Systems",
] as const

const CategoryNav: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  return (
    <nav class={classNames(displayClass, "category-nav")} aria-label="Categories">
      <ul>
        {CATEGORIES.map((cat) => (
          <li>
            <a href={resolveRelative(fileData.slug!, (cat + "/") as SimpleSlug)} data-cat={cat}>
              {cat}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

CategoryNav.css = `
.category-nav {
  padding: 0.25rem 0;
}
.category-nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.category-nav a {
  display: block;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  color: var(--darkgray);
  font-size: 0.95rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}
.category-nav a:hover {
  background: var(--lightgray);
  color: var(--dark);
}
`

export default (() => CategoryNav) satisfies QuartzComponentConstructor
