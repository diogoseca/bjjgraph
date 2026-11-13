// Match the build's real modules, including the learning owner after integration.
import { existsSync, readFileSync } from "node:fs";
const path = (name) => new URL("../neural/src/" + name, import.meta.url);
const read = (name) => readFileSync(path(name), "utf8");
const strip = (source) => source.replace(/^export (function|const|let|var|class) /gm, "$1 ").replace(/^import .*;\n/gm, "");
const knowledge = strip(read("wire-keys.src.js")) + "\n" + (existsSync(path("knowledge-profile.src.js")) ? strip(read("knowledge-profile.src.js")) : "");
// progress-owner.src.js since v1.262.11: the app's roll ledger reads its window, cap and trim from there (`ngFlowTrim`)
// rating.src.js since v1.273.0: `planSummary` prices the order with the rating's game (`_ratingGame`), and the deferred
// planner imports practice-queue.src.js (which reads `ngRatingRecall`), both concatenated here as the bundles do
const order = strip(read("rating.src.js")) + "\n" + strip(read("practice-queue.src.js"));
export const gameplanAppSource = knowledge + "\n" + strip(read("belt.src.js")) + "\n" + strip(read("gameplan-debt.src.js")) + "\n" + strip(read("progress-owner.src.js")) + "\n" + order + "\n" + strip(read("gameplan.src.js")) + "\n" + read("app.src.jsx");
export const gameplanRuntime = new Function(strip(read("gameplan-debt.src.js")) + "\n" + order + "\n" + strip(read("gameplan.src.js")) + "\nreturn {ngGameplanBuild,ngGameplanBind,ngGameplanProgress,ngGameplanSummary,ngGameplanFromModel,ngGameplanLines};")();
