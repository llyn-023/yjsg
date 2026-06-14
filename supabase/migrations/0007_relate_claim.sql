-- ═══ Phase 2.5 · relate / claim 入伙 RPC（凭码定位自己，SECURITY DEFINER 绕 RLS）═══
-- v3：OUT 参数改 o_ 前缀（o_family_id/o_family_name/...），彻底避免与 family_id 等列名撞名
--     → "column reference is ambiguous"（ON CONFLICT / WHERE / 列表都安全）。create or replace 重跑即覆盖。
-- 放行=凭码即入伙（auto-approve）。label-to-edge 语句A（同 addMember）。
-- 先 DROP（v2→v3 改了 OUT 参数/返回类型，OR REPLACE 不允许改返回类型，须先删再建）
drop function if exists public.join_preview(text);
drop function if exists public.relate(text, uuid, text, text, text, date, text);
drop function if exists public.claim(text, uuid, text);

create or replace function public.join_preview(p_code text)
returns table(o_family_id uuid, o_family_name text, o_member_id uuid, o_member_name text, o_member_gender text, o_member_status text)
language plpgsql security definer set search_path = public as $$
declare
  fam record;
  app uuid := auth.uid();
begin
  if app is null then raise exception '未登录'; end if;
  select f.id, f.name into fam from public.families f where upper(f.code) = upper(trim(p_code)) limit 1;
  if not found then raise exception '代码不存在或已过期'; end if;
  if exists (select 1 from public.family_members m where m.family_id = fam.id and m.user_id = app) then
    raise exception '你已是该家族成员';
  end if;
  return query
    select fam.id, fam.name, m.id, m.name, m.gender, m.status
    from public.family_members m
    where m.family_id = fam.id
    order by m.created_at;
end;
$$;

create or replace function public.relate(
  p_code text, p_rel_with_id uuid, p_rel text, p_name text, p_gender text,
  p_birth_date date, p_birth_type text
) returns table(o_family_id uuid, o_family_name text)
language plpgsql security definer set search_path = public as $$
declare
  fam record;
  app uuid := auth.uid();
  v_new uuid;
  v_type text;
  v_from uuid;
  v_to uuid;
begin
  if app is null then raise exception '未登录'; end if;
  if p_rel not in ('父亲','母亲','儿子','女儿','丈夫','妻子') then raise exception '关系无效'; end if;
  if p_gender not in ('male','female') then raise exception '性别无效'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception '请填写姓名'; end if;
  select f.id, f.name into fam from public.families f where upper(f.code) = upper(trim(p_code)) limit 1;
  if not found then raise exception '代码不存在或已过期'; end if;
  if exists (select 1 from public.family_members m where m.family_id = fam.id and m.user_id = app) then
    raise exception '你已是该家族成员';
  end if;
  if not exists (select 1 from public.family_members m where m.id = p_rel_with_id and m.family_id = fam.id) then
    raise exception '参照成员不存在';
  end if;
  insert into public.family_members (family_id, user_id, name, gender, birth_date, birth_type, status, role)
    values (fam.id, app, trim(p_name), p_gender, p_birth_date, coalesce(p_birth_type,'solar'), 'claimed', 'member')
    returning id into v_new;
  if p_rel in ('父亲','母亲') then
    v_type := 'parent_of'; v_from := v_new;           v_to := p_rel_with_id;
  elsif p_rel in ('儿子','女儿') then
    v_type := 'parent_of'; v_from := p_rel_with_id;   v_to := v_new;
  else
    v_type := 'spouse_of';  v_from := v_new;           v_to := p_rel_with_id;
  end if;
  insert into public.family_relations (family_id, relation_type, from_member, to_member)
    values (fam.id, v_type, v_from, v_to)
    on conflict (family_id, relation_type, from_member, to_member) do nothing;
  if exists (select 1 from public.join_requests r where r.family_id = fam.id and r.applicant_id = app) then
    update public.join_requests jr set status='approved', type='join', reviewed_at=now()
      where jr.family_id = fam.id and jr.applicant_id = app;
  else
    insert into public.join_requests (family_id, applicant_id, type, status, reviewed_at)
      values (fam.id, app, 'join', 'approved', now());
  end if;
  return query select fam.id, fam.name;
end;
$$;

create or replace function public.claim(p_code text, p_node_id uuid, p_name text)
returns table(o_family_id uuid, o_family_name text)
language plpgsql security definer set search_path = public as $$
declare
  fam record;
  app uuid := auth.uid();
begin
  if app is null then raise exception '未登录'; end if;
  select f.id, f.name into fam from public.families f where upper(f.code) = upper(trim(p_code)) limit 1;
  if not found then raise exception '代码不存在或已过期'; end if;
  if exists (select 1 from public.family_members m where m.family_id = fam.id and m.user_id = app) then
    raise exception '你已是该家族成员';
  end if;
  if not exists (select 1 from public.family_members m where m.id = p_node_id and m.family_id = fam.id and m.user_id is null) then
    raise exception '该节点不可认领（不存在或已被认领）';
  end if;
  update public.family_members fm
    set user_id = app,
        status = 'claimed',
        name = case when coalesce(trim(p_name),'') = '' then fm.name else trim(p_name) end,
        updated_at = now()
    where fm.id = p_node_id and fm.family_id = fam.id;
  if exists (select 1 from public.join_requests r where r.family_id = fam.id and r.applicant_id = app) then
    update public.join_requests jr set status='approved', type='claim', node_id=p_node_id, reviewed_at=now()
      where jr.family_id = fam.id and jr.applicant_id = app;
  else
    insert into public.join_requests (family_id, applicant_id, type, node_id, status, reviewed_at)
      values (fam.id, app, 'claim', p_node_id, 'approved', now());
  end if;
  return query select fam.id, fam.name;
end;
$$;

revoke all on function public.join_preview(text) from public;
grant execute on function public.join_preview(text) to authenticated;
revoke all on function public.relate(text, uuid, text, text, text, date, text) from public;
grant execute on function public.relate(text, uuid, text, text, text, date, text) to authenticated;
revoke all on function public.claim(text, uuid, text) from public;
grant execute on function public.claim(text, uuid, text) to authenticated;
