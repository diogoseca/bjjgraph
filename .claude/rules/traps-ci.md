---
paths:
  - ".github/**"
  - "scripts/**"
  - "neural/**"
  - "e2e/**"
  - "tests/**"
  - "source/quartz/**"
  - "functions/**"
---

## 6. THOUGHT TRAPS — CI, emitters and deletions: 6.7

Split out of `CLAUDE.md` at v1.224.3: it loads with the `paths:` above, and CLAUDE.md §6's index
names it. CLAUDE.md §0 and §9 decide what belongs here; `npm run validate:claudemd` gates its size
and references.

### 6.7 Before you edit CI, a build emitter, or delete a component

Its rename-survey trap (never pipe the survey through `head`) stays in `CLAUDE.md` §6.7, because a
rename can start anywhere.

- **CI must not silently run a subset of the chain a human runs, and no emitted path may be allow-listed.** `votes-refresh.yml` once ran bare `regenerate_graph.py` and committed a graph.json with `strength` **stripped from 4,464 of 4,465 nodes**. `e2e-full.yml` tarred six allow-listed paths, so the PR gate for BOTH protected branches could not pass — an allow-list rots silently and that one predated every spec that broke on it; package by default and `--exclude` explicitly. A `paths:` filter must include the INPUTS its own gates read.
  **Corrected rule, because the absolute version is contradicted by a deliberate fix:** `votes-refresh.yml` today runs `regenerate:graph-base` + `regenerate:graph-strength` and NOT the umbrella — the layout/ordinal steps need an ML stack that job does not install (the umbrella failed there every week) and would rewrite files the PR step never stages. So: **a partial chain must be justified AT THE CALL SITE and must include every step that mutates the artifact it commits.** Do not "fix" that workflow back to the umbrella.
  **Standing hazard: deploy does NOT run root `npm run build`** — both workflows re-list the steps inline, so any new build step is absent in production unless added there too, and no gate compares the two lists.
  <br>_(7, all found in one pass; 1 since deliberately reverted · _re-verify before quoting_)_

- **A tolerance baseline must be at least as strict as the gate downstream of it, and must ENUMERATE what it tolerates by name.** The PR ratchet allowed 76 graph errors while both deploys hard-fail on the first (now 0, with the reasoning in the baseline's own `note`). `e2e:gen`'s was prose only and drifted 13 → 40 reds unseen; its ledger is now read by the runner. **An aggregate count is unfalsifiable and rots into permanent noise: put the baseline where the RUNNER reads it, not where the reader does.**
  <br>_(3)_

- **Deleting a component deletes its telemetry and its capability, and no gate reports it.** Removing `AffiliateTracking` removed the only emitter of three PostHog events — the links still worked, the MEASUREMENT stopped. Removing `SystemProgress` removed a whole UX from 48 pages and the only emitter of three more events, with no Neural equivalent: a capability LOST, not moved, and any per-system completion figure goes flat from the deploy date — do not read that as a usage collapse. Its dead markup still ships, because the shell is emitted by `templates/Systems.md.jinja2`, not by the component. **Do:** treat an emitter deletion as a data-loss event — in the same commit, enumerate every event, capability and dashboard it was the ONLY source of, and check for dead markup emitted by a template rather than by the component. Retiring a mapped `fx()` beat means deleting its sound cue, and breaking every spec that asserts it.
  <br>_(5)_

- **A new file under `neural/src/` is INVISIBLE to git unless its name matches the allow-list.** `.gitignore`'s `neural/src/*` rule re-admits only `*.src.js`, `*.src.jsx`, `*.css`, `xdc-template.html`, `helmet.html`, `props.json`, `technique-content.js` — deliberately, because that directory also holds untracked design dumps. Add a new `.js` file there and CI checks out without it, so `node neural/build/build.mjs` either throws or quietly ships a bundle missing the feature: **green locally, broken in production.** Any new build input carries the `.src.` infix or is `.css`; verify with `git check-ignore -v neural/src/<file>`.
  <br>_(1 documented in .gitignore, 0 caught by any gate)_

- **Scope every selector to a marker you OWN and assert it appears exactly once.** A query that resolves to the wrong object returns plausible data, not an error: `body[data-share-cue]` collided with the cue BUTTON's own attribute, so `querySelector` returned `<body>` and every "where is the cue" measurement silently became the whole 390x844 viewport (three journeys red); `HTMLRewriter.on("title", …)` matches by element NAME and the shell carries a second `<title>` inside an inline SVG (fixed with `title[data-share-title]`, written and asserted once by `build_share_shell.mjs`). Never query by a shape another object can have — element name, a bare attribute, or a computed dimension (a CSS-border triangle computes to `width: 8px`, not 0). Bundle corollary: `lists.src.js` and `lists-codec.src.js` share ONE scope in the IIFE, so no top-level name may collide, and `build.mjs`'s duplicate-name scan must cover `function|const|let|var|class` — it used to scan only `function|const`, so a colliding `let` walked past the guard into the SyntaxError it exists to prevent.
  <br>_(6)_
