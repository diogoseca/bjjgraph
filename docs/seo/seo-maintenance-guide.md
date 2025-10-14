# SEO Maintenance Guide

**Purpose:** Ongoing SEO tasks and monitoring procedures for BJJ Graph
**Last Updated:** October 14, 2025

---

## Overview

This guide provides weekly, monthly, and quarterly SEO maintenance tasks to sustain and improve organic search performance after the initial implementation is deployed.

**Prerequisites:**
- Site deployed to production
- Google Search Console configured
- Google Analytics (GA4) configured
- Schema markup validated

---

## Daily Monitoring (5 minutes)

### Quick Health Checks

**Every morning:**
1. Site accessibility check: https://bjjgraph.com
2. Quick Google Search Console review (any critical alerts?)
3. Traffic anomalies in analytics (major spikes or drops?)

**Tools:**
- Browser (site check)
- Google Search Console mobile app
- GA4 dashboard

**Action items:**
- If site down → Follow incident response procedures
- If critical GSC errors → Investigate immediately
- If traffic drops >50% → Check for algorithm updates or technical issues

---

## Weekly Tasks (30-45 minutes)

### Week 1: Indexing & Coverage

**Monday Morning (15 min):**
1. Check Google Search Console → Coverage report
   - Pages indexed (goal: 240+/270, 90%+)
   - New pages discovered vs. indexed
   - Coverage errors or warnings

2. Review Rich Results status
   - Pages eligible for rich results
   - Rich result errors (schema issues)
   - New rich results appearing

3. Quick actions:
   - Request indexing for any new hub pages
   - Fix critical coverage errors
   - Submit any new sitemaps

**Friday Afternoon (15 min):**
4. Check search analytics (past 7 days)
   - Total impressions (trending up/down?)
   - Total clicks (trending up/down?)
   - Average CTR (improving with rich results?)
   - Average position (improving?)

5. Identify top 10 performing pages
   - Note which pages are driving traffic
   - Plan content updates for these pages

**Action items:**
- If indexing rate <80% → Investigate sitemap/robots.txt
- If rich result errors > 5 → Run schema validation
- If impressions dropping → Check for de-indexing or penalties

---

### Week 2: Performance & Technical

**Monday Morning (15 min):**
1. Run Lighthouse audit on 5 random pages
   - Performance score (goal: >90)
   - SEO score (goal: >95)
   - Accessibility (goal: >95)
   - Best Practices (goal: >90)

2. Check Core Web Vitals in Search Console
   - LCP (Largest Contentful Paint) <2.5s
   - INP (Interaction to Next Paint) <200ms
   - CLS (Cumulative Layout Shift) <0.1

3. Review mobile usability issues
   - Should be zero issues

**Wednesday (15 min):**
4. Check for broken links
   - Run: `python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate`
   - Fix any high-priority broken links
   - Update link optimizer reports

**Friday (15 min):**
5. Schema markup spot check
   - Test 3 random pages with Google Rich Results Test
   - Verify schema still valid
   - Check for new schema errors in GSC

**Action items:**
- If performance score drops >10 points → Investigate recent changes
- If Core Web Vitals fail → Optimize affected pages
- If broken links >20 → Run link optimizer cleanup session

---

### Week 3: Content & Links

**Monday Morning (20 min):**
1. Review top 20 landing pages (organic traffic)
   - Check bounce rate (goal: <55%)
   - Check time on page (goal: >2 minutes)
   - Check pages per session from these pages

2. Identify content improvement opportunities
   - Pages with high bounce rate → Need better content
   - Pages with low time → Content not engaging
   - High traffic but low conversion → CTA issues

**Wednesday (15 min):**
3. Internal linking review
   - Check avg internal links per page (goal: 3-5)
   - Identify orphan pages (no internal links)
   - Update hub pages if new content added

4. External backlink monitoring
   - Check for new backlinks (Google Search Console → Links)
   - Identify referring domains
   - Note any toxic/spammy links for disavow

**Friday (10 min):**
5. Content calendar check
   - Review upcoming content plan
   - Ensure new content follows V2 standards
   - Plan schema markup for upcoming pages

**Action items:**
- If bounce rate >65% on key pages → Improve content quality
- If orphan pages detected → Add internal links
- If toxic backlinks found → Create disavow file

---

### Week 4: Analytics & Reporting

**Monday Morning (30 min):**
1. Generate monthly report (see Monthly Tasks below)
2. Review against monthly targets
3. Update stakeholders with progress

**Wednesday (15 min):**
4. Competitive analysis
   - Check competitor rankings for target keywords
   - Identify new competitors
   - Note any major content updates from competitors

**Friday (15 min):**
5. Plan next month's priorities
   - Based on monthly report insights
   - Adjust strategy if needed
   - Create action items for next month

---

## Monthly Tasks (2-3 hours)

### First Monday of Month

**1. Comprehensive Search Console Review (45 min)**

**Indexing & Coverage:**
- Total pages indexed vs. total pages
- New pages added this month
- Pages removed from index (investigate why)
- Coverage errors by type
- Excluded pages (intentional vs. unintentional)

**Search Analytics (past 28 days vs. previous 28 days):**
- Total impressions (% change)
- Total clicks (% change)
- Average CTR (% change)
- Average position (% change)

**Rich Results:**
- Total rich result impressions
- Rich result click-through rate
- Schema error count
- New rich result types appearing

**Core Web Vitals:**
- % of URLs with good LCP
- % of URLs with good INP
- % of URLs with good CLS
- Mobile vs. Desktop performance

**2. Keyword Ranking Review (30 min)**

Track target keywords in Search Console or ranking tool:

| Keyword | Monthly Searches | Current Position | Change | Goal |
|---------|------------------|------------------|--------|------|
| bjj positions | 2,200 | [Check] | [+/-X] | Page 1 by Month 3 |
| bjj submissions | 5,400 | [Check] | [+/-X] | Page 1 by Month 4 |
| bjj escapes | 880 | [Check] | [+/-X] | Page 1 by Month 2 |
| guard passing | 720 | [Check] | [+/-X] | Page 1 by Month 3 |
| [technique name] | [volume] | [Check] | [+/-X] | [goal] |

**Action items:**
- Keywords moving up → Identify what's working, double down
- Keywords dropping → Investigate competitor changes, update content
- Keywords stagnant → Consider content refresh or link building

**3. Traffic & Engagement Analysis (30 min)**

**Google Analytics Review:**
- Organic traffic (total sessions, % change)
- Organic users (new vs. returning)
- Top landing pages (organic only)
- Bounce rate by page type (Positions/Transitions/Submissions)
- Pages per session
- Average session duration
- Conversion events (if configured)

**Top Performing Content:**
- Top 10 pages by organic traffic
- Top 10 pages by engagement (time + pages/session)
- Top 10 pages by conversion (if applicable)

**Underperforming Content:**
- High impressions, low clicks (poor meta descriptions or titles)
- High clicks, high bounce (content doesn't match intent)
- Low impressions altogether (not ranking for anything)

**4. Backlink Profile Review (15 min)**

**Google Search Console → Links:**
- Total external links (trending up?)
- New referring domains this month
- Top linking sites
- Most linked content

**Quality Assessment:**
- Domain authority of referring domains
- Relevance of linking sites (BJJ/martial arts related?)
- Anchor text diversity
- Any suspicious/spammy links

**5. Technical Health Check (30 min)**

**Site Audit:**
- Run Screaming Frog or similar (free tier: 500 URLs)
- Check for 404 errors
- Verify canonical tags
- Check meta tag completeness
- Review redirect chains
- Check robots.txt and sitemap

**Schema Validation:**
- Run validation on 10 random pages
- Check for schema deprecation warnings
- Verify schema still renders correctly

**6. Content Quality Spot Check (15 min)**

**Random Sample:**
- Pick 5 random content pages
- Verify: Title, description, schema, internal links, content quality
- Check for: Broken wikilinks, missing sections, outdated information

**Automated Check:**
```bash
python3 scripts/validate_content.py source/content/ | grep "ERROR"
```
- Should return minimal errors
- Fix critical errors immediately

---

## Quarterly Tasks (4-6 hours)

### Content Refresh Strategy

**Every 3 months:**

1. **Identify stale content (90+ days old)**
   - Pages with declining traffic
   - Pages with outdated information
   - Pages with broken links

2. **Content refresh priorities:**
   - High traffic pages (update to maintain rankings)
   - Declining traffic pages (revive with updates)
   - New keyword opportunities (expand coverage)

3. **Refresh checklist per page:**
   - [ ] Update statistics or examples
   - [ ] Add new techniques or variations
   - [ ] Expand expert insights
   - [ ] Improve internal linking
   - [ ] Refresh meta description if CTR is low
   - [ ] Add FAQ section if missing
   - [ ] Update schema markup if structure changed

### Quarterly SEO Audit

**Comprehensive review:**

1. **Keyword Strategy Review**
   - Are we ranking for target keywords?
   - Should we target new keywords?
   - Competitor keyword gap analysis

2. **Technical SEO Audit**
   - Full site crawl (Screaming Frog, Sitebulb, or similar)
   - Identify technical issues
   - Check for duplicate content
   - Review site architecture

3. **Content Gap Analysis**
   - What content is driving traffic?
   - What content types should we create more of?
   - User intent analysis (are we matching search intent?)

4. **Link Building Review**
   - Backlink quality assessment
   - Disavow toxic links if necessary
   - Identify link building opportunities
   - Outreach campaign planning

5. **Schema Optimization**
   - Review schema performance (which types drive clicks?)
   - Expand schema coverage
   - Update to new schema types if available

### Algorithm Update Response

**When Google announces major updates:**

1. **Immediate (Day 1):**
   - Review official Google announcement
   - Check Search Console for impact
   - Monitor traffic patterns

2. **Week 1:**
   - Assess ranking changes for target keywords
   - Identify pages affected (gainers/losers)
   - Review if changes align with update focus

3. **Week 2-4:**
   - Adjust content strategy if needed
   - Update pages affected negatively
   - Double down on what's working

---

## Ongoing Maintenance Procedures

### When Adding New Content

**Checklist for every new page:**
1. [ ] Follow content standards (CONTRIBUTING-*.md files)
2. [ ] Add proper YAML frontmatter (title, description, tags)
3. [ ] Include required sections (varies by content type)
4. [ ] Add success rates (all skill levels)
5. [ ] Include all 3 expert insights
6. [ ] Add internal wikilinks (3-5 per page)
7. [ ] Run validation: `python3 scripts/validate_content.py source/content/`
8. [ ] Add schema markup:
   ```bash
   python3 scripts/seo/add_webpage_schema.py
   python3 scripts/seo/add_breadcrumb_schema.py
   python3 scripts/seo/add_position_schema_v2.py  # or transition
   ```
9. [ ] Build and test locally: `npx quartz build --serve`
10. [ ] Request indexing in GSC after deployment

### When Updating Hub Pages

**Hub pages should be updated:**
- When adding 5+ new pages in a category
- Quarterly content refresh
- When major new content is added (new submission, new system)

**Update procedure:**
1. Add new technique to appropriate section
2. Update table of contents
3. Update ItemList schema
4. Update technique count in intro
5. Re-validate schema
6. Request re-indexing in GSC

### When Fixing Broken Links

**Monthly procedure:**
```bash
# Run link validator
python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate --verbose

# Review broken links report
cat reports/link_optimizer/02_SUMMARIES/broken_links_summary.md

# Apply high-confidence fixes (>95%)
python3 scripts/link_optimizer/apply_suggestions.py --confidence 95 --verbose

# Manual review medium-confidence (80-94%)
# Review and apply selectively
```

---

## Performance Targets & Thresholds

### Green (Healthy)
- Pages indexed: >90%
- Schema errors: <1%
- Organic traffic growth: +10% month-over-month
- Average position: Improving 2+ positions/month
- Core Web Vitals: 100% good URLs
- Rich results: 50+ pages showing

### Yellow (Needs Attention)
- Pages indexed: 70-90%
- Schema errors: 1-5%
- Organic traffic: Flat or <10% growth
- Average position: No improvement
- Core Web Vitals: 80-99% good URLs
- Rich results: 20-50 pages

### Red (Critical)
- Pages indexed: <70%
- Schema errors: >5%
- Organic traffic: Declining
- Average position: Dropping >5 positions
- Core Web Vitals: <80% good URLs
- Rich results: <20 pages

**Response:**
- Green: Maintain current strategy
- Yellow: Investigate and adjust within 1 week
- Red: Emergency audit and fixes within 48 hours

---

## Maintenance Schedule Summary

### Daily (5 min)
- Site accessibility check
- Critical alert monitoring

### Weekly (30-45 min/week)
- **Week 1:** Indexing & Coverage (30 min)
- **Week 2:** Performance & Technical (45 min)
- **Week 3:** Content & Links (45 min)
- **Week 4:** Analytics & Reporting (60 min)

### Monthly (2-3 hours)
- Comprehensive Search Console review
- Keyword ranking tracking
- Traffic analysis
- Backlink monitoring
- Technical health check
- Content quality spot check

### Quarterly (4-6 hours)
- Content refresh strategy
- Full SEO audit
- Keyword strategy review
- Link building review
- Schema optimization
- Algorithm update assessment

### Annually (8-10 hours)
- Complete SEO strategy review
- Competitive landscape analysis
- Goal setting for next year
- Major content overhauls
- Technical infrastructure upgrades

---

## Emergency Procedures

### Sudden Traffic Drop (>30% in 24 hours)

**Investigate:**
1. Google algorithm update announced?
2. Manual penalty in Search Console?
3. Technical issue (site down, robots.txt blocking, noindex added)?
4. Competitor launched major content?
5. Seasonal variation?

**Actions:**
1. Check Search Console for manual actions
2. Verify site is accessible and indexed
3. Review recent deployments (any changes?)
4. Check Google Search Status for algorithm updates
5. Compare to competitors (are they affected too?)

### Schema Errors Spike

**If schema errors >10 pages:**
1. Check recent deployments (bad schema added?)
2. Run validation: `python3 scripts/validate_content.py`
3. Test affected pages with Rich Results Test
4. Rollback if recent deployment caused it
5. Fix schema and redeploy

### Indexing Issues

**If pages indexed drops below 70%:**
1. Check robots.txt hasn't accidentally blocked content
2. Verify sitemap.xml is accessible
3. Check for noindex tags added accidentally
4. Review server logs for crawler access
5. Request re-indexing in GSC

---

## Tools & Resources

### Essential Tools
- **Google Search Console** - Primary monitoring tool
- **Google Analytics (GA4)** - Traffic and engagement
- **Google Rich Results Test** - Schema validation
- **PageSpeed Insights** - Performance monitoring
- **Screaming Frog** - Technical SEO audits (free tier: 500 URLs)

### Optional Tools
- **Ahrefs/SEMrush** - Keyword tracking and backlinks (paid)
- **UptimeRobot** - Site monitoring (free tier)
- **Plausible Analytics** - Privacy-friendly analytics (in use)

### Internal Tools
- `validate_content.py` - Content validation
- `link_optimizer_cli.py` - Link validation and optimization
- SEO schema scripts - Schema markup generation

---

## Success Metrics Dashboard

### Track These KPIs Monthly

| Metric | Baseline | Month 1 | Month 3 | Month 6 | Current |
|--------|----------|---------|---------|---------|---------|
| **Organic Traffic** | 500/mo | 650 (+30%) | 1,000 (+100%) | 1,500 (+200%) | [Track] |
| **Pages Indexed** | 0 | 240 (90%) | 250 (93%) | 260 (96%) | [Track] |
| **Page 1 Rankings** | 0 | 5 | 10 | 20 | [Track] |
| **Rich Snippets** | 0 | 20 | 50 | 100 | [Track] |
| **Domain Authority** | <20 | 18 | 20 | 25 | [Track] |
| **Backlinks** | 0 | 10 | 25 | 50 | [Track] |
| **Avg Position** | 35.3 | 30 | 25 | 20 | [Track] |

---

## Changelog

### October 2025
- Guide created
- Maintenance schedule established
- Weekly task breakdown defined

---

**For issues or questions**, see:
- **SEO Strategy**: [seo-strategy.md](./seo-strategy.md)
- **Implementation Report**: [seo-implementation-report.md](./seo-implementation-report.md)
- **Validation Procedures**: [seo-validation-guide.md](./seo-validation-guide.md)

---

**Status:** ✅ Active Maintenance Guide | 📅 Follow Weekly Schedule | 🎯 Track Monthly KPIs
