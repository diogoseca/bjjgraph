import {
  access,
  copyFile,
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import {
  framesFor,
  useCases,
  userJourneys,
} from "../forward/shared/sequence-registry.js";
import { componentItems } from "../forward/shared/component-registry.js";
import { screenItems } from "../forward/shared/screen-registry.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "forward");
const output = resolve(root, "source/public/dev");
const graphPath = resolve(root, "graph.json");

function validateSequences(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (!item.id || ids.has(item.id)) {
      throw new Error(
        `[forward] ${label} has a missing or duplicate id: ${item.id}`,
      );
    }

    ids.add(item.id);
    const frames = framesFor(item);
    if (frames.length < 2) {
      throw new Error(
        `[forward] ${label} "${item.id}" needs at least two timepoints`,
      );
    }
    let previousTime = -1;
    for (const [index, frame] of frames.entries()) {
      if (
        !Number.isFinite(frame.at) ||
        frame.at < previousTime ||
        !frame.label ||
        !frame.beat ||
        !frame.motion ||
        !Number.isFinite(frame.motionProgress) ||
        frame.motionProgress < 0 ||
        frame.motionProgress > 1 ||
        (typeof frame.state !== "object" && typeof frame.state !== "function")
      ) {
        throw new Error(
          `[forward] ${label} "${item.id}" has an invalid timepoint at index ${index}`,
        );
      }
      previousTime = frame.at;
    }
  }
}

async function validateRegistry(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (!item.id || ids.has(item.id)) {
      throw new Error(
        `[forward] ${label} has a missing or duplicate id: ${item.id}`,
      );
    }
    ids.add(item.id);
    const production = item.production;
    if (
      !production ||
      !["runtime", "output-only"].includes(production.classification) ||
      !production.files?.length ||
      !production.symbols?.length ||
      !production.handles?.length
    ) {
      throw new Error(
        `[forward] ${label} "${item.id}" is missing production provenance`,
      );
    }
    for (const file of production.files) {
      try {
        await access(resolve(root, file));
      } catch {
        throw new Error(
          `[forward] ${label} "${item.id}" references missing production source ${file}`,
        );
      }
    }
  }
}

validateSequences(useCases, "use case");
validateSequences(userJourneys, "user journey");
await validateRegistry(componentItems, "component");
await validateRegistry(screenItems, "screen");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, {
  recursive: true,
  filter: (path) =>
    !path.endsWith(".DS_Store") && path !== resolve(source, "package.json"),
});

const soundSourcePath = resolve(root, "neural/src/sound.src.js");
const soundSource = await readFile(soundSourcePath, "utf8");
const soundSandbox = {};
soundSandbox.globalThis = soundSandbox;
runInNewContext(soundSource, soundSandbox, {
  filename: "neural/src/sound.src.js",
});
const soundCatalog = soundSandbox.NG_SOUND_CATALOG;
if (!Array.isArray(soundCatalog) || soundCatalog.length < 40) {
  throw new Error(
    "[forward] Neural sound catalog must expose at least 40 contextual cues",
  );
}
if (typeof soundSandbox.NGSound !== "function") {
  throw new Error("[forward] Neural sound source must expose NGSound");
}
const soundBeats = new Set();
for (const cue of soundCatalog) {
  for (const field of [
    "beat",
    "label",
    "group",
    "voice",
    "context",
    "character",
  ]) {
    if (typeof cue[field] !== "string" || !cue[field].trim()) {
      throw new Error(
        `[forward] Neural sound cue is missing ${field}: ${JSON.stringify(cue)}`,
      );
    }
  }
  if (!Number.isFinite(cue.durationMs) || cue.durationMs < 100) {
    throw new Error(
      `[forward] Neural sound cue has an invalid duration: ${cue.beat}`,
    );
  }
  if (soundBeats.has(cue.beat)) {
    throw new Error(
      `[forward] Neural sound catalog has duplicate beat: ${cue.beat}`,
    );
  }
  soundBeats.add(cue.beat);
}
for (const requiredBeat of [
  "commit",
  "defend_start",
  "recall_proven",
  "victory_cascade",
  "defeat_drain",
]) {
  if (!soundBeats.has(requiredBeat)) {
    throw new Error(
      `[forward] Neural sound catalog is missing required beat: ${requiredBeat}`,
    );
  }
}
await copyFile(soundSourcePath, resolve(output, "sounds/sound-engine.js"));
await writeFile(
  resolve(output, "sounds/sound-catalog.json"),
  `${JSON.stringify({ cues: soundCatalog }, null, 2)}\n`,
);

const helmet = await readFile(resolve(root, "neural/src/helmet.html"), "utf8");
const productionStyles = helmet.match(/<style>([\s\S]*?)<\/style>/)?.[1];
if (!productionStyles) {
  throw new Error("[forward] Unable to derive Neural production styles");
}
await writeFile(
  resolve(output, "shared/neural-production.css"),
  `${productionStyles.trim()}\n`,
);

const graph = JSON.parse(await readFile(graphPath, "utf8"));
const roleLabels = {
  top: "Top",
  bottom: "Bottom",
  attacker: "Attacker",
  defender: "Defender",
};

function compactText(value, limit = 280) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

function titleFromSlug(value = "") {
  return value
    .split("/")
    .at(-1)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cardQuestion(node, name, roleLabel) {
  const card = node.flashcards?.[0];
  const correct = compactText(
    card?.answer_line ||
      card?.answer ||
      `Control the key space from ${roleLabel}.`,
    180,
  );
  const distractors = [
    ...(card?.distractors?.plausible || []),
    ...(card?.distractors?.trap || []),
  ]
    .slice(0, 3)
    .map((answer) => compactText(answer, 150));
  while (distractors.length < 3) {
    distractors.push(
      [
        "Force the exchange without changing the angle",
        "Release every connection and reset",
        "Wait for the opponent to choose first",
      ][distractors.length],
    );
  }
  return {
    prompt: compactText(
      card?.question ||
        `What is the first priority in ${name} while playing ${roleLabel}?`,
      240,
    ),
    answer: compactText(card?.answer || correct, 360),
    answers: [correct, ...distractors],
    correct: 0,
  };
}

function optionData(node, name, type) {
  if (type === "Position") {
    return (node.transitions || []).slice(0, 6).map((transition) => ({
      name: transition.technique,
      eyebrow: transition.isSubmission ? "Submission" : "Transition",
      path: `${name} → ${titleFromSlug(transition.targetPath || transition.target)}`,
      odds: Math.round(
        transition.successRate ?? transition.attemptProbability ?? 40,
      ),
    }));
  }
  return (node.outcomes || []).slice(0, 6).map((outcome) => ({
    name: titleFromSlug(outcome.to),
    eyebrow: outcome.result || "Outcome",
    path: `${name} → ${titleFromSlug(outcome.to)}`,
    odds: Math.round(outcome.probability ?? 40),
  }));
}

function roleData(node, name, type) {
  const roleLabel = roleLabels[node.role];
  const origin =
    node.fromPosition ||
    node.startingPosition ||
    node.path?.split("/").slice(0, -1).join(" / ") ||
    "BJJGraph";
  const question = cardQuestion(node, name, roleLabel);
  const techniques = optionData(node, name, type);
  const previewTechniques =
    techniques.length > 0
      ? techniques
      : [
          {
            name: `${name} continuation`,
            eyebrow: type,
            path: `${name} → next state`,
            odds: Math.round(node.successRate ?? 40),
          },
        ];
  const principles = (node.flashcards || [])
    .slice(0, 3)
    .map((card) => compactText(card.answer_line || card.answer, 240))
    .filter(Boolean);
  const typeCopy =
    type === "Position"
      ? `a stable Brazilian Jiu-Jitsu position`
      : type === "Transition"
        ? `a Brazilian Jiu-Jitsu transition from ${origin}`
        : `a Brazilian Jiu-Jitsu submission from ${origin}`;
  return {
    role: node.role,
    roleLabel,
    origin,
    successRate: Math.round(node.successRate ?? techniques[0]?.odds ?? 40),
    definition: `${name} is ${typeCopy}, previewed while playing ${roleLabel}.`,
    seo: `${name} is ${typeCopy}. This catalog view shows the ${roleLabel.toLowerCase()} perspective, likely outcomes, and reusable BJJGraph learning surfaces.`,
    context: `This fixture is generated from the canonical ${type.toLowerCase()} role-node in graph.json so the component library can test real names, roles, questions, and connections.`,
    principles:
      principles.length > 0
        ? principles
        : [
            `Maintain structure as ${roleLabel}.`,
            "Control the nearest inside space.",
          ],
    defense: [
      `Deny the opponent's strongest connection from the ${roleLabel.toLowerCase()} perspective.`,
      "Protect base before advancing the exchange.",
    ],
    outcomes: previewTechniques.map((technique) => technique.name),
    question,
    techniques: previewTechniques,
    clips: [
      { title: `${name} · ${roleLabel}`, by: "Graph fixture" },
      { title: `${type} mechanics`, by: "Film study" },
    ],
  };
}

function entityCatalog() {
  const configs = [
    ["positions", "Position", ["top", "bottom"]],
    ["transitions", "Transition", ["attacker", "defender"]],
    ["submissions", "Submission", ["attacker", "defender"]],
  ];
  const entities = new Map();
  for (const [collectionName, type, roles] of configs) {
    const collection = graph[collectionName] || {};
    for (const node of Object.values(collection)) {
      if (!roles.includes(node.role) || !node.hub) continue;
      const id = `${type.toLowerCase()}:${node.hub}`;
      const hubName = collection[node.hub]?.name;
      const name =
        hubName ||
        node.name
          .replace(/\s+(Top|Bottom)$/i, "")
          .replace(/\s+(Attacker|Defender)$/i, "");
      const entity = entities.get(id) || { id, type, name, roles: {} };
      entity.roles[node.role] = roleData(node, name, type);
      entities.set(id, entity);
    }
  }
  return [...entities.values()].sort(
    (a, b) =>
      ["Position", "Transition", "Submission"].indexOf(a.type) -
        ["Position", "Transition", "Submission"].indexOf(b.type) ||
      a.name.localeCompare(b.name),
  );
}

const entities = entityCatalog();
const motionCount = new Set(
  useCases.flatMap((useCase) => useCase.frames.map((frame) => frame.motion)),
).size;
await writeFile(
  resolve(output, "shared/entities.json"),
  `${JSON.stringify({ source: "graph.json", entities })}\n`,
);

console.log(
  `[forward] /dev hub, four libraries, and ${soundCatalog.length} production sounds written (${entities.length} nodes, ${useCases.length} use cases, ${userJourneys.length} journeys, ${motionCount} motions)`,
);
