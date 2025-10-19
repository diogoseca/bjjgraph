# PostHog Analytics - Quick Setup

**Status:** ✅ Configuration Complete - Just Add Your API Key!

## What's Been Done

PostHog analytics is now fully integrated into BJJ Graph. The site is ready to track analytics as soon as you add your API key.

## Quick Setup (2 minutes)

### Step 1: Get Your PostHog API Key and Host

1. Go to https://app.posthog.com (or your PostHog instance)
2. Sign in to your account
3. Select/create your BJJ Graph project
4. Go to **Project Settings**
5. Copy your **Project API Key** (starts with `phc_`)
6. Note your **Host URL** (e.g., `https://us.i.posthog.com` or `https://eu.i.posthog.com`)

### Step 2: Add API Key and Host to GitHub

1. Go to: https://github.com/diogoseca/bjjgraph/settings/secrets/actions

**Add API Key:**
2. Click **"New repository secret"**
3. Name: `POSTHOG_API_KEY`
4. Value: Paste your API key
5. Click **"Add secret"**

**Add API Host (Recommended):**
6. Click **"New repository secret"** again
7. Name: `POSTHOG_API_HOST`
8. Value: Paste your host URL (e.g., `https://us.i.posthog.com`)
9. Click **"Add secret"**

### Step 3: Deploy

The next push to `main` will automatically include PostHog, OR:

1. Go to **Actions** tab in GitHub
2. Select **"Build and Test"** workflow
3. Click **"Run workflow"**
4. Wait for deployment to complete

### Step 4: Verify

1. Visit https://bjjgraph.org
2. Open browser DevTools (F12)
3. Check Console for PostHog messages
4. View PostHog dashboard for incoming events

## That's It!

PostHog will now automatically track:
- Page views
- User sessions
- Navigation paths
- Geographic data
- Device information
- And much more!

## Files Changed

- ✅ `source/quartz.config.ts` - Analytics provider set to PostHog
- ✅ `.github/workflows/ci.yaml` - Environment variable configured
- ✅ `README.md` - Documentation updated
- ✅ `docs/deployment/posthog-setup.md` - Comprehensive setup guide

## Need Help?

- **Detailed Guide:** See `docs/deployment/posthog-setup.md`
- **PostHog Docs:** https://posthog.com/docs
- **Issues:** https://github.com/diogoseca/bjjgraph/issues

---

**Note:** The site will build and work fine without the API key, but analytics won't be collected until you add it.
