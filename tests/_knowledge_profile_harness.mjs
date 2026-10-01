// Mirror the build's export stripping for tests executing the actual app class.
// Kept separate from app source assertions; no globals or alternate formulas.
//
// `knowledgeSource` is the PRELUDE neural/build/build.mjs concatenates above the app class, in the
// same order: wire-keys.src.js (the one decoder of the ordinal-keyed deck manifest and score table)
// then knowledge-profile.src.js (the shared probability and evidence laws). A harness that evaluates
// app.src.jsx without one of them throws a ReferenceError the first time the app reaches it, so every
// app-eval test takes both from here rather than injecting its own copy (CLAUDE.md §6.5).
import { readFileSync } from "node:fs";
const strip = (name) => readFileSync(new URL("../neural/src/" + name, import.meta.url), "utf8")
  .replace(/^export (function|const|let|var|class) /gm, "$1 ");
// belt.src.js (v1.209.0) rides along: the app's belt readers (`wornBelt`, the merge's `belts.held`
// line) call it, and the bundle concatenates it above the class too.
export const knowledgeSource = strip("wire-keys.src.js") + "\n" + strip("knowledge-profile.src.js") + "\n" + strip("belt.src.js");
if (/^\s*(export|import)\s/m.test(knowledgeSource)) throw new Error("Knowledge harness export strip failed");
