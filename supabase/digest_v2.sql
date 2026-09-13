-- Training-day digest, second pass (v1.164.3). Run once in the Supabase SQL editor, after
-- digest_v1.sql. Idempotent: safe to run again.
--
-- THE OWNER'S KILL SWITCHES MUST WORK. The red team (2026-09-01) found that banning an
-- abusive account — the dashboard's one-click response — left its digest opt-in intact,
-- and that HARD-deleting it was refused outright: `user_training_data.user_id` references
-- auth.users(id) with no ON DELETE CASCADE, so the delete fails on the foreign key and the
-- row (blob, opt-in and all) survives. The Worker now reads `banned_until`, `deleted_at`
-- and `email_confirmed_at` (workers/digest/index.js, compose), so a ban stops the mail
-- without this file — but a delete must be able to take the row with it, and that is a
-- schema fact only SQL can change.
--
-- The constraint is found by its columns, not its name: the repo's schema.sql documents
-- production, it does not define it, and the name a dashboard-created FK carries is not
-- guaranteed to be the default `user_training_data_user_id_fkey`.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.user_training_data'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.user_training_data drop constraint %I', c);
  end loop;
  alter table public.user_training_data
    add constraint user_training_data_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
end $$;

-- digest_sent and digest_suppress already cascade (digest_v1.sql). Nothing else changes:
-- the second-stop lock (workers/digest/suppress.js) is a sentinel `at`, not a column, so it
-- needs no migration — and it holds even against a Worker deployed before this file ran.
--
-- TO LIFT A LOCK BY HAND (the only way — see suppress.js for why):
--   delete from digest_suppress where user_id = '<uuid>';
