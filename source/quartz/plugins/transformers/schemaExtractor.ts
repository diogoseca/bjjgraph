import { Root as HtmlRoot, Element, Text } from "hast"
import { QuartzTransformerPlugin } from "../types"
import { visit, SKIP, CONTINUE } from "unist-util-visit"

/**
 * SchemaExtractor - Extracts JSON-LD schema markup from markdown content
 *
 * This plugin finds <script type="application/ld+json"> tags in the HTML AST,
 * extracts their JSON content to file.data.schemas, and removes them from the
 * document body. The schemas are then rendered in <head> by Head.tsx.
 *
 * This provides a cleaner contributor experience - schema stays in markdown
 * source (for version control) but gets extracted at build time so:
 * 1. Contributors see clean markdown when editing
 * 2. Final HTML still has proper schema in <head>
 * 3. No changes needed to existing files
 */
export const SchemaExtractor: QuartzTransformerPlugin = () => ({
  name: "SchemaExtractor",
  htmlPlugins() {
    return [
      () => {
        return (tree: HtmlRoot, file) => {
          const schemas: object[] = []
          const nodesToRemove: { parent: Element | HtmlRoot; index: number }[] = []

          // Find all script tags with type="application/ld+json"
          visit(tree, "element", (node: Element, index, parent) => {
            if (node.tagName === "script" && node.properties?.type === "application/ld+json") {
              // Extract JSON content from script tag
              const textContent = node.children
                .filter((child): child is Text => child.type === "text")
                .map((child) => child.value)
                .join("")

              if (textContent.trim()) {
                try {
                  const schema = JSON.parse(textContent.trim())
                  schemas.push(schema)

                  // Mark for removal (we'll remove after traversal to avoid issues)
                  if (parent && typeof index === "number") {
                    nodesToRemove.push({ parent: parent as Element | HtmlRoot, index })
                  }
                } catch (e) {
                  // Invalid JSON - leave the script tag in place
                  console.warn(`SchemaExtractor: Invalid JSON-LD in ${file.data.slug}: ${e}`)
                }
              }
            }
            return CONTINUE
          })

          // Remove nodes in reverse order to preserve indices
          nodesToRemove
            .sort((a, b) => b.index - a.index)
            .forEach(({ parent, index }) => {
              parent.children.splice(index, 1)
            })

          // Store extracted schemas in file data
          file.data.schemas = schemas
        }
      },
    ]
  },
})

declare module "vfile" {
  interface DataMap {
    schemas: object[]
  }
}
