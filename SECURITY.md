# Security

## Reporting a vulnerability

Use GitHub's private reporting: **[Report a vulnerability](https://github.com/diogoseca/bjjgraph/security/advisories/new)** on the repository's Security tab. The report stays private until a fix is published.

If that route is unavailable to you, reach [Diogo Seca on LinkedIn](https://www.linkedin.com/in/diogoseca/) and ask for a private channel. Do not put vulnerability details in a public issue, a pull request or a discussion.

This is a single-maintainer project, so there is no response-time commitment. Reports are read and acted on as soon as they can be.

## In scope

- **The published site**, https://bjjgraph.org, and the static pages and canvas app it serves.
- **The Cloudflare Pages Functions** in [`functions/`](functions/), including the `/l/<code>` share-link preview.
- **The Supabase surface**: authentication, the account-sync endpoints and the row-level security policies in [`supabase/`](supabase/).

Credentials committed by accident belong here too. Report them privately rather than opening an issue that points at them.

## Not in scope

**The accuracy of the jiu-jitsu content.** A wrong probability, a misfiled outcome or an unsafe technical description is a correction, not a vulnerability — open a [graph correction](https://github.com/diogoseca/bjjgraph/issues/new?template=correction.yml) and it gets handled in the open, where other practitioners can weigh in.

Also out of scope: findings against the local development setup rather than the deployed service, reports produced by a scanner with no demonstrated impact, and the absence of a hardening measure that changes nothing an attacker could reach.

## Supported versions

Only what is currently deployed at https://bjjgraph.org is supported. Published releases are data snapshots; earlier ones are not patched.
