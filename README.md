# BJJGraph

![Status](https://img.shields.io/badge/Status-Beta-yellow)
![Active Development](https://img.shields.io/badge/Development-Active-green)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue.svg)](LICENSE)

> **Note:** BJJGraph is under active development. Content is being expanded daily. Contributions welcome!

Brazilian Jiu-Jitsu knowledge graph and state machine as a static site. The project's ontology models BJJ as a state machine: positions are states, transitions are states too, and edges are the probabilistic outcomes between them.

**Production**: [bjjgraph.org](https://bjjgraph.org) | **Dev Preview**: [dev.bjjgraph.pages.dev](https://dev.bjjgraph.pages.dev)

## What's Inside

### Knowledge base

- **137+ Positions** - BJJ positions as state-machine nodes (top/bottom role pages)
- **1000+ Transitions** - Techniques as probabilistic edges between states
- **350+ Submissions** - Terminal states and finishing techniques (with attacker/defender role pages)
- **47 Expert Systems** - Systematic approaches (Danaher, Gordon Ryan, Eddie Bravo, etc.)
- **59 Principles** - Fundamental BJJ principles (base, posture, framing, …)
- **22 Learning Articles** - Strategy, training methods, and competition tactics
- **Graph Data** - [Download graph.json](https://github.com/diogoseca/bjjgraph/releases/latest) — the full knowledge graph as structured data (also available as `.gz`)

### Interactive UX

- **Background graph** - The entire knowledge graph sits behind every page as a swipeable drawer. Scroll up (or tap the top stripe) to expand it; click a node to crossfade to that page.
- **Training mode** - Spaced-repetition flashcards (SM-2 algorithm) drawn from per-technique Q&A. Daily-goal driven, with deck filters: due / reviewing / mastered / suggested / recently explored.
- **Roll mode** - Simulate a journey through positions: pick a starting position, then roll dice against transition probabilities. Tracks your journey for a post-roll victory display + lifetime stats.
- **Optional Supabase sync** - Sign in with Google to sync flashcard progress and roll history across devices. Anonymous use is fully supported (everything lives in `localStorage`).

## Quick Start

```bash
npm install                # Installs root + source/ deps via postinstall (Node 20+)
npm run dev                # Build + serve at http://localhost:8080 (~10 min cold build)
```

For iterative work, edit JSON sources in `content/`, run a targeted regenerate step (`npm run regenerate:md` for markdown only, or `npm run regenerate` for the full pipeline), then `npm run build`. The serve step alone is `npm run serve`.

## Contributing

### npm Scripts (Root package.json)

| Command | Description |
|---------|-------------|
| `npm run validate:json` | Validate JSON sources against `templates/` schemas |
| `npm run validate:graph` | Validate graph integrity (referential consistency, probability sums) |
| `npm run regenerate:issues` | List content files that need fixes |
| `npm run regenerate:json` | Fill TODOs / fix validation errors in JSON via Claude API |
| `npm run regenerate:explode` | Expand graph connections (derive opponent transitions, etc.) |
| `npm run regenerate:md` | Regenerate markdown from JSON via Jinja2 templates |
| `npm run regenerate:hubs` | Generate category hub pages (`Positions.md`, `Transitions.md`, …) |
| `npm run regenerate:votes` | Generate community voting data |
| `npm run regenerate:graph` | Generate `graph.json` (the runtime data feed) |
| `npm run regenerate` | All 7 regenerate steps in order |
| `npm run build` | Build the static site (~10 min, ~5700 files) |
| `npm run regenerate:build` | Regenerate + build (full workflow) |
| `npm run serve` | Serve `source/public` on port 8080 (no rebuild) |
| `npm run dev` | `build` then `serve` |
| `npm run proofread` | Recurring LLM audit of graph edges + probabilities (intermittent use; not part of `regenerate`) |

### Pre-Flight Checklist

```bash
npm run regenerate:build   # Full validation, generation, and build
cd source && npm run check # Type checking
```

### Content Workflow

BJJGraph uses a **JSON-first** content system:

1. **Edit** JSON source files in `content/` (e.g., `content/Positions/Mount.json`)
2. **Validate & Regenerate** with `npm run regenerate`
3. **Test** build with `npm run dev`

Never edit `.md` files in `content/` directly — they are generated from the `.json` source files.

### Documentation

| Doc | Purpose |
|-----|---------|
| [CLAUDE.md](CLAUDE.md) | AI development workflow |
| [docs/Architecture.md](docs/Architecture.md) | JSON pipeline, Position model |
| [docs/Content.md](docs/Content.md) | Content standards, validation rules |
| [docs/SEO.md](docs/SEO.md) | Schema markup, keywords, analytics |

## Technology

Built on [Quartz 4.0](https://quartz.jzhao.xyz/) with:

- **Graph rendering**: the Neural app's own canvas, fed by build-time data (`/static/neural/graph-data.json`); node2vec + UMAP precompute global node positions so the first paint needs no layout pass. (The old PixiJS/D3 Quartz graphs were removed in v1.80.0.)
- **Search**: Flexsearch full-text index, lazily fetched (gzipped) on first open.
- **Training**: flashcards, recall proof and Challenges live in the Neural app. State lives in `localStorage` under `bjj-neural-progress`; optional Supabase sync for signed-in users via the `neural` JSONB column.
- **Auth**: Optional Supabase Auth (email/password + Google OAuth). Anonymous use is fully supported.
- **SPA navigation**: Micromorph-style page swaps; the Neural overlay re-mounts on each soft nav.
- **Analytics**: PostHog (skipped-flashcard events, navigation patterns, feature flags).
- **SEO**: Quartz remains the static-site generator — every indexed URL ships a real `<article>`, `<head>` and JSON-LD that the Neural app overlays client-side. Schema markup is generated by Jinja2 templates.
- **Mobile**: Touch gestures (pinch-zoom + drag pan the graph; one 88vw drawer for the study pane).

## Project Structure

```
bjjgraph/
├── content/               # *.json = SOURCE data, *.md = GENERATED output
│   ├── Positions/         # 137+ positions (hub + Top/Bottom role pages)
│   ├── Transitions/       # 1000+ transitions (hub + Attacker/Defender role pages)
│   ├── Submissions/       # 350+ submissions (hub + Attacker/Defender role pages)
│   ├── Systems/           # Expert systems
│   ├── Principles/        # Fundamental principles
│   └── Learning/          # Strategy & training articles
├── templates/             # JSON schemas + Jinja2 templates (NOT source data)
├── graph.json             # Generated graph data feed (committed for releases)
├── source/                # Quartz static site generator
│   └── quartz/            # Components, plugins, styles
├── scripts/               # Validation, regeneration, content-bot tooling
├── docs/                  # Project documentation
├── branding/              # Logo + favicon assets
├── tests/                 # Test artifacts and validation reports
└── .github/workflows/     # CI: deploy (main/dev), content-improvement-bot,
                           #     analytics-content-improvement, keepalives
```

## Partnership & Sponsorship

BJJGraph is building the most comprehensive, systematic breakdown of grappling ever assembled. Our mission is to democratize high-level BJJ knowledge so anyone with the interest can truly study the game.

We're looking for partners who share this vision—BJJ apps, gear companies, academies, and training platforms who want to help advance the sport and make world-class instruction accessible to all.

**Contact**: [Diogo Seca on LinkedIn](https://www.linkedin.com/in/diogoseca/)

## Deployment

Hosted on **Cloudflare Pages**. Deploys are triggered by GitHub Actions.

| Branch | URL | Workflow |
|--------|-----|----------|
| `main` | [bjjgraph.org](https://bjjgraph.org) | `.github/workflows/deploy.yaml` |
| `dev` | [dev.bjjgraph.pages.dev](https://dev.bjjgraph.pages.dev) | `.github/workflows/deploy-dev.yaml` |

Preview deployments for `dev` are also available at unique URLs (e.g., `<hash>.bjjgraph.pages.dev`) visible in the Cloudflare Pages dashboard.

## Analytics

- **PostHog**: https://us.posthog.com/project/236155
- **SEO**: Schema markup on all content pages

### Content quality signals

When maintaining content, pay attention to two feedback channels:

1. **Most-skipped flashcards** — every time a user hits **Skip** on a flashcard, the runtime fires a `flashcard_skipped` PostHog event with `{ page, technique, question }`. Aggregate these in PostHog (group by `question`) to find the questions users find broken, unclear, or off-topic — those are the first ones to rewrite.
2. **Issues raised by open-source collaborators** — GitHub issues and PRs from the community are the highest-signal source of content problems. Triage them before adding new content.

## License

PolyForm Noncommercial 1.0.0 - Free for personal, educational, and non-commercial use. Commercial use requires permission. See [LICENSE](LICENSE)

## Links

- **Site**: https://bjjgraph.org
- **Repository**: https://github.com/diogoseca/bjjgraph
- **Quartz Docs**: https://quartz.jzhao.xyz/
