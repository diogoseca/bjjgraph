# Position Templates - Hub-and-Spoke Architecture

This directory contains templates for creating BJJ position content with hub-and-spoke SEO architecture.

## Template Overview

### JSON Templates (3)

| Template | Use Case | Generates | Example |
|----------|----------|-----------|---------|
| **TEMPLATE-POSITION-FAMILY.json** | Positions WITH variations | Hub + Bottom + Top pages | Mount (has high-mount, s-mount variations) |
| **TEMPLATE-POSITION-DUAL.json** | Simple positions, two perspectives | Bottom + Top pages | Turtle (no variations) |
| **TEMPLATE-POSITION-SINGLE.json** | Neutral/asymmetric positions | Single page | Standing Position (no top/bottom) |

### Markdown Templates (4)

| Template | Input | Output | Word Count |
|----------|-------|--------|------------|
| **TEMPLATE-HUB.md.jinja2** | hub + bottom_summary + top_summary | Hub page | ~2500 |
| **TEMPLATE-BOTTOM.md.jinja2** | bottom section | Bottom (defense) page | ~2000 |
| **TEMPLATE-TOP.md.jinja2** | top section | Top (attacks) page | ~2000 |
| **TEMPLATE-SINGLE.md.jinja2** | full data | Single comprehensive page | ~2000 |

---

## Template Selection Guide

### Use TEMPLATE-POSITION-FAMILY.json when:
- Position has variations (high mount, s-mount, deep half, lockdown, etc.)
- You want hub page + bottom page + top page
- Examples: Mount, Closed Guard, Half Guard, Side Control, Back Control

**Generates:**
- `/positions/mount` (hub - 2500w)
- `/positions/mount/bottom` (2000w)
- `/positions/mount/top` (2000w)

### Use TEMPLATE-POSITION-DUAL.json when:
- Position has two clear perspectives (top/bottom)
- NO variations
- Examples: Turtle, North-South, Kesa Gatame, Crucifix, 50-50 Guard

**Generates:**
- `/positions/turtle/bottom` (2000w)
- `/positions/turtle/top` (2000w)

### Use TEMPLATE-POSITION-SINGLE.json when:
- Position is neutral (no clear top/bottom)
- Both players have equal opportunity
- Examples: Standing, Clinch, Scramble, Guard Pull (transitional)

**Generates:**
- `/positions/standing` (2000w single page)

---

## JSON Structure Breakdown

### FAMILY Template Structure

```json
{
  "position_family": {
    "name": "mount",
    "slug": "mount"
  },

  "hub": {
    "title": "...",
    "overview": "400+ words",
    "state_properties": {...},
    "key_principles": [3-5 general principles],
    "variations": [list of variations],
    "related_positions": [...]
  },

  "bottom": {
    "metadata": {...},
    "overview": "400+ words (defensive)",
    // 13 sections (see Role Sections below)
  },

  "top": {
    "metadata": {...},
    "overview": "400+ words (offensive)",
    // 13 sections (see Role Sections below)
  }
}
```

**One JSON file -> Three web pages**

---

### DUAL Template Structure

```json
{
  "position_name": "turtle",
  "slug": "turtle",

  "bottom": {
    // 13 sections (defensive focus)
  },

  "top": {
    // 13 sections (offensive focus)
  }
}
```

**One JSON file -> Two web pages**

---

### SINGLE Template Structure

```json
{
  "metadata": {
    "title": "...",
    "tags": [...]
  },

  "overview": "400+ words",
  "state_properties": {...},
  // 13 sections (neutral perspective)
}
```

**One JSON file -> One web page**

---

### Role Sections (13 per Top/Bottom)

Each role object (top or bottom) contains these keys:

| # | Key | Description |
|---|-----|-------------|
| 1 | `name` | Role name (e.g., "Mount Top") |
| 2 | `description` | SEO meta description (140-180 chars) |
| 3 | `overview` | 400+ word narrative |
| 4 | `state_properties` | Point value, position type, risk level, energy cost |
| 5 | `state_invariants` | 3+ anatomical/positional conditions that must hold |
| 6 | `prerequisites` | 3+ conditions required before entering |
| 7 | `key_principles` | 5-7 fundamental concepts |
| 8 | `transitions` | Array of `{transition, attempt_probability}` (must sum to 100%) |
| 9 | `decision_tree` | 3+ if/else conditions with probabilistic actions |
| 10 | `common_errors` | 5+ mistakes with consequence and correction |
| 11 | `training_drills` | 3+ drills with name, description, duration |
| 12 | `related_content` | 3-15 related positions/techniques |
| 13 | `position_metrics` | Retention, advancement, submission rates by skill level |

---

## Content Creator Workflow

### Creating a Position Family (e.g., Mount)

1. **Copy template**
   ```bash
   cp templates/Positions/TEMPLATE-POSITION-FAMILY.json templates/Positions/Mount.json
   ```

2. **Fill out hub section**
   - General overview (400w)
   - Key principles (3-5 general)
   - List variations
   - Related positions

3. **Fill out bottom section**
   - Defensive overview (400w)
   - 4+ transitions with `attempt_probability` summing to 100%
   - 5+ defensive errors
   - Training drills

4. **Fill out top section**
   - Offensive overview (400w)
   - 4+ transitions with `attempt_probability` summing to 100%
   - 5+ offensive errors
   - Training drills

5. **Validate and regenerate**
   ```bash
   npm run regenerate
   ```

6. **Result:** 3 pages generated automatically

---

### Creating a Simple Dual Position (e.g., Turtle)

1. **Copy template**
   ```bash
   cp templates/Positions/TEMPLATE-POSITION-DUAL.json templates/Positions/Turtle.json
   ```

2. **Fill out bottom section**
   - Defensive content

3. **Fill out top section**
   - Offensive content

4. **Validate and regenerate**
   ```bash
   npm run regenerate
   ```

5. **Result:** 2 pages generated

---

### Creating a Neutral Position (e.g., Standing)

1. **Copy template**
   ```bash
   cp templates/Positions/TEMPLATE-POSITION-SINGLE.json templates/Positions/Standing.json
   ```

2. **Fill out content**
   - Neutral perspective
   - All techniques available to both players

3. **Validate and regenerate**
   ```bash
   npm run regenerate
   ```

4. **Result:** 1 page generated

---

## Build Script Integration

The regeneration script `scripts/regenerate_md_from_json.py` handles:

1. **Scan** `templates/Positions/*.json`
2. **Detect** template type:
   - Has `hub` key? -> FAMILY
   - Has `bottom` and `top` keys but no `hub`? -> DUAL
   - Neither? -> SINGLE
3. **Generate** appropriate pages:
   - FAMILY -> hub + bottom + top
   - DUAL -> bottom + top
   - SINGLE -> single page
4. **Render** using appropriate Jinja2 template
5. **Write** to `content/Positions/`

Run with:
```bash
npm run regenerate:md
```

---

## Hub Page Generation Logic

### For FAMILY template:

```python
# Read single JSON
data = read_json("Mount.json")

# Extract summaries for hub
bottom_summary = {
    'key_principles': data['bottom']['key_principles'][:5],
    'top_escapes': data['bottom']['transitions'][:4],
    'top_errors': data['bottom']['common_errors'][:3]
}

top_summary = {
    'key_principles': data['top']['key_principles'][:5],
    'top_attacks': data['top']['transitions'][:6],
    'top_errors': data['top']['common_errors'][:3]
}

# Render hub page
hub_template = env.get_template('TEMPLATE-HUB.md.jinja2')
hub_content = hub_template.render(
    hub=data['hub'],
    bottom_summary=bottom_summary,
    top_summary=top_summary,
    slug=data['position_family']['slug']
)

# Write hub
write_file(f"positions/{slug}/index.md", hub_content)

# Render bottom page
bottom_template = env.get_template('TEMPLATE-BOTTOM.md.jinja2')
bottom_content = bottom_template.render(bottom=data['bottom'])
write_file(f"positions/{slug}/bottom.md", bottom_content)

# Render top page
top_template = env.get_template('TEMPLATE-TOP.md.jinja2')
top_content = top_template.render(top=data['top'])
write_file(f"positions/{slug}/top.md", top_content)
```

**Result:** 1 JSON file -> 3 markdown pages

---

## Position Categorization

### Category 1: Families (~20 positions)
**Template:** TEMPLATE-POSITION-FAMILY.json

- Mount (variations: high-mount, s-mount, technical-mount, mounted-triangle)
- Closed Guard
- Half Guard (variations: deep-half, lockdown, knee-shield, z-guard)
- Open Guard (variations: butterfly, spider, DLR, X-guard, etc.)
- Side Control (variations: kesa-gatame, reverse-kesa, north-south)
- Back Control (variations: body-triangle, standing-back)
- Butterfly Guard (variations: butterfly-half)
- Spider Guard
- De La Riva Guard (variations: reverse-DLR)
- X-Guard (variations: single-leg-X, reverse-X)
- Ashi Garami (variations: inside, outside, cross, saddle, 50-50)

### Category 2: Simple Dual (~30 positions)
**Template:** TEMPLATE-POSITION-DUAL.json

- Turtle
- North-South (if treated as separate from side control)
- Crucifix
- Triangle Control
- Kneebar Control
- Kimura Trap
- Americana Control
- D'Arce Control
- Anaconda Control
- Guillotine Control
- Omoplata Control
- Reverse Guard positions

### Category 3: Neutral/Single (~10 positions)
**Template:** TEMPLATE-POSITION-SINGLE.json

- Standing Position
- Clinch Position
- Scramble Position
- Guard Pull (transitional)
- Neutral Starting Position
- Takedown Attempt (transitional)

---

## SEO Benefits

### Hub Pages (2500 words)
- Target primary keywords: "mount position bjj" (1200/mo)
- Comprehensive overview with both perspectives
- Lower bounce rate (user gets immediate value)
- Higher dwell time (2500 words = 5+ min read)
- Internal linking hub to all variations

### Bottom Pages (2000 words)
- Target escape keywords: "mount escapes" (320/mo)
- Defensive focus
- Full technique breakdowns
- Training drills

### Top Pages (2000 words)
- Target attack keywords: "mount attacks" (480/mo)
- Offensive focus
- Submission chains
- Competition strategies

### No Cannibalization
- Different keywords per page type
- Different user intents
- Clear internal linking
- Concentrated authority per URL

---

## File Organization

### JSON Source (in templates/Positions/)
```
templates/Positions/
├── Mount.json (FAMILY - contains hub + bottom + top)
├── High Mount.json (FAMILY - subvariation)
├── S Mount.json (FAMILY - subvariation)
├── Technical Mount.json (FAMILY - subvariation)
├── Turtle.json (DUAL - bottom + top)
├── Standing Position.json (SINGLE)
...
```

### Generated Output (in content/Positions/)
```
content/Positions/
├── Mount.md (hub - AUTO-GENERATED)
├── Mount/
│   ├── Bottom.md (from Mount.json bottom section)
│   ├── Top.md (from Mount.json top section)
│   ├── High Mount.md (subhub)
│   ├── High Mount/
│   │   ├── Bottom.md
│   │   └── Top.md
│   └── S Mount/
│       ├── Bottom.md
│       └── Top.md
...
```
