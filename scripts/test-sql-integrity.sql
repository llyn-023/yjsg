-- test-sql-integrity.sql — 数据完整性 SQL 检查
-- 用法：在 Supabase SQL Editor 中运行
-- 查出问题行 = bug；0 行返回 = 通过

-- ═══════════════════════════════════════
-- 1. 孤儿数据检查
-- ═══════════════════════════════════════

-- 1.1 family_members 的 family_id 不在 families
SELECT 'orphan_members' AS check_name, COUNT(*) AS orphan_count
FROM family_members fm
LEFT JOIN families f ON f.id = fm.family_id
WHERE f.id IS NULL;

-- 1.2 family_relations 的 from_member/to_member 不在 family_members
SELECT 'orphan_relations_from' AS check_name, COUNT(*) AS orphan_count
FROM family_relations fr
LEFT JOIN family_members fm ON fm.id = fr.from_member
WHERE fm.id IS NULL;

SELECT 'orphan_relations_to' AS check_name, COUNT(*) AS orphan_count
FROM family_relations fr
LEFT JOIN family_members fm ON fm.id = fr.to_member
WHERE fm.id IS NULL;

-- 1.3 anchors 的 family_id 不在 families
SELECT 'orphan_anchors' AS check_name, COUNT(*) AS orphan_count
FROM anchors a
LEFT JOIN families f ON f.id = a.family_id
WHERE f.id IS NULL;

-- 1.4 comments 的 anchor_id 不在 anchors
SELECT 'orphan_comments' AS check_name, COUNT(*) AS orphan_count
FROM comments c
LEFT JOIN anchors a ON a.id = c.anchor_id
WHERE a.id IS NULL;

-- 1.5 hooks 的 family_id 不在 families
SELECT 'orphan_hooks' AS check_name, COUNT(*) AS orphan_count
FROM hooks h
LEFT JOIN families f ON f.id = h.family_id
WHERE f.id IS NULL;

-- 1.6 stories 的 conversation_id 不在 conversations
SELECT 'orphan_stories' AS check_name, COUNT(*) AS orphan_count
FROM stories s
LEFT JOIN conversations c ON c.id = s.conversation_id
WHERE c.id IS NULL;

-- 1.7 conversation_messages 的 conversation_id 不在 conversations
SELECT 'orphan_messages' AS check_name, COUNT(*) AS orphan_count
FROM conversation_messages cm
LEFT JOIN conversations c ON c.id = cm.conversation_id
WHERE c.id IS NULL;

-- 1.8 capsules (sealed) 含有已删除的 anchor_id
SELECT 'orphan_capsules' AS check_name, COUNT(*) AS orphan_count
FROM capsules cap
LEFT JOIN anchors a ON a.id = cap.anchor_id
WHERE cap.anchor_id IS NOT NULL AND a.id IS NULL;

-- ═══════════════════════════════════════
-- 2. 数据质量检查
-- ═══════════════════════════════════════

-- 2.1 status 枚举合法值检查
SELECT 'invalid_anchor_status' AS check_name, COUNT(*) AS bad_count
FROM anchors WHERE status NOT IN ('lit', 'gray');

SELECT 'invalid_member_status' AS check_name, COUNT(*) AS bad_count
FROM family_members WHERE status NOT IN ('claimed', 'placeholder', 'deceased');

SELECT 'invalid_capsule_state' AS check_name, COUNT(*) AS bad_count
FROM capsules WHERE state NOT IN ('sealed', 'open');

SELECT 'invalid_conv_status' AS check_name, COUNT(*) AS bad_count
FROM conversations WHERE status NOT IN ('active', 'draft', 'done');

SELECT 'invalid_join_status' AS check_name, COUNT(*) AS bad_count
FROM join_requests WHERE status NOT IN ('pending', 'approved', 'rejected');

-- 2.2 profiles 的 username 唯一性
SELECT 'dup_username' AS check_name, username, COUNT(*) AS cnt
FROM profiles GROUP BY username HAVING COUNT(*) > 1;

-- 2.3 families 的 code 唯一性
SELECT 'dup_family_code' AS check_name, code, COUNT(*) AS cnt
FROM families GROUP BY code HAVING COUNT(*) > 1;

-- 2.4 auth.users 与 profiles 一致性（profiles 有但 users 没有）
SELECT 'profiles_no_user' AS check_name, COUNT(*) AS orphan_count
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE u.id IS NULL;

-- 2.5 family_members 同一 family 下同一 user_id 出现多次
SELECT 'dup_user_in_family' AS check_name, family_id, user_id, COUNT(*) AS cnt
FROM family_members
WHERE user_id IS NOT NULL
GROUP BY family_id, user_id
HAVING COUNT(*) > 1;

-- ═══════════════════════════════════════
-- 3. 约束与索引检查
-- ═══════════════════════════════════════

-- 3.1 检查 NOT NULL 字段是否有 NULL 行
SELECT 'null_family_members_user_id' AS check_name, COUNT(*) AS cnt
FROM family_members WHERE id IS NULL;

SELECT 'null_anchors_created_by' AS check_name, COUNT(*) AS cnt
FROM anchors WHERE created_by IS NULL;

SELECT 'null_capsules_created_by' AS check_name, COUNT(*) AS cnt
FROM capsules WHERE created_by IS NULL;

-- ═══════════════════════════════════════
-- 4. RLS 启用验证
-- ═══════════════════════════════════════
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ═══════════════════════════════════════
-- 5. 索引存在性验证
-- ═══════════════════════════════════════
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%pkey%'
  AND indexname NOT LIKE '%_unique%'
ORDER BY tablename, indexname;
