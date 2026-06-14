// clean-demo.mjs — 录完一键清理演示数据
// 用法：node scripts/clean-demo.mjs
// 删除：test_demo_* 账号 + TEST_陈家味道 家族（级联成员/关系/记忆/钩子/胶囊/申请）

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^(\w+)=(.*)/); if (m) env[m[1]] = m[2].trim();
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data:{ users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
let n = 0;
for (const u of users.filter(u => /^test_demo_/.test(u.email || ''))) {
  await admin.auth.admin.deleteUser(u.id); n++; console.log('删账号', u.email);
}
await admin.from('families').delete().eq('name', 'TEST_陈家味道');
console.log(`\n✅ 已清理 ${n} 个演示账号 + TEST_陈家味道 家族`);
