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

- You can use almost all of BJJGraph **anonymously**. Your training progress is stored **on your own device**, in your browser, and is sent to us only when someone signs in on that browser.
- If you **sign in** (with Google or email), we store your account details and sync your training progress so it follows you across devices.
- We use **PostHog** for privacy-conscious analytics to understand how the Service is used and to improve it.
- We **do not sell** your personal data.

## Who we are

The Service is operated by **Diogo Seca**, an individual, at the domain **bjjgraph.org**. For any privacy request or question, the data controller can be reached at **[support@bjjgraph.org](mailto:support@bjjgraph.org)**.

## Data we collect

### 1. Account data (only if you sign in)

Signing in is optional. We offer sign-in with **Google (SSO)** and with **email and password**, handled through our authentication provider, [Supabase](https://supabase.com).

- **If you sign in with Google**, we receive from your Google account: your **email address**, your **name**, your **profile picture**, and your **Google account identifier**. We use these only to identify your account and display your name in the interface; your profile picture is received and stored with your account, but it is not shown.
- **If you sign in with email and password**, Supabase stores your **email address** and a securely hashed password, and sends the email that confirms your address when you create an account. We never see or store your password in plain text.
- In all cases, Supabase assigns your account a **unique user identifier (UUID)**, which we use as the key to store and sync your data.

### 2. Training and progress data (synced only when signed in)

When you are signed in, the following data is synced to our database (the Supabase `user_training_data` table) so it is available across your devices:

- **Flashcard / spaced-repetition state** (which techniques you are learning and when they are next due)
- **Settings and preferences** (including a code generated in your browser, under which your roll history is recorded)
- **Daily progress** (how many flashcards you answered correctly and how many rolls you played each day, for your last 30 days of activity)
- **Roll history** (for each position, the moves you have tried there in the last 180 days and how often they worked)
- **Explored positions** (which positions you have landed on in a roll)
- **Game progress** (belts, badges, coins, challenges and tutorial steps)
- **Your technique lists** (the techniques in each list, and the name you give it)
- **Training-day email log**, recorded only while that setting is on (for each of your last 30 days of activity: the techniques you studied, your score, your belt and your weakest spots)

This data describes your learning activity only. Apart from the names you give your lists, it contains **no free-text or sensitive personal information**, and each record is restricted so that no other user can read or write it.

If you signed in before late August 2026, your account may also still hold a copy of your flashcard state, settings and daily progress saved by an earlier version of the app, which the app no longer reads or updates.

### 3. Local-only data (everyone, including anonymous users)

Whether or not you sign in, the Service stores data in your browser's **local storage** to make the training and game features work. These keys include, among others: `bjj-neural-owner:guest:progress` (your progress when you are not signed in), a `bjj-neural-owner:account:<your account ID>:progress` key for each account that has signed in on that browser (that account's progress, kept after you sign out), `bjj_view_mode`, and `bjj_gi_mode`.

If you are **not** signed in, this data **stays on your device and is not transmitted to us** until someone signs in on that browser. When someone signs in, the progress made in that browser while signed out (but not its settings) is added to their account, and their progress is then synced as described above. The signed-out copy stays in the browser, so it is also added to any other account that signs in there later.

### 4. Analytics data

We use **PostHog** to understand how the Service is used. PostHog collects, on our behalf:

- **Page views and navigation** (which pages you visit, referrer)
- **Device and browser information**
- **Your IP address** and the **approximate location** derived from it (we do not store precise location)
- **Interaction events**, such as picking a move, answering a flashcard, or clicking an affiliate link, and the text of any feedback you send
- **Clicks on the page**, recorded automatically, with the text of what was clicked

These events describe behaviour and content interaction; apart from anything you type into a feedback message, they do not include sensitive personal information.

We also use **Cloudflare Web Analytics** to count visits.

## Cookies and local storage

- **Analytics cookies:** PostHog sets cookies to recognise returning visitors and measure usage.
- **Local storage:** Your authentication session (if signed in) and your training data are kept in your browser's local storage rather than in cookies.
- **Third-party cookies:** Google may set cookies on its own domains when you sign in with Google, when Google Fonts are loaded, or when a YouTube video loads.

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
| **Cloudflare** | Website hosting and delivery (Cloudflare Pages), and visit counts (Cloudflare Web Analytics) | IP address and request metadata |
| **Google** | Sign-in (OAuth SSO) and web fonts | Email, name, profile picture, Google ID (sign-in); IP/user-agent (fonts) |
| **YouTube (Google)** | Technique videos and their preview images | IP address and user-agent; YouTube may set cookies when a video loads |
| **jsDelivr (CDN)** | Delivers the authentication SDK to your browser | IP address and user-agent |
| **Bunny.net** | Course preview videos on System pages | IP address and user-agent |
| **GitHub** | The star count shown in the account menu | IP address and user-agent |
| **PostHog** | Product analytics | Usage events, device/browser, IP address and approximate location |

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
