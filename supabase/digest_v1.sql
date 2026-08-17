-- Training-day digest (v1.105.7). Run once in the Supabase SQL editor.
-- Both tables are service-role only: no RLS policies are added, and RLS ON with no policy
-- means anon/authenticated see nothing. The Worker uses the service key.
create table if not exists digest_sent (
  user_id uuid not null references auth.users(id) on delete cascade,
  day text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table digest_sent enable row level security;

create table if not exists digest_suppress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
alter table digest_suppress enable row level security;
