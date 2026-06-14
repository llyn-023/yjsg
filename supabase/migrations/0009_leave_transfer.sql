-- ═══ Phase 2.5 · 成员退出 + 创建者转让（§3.7；用户决定加回这两项，撤销 2.3 "不退出/不转让"）═══
-- leave_family(family_id)：成员退出 → 把自己在该家族的 family_members 行 user_id 置空、status=placeholder
--   （保留家谱节点与关系，符合"谱系永久存在"；退出后 is_family_member=false，无法再读该家族）。
--   拒绝创建者（§3.7：创建者须先转让再退出）。
-- transfer_creator(family_id, new_member_id)：创建者把创建者身份转给某位【已认领】家人
--   → families.creator_id 换人；旧创建者 role=member，新创建者 role=creator。一个家族仅一位创建者。
-- SECURITY DEFINER 绕 RLS；OUT 参数 o_ 前缀避免列名歧义。
-- 应用方式：SQL Editor 手动执行。

create or replace function public.leave_family(p_family_id uuid)
returns table(o_ok boolean)
language plpgsql security definer set search_path = public as $$
declare
  app uuid := auth.uid();
begin
  if app is null then raise exception '未登录'; end if;
  if exists (select 1 from public.families f where f.id = p_family_id and f.creator_id = app) then
    raise exception '你是创建者，请先转让创建者再退出';
  end if;
  if not exists (select 1 from public.family_members m where m.family_id = p_family_id and m.user_id = app) then
    raise exception '你不是该家族成员';
  end if;
  -- 退出：节点 user_id 置空、回 placeholder（保留家谱节点/关系）
  update public.family_members fm
    set user_id = null, status = 'placeholder', updated_at = now()
    where fm.family_id = p_family_id and fm.user_id = app;
  return query select true;
end;
$$;

create or replace function public.transfer_creator(p_family_id uuid, p_new_member_id uuid)
returns table(o_ok boolean)
language plpgsql security definer set search_path = public as $$
declare
  app uuid := auth.uid();
  v_new_user uuid;
begin
  if app is null then raise exception '未登录'; end if;
  if not exists (select 1 from public.families f where f.id = p_family_id and f.creator_id = app) then
    raise exception '仅创建者可转让';
  end if;
  select m.user_id into v_new_user
    from public.family_members m
    where m.id = p_new_member_id and m.family_id = p_family_id and m.user_id is not null;
  if v_new_user is null then raise exception '请选择一位已加入的家人'; end if;
  if v_new_user = app then raise exception '不能转给自己'; end if;
  update public.families set creator_id = v_new_user, updated_at = now() where id = p_family_id;
  update public.family_members set role = 'member', updated_at = now()
    where family_id = p_family_id and user_id = app;
  update public.family_members set role = 'creator', updated_at = now()
    where id = p_new_member_id and family_id = p_family_id;
  return query select true;
end;
$$;

revoke all on function public.leave_family(uuid) from public;
grant execute on function public.leave_family(uuid) to authenticated;
revoke all on function public.transfer_creator(uuid, uuid) from public;
grant execute on function public.transfer_creator(uuid, uuid) to authenticated;
