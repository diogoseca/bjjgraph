import { mountCatalog } from "../shared/catalog.js";
import { screenItems } from "../shared/screen-registry.js";

mountCatalog({
  kind: "screens",
  items: screenItems,
  version: "1.74.0",
});
