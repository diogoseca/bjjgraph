import { mountCatalog } from "../shared/catalog.js"
import { componentItems } from "../shared/component-registry.js"

mountCatalog({
  kind: "components",
  items: componentItems,
  version: "1.71.0",
})
