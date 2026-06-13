-- ═══ Phase 2.2 修复 · request_join RPC（凭码加入，绕 RLS 查 family）═══
-- 问题：joinByCode 用 families.select(eq code) 查家族，但 families_select 只放行成员/创建者，
-- 第二个号（非成员）查不到 → "代码不存在"；又不能把 families 对所有人可见（泄露家族）。
-- 修复：SECURITY DEFINER 函数 request_join(code) 服务端按 code 查 family（绕 RLS）+ 建 pending
-- 申请 + 防重复检查，原子完成，不暴露家族列表。
-- 应用方式：SQL Editor 手动执行。

create or replace function public.request_join(p_code text)
returns table(family_name text, status text)
language plpgsql security definer set search_path = public as $$
declare
  fam record;
  app uuid := auth.uid();
begin
  if app is null then
    raise exception '未登录';
  end if;
  select f.id, f.name into fam from public.families f where upper(f.code) = upper(trim(p_code)) limit 1;
  if not found then
    raise exception '代码不存在或已过期';
  end if;
  if exists (select 1 from public.family_members m where m.family_id = fam.id and m.user_id = app) then
    raise exception '你已是该家族成员';
  end if;
  if exists (select 1 from public.join_requests r where r.family_id = fam.id and r.applicant_id = app and r.status = 'pending') then
    raise exception '已提交过申请，等待审核';
  end if;
  insert into public.join_requests (family_id, applicant_id, type, status) values (fam.id, app, 'join', 'pending');
  return query select fam.name::text, 'pending'::text;
end;
$$;

-- 默认 EXECUTE 权限给 PUBLIC，显式授予 authenticated（明确意图）
revoke all on function public.request_join(text) from public;
grant execute on function public.request_join(text) to authenticated;
