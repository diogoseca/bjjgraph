# BJJGraph - AI Development Guide

BJJ knowledge graph and state machine as a static site. **Site:** https://bjjgraph.org | **Repo:** https://github.com/diogoseca/bjjgraph

---

## 1. AI WORKFLOW (MANDATORY)

### Step 1: Read Documentation (In Order)

```
1. CLAUDE.md          ← You are here
2. docs/Architecture.md   ← JSON pipeline, Position model
3. docs/Content.md        ← Standards, validation rules
4. docs/SEO.md            ← Schema markup, A/B testing
```

### Step 2: Ask Critical Questions

Before starting any task, clarify:

| Question | Why It Matters |
|----------|----------------|
| **Scope** | What files/systems does this touch? |
| **Context** | What existing patterns should I follow? |
| **Constraints** | What must NOT change? |
| **Success** | How will we verify this worked? |

### Step 3: Deploy Subagents

Match task to engineering personality, then deploy parallel or sequential:

| Personality | Best For | Example Tasks |
|-------------|----------|---------------|
| **Systematic Migrator** | Repetitive, pattern-following | Bulk content updates, format changes |
| **Complexity Handler** | Multi-step logic, debugging | Validation errors, template fixes |
| **Infrastructure Specialist** | CI/CD, deployment, performance | GitHub Actions, build optimization |
| **Ruthless Editor** | Documentation, DRY, deletion | Consolidate docs, remove dead code |
| **Paranoid Tester** | Edge cases, validation | Schema validation, error handling |
| **Architect** | System design, refactoring | New features, structural changes |

**Parallel:** Independent tasks (audit multiple files, run multiple checks)
**Sequential:** Dependent tasks (validate → fix → regenerate → build)

### Step 4: Update Documentation

Follow **C-UD pattern** after completing work:
- **Create** new docs only if essential (prefer updating existing)
- **Update** existing docs with new learnings
- **Delete** outdated information immediately

---

## 2. FORBIDDEN ACTIONS

### Never Do These

| Action | Why | Do Instead |
|--------|-----|------------|
| Edit generated `.md` in `content/` | Overwrites on regeneration | Edit `.json` source in `templates/` |
| Skip validation before commits | Breaks build, bad data | Run `python3 scripts/validate_json.py` |
| Create files >1000 lines | Unmaintainable | Split into focused modules |
| Add docs without updating index | Orphaned content | Update relevant README/index |
| Commit secrets or API keys | Security breach | Use `.env` files, check `.gitignore` |
| Guess at wikilink targets | Broken links | Verify file exists first |
| Add emojis to content files | Inconsistent styling | Only use in docs if necessary |

### File Size Limits

- **Code files:** <500 lines preferred, <1000 max
- **Documentation:** <300 lines preferred
- **JSON source files:** No limit (data files)

---

## 3. PROJECT STRUCTURE

```
bjjgraph/
├── CLAUDE.md                    # AI workflow (this file)
├── README.md                    # Quick start for contributors
├── PARTNERS.md                  # Partnership & sponsorship info
├── docs/
│   ├── Architecture.md          # JSON pipeline, Position model, A/B testing
│   ├── Content.md               # Standards, validation rules
│   └── SEO.md                   # Schema markup, keywords, analytics
├── scripts/
│   ├── validate_json.py         # JSON schema validation
│   ├── json_to_md.py            # Regenerate markdown from JSON
│   ├── fix_content.sh           # Auto-fill TODOs in JSON
│   └── select_oldest_files.sh   # File selection for bot
├── source/
│   ├── content/                 # Generated markdown (DO NOT EDIT DIRECTLY)
│   │   ├── Positions/           # 95 position pages
│   │   ├── Transitions/         # 71 transition pages
│   │   ├── Submissions/         # 49 submission pages
│   │   └── CONTRIBUTING-YAML-SCHEMA.md  # Complete schema reference
│   ├── templates/               # JSON source + Jinja2 templates
│   │   ├── Positions.json       # Position data (EDIT THIS)
│   │   ├── Transitions.json     # Transition data (EDIT THIS)
│   │   ├── Submissions.json     # Submission data (EDIT THIS)
│   │   └── *.md.jinja2          # Template files
│   └── quartz/                  # Static site generator components
├── tests/
│   └── artifacts/               # Validation reports, status files
└── .github/
    └── workflows/
        └── content-improvement-bot.yml  # Daily content automation
```

**Key Insight:** `source/content/` is OUTPUT. `source/templates/*.json` is SOURCE.

---

## 4. ARCHITECTURE

### JSON-First Pipeline

```
source/templates/*.json  →  *.md.jinja2  →  source/content/*.md  →  Quartz Build  →  Static Site
        (SOURCE)              (TEMPLATES)         (GENERATED)           (BUILD)        (OUTPUT)
```

1. **JSON Source** - Structured data in `Positions.json`, `Transitions.json`, etc.
2. **Jinja2 Templates** - Generate markdown + SEO schema markup
3. **Generated Markdown** - Content pages with frontmatter
4. **Quartz Build** - Static site with graph visualization, search, backlinks

### Position "Playing As" Model

Positions follow a chess-like architecture:

```
Position (Hub Page)     = Board state (e.g., "Mount")
├── Top (Role Page)     = Playing as White (maintain, submit)
└── Bottom (Role Page)  = Playing as Black (escape, reverse)
```

**Graph nodes are hub pages only** - Top/Bottom excluded to prevent redundancy.

**File structure example:**
```
Positions/
├── Mount.md           # Hub page (canonical graph node)
└── Mount/
    ├── Top.md         # Playing as top (submissions, control)
    └── Bottom.md      # Playing as bottom (escapes, reversals)
```

### A/B Testing (Client-Side)

Pure JavaScript, no edge workers:
- Uniform random sampling for section priority/visibility/styling
- Runs in `<head>` before body renders (zero FOUC)
- Weekly refresh, cookie-cached
- PostHog tracks engagement metrics

**Key files:**
- `source/quartz/components/scripts/uniform-ab-testing.inline.ts`
- `source/quartz/components/scripts/posthog-ab-tracking.inline.ts`

### Graph Component

Interactive knowledge graph visualization using PixiJS (WebGL) + D3.js force simulation.

**Key behaviors:**
- **Views**: Local (sidebar, depth-1) and global (Ctrl+G modal, all nodes) are mutually exclusive
- **Touch**: Pinch-zoom and drag work via D3's built-in gesture handling
- **Performance**: Default is fast settling; use `?graph=legacy` for old slow animation
- **Cleanup**: Properly destroys WebGL context, stops simulation, and clears tweens on navigation

**Key files:**
- `source/quartz/components/scripts/graph.inline.ts`
- `source/quartz/components/styles/graph.scss`

---

## 5. COMMANDS

### Essential Commands

```bash
# Validate JSON (ALWAYS run before commits)
python3 scripts/validate_json.py

# Regenerate markdown from JSON
python3 scripts/json_to_md.py

# Build static site
cd source && npx quartz build

# Development server (live reload)
cd source && npx quartz build --serve

# Type checking
cd source && npm run check

# Format code
cd source && npm run format
```

### Content Workflow

```bash
# 1. Edit JSON source
vim source/templates/Positions.json

# 2. Validate
python3 scripts/validate_json.py

# 3. Regenerate markdown
python3 scripts/json_to_md.py

# 4. Test build
cd source && npx quartz build --serve

# 5. Commit
git add . && git commit -m "Update position data"
```

### Pre-Commit Checklist

```bash
python3 scripts/validate_json.py  # Must pass
cd source && npx quartz build     # Must succeed
```

---

## 6. CONTENT BOT

**Location:** `.github/workflows/content-improvement-bot.yml`

### What It Does

- Runs daily at 8:00 AM UTC
- Improves 2 files per run (JSON-first priority)
- Uses Claude API with full context pre-loaded
- Creates PRs with validation reports

### Bot Workflow

```
SELECT (git age, JSON-first)
  → VALIDATE (schema check)
  → IMPROVE (Claude API fills TODOs, fixes errors)
  → VALIDATE + RETRY (max 3 attempts)
  → REGENERATE (json_to_md.py)
  → CREATE PR
```

### What Bot Handles

- Fills TODOs in JSON source files
- Fixes validation errors (success rates, wikilinks, missing sections)
- AI SEO optimization (question headings, front-loaded facts)
- Safety sections for submissions
- Entity consistency (canonical names with bold emphasis)


## 7. CONTENT STANDARDS (Quick Reference)

### Success Rates

**Format:** `(Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)`

**Rules:**
- Beginner <= Intermediate <= Advanced (strictly enforced)
- All three levels required
- 0-100 integers only
- Typical progression: 10-15% increase per level

### Wikilinks

**Format:** `[[Page Name]]`

**Rules:**
- Must match filename exactly (case-sensitive)
- No `.md` extension
- Verify target exists before adding
- Special: `[[Won by Submission]]`, `[[Guard Opening Sequence]]`

### Safety (Submissions Only)

Every submission MUST include:
- Safety Notice section first (with warning)
- Injury risks with severity
- Tap signals documented
- Release protocol
- Safety-critical questions in assessment

---

## 8. RESOURCES

### Project Links

| Resource | URL |
|----------|-----|
| **Live Site** | https://bjjgraph.org |
| **Repository** | https://github.com/diogoseca/bjjgraph |
| **Quartz Docs** | https://quartz.jzhao.xyz/ |

### Schema Validation

| Tool | URL |
|------|-----|
| Google Rich Results Test | https://search.google.com/test/rich-results |
| Schema.org Validator | https://validator.schema.org/ |

### PostHog Analytics

| Dashboard | URL |
|-----------|-----|
| Project Home | https://us.posthog.com/project/236155 |
| Content Performance | https://us.posthog.com/project/236155/dashboard/611436 |
| Navigation Patterns | https://us.posthog.com/project/236155/dashboard/611437 |
| Traffic Sources | https://us.posthog.com/project/236155/dashboard/611439 |
| User Analytics | https://us.posthog.com/project/236155/dashboard/610768 |
| A/B Testing | https://us.posthog.com/project/236155/dashboard/616953 |
| Feature Flags | https://us.posthog.com/project/236155/feature_flags |

### Documentation References

| Doc | Purpose |
|-----|---------|
| `docs/Architecture.md` | JSON pipeline, Position model, A/B testing details |
| `docs/Content.md` | Full content standards, validation rules |
| `docs/SEO.md` | Schema markup, keywords, analytics setup |
| `source/content/CONTRIBUTING-YAML-SCHEMA.md` | Complete YAML schema reference |

---

*This guide is for AI assistants. Focus on: validate → edit JSON → regenerate → build.*
