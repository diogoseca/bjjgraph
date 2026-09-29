// Prepared integration module: import from neural/build/build.mjs after all worker
// sources are reconciled. Metadata emission must precede this build. No app/worker
// code is loaded by the page merely because these artifacts exist.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { buildStudyBundles } from "./study-bundles.mjs";
import { buildGameWorkerCore } from "./worker-core.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const stable = (v) => v && typeof v === "object"
  ? Array.isArray(v) ? "[" + v.map(stable).join(",") + "]"
    : "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}"
  : JSON.stringify(v);

function browserSource(root, name) {
  let text = readFileSync(resolve(root, "neural/src", name), "utf8");
  // The one CommonJS identity bridge belongs to standalone Node tests. Browser
  // concatenation uses the already included authoritative identity implementation.
  text = text.replace(/^var ngMdpIdentity = typeof module[^\n]+\? require\('\.\/mdp-identity\.src\.js'\) : (\{[^\n]+\});\n/, "var ngMdpIdentity = $1;\n");
  text = text.replace(/\nif\s*\(typeof module\s*!==\s*['"]undefined['"]\s*&&\s*module\.exports\)\s*module\.exports\s*=\s*\{[\s\S]*?\};\s*$/, "\n");
  // Node uses a lazy CommonJS bridge for the optional large-kernel solver. The
  // browser worker links that function below; no dynamic require may survive.
  text = text.replace(": typeof module !== 'undefined' && module.exports ? require('./mdp-certified.src.js').ngMdpCertifiedSteps : null;", ": null;");
  text = text.replace(/^export (function|const|let|var|class) /gm, "$1 ");
  text = text.replace(/\nexport\s*\{[A-Za-z0-9_$,\s]+\};\s*$/, "\n");
  if (/\bmodule\.exports|\brequire\s*\(|^\s*(import|export)\s/m.test(text)) {
    throw new Error("game-bundles: unresolved module boundary in " + name);
  }
  return text;
}

function joinSources(root, names) {
  const bindings = new Map();
  return names.map(name => {
    const text = browserSource(root, name);
    for (const match of text.matchAll(/^(?:async )?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      const prior = bindings.get(match[1]);
      if (prior) throw new Error(`game-bundles: duplicate ${match[1]} in ${prior} and ${name}`);
      bindings.set(match[1], name);
    }
    return "\n/* " + name + " */\n" + text;
  }).join("\n");
}

export async function buildGameBundles({ root, build }) {
  const src = resolve(root, "neural/src"), dist = resolve(root, "neural/dist");
  const data = resolve(root, "source/quartz/static/neural");
  const manifestBytes = readFileSync(resolve(data, "mdp/manifest.json"));
  const manifest = JSON.parse(manifestBytes);
  if (manifest.version !== 1 || manifest.codec !== "mdp-columns-v1" || manifest.status !== "COMPLETE") {
    throw new Error("game-bundles: complete current mechanics metadata required");
  }
  const provenance = manifest.provenance;
  if (digest(readFileSync(resolve(data, "graph-data.json"))) !== provenance.graphHash
    || digest(readFileSync(resolve(src, "app.src.jsx"))) !== provenance.gameplayHash) {
    throw new Error("game-bundles: graph/gameplay changed after metadata emission");
  }
  const laws = { certified: "mdp-certified.src.js", identity: "mdp-identity.src.js", model: "mdp-model.src.js",
    adapter: "mdp-adapter.src.js", knowledge: "knowledge-profile.src.js" };
  for (const [name, file] of Object.entries(laws)) {
    if (digest(readFileSync(resolve(src, file))) !== provenance.lawHashes[name]) {
      throw new Error("game-bundles: stale mechanics law " + name);
    }
  }
  const expected = {
    manifestHash: digest(manifestBytes),
    manifestBytes: manifestBytes.length,
    graphHash: provenance.graphHash,
    modelHash: provenance.modelHash,
    lawHashes: provenance.lawHashes,
    // Bound to the actual opponent-routing source, not to an optimistic label.
    opponentPolicyHash: digest(stable({ version: 1, gameplayHash: provenance.gameplayHash,
      adapterHash: provenance.lawHashes.adapter })),
  };
  const graph = JSON.parse(readFileSync(resolve(data, "graph-data.json"), "utf8"));
  if (typeof graph.evFrame !== "string" || !Array.isArray(graph.evLam)
    || manifest.variants.some(v => !graph.evLam.includes(v.lossAversion))) {
    throw new Error("game-bundles: emitted opponent frame/lambda selectors missing");
  }
  const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
  // Explicit computation admission, measured on complete learned GI/no-gi
  // cap12 support. These limits do not truncate or change the gameplay horizon.
  // A larger kernel remains unavailable until independently admitted/measured.
  const computation = {
    expansion: { maxStates: 40000, maxBranches: 400000, maxMilliseconds: 10000 },
    solve: { maxStates: 40000, maxBranches: 400000, maxMilliseconds: 15000 },
  };
  const runtimeBuild = { ...expected, version, computation, manifestHash: digest(manifestBytes),
    manifestBytes: manifestBytes.length,
    variants: manifest.variants.map(v => ({ ...v, evFrame: graph.evFrame })) };
  // Immutable URL keeps stale clients from reading another release's manifest.
  // Exact bytes remain identical to the producer's canonical manifest.
  const immutableManifest = resolve(data, "mdp/manifest-" + runtimeBuild.manifestHash + ".json");
  let current; try { current = readFileSync(immutableManifest); } catch (e) { if (e.code !== "ENOENT") throw e; }
  if (!current || !current.equals(manifestBytes)) writeFileSync(immutableManifest, manifestBytes);
  const identityNames = ["NG_MDP_API_VERSION", "NG_MDP_OBJECTIVE", "ngMdpStable", "ngMdpDigest",
    "ngMdpContractHash", "ngMdpActionId", "ngMdpStateId", "ngMdpNormalizeRootSnapshot",
    "ngMdpDefenseId", "ngMdpEnvelope"];
  const knowledgeNames = ["ngKnowledgeBonus", "ngKnowledgeSharpAfter", "ngKnowledgeAdvance", "ngKnowledgeOutcomeWeights",
    "ngKnowledgeSkew", "ngKnowledgeExplainMove", "ngKnowledgeExplainEscape"];
  // The adapter's injected K namespace must carry every statically named law.
  // A real worker IPC check caught an omitted Bonus export; fail at build time
  // if a future adapter adds a dependency without updating this boundary.
  const adapterSource = readFileSync(resolve(src, "mdp-adapter.src.js"), "utf8");
  for (const match of adapterSource.matchAll(/\bK\.(ngKnowledge[A-Za-z0-9_$]+)/g)) {
    if (!knowledgeNames.includes(match[1])) throw new Error("game-bundles: missing worker knowledge export " + match[1]);
  }
  const namespace = names => "{" + names.join(",") + "}";
  const host = joinSources(root, ["mdp-identity.src.js", "mdp-client.src.js", "game-value-provider.src.js", "game-value-runtime.src.js"])
    + "\nconst NG_GAME_VALUE_BUILD = " + JSON.stringify(runtimeBuild) + ";\n"
    + "const NG_GAME_VALUE_IDENTITY = " + namespace(identityNames) + ";\n"
    + "export { NG_GAME_VALUE_BUILD, NG_GAME_VALUE_IDENTITY, ngMdpCreateClient, ngGameValueCreateProvider, ngGameValueInstallRuntime };\n";
  const worker = () => core.bindings
    + "\nconst host = ngGameValueCreateWorkerHost({mdp:" + namespace(identityNames)
    + ",knowledge:" + namespace(knowledgeNames) + ",expected:" + JSON.stringify(expected)
    + ",createAdapter:ngMdpCreateGameAdapter,expandAsync:ngMdpExpandAsync,registrationKey:ngGameValueRegistrationKey,expansionOptions:" + JSON.stringify(computation.expansion) + "});\n"
    + "ngMdpInstallWorker(self, {...host,solveOptions:" + JSON.stringify(computation.solve) + "});\n";
  mkdirSync(dist, { recursive: true });
  const common = { bundle: true, minify: true, legalComments: "none", logLevel: "info",
    absWorkingDir: root, treeShaking: true };
  const core = await buildGameWorkerCore({root,build,joinSources,common,expected});
  // Serial builds share one caller-owned memory reservation.
  await build({ ...common, stdin: { contents: host, resolveDir: src, sourcefile: "game-values.js" },
    target: "es2019", format: "esm", outfile: resolve(dist, "game-values.js") });
  await build({ ...common, banner: { js: core.bootstrap }, stdin: { contents: worker(), resolveDir: src, sourcefile: "game-model.worker.js" },
    target: "es2020", format: "iife", outfile: resolve(dist, "game-model.worker.js") });
  await build({ ...common, entryPoints: [resolve(src, "choice-value.src.js")],
    target: "es2019", format: "esm", outfile: resolve(dist, "choice-values.js") });
  await build({ ...common, entryPoints: [resolve(src, "gameplan.src.js")],
    target: "es2019", format: "esm", outfile: resolve(dist, "gameplan.js") });
  const study = await buildStudyBundles({ root, build, common, expected, runtimeBuild, joinSources, computation, core });
  const files = ["game-values.js", "game-model.worker.js", "choice-values.js", "gameplan.js", ...study.files, core.file];
  const receipt = { version: 1, sharedCore: { file: core.file, sha256: core.sha256, bytes: core.bytes, sourceKey: core.sourceKey, sourceHashes: core.sourceHashes }, expected, study: study.config, manifestHash: runtimeBuild.manifestHash,
    files: Object.fromEntries(files.map(file => { const bytes = readFileSync(resolve(dist, file));
      return [file, { bytes: bytes.length, sha256: digest(bytes) }]; })) };
  // Local build receipt stays outside the deployable app directory.
  writeFileSync(resolve(root, "neural/build/.tmp/game-bundles.json"), JSON.stringify(receipt, null, 2) + "\n");
  return receipt;
}
