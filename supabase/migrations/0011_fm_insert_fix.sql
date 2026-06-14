-- ═══ Phase 2.5 · fm_insert RLS 加固 ═══
-- 将 fm_insert 的 with check 从内联子查询改为 SECURITY DEFINER helper。
-- 原策略（0002）在 families 表 RLS 叠加时可能因 search_path / inlining 导致 creator check 失效。
-- 新函数 can_insert_into_family(fam) 统一在 SECURITY DEFINER 内做 member-or-creator 判断，
-- 两个子查询均在 owner 权限下执行，不受 families RLS 干扰。
-- 应用方式：SQL Editor 手动执行。

create or replace function public.can_insert_into_family(fam uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then return false; end if;
  return exists (select 1 from public.family_members where family_id = fam and user_id = v_uid)
      or exists (select 1 from public.families where id = fam and creator_id = v_uid);
end;
$$;

revoke all on function public.can_insert_into_family(uuid) from public;
grant execute on function public.can_insert_into_family(uuid) to authenticated;

drop policy if exists "fm_insert" on public.family_members;
create policy "fm_insert" on public.family_members for insert to authenticated
  with check (public.can_insert_into_family(family_id));
