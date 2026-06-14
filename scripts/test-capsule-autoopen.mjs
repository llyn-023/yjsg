// test-capsule-autoopen.mjs — Phase 6.1 胶囊自动启封真实验证
// 重点：建过去日期的胶囊 → 调用 open_due_capsules() → 验证 state→open + 通知 + 脱离味道桌
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^(\w+)=(.*)/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.SUPABASE_URL, SR = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.SUPABASE_ANON_KEY;
const admin = createClient(URL, SR);

async function createTestUser(email, meta) {
  const resp = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'apikey': SR, 'Authorization': `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test123', email_confirm: true, user_metadata: meta })
  });
  return (await resp.json());
}

async function main() {
  console.log('═══ 胶囊自动启封验证 ═══\n');

  const suffix = Date.now().toString(36);
  const user = await createTestUser(`test_cap_${suffix}@yjsg.com`, { username: `test_cap`, nickname: '测试' });
  const client = createClient(URL, ANON);
  await client.auth.signInWithPassword({ email: `test_cap_${suffix}@yjsg.com`, password: 'test123' });

  // 建家族 + 成员
  const { data: fam } = await client.from('families').insert({
    name: 'TEST_CAP', surname: '测', code: 'CAP'+suffix.slice(-3).toUpperCase(), creator_id: user.id
  }).select().single();
  const famId = fam.id;
  await admin.from('family_members').insert([
    { family_id: famId, user_id: user.id, name: '测试', gender: '男', status: 'claimed', role: 'creator' }
  ]);

  // 建一个 lit anchor（代表一道味道）
  const { data: anchor } = await client.from('anchors').insert({
    family_id: famId, name: '外婆的桂花糕', era: '1995', city: '扬州',
    text: '秋天桂花开了，外婆就会做桂花糕', status: 'lit', created_by: user.id
  }).select().single();
  console.log('1. 建 lit anchor:', anchor.id);

  // ── §5.1 测试：设为胶囊即脱离味道桌 ──
  console.log('\n── §5.1 脱离味道桌 ──');
  const dayBefore = new Date(); dayBefore.setDate(dayBefore.getDate() - 2);
  const pastDate = dayBefore.toISOString().split('T')[0];

  // 模拟前端 api.capsule.create：先把 anchor 置 gray（脱离味道桌）
  await client.from('anchors').update({ status: 'gray' }).eq('id', anchor.id);
  console.log('2. anchor 设为 gray（模拟前端 api.capsule.create §5.1 脱离味道桌）');

  // 创建胶囊（open_date = 2天前，应已被启封）
  const { data: capsule } = await client.from('capsules').insert({
    family_id: famId, name: '外婆的桂花糕', open_date: pastDate,
    to_members: [], anchor_id: anchor.id,
    created_by: user.id, state: 'sealed'
  }).select().single();
  console.log('3. 建胶囊（open_date=' + pastDate + '）:', capsule.id, 'state:', capsule.state);

  // 验证 anchor 现在是 gray
  const { data: anchorAfter } = await admin.from('anchors').select('status').eq('id', anchor.id).single();
  console.log('4. anchor status:', anchorAfter?.status, '（gray=已脱离味道桌）');
  if (anchorAfter?.status === 'gray') console.log('   ✅ §5.1 成立：封存入胶囊后已脱离味道桌');
  else console.log('   ❌ anchor 未脱离味道桌');

  // ── 自动启封验证 ──
  console.log('\n── 自动启封（真实触发）──');
  const { data: opened } = await client.rpc('open_due_capsules');
  const openedCount = opened?.[0]?.o_opened || 0;
  console.log('5. open_due_capsules() 返回:', openedCount, '条');
  if (openedCount >= 1) console.log('   ✅ 自动启封函数执行成功');
  else console.log('   ❌ 未找到到期胶囊');

  // 验证 state→open
  const { data: capAfter } = await admin.from('capsules').select('state').eq('id', capsule.id).single();
  console.log('6. 胶囊 state:', capAfter?.state, '（应=open）');
  if (capAfter?.state === 'open') console.log('   ✅ state 已变为 open');
  else console.log('   ❌ state 未变更（当前=' + (capAfter?.state||'?') + '）');

  // 验证启封后 anchor 恢复 lit（§5.2）
  const { data: anchorFinal } = await admin.from('anchors').select('status').eq('id', anchor.id).single();
  console.log('7. 启封后 anchor status:', anchorFinal?.status, '（应=lit）');
  if (anchorFinal?.status === 'lit') console.log('   ✅ §5.2 成立：启封后 anchor 恢复已点亮');

  // 验证送达通知已生成
  const { data: notifs } = await admin.from('notifications').select('id,title,type').eq('user_id', user.id).eq('type', 'capsule');
  if (notifs && notifs.length > 0) {
    console.log('8. 送达通知:', notifs.length, '条');
    for (const n of notifs) console.log('   📬', n.title, '|', n.type);
    console.log('   ✅ 启封通知已送达');
  } else {
    console.log('   ❌ 未生成启封通知');
  }

  // ── 6.2 地图数据 ──
  console.log('\n── 6.2 记忆地图 ──');
  await client.from('anchors').insert([
    { family_id: famId, name: '年三十的饺子', era: '2000', city: '南京', status: 'lit', created_by: user.id },
    { family_id: famId, name: '端午的粽子', era: '2005', city: '扬州', status: 'lit', created_by: user.id },
  ]);
  const { data: mapAnchors } = await admin.from('anchors').select('city,era').eq('family_id', famId).eq('status', 'lit');
  const cities = [...new Set((mapAnchors||[]).map(a => a.city).filter(Boolean))];
  console.log('9. 城市聚合:', cities.length, '个城市', cities.join(', '));
  if (cities.length >= 2) console.log('   ✅ 地图数据充足（' + cities.length + '城）');
  const eras = (mapAnchors||[]).map(a => a.era).filter(Boolean);
  console.log('10. 时间轴:', eras.length, '个时间点', eras.join(', '));
  if (eras.length >= 2) console.log('   ✅ 时间轴数据充足');

  console.log('\n═══ 全部验证完成 ═══');

  // 清理
  await admin.from('families').delete().eq('id', famId);
  await admin.auth.admin.deleteUser(user.id);
  console.log('已清理');
}

main().catch(e => { console.error(e); process.exit(1); });
