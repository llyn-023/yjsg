-- ═══ Phase 6.1 · 胶囊启封函数（真实自动启封逻辑）═══
-- open_due_capsules()：扫描 open_date <= today 且 state='sealed' 的胶囊 → 启封 + 发通知。
--   此函数可由 pg_cron 或定时 Edge Function 每日调用。
-- open_capsule_early(capsule_id)：创建者提前手动开启。
-- open_capsule_now_for_test(capsule_id)：测试用——绕过日期检查强制启封（service_role 专用）。
-- 应用方式：SQL Editor 手动执行。

-- 1. 自动启封（定时任务调用）
create or replace function public.open_due_capsules()
returns table(o_opened int)
language plpgsql security definer set search_path = public as $$
declare
  cap record;
  v_count int := 0;
  v_notif_title text;
  v_recipient_ids uuid[];
  v_recipient uuid;
begin
  for cap in
    select * from public.capsules
    where state = 'sealed' and open_date <= current_date
  loop
    -- 启封
    update public.capsules set state = 'open', updated_at = now() where id = cap.id;
    v_count := v_count + 1;

    -- §5.2：赠送给家人的胶囊开启后 → 自动转化为被赠方味道桌上已点亮的吃食
    if cap.anchor_id is not null then
      update public.anchors set status = 'lit', updated_at = now() where id = cap.anchor_id;
    end if;

    -- 收集接收者（to_members）+ 创建者本人
    v_recipient_ids := array[cap.created_by];
    if cap.to_members is not null and jsonb_array_length(cap.to_members) > 0 then
      for i in 0..jsonb_array_length(cap.to_members)-1 loop
        declare
          v_mid uuid := (cap.to_members->>i)::uuid;
          v_uid uuid;
        begin
          select m.user_id into v_uid from public.family_members m where m.id = v_mid;
          if v_uid is not null then
            v_recipient_ids := array_append(v_recipient_ids, v_uid);
          end if;
        end;
      end loop;
    end if;

    -- 给所有相关人发通知
    foreach v_recipient in array v_recipient_ids loop
      insert into public.notifications (user_id, family_id, type, title, sub, payload)
      values (v_recipient, cap.family_id, 'capsule',
        '时间胶囊「' || cap.name || '」已启封',
        '一段被封存的记忆到时间了，去看看',
        jsonb_build_object('capsule_id', cap.id, 'family_id', cap.family_id));
    end loop;
  end loop;

  return query select v_count;
end;
$$;

revoke all on function public.open_due_capsules() from public;
grant execute on function public.open_due_capsules() to authenticated;

-- 2. 手动提前开启（创建者）
create or replace function public.open_capsule_early(p_capsule_id uuid)
returns table(o_ok boolean)
language plpgsql security definer set search_path = public as $$
declare
  cap record;
  app uuid := auth.uid();
begin
  if app is null then raise exception '未登录'; end if;
  select * into cap from public.capsules where id = p_capsule_id;
  if not found then raise exception '胶囊不存在'; end if;
  if cap.created_by != app then raise exception '仅创建者可开启'; end if;
  if cap.state != 'sealed' then raise exception '该胶囊已开启'; end if;

  update public.capsules set state = 'open', updated_at = now() where id = p_capsule_id;
  if cap.anchor_id is not null then
    update public.anchors set status = 'lit', updated_at = now() where id = cap.anchor_id;
  end if;
  return query select true;
end;
$$;

revoke all on function public.open_capsule_early(uuid) from public;
grant execute on function public.open_capsule_early(uuid) to authenticated;
