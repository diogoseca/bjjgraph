# Contributing

The best contribution is a correction to the graph.

If a move is missing, a probability looks wrong or an outcome lands in the wrong state, open a [GitHub issue](https://github.com/diogoseca/bjjgraph/issues) or a pull request against the authored JSON. Include the state, role, ruleset and a source or technical argument. You do not need to run the project to report a correction.

## Propose a correction

Work from `dev` and target your PR at `dev`. Keep one change per PR.

- `content/Positions/`: relatively stable states and each role's attempted moves.
- `content/Transitions/`: transient states, including passes, sweeps, entries and escapes.
- `content/Submissions/`: submission attempts, their possible outcomes and safety material; family hubs group related occurrences.

Never edit `.md` files under `content/`. They are generated output and will be overwritten. Edit the JSON that owns the fact. Attacker and defender explanations are authored there too, not invented by the page templates.

## Content rules

- Author probabilities as `{gi, nogi}` maps. Attempt weights sum to 100 per position role and ruleset; outcome weights sum to 100 per present ruleset.
- `null` means an edge is unavailable in that ruleset. `0` means it exists with zero weight. Do not replace one with the other.
- Give each technique a canonical `from_position`. Check that every offered move belongs to the correct role and that its outcomes have plausible destinations.
- Outcomes target a position role-node, a real submission or `game-over`, never a bare position hub, a family hub or the technique itself. Only submission finishes reach `game-over`.
- Wikilinks need a category prefix and exact case, for example `[[Positions/Mount]]`. The terminal alias `[[game-over]]` is the exception. Verify the target exists.
- Submissions require safety guidance, tap recognition and immediate-release instructions. Do not treat a validator as a technical or safety review.

Read [Content](docs/Content.md) for the authoring contract and the exact scope of each check; [Architecture](docs/Architecture.md) explains the representations and pipeline. State boundaries, mechanics and probability estimates still need practitioner review. Passing checks is not black-belt panel validation.

## Commands

Use Node 22 and Python 3.11, matching CI. Install the Python dependencies in a virtual environment:

```sh
npm install
python3 -m pip install jsonschema jinja2
# Edit the authored JSON, then run the fast checks.
npm run validate:json
npm run validate:graph
```

Before a content PR is ready, run the full chain:

```sh
npm run regenerate:build
npm run serve                 # http://localhost:8080
```

**Full regeneration is not a read-only check.** It can invoke paid AI enrichment, normalize source data and regenerate Markdown, graph and app artifacts. It also needs the layout dependencies (`node2vec`, `umap-learn`, `networkx`) and the configured content-generation tooling. Read the pipeline section in [Architecture](docs/Architecture.md) before starting it. Never commit credentials.

## Review and staging

Explain what changed and why. For a probability, state the evidence or assumption that moved it. For an outcome, explain why the new destination fits the exchange. Keep unrelated generated changes out of the PR.

Stage files by explicit path. Avoid broad adds that can pick up generated or local artifacts. Do not push directly to `dev` or merge your own PR without maintainer approval.

Bot PRs get the same review as human ones. A generated suggestion must still be technically sound; a passing schema is not approval to publish it.

## Code areas

- `neural/`: the front-end app.
- `scripts/`: validators, regenerators, calibration and build helpers.
- `e2e/`: Playwright journeys and DSL.
- `source/`: the static-site package.

Before touching the app, read [CLAUDE.md](CLAUDE.md) section 6. Use the checks for the area you changed; do not run paid content regeneration for an app-only fix.

## Licence

Contributions are distributed under the project's [PolyForm Noncommercial 1.0.0 licence](LICENSE.md). The project is source-available, not open source.
