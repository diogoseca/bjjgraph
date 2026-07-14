-- BJJGraph — neural_v1: per-user Neural app progress blob on public.user_training_data
-- =====================================================================================
-- Apply manually in the Supabase SQL Editor (or via the Management API with a
-- browser User-Agent) — the same flow as hardening_v1.43.0.sql. Schema changes
-- are NEVER applied automatically from the repo.
--
-- Safe to run more than once (idempotent: ADD COLUMN IF NOT EXISTS).
--
-- The Neural front-end reads/writes this column through pullNeural()/pushNeural()
-- in source/quartz/components/scripts/supabase.ts (exposed to the Neural bundle
-- via the window.__bjjAuth façade). Both the legacy training sync and the neural
-- sync upsert on user_id with column-scoped payloads, so they share the user's
-- single row without touching each other's columns.
-- =====================================================================================

ALTER TABLE public.user_training_data
  ADD COLUMN IF NOT EXISTS neural JSONB DEFAULT '{}'::jsonb;

-- RLS: no policy changes needed. The existing policies on user_training_data
-- (documented in schema.sql: users_read_own_data / users_insert_own_data /
-- users_update_own_data / users_delete_own_data — production names may differ
-- cosmetically, semantics match) are ROW-level: SELECT/DELETE filter with
-- USING (auth.uid() = user_id) and INSERT/UPDATE additionally pin the written
-- row with WITH CHECK (auth.uid() = user_id). Row policies cover every column
-- in the row, including new ones, so the neural blob is automatically readable
-- and writable only by its owner. Column-level protection (cf. the
-- subscription_tier trigger) is only needed for privileged fields; the neural
-- blob is ordinary user-owned data.
