import { componentItems } from "./shared/component-registry.js";
import { screenItems } from "./shared/screen-registry.js";
import { useCases, userJourneys } from "./shared/sequence-registry.js";

const compositionLibraries = [
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
  <header class="hub-head"><a href="/">bjjgraph.org</a><span>Forward Components · v1.74.0</span></header>
  <section class="hub-hero">
    <small>NEURAL DESIGN SYSTEM</small>
    <h1>From one control<br />to a complete roll.</h1>
    <p>Four composition libraries map the gameplay hierarchy without booting the production runtime. A separate production sound lab makes every electrical and starflight cue audible in its real gameplay context.</p>
  </section>
  <section class="hub-flow" aria-label="Forward library hierarchy">
    ${compositionLibraries
      .map(
        (library, index) => `<a class="hub-card" href="${library.path}">
          <div class="hub-card-top"><span>${library.index}</span><i>${library.count}</i></div>
          <h2>${library.title}</h2>
          <p>${library.description}</p>
          <footer><span>${library.count} ${library.unit}</span><b>Open library →</b></footer>
        </a>${index < compositionLibraries.length - 1 ? '<div class="hub-arrow" aria-hidden="true">→</div>' : ""}`,
      )
      .join("")}
  </section>
  <section class="hub-model">
    <div><small>COMPOSITION LAW</small><b>Components</b><span>become</span><b>Screens</b><span>become</span><b>Use cases</b><span>become</span><b>User journeys</b></div>
    <p>All four layers share the same role-typed graph fixture, viewport controls, and Neural visual language.</p>
  </section>
  <section class="hub-tools" aria-labelledby="development-tools">
    <div class="hub-tools-copy"><small>DEVELOPMENT TOOL</small><h2 id="development-tools">Hear the graph think.</h2><p>The sound lab runs the same synthesized cue catalog as Neural. Preview outcomes, progression, defense, learning, and interface signals without manufacturing demo-only audio.</p></div>
    <a class="hub-tool-card" href="/dev/sounds/">
      <div class="hub-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div><span>PRODUCTION AUDIO</span><h3>Neural Sound Lab</h3><p>Context, trigger, duration, and live synthesis for every mapped signal.</p><b>Open sound lab →</b></div>
    </a>
  </section>
</div>`;
