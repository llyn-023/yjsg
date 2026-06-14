-- ═══ Phase 6.4 · 用户设置（通知偏好）═══
-- 在 profiles 上加 notif_prefs JSONB 列，免建新表。
-- 默认值：全部开启。
-- 应用方式：SQL Editor 手动执行。

alter table public.profiles add column if not exists notif_prefs jsonb default '{"activity":true,"mention":true,"review":true,"capsule":true,"weekly":true}'::jsonb;
