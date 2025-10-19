# PostHog Analytics Setup Guide

This guide walks through setting up PostHog analytics for BJJ Graph.

## Prerequisites

1. A PostHog account (sign up at https://posthog.com)
2. Access to the BJJ Graph GitHub repository settings
3. A PostHog project created for BJJ Graph

## Step 1: Get Your PostHog API Key

### From PostHog Cloud (app.posthog.com)

1. Log into your PostHog account at https://app.posthog.com
2. Select your project (or create a new one for BJJ Graph)
3. Click on "Project Settings" in the left sidebar
4. Scroll to the "Project API Key" section
5. Copy your Project API Key (starts with `phc_`)

### From Self-Hosted PostHog

1. Log into your self-hosted PostHog instance
2. Navigate to Project Settings
3. Copy your Project API Key

## Step 2: Add API Key and Host to GitHub Secrets

1. Go to the BJJ Graph repository: https://github.com/diogoseca/bjjgraph
2. Click on **Settings** (top navigation)
3. In the left sidebar, click **Secrets and variables** → **Actions**

### Add POSTHOG_API_KEY:
4. Click **New repository secret**
5. Enter the following:
   - **Name:** `POSTHOG_API_KEY`
   - **Secret:** Paste your PostHog API key (starts with `phc_`)
6. Click **Add secret**

### Add POSTHOG_API_HOST (Optional but Recommended):
7. Click **New repository secret** again
8. Enter the following:
   - **Name:** `POSTHOG_API_HOST`
   - **Secret:** Paste your PostHog host URL (e.g., `https://us.i.posthog.com`)
9. Click **Add secret**

**Note:** If you don't add `POSTHOG_API_HOST`, it will default to `https://app.posthog.com`. However, if you're using a regional instance (US or EU), you should add this secret with the correct host URL.

## Step 3: Verify Setup

### Automatic Deployment

Once the secret is added, the next deployment will automatically include PostHog analytics:

1. Push any change to the `main` branch, OR
2. Manually trigger the workflow:
   - Go to **Actions** tab
   - Select "Build and Test" workflow
   - Click "Run workflow"

### Manual Verification

After deployment completes:

1. Visit https://bjjgraph.org
2. Open browser DevTools (F12)
3. Go to the **Console** tab
4. Look for PostHog initialization messages
5. Check the **Network** tab for requests to `app.posthog.com`

Alternative verification:
1. Visit any page on bjjgraph.org
2. View page source (Ctrl+U or Cmd+U)
3. Search for `posthog.init`
4. Verify your API key is present in the code

## Step 4: Configure PostHog (Optional)

### In PostHog Dashboard

1. **Set up custom events** (optional):
   - Track specific user interactions
   - Create funnels for user journeys
   - Set up dashboards for key metrics

2. **Enable session recording** (optional):
   - See exactly how users interact with the site
   - Privacy: respects GDPR and privacy settings

3. **Create insights**:
   - Page views over time
   - Most popular positions/techniques
   - User navigation paths
   - Geographic distribution

## What PostHog Tracks Automatically

Once configured, PostHog automatically tracks:

- **Pageviews**: Every page visit on bjjgraph.org
- **Sessions**: User session duration and engagement
- **Referrers**: Where users come from (Google, social media, etc.)
- **Device info**: Browser, OS, screen size
- **Geographic data**: Country/region (respecting privacy)

### Single Page App (SPA) Navigation

BJJ Graph uses Quartz's SPA mode, which means page transitions happen without full reloads. PostHog is configured to track these navigation events properly.

## Troubleshooting

### PostHog Not Tracking

**Problem:** No events appearing in PostHog dashboard

**Solutions:**
1. Verify the API key is correct in GitHub Secrets
2. Check that the secret name is exactly `POSTHOG_API_KEY` (case-sensitive)
3. Rebuild and redeploy the site
4. Clear browser cache and visit the site
5. Check browser console for JavaScript errors

### Build Fails After Adding PostHog

**Problem:** GitHub Actions build fails

**Solutions:**
1. Verify the configuration in `source/quartz.config.ts`:
   ```typescript
   analytics: {
     provider: "posthog",
     apiKey: process.env.POSTHOG_API_KEY || "",
   }
   ```
2. Ensure the env variable is passed in `.github/workflows/ci.yaml`:
   ```yaml
   env:
     POSTHOG_API_KEY: ${{ secrets.POSTHOG_API_KEY }}
   ```
3. Check the Actions logs for specific error messages

### PostHog Script Not Loading

**Problem:** Script is in HTML but not executing

**Solutions:**
1. Check browser console for Content Security Policy (CSP) errors
2. Verify no browser extensions are blocking analytics
3. Try in incognito/private browsing mode
4. Check if ad blockers are interfering

## Self-Hosted PostHog Configuration

If you're using a self-hosted PostHog instance instead of PostHog Cloud:

### Update the Configuration

Edit `source/quartz.config.ts`:

```typescript
analytics: {
  provider: "posthog",
  apiKey: process.env.POSTHOG_API_KEY || "",
  host: "https://your-posthog-instance.com", // Add your host
}
```

Then rebuild and redeploy.

## Privacy Considerations

PostHog is privacy-friendly by default:

- **No cookies** required for basic analytics
- **GDPR compliant** with proper configuration
- **Open source** - full transparency
- **Self-hosting option** for complete data control
- **Respects Do Not Track** browser settings (configurable)

### Adding a Privacy Policy

Consider adding a privacy policy mentioning analytics:

1. Create `source/content/Privacy-Policy.md`
2. Document what data is collected
3. Link to PostHog's privacy documentation
4. Add link to privacy policy in footer

## Advanced Configuration

### Custom Events

To track custom events, you can add PostHog event tracking to your content:

```javascript
// Example: Track button clicks
if (window.posthog) {
  posthog.capture('button_clicked', {
    button_name: 'subscribe',
    page: window.location.pathname
  })
}
```

### Feature Flags

PostHog supports feature flags for A/B testing:

```javascript
if (window.posthog) {
  posthog.onFeatureFlags(() => {
    if (posthog.isFeatureEnabled('new-layout')) {
      // Show new layout
    }
  })
}
```

## Support

### PostHog Support
- Documentation: https://posthog.com/docs
- Community: https://posthog.com/slack
- GitHub: https://github.com/PostHog/posthog

### BJJ Graph Support
- GitHub Issues: https://github.com/diogoseca/bjjgraph/issues
- Check existing documentation in `/docs/`

## Additional Resources

- [PostHog Documentation](https://posthog.com/docs)
- [PostHog JavaScript SDK](https://posthog.com/docs/integrate/client/js)
- [Quartz Analytics Configuration](https://quartz.jzhao.xyz/configuration)
- [BJJ Graph Deployment Guide](./deployment-checklist.md)

---

**Last Updated:** 2025-10-19
**Status:** Active
**Maintained By:** BJJ Graph Team
