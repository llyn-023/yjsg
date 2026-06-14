-- 0026_tags_check_constraint.sql
-- 修复：anchors.tags 必须为 JSON 数组，拒绝字符串等非数组值
-- 对应 P1 bug：前端 tags.map() 遇到非数组会抛 TypeError

-- 先检查是否有脏数据
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM anchors
  WHERE tags IS NOT NULL AND jsonb_typeof(tags) <> 'array';

  IF bad_count > 0 THEN
    RAISE EXCEPTION '发现 % 条 tags 非数组数据，请先手动清理后再加约束', bad_count;
  END IF;
END $$;

-- 确保现有 NULL 合法，再加速非空的数组约束
ALTER TABLE anchors
  ADD CONSTRAINT tags_is_array
  CHECK (tags IS NULL OR jsonb_typeof(tags) = 'array');
