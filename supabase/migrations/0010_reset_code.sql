-- ═══ Phase 2.5 · 重置家族代码（§3.7；仅创建者）═══
-- reset_family_code(family_id)：仅创建者；生成新 6 位唯一码（碰撞重试最多 8 次），旧码立即失效。
-- SECURITY DEFINER 绕 RLS；OUT 参数 o_ 前缀避免列名歧义。
-- 应用方式：SQL Editor 手动执行。

create or replace function public.reset_family_code(p_family_id uuid)
returns table(o_ok boolean, o_new_code text)
language plpgsql security definer set search_path = public as $$
declare
  app uuid := auth.uid();
  v_new_code text;
  v_ok boolean := false;
begin
  if app is null then raise exception '未登录'; end if;
  if not exists (select 1 from public.families f where f.id = p_family_id and f.creator_id = app) then
    raise exception '仅创建者可重置家族代码';
  end if;

  for i in 1..8 loop
    v_new_code := upper(left(replace(gen_random_uuid()::text, '-', ''), 6));
    begin
      update public.families set code = v_new_code, updated_at = now()
        where id = p_family_id;
      v_ok := true;
      exit;
    exception when unique_violation then
      -- 码碰撞，重试
      continue;
    end;
  end loop;

  if not v_ok then
    raise exception '生成代码失败，请重试';
  end if;

  return query select true, v_new_code;
end;
$$;

revoke all on function public.reset_family_code(uuid) from public;
grant execute on function public.reset_family_code(uuid) to authenticated;
