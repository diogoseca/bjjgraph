-- BJJGraph — v1.253.1 advisor hygiene for public.user_training_data
-- =====================================================================================
-- Apply in the Supabase SQL Editor (production), as the editor's default role `postgres`,
-- which owns the table and all three functions. Like hardening_v1.43.0.sql this is a
-- DIFF against the live project, written against PRODUCTION's real names (three of the
-- four policies are spaced, "Users … own data"; schema.sql now documents them so).
--
-- ONE TRANSACTION, IDEMPOTENT, NO ROW TOUCHED. Every statement either sets a value that a
-- second run sets again or revokes what is already revoked. Its transaction ends in two
-- checks that RAISE, and a RAISE rolls the whole file back, so production is left either fully
-- hygienic or exactly as it was:
--   * the ASSERTION counts what took: 4 policies with no bare auth.uid(), the search_path
--     set, EXECUTE gone from PUBLIC/anon/authenticated and kept by postgres/service_role.
--     (A REVOKE by a role that may not revoke only WARNS; that is why this is counted.)
--   * the PROBE fires both functions as `anon` AFTER the revoke (see below).
--
-- What it changes, and what it is worth at today's size:
--   1. The four RLS policies read (select auth.uid()) instead of auth.uid(), by ALTER
--      POLICY: no policy is ever absent, and each keeps its roles and its command. The
--      planner then evaluates auth.uid() once per statement (an InitPlan), not once per
--      row. Every app statement reaches ONE row through user_training_data_user_id_key,
--      so the saving is microseconds. It clears the 4 auth_rls_initplan warnings (lint 0003).
--   2. public.update_updated_at() gets search_path = '' (lint function_search_path_mutable).
--      Its body calls now(), which resolves through pg_catalog, always searched first.
--   3. EXECUTE on the two SECURITY DEFINER functions is revoked from PUBLIC, anon and
--      authenticated (lints anon_/authenticated_security_definer_function_executable).
--      Neither was callable in practice: Postgres refuses a direct call of a function
--      returning `trigger` or `event_trigger`, through /rest/v1/rpc or otherwise. This
--      clears 4 warnings; it closes no path anyone could use.
--
-- WHY THE REVOKE CANNOT STOP THE TRIGGERS. The PostgreSQL 17 documentation states the
-- privilege at CREATION only. CREATE TRIGGER, Notes
-- (https://www.postgresql.org/docs/17/sql-createtrigger.html): "To create or replace a
-- trigger on a table, the user must have the TRIGGER privilege on the table. The user
-- must also have EXECUTE privilege on the trigger function." CREATE EVENT TRIGGER
-- (https://www.postgresql.org/docs/17/sql-createeventtrigger.html): "Only superusers can
-- create event triggers." Neither those pages nor ddl-priv.html says whether EXECUTE is
-- checked again when a trigger FIRES; the documentation is silent on it. So this file does
-- not rest on that reading: its PROBE makes `anon`, holding no EXECUTE on either function,
-- fire both of them inside this transaction, in a throwaway schema it rolls back:
--   * an INSERT through a BEFORE trigger on public.enforce_subscription_tier(), which must
--     come out with subscription_tier = 'free';
--   * a CREATE TABLE, which fires the `ensure_rls` event trigger, i.e. public.rls_auto_enable().
-- If firing needed EXECUTE, the probe raises "permission denied" and nothing is applied.
-- Rehearsed on PostgreSQL 17.11 against a mock of production (a non-superuser `postgres`
-- owning everything, the production policies, functions, grants and event trigger).
--
-- CREATE OR REPLACE keeps a function's ACL, so re-running hardening_v1.43.0.sql does not
-- undo item 3. A DROP FUNCTION + CREATE would: Supabase's default privileges grant EXECUTE
-- on every new function in `public` to anon and authenticated again.
--
-- Applying any DDL makes PostgREST reload its schema cache once (the `pgrst_ddl_watch`
-- event trigger). That reload is the dashboard's `SELECT name FROM pg_timezone_names`
-- entry (~0.9 s each), so expect one more of those. It is not a player's request.
--
-- Not in this file: `auth_leaked_password_protection` is a dashboard Auth setting, not
-- SQL. The table-grant revoke is PROPOSED below, commented out.
-- =====================================================================================

BEGIN;

-- 1) RLS: one auth.uid() per statement. Roles are left as they are (no TO clause).
ALTER POLICY "Users read own data" ON public.user_training_data
  USING ((select auth.uid()) = user_id);
ALTER POLICY "Users insert own data" ON public.user_training_data
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users update own data" ON public.user_training_data
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY users_delete_own_data ON public.user_training_data
  USING ((select auth.uid()) = user_id);

-- 2) A fixed search_path for the one function that had none.
ALTER FUNCTION public.update_updated_at() SET search_path = '';

-- 3) The two SECURITY DEFINER functions: no EXECUTE for the API roles. postgres (owner)
--    and service_role keep theirs.
REVOKE EXECUTE ON FUNCTION public.enforce_subscription_tier() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- 4) ASSERTION: count what took; any shortfall rolls the whole file back.
DO $assert$
DECLARE
  n_policies int;
  fn regprocedure;
BEGIN
  SELECT count(*) INTO n_policies
    FROM pg_policy p
   WHERE p.polrelid = 'public.user_training_data'::regclass
     AND p.polname IN ('Users read own data', 'Users insert own data',
                       'Users update own data', 'users_delete_own_data')
     -- at least one wrapped call, and no bare one left once the wrapped ones are removed
     AND concat_ws(' ', pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid))
         LIKE '%SELECT auth.uid()%'
     AND replace(concat_ws(' ', pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid)),
                 'SELECT auth.uid()', '') NOT LIKE '%auth.uid()%';
  IF n_policies <> 4 THEN
    RAISE EXCEPTION 'hygiene: % of 4 policies read (select auth.uid())', n_policies;
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.user_training_data'::regclass) <> 4 THEN
    RAISE EXCEPTION 'hygiene: user_training_data does not carry exactly 4 policies';
  END IF;

  IF NOT (SELECT coalesce(proconfig, '{}') @> ARRAY['search_path=""']
            FROM pg_proc WHERE oid = 'public.update_updated_at()'::regprocedure) THEN
    RAISE EXCEPTION 'hygiene: public.update_updated_at() has no empty search_path';
  END IF;

  FOREACH fn IN ARRAY ARRAY['public.enforce_subscription_tier()'::regprocedure,
                            'public.rls_auto_enable()'::regprocedure] LOOP
    IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
                WHERE p.oid = fn AND a.grantee = 0 AND a.privilege_type = 'EXECUTE')
       OR has_function_privilege('anon', fn, 'EXECUTE')
       OR has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'hygiene: % is still executable by PUBLIC, anon or authenticated', fn;
    END IF;
    IF NOT has_function_privilege('postgres', fn, 'EXECUTE')
       OR NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'hygiene: % lost EXECUTE for postgres or service_role', fn;
    END IF;
  END LOOP;
  RAISE NOTICE 'hygiene assertion passed: 4 of 4 policies, search_path set, 2 of 2 functions revoked';
END
$assert$;

-- 5) PROBE: both functions still FIRE for a role without EXECUTE. Everything it creates is
--    undone by its own sentinel exception (SQLSTATE HYG00); any other error escapes and
--    aborts the transaction.
DO $probe$
DECLARE
  tier text;
BEGIN
  BEGIN
    CREATE SCHEMA hygiene_v1_253_1_probe;
    CREATE TABLE hygiene_v1_253_1_probe.tier (subscription_tier text);
    CREATE TRIGGER probe_tier BEFORE INSERT ON hygiene_v1_253_1_probe.tier
      FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_tier();
    GRANT USAGE, CREATE ON SCHEMA hygiene_v1_253_1_probe TO anon;
    GRANT INSERT ON hygiene_v1_253_1_probe.tier TO anon;

    SET LOCAL ROLE anon;
    INSERT INTO hygiene_v1_253_1_probe.tier VALUES ('premium');   -- the row trigger fires as anon
    CREATE TABLE hygiene_v1_253_1_probe.ddl (x int);              -- ensure_rls fires as anon
    RESET ROLE;

    SELECT subscription_tier INTO tier FROM hygiene_v1_253_1_probe.tier;
    IF tier IS DISTINCT FROM 'free' THEN
      RAISE EXCEPTION 'hygiene probe: enforce_subscription_tier did not run (tier = %)', tier;
    END IF;
    RAISE EXCEPTION 'probe passed' USING ERRCODE = 'HYG00';
  EXCEPTION WHEN SQLSTATE 'HYG00' THEN
    RAISE NOTICE 'hygiene probe passed: both functions fired for anon without EXECUTE; probe rolled back';
  END;
END
$probe$;

COMMIT;

-- 6) The one row the SQL Editor shows (it may not show NOTICEs). Read-only.
--    Expect: policies_wrapped 4 · search_path_set true · definers_revoked 2 · probe_residue false
SELECT
  (SELECT count(*) FROM pg_policy p
    WHERE p.polrelid = 'public.user_training_data'::regclass
      AND concat_ws(' ', pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid))
          LIKE '%SELECT auth.uid()%'
      AND replace(concat_ws(' ', pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid)),
                  'SELECT auth.uid()', '') NOT LIKE '%auth.uid()%') AS policies_wrapped,
  (SELECT coalesce(proconfig, '{}') @> ARRAY['search_path=""']
     FROM pg_proc WHERE oid = 'public.update_updated_at()'::regprocedure) AS search_path_set,
  (SELECT count(*) FROM unnest(ARRAY['public.enforce_subscription_tier()'::regprocedure,
                                     'public.rls_auto_enable()'::regprocedure]) AS f(fn)
    WHERE NOT has_function_privilege('anon', f.fn, 'EXECUTE')
      AND NOT has_function_privilege('authenticated', f.fn, 'EXECUTE')) AS definers_revoked,
  to_regnamespace('hygiene_v1_253_1_probe') IS NOT NULL AS probe_residue;

-- =====================================================================================
-- VERIFY in detail (read-only; run after the COMMIT):
--
--   SELECT polname, polcmd, polroles::regrole[] AS roles,
--          pg_get_expr(polqual, polrelid) AS using_expr,
--          pg_get_expr(polwithcheck, polrelid) AS check_expr
--     FROM pg_policy WHERE polrelid = 'public.user_training_data'::regclass ORDER BY polname;
--   -- expect 4 rows, roles {-} (= public), each expression ( SELECT auth.uid() AS uid) = user_id
--
--   SELECT p.oid::regprocedure AS fn, p.prosecdef, p.proconfig, p.proacl
--     FROM pg_proc p
--    WHERE p.oid IN ('public.update_updated_at()'::regprocedure,
--                    'public.enforce_subscription_tier()'::regprocedure,
--                    'public.rls_auto_enable()'::regprocedure);
--   -- expect update_updated_at with {search_path=""}; the two definers' ACLs list only
--   -- postgres and service_role (no "=X/postgres", no anon=, no authenticated=)
--
--   SELECT to_regnamespace('hygiene_v1_253_1_probe');   -- expect NULL: the probe left nothing
--
-- Then re-run the Performance and Security advisors: auth_rls_initplan (4),
-- function_search_path_mutable (1) and the two *_security_definer_function_executable
-- lints (2 functions each) should be gone; auth_leaked_password_protection stays until the
-- dashboard setting is changed.
-- =====================================================================================

-- =====================================================================================
-- PROPOSED, NOT APPLIED — table privileges no API caller uses. Uncomment to apply.
--
-- anon and authenticated hold Supabase's default grants on the table, relacl `arwdDxtm`:
-- INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER and, since Postgres 17,
-- MAINTAIN (VACUUM, ANALYZE, CLUSTER, REFRESH MATERIALIZED VIEW, REINDEX and LOCK TABLE;
-- https://www.postgresql.org/docs/17/ddl-priv.html). Every caller, checked in v1.253.1:
--   * the app (source/quartz/components/scripts/supabase.ts): pullNeural is a SELECT of
--     `neural` by user_id; pushNeural is an upsert, i.e. INSERT … ON CONFLICT DO UPDATE
--     (INSERT + UPDATE + SELECT). Nothing else; the legacy sync was deleted in v1.80.0.
--   * .github/workflows/supabase-keepalive.yml: a SELECT of `id` with the anon key.
--   * functions/unsubscribe.js and workers/digest/: the service role, untouched by this.
-- PostgREST has no request that issues TRUNCATE, adds a foreign key (REFERENCES), creates a
-- trigger (TRIGGER) or runs VACUUM, REINDEX or LOCK TABLE (MAINTAIN), so the app loses
-- nothing. If a path to SQL as these roles ever opened:
--   * TRUNCATE is the one that matters: "Operations that apply to the whole table, such as
--     TRUNCATE and REFERENCES, are not subject to row security"
--     (https://www.postgresql.org/docs/17/ddl-rowsecurity.html), so it would empty every
--     player's row at once;
--   * MAINTAIN (this seat's addition to the three the brief named) removes VACUUM FULL,
--     CLUSTER and REINDEX, which rewrite or rebuild under an exclusive lock. It does NOT
--     remove LOCK TABLE: UPDATE or DELETE alone permits any lock mode
--     (https://www.postgresql.org/docs/17/sql-lock.html; seen in the rehearsal), and the
--     app needs UPDATE. A small gain, for nothing lost.
-- Defence in depth; there is no such path today.
-- It covers THIS table only: the default ACLs in `public` give every NEW table arwdDxtm and
-- every new function EXECUTE for anon and authenticated (ALTER DEFAULT PRIVILEGES is the
-- durable form, and a separate decision).
--
-- BEGIN;
-- REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.user_training_data FROM anon, authenticated;
-- COMMIT;
--
-- Its rollback:
-- GRANT TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.user_training_data TO anon, authenticated;
-- =====================================================================================

-- =====================================================================================
-- ROLLBACK — restores production exactly as it was on 2026-11-10. Uncomment to run.
--
-- BEGIN;
-- ALTER POLICY "Users read own data" ON public.user_training_data
--   USING (auth.uid() = user_id);
-- ALTER POLICY "Users insert own data" ON public.user_training_data
--   WITH CHECK (auth.uid() = user_id);
-- ALTER POLICY "Users update own data" ON public.user_training_data
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);
-- ALTER POLICY users_delete_own_data ON public.user_training_data
--   USING (auth.uid() = user_id);
-- ALTER FUNCTION public.update_updated_at() RESET search_path;
-- GRANT EXECUTE ON FUNCTION public.enforce_subscription_tier() TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, anon, authenticated;
-- COMMIT;
-- =====================================================================================
