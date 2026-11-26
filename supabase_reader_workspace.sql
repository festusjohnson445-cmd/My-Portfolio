-- ============================================================================
-- PRIVATE PER-USER ENGINEERING HUB READER WORKSPACE
-- Stores private bookmarks, highlights, annotations, personal notes & exact progress
-- keyed strictly per (user_id, document_id) with strict Supabase RLS isolation.
-- ============================================================================

create table if not exists public.document_reading_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id text not null,
  last_page integer not null default 1,
  total_pages integer not null default 1,
  scroll_ratio double precision not null default 0,
  scroll_y double precision not null default 0,
  zoom double precision not null default 1,
  view_mode text not null default 'paginated',
  bookmarks jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  annotations jsonb not null default '[]'::jsonb,
  personal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_reading_states_user_doc_unique unique (user_id, document_id),
  constraint document_reading_states_view_mode_check check (view_mode in ('paginated', 'continuous'))
);

create index if not exists idx_document_reading_states_user_updated
  on public.document_reading_states (user_id, updated_at desc);

alter table public.document_reading_states enable row level security;

drop policy if exists "Users can view own reading state" on public.document_reading_states;
create policy "Users can view own reading state"
  on public.document_reading_states
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own reading state" on public.document_reading_states;
create policy "Users can insert own reading state"
  on public.document_reading_states
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own reading state" on public.document_reading_states;
create policy "Users can update own reading state"
  on public.document_reading_states
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own reading state" on public.document_reading_states;
create policy "Users can delete own reading state"
  on public.document_reading_states
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_document_reading_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_document_reading_states_updated_at on public.document_reading_states;
create trigger trg_document_reading_states_updated_at
  before update on public.document_reading_states
  for each row
  execute function public.set_document_reading_states_updated_at();
