-- ═══ Phase 7.2 · 索引补全 + RLS 复核 ═══
-- 补高频查询列上的索引，优化 List/Feed/搜索性能。
-- 应用方式：SQL Editor 手动执行。

-- anchors: 按家族+状态+创建者查（最常用）
create index if not exists idx_anchors_family_status on public.anchors(family_id, status);
create index if not exists idx_anchors_family_created_by on public.anchors(family_id, created_by);

-- comments: 按锚点查
create index if not exists idx_comments_anchor_id on public.comments(anchor_id);

-- hooks: 按家族+状态查
create index if not exists idx_hooks_family_status on public.hooks(family_id, status);

-- conversations: 按用户+状态查
create index if not exists idx_conv_user_status on public.conversations(user_id, status);

-- conversation_messages: 按对话+时间查
create index if not exists idx_cmsg_conv_time on public.conversation_messages(conversation_id, created_at);

-- notifications: 按用户+已读查
create index if not exists idx_notif_user_read on public.notifications(user_id, read);

-- capsules: 按家族+状态查
create index if not exists idx_capsules_family_state on public.capsules(family_id, state);

-- stories: 按对话查
create index if not exists idx_stories_conv on public.stories(conversation_id);

-- family_members: 补充 family+user 复合索引
create index if not exists idx_fm_family_user on public.family_members(family_id, user_id);
