-- BJJGraph — v1.43.0 security-hardening migration for public.user_training_data
-- =====================================================================================
-- Apply in the Supabase SQL Editor (production) — this is the DIFF that upgrades an
-- EXISTING project to the hardened schema.sql. schema.sql itself cannot be re-run on a
-- live project (its CREATE POLICY would collide with the existing policies and
-- CREATE TABLE IF NOT EXISTS would skip the new constraints).
--
-- Safe to run more than once (idempotent) and safe on live data (guards + dedup).
-- Review the two inspection queries first if you want to see what will change.
-- =====================================================================================

-- Optional inspection (run on their own first if you like):
--   SELECT subscription_tier, count(*) FROM public.user_training_data GROUP BY 1;
--   SELECT user_id, count(*) FROM public.user_training_data GROUP BY 1 HAVING count(*) > 1;

-- 1) Normalize tier values BEFORE adding the CHECK. The old UPDATE policy let users
--    self-set subscription_tier, so reset anything unexpected to 'free' (this also
--    revokes any tier escalated through that hole; no paid feature reads it yet).
UPDATE public.user_training_data
   SET subscription_tier = 'free'
 WHERE subscription_tier IS NULL
    OR subscription_tier NOT IN ('free', 'premium');

-- 2) CHECK constraint on subscription_tier (guarded — constraints have no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'user_training_data_subscription_tier_check'
       AND conrelid = 'public.user_training_data'::regclass
  ) THEN
    ALTER TABLE public.user_training_data
      ADD CONSTRAINT user_training_data_subscription_tier_check
      CHECK (subscription_tier IN ('free', 'premium'));
  END IF;
END$$;

-- 3) UNIQUE(user_id) — matches the client upsert(onConflict: 'user_id'). Only acts if
--    no single-column unique/PK on user_id already exists; in that case it first
--    de-duplicates (keeps the most-recently-updated row) so the constraint can be added.
DO $$
DECLARE
  uid_attnum smallint;
  has_unique boolean;
BEGIN
  SELECT attnum INTO uid_attnum
    FROM pg_attribute
   WHERE attrelid = 'public.user_training_data'::regclass AND attname = 'user_id';

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.user_training_data'::regclass
       AND contype IN ('u','p')
       AND conkey = ARRAY[uid_attnum]
  ) INTO has_unique;

  IF NOT has_unique THEN
    DELETE FROM public.user_training_data a
     USING public.user_training_data b
     WHERE a.user_id = b.user_id
       AND a.user_id IS NOT NULL
       AND (a.updated_at < b.updated_at
            OR (a.updated_at = b.updated_at AND a.id < b.id));

    ALTER TABLE public.user_training_data
      ADD CONSTRAINT user_training_data_user_id_key UNIQUE (user_id);
  END IF;
END$$;

-- 4) UPDATE policy: add the missing WITH CHECK so a user cannot rewrite user_id to
--    point at (and clobber) another user's row. The LIVE policy is named
--    "Users update own data" (spaced); drop both that and the schema.sql underscore
--    variant for safety, then recreate WITH CHECK (role TO public, matching siblings).
DROP POLICY IF EXISTS "Users update own data" ON public.user_training_data;
DROP POLICY IF EXISTS "users_update_own_data" ON public.user_training_data;
CREATE POLICY "Users update own data" ON public.user_training_data
  FOR UPDATE TO public USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5) subscription_tier writable ONLY by service_role (server-side). Regular
--    authenticated users (anon key + JWT) get 'free' on insert and keep the existing
--    value on update — closing the free->premium self-upgrade.
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

-- =====================================================================================
-- Verify after running:
--   SELECT polname, cmd, qual, with_check FROM pg_policies
--     WHERE tablename = 'user_training_data';
--   -- expect users_update_own_data to have a non-null with_check
--   SELECT conname, contype FROM pg_constraint
--     WHERE conrelid = 'public.user_training_data'::regclass;
--   -- expect the subscription_tier_check + user_id unique
-- =====================================================================================
