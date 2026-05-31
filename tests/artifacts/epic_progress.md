# Synonym/Variant + Graph Restructure Epic — Progress Tracker

The autonomous coding agent reads this on each session start and writes to it after each commit. Phase numbers track the plan at `~/.claude/plans/isn-t-scarf-hold-the-lazy-flame.md`.

## Current phase

**§0.3 next** — hub WebPage+BreadcrumbList JSON-LD (unsuffixed alternateName) + `sameAs` field

## Phase status

- [x] **Phase 1** — Schema & taxonomy foundation — `v1.26.0` commit `c7c3a5f8`
- [x] **Phase 2** — Validator alias awareness — `v1.26.1` commit `86d348ee`
- [x] **Phase 3** — Template rendering for aliases/disambiguation/family — `v1.27.0` commit `3f9bb87f`
- [x] **Phase 4** — Redirects + alias-aware graph build — `v1.27.1` commit `822f4ae2`
- [x] **§0 reevaluation** — 39-agent roundtable (33 findings, all verified); 8 decisions + 6 hotfixes
- [x] **§0.1 hotfix sprint + model upgrade** — `v1.28.0`
  - H1 JSON-LD `| tojson`; H2 visible-aside `| e`; H3 unified `scripts/_slug.py` (+ accent-folding validator); H4 nested-variant 301 subdir; H5 single-source/alias-first/hard-exit redirects; H6 existence-gated family/disambiguation wikilinks; §0.2 frontmatter `aliases:` dropped (_redirects is sole owner)
  - Claude model upgraded 4.6 → **`claude-opus-4-8[1m]`** + `--effort xhigh` across regenerate_content_json.py, proofread_all_transitions.py, and both content-bot workflows (merged into existing `claude_args`)
- [ ] **§0.3** — hub JSON-LD (unsuffixed alternateName) + `sameAs` schema field
- [ ] **§0.5** — 7-canonical alias minisprint (after §0.6 GSC baseline)
- [ ] **Phase 5** — Graph data model restructure (collapse role nodes)

## Automation strategy (plan §A/§B) — recurring Claude jobs

Quota resets Monday → all token-spending scheduled jobs run on the **weekend** (leftover quota), lightest→heaviest. Uncommitted, ready for review/commit:
- [x] **§A.1 graph-integrity CI gate** — `.github/workflows/ci-validate.yml` + `tests/artifacts/graph_validation_baseline.json` (ratchet @ max_errors 76). No Claude.
- [x] **Cron moves** — content-bot Mon→**Sat 18:00** (`0 18 * * 6`); analytics-bot Wed→**Sun 06:00** (`0 6 * * 0`).
- [x] **§A.2 proofread bot** — `.github/workflows/proofread-bot.yml` (**Sun 18:00**, raw `claude` CLI via `curl …install.sh`, `CLAUDE_CODE_OAUTH_TOKEN` auth, `--permission-mode dontAsk`); category rotation `tests/artifacts/proofread_state.json`; continue-on-error so quota-exhaustion is a clean no-op that doesn't advance the pointer; PR on success only.
- [x] **§A.3 validation-fixer** (`validation-fixer.yml`, Sat 12:00) — deterministic fix_from_position + capped Claude pass on missing_outcomes.
- [x] **§A.4 SEO monitor** (`seo-monitor.yml`, Sat 06:00) — DataForSEO SERP + PostHog HogQL → report on `seo-reports` side branch (no deploy trigger) + artifact.
- [x] **§A.6 votes refresh** (`votes-refresh.yml`, Sat 02:00) — no Claude, votes-only change detection, PR.
- [x] **Adversarial review** (47-agent workflow, 39/40 verified) → applied 2 blockers + 5 highs + cheap nits; also fixed a latent positional-arg bug in the existing content bot.
- [x] **§A.5 bot improvements** — `bot_metadata` added to all 8 schemas (fixes a latent bug: the bots already wrote it but `additionalProperties:false` rejected it); `select_oldest_files.sh` skips files improved within `SKIP_RECENT_DAYS` (default 14) so Sat content-bot + Sun analytics-bot don't double-touch; both bot prompts now write `bot_metadata` to the JSON source explicitly. — `v1.31.0`
- [x] **§B corpus alias/sameAs audit** — report `tests/artifacts/alias_audit_master.md` (+7 chunks) — `v1.32.1`.
- [x] **§0.3 hub JSON-LD + sameAs** — `v1.32.0`.
- [~] **§0.6 measurement baseline** — captured by the `seo-monitor` workflow's first run once merged to main (needs DataForSEO creds, already wired). No local code task.
- [x] **§0.5 7-canonical alias minisprint + Toreando/Bullfighter merge** — `v1.33.0`. Aliases on RNC, Side Control, Toreando, Triangle, Armbar, Kimura, Mount; Bullfighter Pass merged into Toreando (alias + De La Riva edge folded + file deleted). Made `build_wikilink_resolver` alias-aware so references to merged names link to the canonical page. Graph back to 76-error baseline.
- [x] **§B-apply aliases** — 40 canonical techniques aliased (`v1.34.0`); collision guard dropped 4 (Honey Hole/Saddle/Whizzer/Straight Footlock = existing files → merge decisions).
- [ ] **§B-apply tail (remaining)**:
  - [ ] 11 disambiguation gaps (reciprocal `disambiguations[]` on denylisted pairs + Blood/Air chokes) — low-risk, well-defined.
  - [ ] sameAs population (~22 verified Wikidata Q-ids + Wikipedia) — needs WebFetch URL verification before writing.
  - [ ] Clean merges: Knee Cut/Knee Slice (both self-declare), Hip Bump Sweep V2 delete.
  - [ ] Escalate merges (need canonical decision / GSC): Darce/Brabo, Bridge-and-Roll/Upa, Flower/Pendulum.
- [~] **Epic B (phases 5-8)** — graph restructure (collapse role nodes, per-role strength [-1,1], red↔white↔blue ramp, node-type shapes). High blast radius; own focused effort.
  - [x] **Phase 6 scoring module** — `scripts/score_graph_nodes.py` (`v1.34.4`). Standalone, shape-agnostic (reads source JSON), validated against real data. **NOT yet wired into `regenerate_graph.py`** — that wiring is atomic with Phase 5's hub-shape and is BLOCKED on a clean graph-frontend base (see below). Findings:
    - The plan §6.6.1 sanity-table magnitudes were eyeballed and are unreachable (max point_value term is ±0.40 → Mount/top computes to **+0.63**, not +1.00). Self-check rewritten to assert **ordering invariants** (the real coloring contract), all of which PASS.
    - Closed Guard paradox holds **relatively** (bottom −0.03 > top −0.24), not absolutely (+0.27).
    - `submission_probability` is a "risk of being submitted" metric on 2 defensive bottoms (Mount/bottom, Back Control/bottom) — scored as a finish rate. Ordering survives; logged as a data fix, not blocking.
  - [x] **Phase 6 data plumbing** — `scripts/enrich_graph_strength.py` (`v1.34.5`). User chose "build ON TOP of my uncommitted graph work", so Epic B is being done **additively** (NOT the disruptive role-node collapse, which would reshape the data the user's in-flight `contentPanel.inline.ts` rewrite consumes). Injects `strength` into BOTH `graph.json` (positions roles+hub, transitions, submissions) AND `globalGraphLayout.json` (compact `s:[v0,v1]` per node, **positions preserved** — no node2vec rerun). 1781/1787 layout nodes scored (99.7%); the 6 misses are 3 stale merge nodes + 3 punctuation-slug edge cases (fallback colour). Variations inherit parent strength. Wired into `npm run regenerate` as `regenerate:graph-strength` after the layout step. Idempotent.
  - [ ] **Phase 7 coloring (NEXT)** — `getStrengthColor` + ramp vars in `variables.scss`/`quartz.config.ts`; read `data-current-role` (add to `<body>` in `renderPage.tsx`); recolor on nav. Background graph first (the hero), then local `graph.inline.ts`. KEEP the existing `graph*` colour vars (local graph still uses them) — add ramp vars alongside, don't delete.
  - [ ] **Phase 8 shapes** — `drawNode` per type (submission=circle+white outline, transition=rounded-rect, terminal=diamond) in both renderers + legend.
  - **Decision: role-node collapse (plan Phase 5) DEFERRED** — it would reshape `graph.json`'s consumed shape under the user's active `contentPanel.inline.ts`/`getPageGraphData` rewrite. The additive path delivers the user-visible goals (per-role colour + shapes) without that risk; the data-cleanup collapse can land later once the frontend work settles.

### Open items needing a GitHub secret (flagged to user)
- **`POSTHOG_PERSONAL_API_KEY`** (phx_ personal key): votes-refresh + seo-monitor reference it; empty = graceful skip. The project key (phc_) `POSTHOG_API_KEY` 401s on the read APIs. (Also affects the existing analytics bot's HogQL reads.)
- **`BOT_PR_TOKEN`** (repo PAT): bot PRs opened with the default `github.token` do NOT trigger `ci-validate` (GitHub suppresses workflow-triggered events). Bot PRs are validated INLINE; a PAT would also let `ci-validate` run on them. Until then, rely on inline validation + human review on bot PRs; `ci-validate` covers human PRs.
- Nits left: `setup-python@v4`→`v5` (deprecation warning), `grep "Valid"` gates in the two existing bots (work by luck), `timeout-minutes` hygiene.

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
