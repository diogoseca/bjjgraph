<p align="center">
  <img src="branding/icon-256.png" width="96" alt="">
</p>

<h1 align="center">BJJGraph</h1>

<p align="center">
  Brazilian jiu-jitsu as a state machine you can explore, drill and play.<br>
  <a href="https://bjjgraph.org"><b>bjjgraph.org</b></a> · free · no signup
</p>

<p align="center">
  <a href="https://github.com/diogoseca/bjjgraph/releases/latest"><img src="https://img.shields.io/github/v/release/diogoseca/bjjgraph?label=release" alt="latest release"></a>
  <a href="https://github.com/diogoseca/bjjgraph/commits/main"><img src="https://img.shields.io/github/last-commit/diogoseca/bjjgraph/main?label=main" alt="last commit"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/licence-PolyForm%20Noncommercial-2B4CA0" alt="PolyForm Noncommercial"></a>
</p>

<p align="center"><img src="branding/readme-graph.png" width="860" alt="The BJJGraph graph with a hand of moves dealt from a position"></p>

Jiu-jitsu is taught as a list of techniques and played as a state machine. You are always in some position, you have a handful of moves worth attempting from there, and each attempt has a real chance of working, failing, or getting countered. BJJGraph is that map, written down.

<!-- COUNTS: derived from content/ at PR time. Do not hand-edit; see "Numbers" below. -->
- **133 positions**, each split into a top and a bottom role
- **1,025 transitions and 353 submissions**, each split into attacker and defender
- every edge carries an **attempt probability** and an outcome distribution (**success / failure / counter**)
- every probability is authored **per ruleset**, so gi and no-gi each resolve as their own graph

Two things the graph knows that a technique list cannot:

- Resolve it for no-gi and **104 techniques and 18 position role-nodes stop existing**. Nobody wrote a list of gi-only moves; nothing reads a name. The nine lapel and grip guards fall out because you can no longer reach them from standing over no-gi's own probabilities.
- In the no-gi graph, the knee slice pass is the most-attempted technique: offered from 41 positions, with a **54%** success rate. The triangle setup is third: offered from 22 positions, with a **28%** success rate.

## Use it

**Explore.** The whole graph on one canvas. Every position and technique is a node; the edges are what you can actually do from there, with the odds on them.

**Drill.** Spaced-repetition flashcards generated from every node, with a belt per deck that tracks recall, not exposure. Progress lives in your browser; sign in with Google only if you want it on more than one device.

**Roll.** Start in a position. You are dealt the moves that are legal from there, ranked by how much better each is than the ordinary choice. Pick one under the clock. The outcome is drawn from the authored distribution, and you land somewhere new.

**Share.** Build a list of techniques and hand it to a training partner as one link.

## The data

The full graph ships with every release as a single JSON file. No login, no API key.

| file | size | what |
|---|---|---|
| [`graph.json`](https://github.com/diogoseca/bjjgraph/releases/latest/download/graph.json) | 50 MB | positions, transitions, submissions, principles, systems; every edge with its per-ruleset probabilities |
| [`graph.json.gz`](https://github.com/diogoseca/bjjgraph/releases/latest/download/graph.json.gz) | 7 MB | the same, gzipped |
| [`content/`](content/) | | the authored source: one JSON per position and technique, and the Markdown notes generated from them |

```sh
# the legal moves from bottom closed guard, with attempt weight per ruleset and success rate
jq '.positions["closed-guard/bottom"].transitions[] | {technique, attemptProbabilityByRuleset, successRate}' graph.json

# one technique: performer role, per-ruleset success rate, and where each outcome lands
jq '.transitions["kneebar-from-grasshopper/attacker"] | {fromRole, successRateByRuleset, outcomes}' graph.json
```

**Where the probabilities come from, and what they are not.** They are authored estimates: written per technique, calibrated per ruleset with the project's calibration scripts, and checked by graph-integrity validation on every change (attempt weights sum to 100 per position, outcomes sum to 100 per technique, no dangling edges, no self-loops). They are not match statistics. Every figure lives in a versioned source file under `content/`, so any of them can be disputed with a pull request, and arguing with a number is the most useful thing a reader can do here. The model is described in [docs/Architecture.md](docs/Architecture.md).

## How it is built

```
content/*.json  →  templates/*.jinja2  →  content/*.md  →  static site  →  the app, mounted on top
   (source)           (structure)          (generated)      (SEO, no-JS)     (neural/)
```

The authored JSON is the only source of truth. Jinja2 templates turn it into Markdown; a static-site build (a [Quartz](https://quartz.jzhao.xyz/) fork under `source/`, MIT) turns that into a page per node with a real `<article>`, `<head>` and JSON-LD, which is what crawlers and no-JS visitors get. The app in `neural/` is one canvas component mounted over those pages; it loads a compact wire of the graph, the flashcard manifest and the curriculum, and everything else on demand. Hosted on Cloudflare Pages, with a Pages Function for share-link previews. Optional account sync through Supabase; anonymous use is complete.

## Contributing

The most valuable contribution is a correction. If a number looks wrong, a technique is missing from a position, or an outcome lands somewhere it should not, open an issue or a pull request against the JSON in `content/`. Everything else is generated from it.

```sh
npm install                  # Node 20+
# edit content/Positions/Mount.json, content/Transitions/Knee Slice Pass.json, …
npm run regenerate:build     # validate → regenerate → build (the full chain)
npm run serve                # http://localhost:8080
```

Rules that will save you a round-trip: never edit `.md` files under `content/` (they are regenerated); attempt probabilities sum to 100 per role and per ruleset; every outcome must resolve to a real role-node, a real submission, or `game-over`; wikilinks are path-prefixed and case-sensitive. `npm run validate:json` and `npm run validate:graph` are the same checks CI runs. [CONTRIBUTING.md](CONTRIBUTING.md) has the details; [docs/Content.md](docs/Content.md) has the content standards.

Code contributions are welcome too. The app is deliberately one imperative component (`neural/src/app.src.jsx`, heavily commented); the pipeline is Python under `scripts/`; the end-to-end suite is Playwright under `e2e/`. Read [CLAUDE.md](CLAUDE.md) §6 before touching the app: it is the list of things that have already cost a long debugging loop.

Several bots maintain the corpus on a schedule: a weekly content-improvement pass, a proofreading audit of edges and probabilities, a link-rot check on the film-study clips, and a votes refresh. Their PRs are reviewed like anyone else's.

## Numbers

The counts in this README are derived from `content/` when the README is updated, not typed. The current corpus is always `find content/Positions -name '*.json' | wc -l` and friends; release notes carry the counts for that release. If a number here disagrees with the tree, the tree is right.

## Licence

[PolyForm Noncommercial 1.0.0](LICENSE.md). Free to use, study, copy and share for any noncommercial purpose, including teaching and research; the content stays free for the people who train. Commercial use needs permission. That is a deliberate choice for a project whose value is the corpus, not a claim to be open source in the OSI sense.

## Contact

Anything about the corpus or the app: open an issue. Anything else: [Diogo Seca on GitHub](https://github.com/diogoseca).

## Credits

Built on [Quartz](https://quartz.jzhao.xyz/) (MIT) for the static build, [Supabase](https://supabase.com/) for optional sync, [Cloudflare Pages](https://pages.cloudflare.com/) for hosting, [PostHog](https://posthog.com/) for product analytics. Made by [Diogo Seca](https://github.com/diogoseca).
