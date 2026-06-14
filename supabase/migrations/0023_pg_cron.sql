-- ═══ Phase 6.1 收尾 · pg_cron 每日定时（胶囊自动启封 + 前一天提醒）═══
-- 计划 6.1：「到期自动启封（pg_cron 或定时 Edge）」+ §5.4 前一天提醒。
-- 两个函数已就绪并测通：
--   public.open_due_capsules()      —— open_date <= 今天 & sealed → 启封 + 通知被赠方（§5.2/§5.4 当天）
--   public.capsule_due_reminders()  —— open_date = 明天 & sealed → 提醒赠送方（§5.4 前一天，可取消）
-- 本迁移：启用 pg_cron 扩展 + 注册两个每日任务。
--
-- ⚠️ 时区：pg_cron 后台 worker 默认 UTC。胶囊 open_date 是用户按【中国日历】选的 date，
--    故任务命令里先 `set time zone 'Asia/Shanghai'` 再调函数，使函数内 current_date = 中国当日。
--    16:00 UTC = 次日 00:00 北京时间（中国新一天的开始）：
--      · 00:00 北京：先发"明天到期"提醒（reminders）
--      · 00:10 北京：再执行当天到期启封（open）
-- cron.schedule(jobname,...) 同名会覆盖（幂等），可重复执行本迁移。
-- 应用方式：SQL Editor 手动执行（需项目已允许 pg_cron；Supabase 默认可用）。

create extension if not exists pg_cron;

-- 前一天提醒赠送方：每天 16:00 UTC（北京 00:00）
select cron.schedule(
  'capsule-reminders-daily',
  '0 16 * * *',
  $$ set time zone 'Asia/Shanghai'; select public.capsule_due_reminders(); $$
);

-- 当天到期自动启封：每天 16:10 UTC（北京 00:10，晚 10 分钟，确保跨过零点）
select cron.schedule(
  'capsule-open-daily',
  '10 16 * * *',
  $$ set time zone 'Asia/Shanghai'; select public.open_due_capsules(); $$
);

-- 查看已注册任务：select jobid, jobname, schedule, command from cron.job;
-- 取消任务：select cron.unschedule('capsule-reminders-daily');
