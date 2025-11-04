# BJJGraph Documentation Site

Quartz-based static site generator hosting the complete BJJ knowledge graph. This is the main documentation and content hub for [bjjgraph.org](https://bjjgraph.org).

## What's Inside

- **90+ Positions**: BJJ positions as state machine nodes (e.g., Closed Guard, Mount, Back Control)
- **70+ Transitions**: Techniques as probabilistic edges between states
- **50+ Submissions**: Terminal states and finishing techniques
- **Expert Systems**: Systematic approaches from Danaher, Gordon Ryan, Eddie Bravo
- **Principles**: Fundamental BJJ principles (base, frames, leverage)
- **Learning**: Learning theory and skill progression frameworks

## Technology

Built on [Quartz 4.0](https://quartz.jzhao.xyz/) - a fast, batteries-included static site generator.

### Key Features
- Interactive graph visualization
- Full-text search
- Backlink support
- Tag-based organization
- Mobile-responsive design
- Analytics (PostHog)
- **Edge-based A/B testing** - Dirichlet sampling for optimal content layout

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
├── Principles/          # Fundamental principles
└── Learning/          # Learning frameworks
```

### Content Standards

**Before editing any content file:**
1. Read the appropriate contributor guide:
   - Positions: `Positions/CONTRIBUTING-POSITIONS.md`
   - Transitions: `Transitions/CONTRIBUTING-TRANSITIONS.md`
   - Submissions: `Submissions/CONTRIBUTING-SUBMISSIONS.md`
   - Systems: `Systems/CONTRIBUTING-SYSTEMS.md`
   - Principles: `Principles/CONTRIBUTING-PRINCIPLES.md`
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

Auto-deploys to **Cloudflare Pages** via GitHub Actions when pushing to main branch.

### Infrastructure

- **Static Hosting**: Cloudflare Pages (global CDN)
- **Edge Functions**: Cloudflare Workers (A/B testing middleware)
- **Analytics**: PostHog (event tracking and feature flags)
- **CI/CD**: GitHub Actions with wrangler-action

### A/B Testing (Edge-Based)

BJJ Graph uses **generative A/B testing** at the edge to optimize content layout:

**Approach:**
- Dirichlet distribution generates random section priorities per user
- Sections ordered by priority (higher = earlier on page)
- Sections with priority < 1% are hidden
- Priorities persist for 1 week, then refresh
- PostHog tracks engagement metrics with priority/visibility data

**Implementation:**
- Edge Worker: `source/functions/_middleware.ts`
- Client Tracking: `source/quartz/components/scripts/posthog-ab-tracking.inline.ts`
- Feature Flag: `position-visual-elements` (control vs enhanced styling)

See `CLAUDE.md` for complete A/B testing architecture and analysis guide.

### PostHog Dashboards

**Project:** https://us.posthog.com/project/236155

**Custom Analytics Dashboards:**
- **📄 Content Performance** - https://us.posthog.com/project/236155/dashboard/611436
  - Most viewed BJJ positions, techniques, and content pages
  - Track what content resonates with users

- **🧭 Navigation Patterns** - https://us.posthog.com/project/236155/dashboard/611437
  - User journey analysis - how visitors explore the knowledge graph
  - Identify common paths through content

- **🌐 Traffic Sources** - https://us.posthog.com/project/236155/dashboard/611439
  - Where your BJJ Graph visitors come from
  - Referrers, search engines, direct traffic

- **📊 User Analytics** - https://us.posthog.com/project/236155/dashboard/610768
  - Unique visitors, active users, and retention metrics
  - Overall growth tracking

**A/B Testing Dashboards:**
- **🎨 Visual Elements Test** - https://us.posthog.com/project/236155/dashboard/616953
  - Control vs enhanced styling performance
  - Impact on engagement metrics

**Feedback & Configuration:**
- **💬 Surveys** - https://us.posthog.com/project/236155/surveys
  - Feedback & Bug Reports: https://us.posthog.com/project/236155/surveys/019a20d5-80cf-0000-05cf-9254e6711799
  - Check user feedback and bug reports daily

- **🎯 Feature Flags** - https://us.posthog.com/project/236155/feature_flags
  - Manage A/B tests and feature rollouts
  - position-visual-elements: https://us.posthog.com/project/236155/feature_flags/228212

### Required GitHub Secrets

The following secrets must be configured in GitHub repository settings (Settings → Secrets and variables → Actions):

1. **`CLOUDFLARE_API_TOKEN`** (Required for deployment)
   - API token with "Cloudflare Pages - Edit" permission
   - Created in Cloudflare Dashboard → My Profile → API Tokens
   - Used by wrangler-action for automated deployments

2. **`CLOUDFLARE_ACCOUNT_ID`** (Required for deployment)
   - Your Cloudflare account ID
   - Found in Cloudflare Dashboard → Account Home → Account ID
   - Or in URL: `https://dash.cloudflare.com/<ACCOUNT_ID>/`

3. **`POSTHOG_API_KEY`** (Required for analytics)
   - Your PostHog project API key
   - Found in PostHog project settings
   - Used for analytics tracking and A/B testing
   - The site will build without this, but analytics/A/B testing won't work

4. **`POSTHOG_API_HOST`** (Optional for analytics)
   - Your PostHog instance host URL (e.g., `https://us.i.posthog.com`)
   - Only needed if you're using a specific PostHog region or self-hosted instance
   - Defaults to `https://app.posthog.com` if not set
   - Common values: `https://us.i.posthog.com`, `https://eu.i.posthog.com`

5. **`INDEXNOW_KEY`** (Optional for SEO)
   - IndexNow key for instant search engine notifications
   - Improves indexing speed for search engines
   - Not required for site functionality

### Required Cloudflare Environment Variables

Set in Cloudflare Dashboard → Pages → bjjgraph → Settings → Environment Variables:

1. **`POSTHOG_API_KEY`** (Production & Preview)
   - PostHog project API key (phc_***)
   - Used by Edge Worker at runtime for feature flag API calls

2. **`POSTHOG_API_HOST`** (Production & Preview)
   - https://app.posthog.com (or custom host)
   - Used by Edge Worker for PostHog API endpoint

To add a GitHub secret:
1. Go to repository Settings
2. Navigate to Secrets and variables → Actions
3. Click "New repository secret"
4. Add secret name and value

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