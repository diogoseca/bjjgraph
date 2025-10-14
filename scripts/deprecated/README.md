# Deprecated Scripts

**Archived scripts - superseded by V2 implementations**

⚠️ **These scripts are no longer maintained and should not be used for new work.**

---

## Why These Scripts Were Deprecated

### V1 Schema Scripts (Replaced by V2)

The following scripts used an older schema structure that has been superseded:

- **add_position_schema.py** → Replaced by `seo/add_position_schema_v2.py`
- **add_transition_schema.py** → Replaced by `seo/add_transition_schema_v2.py`

**Key improvements in V2**:
- Unified YAML frontmatter structure
- Better HowTo schema with detailed steps
- FAQ schema extracted from Knowledge Assessment
- Physical requirements as "supply" items
- More accurate success rate mapping
- Better integration with content standards

**Migration**: All pages have been updated to V2. Do not use V1 scripts.

---

### Meta Scripts (One-time use, now redundant)

These scripts were used for one-time migrations:

- **add_position_meta.py** - Added meta titles/descriptions (completed October 12, 2025)
- **add_transition_meta.py** - Added meta titles/descriptions (completed October 12, 2025)

**Why deprecated**: All pages now have proper frontmatter. New pages should follow CONTRIBUTING-*.md standards from the start.

---

### One-Time Fix Scripts

These scripts addressed specific issues that have been resolved:

- **fix_remaining_frontmatter.py** - Fixed frontmatter issues (completed October 12, 2025)
- **fix_submission_frontmatter.py** - Fixed submission frontmatter (completed October 12, 2025)
- **add_internal_links.py** - Added internal links (completed October 12, 2025, later superseded by link_optimizer)

**Why deprecated**: Issues fixed, content standards updated, better tools now available.

---

## Script Inventory

### V1 Schema Scripts (Superseded)
| Script | Purpose | Replacement | Status |
|--------|---------|-------------|--------|
| add_position_schema.py | V1 position schema | seo/add_position_schema_v2.py | ❌ Deprecated |
| add_transition_schema.py | V1 transition schema | seo/add_transition_schema_v2.py | ❌ Deprecated |

### Meta Scripts (One-time use)
| Script | Purpose | Completion Date | Status |
|--------|---------|-----------------|--------|
| add_position_meta.py | Add position meta tags | Oct 12, 2025 | ✅ Complete |
| add_transition_meta.py | Add transition meta tags | Oct 12, 2025 | ✅ Complete |

### Fix Scripts (One-time use)
| Script | Purpose | Completion Date | Status |
|--------|---------|-----------------|--------|
| fix_remaining_frontmatter.py | Fix frontmatter issues | Oct 12, 2025 | ✅ Complete |
| fix_submission_frontmatter.py | Fix submission frontmatter | Oct 12, 2025 | ✅ Complete |
| add_internal_links.py | Add internal links | Oct 12, 2025 | ✅ Superseded by link_optimizer |

---

## If You Need To Use These Scripts

**Don't.**

But if you absolutely must (e.g., for historical research):

1. **Check V2 first**: See if `scripts/seo/` has a V2 replacement
2. **Read the code**: Understand what it does before running
3. **Backup first**: Make a backup before running on content
4. **Test on one file**: Never run on entire directory without testing

**Better alternative**: Follow the content standards in `/source/content/CONTRIBUTING-*.md` for new content.

---

## Migration Notes

### V1 → V2 Schema Migration (October 12, 2025)

**What changed**:
- YAML frontmatter structure unified across all content types
- HowTo schema improved with better step extraction
- FAQ schema now uses Knowledge Assessment questions
- Physical requirements mapped as "supply" items
- Success rates properly formatted in schema

**Files affected**: All position and transition pages (141 files)

**Migration command**:
```bash
# V1 scripts removed all old schema
# V2 scripts applied new schema
python3 scripts/seo/add_position_schema_v2.py
python3 scripts/seo/add_transition_schema_v2.py
```

**Validation**: Run `python3 scripts/validate_content.py source/content/ --verbose` after migration.

---

## Related Documentation

- **Current Scripts**: `/scripts/README.md` - Active script inventory
- **SEO Scripts**: `/scripts/seo/README.md` - V2 schema scripts
- **Content Standards**: `/source/content/CONTRIBUTING-YAML-SCHEMA.md`

---

**Status**: 🗄️ Archived | ❌ Deprecated | 📚 Historical Reference Only
