# PAA (People Also Ask) Data Fetching Workflow

## Overview
This document describes the workflow for fetching Google SERP "People Also Ask" data to optimize BJJ Graph content for AI search.

## Tool Limitation
**IMPORTANT**: The required MCP tool `mcp__dataforseo__serp_organic_live_advanced` is not currently available in this Claude Code session. To proceed with PAA data fetching, you need to:

1. Install the DataForSEO MCP server
2. Configure it with your DataForSEO API credentials
3. Restart Claude Code to load the MCP tool

## Extracted Seed Keywords

### Article 1: Learning Psychology
- **File**: `source/content/Learning/Learning Psychology.md`
- **Seed Keyword**: "Learning Psychology"
- **Alt Keywords**: "BJJ Learning Psychology", "Learning Psychology in BJJ", "Brazilian Jiu Jitsu Learning"

### Article 2: Crackhead Control
- **File**: `source/content/Positions/Crackhead Control.json`
- **Seed Keyword**: "Crackhead Control"
- **Alt Keywords**: "Crackhead Control BJJ", "Crackhead Control Position", "Eddie Bravo Crackhead Control"

## Required MCP Tool Call Structure

Once the MCP tool is available, use the following call structure:

```json
{
  "tool": "mcp__dataforseo__serp_organic_live_advanced",
  "parameters": {
    "keyword": "<seed_keyword>",
    "location_name": "United States",
    "language_code": "en",
    "device": "desktop",
    "people_also_ask_click_depth": 2,
    "depth": 50
  }
}
```

## Expected Output Structure

For each article, create `tests/artifacts/<filename>_paa.json`:

```json
{
  "article_path": "source/content/...",
  "seed_keyword": "extracted keyword",
  "paa_questions": [
    {
      "question": "What is...",
      "answer_snippet": "...",
      "source_url": "...",
      "priority": "high|medium|low",
      "integration_strategy": "dedicated_faq|improve_heading|add_section"
    }
  ],
  "heading_optimizations": [
    {
      "current": "Current Heading",
      "suggested": "Suggested Question-Format Heading",
      "rationale": "Matches conversational query pattern"
    }
  ],
  "missing_content_opportunities": [
    "Add section: Topic Name",
    "Expand coverage: Specific Detail"
  ]
}
```

## Integration Strategy Guide

### Priority Levels
- **High**: Direct match to article topic, commonly searched questions
- **Medium**: Related questions that enhance article depth
- **Low**: Tangentially related, consider for future content

### Integration Strategies
- **dedicated_faq**: Add FAQ section with question as heading
- **improve_heading**: Convert existing heading to question format
- **add_section**: Create new content section addressing the question

## Next Steps

1. Install DataForSEO MCP server:
   ```bash
   npm install @anthropic/mcp-dataforseo
   ```

2. Configure MCP server in Claude Code settings with API credentials

3. Restart Claude Code

4. Re-run this PAA analysis workflow with MCP tool access

## Alternative Approach (Manual)

If MCP tool cannot be configured, you can manually:

1. Search Google for each seed keyword
2. Click on PAA questions to expand (2 levels deep)
3. Record questions, answer snippets, and source URLs
4. Structure data according to the JSON template above
5. Save to `tests/artifacts/<filename>_paa.json`

This manual approach is time-consuming but can provide the same optimization insights.
