// Match the build's real modules, including the learning owner after integration.
import { existsSync, readFileSync } from "node:fs";
const path = (name) => new URL("../neural/src/" + name, import.meta.url);
const read = (name) => readFileSync(path(name), "utf8");
// a re-export line (`export { … } from "./x.src.js";`) goes too: its module is concatenated here itself (master-list.src.js, L1)
const strip = (source) => source.replace(/^export (function|const|let|var|class) /gm, "$1 ").replace(/^import .*;\n/gm, "").replace(/^export \{[^}]*\} from .*;\n/gm, "");
// master-list.src.js since v1.290.0 (L1): gameplan.src.js re-exports Master the game's list from it, so it is concatenated
// before it, as the deferred bundle holds it. The stitched runtime below does not return `ngMasterPaint`: the app then paints
// the button's plain words (its fallback before the bundle is in), since these units run on a shim with no `document.head`
// master-cloze.src.js since v1.292.0 (L2): master-list.src.js imports the cloze from it, so it comes first
const masterList = strip(read("master-cloze.src.js")) + "\n" + strip(read("master-list.src.js"));
const knowledge = strip(read("wire-keys.src.js")) + "\n" + (existsSync(path("knowledge-profile.src.js")) ? strip(read("knowledge-profile.src.js")) : "");
// progress-owner.src.js since v1.262.11: the app's roll ledger reads its window, cap and trim from there (`ngFlowTrim`)
// rating.src.js since v1.278.0: `planSummary` prices the order with the rating's game (`_ratingGame`), and the deferred
// planner imports practice-queue.src.js (which reads `ngRatingRecall`), both concatenated here as the bundles do; since
// v1.276.0 the merge's `belts.lvl` line and the drawer's belt row call it too. ONCE: a second copy is a duplicate `const`
const order = strip(read("rating.src.js")) + "\n" + strip(read("practice-queue.src.js"));
export const gameplanAppSource = knowledge + "\n" + strip(read("belt.src.js")) + "\n" + strip(read("gameplan-debt.src.js")) + "\n" + strip(read("progress-owner.src.js")) + "\n" + order + "\n" + masterList + "\n" + strip(read("gameplan.src.js")) + "\n" + read("app.src.jsx");
export const gameplanRuntime = new Function(strip(read("gameplan-debt.src.js")) + "\n" + order + "\n" + masterList + "\n" + strip(read("gameplan.src.js")) + "\nreturn {ngGameplanBuild,ngGameplanBind,ngGameplanProgress,ngGameplanSummary,ngGameplanFromModel,ngGameplanLines,ngGameplanMovesToday};")();
