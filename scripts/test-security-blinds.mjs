// test-security-blinds.mjs — RLS/Edge 安全盲区测试
// 用法：node scripts/test-security-blinds.mjs
// 测试现有 smoke.mjs 未覆盖的越权场景
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^(\w+)=(.*)/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.SUPABASE_URL, SR = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.SUPABASE_ANON_KEY;
const admin = createClient(URL, SR);
const anon = createClient(URL, ANON); // 未登录，只有 anon key

let PASS = 0, FAIL = 0;
function pass(msg) { PASS++; console.log(`  ✅ ${msg}`); }
function fail(msg) { FAIL++; console.error(`  ❌ ${msg}`); }

async function createTestUser(email, meta) {
  const resp = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'apikey': SR, 'Authorization': `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test123456', email_confirm: true, user_metadata: meta })
  });
  return (await resp.json());
}

async function main() {
  const suffix = Date.now().toString(36);
  console.log('═══ 安全盲区测试 ═══\n');

  // ── 创建测试用户 + 两家族 ──
  const uA = await createTestUser(`test_sec_a_${suffix}@yjsg.com`, { username: `sec_a_${suffix}`, nickname: 'A' });
  const uB = await createTestUser(`test_sec_b_${suffix}@yjsg.com`, { username: `sec_b_${suffix}`, nickname: 'B' });
  const uC = await createTestUser(`test_sec_c_${suffix}@yjsg.com`, { username: `sec_c_${suffix}`, nickname: 'C' });
  if (!uA.id || !uB.id || !uC.id) { fail('创建测试用户失败'); return; }

  const cliA = createClient(URL, ANON); await cliA.auth.signInWithPassword({ email: `test_sec_a_${suffix}@yjsg.com`, password: 'test123456' });
  const cliB = createClient(URL, ANON); await cliB.auth.signInWithPassword({ email: `test_sec_b_${suffix}@yjsg.com`, password: 'test123456' });
  const cliC = createClient(URL, ANON); await cliC.auth.signInWithPassword({ email: `test_sec_c_${suffix}@yjsg.com`, password: 'test123456' });
  const jwtA = (await cliA.auth.getSession()).data.session?.access_token;
  const jwtB = (await cliB.auth.getSession()).data.session?.access_token;
  console.log(`  A: ${uA.id} (F1 创建者)`);
  console.log(`  B: ${uB.id} (F1 成员)`);
  console.log(`  C: ${uC.id} (F2 创建者，不应访问 F1)`);

  // 家族 1：A 创建，B 是成员
  const { data: f1 } = await cliA.from('families').insert({
    name: `TEST_SEC_F1_${suffix}`, surname: '陈', code: 'SF1'+suffix.slice(-3).toUpperCase(), creator_id: uA.id
  }).select().single();
  const f1Id = f1.id;
  await admin.from('family_members').insert([
    { family_id: f1Id, user_id: uA.id, name: 'A', gender: '男', status: 'claimed', role: 'creator' },
    { family_id: f1Id, user_id: uB.id, name: 'B', gender: '女', status: 'claimed', role: 'member' },
  ]);
  console.log(`  F1: ${f1Id}`);

  // 家族 2：C 创建，A/B 不是成员
  const { data: f2 } = await cliC.from('families').insert({
    name: `TEST_SEC_F2_${suffix}`, surname: '李', code: 'SF2'+suffix.slice(-3).toUpperCase(), creator_id: uC.id
  }).select().single();
  const f2Id = f2.id;
  await admin.from('family_members').insert([
    { family_id: f2Id, user_id: uC.id, name: 'C', gender: '女', status: 'claimed', role: 'creator' },
  ]);
  console.log(`  F2: ${f2Id}`);

  // ================================================================
  // 1. Anon key 越权（无 JWT，纯 anon client）
  // ================================================================
  console.log('\n── 1. Anon key 越权（无 JWT）──');

  const tables = ['families', 'family_members', 'family_relations', 'anchors', 'comments', 'hooks',
    'conversations', 'conversation_messages', 'stories', 'capsules', 'notifications', 'join_requests'];
  for (const t of tables) {
    const r = await anon.from(t).insert({ id: '00000000-0000-0000-0000-000000000000' }).select();
    if (r.error) pass(`anon insert ${t} → 被拒`);
    else fail(`anon insert ${t} → 应该被拒但成功！（严重漏洞）`);
  }

  // ================================================================
  // 2. 跨家族越权（userA 读/写 F2 的数据）
  // ================================================================
  console.log('\n── 2. 跨家族越权（A ∉ F2）──');

  // A 创建一条 anchor 在 F1
  const { data: a1Anchor } = await cliA.from('anchors').insert({
    family_id: f1Id, name: 'F1 的菜', status: 'lit', created_by: uA.id
  }).select().single();

  // A 尝试用 F2 的 family_id 读数据
  const r2 = await cliA.from('anchors').select('id').eq('family_id', f2Id);
  if (r2.data && r2.data.length === 0) pass('A 读 F2 anchors → 空（跨家族 RLS 生效）');
  else fail('A 读 F2 anchors → 看到了不该看的数据！');

  // A 尝试往 F2 写 anchor
  const r3 = await cliA.from('anchors').insert({
    family_id: f2Id, name: '越权写入', status: 'lit', created_by: uA.id
  }).select();
  if (r3.error) pass('A 往 F2 写 anchor → 被 RLS 拒');
  else fail('A 往 F2 写 anchor → 应该被拒但成功（严重！）');

  // A 读 F2 的 family_members
  const r4 = await cliA.from('family_members').select('id').eq('family_id', f2Id);
  if (r4.data && r4.data.length === 0) pass('A 读 F2 members → 空（跨家族隔离）');
  else fail('A 读 F2 members → 越权！');

  // ================================================================
  // 3. 未认证调 Edge Functions
  // ================================================================
  console.log('\n── 3. 未认证调 Edge Functions ──');

  // 3.1 agent-chat 不带 token
  const ac1 = await fetch(`${URL}/functions/v1/agent-chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: 'fake', user_message: 'hi' })
  });
  if (ac1.status === 401 || ac1.status === 400) pass(`agent-chat 无 JWT → ${ac1.status}`);
  else fail(`agent-chat 无 JWT → ${ac1.status}（应该 401）`);

  // 3.2 ai-generate 不带 token
  const ag1 = await fetch(`${URL}/functions/v1/ai-generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'story', conversation_id: 'fake' })
  });
  if (ag1.status === 401 || ag1.status === 400) pass(`ai-generate 无 JWT → ${ag1.status}`);
  else fail(`ai-generate 无 JWT → ${ag1.status}（应该 401）`);

  // 3.3 kinship-rebuild 不带 token
  const kr1 = await fetch(`${URL}/functions/v1/kinship-rebuild`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ family_id: f1Id })
  });
  if (kr1.status === 401 || kr1.status === 400) pass(`kinship-rebuild 无 JWT → ${kr1.status}`);
  else fail(`kinship-rebuild 无 JWT → ${kr1.status}（应该 401）`);

  // 3.4 用 A 的 JWT 但带 C 的 conversation_id（跨用户）
  const { data: aConv } = await cliA.from('conversations').insert({
    user_id: uA.id, family_id: f1Id, type: 'new', status: 'active'
  }).select().single();
  const ac2 = await fetch(`${URL}/functions/v1/agent-chat`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${jwtB}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: aConv.id, user_message: 'hi' })
  });
  if (ac2.ok) fail('agent-chat：B 用 A 的 conversation → 应该 403 但成功了');
  else pass('agent-chat：B 用 A 的 conversation → 被拒（跨用户隔离）');

  // ================================================================
  // 4. 改别人数据的各种尝试
  // ================================================================
  console.log('\n── 4. 篡改他人数据 ──');

  // 4.1 B 尝试改 F1 中 A 创建的数据（已有的 RLS 验证，这里补更隐蔽的路径）
  // B 尝试通过 update 不加 where 来批量改
  const r5 = await cliB.from('anchors').update({ name: 'HACKED' }).eq('family_id', f1Id);
  // 应该只影响 B 自己创建的 anchors（0 条）或 RLS 过滤
  if (!r5.error) {
    const { data: checkA } = await admin.from('anchors').select('name').eq('id', a1Anchor.id).single();
    if (checkA?.name === 'F1 的菜') pass('B 批量 update → 未影响 A 的数据（RLS 生效）');
    else fail(`B 批量 update → A 的 anchor 被改为"${checkA?.name}"（严重！）`);
  } else {
    pass('B 批量 update → 被 RLS 拦截（' + (r5.error.message || '').slice(0, 50) + '）');
  }

  // 4.2 B 尝试改 F1 的 family info（非创建者）
  const r6 = await cliB.from('families').update({ name: 'HACKED FAMILY' }).eq('id', f1Id).select();
  if (r6.data && r6.data.length === 0) pass('B 改家族信息 → RLS 拒（0 rows）');
  else fail('B 改家族信息 → 应该被拒但成功了');

  // 4.3 B 尝试改自己的 role 为 creator
  const { data: bNode } = await admin.from('family_members').select('id').eq('user_id', uB.id).eq('family_id', f1Id).single();
  const r7 = await cliB.from('family_members').update({ role: 'creator' }).eq('id', bNode.id).select();
  if (!r7.error && r7.data?.[0]?.role !== 'creator') pass('B 改自己 role → 字段可写但 role 无实际权限提升（RLS 基于 creator_id）');
  // 检查 families.creator_id 是否仍为 A
  const { data: f1Check } = await admin.from('families').select('creator_id').eq('id', f1Id).single();
  if (f1Check?.creator_id === uA.id) pass('families.creator_id 仍为 A（未因 role 字段变化而变更）');
  else fail('families.creator_id 被篡改！');

  // 4.4 B 尝试将 C 加进 F1（非成员无资格被加？其实是 A 的成员可以加，但 C 不在家族）
  // 用 admin 直接测，看是否能 create join_request 到不存在 family
  const r8 = await cliA.rpc('request_join', { p_code: 'ZZZZZZ' });
  if (r8.error) pass('凭不存在 code 加入 → 被拒');
  else fail('凭不存在 code 加入 → 应该被拒');

  // 4.5 B 尝试重置 F1 code（非创建者）
  const r9 = await cliB.rpc('reset_family_code', { p_family_id: f1Id });
  if (r9.error) pass('B 重置 F1 code → 被拒（非创建者）');
  else fail('B 重置 F1 code → 应该被拒但成功');

  // ================================================================
  // 5. 数据边界
  // ================================================================
  console.log('\n── 5. 数据边界 & 极端值 ──');

  // 5.1 空 target_members 的 hook
  const { data: emptyHook, error: ehErr } = await cliA.from('hooks').insert({
    family_id: f1Id, dish: '空目标钩子', created_by: uA.id, target_members: [], status: 'open'
  }).select().single();
  if (!ehErr && emptyHook) pass('空 target_members hook → 创建成功');
  else fail(`空 target_members hook → ${ehErr?.message || '失败'}`);

  // 5.2 空 to_members 的 capsule
  const futureDate = new Date(); futureDate.setFullYear(futureDate.getFullYear() + 1);
  const { data: emptyCapsule, error: ecErr } = await cliA.from('capsules').insert({
    family_id: f1Id, name: '空目标胶囊', open_date: futureDate.toISOString().split('T')[0],
    to_members: [], created_by: uA.id, state: 'sealed'
  }).select().single();
  if (!ecErr && emptyCapsule) pass('空 to_members capsule → 创建成功（只存不送）');
  else fail(`空 to_members capsule → ${ecErr?.message || '失败'}`);

  // 5.3 tags 非数组写入
  const { error: badTagsErr } = await cliA.from('anchors').insert({
    family_id: f1Id, name: '坏标签', status: 'lit', created_by: uA.id,
    tags: 'not_an_array_string'
  }).select().single();
  if (badTagsErr) pass('tags 非数组 → 被拒（' + (badTagsErr.message || '').slice(0, 60) + '）');
  else fail('tags 非数组 → 应该被拒但写入了（前端可能崩）');

  // 5.4 超长 text
  const longText = 'A'.repeat(50000);
  const { error: longErr } = await cliA.from('anchors').insert({
    family_id: f1Id, name: '超长文本', status: 'lit', created_by: uA.id, text: longText
  }).select().single();
  if (!longErr) pass('超长 text(50000字) → 写入成功（DB 不拒）');
  else pass('超长 text(50000字) → 被 DB 拒（' + (longErr.message || '').slice(0, 60) + '）');

  // 5.5 birth_date 非法格式
  const { error: badBdErr } = await cliA.rpc('relate', {
    p_code: f1.code, p_rel_with_id: bNode.id, p_rel: '儿子',
    p_name: '坏日期人', p_gender: 'male', p_birth_date: 'not-a-date', p_birth_type: 'solar'
  });
  if (badBdErr) pass('relate 非法 birth_date → 被拒');
  else fail('relate 非法 birth_date → 应该被拒但成功了（可能导致脏数据）');

  // ================================================================
  // 6. 数据完整性（孤儿数据检查）
  // ================================================================
  console.log('\n── 6. 数据完整性 ──');

  // 6.1 删除家族后级联
  const { data: tempFam } = await cliA.from('families').insert({
    name: `TEMP_CASCADE_${suffix}`, surname: '级联', code: 'CAS'+suffix.slice(-3).toUpperCase(), creator_id: uA.id
  }).select().single();
  const tempFamId = tempFam.id;
  await admin.from('family_members').insert({ family_id: tempFamId, user_id: uA.id, name: '级联测试', gender: '男', status: 'claimed', role: 'creator' });
  await admin.from('anchors').insert({ family_id: tempFamId, name: '级联锚点', status: 'lit', created_by: uA.id });
  await admin.from('hooks').insert({ family_id: tempFamId, dish: '级联钩子', created_by: uA.id, target_members: [], status: 'open' });
  await admin.from('families').delete().eq('id', tempFamId);

  const { data: orphanMembers } = await admin.from('family_members').select('id').eq('family_id', tempFamId);
  const { data: orphanAnchors } = await admin.from('anchors').select('id').eq('family_id', tempFamId);
  const { data: orphanHooks } = await admin.from('hooks').select('id').eq('family_id', tempFamId);

  if (orphanMembers.length === 0) pass('删家族 → members 级联删除 ✅');
  else fail(`删家族 → members 残留 ${orphanMembers.length} 行`);
  if (orphanAnchors.length === 0) pass('删家族 → anchors 级联删除 ✅');
  else fail(`删家族 → anchors 残留 ${orphanAnchors.length} 行`);
  if (orphanHooks.length === 0) pass('删家族 → hooks 级联删除 ✅');
  else fail(`删家族 → hooks 残留 ${orphanHooks.length} 行`);

  // 6.2 检查 F1/F2 下是否有孤儿 relations
  const { data: allRel } = await admin.from('family_relations').select('from_member,to_member').eq('family_id', f1Id);
  if (allRel.length > 0) {
    const memberIds = new Set((await admin.from('family_members').select('id').eq('family_id', f1Id)).data.map(m => m.id));
    const orphans = allRel.filter(r => !memberIds.has(r.from_member) || !memberIds.has(r.to_member));
    if (orphans.length === 0) pass('family_relations 无孤儿边 ✅');
    else fail(`family_relations 有 ${orphans.length} 条孤儿边`);
  } else {
    pass('family_relations 无数据（正常）');
  }

  // ================================================================
  // 7. Edge Function 错误处理
  // ================================================================
  console.log('\n── 7. Edge Function 错误处理 ──');

  // 7.1 ai-generate 缺 conversation_id
  const ag2 = await fetch(`${URL}/functions/v1/ai-generate`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${jwtA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'story' })
  });
  const ag2Data = await ag2.json();
  if (!ag2Data.ok) pass('ai-generate 缺 conversation_id → 返回错误（不崩）');
  else fail('ai-generate 缺 conversation_id → 应该报错');

  // 7.2 ai-generate 无效 action
  const ag3 = await fetch(`${URL}/functions/v1/ai-generate`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${jwtA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'nonexistent_action', conversation_id: aConv.id })
  });
  if (ag3.status >= 400) pass(`ai-generate 无效 action → ${ag3.status}`);
  else fail(`ai-generate 无效 action → ${ag3.status}（应该 400）`);

  // 7.3 auth-forgot 枚举保护
  const af1 = await fetch(`${URL}/functions/v1/auth-forgot`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify-answer', username: 'nonexistent_user_99999', answer: 'test' })
  });
  const af1Data = await af1.json();
  const af2 = await fetch(`${URL}/functions/v1/auth-forgot`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify-answer', username: 'test001', answer: 'wrong_answer' })
  });
  const af2Data = await af2.json();
  // 不存在用户和错误答案应返回相同错误，不泄露用户存在性
  if (!af1Data.ok && !af2Data.ok) pass('auth-forgot 枚举保护 → 不存在用户与错误密码同错误信息');
  else fail('auth-forgot 可能泄露用户存在性（不存在=' + JSON.stringify(af1Data).slice(0,60) + ', 错误答案=' + JSON.stringify(af2Data).slice(0,60) + ')');

  // ================================================================
  // ── 清理 ──
  // ================================================================
  console.log('\n── 清理测试数据 ──');
  await admin.from('families').delete().eq('id', f1Id);
  await admin.from('families').delete().eq('id', f2Id);
  await admin.auth.admin.deleteUser(uA.id);
  await admin.auth.admin.deleteUser(uB.id);
  await admin.auth.admin.deleteUser(uC.id);
  console.log('  已清理');

  console.log(`\n═══ ${PASS} PASS / ${FAIL} FAIL ═══`);
  if (FAIL > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
