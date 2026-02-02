# DataForSEO MCP Tool Usage Guide

## Tool Name
`mcp__dataforseo__serp_organic_live_advanced`

## Purpose
Fetch real-time Google SERP data including "People Also Ask" (PAA) questions for SEO analysis.

---

## Query Parameters for Backside 50-50

```json
{
  "keyword": "Backside 50-50",
  "location_name": "United States",
  "language_code": "en",
  "device": "desktop",
  "people_also_ask_click_depth": 2,
  "depth": 50
}
```

### Expected Output Structure
```json
{
  "organic_results": [...],
  "people_also_ask": [
    {
      "question": "What is backside 50-50 in BJJ?",
      "answer": {
        "snippet": "Backside 50-50 is a leg entanglement position...",
        "source_url": "https://example.com/article",
        "title": "Understanding Backside 50-50"
      },
      "expanded_questions": [
        {
          "question": "How do you escape backside 50-50?",
          "answer": {...}
        }
      ]
    }
  ]
}
```

---

## Query Parameters for Crackhead Control

```json
{
  "keyword": "Crackhead Control",
  "location_name": "United States",
  "language_code": "en",
  "device": "desktop",
  "people_also_ask_click_depth": 2,
  "depth": 50
}
```

---

## Parameter Explanations

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `keyword` | Article seed keyword | Primary search query |
| `location_name` | "United States" | Geographic targeting for SERP results |
| `language_code` | "en" | English language results |
| `device` | "desktop" | Desktop SERP format (vs mobile) |
| `people_also_ask_click_depth` | 2 | Expand PAA questions 2 levels deep |
| `depth` | 50 | Return up to 50 organic results |

---

## Processing PAA Data After Query

### Step 1: Extract Questions
```python
paa_questions = []
for paa_item in response['people_also_ask']:
    question_data = {
        'question': paa_item['question'],
        'answer_snippet': paa_item['answer']['snippet'],
        'source_url': paa_item['answer']['source_url'],
        'priority': 'high',  # Determine based on relevance
        'integration_strategy': 'improve_heading'  # Or 'add_section' or 'dedicated_faq'
    }
    paa_questions.append(question_data)
```

### Step 2: Prioritize Questions

**High Priority Criteria:**
- Direct match to article topic
- Definitional questions (What is...)
- High-intent action queries (How to..., When to...)
- Comparison queries (vs, difference between)

**Medium Priority Criteria:**
- Related concepts
- Skill level questions
- Equipment/gear questions
- Historical/origin questions

**Low Priority Criteria:**
- Tangentially related
- Already well-covered in content
- Low search intent alignment

### Step 3: Determine Integration Strategy

**improve_heading:**
- Question can be answered by existing content section
- Reframe section heading to match PAA question format
- Example: "Offensive Transitions" → "What are the best submissions from X?"

**add_section:**
- Question addresses content gap
- Requires new dedicated section
- Example: Missing "When to Use" section

**dedicated_faq:**
- Question requires brief, direct answer
- Works well in FAQ schema markup block
- Example: "Is X legal in IBJJF?"

### Step 4: Update Template JSON

Replace `[TO BE FILLED FROM DATAFORSEO]` placeholders in:
- `tests/artifacts/backside_50_50_paa_template.json`
- `tests/artifacts/crackhead_control_paa_template.json`

---

## Alternative Search Variations to Test

If primary keyword returns limited PAA data, try:

### For Backside 50-50:
- "backside 50 50 bjj"
- "backside 50/50 position"
- "50 50 guard variations"
- "leg entanglement positions bjj"

### For Crackhead Control:
- "crackhead control bjj"
- "crackhead position jiu jitsu"
- "10th planet crackhead control"
- "chair sit position bjj"
- "eddie bravo turtle system"

---

## Validation Checklist

After fetching real PAA data:

- [ ] Verify questions are relevant to article topic
- [ ] Check answer snippets for accuracy (compare to BJJGraph content)
- [ ] Validate source URLs are authoritative sites
- [ ] Confirm expanded questions (depth 2) provide additional insights
- [ ] Compare actual vs anticipated PAA questions in templates
- [ ] Update priority levels based on search volume/competition
- [ ] Document any unexpected high-value queries discovered

---

## Example Tool Invocation (Pseudocode)

```
Tool: mcp__dataforseo__serp_organic_live_advanced

Parameters:
- keyword: "Backside 50-50"
- location_name: "United States"
- language_code: "en"
- device: "desktop"
- people_also_ask_click_depth: 2
- depth: 50

Expected Response Time: 5-15 seconds

Store Output: tests/artifacts/backside_50_50_raw_serp.json
```

---

## Post-Processing Script

After obtaining raw SERP data, run:

```bash
# Parse PAA data and update templates
python3 scripts/process_paa_data.py \
  --input tests/artifacts/backside_50_50_raw_serp.json \
  --template tests/artifacts/backside_50_50_paa_template.json \
  --output tests/artifacts/backside_50_50_paa.json
```

---

## Troubleshooting

**Issue:** No PAA results returned
**Solution:** Try alternative keyword variations, check if keyword is too niche

**Issue:** PAA questions irrelevant
**Solution:** Refine keyword to be more specific (add "bjj" or "jiu jitsu")

**Issue:** Depth parameter returns too much data
**Solution:** Reduce depth to 20-30 to focus on top results only

**Issue:** Click depth 2 creates redundant questions
**Solution:** Review expanded questions and deduplicate before integration

---

**Next Step:** Execute queries using actual MCP tool, then populate template JSON files with real data.
