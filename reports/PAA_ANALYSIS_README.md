# BJJ Graph - People Also Ask (PAA) Analysis

## Overview

This directory contains PAA (People Also Ask) analysis for BJJ Graph articles, designed to optimize content for AI search engines and conversational queries. The analysis identifies gaps between user search intent and current content structure.

## What is PAA Analysis?

"People Also Ask" are the expandable question boxes that appear in Google search results. These questions represent:
- **Real user search patterns** - What people actually ask Google
- **AI training data** - Questions used to train ChatGPT, Claude, Perplexity
- **Voice search queries** - How users phrase questions to Alexa, Siri, Google Assistant
- **Featured snippet opportunities** - Content that can appear at position zero in search results

## Files in This Analysis

### Individual Article Analysis
- `paa_grasshopper_guard.json` - Analysis for Grasshopper Guard position
- `paa_half_guard.json` - Analysis for Half Guard position

Each file contains:
- **Seed keyword** extracted from article
- **PAA questions** identified from search behavior
- **Priority classification** (high/medium/low)
- **Integration strategies** (improve_heading, add_section, dedicated_faq)
- **Heading optimizations** converting technical to conversational
- **Missing content opportunities** based on user questions
- **Schema markup recommendations** for rich results

### Summary Report
- `paa_summary.txt` - Executive summary with actionable insights

## Analysis Methodology

### 1. Seed Keyword Extraction
```
JSON files → 'name' field
Markdown files → 'title' from frontmatter
Cleaned → Remove "| BJJ Graph" suffix
```

### 2. PAA Question Sources
Since DataForSEO MCP server is not currently configured, this analysis uses:
- **BJJ search research** - Common practitioner queries
- **Content gap analysis** - Missing sections from comprehensive review
- **Competitor analysis** - Questions addressed on other BJJ sites
- **Reddit/forum analysis** - Real questions from r/bjj, Sherdog, etc.

### 3. Priority Classification

**HIGH Priority** = Immediate action required
- Definitional queries: "What is [technique]?"
- Instructional queries: "How do you do [technique]?"
- Tactical queries: "When should you use [technique]?"
- Best practices: "What are the best [options] from [position]?"

**MEDIUM Priority** = Important for comprehensiveness
- Comparative queries: "What's the difference between X and Y?"
- Applicability: "Can you do [technique] in gi/no-gi?"
- Prerequisites: "What do you need to learn [technique]?"
- Suitability: "Is [technique] good for beginners?"

**LOW Priority** = Nice to have
- Historical context: "Who invented [technique]?"
- Tangential information: Background stories, etymology

### 4. Integration Strategies

| Strategy | When to Use | Example |
|----------|-------------|---------|
| **improve_heading** | Existing section matches query intent | "Overview" → "What is Half Guard in BJJ?" |
| **add_section** | Missing content that needs dedicated coverage | Add "When to Use Grasshopper Guard" |
| **dedicated_faq** | Multiple quick-answer questions | Add FAQ section at bottom |
| **improve_existing** | Content exists but needs enhancement | Expand prerequisites with specifics |

## Key Findings

### Grasshopper Guard

**Top Opportunities:**
1. Convert "Overview" heading to "What is Grasshopper Guard in BJJ?"
2. Add "When to Use Grasshopper Guard" section (tactical timing)
3. Add "How to Set Up Grasshopper Guard" section (entry sequences)
4. Create FAQ addressing flexibility requirements, beginner suitability

**Content Gaps:**
- No dedicated entry sequence section
- Flexibility requirements not quantified
- Limited competition context guidance

### Half Guard

**Top Opportunities:**
1. Convert main headings to question format
2. Add dedicated sections for Deep Half, Lockdown, Knee Shield
3. Add "How to Prevent Being Flattened" troubleshooting section
4. Create "The Underhook Battle" tactical breakdown

**Content Gaps:**
- Variations listed but not explained in detail
- Missing beginner-to-advanced progression roadmap
- No gi vs no-gi comparison
- Underhook battle lacks dedicated coverage

## Implementation Priority

### Phase 1: Quick Wins (1-2 hours)
Convert headings to question format:
```json
"Overview" → "What is [Position] in BJJ?"
"Offensive Transitions" → "What Are the Best [Techniques] from [Position]?"
"Prerequisites" → "What Do You Need to Learn [Position]?"
"Common Errors" → "What Are Common [Position] Mistakes?"
```

### Phase 2: FAQ Sections (2-3 hours)
Add FAQ sections to both articles with 8-12 questions:
- Beginner suitability questions
- Gi vs no-gi applicability
- Comparison to similar positions
- Prerequisites and requirements

### Phase 3: New Sections (4-6 hours per article)
**Grasshopper Guard:**
- When to Use section
- How to Set Up section
- Gi vs No-Gi section

**Half Guard:**
- Deep Half Guard Explained
- Lockdown System Explained
- Knee Shield vs Regular Half Guard
- How to Prevent Being Flattened

### Phase 4: New Articles (8-16 hours each)
See `tests/artifacts/suggested_new_files.csv` for:
- Deep Half Guard (dedicated article)
- Lockdown Half Guard System
- Knee Shield Half Guard
- Inverted Guard Fundamentals
- Half Guard Underhook Battle

## SEO Impact

### Heading Optimization Benefits
- **Voice search alignment** - Matches natural language queries
- **Featured snippet targeting** - Question format preferred by Google
- **AI chatbot training** - Conversational structure used in AI training data
- **User engagement** - Questions create curiosity and encourage clicks

### FAQ Section Benefits
- **FAQ schema markup** - Rich results in search
- **Multiple keyword targeting** - Each question targets different query
- **Reduced bounce rate** - Users find answers faster
- **Increased dwell time** - More comprehensive content

### Schema Markup Enhancements

**Recommended additions:**
```json
{
  "@type": "HowTo",
  "name": "How to Set Up Grasshopper Guard",
  "step": [...]
}

{
  "@type": "FAQPage",
  "mainEntity": [...]
}

{
  "@type": "VideoObject",
  "name": "Grasshopper Guard Tutorial",
  ...
}
```

## Measuring Success

Track these metrics post-implementation:

### Search Console Metrics
- Impressions for question-formatted keywords
- CTR improvement for optimized pages
- Featured snippet captures
- Position in SERP for target queries

### On-Page Metrics
- Time on page increase
- Scroll depth to new sections
- Bounce rate reduction
- FAQ interaction rate

### Traffic Sources
- Organic search growth
- Voice search traffic
- AI chatbot referrals (Perplexity, ChatGPT Browse)
- Long-tail question query traffic

## Using This Analysis

### For Content Editors
1. Review individual JSON files for your article
2. Prioritize HIGH priority questions first
3. Implement quick wins (heading changes) immediately
4. Plan new sections based on missing content opportunities
5. Update schema markup in templates

### For SEO Strategists
1. Review `paa_summary.txt` for big picture insights
2. Prioritize articles with most high-priority gaps
3. Track competitor PAA appearances
4. Monitor search console for new question queries
5. Plan content calendar around new article suggestions

### For Developers
1. Implement HowTo schema in Jinja2 templates
2. Add FAQ schema support
3. Create conversational heading components
4. Build PAA monitoring dashboard

## Integration with DataForSEO MCP

To fetch real-time PAA data from Google:

### 1. Install MCP Server
```bash
npm install -g @dataforseo/mcp-server
```

### 2. Configure Claude Code
Add to `~/.claude/mcp_settings.json`:
```json
{
  "mcpServers": {
    "dataforseo": {
      "command": "npx",
      "args": ["-y", "@dataforseo/mcp-server"],
      "env": {
        "DATAFORSEO_LOGIN": "your_login",
        "DATAFORSEO_PASSWORD": "your_password"
      }
    }
  }
}
```

### 3. Run Analysis
```bash
python3 scripts/paa_analysis_with_mcp.py \
  source/content/Positions/Grasshopper\ Guard.json \
  source/content/Positions/Half\ Guard.json
```

The script will:
1. Extract seed keywords
2. Fetch real PAA data from Google SERP
3. Analyze content gaps
4. Generate optimization recommendations
5. Create reports in `reports/` directory

## Questions?

This analysis was generated by Claude Code following BJJ Graph's AI workflow.

For implementation guidance:
- Review `CLAUDE.md` for AI workflow
- Check `docs/SEO.md` for schema markup details
- See `docs/Content.md` for content standards

---

**Next Steps:**
1. Review high-priority opportunities
2. Implement heading optimizations
3. Draft FAQ sections
4. Plan new article creation
5. Monitor search console for results
