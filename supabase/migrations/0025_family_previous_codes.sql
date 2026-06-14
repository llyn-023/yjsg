-- ═══ 0025 · 家族旧码保留 + join_preview 兼容旧码 ═══
-- 需求：创建者重置码后，持有旧码的人仍可凭旧码申请加入（走创建者审核流程）
-- 实现：families 新增 previous_codes text[]；reset_family_code 压入旧码；join_preview 兼容新旧码

-- 1. families 加 previous_codes 字段
alter table public.families add column if not exists previous_codes text[] default '{}';

-- 2. 更新 reset_family_code：重置前把旧码压入 previous_codes
drop function if exists public.reset_family_code(uuid);
create or replace function public.reset_family_code(p_family_id uuid)
returns table(o_new_code text) language plpgsql security definer set search_path = public as $$
declare
  fam record;
  new_code text;
begin
  select f.id, f.code, f.creator_id into fam from public.families f where f.id = p_family_id;
  if not found then raise exception '家族不存在'; end if;
  if fam.creator_id != auth.uid() then raise exception '仅创建者可重置家族代码'; end if;
  -- 压入旧码
  update public.families set previous_codes = array_append(coalesce(previous_codes, '{}'), fam.code) where id = p_family_id;
  -- 生成新码
  for i in 1..8 loop
    new_code := upper(left(replace(gen_random_uuid()::text, '-', ''), 6));
    begin
      update public.families set code = new_code where id = p_family_id;
      exit;
    exception when unique_violation then
      if i = 8 then raise exception '生成码失败，请重试'; end if;
    end;
  end loop;
  return query select new_code;
end;
$$;
revoke all on function public.reset_family_code(uuid) from public;
grant execute on function public.reset_family_code(uuid) to authenticated;

-- 3. 更新 join_preview：也接受 previous_codes 中的旧码
drop function if exists public.join_preview(text);
create or replace function public.join_preview(p_code text)
returns table(o_family_id uuid, o_family_name text, o_member_id uuid, o_member_name text, o_member_gender text, o_member_status text, o_is_old_code boolean)
language plpgsql security definer set search_path = public as $$
declare
  fam record;
  app uuid := auth.uid();
  is_old boolean := false;
begin
  if app is null then raise exception '未登录'; end if;
  -- 先查当前码
  select f.id, f.name into fam from public.families f where upper(f.code) = upper(trim(p_code)) limit 1;
  -- 再查旧码
  if not found then
    select f.id, f.name into fam from public.families f where upper(trim(p_code)) = any(f.previous_codes) limit 1;
    is_old := true;
  end if;
  if not found then raise exception '代码不存在或已过期'; end if;
  if exists (select 1 from public.family_members m where m.family_id = fam.id and m.user_id = app) then
    raise exception '你已是该家族成员';
  end if;
  return query
    select fam.id, fam.name, m.id, m.name, m.gender, m.status, is_old
    from public.family_members m
    where m.family_id = fam.id
    order by m.created_at;
end;
$$;
revoke all on function public.join_preview(text) from public;
grant execute on function public.join_preview(text) to authenticated;
