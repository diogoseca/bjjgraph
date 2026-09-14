# Contributing

The best contribution is a correction to the graph.

If a position is missing a move, a probability feels wrong, a counter lands in the wrong place, or a note teaches the wrong thing, open an issue or a pull request. A short issue with a source, a match example, or a clear technical argument is useful.

## Propose a correction

1. Find the authored JSON under `content/`.
2. Change the smallest file that owns the fact.
3. Run the validators below.
4. Open one pull request for one correction.

Useful starting points:

- `content/Positions/` — which moves are offered from a position, and with what attempt weight.
- `content/Transitions/` — transitions, sweeps, passes, entries and their outcomes.
- `content/Submissions/` — finishes, safety notes and finish outcomes.
- `docs/Content.md` — writing standards, wikilinks and source-file conventions.
- `docs/Architecture.md` — how the graph model is built.

Never edit `.md` files under `content/`. They are generated output and will be overwritten. Edit the `.json` beside them, or the pipeline that emits them.

## Commands

Install once:

```sh
npm install
```

Fast checks for content changes:

```sh
npm run validate:json
npm run validate:graph
```

Before a content pull request is ready:

```sh
npm run regenerate:build
```

That full command validates, regenerates generated Markdown and graph payloads, then builds the static site. It is the expensive but honest check for content work.

For local viewing after a build:

```sh
npm run serve
```

Then open `http://localhost:8080`.

## Pull request shape

Keep one change per PR. One missing edge, one probability correction, one typo class, one code fix. Small PRs are easier to review and easier to revert.

Explain what changed and why. If you changed a probability, say what evidence or reasoning moved it. If you changed an outcome, say where the move now lands and why that state is better.

Do not include generated churn unless the change requires it. If you ran `npm run regenerate:build`, include the generated files that command intentionally changed and nothing else.

Stage files by explicit path. Avoid broad adds that can pick up generated or local artifacts.

## Bots

Several scheduled bots open PRs for content improvement, proofreading, votes and link checks. Bot PRs are reviewed like human PRs. If a bot changes something wrong, comment with the correction or open a follow-up PR against the authored JSON.

## Code areas

- `neural/` — the front-end app.
- `scripts/` — validators, regenerators, calibration and build helpers.
- `e2e/` — Playwright journeys and DSL.
- `source/` — Quartz static-site package.

Before touching the app, read `CLAUDE.md` section 6. It is the list of traps already found the hard way: overlays, canvas geometry, harness behavior, persistence, IDs and gates.

## License

BJJGraph is distributed under the PolyForm Noncommercial 1.0.0 license. See `LICENSE.md`.
