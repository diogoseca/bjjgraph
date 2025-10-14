# SEO Scripts

**Active schema markup and SEO automation scripts (V2)**

## Scripts

### add_breadcrumb_schema.py
**Purpose**: Adds BreadcrumbList schema to all pages for improved search navigation

**Usage**:
```bash
python3 scripts/seo/add_breadcrumb_schema.py
```

**What it does**:
- Scans Positions/, Transitions/, Submissions/ directories
- Generates appropriate breadcrumb trail (Home → Category → Page)
- Inserts JSON-LD after frontmatter
- Skips pages that already have BreadcrumbList schema

**Coverage**: 100% (270/270 pages)

---

### add_webpage_schema.py
**Purpose**: Adds WebPage schema to all content pages

**Usage**:
```bash
python3 scripts/seo/add_webpage_schema.py
```

**What it does**:
- Extracts title and description from frontmatter
- Generates page URL from file path
- Creates WebPage schema with isPartOf relationship
- Inserts after existing schema markup

**Coverage**: 100% (270/270 pages)

---

### add_position_schema_v2.py
**Purpose**: Adds HowTo and FAQ schema to position pages

**Usage**:
```bash
python3 scripts/seo/add_position_schema_v2.py
```

**What it does**:
- Parses position execution steps and visual descriptions
- Generates HowTo schema with detailed steps
- Extracts Knowledge Assessment questions for FAQ schema
- Includes success rates and difficulty levels
- Adds physical requirements as "supply" items

**Coverage**: Position pages with execution steps

---

### add_transition_schema_v2.py
**Purpose**: Adds HowTo and FAQ schema to transition pages

**Usage**:
```bash
python3 scripts/seo/add_transition_schema_v2.py
```

**What it does**:
- Parses transition execution steps
- Generates HowTo schema with step-by-step instructions
- Extracts Knowledge Assessment questions for FAQ schema
- Includes timing windows and physical requirements
- Maps starting and ending states

**Coverage**: Transition pages with execution steps

---

## Schema Coverage Status

| Schema Type | Coverage | Count | Status |
|-------------|----------|-------|--------|
| WebPage | 100% | 270/270 | ✅ Complete |
| BreadcrumbList | 100% | 270/270 | ✅ Complete |
| HowTo | 51% | 137/270 | ⚠️ Partial |
| FAQPage | 9% | 24/270 | ⚠️ Partial |

**Total**: 598+ schema instances across 267 pages

---

## Running All Scripts

To apply all schema markup to new pages:

```bash
# 1. Add base webpage schema
python3 scripts/seo/add_webpage_schema.py

# 2. Add breadcrumb navigation
python3 scripts/seo/add_breadcrumb_schema.py

# 3. Add content-specific schema
python3 scripts/seo/add_position_schema_v2.py    # For positions
python3 scripts/seo/add_transition_schema_v2.py  # For transitions

# 4. Validate everything
python3 scripts/validate_content.py source/content/ --verbose
```

---

## Validation

After running scripts, validate schema with:

1. **Google Rich Results Test**: https://search.google.com/test/rich-results
2. **Schema.org Validator**: https://validator.schema.org/
3. **Local validation**: `python3 scripts/validate_content.py source/content/ --verbose`

---

## Related Documentation

- **SEO Docs Overview**: `/docs/seo/README.md`
- **SEO Strategy**: `/docs/seo/seo-strategy.md`
- **Validation Guide**: `/docs/seo/seo-validation-guide.md`
- **Schema Examples**: `/docs/scripts/EXAMPLES_v2.md`
- **Quick Start**: `/docs/scripts/QUICK_START.md`

---

**Status**: ✅ Active | 🔄 V2 Schema Implementation | 📊 99% Coverage Achieved
