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
  <section class="hub-scope" aria-labelledby="catalog-scope">
    <div class="hub-scope-copy">
      <small>SCOPE</small>
      <h2 id="catalog-scope">What is deliberately not a journey.</h2>
      <p>A journey is a story a player lives through. Keeping this list beside the catalog is what stops it from drifting back into an inventory of features — and every line here is a decision, not an omission.</p>
    </div>
    <ul class="hub-scope-list">
      <li><b>Canvas graph ambience</b> — ripples, halo drain, comet trails, weighted edges, in-node text. It belongs in a third reference reel beside the notification and animation reels, not in a journey. Left unbuilt for now because it is the one item on this list that is NOT cheap: the catalog's canvas is a static synthetic constellation, so a fair reel needs those visuals built first.</li>
      <li><b>The 46-cue sound catalog</b> — not pixels. It has its own lab at <a href="/dev/sounds/">/dev/sounds/</a>, and every journey frame already names the beat that fires there.</li>
      <li><b>Film clips and the familiarity chip</b> — supporting beats, not arcs. They ride the landing card in the journeys that use it.</li>
      <li><b>The camera lease</b> — one deliberate beat inside the shared-class arrival, where it can be seen doing its job.</li>
      <li><b>Mobile</b> — a viewport axis every timeline already has, plus mobile-native beats inside the pane and share journeys. Not a parallel set of journeys.</li>
      <li><b>Community voting</b> — it influences the odds offstage and has no Neural surface to depict. Revisit if it gets one. (It has no e2e coverage either.)</li>
      <li><b>Settings and modifiers</b> — chrome. The one control that changes a live exchange, the odds stepper, lives inside the JIT drill journey.</li>
      <li><b>The weighted first draw</b> — an invisible mechanism. It is a frame note inside the cold start, where its effect is visible: you land somewhere you can name.</li>
      <li><b>Calibration, content bots, SEO, security, edge delivery, test generation, dev snapshots</b> — not user surfaces.</li>
      <li><b>Systems to affiliate purchase</b> — <em>owner-deferred, not dropped</em> (2026-08-17): “that buy is to do with monetize. rn we're just trying to get users to create their account.” The account-creation journey carries that weight instead.</li>
      <li><b>Retired features</b> — the belt-test boss battle, the locked Belt Path, the Collection tab and the legacy page UI are not memorialised as journeys. The anti-Duolingo philosophy is kept in one frame of the capstone (“every other belt remains open”), and the 20-step Tutorial survives as a chapter of the returner journey.</li>
    </ul>
  </section>
  <section class="hub-tools" aria-labelledby="development-tools">
    <div class="hub-tools-copy"><small>DEVELOPMENT TOOL</small><h2 id="development-tools">Hear the graph think.</h2><p>The sound lab runs the same synthesized cue catalog as Neural. Preview outcomes, progression, defense, learning, and interface signals without manufacturing demo-only audio.</p></div>
    <a class="hub-tool-card" href="/dev/sounds/">
      <div class="hub-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div><span>PRODUCTION AUDIO</span><h3>Neural Sound Lab</h3><p>Context, trigger, duration, and live synthesis for every mapped signal.</p><b>Open sound lab →</b></div>
    </a>
  </section>
</div>`;
