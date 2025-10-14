# BJJ Graph Scripts - Quick Reference

**One-page cheat sheet for common script commands**

---

## Content Validation

```bash
# Validate all content
python3 scripts/validate_content.py source/content/

# Validate specific type
python3 scripts/validate_content.py source/content/ --type Positions

# Show warnings
python3 scripts/validate_content.py source/content/ --verbose

# Strict mode (warnings = errors)
python3 scripts/validate_content.py source/content/ --strict
```

---

## SEO Schema Markup

```bash
# Add all schema to new pages (run in order)
python3 scripts/seo/add_webpage_schema.py
python3 scripts/seo/add_breadcrumb_schema.py
python3 scripts/seo/add_position_schema_v2.py     # For positions
python3 scripts/seo/add_transition_schema_v2.py   # For transitions
```

---

## Link Optimization

```bash
# Full validation + AI suggestions
python3 scripts/link_optimizer/link_optimizer_cli.py --mode full --verbose

# Validation only (fast)
python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate --verbose

# Apply high-confidence fixes
python3 scripts/link_optimizer/apply_suggestions.py --confidence 95 --verbose

# Random walk traversal test
python3 scripts/link_optimizer/link_optimizer_cli.py --mode random-walk --walk-length 1000
```

---

## Build & Deploy

```bash
# Build site
cd source
npx quartz build

# Build and test locally
npx quartz build --serve

# Check build output
ls -lh public/
```

---

## Common Quick Fixes

### Fix broken wikilinks
```bash
python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate
# Review: reports/link_optimizer/02_SUMMARIES/broken_links_summary.md
```

### Check schema markup
```bash
# Validate with Google Rich Results Test
open https://search.google.com/test/rich-results
# Enter URL: https://bjjgraph.com/positions/mount
```

### Find validation errors
```bash
python3 scripts/validate_content.py source/content/ | grep "ERROR"
```

### Update deprecated references
```bash
# Find old references
grep -r "000.STANDARD.md" source/content/

# Replace with
# CONTRIBUTING-POSITIONS.md or CONTRIBUTING-TRANSITIONS.md
```

---

## Exit Codes

- **0** = Success (no errors)
- **1** = Failure (errors found)

```bash
if python3 scripts/validate_content.py source/content/; then
    echo "✅ Validation passed"
else
    echo "❌ Validation failed"
fi
```

---

## File Locations

| Tool | Location |
|------|----------|
| **Content validation** | `scripts/validate_content.py` |
| **SEO scripts** | `scripts/seo/` |
| **Link optimizer** | `scripts/link_optimizer/` |
| **Deprecated scripts** | `scripts/deprecated/` |

---

## Documentation

| Topic | Location |
|-------|----------|
| **Scripts overview** | `/scripts/README.md` |
| **Schema examples** | `/docs/scripts/EXAMPLES.md` |
| **SEO guide** | `/docs/seo/` |
| **Link optimizer guide** | `/docs/tools/link-optimizer.md` |
| **Content standards** | `/source/content/CONTRIBUTING-YAML-SCHEMA.md` |

---

**For detailed documentation, see `/scripts/README.md` or `/docs/`**
