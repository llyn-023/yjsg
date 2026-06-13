-- ═══ Phase 2.1 · 家族/成员/关系/称谓缓存 表 + RLS ═══
-- 依据《家谱关系系统_数据模型与推导规格》v1.3：
--   · family_relations 只存 parent_of / spouse_of 两种边（6 种定位关系是用户标签，转成 2 种边）
--   · family_members.status: placeholder/claimed/deceased（self 用 user_id=自己 表示）
--   · kinship_cache 双向缓存 ego→alter 称谓（堂/长幼已编码进 term 如"堂兄"）；仅服务端写
-- 与计划 §三 schema 的出入：relations.type 用 parent_of/spouse_of（非 6 种）；death_year（非 death_date）。
-- RLS：用 is_family_member(family_id) 判定成员资格；创建者专属操作叠加 creator_id=auth.uid()。
-- 应用方式：SQL Editor 手动执行。

-- 1. families
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  surname text,
  description text default '',
  code char(6) not null unique,
  creator_id uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. family_members（家谱节点）
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,  -- null=占位
  name text not null,
  gender text not null default 'male',          -- male/female
  birth_date date,
  birth_type text not null default 'solar',     -- solar/lunar
  death_year int,
  hometown text,
  dish text,
  avatar_url text,
  status text not null default 'placeholder',   -- placeholder/claimed/deceased
  role text not null default 'member',          -- creator/member
  layout_x double precision,
  layout_y double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. family_relations（只存 parent_of / spouse_of）
create table if not exists public.family_relations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  relation_type text not null check (relation_type in ('parent_of','spouse_of')),
  from_member uuid not null references public.family_members(id) on delete cascade,
  to_member uuid not null references public.family_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (family_id, relation_type, from_member, to_member)
);

-- 4. kinship_cache（称谓缓存，仅服务端写）
create table if not exists public.kinship_cache (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  ego_id uuid not null references public.family_members(id) on delete cascade,
  alter_id uuid not null references public.family_members(id) on delete cascade,
  kinship_term text not null,
  updated_at timestamptz not null default now(),
  unique (family_id, ego_id, alter_id)
);

-- 索引
create index if not exists idx_fm_family on public.family_members(family_id);
create index if not exists idx_fm_user on public.family_members(user_id);
create index if not exists idx_fr_from on public.family_relations(from_member);
create index if not exists idx_fr_to on public.family_relations(to_member);
create index if not exists idx_kc_ego on public.kinship_cache(family_id, ego_id);
create index if not exists idx_kc_alter on public.kinship_cache(family_id, alter_id);

-- 辅助函数：当前用户是否是某家族成员（SECURITY DEFINER 绕 RLS 查询）
create or replace function public.is_family_member(fam uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.family_members where family_id = fam and user_id = auth.uid());
$$;

-- ===== RLS =====
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_relations enable row level security;
alter table public.kinship_cache enable row level security;

-- families：读=成员；建=本人；改=创建者
drop policy if exists "families_select" on public.families;
create policy "families_select" on public.families for select to authenticated
  using (public.is_family_member(id) OR creator_id = auth.uid());
drop policy if exists "families_insert" on public.families;
create policy "families_insert" on public.families for insert to authenticated
  with check (creator_id = auth.uid());
drop policy if exists "families_update" on public.families;
create policy "families_update" on public.families for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());

-- family_members：读=该家族成员；增=成员 OR 创建者（解决建家族时插首个节点的鸡生蛋）；改=创建者 or 本人；删=创建者
drop policy if exists "fm_select" on public.family_members;
create policy "fm_select" on public.family_members for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists "fm_insert" on public.family_members;
create policy "fm_insert" on public.family_members for insert to authenticated
  with check (
    public.is_family_member(family_id)
    or exists (select 1 from public.families f where f.id = family_id and f.creator_id = auth.uid())
  );
drop policy if exists "fm_update" on public.family_members;
create policy "fm_update" on public.family_members for update to authenticated
  using (exists (select 1 from public.families f where f.id = family_id and f.creator_id = auth.uid()) or user_id = auth.uid())
  with check (exists (select 1 from public.families f where f.id = family_id and f.creator_id = auth.uid()) or user_id = auth.uid());
drop policy if exists "fm_delete" on public.family_members;
create policy "fm_delete" on public.family_members for delete to authenticated
  using (exists (select 1 from public.families f where f.id = family_id and f.creator_id = auth.uid()));

-- family_relations：读/写=该家族成员
drop policy if exists "fr_select" on public.family_relations;
create policy "fr_select" on public.family_relations for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists "fr_all" on public.family_relations;
create policy "fr_all" on public.family_relations for all to authenticated
  using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

-- kinship_cache：读=该家族成员；写仅服务端（service role 绕 RLS）
drop policy if exists "kc_select" on public.kinship_cache;
create policy "kc_select" on public.kinship_cache for select to authenticated
  using (public.is_family_member(family_id));
