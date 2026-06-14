-- ═══ Phase 6.1 · capsules 表 + RLS ═══
-- capsules: 时间胶囊（§5.1-5.4）
-- state: sealed（封存）/ open（已开启）
-- 设为胶囊后脱离味道桌（§5.1）：此胶囊的 anchor 不被 P10 lit 列表查询
-- 到期自动启封：open_due_capsules() SECURITY DEFINER 函数，由定时 Edge/cron 调用
-- 应用方式：SQL Editor 手动执行。

create table if not exists public.capsules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  open_date date not null,                    -- 启封日期
  to_members jsonb default '[]'::jsonb,      -- [member_id, ...] 送给谁
  story_id uuid references public.stories(id) on delete set null,
  anchor_id uuid references public.anchors(id) on delete set null,
  text text default '',
  img_url text,
  state text not null default 'sealed' check (state in ('sealed','open')),
  created_by uuid not null references public.profiles(id) on delete set null,
  reminder_sent boolean not null default false,  -- §5.4：前一天提醒是否已发
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_capsules_family on public.capsules(family_id, state);
create index if not exists idx_capsules_date on public.capsules(open_date, state);

alter table public.capsules enable row level security;

-- capsules RLS：读/增 = 家族成员；改/删 = 创建者本人
drop policy if exists "cap_select" on public.capsules;
create policy "cap_select" on public.capsules for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists "cap_insert" on public.capsules;
create policy "cap_insert" on public.capsules for insert to authenticated
  with check (public.is_family_member(family_id) and created_by = auth.uid());
drop policy if exists "cap_update" on public.capsules;
create policy "cap_update" on public.capsules for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "cap_delete" on public.capsules;
create policy "cap_delete" on public.capsules for delete to authenticated
  using (created_by = auth.uid());
