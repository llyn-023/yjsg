-- ═══ Phase 6.1 补 · 胶囊到期「前一天提醒赠送方」（§5.4）═══
-- 需要补充逻辑 §5.4：
--   到期日前一天 → 提醒【赠送方】（created_by），给予其取消开启的机会（可在胶囊页编辑/删除）。
--   到期日当天   → 提醒【被赠方】（已由 open_due_capsules 启封时发出）。
-- capsule_due_reminders()：扫描 open_date = 明天 且 state='sealed' 且 reminder_sent=false 的胶囊
--   → 给 created_by 发一条 'capsule' 通知 → 置 reminder_sent=true（避免重复提醒）。
-- 与 open_due_capsules() 一样，由 pg_cron / 定时 Edge 每日调用。
-- 应用方式：SQL Editor 手动执行。

create or replace function public.capsule_due_reminders()
returns table(o_reminded int)
language plpgsql security definer set search_path = public as $$
declare
  cap record;
  v_count int := 0;
begin
  for cap in
    select * from public.capsules
    where state = 'sealed'
      and reminder_sent = false
      and open_date = current_date + 1
  loop
    insert into public.notifications (user_id, family_id, type, title, sub, payload)
    values (cap.created_by, cap.family_id, 'capsule',
      '时间胶囊「' || cap.name || '」明天就要启封了',
      '如果还想再等等，可以在时间胶囊里调整开启日期或取消',
      jsonb_build_object('capsule_id', cap.id, 'family_id', cap.family_id, 'kind', 'due_tomorrow'));

    update public.capsules set reminder_sent = true, updated_at = now() where id = cap.id;
    v_count := v_count + 1;
  end loop;

  return query select v_count;
end;
$$;

revoke all on function public.capsule_due_reminders() from public;
grant execute on function public.capsule_due_reminders() to authenticated;
