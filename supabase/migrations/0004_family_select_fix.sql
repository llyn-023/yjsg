-- ═══ Phase 2.2 修复 · families_select 放宽创建者可见 ═══
-- 问题：创建家族时 `insert().select()`（return=representation）插入后会回查，
-- 回查走 families_select(is_family_member)；但创建者此时还没插成员节点 →
-- is_family_member=false → 回查被拦，报 "violates row-level security policy"
-- （表面像 insert 失败，实为回查 SELECT 失败）。
-- 修复：families_select 额外允许 creator_id = auth.uid()（创建者始终能看自己建的家族）。
-- 应用方式：SQL Editor 手动执行。

drop policy if exists "families_select" on public.families;
create policy "families_select" on public.families for select to authenticated
  using (public.is_family_member(id) OR creator_id = auth.uid());
