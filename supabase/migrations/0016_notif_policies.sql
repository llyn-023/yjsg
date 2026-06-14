-- ═══ Phase 5.1 · notifications RLS 补全 ═══
-- notif_select 已有（user_id = auth.uid()），补 insert/update。

drop policy if exists "notif_insert" on public.notifications;
create policy "notif_insert" on public.notifications for insert to authenticated
  with check (user_id = auth.uid());  -- 用户只能给自己写通知（实际由服务端 RPC 绕 RLS 写入）

drop policy if exists "notif_update" on public.notifications;
create policy "notif_update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());  -- 用户只能标记自己通知的已读
