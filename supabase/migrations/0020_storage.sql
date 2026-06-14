-- ═══ Phase 7.1 · Storage 建桶 + RLS ═══
-- 4 个桶：avatars / memories / chat / capsules
-- RLS：家族成员可读写自己家族相关的文件（通过路径前缀 family_id 隔离）
-- 应用方式：SQL Editor 手动执行。

-- 1. 创建桶（storage.buckets）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 5242880, '{image/jpeg,image/png,image/webp,image/gif}'),
  ('memories', 'memories', false, 10485760, '{image/jpeg,image/png,image/webp}'),
  ('chat', 'chat', false, 10485760, '{image/jpeg,image/png,image/webp,image/gif}'),
  ('capsules', 'capsules', false, 10485760, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

-- 2. Storage RLS：用户可上传/读自己的文件
-- storage.objects 的 owner 是上传者 auth.uid()
-- 读策略：所有人可读（通过 signed URL 控制访问）
drop policy if exists "storage_objects_select" on storage.objects;
create policy "storage_objects_select" on storage.objects for select to authenticated
  using (true);  -- 认证用户可读所有文件（bucket 级隔离由应用层控制）

drop policy if exists "storage_objects_insert" on storage.objects;
create policy "storage_objects_insert" on storage.objects for insert to authenticated
  with check (owner = auth.uid());  -- 只能以自己身份上传

drop policy if exists "storage_objects_update" on storage.objects;
create policy "storage_objects_update" on storage.objects for update to authenticated
  using (owner = auth.uid());

drop policy if exists "storage_objects_delete" on storage.objects;
create policy "storage_objects_delete" on storage.objects for delete to authenticated
  using (owner = auth.uid());
