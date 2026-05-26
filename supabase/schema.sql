-- BJJGraph Supabase Schema
-- Table: user_training_data
-- This file documents the production schema. Apply via Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS user_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  srs_cards JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  daily_progress JSONB DEFAULT '{}'::jsonb,
  streak JSONB DEFAULT '{}'::jsonb,
  lifetime_stats JSONB DEFAULT '{}'::jsonb,
  move_votes JSONB DEFAULT '{}'::jsonb,
  subscription_tier TEXT DEFAULT 'free',
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

CREATE POLICY "users_update_own_data" ON user_training_data
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_data" ON user_training_data
  FOR DELETE USING (auth.uid() = user_id);
