-- DOOMLIST account sync schema
-- Run this in Supabase Dashboard > SQL Editor.
create table if not exists public.watch_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  watched boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.watch_progress enable row level security;

drop policy if exists "Users can read their own watch progress" on public.watch_progress;
create policy "Users can read their own watch progress"
on public.watch_progress for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own watch progress" on public.watch_progress;
create policy "Users can insert their own watch progress"
on public.watch_progress for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own watch progress" on public.watch_progress;
create policy "Users can update their own watch progress"
on public.watch_progress for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own watch progress" on public.watch_progress;
create policy "Users can delete their own watch progress"
on public.watch_progress for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.watch_progress to authenticated;
