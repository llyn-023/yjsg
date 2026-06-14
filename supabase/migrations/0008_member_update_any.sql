-- ═══ Phase 2.5 · fm_update 放宽：任意家族成员可编辑任意家人资料 ═══
-- 用户决定（2026-06-14）：所有人都可以编辑所有人（不再限 creator OR self）。
-- 原策略：using/with check = (creator_id=auth.uid() OR user_id=auth.uid())
-- 新策略：using/with check = is_family_member(family_id)  —— 该家族任意成员可改任意家人行。
-- 应用方式：SQL Editor 手动执行。策略无 OUT 参数，无列名歧义。

drop policy if exists "fm_update" on public.family_members;
create policy "fm_update" on public.family_members for update to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
