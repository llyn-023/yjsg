-- ═══ Phase 3 · anchors / comments / hooks 表 + RLS ═══
-- anchors: 味道锚点（lit=已点亮, gray=待讲/灰锚点）
-- comments: 家人补述
-- hooks: 抛钩子/还有人在等
-- 应用方式：SQL Editor 手动执行。

-- 1. anchors
create table if not exists public.anchors (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  by_member uuid references public.family_members(id) on delete set null,
  era text default '',
  city text default '',
  province text default '',
  geo_point point,
  text text default '',
  img_url text,
  status text not null default 'gray' check (status in ('lit','gray')),
  tags jsonb default '[]'::jsonb,
  gray_label text default '',  -- 灰锚点来源标签（"妈妈想听"/"你抛的钩子"/"Agent 猜想" 等）
  created_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_anchors_family on public.anchors(family_id, status);
create index if not exists idx_anchors_created_by on public.anchors(created_by);

alter table public.anchors enable row level security;

-- anchors RLS：读=家族成员；增=成员（created_by 必须是自己）；改/删=创建者本人
drop policy if exists "a_select" on public.anchors;
create policy "a_select" on public.anchors for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists "a_insert" on public.anchors;
create policy "a_insert" on public.anchors for insert to authenticated
  with check (public.is_family_member(family_id) and created_by = auth.uid());
drop policy if exists "a_update" on public.anchors;
create policy "a_update" on public.anchors for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "a_delete" on public.anchors;
create policy "a_delete" on public.anchors for delete to authenticated
  using (created_by = auth.uid());

-- 2. comments
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  anchor_id uuid not null references public.anchors(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comments_anchor on public.comments(anchor_id);

alter table public.comments enable row level security;

-- comments RLS：读=锚点所属家族成员；增/改/删=本人
drop policy if exists "c_select" on public.comments;
create policy "c_select" on public.comments for select to authenticated
  using (exists (select 1 from public.anchors a where a.id = anchor_id and public.is_family_member(a.family_id)));
drop policy if exists "c_insert" on public.comments;
create policy "c_insert" on public.comments for insert to authenticated
  with check (exists (select 1 from public.family_members fm where fm.id = member_id and fm.user_id = auth.uid()));
drop policy if exists "c_update" on public.comments;
create policy "c_update" on public.comments for update to authenticated
  using (exists (select 1 from public.family_members fm where fm.id = member_id and fm.user_id = auth.uid()))
  with check (exists (select 1 from public.family_members fm where fm.id = member_id and fm.user_id = auth.uid()));
drop policy if exists "c_delete" on public.comments;
create policy "c_delete" on public.comments for delete to authenticated
  using (exists (select 1 from public.family_members fm where fm.id = member_id and fm.user_id = auth.uid()));

-- 3. hooks
create table if not exists public.hooks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  dish text not null,
  anchor_id uuid references public.anchors(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete set null,
  target_members jsonb default '[]'::jsonb,  -- [member_id, ...] or ["all"]
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hooks_family on public.hooks(family_id, status);

alter table public.hooks enable row level security;

-- hooks RLS：读=家族成员；增=成员（created_by 必须是自己）；改/删=创建者本人
drop policy if exists "h_select" on public.hooks;
create policy "h_select" on public.hooks for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists "h_insert" on public.hooks;
create policy "h_insert" on public.hooks for insert to authenticated
  with check (public.is_family_member(family_id) and created_by = auth.uid());
drop policy if exists "h_update" on public.hooks;
create policy "h_update" on public.hooks for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "h_delete" on public.hooks;
create policy "h_delete" on public.hooks for delete to authenticated
  using (created_by = auth.uid());
