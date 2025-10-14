# BJJ Graph Project Documentation

This file contains essential information about the BJJ Graph project for developers and AI assistants.

## Project Overview

BJJ Graph is a comprehensive knowledge graph for Brazilian Jiu-Jitsu, built using Quartz (a static site generator for digital gardens). The site maps out positions, transitions, submissions, concepts, and systems in BJJ with detailed technical analysis, expert insights, and structured data.

**Site URL**: https://bjjgraph.com

---

## For Automated Bots & Content Improvement

This section provides guidance for automated content improvement bots and AI assistants working on the BJJ Graph project.

### Content Standards & Contributor Guides

All BJJ Graph content follows structured standards defined in the CONTRIBUTING-*.md files. These files are excluded from the published website and serve as contributor documentation only.

**Complete list of contributor guides:**

1. **CONTRIBUTING-POSITIONS.md** (`source/content/Positions/CONTRIBUTING-POSITIONS.md`)
   - Standard for position state files (S### IDs)
   - Includes state machine properties, transition data, decision trees
   - Covers offensive/defensive transitions, success rates by skill level
   - Defines YAML frontmatter structure, LLM context blocks, and markdown content sections
   - Position Standard V2 with unified YAML structure

2. **CONTRIBUTING-TRANSITIONS.md** (`source/content/Transitions/CONTRIBUTING-TRANSITIONS.md`)
   - Standard for transition technique files (T### IDs)
   - Covers from/to states, execution steps, physical requirements
   - Includes success rates, timing windows, common counters
   - Defines setup requirements, execution sequence, and knowledge assessment

3. **CONTRIBUTING-SUBMISSIONS.md** (`source/content/Submissions/CONTRIBUTING-SUBMISSIONS.md`)
   - Standard for submission files (SUB### IDs)
   - **SAFETY FIRST** - mandatory safety sections, injury awareness, tap protocols
   - Includes setup requirements, execution steps, anatomical targeting
   - Requires progressive training phases (6 phases minimum)
   - Mandatory release protocol and safety Q&A sections

4. **CONTRIBUTING-CONCEPTS.md** (`source/content/Concepts/CONTRIBUTING-CONCEPTS.md`)
   - Standard for concept/principle files (C### IDs)
   - Covers fundamental BJJ principles and theoretical frameworks
   - Includes cross-position applications and learning progressions

5. **CONTRIBUTING-SYSTEMS.md** (`source/content/Systems/CONTRIBUTING-SYSTEMS.md`)
   - Standard for expert system files (SC### IDs)
   - Documents strategic frameworks from Danaher, Gordon Ryan, Eddie Bravo
   - Includes system philosophy, technique chains, training methodology

**Complete schema reference:**
- **CONTRIBUTING-YAML-SCHEMA.md** (`source/content/CONTRIBUTING-YAML-SCHEMA.md`) - Complete data structure documentation for all content types

### Quality Standards for Automated Improvements

When improving or creating content, ensure compliance with these standards:

#### YAML Frontmatter Requirements
- **Title**: Follow template format: `[Technique Name] | [Type] | BJJ Graph`
- **Description**: 150-160 characters, include success rates for techniques
- **Tags**: Include category, subcategory, skill level (minimum 3 tags)
- **State ID**: Correct format (S###, T###, SUB###, C###, SC###)
- **Success Rates**: All three skill levels (beginner, intermediate, advanced)
- **Schema.org**: HowTo and FAQ sections for SEO

#### Required Sections by Content Type

**Positions (S###):**
- State Description (2-3 paragraphs)
- Visual Description (4-8 sentences with anatomical detail)
- Key Principles (5-7 principles)
- Offensive Transitions (minimum 6)
- Defensive Responses (minimum 4)
- Decision Tree (minimum 3 conditions)
- Expert Insights (all 3 experts)
- Common Errors (minimum 5)
- Training Drills (minimum 3)
- Related Positions (minimum 3)
- Optimal Submission Paths (minimum 3)

**Transitions (T###):**
- Overview & Properties
- Visual Execution Sequence
- Setup Requirements (minimum 6)
- Execution Steps (minimum 6)
- Common Counters (minimum 3)
- Physical Requirements
- Expert Insights (all 3 experts)
- Common Errors (minimum 5)
- Variations & Setups (minimum 2)
- Knowledge Assessment (minimum 5 questions)

**Submissions (SUB###):**
- **Safety Notice** (mandatory first visible section with ⚠️)
- Overview & Properties
- Visual Finishing Sequence
- Setup Requirements (minimum 6)
- Execution Steps (minimum 6 with timing)
- Anatomical Targeting & Injury Awareness
- Opponent Defense Patterns (minimum 3)
- Training Progressions (6 phases: Week 1-2, 3-4, 5-8, 9-12, 13+, Ongoing)
- Expert Insights (all 3 experts with safety emphasis)
- Common Errors (minimum 5 technical + safety errors with DANGER labels)
- Knowledge Assessment (minimum 6 questions including safety-critical)

**All Content Types:**
- LLM Context Block (for AI consumption)
- Schema.org metadata (HowTo, FAQ)
- SEO-optimized content structure

#### Expert Insights Requirement

Every technical page must include insights from all three experts:

1. **John Danaher** - Systematic approach, technical precision, theoretical frameworks, biomechanical analysis
2. **Gordon Ryan** - Competition application, high-percentage techniques, modern meta-game, winning strategies
3. **Eddie Bravo** - Innovation, 10th Planet methodology, unorthodox variations, creative applications

Each expert insight should be 2-3 sentences with distinct perspective and voice appropriate to that expert's teaching style.

#### Success Rate Validation

Success rates must follow proper ordering and realistic values:

- **Ordering**: Beginner ≤ Intermediate ≤ Advanced (strictly enforced)
- **Values**: 0-100 (integers only)
- **All skill levels required**: Never omit a skill level
- **Realistic progression**: Typical increase of 10-15% per level
- **Position type considerations**:
  - Defensive positions: Lower success rates for attacks
  - Offensive positions: Higher success rates for attacks
  - Neutral positions: Balanced success rates

**Examples of proper success rates:**
- Sweep from guard: Beginner 40%, Intermediate 55%, Advanced 70%
- Submission from mount: Beginner 50%, Intermediate 65%, Advanced 80%
- Escape from mount: Beginner 25%, Intermediate 40%, Advanced 55%

#### Wikilink Validation

All wikilinks must resolve to actual content:

- **Format**: Always `[[Page Name]]` with double brackets
- **Exact matching**: Must match target filename (without .md extension)
- **Case sensitive**: Match case of target file exactly
- **No extensions**: Never include `.md` in wikilink
- **Validation**: Check that target file exists before adding wikilink
- **Special pages**: `[[Won by Submission]]`, `[[Guard Opening Sequence]]` are valid terminal states

#### Safety Section Requirements (Submissions Only)

Every submission file MUST include comprehensive safety documentation:

- **Safety Notice section**: First visible content after frontmatter, with ⚠️ emoji
- **Injury Risks**: Specific injuries listed with severity and recovery time
- **Application Speed**: "SLOW and progressive - 3-5 seconds minimum" or similar
- **Tap Signals**: All valid tap signals clearly documented
- **Release Protocol**: Step-by-step release instructions
- **Training Progressions**: 6-phase progression emphasizing control before completion
- **Safety Errors**: Dedicated subsection with DANGER labels for critical errors
- **Knowledge Questions**: At least 2 safety-critical questions in assessment

### Before Making Automated Changes

Use this checklist before modifying or creating content:

#### Pre-Modification Checklist

- [ ] **Read appropriate CONTRIBUTING-*.md file** for the content type you're working on
- [ ] **Identify content type** (Position, Transition, Submission, Concept, System)
- [ ] **Check existing file** (if editing) for current structure and content
- [ ] **Validate state ID** is unique and follows format (S###, T###, SUB###, C###, SC###)
- [ ] **Review related content** to maintain consistency with existing techniques/positions

#### During Modification

- [ ] **Preserve existing expert insights** - don't remove or drastically alter technical content
- [ ] **Maintain consistent voice/tone** - match the existing style of the project
- [ ] **Follow YAML schema exactly** - use CONTRIBUTING-YAML-SCHEMA.md as reference
- [ ] **Include all required sections** - check section requirements for content type
- [ ] **Validate success rates** - ensure proper ordering (beginner ≤ intermediate ≤ advanced)
- [ ] **Check wikilinks** - verify all linked content exists
- [ ] **Add safety content** (if submission) - never omit safety sections

#### Post-Modification Validation

- [ ] **Run validation script mentally** - check against quality standards above
- [ ] **Verify YAML frontmatter** - all required fields present and properly formatted
- [ ] **Check markdown structure** - all required sections present in correct order
- [ ] **Validate success rates** - proper ordering and realistic values
- [ ] **Test wikilinks** - all links resolve to actual files
- [ ] **Review expert insights** - all three experts included with appropriate perspectives
- [ ] **Safety review** (if submission) - all safety requirements met
- [ ] **SEO check** - title, description, schema.org markup properly formatted

#### Content Quality Checklist

When improving content quality, focus on:

1. **Completeness**: All required sections present and adequately detailed
2. **Accuracy**: Technical information is correct and reflects BJJ best practices
3. **Consistency**: Terminology, formatting, and style match project standards
4. **Clarity**: Explanations are clear and actionable for the target skill level
5. **Safety**: Safety considerations are prominent and comprehensive (especially for submissions)
6. **Educational Value**: Content teaches effectively with proper progression
7. **Machine-Readability**: YAML frontmatter is properly structured for AI/game engine consumption
8. **SEO Optimization**: Metadata is complete and follows best practices

---

## Project Structure

```
bjjgraph/
├── source/
│   └── content/
│       ├── Positions/        # 95 position pages (S### IDs)
│       ├── Transitions/      # 71 transition pages (T### IDs)
│       ├── Submissions/      # 49 submission pages (SUB### IDs)
│       ├── Concepts/         # Conceptual principles (C### IDs)
│       ├── Systems/          # Expert systems (SC### IDs)
│       ├── BJJ-Positions.md      # Hub page for positions
│       ├── BJJ-Transitions.md    # Hub page for transitions
│       ├── BJJ-Submissions.md    # Hub page for submissions
│       ├── BJJ-Escapes.md        # Hub page for escapes
│       └── BJJ-Guard-Passing.md  # Hub page for guard passing
├── docs/                     # Completed work and reference guides
├── todo/                     # Active development tasks
├── scripts/                  # Python automation scripts
└── quartz/                   # Quartz static site generator
```

## Documentation Structure

### /docs/ - Completed Work & Reference Guides

All completed implementation documentation is archived in the `/docs/` directory:

- **CONTRIBUTING.md** - Developer guide, content creation standards, and project philosophy
- **README.md** - Documentation overview and status summary
- **seo-strategy.md** - 6-month SEO strategy with keyword research and goals
- **seo-implementation-complete.md** - Task tracking (99% SEO completion)
- **seo-final-summary.md** - Deployment summary (267 pages, 598+ schema instances)
- **seo-validation-guide.md** - How to validate schema markup and SEO
- **content-standardization-guide.md** - V2 content standards for all types
- **deployment-checklist.md** - Step-by-step deployment procedures
- **game-engine-design.md** - BJJ state machine architecture
- **validation-report-2025-10-12.md** - Content validation archive

See `/docs/README.md` for complete listing and status summary.
See `/docs/CONTRIBUTING.md` for contributor guidelines and project philosophy.

### /todo/ - Active Development Tasks (Reduced: 3 files)

Only active, unfinished work remains in `/todo/`:

- **monetization.md** - Future monetization features (Professor Mode, Scouting, etc.)
- **new_files_to_create.md** - 1,767 missing content files prioritized by SEO value
- **other_todos_left_for_devs.md** - Remaining development tasks (mostly automated now)

**Note**: Most content improvement tasks are now handled automatically by the content-improvement-bot workflow.

## Content Structure

### Content Types

1. **Positions** (95 pages) - BJJ positions with state properties, transitions, and decision trees
2. **Transitions** (71 pages) - Techniques connecting positions with step-by-step execution
3. **Submissions** (49 pages) - Finishing techniques with safety considerations
4. **Concepts** - Fundamental principles and concepts
5. **Systems** - Expert-developed strategic frameworks

### Standard Format

Each content type follows a strict YAML-based schema with:
- Unique ID format (S###, T###, SUB###, C###, SC###)
- Frontmatter with title and description
- Structured sections with required content
- Wikilinks for internal navigation
- Success rates for techniques (Beginner/Intermediate/Advanced)
- Expert insights from Danaher, Gordon Ryan, and Eddie Bravo

See `source/content/CONTRIBUTING-YAML-SCHEMA.md` for complete schema documentation.

---

## SEO Implementation

**Status**: 99% schema coverage achieved across 214+ pages

### Hub Pages Created

Three strategic hub pages were created to improve site architecture and SEO:

1. **BJJ-Submissions.md** (`source/content/BJJ-Submissions.md`)
   - Target Keywords: "BJJ submissions", "Brazilian jiu-jitsu submissions", "submission techniques"
   - 25 submission techniques organized by type
   - Complete learning progression (white → black belt)
   - Competition statistics and safety guidelines

2. **BJJ-Escapes.md** (`source/content/BJJ-Escapes.md`)
   - Target Keywords: "BJJ escapes", "escape techniques", "defensive jiu-jitsu"
   - Organized by position hierarchy
   - Emergency escapes and systematic defense

3. **BJJ-Guard-Passing.md** (`source/content/BJJ-Guard-Passing.md`)
   - Target Keywords: "guard passing", "BJJ guard pass", "passing the guard"
   - Organized by guard type
   - Strategic frameworks and decision trees

**Purpose**: Hub pages act as content clusters, improving internal linking, keyword targeting, and user navigation. They help search engines understand site structure and content relationships.

### Schema Markup Implementation

Six types of JSON-LD schema markup were implemented across 214+ pages:

#### 1. BreadcrumbList Schema
- **Coverage**: All positions, transitions, submissions, and hub pages
- **Purpose**: Helps Google display breadcrumb trails in search results
- **Structure**: Home → Category → Page
- **Script**: `scripts/add_breadcrumb_schema.py`

#### 2. WebPage Schema
- **Coverage**: All content pages
- **Purpose**: Identifies page as part of BJJ Graph website
- **Fields**: name, description, url, isPartOf (website)
- **Script**: `scripts/add_webpage_schema.py`

#### 3. HowTo Schema
- **Coverage**: Position and transition pages
- **Purpose**: Rich snippets for step-by-step techniques
- **Fields**: name, description, step-by-step instructions, totalTime, supply (requirements)
- **Script**: `scripts/add_position_schema_v2.py` and `add_transition_schema_v2.py`

#### 4. FAQ Schema
- **Coverage**: Position, transition, and submission pages
- **Purpose**: FAQ rich snippets in search results
- **Fields**: Question and answer pairs from Knowledge Assessment sections
- **Integrated into**: Position and transition schema scripts

#### 5. ItemList Schema
- **Coverage**: Hub pages (BJJ-Submissions.md, etc.)
- **Purpose**: Displays list of techniques in search results
- **Fields**: Ordered list of related techniques with URLs
- **Manually added to hub pages**

#### 6. Organization Schema
- **Coverage**: Home page and hub pages
- **Purpose**: Establishes BJJ Graph as an organization
- **Fields**: name, url, logo, sameAs (social media)
- **Manually added**

### Benefits of Schema Markup

1. **Rich Snippets**: Enhanced search results with ratings, steps, FAQs
2. **Knowledge Graph**: Potential inclusion in Google Knowledge Graph
3. **Click-Through Rate**: 20-30% improvement in CTR from rich results
4. **Mobile Visibility**: Better display on mobile search results
5. **Voice Search**: Structured data helps voice assistants understand content
6. **Competitive Advantage**: Most BJJ sites lack structured data

### Automation Scripts

Four Python scripts automate schema markup and content validation:

#### 1. add_breadcrumb_schema.py
**Location**: `scripts/add_breadcrumb_schema.py`

**Purpose**: Adds BreadcrumbList schema to all pages

**Usage**:
```bash
python3 scripts/add_breadcrumb_schema.py
```

**What it does**:
- Scans Positions/, Transitions/, Submissions/ directories
- Extracts page name from title or heading
- Generates appropriate breadcrumb trail
- Inserts JSON-LD after frontmatter
- Skips pages that already have BreadcrumbList schema

#### 2. add_webpage_schema.py
**Location**: `scripts/add_webpage_schema.py`

**Purpose**: Adds WebPage schema to all content pages

**Usage**:
```bash
python3 scripts/add_webpage_schema.py
```

**What it does**:
- Extracts title and description from frontmatter
- Generates page URL from file path
- Creates WebPage schema with isPartOf relationship
- Inserts after existing schema markup
- Skips pages that already have WebPage schema

#### 3. add_position_schema_v2.py
**Location**: `scripts/add_position_schema_v2.py`

**Purpose**: Adds HowTo and FAQ schema to position pages

**Usage**:
```bash
python3 scripts/add_position_schema_v2.py
```

**What it does**:
- Parses position execution steps and visual descriptions
- Generates HowTo schema with detailed steps
- Extracts Knowledge Assessment questions for FAQ schema
- Includes success rates and difficulty levels
- Adds physical requirements as "supply" items

#### 4. add_transition_schema_v2.py
**Location**: `scripts/add_transition_schema_v2.py`

**Purpose**: Adds HowTo and FAQ schema to transition pages

**Usage**:
```bash
python3 scripts/add_transition_schema_v2.py
```

**What it does**:
- Parses transition execution steps
- Generates HowTo schema with step-by-step instructions
- Extracts Knowledge Assessment questions for FAQ schema
- Includes timing windows and physical requirements
- Maps starting and ending states

#### 5. validate_content.py
**Location**: `scripts/validate_content.py`

**Purpose**: Comprehensive content validation against YAML schema standards

**Usage**:
```bash
# Validate all content
python3 scripts/validate_content.py source/content/

# Validate specific type
python3 scripts/validate_content.py source/content/ --type Positions

# Verbose mode (show warnings)
python3 scripts/validate_content.py source/content/ --verbose

# Strict mode (warnings become errors)
python3 scripts/validate_content.py source/content/ --strict
```

**What it validates**:
- ID format and uniqueness (S###, T###, SUB###, C###, SC###)
- Required sections for each content type
- Success rate format and ordering
- Wikilink resolution
- Expert insights presence (Danaher, Gordon Ryan, Eddie Bravo)
- SEO frontmatter (title, description)
- Safety sections (mandatory for submissions)
- Execution steps count
- Visual descriptions length

**See**: `scripts/README.md` for detailed validation documentation

### Technical SEO Status

#### ✅ Completed (99%+ Coverage)
- [x] Schema markup (6 types, 99% coverage - 598+ instances across 267 pages)
- [x] Hub pages (5 strategic pages: Positions, Transitions, Submissions, Escapes, Guard Passing)
- [x] Meta titles and descriptions (267+ pages)
- [x] Breadcrumb navigation (BreadcrumbList schema)
- [x] Internal linking structure
- [x] Semantic HTML
- [x] Mobile responsiveness
- [x] Site speed optimization
- [x] XML sitemap (auto-generated by Quartz)
- [x] Open Graph tags
- [x] Twitter Cards
- [x] Canonical URLs
- [x] robots.txt

#### ⚠️ In Progress / Needs Attention
- [ ] Image alt text - Audit and improve
- [ ] 404 page optimization
- [ ] Redirect strategy for URL changes
- [ ] Content quality improvements (automated via bot)

### SEO Validation Checklist

Use this checklist when adding or modifying pages:

**Before Deployment:**
1. Run validation script: `python3 scripts/validate_content.py source/content/ --verbose`
2. Check schema markup with Google's Rich Results Test: https://search.google.com/test/rich-results
3. Validate individual schema with Schema.org validator: https://validator.schema.org/
4. Test breadcrumbs display in search console
5. Verify meta title and description in frontmatter
6. Check internal links resolve correctly
7. Ensure images have descriptive alt text

**Testing Tools:**
- **Google Rich Results Test**: https://search.google.com/test/rich-results
- **Schema Markup Validator**: https://validator.schema.org/
- **Google Search Console**: Monitor rich results and errors
- **Lighthouse SEO Audit**: Built into Chrome DevTools
- **Screaming Frog**: Comprehensive site audit tool

**Post-Deployment:**
1. Submit sitemap to Google Search Console
2. Monitor rich results in Search Console
3. Check for schema errors weekly
4. Track keyword rankings for hub pages
5. Monitor click-through rates from search

### How to Validate Schema Markup

#### Method 1: Google Rich Results Test
```bash
# 1. Open browser to: https://search.google.com/test/rich-results
# 2. Enter page URL: https://bjjgraph.com/positions/mount
# 3. Review detected schema types
# 4. Fix any errors or warnings
```

#### Method 2: Schema.org Validator
```bash
# 1. Open browser to: https://validator.schema.org/
# 2. Paste page URL or schema JSON
# 3. Review validation results
# 4. Check for warnings and errors
```

#### Method 3: View Source
```bash
# 1. Open page in browser
# 2. Right-click → View Page Source
# 3. Search for: <script type="application/ld+json">
# 4. Copy JSON to validator
```

#### Method 4: Browser Extension
- Install "Structured Data Testing Tool" Chrome extension
- Browse site and see schema markup highlighted
- Click extension icon to view parsed schema

### Schema Maintenance

**When adding new pages:**
1. Create page with proper frontmatter (title, description)
2. Run appropriate schema script:
   - Positions: `python3 scripts/add_position_schema_v2.py`
   - Transitions: `python3 scripts/add_transition_schema_v2.py`
   - All pages: `python3 scripts/add_breadcrumb_schema.py`
   - All pages: `python3 scripts/add_webpage_schema.py`
3. Validate with `python3 scripts/validate_content.py source/content/ --type [Type]`
4. Test schema with Google Rich Results Test

**When updating existing pages:**
1. Preserve existing schema markup (between `<script type="application/ld+json">` tags)
2. If changing title/description, update schema accordingly
3. Re-validate after changes
4. Submit updated sitemap to Search Console

**Schema Script Order:**
Run scripts in this order for new pages:
1. `add_webpage_schema.py` (base webpage schema)
2. `add_breadcrumb_schema.py` (breadcrumb navigation)
3. `add_position_schema_v2.py` OR `add_transition_schema_v2.py` (content-specific schema)
4. `validate_content.py` (verify everything is correct)

## Automation & Maintenance

### Content Improvement Bot (Automated)

**Location**: `.github/workflows/content-improvement-bot.yml`

The project includes an automated content improvement workflow that:
- **Runs hourly** via GitHub Actions
- **Improves 5 random files per run** (120 files/day potential)
- **Uses Claude API** (claude-sonnet-4-5 model) for intelligent improvements
- **Follows CONTRIBUTING-*.md standards** for each content type
- **Creates pull requests** with improvements for review

**What the bot handles automatically:**
- Adding missing safety sections to submissions (18 files)
- Adding visual descriptions to positions (63 files)
- Adding visual execution sequences to submissions (23 files)
- Adding execution steps to submissions (14 files)
- Adding common errors sections (18 files)
- General content quality improvements (V2 standard compliance)

**Estimated automation value:** 36+ hours of manual work

**Monitoring the bot:**
1. Check GitHub Actions tab for workflow runs
2. Review pull requests created by the bot
3. Validate improvements meet quality standards
4. Merge approved PRs or request changes

**Configuration:**
- API key: Stored in GitHub Secrets (`ANTHROPIC_API_KEY`)
- Standards: Uses CONTRIBUTING-POSITIONS.md, CONTRIBUTING-SUBMISSIONS.md, etc.
- Rate: 5 files per hour (adjustable in workflow file)

### Future SEO Tasks

**Priority 1 (High Impact):**
1. Add canonical URLs to all pages
2. Create and optimize robots.txt
3. Add Twitter Card meta tags
4. Implement OpenGraph tags for social sharing
5. Add structured data for authors/contributors

**Priority 2 (Medium Impact):**
1. Create additional hub pages (Positions, Guards, Sweeps)
2. Add video schema markup when videos are added
3. Implement review schema for techniques
4. Add aggregate rating schema
5. Create topic clusters for content

**Priority 3 (Low Impact):**
1. Add language tags (hreflang) for internationalization
2. Implement JSON-LD for navigation menus
3. Add speakable schema for voice search
4. Create FAQ pages for common questions
5. Add more internal linking opportunities

---

## Common Development Tasks

### Building the Site

```bash
npx quartz build
```

### Running Development Server

```bash
npx quartz serve
```

### Validating Content

```bash
# Validate all content
python3 scripts/validate_content.py source/content/

# Validate specific type with details
python3 scripts/validate_content.py source/content/ --type Positions --verbose
```

### Adding Schema Markup to New Pages

```bash
# Add all schema types to new pages
python3 scripts/add_webpage_schema.py
python3 scripts/add_breadcrumb_schema.py
python3 scripts/add_position_schema_v2.py  # For positions
python3 scripts/add_transition_schema_v2.py  # For transitions
```

### Creating New Content

1. Create markdown file in appropriate directory (Positions/, Transitions/, etc.)
2. Read appropriate CONTRIBUTING-*.md file for content type standards
3. Add frontmatter with title and description
4. Follow YAML schema standards (see CONTRIBUTING-YAML-SCHEMA.md)
5. Use appropriate ID format (S###, T###, SUB###, C###, SC###)
6. Run validation script to check compliance
7. Run schema scripts to add structured data
8. Test in development server

### Updating Hub Pages

Hub pages require manual updates when:
- New techniques are added
- Content organization changes
- Keywords need optimization

Remember to update:
- Table of contents
- Technique counts
- Internal links
- Schema ItemList entries

---

## Content Conventions

### Wikilinks
- Use `[[Page Name]]` for internal links
- Must match exact filename (without .md extension)
- Special pages: `[[Won by Submission]]`, `[[Guard Opening Sequence]]`

### IDs
- Positions: `S###` (e.g., S001, S042)
- Transitions: `T###` (e.g., T001, T099)
- Submissions: `SUB###` (e.g., SUB001, SUB049)
- Concepts: `C###` (e.g., C001)
- Systems: `SC###` (e.g., SC001)

### Success Rates
Format: `(Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)`
- Beginner ≤ Intermediate ≤ Advanced
- Values must be 0-100
- All three levels required

### Expert Insights
All technical pages should include insights from:
1. **John Danaher** - Technical precision and theory
2. **Gordon Ryan** - Competition application
3. **Eddie Bravo** - Innovation and creativity

### Frontmatter Template

```yaml
---
title: "[Technique Name] | [Type] | BJJ Graph"
description: "Master [technique name] with step-by-step guide. Learn execution, counters, and success rates. Expert insights from Danaher, Ryan, and Bravo."
---
```

---

## Key Files and Directories

### Content Standards
- `source/content/CONTRIBUTING-YAML-SCHEMA.md` - Complete schema documentation
- `source/content/Positions/CONTRIBUTING-POSITIONS.md` - Position standard (V2)
- `source/content/Transitions/CONTRIBUTING-TRANSITIONS.md` - Transition standard
- `source/content/Submissions/CONTRIBUTING-SUBMISSIONS.md` - Submission standard (SAFETY FIRST)
- `source/content/Concepts/CONTRIBUTING-CONCEPTS.md` - Concept standard
- `source/content/Systems/CONTRIBUTING-SYSTEMS.md` - System standard

**Note**: All CONTRIBUTING-*.md files are excluded from the website build. They serve as contributor and automation documentation only.

### Scripts Documentation
- `scripts/README.md` - Scripts overview and usage
- `scripts/VALIDATION_SUMMARY.md` - Validation documentation
- `scripts/QUICK_START.md` - Quick reference guide

### Hub Pages
- `source/content/BJJ-Submissions.md`
- `source/content/BJJ-Escapes.md`
- `source/content/BJJ-Guard-Passing.md`

---

## Important Notes

### Schema Markup Best Practices
1. **Always validate** schema with Google Rich Results Test before deployment
2. **Don't duplicate** schema types on the same page (one HowTo, one FAQ, etc.)
3. **Keep JSON-LD clean** - no comments, proper formatting
4. **Update schema** when page content changes significantly
5. **Monitor Search Console** for schema errors weekly

### Content Quality Standards
1. **Minimum lengths**: Visual descriptions (200+ chars), Execution steps (6+ steps)
2. **Required sections**: Vary by content type (see CONTRIBUTING-*.md files)
3. **Expert insights**: All three experts for completeness
4. **Success rates**: All three skill levels with realistic values
5. **Safety sections**: Mandatory for all submissions

### Performance Considerations
1. **Schema overhead**: JSON-LD adds ~2-5KB per page (acceptable)
2. **Build time**: Schema generation happens pre-build (no runtime cost)
3. **Maintenance**: Automated scripts reduce manual overhead
4. **Validation**: Run validation before major deployments

---

## Contact and Resources

**Project Repository**: (Add GitHub URL here)
**Site URL**: https://bjjgraph.com
**Quartz Documentation**: https://quartz.jzhao.xyz/

### External Resources
- **Schema.org**: https://schema.org/
- **Google Search Central**: https://developers.google.com/search
- **Rich Results Test**: https://search.google.com/test/rich-results
- **Structured Data Guide**: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data

---

## Version History

**v1.1 - October 2025**
- Updated content standards section to reference CONTRIBUTING-*.md files
- Added "For Automated Bots & Content Improvement" section
- Removed references to deprecated 000.STANDARD.md files
- Added comprehensive quality checklist for automated improvements
- Added "Before Making Automated Changes" checklist
- Documented V2 standard structure (unified YAML frontmatter)
- Added safety requirements for submission content

**v1.0 - October 2025**
- Initial SEO implementation
- 214+ pages with schema markup (99% coverage)
- 3 hub pages created
- 5 Python automation scripts
- Complete validation system

---

*This documentation is maintained for developers and AI assistants working on BJJ Graph. Keep it updated when making significant changes to structure, content, or SEO implementation.*
