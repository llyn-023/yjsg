-- ═══ Phase 2.2 修复 · request_join 列名歧义 ═══
-- 0005 的 request_join 里 `status = 'pending'` 与函数 OUT 参数 status 同名 →
-- "column reference 'status' is ambiguous"。本迁移用表别名限定列名重定义函数。
-- 应用方式：SQL Editor 手动执行（create or replace 覆盖 0005 的版本）。

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

revoke all on function public.request_join(text) from public;
grant execute on function public.request_join(text) to authenticated;
