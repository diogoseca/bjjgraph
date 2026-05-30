# Synonym/Variant + Graph Restructure Epic — Progress Tracker

The autonomous coding agent reads this on each session start and writes to it after each commit. Phase numbers track the plan at `~/.claude/plans/isn-t-scarf-hold-the-lazy-flame.md`.

## Current phase

**Reevaluation** — phases 1–4 review + plan-mode exploration (next)

## Phase status

- [x] **Phase 1** — Schema & taxonomy foundation — `v1.26.0` commit `c7c3a5f8`
- [x] **Phase 2** — Validator alias awareness — `v1.26.1` commit `86d348ee`
- [x] **Phase 3** — Template rendering for aliases/disambiguation/family — `v1.27.0` commit `3f9bb87f`
- [x] **Phase 4** — Redirects + alias-aware graph build — `v1.27.1`
- [ ] **Phase 5** — Graph data model restructure (collapse role nodes)

## Open design questions surfaced during implementation (for reevaluation)

1. **Cloudflare 301 vs Quartz alias-HTML precedence.** Phase 3 frontmatter
   `aliases:` makes Quartz emit a meta-refresh HTML page at the alias path;
   Phase 4 emits a Cloudflare 301 for the same path. On Cloudflare Pages, an
   exact-match static asset can shadow a `_redirects` rule — so the weaker
   meta-refresh could win over the stronger 301. Moot today (no aliases), but
   must be resolved before phase 12 populates aliases. Options: (a) drop
   frontmatter aliases, rely on 301 only; (b) keep both, accept meta-refresh;
   (c) verify actual Cloudflare precedence empirically.
2. **Graph slugify vs URL slugify divergence.** Graph node keys use an
   accent-preserving slugify (`mata-leão`); URL/alias slugs now transliterate
   (`mata-leao`). Internally consistent within each domain, but a future
   feature that maps graph nodes → URLs by slug would need a bridge.
- [ ] **Phase 4** — Redirects + alias-aware basic graph build
- [ ] **Phase 5** — Graph data model restructure (collapse role nodes)
- [ ] **Phase 6** — Positional strength scoring
- [ ] **Phase 7** — Per-role color mapping (red↔white↔blue)
- [ ] **Phase 8** — Node-type shape/outline differentiation
- [ ] **Phase 9** — Search & graph UI alias awareness
- [ ] **Phase 10** — Family-hub infrastructure
- [ ] **Phase 11** — Execute synonym merges (Toreando/Bullfighter, D'Arce/Brabo, Hip Bump V2)
- [ ] **Phase 12** — Bulk alias population (Japanese/Portuguese/English variant names)
- [ ] **Phase 13** — Bulk disambiguation population
- [ ] **Phase 14** — Family-hub population
- [ ] **Phase 15** — Content bot synonym-discovery prompt
- [ ] **Phase 16** — CLAUDE.md amendment & docs polish

## Hard-stop counters

- Cloudflare `_redirects` rule count: ~150 / 2000
- Escalations logged this session: 0
- Build failures encountered: 0
