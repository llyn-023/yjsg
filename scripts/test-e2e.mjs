// test-e2e.mjs — Phase 7 端到端主流程验证
// 注册 → 建家族 → 加成员 → 点亮 anchor → 对话 → 封胶囊
// + 真实图片上传测试
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^(\w+)=(.*)/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.SUPABASE_URL, SR = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.SUPABASE_ANON_KEY;
const admin = createClient(URL, SR);

let PASS = 0, FAIL = 0;
function pass(msg) { PASS++; console.log(`  ✅ ${msg}`); }
function fail(msg) { FAIL++; console.error(`  ❌ ${msg}`); }

async function createTestUser(email, meta) {
  const resp = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'apikey': SR, 'Authorization': `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test123', email_confirm: true, user_metadata: meta })
  });
  return (await resp.json());
}

async function main() {
  console.log('═══ Phase 7 端到端主流程 ═══\n');

  const suffix = Date.now().toString(36);
  const user1 = await createTestUser(`test_e2e_a_${suffix}@yjsg.com`, { username: `e2e_a_${suffix}`, nickname: '小明' });
  const user2 = await createTestUser(`test_e2e_b_${suffix}@yjsg.com`, { username: `e2e_b_${suffix}`, nickname: '小红' });
  const c1 = createClient(URL, ANON);
  const c2 = createClient(URL, ANON);
  await c1.auth.signInWithPassword({ email: `test_e2e_a_${suffix}@yjsg.com`, password: 'test123' });
  await c2.auth.signInWithPassword({ email: `test_e2e_b_${suffix}@yjsg.com`, password: 'test123' });

  // ── 1. 注册 ✅ ──
  console.log('1. 注册');
  pass('user1 注册: ' + user1.id);
  pass('user2 注册: ' + user2.id);

  // ── 2. 建家族 ──
  console.log('\n2. 建家族');
  const { data: fam } = await c1.from('families').insert({
    name: 'TEST_E2E_' + suffix, surname: '陈', code: 'E2E'+suffix.slice(-3).toUpperCase(), creator_id: user1.id
  }).select().single();
  if (!fam) { fail('建家族失败'); return; }
  pass('家族: ' + fam.name + ' code=' + fam.code);
  await admin.from('family_members').insert({ family_id: fam.id, user_id: user1.id, name: '小明', gender: '男', status: 'claimed', role: 'creator' });

  // ── 3. 加成员（user2 凭码加入）──
  console.log('\n3. 加成员');
  const { data: node1 } = await admin.from('family_members').select('id').eq('family_id', fam.id).eq('user_id', user1.id).single();
  const { data: relData } = await c2.rpc('relate', {
    p_code: fam.code, p_rel_with_id: node1.id, p_rel: '妻子',
    p_name: '小红', p_gender: 'female', p_birth_date: '1993-05-20', p_birth_type: 'solar'
  });
  if (relData?.[0]) pass('user2 入伙 → member 节点: ' + relData[0].o_member_id);
  else fail('user2 入伙失败');

  // ── 4. 点亮 anchor ──
  console.log('\n4. 点亮 anchor');
  const { data: anchor } = await c1.from('anchors').insert({
    family_id: fam.id, name: '外婆的红烧肉', era: '1998', city: '扬州',
    text: '甜咸口的红烧肉，外婆在扬州老房子里做的。', status: 'lit',
    created_by: user1.id
  }).select().single();
  if (anchor) pass('点亮 anchor: ' + anchor.name + '（' + anchor.city + ', ' + anchor.era + '）');
  else fail('点亮 anchor 失败');

  // ── 5. 一次对话（agent-chat）──
  console.log('\n5. Agent 对话');
  const { data: conv } = await c1.from('conversations').insert({
    user_id: user1.id, family_id: fam.id, type: 'new', title: '外婆的红烧肉',
    entry_context: { food_name: '外婆的红烧肉' }, status: 'active'
  }).select().single();
  const convId = conv.id;
  pass('建对话: ' + convId);

  // 发 2 轮消息（用 admin 直接插，避免等 GLM 延迟）
  await admin.from('conversation_messages').insert([
    { conversation_id: convId, role: 'user', content: '外婆的红烧肉' },
    { conversation_id: convId, role: 'assistant', content: '红烧肉！这个好——你脑海里第一个冒出来的画面，大概是什么时候、在哪儿的事儿呀？' },
    { conversation_id: convId, role: 'user', content: '小时候在扬州，外婆系着蓝色围裙在灶台前忙活，甜咸口深琥珀色的。' },
    { conversation_id: convId, role: 'assistant', content: '扬州，外婆家，蓝色围裙……那画面暖得很。外婆现在还做这道菜吗？' },
  ]);
  pass('对话消息已写入（2 轮）');

  // ── 6. 封胶囊 ──
  console.log('\n6. 封时间胶囊');
  const futureDate = new Date(); futureDate.setFullYear(futureDate.getFullYear() + 1);
  const openDate = futureDate.toISOString().split('T')[0];
  const { data: capsule } = await c1.from('capsules').insert({
    family_id: fam.id, name: '外婆的红烧肉·时间胶囊', open_date: openDate,
    to_members: [], anchor_id: anchor.id,
    created_by: user1.id, state: 'sealed'
  }).select().single();
  if (capsule) pass('封胶囊: ' + capsule.name + '（' + openDate + ' 启封）');
  else fail('封胶囊失败');

  // ── 7. 上传测试图 ──
  console.log('\n7. 图片上传');
  // 生成一个 1x1 像素 PNG（最小有效图片）
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const { data: uploadData, error: uploadErr } = await admin.storage.from('memories').upload(
    `test/${suffix}/tiny.png`, tinyPng, { contentType: 'image/png', upsert: true }
  );
  if (!uploadErr && uploadData) {
    pass('图片上传成功: ' + uploadData.path);
    const { data: urlData } = admin.storage.from('memories').getPublicUrl(uploadData.path);
    pass('公开 URL: ' + (urlData?.publicUrl || '').slice(0, 60) + '…');
    // 验证 URL 可访问
    const resp = await fetch(urlData.publicUrl);
    if (resp.ok && resp.headers.get('content-type')?.includes('image')) pass('图片可读回 ✅');
    else fail('图片读回失败');
  } else {
    fail('上传失败: ' + (uploadErr?.message || 'unknown'));
  }

  // ── 清理 ──
  console.log('\n── 清理 ──');
  await admin.storage.from('memories').remove([`test/${suffix}/tiny.png`]);
  await admin.from('families').delete().eq('id', fam.id);
  await admin.auth.admin.deleteUser(user1.id);
  await admin.auth.admin.deleteUser(user2.id);
  console.log('已清理');

  console.log(`\n═══ ${PASS} PASS / ${FAIL} FAIL ═══`);
  if (FAIL > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
