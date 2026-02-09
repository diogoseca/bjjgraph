# BJJGraph

![Status](https://img.shields.io/badge/Status-Beta-yellow)
![Active Development](https://img.shields.io/badge/Development-Active-green)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue.svg)](LICENSE)

> **Note:** BJJGraph is under active development. Content is being expanded daily. Contributions welcome!

Brazilian Jiu-Jitsu knowledge graph and state machine as a static site.

**Live Site**: [bjjgraph.org](https://bjjgraph.org)

## What's Inside

- **95+ Positions** - BJJ positions as state machine nodes
- **71+ Transitions** - Techniques as probabilistic edges between states
- **49+ Submissions** - Terminal states and finishing techniques
- **Expert Systems** - Systematic approaches from Danaher, Gordon Ryan, Eddie Bravo
- **Interactive Graph** - Visual exploration of position relationships

## Quick Start

```bash
cd source && npm install   # Install dependencies (Node 20+)
cd .. && npm run dev       # Development server at localhost:8080
```

## Contributing

### npm Scripts (Root package.json)

| Command | Description |
|---------|-------------|
| `npm run validate` | Validate JSON and list files needing fixes |
| `npm run regenerate:json` | Fix/enrich JSON content with Claude AI |
| `npm run regenerate:md` | Regenerate markdown from JSON |
| `npm run regenerate:hubs` | Generate category hub pages |
| `npm run regenerate:graph` | Generate BJJ graph data |
| `npm run regenerate` | Run all steps (json + validate + md + hubs + graph) |
| `npm run build` | Build static site |
| `npm run regenerate:build` | Regenerate + build (full workflow) |
| `npm run dev` | Development server with live reload |

### Pre-Flight Checklist

```bash
npm run regenerate:build   # Full validation, generation, and build
cd source && npm run check # Type checking
```

### Content Workflow

BJJGraph uses a **JSON-first** content system:

1. **Edit** JSON source files in `content/` (JSON) or `templates/` (schemas)
2. **Validate & Regenerate** with `npm run regenerate`
3. **Test** build with `npm run dev`

Never edit `.md` files in `content/` directly - they are generated from JSON.

### Documentation

| Doc | Purpose |
|-----|---------|
| [CLAUDE.md](CLAUDE.md) | AI development workflow |
| [docs/Architecture.md](docs/Architecture.md) | JSON pipeline, Position model |
| [docs/Content.md](docs/Content.md) | Content standards, validation rules |
| [docs/SEO.md](docs/SEO.md) | Schema markup, keywords, analytics |

## Technology

Built on [Quartz 4.0](https://quartz.jzhao.xyz/) with:

- Interactive graph visualization (D3.js)
- Full-text search (Flexsearch)
- PostHog analytics
- Mobile-responsive design
- Schema markup for SEO (HowTo, FAQ)

## Project Structure

```
bjjgraph/
├── content/               # Content files (JSON source + generated MD)
│   ├── Positions/         # 95+ positions
│   ├── Transitions/       # 71+ transitions
│   ├── Submissions/       # 49+ submissions
│   ├── Systems/           # Expert systems
│   └── Principles/        # Fundamental principles
├── templates/             # JSON schemas + Jinja2 templates for MD generation
├── source/                # Quartz static site generator (MIT)
│   └── quartz/
├── scripts/               # Validation and automation
├── docs/                  # Project documentation
└── tests/                 # Test artifacts
```

## Partnership & Sponsorship

BJJGraph is building the most comprehensive, systematic breakdown of grappling ever assembled. Our mission is to democratize high-level BJJ knowledge so anyone with the interest can truly study the game.

We're looking for partners who share this vision—BJJ apps, gear companies, academies, and training platforms who want to help advance the sport and make world-class instruction accessible to all.

**Contact**: [Diogo Seca on LinkedIn](https://www.linkedin.com/in/diogoseca/)

## Analytics

- **PostHog**: https://us.posthog.com/project/236155
- **SEO**: Schema markup on all content pages

## License

PolyForm Noncommercial 1.0.0 - Free for personal, educational, and non-commercial use. Commercial use requires permission. See [LICENSE](LICENSE)

## Links

- **Site**: https://bjjgraph.org
- **Repository**: https://github.com/diogoseca/bjjgraph
- **Quartz Docs**: https://quartz.jzhao.xyz/
