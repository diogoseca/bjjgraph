# Variant Aggregation for FAMILY Position Hub Pages

## Overview

FAMILY position hub pages (Mount, Half Guard, etc.) display comparison tables showing risk/energy across all variants. The data comes from **multiple JSON files** that json_to_md.py must aggregate.

---

## File Structure Example

```
source/content/Positions/
├── Mount.json (FAMILY template)
└── mount/
    ├── High-Mount.json (DUAL template)
    ├── S-Mount.json (DUAL template)
    └── Technical-Mount.json (DUAL template)
```

---

## json_to_md.py Aggregation Process

### Step 1: Detect FAMILY Template

When processing `Mount.json`:

```python
if 'variations' in data and 'bottom' in data and 'top' in data:
    template_type = 'FAMILY'
```

### Step 2: Load Base Position Properties

From `Mount.json` itself (also a DUAL):
```python
base_data = {
    'name': data['name'],                                    # "Mount"
    'bottom_risk': data['bottom']['state_properties']['risk_level'],
    'top_risk': data['top']['state_properties']['risk_level'],
    'bottom_energy': data['bottom']['state_properties']['energy_cost'],
    'top_energy': data['top']['state_properties']['energy_cost'],
    'uniqueness': data['variant_uniqueness']
}
```

### Step 3: Load All Variant Files

For each variant listed in `variations` array:

```python
variants_comparison = []

for variant_ref in data['variations']:
    # Build path: mount/{slug}.json
    variant_path = family_dir / f"{variant_ref['slug']}.json"

    if variant_path.exists():
        variant_data = load_json(variant_path)

        variants_comparison.append({
            'name': variant_data['name'],                    # "High Mount"
            'bottom_risk': variant_data['bottom']['state_properties']['risk_level'],
            'top_risk': variant_data['top']['state_properties']['risk_level'],
            'bottom_energy': variant_data['bottom']['state_properties']['energy_cost'],
            'top_energy': variant_data['top']['state_properties']['energy_cost'],
            'uniqueness': variant_data['variant_uniqueness']
        })
```

### Step 4: Render Hub with Aggregated Data

Pass to jinja template:
```python
render_template('TEMPLATE-HUB.md.jinja2', {
    'name': data['name'],
    'description': data['description'],
    'overview': data['overview'],
    'key_principles': data['key_principles'],
    'variant_uniqueness': data['variant_uniqueness'],
    'variations': data['variations'],  # Original variation list
    'variants_comparison': variants_comparison,  # Aggregated properties
    'bottom_summary': {...},  # Base position bottom data
    'top_summary': {...},     # Base position top data
    'slug': data['slug']
})
```

---

## Required Fields in Variant JSON Files

Each variant file (High-Mount.json, S-Mount.json) **must have**:

```json
{
  "name": "High Mount",
  "slug": "high-mount",
  "variant_uniqueness": "Higher positioning trades stability for arm access",  // Max 50 chars
  "bottom": {
    "metadata": {...},
    "state_properties": {
      "position_type": "...",
      "risk_level": "HIGH|MEDIUM|LOW",      // Required for table
      "energy_cost": "HIGH|MEDIUM|LOW",     // Required for table
      "time_sustainability": "..."
    },
    ...
  },
  "top": {
    "metadata": {...},
    "state_properties": {
      "position_type": "...",
      "risk_level": "HIGH|MEDIUM|LOW",      // Required for table
      "energy_cost": "HIGH|MEDIUM|LOW",     // Required for table
      "time_sustainability": "..."
    },
    ...
  }
}
```

---

## Table Output Example

### DUAL (Turtle) - Simple Comparison

Shows in hub page:
```markdown
| Property | Bottom Perspective | Top Perspective |
|----------|-------------------|-----------------|
| Position Type | Defensive | Offensive |
| Risk Level | HIGH | LOW |
| Energy Cost | MEDIUM | LOW |
| Time Sustainability | Short | Medium |

**What Makes This Position Unique:** Hands-and-knees posture trades back exposure for submission protection
```

### FAMILY (Mount) - Multi-Variant Tables

Shows in hub page:
```markdown
### Risk Level by Variant and Perspective

| Variant | Bottom Risk | Top Risk | What Makes This Variant Unique |
|---------|-------------|----------|-------------------------------|
| [[Mount]] | MEDIUM | LOW | Standard straddled position balances control and submission access |
| [[High Mount]] | HIGH | LOW | Higher positioning trades stability for arm access |
| [[S-Mount]] | HIGH | LOW | Asymmetric base creates arm isolation advantage |

### Energy Cost by Variant and Perspective

| Variant | Bottom Energy | Top Energy | What Makes This Variant Unique |
|---------|---------------|------------|-------------------------------|
| [[Mount]] | MEDIUM | LOW | Standard straddled position balances control and submission access |
| [[High Mount]] | HIGH | MEDIUM | Higher positioning requires active maintenance |
| [[S-Mount]] | HIGH | MEDIUM | Asymmetric base creates arm isolation advantage |
```

---

## Validation Requirements

validate_json.py does NOT validate variant aggregation (too complex).

json_to_md.py should:
1. Check variant files exist before rendering
2. Warn if variant file missing
3. Skip missing variants in tables (don't fail entire render)

---

## Error Handling

```python
for variant_ref in data['variations']:
    variant_path = family_dir / f"{variant_ref['slug']}.json"

    if not variant_path.exists():
        print(f"⚠️  Variant file not found: {variant_path}")
        print(f"   Skipping {variant_ref['name']} in comparison tables")
        continue

    # Load and aggregate...
```

---

## Summary

**DUAL positions:** Comparison table built from single JSON file
**FAMILY positions:** Comparison tables built by aggregating base + variant JSON files
**Aggregation happens:** In json_to_md.py only
**Template needs:** variants_comparison array passed from aggregation logic
