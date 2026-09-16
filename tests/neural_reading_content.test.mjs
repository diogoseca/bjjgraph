import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Execute the shared production section/renderer methods: full sheets must remain a superset
// of the short landing introduction, including on mixed-cache and absent-perspective paths.
const source = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const Component = new Function("DCLogic", "React", `${source}\nreturn Component;`)(
  class {}, { createRef: () => ({ current: null }) },
);
const node = { ty: "transitions", t: "Example move" };

test("full sheets preserve every perspective overview and the defender's authored best outcomes", () => {
  const app = Object.create(Component.prototype);
  const overview = "First sentence. " + "Further authored context. ".repeat(30) + "FINAL OVERVIEW SENTENCE.";
  const info = {
    lead: "A short shared definition.",
    perspectives: {
      attacker: { summary: overview },
      defender: { authored: true, summary: overview, bestOutcomes: ["Authored escape destination"] },
    },
  };
  for (const side of ["attacker", "defender"]) {
    const sections = app._readingSections(node, info, side, true);
    assert.equal(sections.find((s) => s.key === "overview").value, overview);
    assert.match(app.richDetailHTML(node, "Transition", info, side), /FINAL OVERVIEW SENTENCE/);
  }
  assert.match(app.richDetailHTML(node, "Transition", info, "defender"), /Authored escape destination/);
  assert.equal(app._readingSections(node, info, "defender", false).some((s) => s.key === "best-outcomes"), false);
});

test("missing defenders explain the gap in sheets and never borrow attacker material", () => {
  const app = Object.create(Component.prototype);
  const info = { lead: "Shared identity.", perspectives: { attacker: { summary: "ATTACKER SECRET", steps: ["ATTACKER STEP"] } } };
  const html = app.richDetailHTML(node, "Transition", info, "defender");
  assert.match(html, /defender's breakdown is not authored/);
  assert.doesNotMatch(html, /ATTACKER/);
  assert.equal(app._readingSections(node, {}, "defender", false).length, 0);
});

test("cold and unavailable sheets stay informative without inventing a More section", (t) => {
  const old = globalThis.window;
  globalThis.window = { NG_CONTENT: { decks: {} } };
  t.after(() => { if (old === undefined) delete globalThis.window; else globalThis.window = old; });
  const app = Object.create(Component.prototype);
  app.ngContentFor = () => null;
  assert.match(app.detailHTML(node, "Transition", [], "attacker"), /Loading this breakdown/);
  window.NG_CONTENT.decks[node.t] = null;
  assert.match(app.detailHTML(node, "Transition", [], "attacker"), /This breakdown is unavailable/);
  assert.equal(app._landMoreHTML(node, "attacker"), "");
});
