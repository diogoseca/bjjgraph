import { mountSequenceCatalog } from "../shared/sequence-catalog.js";
import { useCases } from "../shared/sequence-registry.js";

mountSequenceCatalog({
  kind: "use-cases",
  items: useCases,
  version: "1.73.0",
});
