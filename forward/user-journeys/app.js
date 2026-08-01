import { mountSequenceCatalog } from "../shared/sequence-catalog.js";
import { userJourneys } from "../shared/sequence-registry.js";

mountSequenceCatalog({
  kind: "user-journeys",
  items: userJourneys,
  version: "1.73.0",
});
