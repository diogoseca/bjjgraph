// Offline smoke check for the /dev Forward catalog: renders EVERY use-case frame, journey
// frame, screen variant and component variant against every fixture entity/role, and fails
// on a throw, an empty render, a nested <button>, or a broken frame contract. It is the
// headless half of e2e/journeys/forward-components.spec.ts — run it before the browser gate.
//   npm run validate:forward
const base = new URL("../forward/shared/", import.meta.url).href;
const { useCases, userJourneys, framesFor } = await import(
  base + "sequence-registry.js"
);
const { gameScreen } = await import(base + "screen-renderers.js");
const { screenItems } = await import(base + "screen-registry.js");
const { componentItems } = await import(base + "component-registry.js");
const { defaultContext, resolveEntityContext, fallbackEntities } = await import(
  base + "fixtures.js"
);

let fail = 0;
const check = (what, html) => {
  if (typeof html !== "string" || !html.trim()) {
    console.log("EMPTY", what);
    fail++;
  }
  // the timeline overlays each frame with its own <button>, so a nested one is a parse hazard
  if (/<button[^>]*>(?:(?!<\/button>)[\s\S])*?<button/.test(html)) {
    console.log("NESTED-BUTTON", what);
    fail++;
  }
};

const contexts = [
  defaultContext,
  ...fallbackEntities.flatMap((entity) =>
    Object.keys(entity.roles).map((role) => resolveEntityContext(entity, role)),
  ),
];

for (const item of [...useCases, ...userJourneys]) {
  const frames = framesFor(item);
  if (frames.length < 2) {
    console.log("SHORT", item.id);
    fail++;
  }
  let previous = -1;
  frames.forEach((frame, index) => {
    if (!(frame.at >= previous)) {
      console.log("AT-ORDER", item.id, index, frame.at, previous);
      fail++;
    }
    previous = frame.at;
    if (!frame.label || !frame.beat || !frame.motion) {
      console.log("META", item.id, index);
      fail++;
    }
    if (!(frame.motionProgress >= 0 && frame.motionProgress <= 1)) {
      console.log("PROGRESS", item.id, index);
      fail++;
    }
    for (const context of contexts) {
      const state =
        typeof frame.state === "function" ? frame.state(context) : frame.state;
      try {
        check(
          `${item.id}#${index}`,
          gameScreen(
            {
              ...state,
              motion: frame.motion,
              motionProgress: frame.motionProgress,
            },
            context,
          ),
        );
      } catch (error) {
        console.log("THROW frame", item.id, index, error.message);
        fail++;
      }
    }
  });
}

for (const screen of screenItems)
  for (const variant of screen.variants)
    for (const context of [defaultContext, contexts[2]]) {
      try {
        check(`screen:${screen.id}:${variant}`, screen.render(variant, context));
      } catch (error) {
        console.log("THROW screen", screen.id, variant, error.message);
        fail++;
      }
    }

for (const component of componentItems)
  for (const variant of component.variants)
    for (const context of [defaultContext, contexts[2]]) {
      try {
        check(
          `component:${component.id}:${variant}`,
          component.render(variant, context),
        );
      } catch (error) {
        console.log("THROW component", component.id, variant, error.message);
        fail++;
      }
    }

console.log(
  fail
    ? `FAIL ${fail}`
    : `OK — ${useCases.length} use cases, ${userJourneys.length} journeys, ${screenItems.length} screens, ${componentItems.length} components`,
);
process.exit(fail ? 1 : 0);
