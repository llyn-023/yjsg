-- ═══ Phase 2.2 · join_requests 表 + RLS ═══
-- 用途：凭码加入申请（2.2 建 pending）、加入/认领审核（2.6）、认领节点（2.5，type=claim + node_id）。
-- 应用方式：SQL Editor 手动执行。

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'join' check (type in ('join','claim')),
  node_id uuid references public.family_members(id) on delete cascade,  -- claim 认领的节点
  statement text default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists idx_jr_family on public.join_requests(family_id, status);

alter table public.join_requests enable row level security;

-- 读：申请人看自己 / 创建者看本家族全部（审核用）
drop policy if exists "jr_select" on public.join_requests;
create policy "jr_select" on public.join_requests for select to authenticated
  using (applicant_id = auth.uid() or exists (select 1 from public.families f where f.id = family_id and f.creator_id = auth.uid()));

-- 申请加入：本人写自己
drop policy if exists "jr_insert" on public.join_requests;
create policy "jr_insert" on public.join_requests for insert to authenticated
  with check (applicant_id = auth.uid());

-- 审核（通过/驳回）：仅创建者
drop policy if exists "jr_update" on public.join_requests;
create policy "jr_update" on public.join_requests for update to authenticated
  using (exists (select 1 from public.families f where f.id = family_id and f.creator_id = auth.uid()))
  with check (exists (select 1 from public.families f where f.id = family_id and f.creator_id = auth.uid()));
