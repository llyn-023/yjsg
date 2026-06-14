-- ═══ 抛钩子「被点名」通知 + 戳一下（§1.4/§1.6）═══
-- 设计要点（用户明确）：
--   · 「抛个钩子」对家人的【关联】永远成立（hooks.target_members 由客户端直接写，不受任何开关影响）。
--   · 是否给被点名者【发通知/可被连续戳】，由接收方 profiles.notif_prefs->>'mention' 决定：
--       mention=false → 不投递「被点名」通知，也收不到「戳一下」（但仍被关联在钩子里）。
--   · 跨用户写 notifications 需绕 RLS（notif_insert 仅允许 user_id=auth.uid()），故用 SECURITY DEFINER。
-- 两个函数都：校验调用者是该家族成员；跳过无 user_id（占位）、mention=false、以及钩子创建者本人。
-- 应用方式：SQL Editor 手动执行（或 Management API database/query）。

-- 内部：给某钩子的目标成员发通知（kind: 'hook_named' 初次 / 'poke' 戳一下）
create or replace function public._notify_hook(p_hook_id uuid, p_poke boolean)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  h record; mid_txt text; v_uid uuid; v_pref jsonb; cnt int := 0; v_name text; v_title text; v_sub text;
begin
  select * into h from public.hooks where id = p_hook_id;
  if not found then raise exception '钩子不存在'; end if;
  if not exists (select 1 from public.family_members where family_id = h.family_id and user_id = auth.uid()) then
    raise exception '无权操作该家族';
  end if;
  select coalesce(nickname, username) into v_name from public.profiles where id = auth.uid();
  v_name := coalesce(v_name, '家人');

  for mid_txt in select jsonb_array_elements_text(coalesce(h.target_members, '[]'::jsonb)) loop
    select user_id into v_uid from public.family_members where id = mid_txt::uuid;
    if v_uid is null or v_uid = h.created_by then continue; end if;           -- 占位 / 创建者本人跳过
    select notif_prefs into v_pref from public.profiles where id = v_uid;
    if coalesce(v_pref->>'mention', 'true') = 'false' then continue; end if;  -- 关了「被点名」→ 不投递
    if p_poke then
      v_title := v_name || ' 又戳了你一下：「' || h.dish || '」还等你讲';
      v_sub := '家人在催这道味道啦，去讲讲吧';
    else
      v_title := v_name || ' 点名你讲「' || h.dish || '」';
      v_sub := '在家谱里指名了你，有空把这道味道讲给大家听';
    end if;
    insert into public.notifications (user_id, family_id, type, title, sub, payload)
    values (v_uid, h.family_id, 'poke', v_title, v_sub,
      jsonb_build_object('hook_id', h.id, 'dish', h.dish, 'kind', case when p_poke then 'poke' else 'hook_named' end));
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

-- 抛钩子后初次通知目标（§1.6）
create or replace function public.notify_hook_targets(p_hook_id uuid)
returns table(o_notified int)
language plpgsql security definer set search_path = public as $$
begin return query select public._notify_hook(p_hook_id, false); end;
$$;

-- 戳一下（连续催；§1.4「被点名」）
create or replace function public.poke_hook(p_hook_id uuid)
returns table(o_notified int)
language plpgsql security definer set search_path = public as $$
begin return query select public._notify_hook(p_hook_id, true); end;
$$;

revoke all on function public._notify_hook(uuid, boolean) from public;
revoke all on function public.notify_hook_targets(uuid) from public;
revoke all on function public.poke_hook(uuid) from public;
grant execute on function public.notify_hook_targets(uuid) to authenticated;
grant execute on function public.poke_hook(uuid) to authenticated;
