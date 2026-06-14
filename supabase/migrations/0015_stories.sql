-- ═══ Phase 4.4 · stories 表 + RLS ═══
-- stories：AI 生成的故事（P31「整理成故事」输出 §10.2 结构）
-- 应用方式：SQL Editor 手动执行。

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  anchor_id uuid references public.anchors(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  title text default '',
  output jsonb not null default '{}'::jsonb,   -- §10.2 结构
  status text not null default 'draft' check (status in ('draft','published','lit')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stories_conv on public.stories(conversation_id);
create index if not exists idx_stories_user on public.stories(user_id);

alter table public.stories enable row level security;

-- 用户隔离：读/写/删 = 本人
drop policy if exists "st_select" on public.stories;
create policy "st_select" on public.stories for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "st_insert" on public.stories;
create policy "st_insert" on public.stories for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "st_update" on public.stories;
create policy "st_update" on public.stories for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
