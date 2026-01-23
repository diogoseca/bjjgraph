# BJJGraph

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
cd source
npm install          # Install dependencies (Node 20+)
npx quartz build --serve   # Development server at localhost:8080
```

## Contributing

### Pre-Flight Checklist

Before making changes, run these commands:

```bash
# 1. Validate JSON source files
python3 scripts/validate_json.py

# 2. Regenerate markdown from JSON
python3 scripts/json_to_md.py

# 3. Build the site
cd source && npx quartz build

# 4. Run type checking
cd source && npm run check
```

### Content Workflow

BJJGraph uses a **JSON-first** content system:

1. **Edit** JSON source files in `source/content/`
2. **Validate** with `python3 scripts/validate_json.py`
3. **Regenerate** markdown with `python3 scripts/json_to_md.py`
4. **Test** build with `npx quartz build --serve`

Never edit `.md` files in `source/content/` directly - they are generated from JSON.

### Documentation

| Doc | Purpose |
|-----|---------|
| [CLAUDE.md](CLAUDE.md) | AI development workflow |
| [docs/Architecture.md](docs/Architecture.md) | JSON pipeline, Position model, A/B testing |
| [docs/Content.md](docs/Content.md) | Content standards, validation rules |
| [docs/SEO.md](docs/SEO.md) | Schema markup, keywords, analytics |

## Technology

Built on [Quartz 4.0](https://quartz.jzhao.xyz/) with:

- Interactive graph visualization (D3.js)
- Full-text search (Flexsearch)
- Client-side A/B testing with PostHog analytics
- Mobile-responsive design
- Schema markup for SEO (HowTo, FAQ)

## Project Structure

```
bjjgraph/
├── source/
│   ├── content/           # Content files (JSON source + generated MD)
│   │   ├── Positions/     # 95+ positions
│   │   ├── Transitions/   # 71+ transitions
│   │   ├── Submissions/   # 49+ submissions
│   │   ├── Systems/       # Expert systems
│   │   └── Principles/    # Fundamental principles
│   ├── templates/         # Jinja2 templates for MD generation
│   └── quartz/            # Static site generator
├── scripts/               # Validation and automation
├── docs/                  # Project documentation
└── tests/                 # Test artifacts
```

## Deployment

Auto-deploys to **Cloudflare Pages** via GitHub Actions on push to main.

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Pages deployment |
| `CLOUDFLARE_ACCOUNT_ID` | Account identifier |
| `POSTHOG_API_KEY` | Analytics tracking |

## Partnership & Sponsorship

BJJGraph welcomes partnerships with BJJ apps, gear companies, and training platforms.

See [PARTNERS.md](PARTNERS.md) for details on:
- Placement options (banners, contextual links, dedicated pages)
- Tracking transparency
- Revenue sharing approaches
- Getting started

## Analytics

- **PostHog**: https://us.posthog.com/project/236155
- **A/B Testing**: Client-side uniform random sampling
- **SEO**: Schema markup on all content pages

## License

MIT License - see [LICENSE](LICENSE)

## Links

- **Site**: https://bjjgraph.org
- **Repository**: https://github.com/diogoseca/bjjgraph
- **Quartz Docs**: https://quartz.jzhao.xyz/
