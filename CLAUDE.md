# BJJ Graph Project Documentation

This file contains essential information about the BJJ Graph project for AI assistants working on the codebase.

## Project Overview

BJJ Graph is a comprehensive knowledge graph for Brazilian Jiu-Jitsu, built using Quartz (a static site generator). The site maps out positions, transitions, submissions, principles, and systems in BJJ with detailed technical analysis, expert insights, and structured data.

**Site URL**: https://bjjgraph.org
**Primary Audience:** AI assistants (Claude Code, etc.) - focus on content standards, validation, conventions

---

## Architecture: JSON-First Content System

BJJ Graph uses a **JSON → Jinja2 → Markdown** pipeline:

1. **Source of Truth:** `.json` files in `source/templates/` contain structured content data
   - `Positions.json` - Position state data
   - `Transitions.json` - Transition technique data
   - `Submissions.json` - Submission technique data
   - `Principles.json` - Conceptual principles
   - `Systems.json` - Expert systems

2. **Templates:** `.jinja2` files generate markdown from JSON
   - Located in `source/templates/`
   - Include schema markup (HowTo, FAQ, BreadcrumbList)
   - Include A/B testing metadata (`data-sections` attributes)

3. **Output:** Generated `.md` files published to `source/content/`

**Key Scripts:**
- `scripts/validate_json.py` - Validates JSON against schema (run before commits)
- `scripts/json_to_md.py` - Regenerates markdown from JSON source
- `scripts/fix_content.sh` - Auto-fills TODOs in JSON using template structure
- `scripts/select_oldest_files.sh` - Selects files for automated improvement

**Content Improvement Bot:** `.github/workflows/content-improvement-bot.yml` runs daily, improves 2 files per run with Claude API

---

## Position Architecture: "Playing As" Model

BJJ Graph positions follow a chess-like architecture where the position represents a game state and Top/Bottom represent the roles you play.

### Core Concepts

**Position (Hub Page)** - The game state configuration
- Represents the position itself (e.g., "Mount", "Closed Guard", "Side Control")
- Canonical entry point and primary graph node
- Bifurcates into two role-specific pages: Top and Bottom
- File structure: `Positions/Mount.md` (hub), `Positions/Mount/Bottom.md`, `Positions/Mount/Top.md`

**Top/Bottom (Role Pages)** - Playing as one side
- **User-facing labels:** "Top" / "Bottom" (displayed in UI, headings, navigation)
- **Internal naming:** `playing_as`, `role` (use in schemas, code comments, variable names)
- Separate pages because they represent **opposing roles** with:
  - Different objectives (Top: maintain control/submit; Bottom: escape/reverse)
  - Different techniques (sweeps vs. submissions)
  - Different strategic frameworks
- **Not "perspectives"** - they are distinct roles you play, like playing White vs. Black in chess

### Chess Analogy

Think of a BJJ position like a chess board configuration:
- **Position = Board state** (e.g., "King's Gambit opening" or "Mount")
- **Top/Bottom = Which side you're playing** (White or Black)
- The board configuration exists independently of which player you are
- You play ONE role at a time with completely different objectives

### Graph Architecture Implications

**Graph nodes represent positions (hub pages), not roles:**
- Hub page is the canonical graph node (e.g., "Mount")
- Bottom/Top pages excluded from graph to avoid redundancy
- Prevents graph clutter: No "Mount Bottom", "Mount Top", "Mount Hub" as separate nodes
- User mental model: Graph shows position-to-position relationships

**Hub page aggregates links from both roles:**
- Bottom page links (escapes, reversals) → Added to hub's graph connections
- Top page links (submissions, advancements) → Added to hub's graph connections
- Result: Hub connects to all related positions from both roles

**Navigation behavior:**
- Clicking hub node in graph → Navigates to hub page
- Hub page provides overview + navigation to Bottom/Top roles
- Direct navigation to Bottom/Top pages still works via relative links

---

## Project Structure

```
bjjgraph/
├── source/
│   ├── content/                      # Generated markdown files (95 positions, 71 transitions, 49 submissions)
│   │   ├── CONTRIBUTING-YAML-SCHEMA.md  # Complete schema documentation
│   │   ├── Positions/                # Position pages
│   │   ├── Transitions/              # Transition pages
│   │   ├── Submissions/              # Submission pages
│   │   ├── Principles/               # Conceptual principles
│   │   ├── Systems/                  # Expert systems
│   │   └── BJJ-*.md                  # Hub pages (Positions, Transitions, Submissions, Escapes, Guard Passing)
│   └── templates/                    # JSON source files + Jinja2 templates
│       ├── Positions.json            # All position data
│       ├── Transitions.json          # All transition data
│       ├── Submissions.json          # All submission data
│       ├── *.md.jinja2               # Templates for markdown generation
│       └── Positions/                # Position-specific templates (SINGLE, HUB, TOP, BOTTOM)
├── docs/                             # Completed work & reference guides
├── todo/                             # Active development tasks (3 files)
├── scripts/                          # Python automation scripts
└── quartz/                           # Quartz static site generator
```

---

## Content Standards for AI Assistants

### Schema Reference

**Primary documentation:** `source/content/CONTRIBUTING-YAML-SCHEMA.md` - Complete data structure for all content types

**Template specifications:** Each content type has a `.json` template file in `source/templates/`:
- `Positions.json` - Position state structure with transitions, decision trees
- `Transitions.json` - Technique execution structure with setup, steps, counters
- `Submissions.json` - Submission structure with SAFETY-FIRST requirements
- `Principles.json` - Conceptual principle structure
- `Systems.json` - Expert system structure

### Core Quality Standards

When creating or improving content:

**YAML Frontmatter:**
- Title: `[Technique Name] | [Type] | BJJ Graph`
- Description: 150-160 characters, include success rates for techniques
- Tags: category, subcategory, skill level (minimum 3)

**Success Rates (CRITICAL):**
- Ordering: Beginner ≤ Intermediate ≤ Advanced (strictly enforced)
- Values: 0-100 integers only
- All three skill levels required
- Realistic progression: typical 10-15% increase per level
- Format: `(Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)`

**Wikilinks:**
- Format: `[[Page Name]]` with double brackets
- Must match target filename exactly (case-sensitive, no .md extension)
- Validate target exists before adding link
- Special terminal states: `[[Won by Submission]]`, `[[Guard Opening Sequence]]`

**Expert Insights (Required for all technical content):**
1. **John Danaher** - Systematic approach, technical precision, biomechanical analysis
2. **Gordon Ryan** - Competition application, high-percentage techniques, modern meta-game
3. **Eddie Bravo** - Innovation, 10th Planet methodology, unorthodox variations

Each insight: 2-3 sentences with distinct perspective

**Safety Requirements (Submissions Only):**
- Safety Notice section: First visible content with ⚠️ emoji
- Injury risks, tap signals, release protocol all mandatory
- Training progression: 6 phases emphasizing control before completion
- Safety errors: Dedicated subsection with DANGER labels
- Knowledge questions: At least 2 safety-critical questions

### Required Sections by Content Type

**Positions:** State Description, Visual Description (4-8 sentences), Key Principles (5-7), Offensive Transitions (min 6), Defensive Responses (min 4), Decision Tree (min 3 conditions), Expert Insights (all 3), Common Mistakes (min 5), Training Drills (min 3), Related Positions (min 3)

**Transitions:** Overview & Properties, Visual Execution Sequence, Setup Requirements (min 6), Execution Steps (min 6), Common Counters (min 3), Physical Requirements, Expert Insights (all 3), Common Mistakes (min 5), Variations & Setups (min 2), Knowledge Assessment (min 5 questions)

**Submissions:** Safety Notice (mandatory), Overview & Properties, Visual Finishing Sequence, Setup Requirements (min 6), Execution Steps (min 6), Anatomical Targeting & Injury Awareness, Training Progressions (6 phases), Expert Insights (all 3 with safety emphasis), Common Mistakes (min 5 + safety errors), Knowledge Assessment (min 6 questions including safety)

### Content Organization

Content is organized by **unique names and filesystem structure**:
- Each content piece has a unique filename that matches its canonical name
- Positions use hub/role architecture (e.g., `Mount.md`, `Mount/Bottom.md`, `Mount/Top.md`)
- All requirements are defined by JSON templates in `source/templates/`
- No manual ID tracking needed - the filesystem and JSON structure handle organization

---

## A/B Testing Infrastructure

**Status:** Production-ready, pure client-side JavaScript, active on all content pages

**Architecture:**
- Pure frontend: No edge workers, no PostHog API calls
- Uniform random sampling: 3 independent samples (priority, visibility, styling)
- Runs in `<head>` before body renders (zero FOUC)
- Weekly refresh: New assignment every 7 days per user
- Cookie-cached for consistency

**How it works:**
1. Script loads in `<head>` (before page renders)
2. Reads `data-sections` from `<body>` tag metadata
3. Generates random priority/visibility/styling per section
4. Applies CSS instantly (order, display, enhanced styling)
5. Tracks engagement via PostHog (time on page, scroll depth)

**Key Files:**
- `source/quartz/components/scripts/uniform-ab-testing.inline.ts` (231 lines) - Core A/B logic
- `source/quartz/components/scripts/posthog-ab-tracking.inline.ts` (203 lines) - Analytics tracking
- `source/quartz/plugins/emitters/componentResources.ts` - Auto-includes script in `beforeDOMLoaded`
- All `.jinja2` templates include `<body data-content-type="..." data-sections='[...]'>` metadata

**Debug Mode:** Add `?debug` to any URL to see assignment data in HTML source

**Performance:** <5ms overhead (pure JavaScript, no network calls)

---

## SEO Implementation

**Status:** Schema markup active across 267+ pages via Jinja2 templates

### Schema in Templates (Not Python Scripts)

Schema markup is **generated automatically** by Jinja2 templates during build, not manual Python scripts.

**How it works:**
1. JSON source files contain structured data (transitions, success rates, steps, etc.)
2. `.jinja2` templates read JSON and generate both markdown content AND schema markup
3. Schema types embedded as `<script type="application/ld+json">` in generated markdown
4. Quartz builds static site with schema included

**Schema Types Generated:**
- **HowTo Schema:** Position and transition pages (step-by-step techniques)
- **FAQ Schema:** Common mistakes converted to Q&A format
- **BreadcrumbList:** Navigation hierarchy (Home → Category → Page)
- **WebPage:** Page metadata and site relationship

**Example:** See `source/templates/Positions/TEMPLATE-SINGLE.md.jinja2` lines 14-32 for HowTo schema generation

**Validation:** Use Google Rich Results Test (https://search.google.com/test/rich-results) to verify schema

### SEO Status Summary

**Completed:**
- Schema markup via templates (267+ pages)
- Hub pages (5 strategic pages)
- Meta titles and descriptions
- Internal linking structure
- Mobile responsiveness
- XML sitemap (auto-generated)

**To Improve:**
- Image alt text audit
- 404 page optimization
- Content quality (automated via bot)

### SEO Validation Workflow

**Before deployment:**
```bash
# 1. Validate JSON source
python3 scripts/validate_json.py

# 2. Regenerate markdown from JSON
python3 scripts/json_to_md.py

# 3. Build site
cd source && npx quartz build

# 4. Test schema markup
# Visit: https://search.google.com/test/rich-results
# Enter page URL from local build
```

**Post-deployment:**
- Monitor Google Search Console for rich results
- Check for schema errors weekly
- Track keyword rankings for hub pages

---

## Automation & Maintenance

### Content Improvement Bot

**Location:** `.github/workflows/content-improvement-bot.yml`

**What it does:**
- Runs daily at 8:00 AM UTC
- Improves 2 files per run (configurable: 1, 2, 5, 10, 20)
- JSON-first: Prioritizes .json files, handles orphaned .md as fallback
- Uses Claude API (claude-sonnet-4-5) with full context pre-loaded
- Validation retry loop: 3 attempts with `validate_json.py` + `fix_content.sh`
- Auto-regenerates markdown via `json_to_md.py` after improvements
- Creates pull requests with validation reports

**Workflow:**
```
SELECT (git age, JSON-first)
  → PRE-PROCESS (catalog, templates, validation)
  → CLAUDE IMPROVE (AI SEO optimization, fill TODOs, fix errors)
  → VALIDATE + RETRY (max 3 attempts)
  → REGENERATE .md from .json
  → CREATE PR
```

**What bot handles automatically:**
- Fills TODOs in JSON source files
- Fixes validation errors (success rates, wikilinks, missing sections)
- Adds missing transitions/submissions
- AI SEO optimization (question headings, front-loaded facts)
- Safety sections for submissions
- Entity consistency (canonical names with bold emphasis)

**Monitoring:**
1. Check GitHub Actions for daily runs
2. Review PRs created by bot
3. Validate technical accuracy
4. Merge approved PRs

**Required Secrets:**
- `CLAUDE_CODE_OAUTH_TOKEN` - Claude Code API token
- `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` - For optional PAA data

---

## Common Development Tasks

### Building the Site

```bash
cd source
npx quartz build              # Build static site
npx quartz build --serve      # Development server with live reload
```

### Validating Content

```bash
# Validate JSON source files
python3 scripts/validate_json.py

# Regenerate markdown from JSON (after JSON edits)
python3 scripts/json_to_md.py

# Check JSON/MD sync status
python3 scripts/check_sync.py
```

### Creating New Content

1. Add entry to appropriate `.json` file in `source/templates/`
2. Follow schema defined in `CONTRIBUTING-YAML-SCHEMA.md`
3. Use unique, descriptive names that match the technique/position
4. Run `python3 scripts/validate_json.py` to check compliance
5. Run `python3 scripts/json_to_md.py` to generate markdown
6. Build and test: `cd source && npx quartz build --serve`

### Modifying Templates

Templates are in `source/templates/*.md.jinja2`. After changes:
1. Regenerate all content: `python3 scripts/json_to_md.py`
2. Check for errors in generated files
3. Test build: `cd source && npx quartz build`
4. Validate schema: Use Google Rich Results Test

---

## Key Files Reference

### Content & Schema
- `source/content/CONTRIBUTING-YAML-SCHEMA.md` - Complete schema documentation
- `source/templates/*.json` - JSON source files (Positions, Transitions, Submissions, Principles, Systems)
- `source/templates/*.md.jinja2` - Jinja2 templates for markdown generation

### Scripts
- `scripts/validate_json.py` - JSON schema validation
- `scripts/json_to_md.py` - Markdown generation from JSON
- `scripts/fix_content.sh` - Auto-fill TODOs in JSON files
- `scripts/select_oldest_files.sh` - File selection for bot

### A/B Testing
- `source/quartz/components/scripts/uniform-ab-testing.inline.ts` - Core A/B logic
- `source/quartz/components/scripts/posthog-ab-tracking.inline.ts` - Analytics tracking

### Hub Pages
- `source/content/BJJ-Submissions.md`
- `source/content/BJJ-Escapes.md`
- `source/content/BJJ-Guard-Passing.md`
- `source/content/BJJ-Positions.md`
- `source/content/BJJ-Transitions.md`

---

## Important Conventions

### Success Rate Format

**Strictly enforced:**
- Beginner ≤ Intermediate ≤ Advanced
- All three levels required (no omissions)
- 0-100 integer values only
- Typical progression: 10-15% increase per level

**Examples:**
- Sweep from guard: Beginner 40%, Intermediate 55%, Advanced 70%
- Submission from mount: Beginner 50%, Intermediate 65%, Advanced 80%
- Escape from bad position: Beginner 25%, Intermediate 40%, Advanced 55%

### Wikilink Validation

- Always use `[[Page Name]]` format
- Must match exact filename (case-sensitive)
- Never include `.md` extension
- Verify target file exists
- Special pages: `[[Won by Submission]]`, `[[Guard Opening Sequence]]`

### Expert Insights

All technical pages require insights from all three experts:
1. **John Danaher** - Systematic, theoretical, biomechanical
2. **Gordon Ryan** - Competition-focused, high-percentage
3. **Eddie Bravo** - Innovative, unorthodox, creative

Each: 2-3 sentences with distinct perspective

### Safety First (Submissions)

Every submission MUST include:
- ⚠️ Safety Notice section (first visible content)
- Injury risks with severity and recovery time
- Tap signals clearly documented
- Release protocol (step-by-step)
- 6-phase training progression
- Safety-critical errors with DANGER labels
- Safety questions in knowledge assessment

---

## Documentation & Resources

**Project Repository:** https://github.com/diogoseca/bjjgraph
**Site URL:** https://bjjgraph.org
**Quartz Docs:** https://quartz.jzhao.xyz/

**Schema Validation:**
- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema.org Validator: https://validator.schema.org/

**Reference Docs:**
- `docs/CONTRIBUTING.md` - Developer guide and project philosophy
- `docs/seo-strategy.md` - 6-month SEO strategy
- `scripts/README.md` - Scripts overview and usage

---

*This documentation is maintained for AI assistants working on BJJ Graph. Focus on what exists, where to find it, and content standards.*
