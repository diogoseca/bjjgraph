import { componentItems } from "./shared/component-registry.js";
import { screenItems } from "./shared/screen-registry.js";
import { useCases, userJourneys } from "./shared/sequence-registry.js";

const libraries = [
  {
    index: "01",
    title: "Components",
    path: "/dev/components/",
    count: componentItems.length,
    unit: "building blocks",
    description:
      "Primitives, HUD, decisions, panes, progress, overlays, and feedback.",
  },
  {
    index: "02",
    title: "Screens",
    path: "/dev/screens/",
    count: screenItems.length,
    unit: "compositions",
    description:
      "Complete deterministic gameplay states assembled from reusable components.",
  },
  {
    index: "03",
    title: "Use Cases",
    path: "/dev/use-cases/",
    count: useCases.length,
    unit: "timelines",
    description:
      "Animation, notification, and interaction timepoints assembled from screens.",
  },
  {
    index: "04",
    title: "User Journeys",
    path: "/dev/user-journeys/",
    count: userJourneys.length,
    unit: "end-to-end flows",
    description:
      "Configurable chapters that combine use cases into longer player stories.",
  },
];

document.querySelector("#app").innerHTML = `<div class="hub">
  <header class="hub-head"><a href="/">bjjgraph.org</a><span>Forward Components · v1.73.0</span></header>
  <section class="hub-hero">
    <small>NEURAL DESIGN SYSTEM</small>
    <h1>From one control<br />to a complete roll.</h1>
    <p>Four development libraries map the gameplay hierarchy without booting the production runtime. Select real graph nodes, player roles, viewports, states, animation timepoints, and end-to-end journeys.</p>
  </section>
  <section class="hub-flow" aria-label="Forward library hierarchy">
    ${libraries
      .map(
        (library, index) => `<a class="hub-card" href="${library.path}">
          <div class="hub-card-top"><span>${library.index}</span><i>${library.count}</i></div>
          <h2>${library.title}</h2>
          <p>${library.description}</p>
          <footer><span>${library.count} ${library.unit}</span><b>Open library →</b></footer>
        </a>${index < libraries.length - 1 ? '<div class="hub-arrow" aria-hidden="true">→</div>' : ""}`,
      )
      .join("")}
  </section>
  <section class="hub-model">
    <div><small>COMPOSITION LAW</small><b>Components</b><span>become</span><b>Screens</b><span>become</span><b>Use cases</b><span>become</span><b>User journeys</b></div>
    <p>All four layers share the same role-typed graph fixture, viewport controls, and Neural visual language.</p>
  </section>
</div>`;
