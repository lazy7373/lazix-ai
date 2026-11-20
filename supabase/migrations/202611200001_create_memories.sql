-- LAZIX permanent memory
-- Run this in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memories_user_updated_idx
  on public.memories (user_id, updated_at desc);

alter table public.memories enable row level security;

drop policy if exists "Users can read their own memories" on public.memories;
create policy "Users can read their own memories"
  on public.memories for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own memories" on public.memories;
create policy "Users can add their own memories"
  on public.memories for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can edit their own memories" on public.memories;
create policy "Users can edit their own memories"
  on public.memories for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own memories" on public.memories;
create policy "Users can delete their own memories"
  on public.memories for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.memories to authenticated;
revoke all on public.memories from anon;
