# BJJGraph Documentation Site

Quartz-based static site generator hosting the complete BJJ knowledge graph. This is the main documentation and content hub for [bjjgraph.org](https://bjjgraph.org).

## What's Inside

- **90+ Positions**: BJJ positions as state machine nodes (e.g., Closed Guard, Mount, Back Control)
- **70+ Transitions**: Techniques as probabilistic edges between states
- **50+ Submissions**: Terminal states and finishing techniques
- **Expert Systems**: Systematic approaches from Danaher, Gordon Ryan, Eddie Bravo
- **Concepts**: Fundamental BJJ principles (base, frames, leverage)
- **Pedagogy**: Learning theory and skill progression frameworks

## Technology

Built on [Quartz 4.0](https://quartz.jzhao.xyz/) - a fast, batteries-included static site generator.

### Key Features
- Interactive graph visualization
- Full-text search
- Backlink support
- Tag-based organization
- Mobile-responsive design
- Analytics (Plausible)

## Local Development

```bash
cd source

# Install dependencies (requires Node 20 or >=22)
npm install

# Development server with live reload
npx quartz build --serve
# Visit http://localhost:8080

# Build static site
npx quartz build

# Type checking
npm run check

# Format code
npm run format
```

## Content Editing

All content lives in `source/content/`:

```
content/
├── Positions/          # 90+ position states
├── Transitions/        # 70+ transition techniques
├── Submissions/        # 50+ submissions
├── Systems/           # Expert systematic approaches
├── Concepts/          # Fundamental principles
└── Pedagogy/          # Learning frameworks
```

### Content Standards

**Before editing any content file:**
1. Read the appropriate contributor guide:
   - Positions: `Positions/CONTRIBUTING-POSITIONS.md`
   - Transitions: `Transitions/CONTRIBUTING-TRANSITIONS.md`
   - Submissions: `Submissions/CONTRIBUTING-SUBMISSIONS.md`
   - Systems: `Systems/CONTRIBUTING-SYSTEMS.md`
   - Concepts: `Concepts/CONTRIBUTING-CONCEPTS.md`
2. Maintain all required fields (State ID, success probabilities, decision trees)
3. Use consistent formatting
4. Link related content with `[[Wikilink]]` syntax
5. Include all skill levels (Beginner/Intermediate/Advanced percentages)
6. Preserve expert insights

**Note**: The CONTRIBUTING-*.md files are excluded from the website (see quartz.config.ts). They are reference documents for content creators and the automated improvement bot.

### Example Position Structure

```markdown
---
title: Closed Guard Bottom
state_id: S001
point_value: 0
position_type: Defensive
risk_level: Medium
energy_cost: Medium
---

## Visual Description
[Detailed body positioning...]

## Offensive Transitions
- [[Hip Bump Sweep]] → [[Mount]] (Success: Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Triangle Choke]] → [[Triangle Control]] (Success: Beginner 25%, Intermediate 40%, Advanced 55%)

## Decision Tree
If opponent establishes strong posture:
- Execute [[Hip Bump Sweep]] → [[Mount]] (Probability: 55%)
...
```

## Configuration

- `source/quartz.config.ts` - Site settings, theme, analytics
- `source/quartz.layout.ts` - Component layout (Graph, Explorer, Search)
- `source/quartz/components/` - Preact/TSX UI components
- `source/quartz/plugins/` - Content transformers

## Deployment

Auto-deploys to [bjjgraph.org](https://bjjgraph.org) via GitHub Actions when pushing to main branch.

See `.github/workflows/` for deployment configuration.

## Raw HTML Support

The `source/raw_html/` folder gets copied into builds for hosting arbitrary HTML outside of Quartz. Useful for custom visualizations or tools.

## SEO Strategy

Target keywords: "bjj positions", "bjj techniques", "bjj [position name]"

- Hub pages aggregating related content
- Schema markup (HowTo, FAQ) on technical pages
- Meta descriptions following template format
- Strong internal linking (3-5 related positions per page)

See `todo/seo.md` for complete strategy.

## Further Reading

- [Quartz Documentation](https://quartz.jzhao.xyz/configuration)
- [AI Development Guide](../CLAUDE.md)