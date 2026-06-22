---
title: Privacy Policy
description: How BJJGraph collects, uses, stores, and protects your data.
---

<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Privacy Policy",
  "description": "How BJJGraph collects, uses, stores, and protects your data.",
  "url": "https://bjjgraph.org/privacy",
  "publisher": { "@type": "Organization", "name": "BJJ Graph", "url": "https://bjjgraph.org" }
}
</script>

**Effective date: 22 June 2026**

This Privacy Policy explains how **BJJGraph** ("BJJGraph", "we", "us") collects, uses, stores, and shares information when you use the website at [bjjgraph.org](https://bjjgraph.org) (the "Service"). BJJGraph is an educational Brazilian Jiu-Jitsu knowledge graph and training tool operated by Diogo Seca as an individual. The Service is currently in **beta** and under active development.

If you have any questions about this policy or your data, contact us at **[support@bjjgraph.org](mailto:support@bjjgraph.org)**.

## In short

- You can use almost all of BJJGraph **anonymously**. Your training progress is stored **on your own device** and never leaves it unless you choose to create an account.
- If you **sign in** (with Google or email), we store your account details and sync your training progress so it follows you across devices.
- We use **PostHog** for privacy-conscious analytics to understand how the Service is used and to improve it.
- We **do not sell** your personal data.

## Who we are

The Service is operated by **Diogo Seca**, an individual, at the domain **bjjgraph.org**. For any privacy request or question, the data controller can be reached at **[support@bjjgraph.org](mailto:support@bjjgraph.org)**.

## Data we collect

### 1. Account data (only if you sign in)

Signing in is optional. We offer sign-in with **Google (SSO)** and with **email and password**, handled through our authentication provider, [Supabase](https://supabase.com).

- **If you sign in with Google**, we receive from your Google account: your **email address**, your **name**, your **profile picture**, and your **Google account identifier**. We use these only to identify your account and display your name and avatar in the interface.
- **If you sign in with email and password**, Supabase stores your **email address** and a securely hashed password. We never see or store your password in plain text.
- In all cases, Supabase assigns your account a **unique user identifier (UUID)**, which we use as the key to store and sync your data.

### 2. Training and progress data (synced only when signed in)

When you are signed in, the following data is synced to our database (the Supabase `user_training_data` table) so it is available across your devices:

- **Flashcard / spaced-repetition state** (which techniques you are learning and when they are next due)
- **Settings and preferences**
- **Daily progress** (counts of techniques learned and reviewed per day)
- **Streak data** (current and longest streak, last active date)
- **Lifetime statistics** (totals such as rolls, victories, moves, and flashcard accuracy)
- **Move votes** (your up/down adjustments to technique success rates)
- **Explored pages** (which pages you have visited, with first-visit timestamps)

This data describes your learning activity only. It contains **no free-text or sensitive personal information**, and each record is restricted so that only your account can read or write it.

### 3. Local-only data (everyone, including anonymous users)

Whether or not you sign in, the Service stores data in your browser's **local storage** to make the training and game features work. These keys include, among others: `bjj-srs-cards`, `bjj-settings`, `bjj-daily-progress`, `bjj-streak`, `bjj-explored`, `bjj-banned-flashcards`, `bjj-journey`, `bjj-known`, `bjj-lifetime-stats`, and `bjj-move-votes`.

If you are **not** signed in, this data **stays on your device and is never transmitted to us**. If you sign in, a copy is synced as described above.

### 4. Analytics data

We use **PostHog** to understand how the Service is used. PostHog collects, on our behalf:

- **Page views and navigation** (which pages you visit, referrer)
- **Device and browser information**
- **Approximate location**, derived from your IP address (we do not store precise location)
- **Interaction events**, such as voting on a move, skipping a flashcard, or clicking an affiliate link

These events describe behaviour and content interaction; they do not include sensitive personal information.

## Cookies and local storage

- **Analytics cookies:** PostHog sets cookies to recognise returning visitors and measure usage.
- **Local storage:** Your authentication session (if signed in) and your training data are kept in your browser's local storage rather than in cookies.
- **Third-party cookies:** Google may set cookies on its own domains when you sign in with Google or when Google Fonts are loaded.

You can clear cookies and local storage at any time through your browser settings. Doing so will sign you out and remove locally stored training data (synced data remains in your account until deleted).

## How we use your data

We use the information above to:

- Provide the Service and its training/game features
- Sync your progress across devices when you are signed in
- Understand usage and improve the content and the Service
- Maintain the security and integrity of the Service

We **do not sell** your personal data, and we do not use it for third-party advertising.

## Legal bases (GDPR)

Where the EU General Data Protection Regulation applies, we rely on the following legal bases:

- **Performance of a service** — to operate your account and sync your training data when you sign in.
- **Consent** — for analytics; you may withhold or withdraw it (for example, by using browser controls or clearing analytics cookies).
- **Legitimate interests** — to keep the Service secure and to understand and improve how it is used, balanced against your rights.

## Third parties and sub-processors

We rely on the following service providers, which may process limited data on our behalf:

| Provider | Purpose | Data involved |
|----------|---------|---------------|
| **Supabase** | Authentication and database (account + training-data sync) | Account details, training/progress data |
| **Cloudflare Pages** | Website hosting and delivery | IP address and request metadata |
| **Google** | Sign-in (OAuth SSO) and web fonts | Email, name, profile picture, Google ID (sign-in); IP/user-agent (fonts) |
| **jsDelivr (CDN)** | Delivers the authentication SDK to your browser | IP address and user-agent |
| **PostHog** | Product analytics | Usage events, device/browser, approximate location |

Some outbound links on the Service (for example to **BJJFanatics**) are affiliate links; clicking them takes you to a third-party site governed by its own privacy policy.

## International transfers

PostHog processes analytics data in the **United States**, and other providers may process data outside your country of residence. Where required, such transfers rely on appropriate safeguards (such as standard contractual clauses) provided by those services.

## Data retention

- **Account and synced training data** are retained for as long as your account exists. When you delete your account, this data is deleted.
- **Analytics data** is retained according to PostHog's standard retention settings.
- **Local-only data** persists in your browser until you clear it.

## Your rights

Subject to applicable law (including the GDPR), you have the right to:

- **Access** the personal data we hold about you
- **Rectify** inaccurate data
- **Erase** your data ("right to be forgotten")
- **Port** your data to another service
- **Restrict** or **object** to certain processing
- **Withdraw consent** to analytics at any time
- **Lodge a complaint** with your local data-protection supervisory authority

To exercise any of these rights, email **[support@bjjgraph.org](mailto:support@bjjgraph.org)**.

## Account and data deletion

- **Signing out** clears your session from your device.
- To **delete your account and all associated synced data**, email **[support@bjjgraph.org](mailto:support@bjjgraph.org)** and we will action the request.
- **Clearing your browser's storage** removes locally stored data from that device.

## Children

The Service is not directed to children under 16, and we do not knowingly collect personal data from them. If you believe a child has provided us with personal data, please contact us so we can remove it.

## Changes to this policy

We may update this Privacy Policy from time to time. When we do, we will revise the **effective date** at the top of this page. Material changes will be reflected here; please check back periodically.

## Contact

Questions, requests, or concerns about this policy or your data:

**[support@bjjgraph.org](mailto:support@bjjgraph.org)**

See also our [Terms of Service](/terms).
