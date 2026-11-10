-- BJJGraph Supabase schema: public.user_training_data
-- =====================================================================================
-- This file DOCUMENTS production: checked read-only on 2026-11-10 (Postgres 17), as it
-- stands once supabase/hygiene_v1.253.1.sql is applied. The names below are production's.
--
-- It runs as written only on a FRESH project (CREATE POLICY would collide on a live one).
-- A live project is changed by the diff files, in this order:
--   hardening_v1.43.0.sql · neural_v1.sql · digest_v2.sql · hygiene_v1.253.1.sql
--
-- NOT IN PRODUCTION: digest_v1.sql. Neither `digest_sent` nor `digest_suppress` exists
-- there (2026-11-10). So the training-day digest Worker fails closed (its per-user read of
-- digest_suppress throws, and that player is a `failures` entry, never a send), and
-- functions/unsubscribe.js cannot record a stop. Applying it is the owner's call.
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.user_training_data (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  -- The six LEGACY columns. The legacy sync wrote them until v1.80.0 (2026-08-09), and
  -- nothing has read them since: they were kept, not dropped (see supabase.ts, "Cloud sync").
  srs_cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  daily_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  streak JSONB NOT NULL DEFAULT '{}'::jsonb,
  lifetime_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  move_votes JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subscription_tier TEXT DEFAULT 'free',
  -- The Neural app's whole progress blob (neural_v1.sql): the only column the app reads
  -- (pullNeural) or writes (pushNeural), rewritten whole on every save.
  neural JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT user_training_data_pkey PRIMARY KEY (id),
  -- UNIQUE so the client's `upsert(..., { onConflict: 'user_id' })` resolves
  -- deterministically (and a user can't accumulate multiple rows).
  CONSTRAINT user_training_data_user_id_key UNIQUE (user_id),
  -- ON DELETE CASCADE (digest_v2.sql): deleting an auth user takes the row with it.
  CONSTRAINT user_training_data_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Constrain to known tiers so a forged value can't slip through even server-side.
  CONSTRAINT user_training_data_subscription_tier_check
    CHECK (subscription_tier IN ('free', 'premium'))
);

-- ── Row-Level Security ───────────────────────────────────────────────────────────────
-- Critical: without these policies, any authenticated user can access any row.
-- All four are TO public. `(select auth.uid())` is evaluated once per statement (an
-- InitPlan), not once per row (advisor lint 0003, auth_rls_initplan).
ALTER TABLE public.user_training_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own data" ON public.user_training_data
  FOR SELECT TO public USING ((select auth.uid()) = user_id);

CREATE POLICY "Users insert own data" ON public.user_training_data
  FOR INSERT TO public WITH CHECK ((select auth.uid()) = user_id);

-- WITH CHECK is REQUIRED: USING alone only filters which existing rows may be
-- targeted; without WITH CHECK a user could rewrite user_id to another user's id
-- and hijack/clobber their row. Pin the post-update row to the caller too.
CREATE POLICY "Users update own data" ON public.user_training_data
  FOR UPDATE TO public USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- The one underscore name in production.
CREATE POLICY users_delete_own_data ON public.user_training_data
  FOR DELETE TO public USING ((select auth.uid()) = user_id);

-- ── Grants ───────────────────────────────────────────────────────────────────────────
-- None are written here: Supabase's default privileges in `public` give anon,
-- authenticated and service_role arwdDxtm on every new table and EXECUTE on every new
-- function. The policies above are what restrict rows. hygiene_v1.253.1.sql PROPOSES,
-- commented out, revoking TRUNCATE, REFERENCES, TRIGGER and MAINTAIN on this table from
-- anon and authenticated; no API caller uses them.

-- ── updated_at ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_training_data_updated_at ON public.user_training_data;
CREATE TRIGGER update_user_training_data_updated_at
  BEFORE UPDATE ON public.user_training_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── subscription_tier integrity ──────────────────────────────────────────────────────
-- RLS is row-level, not column-level, so the policies above still let a user set
-- their own subscription_tier='premium' via a direct PATCH with the public anon key
-- (privilege escalation the moment any paid feature reads the column). This trigger
-- makes the column writable ONLY by the service_role (server-side / Edge Function):
-- regular authenticated users get 'free' on insert and the existing value preserved
-- on update. Pair with: grant tier changes only through trusted server code.
-- (Nothing in the repo reads subscription_tier today.)
CREATE OR REPLACE FUNCTION public.enforce_subscription_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.subscription_tier := 'free';
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.subscription_tier := OLD.subscription_tier;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_enforce_subscription_tier ON public.user_training_data;
CREATE TRIGGER trg_enforce_subscription_tier
  BEFORE INSERT OR UPDATE ON public.user_training_data
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_tier();

-- ── RLS on every new public table: rls_auto_enable() + the `ensure_rls` event trigger ──
-- In production, owned by postgres, created by no file in this repo. On CREATE TABLE,
-- CREATE TABLE AS or SELECT INTO in schema `public` it enables row level security, so a
-- table made in the dashboard is never readable by anon before its policies exist.
-- Body copied from production's pg_get_functiondef (2026-11-10).
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();

-- ── The two SECURITY DEFINER functions: no EXECUTE for the API roles ──────────────────
-- A trigger fires without its caller holding EXECUTE; hygiene_v1.253.1.sql proves it in
-- its own transaction. postgres (owner) and service_role keep EXECUTE.
REVOKE EXECUTE ON FUNCTION public.enforce_subscription_tier() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
