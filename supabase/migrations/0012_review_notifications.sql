-- ═══ Phase 2.6 · 审核 RPC + 通知表 ═══
-- approve_join_request / reject_join_request：仅创建者可操作；通过时建 claimed 成员节点 + 发通知。
-- notifications 表：覆盖 join/claim 审核通知（Phase 5 全量通知时扩充 type）。
-- 应用方式：SQL Editor 手动执行。

-- 1. notifications 表（Phase 2.6 最小版）
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  type text not null check (type in ('join','claim','comment','light','capsule','poke')),
  title text not null default '',
  sub text default '',
  read boolean not null default false,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notif_user on public.notifications(user_id, read);
alter table public.notifications enable row level security;
drop policy if exists "notif_select" on public.notifications;
create policy "notif_select" on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- 2. approve_join_request：仅创建者；通过 → 建 claimed 成员节点 + 发通知
create or replace function public.approve_join_request(p_request_id uuid)
returns table(o_ok boolean, o_member_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  req record;
  app uuid := auth.uid();
  v_member_id uuid;
begin
  if app is null then raise exception '未登录'; end if;
  select * into req from public.join_requests where id = p_request_id;
  if not found then raise exception '申请不存在'; end if;
  if req.status != 'pending' then raise exception '该申请已处理'; end if;
  if not exists (select 1 from public.families f where f.id = req.family_id and f.creator_id = app) then
    raise exception '仅创建者可审核';
  end if;

  -- 建 claimed 成员节点
  insert into public.family_members (family_id, user_id, name, gender, status, role)
  values (req.family_id, req.applicant_id,
    coalesce((select nickname from public.profiles where id = req.applicant_id), '新成员'),
    coalesce((select gender from public.profiles where id = req.applicant_id), '男'),
    'claimed', 'member')
  returning id into v_member_id;

  -- 更新申请状态
  update public.join_requests set status = 'approved', reviewed_at = now() where id = p_request_id;

  -- 发通知给申请人
  insert into public.notifications (user_id, family_id, type, title, sub, payload)
  values (req.applicant_id, req.family_id, 'join',
    '加入申请已通过',
    '你已正式加入 ' || (select name from public.families where id = req.family_id),
    jsonb_build_object('family_id', req.family_id, 'member_id', v_member_id));

  return query select true, v_member_id;
end;
$$;

-- 3. reject_join_request：仅创建者；驳回 + 发通知
create or replace function public.reject_join_request(p_request_id uuid)
returns table(o_ok boolean)
language plpgsql security definer set search_path = public as $$
declare
  req record;
  app uuid := auth.uid();
begin
  if app is null then raise exception '未登录'; end if;
  select * into req from public.join_requests where id = p_request_id;
  if not found then raise exception '申请不存在'; end if;
  if req.status != 'pending' then raise exception '该申请已处理'; end if;
  if not exists (select 1 from public.families f where f.id = req.family_id and f.creator_id = app) then
    raise exception '仅创建者可审核';
  end if;

  update public.join_requests set status = 'rejected', reviewed_at = now() where id = p_request_id;

  insert into public.notifications (user_id, family_id, type, title, sub, payload)
  values (req.applicant_id, req.family_id, 'join',
    '加入申请未通过',
    '你申请加入 ' || (select name from public.families where id = req.family_id) || ' 的请求未被通过',
    jsonb_build_object('family_id', req.family_id));

  return query select true;
end;
$$;

revoke all on function public.approve_join_request(uuid) from public;
grant execute on function public.approve_join_request(uuid) to authenticated;
revoke all on function public.reject_join_request(uuid) from public;
grant execute on function public.reject_join_request(uuid) to authenticated;
