# BJJ Graph - SEO Deployment Checklist

## Pre-Deployment Validation

### Schema Markup Validation
- [ ] Validate sample pages with Google Rich Results Test
- [ ] Verify all schema types are properly formatted
- [ ] Check for duplicate schemas on any page
- [ ] Confirm breadcrumb navigation works

### Technical SEO Validation
- [ ] Verify sitemap.xml is generated in build output
- [ ] Confirm robots.txt is in build output
- [ ] Check canonical URLs on 5 sample pages
- [ ] Verify Open Graph tags on 5 sample pages
- [ ] Verify Twitter Card tags on 5 sample pages
- [ ] Test meta descriptions are present

### Content Validation
- [ ] All 5 hub pages render correctly
- [ ] Internal links work properly
- [ ] No broken wikilinks
- [ ] Images load correctly

### Build Process
- [ ] Run `npx quartz build` successfully
- [ ] Check build output for errors
- [ ] Verify output directory size is reasonable
- [ ] Test with `npx quartz build --serve` locally

## Deployment Steps

### 1. Build
```bash
cd source
npx quartz build
```

### 2. Deploy (add your deployment method)
- [ ] Upload build output to hosting
- [ ] Verify DNS is pointing correctly
- [ ] Confirm HTTPS is working

### 3. Post-Deployment Validation
- [ ] Visit https://bjjgraph.org/ - loads correctly
- [ ] Check https://bjjgraph.org/sitemap.xml - accessible
- [ ] Check https://bjjgraph.org/robots.txt - accessible
- [ ] Verify 5 random content pages load
- [ ] Verify all 5 hub pages load

## Google Search Console Setup

### Submit Sitemap
- [ ] Log into Google Search Console
- [ ] Submit https://bjjgraph.org/sitemap.xml
- [ ] Wait for indexing to begin (can take days/weeks)

### Monitor Coverage
- [ ] Check Pages report after 7 days
- [ ] Verify pages are being indexed
- [ ] Check for any indexing errors
- [ ] Monitor rich results eligibility

## Schema Validation (Post-Deploy)

### Rich Results Test
Test these pages with Google Rich Results Test (https://search.google.com/test/rich-results):
- [ ] A Position page (should show HowTo, FAQ, BreadcrumbList, WebPage)
- [ ] A Transition page (should show HowTo, BreadcrumbList, WebPage)
- [ ] BJJ-Positions.md hub page (should show ItemList, BreadcrumbList, WebPage)
- [ ] BJJ-Submissions.md hub page (should show ItemList, BreadcrumbList, WebPage)
- [ ] BJJ-Escapes.md hub page (should show ItemList, BreadcrumbList, WebPage)

Expected schema types per page type:
- **Position pages**: WebPage, BreadcrumbList, HowTo, FAQ (4 types)
- **Transition pages**: WebPage, BreadcrumbList, HowTo (3 types)
- **Hub pages**: WebPage, BreadcrumbList, ItemList (3 types)
- **All pages**: Organization (site-wide)

## Performance Monitoring

### Week 1
- [ ] Check Google Search Console daily for indexing
- [ ] Monitor for any crawl errors
- [ ] Check for rich result eligibility

### Week 2-4
- [ ] Monitor impressions and clicks
- [ ] Check average position for target keywords
- [ ] Review rich results appearance

### Month 2-3
- [ ] Compare traffic to baseline
- [ ] Identify high-performing pages
- [ ] Optimize low-performing pages

## Troubleshooting

### If sitemap not found:
- Verify sitemap.xml in build output directory
- Check server configuration for .xml files
- Ensure no caching issues

### If schema not showing in Rich Results Test:
- View page source, verify JSON-LD is present
- Copy JSON-LD to validator.schema.org
- Check for syntax errors in JSON

### If pages not indexing:
- Check robots.txt isn't blocking
- Verify canonical URLs are correct
- Check for noindex meta tags
- Submit individual URLs in Search Console

## Success Metrics

Track these metrics over 3-6 months:
- Organic traffic increase: Target 30-50%
- Rich results impressions: Should increase
- Click-through rate: Should improve
- Average position: Should improve for target keywords
- Pages indexed: Should be 90%+ of total pages

## Maintenance Schedule

### Weekly
- Check Search Console for errors

### Monthly
- Review performance metrics
- Update content as needed
- Check for broken links

### Quarterly
- Review and update hub pages
- Add new techniques as they're documented
- Run schema validation on new pages

---

**Prepared:** 2025-10-12
**Schema Coverage:** 99%
**Pages:** 215+
**Hub Pages:** 5
**Schema Types:** 6 (WebPage, BreadcrumbList, HowTo, FAQ, ItemList, Organization)
