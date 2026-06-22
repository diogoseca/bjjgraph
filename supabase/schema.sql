-- BJJGraph Supabase Schema
-- Table: user_training_data
-- This file documents the production schema. Apply via Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS user_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE so the client's `upsert(..., { onConflict: 'user_id' })` resolves
  -- deterministically (and a user can't accumulate multiple rows).
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  srs_cards JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  daily_progress JSONB DEFAULT '{}'::jsonb,
  streak JSONB DEFAULT '{}'::jsonb,
  lifetime_stats JSONB DEFAULT '{}'::jsonb,
  move_votes JSONB DEFAULT '{}'::jsonb,
  -- Constrain to known tiers so a forged value can't slip through even server-side.
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row-Level Security (RLS)
-- Critical: Without these policies, any authenticated user can access any row.
ALTER TABLE user_training_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_data" ON user_training_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_data" ON user_training_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- WITH CHECK is REQUIRED: USING alone only filters which existing rows may be
-- targeted; without WITH CHECK a user could rewrite user_id to another user's id
-- and hijack/clobber their row. Pin the post-update row to the caller too.
CREATE POLICY "users_update_own_data" ON user_training_data
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_data" ON user_training_data
  FOR DELETE USING (auth.uid() = user_id);

-- ── subscription_tier integrity ──────────────────────────────────────────────
-- RLS is row-level, not column-level, so the policies above still let a user set
-- their own subscription_tier='premium' via a direct PATCH with the public anon key
-- (privilege escalation the moment any paid feature reads the column). This trigger
-- makes the column writable ONLY by the service_role (server-side / Edge Function):
-- regular authenticated users get 'free' on insert and the existing value preserved
-- on update. Pair with: grant tier changes only through trusted server code.
CREATE OR REPLACE FUNCTION enforce_subscription_tier()
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

DROP TRIGGER IF EXISTS trg_enforce_subscription_tier ON user_training_data;
CREATE TRIGGER trg_enforce_subscription_tier
  BEFORE INSERT OR UPDATE ON user_training_data
  FOR EACH ROW EXECUTE FUNCTION enforce_subscription_tier();
