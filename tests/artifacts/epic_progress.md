# Synonym/Variant + Graph Restructure Epic — Progress Tracker

The autonomous coding agent reads this on each session start and writes to it after each commit. Phase numbers track the plan at `~/.claude/plans/isn-t-scarf-hold-the-lazy-flame.md`.

## Current phase

**Phase 1** — Schema & taxonomy foundation (in progress)

## Phase status

- [x] **Phase 1** — Schema & taxonomy foundation
  - [x] Add `aliases`/`family`/`disambiguations` to 8 schemas (Positions DUAL/SINGLE/FAMILY, Transitions DUAL, Submissions DUAL/FAMILY, Principles, Systems)
  - [x] Write `docs/Synonyms.md`
  - [x] Write `tests/artifacts/do_not_merge.json`
  - [x] Write this file + `escalations.md`
  - [ ] `npm run regenerate:build` green
  - [ ] `cd source && npm run check` green
  - [ ] Version bump (MAJOR) + commit
- [ ] **Phase 2** — Validator alias awareness
- [ ] **Phase 3** — Template rendering for aliases/disambiguation/family
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
