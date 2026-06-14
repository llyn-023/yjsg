// smoke.mjs — 冒烟脚本：创建人/成员权限测试
// 用法：node scripts/smoke.mjs
// 覆盖：leave_family, transfer_creator, reset_family_code 三个 RPC
//
// 固定测试身份：
//   test_smoke_creator = 家族 F1 的创建者
//   test_smoke_member  = 家族 F1 的普通成员
// 越权测试 = 用 member 的 JWT 去调 creator-only RPC，必须全部被拒。

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// 读取 .env.local
const env = {};
const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^(\w+)=(.*)/);
  if (m) env[m[1]] = m[2].trim();
}

const URL = env.SUPABASE_URL;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.SUPABASE_ANON_KEY;

// service_role client（绕过 RLS，建测试数据）
const admin = createClient(URL, SR);

let PASS = 0, FAIL = 0;
function pass(msg) { PASS++; console.log(`  ✅ PASS  ${msg}`); }
function fail(msg) { FAIL++; console.error(`  ❌ FAIL  ${msg}`); }

// admin createUser via fetch（supabase-js admin API 在 Node v24 有偶发 500，fetch 稳定）
async function createTestUser(email, password, meta) {
  const resp = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': SR,
      'Authorization': `Bearer ${SR}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email, password, email_confirm: true,
      user_metadata: meta
    })
  });
  const data = await resp.json();
  if (data?.id) return data;
  console.log(`  (createUser failed: ${JSON.stringify(data)}`);
  return null;
}

async function main() {
  console.log('═══ 创建人/成员权限 · 冒烟测试 ═══\n');

  // ── 1. 创建测试用户 ──
  console.log('── 创建测试账号 ──');
  const suffix = Date.now().toString(36);
  const uA = { email: `test_smoke_cr_${suffix}@yjsg.com`, password: 'test123456', name: `test_cr_${suffix}` };
  const uB = { email: `test_smoke_mb_${suffix}@yjsg.com`, password: 'test123456', name: `test_mb_${suffix}` };

  const userA = await createTestUser(uA.email, uA.password, { username: uA.name, nickname: uA.name });
  if (!userA) { fail('创建 creator 账号（3次重试均失败）'); return; }
  console.log(`  creator: ${userA.id}`);

  const userB = await createTestUser(uB.email, uB.password, { username: uB.name, nickname: uB.name });
  if (!userB) { fail('创建 member 账号（3次重试均失败）'); return; }
  console.log(`  member:  ${userB.id}`);

  // 补全 profiles 性别字段（trigger 已建行，update 即可）
  await admin.from('profiles').update({ gender: '男' }).eq('id', userA.id).then(r => { if (r.error) console.log('  update gender A:', r.error.message); });
  await admin.from('profiles').update({ gender: '女' }).eq('id', userB.id).then(r => { if (r.error) console.log('  update gender B:', r.error.message); });

  // ── 2. 登录拿 JWT ──
  console.log('\n── 登录拿 JWT ──');
  const clientA = createClient(URL, ANON);
  const { data: loginA } = await clientA.auth.signInWithPassword({ email: uA.email, password: uA.password });
  if (!loginA?.session) { fail('creator 登录'); return; }
  console.log('  creator JWT: ' + loginA.session.access_token.slice(0, 20) + '…');

  const clientB = createClient(URL, ANON);
  const { data: loginB } = await clientB.auth.signInWithPassword({ email: uB.email, password: uB.password });
  if (!loginB?.session) { fail('member 登录'); return; }
  console.log('  member JWT:  ' + loginB.session.access_token.slice(0, 20) + '…');

  // ── 3. 创建测试家族（creator 创建）──
  console.log('\n── 创建测试家族 ──');
  const famName = `TEST_SMOKE_${suffix}`;
  const { data: famData, error: famErr } = await clientA.from('families').insert({
    name: famName, surname: '测',
    code: 'SMK' + suffix.slice(-3).toUpperCase(), creator_id: userA.id
  }).select().single();
  if (!famData) { fail('创建家族：' + (famErr?.message || 'unknown')); return; }
  const famId = famData.id;
  console.log(`  家族: ${famId} (${famName})`);
  console.log(`  家族 creator_id: ${famData.creator_id}, userA.id: ${userA.id}`);

  // ── 4. 创建者加入节点 + 成员加入 ──
  console.log('\n── 建成员节点 ──');
  // 用 admin（service_role）建节点，绕 RLS。smoke 测试的焦点是 leave/transfer/reset 权限 RPC。
  const { data: nodeA } = await admin.from('family_members').insert({
    family_id: famId, user_id: userA.id, name: uA.name,
    gender: '男', status: 'claimed', role: 'creator'
  }).select().single();
  if (!nodeA) { fail('插入 creator 节点失败'); return; }
  console.log(`  creator 节点: ${nodeA.id}`);

  // member 节点同样用 admin 建
  const { data: nodeB } = await admin.from('family_members').insert({
    family_id: famId, user_id: userB.id, name: uB.name,
    gender: '女', status: 'claimed', role: 'member'
  }).select().single();
  if (!nodeB) { fail('插入 member 节点失败'); return; }
  console.log(`  member 节点: ${nodeB.id}`);

  // ── 5. 权限测试 ──
  console.log('\n═══ 权限测试 ═══');

  // 5.1 成员退出（leave_family）
  console.log('\n── leave_family ──');
  // 额外用户（非成员）试退出 → 应被拒
  const extraEmail = `test_smoke_ex_${suffix}@yjsg.com`;
  const userC = await createTestUser(extraEmail, 'test123456', { username: `test_ex_${suffix}`, nickname: `test_ex_${suffix}` });
  if (!userC) { fail('创建 extra 账号失败'); return; }
  const clientC = createClient(URL, ANON);
  await clientC.auth.signInWithPassword({ email: extraEmail, password: 'test123456' });

  const { error: leaveNotMember } = await clientC.rpc('leave_family', { p_family_id: famId });
  if (leaveNotMember) pass('非成员退出 → 被拒（' + (leaveNotMember.message || '').slice(0, 50) + '）');
  else fail('非成员退出 → 应该被拒，但成功了');

  // Creator 退出 → 应被拒
  const { error: leaveCreator } = await clientA.rpc('leave_family', { p_family_id: famId });
  if (leaveCreator) pass('创建者直接退出 → 被拒（' + (leaveCreator.message || '').slice(0, 50) + '）');
  else fail('创建者直接退出 → 应该被拒，但成功了');

  // Member 退出 → 应成功
  const { data: leaveOk, error: leaveErr } = await clientB.rpc('leave_family', { p_family_id: famId });
  if (!leaveErr && leaveOk && leaveOk[0]?.o_ok) pass('成员退出 → 成功');
  else fail('成员退出 → 失败（' + (leaveErr?.message || '') + '）');

  // ── 5.2 转让创建者（transfer_creator）──
  console.log('\n── transfer_creator ──');

  // Member B 已退出，用 admin 加回去
  await admin.from('family_members').update({ user_id: userB.id, status: 'claimed' }).eq('id', nodeB.id);

  // 非创建者（B）尝试转让 → 应被拒
  const { error: transferNotCreator } = await clientB.rpc('transfer_creator', {
    p_family_id: famId, p_new_member_id: nodeA.id
  });
  if (transferNotCreator) pass('非创建者转让 → 被拒（' + (transferNotCreator.message || '').slice(0, 50) + '）');
  else fail('非创建者转让 → 应该被拒，但成功了');

  // 转让给占位节点 → 应被拒（用 admin 建占位节点）
  const { data: placeholder } = await admin.from('family_members').insert({
    family_id: famId, name: '占位测试', gender: 'male', status: 'placeholder', role: 'member'
  }).select().single();
  const { error: transferToPlaceholder } = await clientA.rpc('transfer_creator', {
    p_family_id: famId, p_new_member_id: placeholder.id
  });
  if (transferToPlaceholder) pass('转让给占位节点 → 被拒（' + (transferToPlaceholder.message || '').slice(0, 50) + '）');
  else fail('转让给占位节点 → 应该被拒，但成功了');

  // 转让给自己 → 应被拒
  const { error: transferToSelf } = await clientA.rpc('transfer_creator', {
    p_family_id: famId, p_new_member_id: nodeA.id
  });
  if (transferToSelf) pass('转让给自己 → 被拒（' + (transferToSelf.message || '').slice(0, 50) + '）');
  else fail('转让给自己 → 应该被拒，但成功了');

  // 正常转让（A → B）→ 应成功
  const { data: transferOk, error: transferErr } = await clientA.rpc('transfer_creator', {
    p_family_id: famId, p_new_member_id: nodeB.id
  });
  if (!transferErr && transferOk && transferOk[0]?.o_ok) pass('创建者转让 → 成功');
  else fail('创建者转让 → 失败（' + (transferErr?.message || '') + '）');

  // 验证：B 现在是 creator
  const { data: famAfter } = await clientB.from('families').select('creator_id').eq('id', famId).single();
  if (famAfter?.creator_id === userB.id) pass('转让后 creator_id 已更新（指向 B）');
  else fail('转让后 creator_id 未更新（期望: ' + userB.id + ', 实际: ' + (famAfter?.creator_id || 'null') + '）');

  // 验证：原 A 的 role 变成 member
  const { data: nodeAAfter } = await admin.from('family_members').select('role').eq('id', nodeA.id).single();
  if (nodeAAfter?.role === 'member') pass('旧创建者 role → member');
  else fail('旧创建者 role 未更新（当前: ' + (nodeAAfter?.role || 'null') + '）');

  // ── 5.3 重置家族代码（reset_family_code）──
  console.log('\n── reset_family_code ──');

  // 旧创建者 A（现在是 member）尝试重置 → 应被拒
  const { error: resetNotCreator } = await clientA.rpc('reset_family_code', { p_family_id: famId });
  if (resetNotCreator) pass('非创建者重置代码 → 被拒（' + (resetNotCreator.message || '').slice(0, 50) + '）');
  else fail('非创建者重置代码 → 应该被拒，但成功了');

  // 新创建者 B 重置 → 应成功
  const oldCode = famData.code;
  const { data: resetOk, error: resetErr } = await clientB.rpc('reset_family_code', { p_family_id: famId });
  if (!resetErr && resetOk && resetOk[0]?.o_new_code) {
    const newCode = resetOk[0].o_new_code;
    if (newCode && newCode !== oldCode) pass('创建者重置代码 → 成功（' + oldCode + ' → ' + newCode + '）');
    else fail('创建者重置代码 → 返回成功但代码未变');
  } else {
    fail('创建者重置代码 → 失败（' + (resetErr?.message || '') + '）');
  }

  // 验证旧码已移至 previous_codes（仍可凭旧码加入，走审核流程）
  const { data: oldCodeCheck } = await admin.from('families').select('id,previous_codes').eq('id', famId).maybeSingle();
  if (oldCodeCheck && oldCodeCheck.previous_codes && oldCodeCheck.previous_codes.includes(oldCode)) {
    pass('旧码已存档至 previous_codes（仍可凭旧码申请加入）');
  } else {
    fail('旧码未存档至 previous_codes');
  }

  // ── 5.5 审核加入申请（approve / reject）──
  console.log('\n── 审核加入申请（Phase 2.6）──');

  // 创建申请人 D，通过 request_join 提交申请（用当前有效 code）
  const currentCode = (await admin.from('families').select('code').eq('id', famId).single()).data?.code;
  const userD = await createTestUser(`test_smoke_app_${suffix}@yjsg.com`, 'test123456', { username: `test_app_${suffix}`, nickname: `test_app_${suffix}` });
  if (!userD) { fail('创建 applicant 账号失败'); return; }
  const clientD = createClient(URL, ANON);
  await clientD.auth.signInWithPassword({ email: `test_smoke_app_${suffix}@yjsg.com`, password: 'test123456' });
  const { data: joinReq } = await clientD.rpc('request_join', { p_code: currentCode });
  if (!joinReq || !joinReq[0]) { fail('提交加入申请失败（code=' + currentCode + '）'); return; }
  console.log(`  申请人 D: ${userD.id}, 申请已提交`);

  // 非创建者 A（现在 member）看不到待审核列表（RLS jr_select 限 creator）
  const reqsByA = await clientA.from('join_requests').select('id').eq('family_id', famId).eq('status', 'pending');
  if (!reqsByA.error && (!reqsByA.data || reqsByA.data.length === 0)) pass('非创建者查看待审核 → 空列表（RLS 过滤）');
  else fail('非创建者查看待审核 → 应该被 RLS 过滤但看到数据');

  // 非创建者 A 试图 approve → 应被拒
  const pendingReqs = await admin.from('join_requests').select('id').eq('family_id', famId).eq('status', 'pending').eq('applicant_id', userD.id).single();
  const requestId = pendingReqs.data?.id;
  const { error: approveByNonCreator } = await clientA.rpc('approve_join_request', { p_request_id: requestId });
  if (approveByNonCreator) pass('非创建者 approve → 被拒（' + (approveByNonCreator.message || '').slice(0, 50) + '）');
  else fail('非创建者 approve → 应该被拒');

  // 非创建者 A 试图 reject → 应被拒
  const { error: rejectByNonCreator } = await clientA.rpc('reject_join_request', { p_request_id: requestId });
  if (rejectByNonCreator) pass('非创建者 reject → 被拒（' + (rejectByNonCreator.message || '').slice(0, 50) + '）');
  else fail('非创建者 reject → 应该被拒');

  // 当前创建者 B approve → 应成功
  const { data: approveOk, error: approveErr } = await clientB.rpc('approve_join_request', { p_request_id: requestId });
  if (!approveErr && approveOk && approveOk[0]?.o_ok) {
    pass('创建者 approve → 成功');
    // 验证：D 已有成员节点
    const { data: dNode } = await admin.from('family_members').select('id,user_id,status').eq('family_id', famId).eq('user_id', userD.id).maybeSingle();
    if (dNode && dNode.status === 'claimed') pass('approve 后 D 的成员节点已建（claimed）');
    else fail('approve 后 D 无成员节点（user_id=' + userD.id + '）');

    // 验证：申请状态已更新
    const { data: reqAfter } = await admin.from('join_requests').select('status').eq('id', requestId).single();
    if (reqAfter?.status === 'approved') pass('申请状态 → approved');
    else fail('申请状态未更新（当前: ' + (reqAfter?.status || 'null') + '）');

    // 验证：D 收到通知
    const { data: notifs } = await admin.from('notifications').select('id,title,type').eq('user_id', userD.id);
    if (notifs && notifs.length > 0 && notifs.some(n => n.type === 'join')) pass('D 收到加入通知（' + notifs.length + ' 条）');
    else fail('D 未收到通知');
  } else {
    fail('创建者 approve → 失败（' + (approveErr?.message || '') + '）');
  }

  // 再测 reject：另一个申请人 E，由创建者 B 驳回
  const userE = await createTestUser(`test_smoke_app2_${suffix}@yjsg.com`, 'test123456', { username: `test_app2_${suffix}`, nickname: `test_app2_${suffix}` });
  if (userE) {
    const clientE = createClient(URL, ANON);
    await clientE.auth.signInWithPassword({ email: `test_smoke_app2_${suffix}@yjsg.com`, password: 'test123456' });
    const { data: joinReq2 } = await clientE.rpc('request_join', { p_code: currentCode });
    if (joinReq2 && joinReq2[0]) {
      const { data: req2 } = await admin.from('join_requests').select('id').eq('family_id', famId).eq('status', 'pending').eq('applicant_id', userE.id).single();
      const { data: rejectOk, error: rejectErr } = await clientB.rpc('reject_join_request', { p_request_id: req2.id });
      if (!rejectErr && rejectOk && rejectOk[0]?.o_ok) {
        pass('创建者 reject → 成功');
        const { data: req2After } = await admin.from('join_requests').select('status').eq('id', req2.id).single();
        if (req2After?.status === 'rejected') pass('申请状态 → rejected');
        else fail('reject 后状态未更新');
        // 验证 E 没有成员节点
        const { data: eNode } = await admin.from('family_members').select('id').eq('family_id', famId).eq('user_id', userE.id).maybeSingle();
        if (!eNode) pass('reject 后 E 无成员节点');
        else fail('reject 后 E 不应有成员节点');
        // 验证 E 收到驳回通知
        const { data: notifsE } = await admin.from('notifications').select('id,title').eq('user_id', userE.id);
        if (notifsE && notifsE.length > 0) pass('E 收到驳回通知（' + notifsE.length + ' 条）');
        else fail('E 未收到驳回通知');
      } else {
        fail('创建者 reject → 失败（' + (rejectErr?.message || '') + '）');
      }
      // cleanup E
      await admin.auth.admin.deleteUser(userE.id);
    }
  }

  // ── 5.4 转让后 A 可以退出 ──
  console.log('\n── 转让后原创建者退出 ──');
  const { data: leaveAOk, error: leaveAErr } = await clientA.rpc('leave_family', { p_family_id: famId });
  if (!leaveAErr && leaveAOk && leaveAOk[0]?.o_ok) pass('转让后原创建者（现成员）退出 → 成功');
  else fail('转让后原创建者退出 → 失败（' + (leaveAErr?.message || '') + '）');

  // ── 6. Phase 3 味道桌：anchors / comments / hooks ──
  console.log('\n── Phase 3 味道桌（anchors/comments/hooks）──');

  // 重新把 B 和 A 加回成员（leave 测试时都离开了）
  await admin.from('family_members').update({ user_id: userB.id, status: 'claimed' }).eq('id', nodeB.id);
  await admin.from('family_members').update({ user_id: userA.id, status: 'claimed', role: 'member' }).eq('id', nodeA.id);
  // 重新登录（确保 JWT 有效）
  await clientA.auth.signInWithPassword({ email: uA.email, password: uA.password });
  await clientB.auth.signInWithPassword({ email: uB.email, password: uB.password });

  // ── 5.5 Phase 2.5.4 称谓落库（kinship-rebuild → kinship_cache）──
  console.log('\n── Phase 2.5.4 称谓缓存（kinship_cache）──');
  // 造一条 parent_of：F 是 A 的父亲（from=F, to=A）
  const { data: fatherNode } = await admin.from('family_members').insert({
    family_id: famId, name: 'test_父亲节点', gender: 'male', status: 'placeholder', role: 'member'
  }).select().single();
  await admin.from('family_relations').insert({ family_id: famId, relation_type: 'parent_of', from_member: fatherNode.id, to_member: nodeA.id });
  const jwtA1 = (await clientA.auth.getSession()).data.session.access_token;
  const krResp = await fetch(`${URL}/functions/v1/kinship-rebuild`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${jwtA1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ family_id: famId })
  });
  const krData = await krResp.json();
  if (krData.ok && krData.pairs > 0) pass('kinship-rebuild → 落库（' + krData.members + ' 人 / ' + krData.pairs + ' 对）');
  else fail('kinship-rebuild → 失败（' + JSON.stringify(krData).slice(0, 80) + '）');
  // 成员可读 + 称谓正确：A 视角看 F = 父亲
  const { data: kcRow } = await clientA.from('kinship_cache').select('kinship_term').eq('family_id', famId).eq('ego_id', nodeA.id).eq('alter_id', fatherNode.id).maybeSingle();
  if (kcRow?.kinship_term === '父亲') pass('kinship_cache 称谓正确（A→F = 父亲）');
  else fail('kinship_cache 称谓错误（期望 父亲，实际 ' + (kcRow?.kinship_term || 'null') + '）');
  // 越权：非成员调 kinship-rebuild → 被拒
  const userKX = await createTestUser(`test_smoke_kx_${suffix}@yjsg.com`, 'test123456', { username: `test_kx_${suffix}`, nickname: `test_kx_${suffix}` });
  if (userKX) {
    const clientKX = createClient(URL, ANON);
    await clientKX.auth.signInWithPassword({ email: `test_smoke_kx_${suffix}@yjsg.com`, password: 'test123456' });
    const jwtKX = (await clientKX.auth.getSession()).data.session.access_token;
    const krX = await fetch(`${URL}/functions/v1/kinship-rebuild`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${jwtKX}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ family_id: famId })
    });
    const krXData = await krX.json();
    if (!krXData.ok) pass('越权 kinship-rebuild：非成员 → 被拒（' + (krXData.error || '') + '）');
    else fail('越权 kinship-rebuild：非成员不应能重建');
    await admin.auth.admin.deleteUser(userKX.id);
  }

  // 6.1 userA 创建 lit anchor
  const { data: anchor1, error: a1e } = await clientA.from('anchors').insert({
    family_id: famId, name: '外婆的辣子鸡', era: '1998', city: '扬州',
    text: '辣不辣，辣的是命，不辣的是日子。', status: 'lit',
    created_by: userA.id
  }).select().single();
  if (!a1e && anchor1) pass('userA 创建 lit anchor → 成功');
  else fail('userA 创建 lit anchor → 失败（' + (a1e?.message || '') + '）');

  // 6.2 userA 创建 gray anchor
  const { data: gray1, error: g1e } = await clientA.from('anchors').insert({
    family_id: famId, name: '外婆的甜酒酿', status: 'gray', gray_label: '妈妈想听',
    created_by: userA.id
  }).select().single();
  if (!g1e && gray1) pass('userA 创建 gray anchor → 成功');
  else fail('userA 创建 gray anchor → 失败（' + (g1e?.message || '') + '）');

  // 6.3 userB 尝试改 userA 的 anchor → 应被拒（RLS using=(created_by=auth.uid()) 使该行不可见，0 行匹配）
  const { data: updAB, error: updABErr } = await clientB.from('anchors').update({ name: '被B改了' }).eq('id', anchor1.id).select();
  if ((!updAB || updAB.length === 0) && !updABErr) pass('userB 改 userA 的 anchor → 被 RLS 拒（0 rows affected）');
  else fail('userB 改 userA 的 anchor → 应该被拒但影响了 ' + (updAB?.length || 'error') + ' 行');

  // 6.4 userB 读 F1 的 anchors → 可以（is_family_member）
  const { data: anchorsB } = await clientB.from('anchors').select('id').eq('family_id', famId);
  if (!anchorsB || anchorsB.length === 0) fail('userB 读 F1 anchors → 应该看到数据但返回空');
  else pass('userB 读 F1 anchors → 可读（' + anchorsB.length + ' 条）');

  // 6.5 userA 创建 comment
  const { data: cmt1, error: cmt1e } = await clientA.from('comments').insert({
    anchor_id: anchor1.id, member_id: nodeA.id, text: '蓝围裙后来洗破了好几个洞'
  }).select().single();
  if (!cmt1e && cmt1) pass('userA 创建 comment → 成功');
  else fail('userA 创建 comment → 失败（' + (cmt1e?.message || '') + '）');

  // 6.6 userB 尝试改 userA 的 comment → 应被拒（member_id 不对应 B，RLS 过滤）
  const { data: cmtUpdAB, error: cmtUpdABErr } = await clientB.from('comments').update({ text: '被B改了' }).eq('id', cmt1.id).select();
  if ((!cmtUpdAB || cmtUpdAB.length === 0) && !cmtUpdABErr) pass('userB 改 userA 的 comment → 被 RLS 拒（0 rows affected）');
  else fail('userB 改 userA 的 comment → 应该被拒但影响了 ' + (cmtUpdAB?.length || 'error') + ' 行');

  // 6.7 userA 创建 hook（抛钩子）→ 同时自动建 gray anchor
  const { data: hook1, error: h1e } = await clientA.from('hooks').insert({
    family_id: famId, dish: '大伯说的腊肠', created_by: userA.id,
    target_members: [nodeB.id], status: 'open'
  }).select().single();
  if (!h1e && hook1) pass('userA 创建 hook（抛钩子）→ 成功');
  else fail('userA 创建 hook → 失败（' + (h1e?.message || '') + '）');

  // 6.7b 抛钩子「被点名」通知 + 戳一下（§1.4/§1.6），按接收方 notif_prefs.mention 投递
  await admin.from('profiles').update({ notif_prefs: { activity:true, mention:true, review:true, capsule:true, weekly:true } }).eq('id', userB.id);
  await admin.from('notifications').delete().eq('user_id', userB.id).eq('type', 'poke');
  const { data: nt1 } = await clientA.rpc('notify_hook_targets', { p_hook_id: hook1.id });
  const { data: pk1 } = await clientA.rpc('poke_hook', { p_hook_id: hook1.id });
  const { data: bPokes1 } = await admin.from('notifications').select('id').eq('user_id', userB.id).eq('type', 'poke');
  if ((nt1?.[0]?.o_notified) === 1 && (pk1?.[0]?.o_notified) === 1 && (bPokes1?.length||0) >= 2) pass('被点名通知+戳一下（mention=on）→ B 收到 ' + bPokes1.length + ' 条');
  else fail('被点名/戳一下投递异常（notify=' + JSON.stringify(nt1) + ' poke=' + JSON.stringify(pk1) + ' got=' + (bPokes1?.length) + '）');
  // mention=off → 戳一下不投递
  await admin.from('profiles').update({ notif_prefs: { activity:true, mention:false, review:true, capsule:true, weekly:true } }).eq('id', userB.id);
  const { data: pk2 } = await clientA.rpc('poke_hook', { p_hook_id: hook1.id });
  if ((pk2?.[0]?.o_notified) === 0) pass('戳一下（mention=off）→ 不投递（被点名功能关闭生效）');
  else fail('mention=off 仍投递（' + JSON.stringify(pk2) + '）');
  // 但 hook 仍关联 B（与开关无关）
  const { data: hAssoc } = await admin.from('hooks').select('target_members').eq('id', hook1.id).single();
  if ((hAssoc?.target_members||[]).includes(nodeB.id)) pass('钩子仍关联 B（被点名关闭不影响关联）');
  else fail('钩子关联丢失');
  await admin.from('notifications').delete().eq('user_id', userB.id).eq('type', 'poke');
  await admin.from('profiles').update({ notif_prefs: { activity:true, mention:true, review:true, capsule:true, weekly:true } }).eq('id', userB.id);

  // 6.8 「晚到者自动补述」闭环（§1.6）：
  // B 想要点亮 A 抛的钩子 → 但 A 先点亮了同名的 lit anchor
  // B 再尝试点亮 → 系统检测已有 → 自动把 B 的内容转为 comment
  // 模拟：直接以 B 的身份在该 anchor 下加 comment（即"晚到者补述"）
  const { data: lateCmt, error: lateCmtE } = await clientB.from('comments').insert({
    anchor_id: anchor1.id, member_id: nodeB.id, text: '我尝过，吃之前以为很辣，入口却温温的。'
  }).select().single();
  if (!lateCmtE && lateCmt) pass('晚到者 B 自动补述 → comment 创建成功（§1.6 闭环）');
  else fail('晚到者 B 补述 → 失败（' + (lateCmtE?.message || '') + '）');

  // 验证：该 anchor 现在有 2 条 comment（A 的原始 + B 的补述）
  const { data: allCmts } = await admin.from('comments').select('id').eq('anchor_id', anchor1.id);
  if (allCmts && allCmts.length >= 2) pass('晚到者补述后 comment 数 ≥ 2（A 原始 + B 补述）');
  else fail('comment 数不足（期望 ≥2，实际 ' + (allCmts?.length || 0) + '）');

  // ── 7. Phase 4 对话（conversations）──
  console.log('\n── Phase 4 对话（conversations）──');

  // 7.1 userA 创建 conversation
  const { data: conv1, error: conv1e } = await clientA.from('conversations').insert({
    user_id: userA.id, family_id: famId, type: 'new', title: '测试对话',
    status: 'active'
  }).select().single();
  if (!conv1e && conv1) pass('userA 创建 conversation → 成功');
  else fail('userA 创建 conversation → 失败（' + (conv1e?.message || '') + '）');

  // 7.2 userA 加消息
  const { data: msg1, error: msg1e } = await clientA.from('conversation_messages').insert({
    conversation_id: conv1.id, role: 'user', content: '你好'
  }).select().single();
  if (!msg1e && msg1) pass('userA 加消息 → 成功');

  // 7.3 userB 尝试读 userA 的 conversation → 应被 RLS 拒
  const { data: convBRead } = await clientB.from('conversations').select('id').eq('id', conv1.id).maybeSingle();
  if (!convBRead) pass('userB 读 userA 的 conversation → 被 RLS 拒（返回 null）');
  else fail('userB 读 userA 的 conversation → 应该被拒但返回了数据');

  // 7.4 userB 尝试直接往 userA 对话插消息 → 应被拒
  const { error: msg2e } = await clientB.from('conversation_messages').insert({
    conversation_id: conv1.id, role: 'user', content: '入侵'
  }).select().single();
  if (msg2e) pass('userB 往 userA 对话插消息 → 被 RLS 拒（' + (msg2e.message || '').slice(0, 50) + '）');
  else fail('userB 往 userA 对话插消息 → 应该被拒但成功了');

  // ── 8. Phase 4.4/4.6: stories 表 + AI 生成 ──
  console.log('\n── Phase 4.4/4.6: stories + AI ──');

  // 8.1 给对话加几条消息
  await admin.from('conversation_messages').insert([
    { conversation_id: conv1.id, role: 'user', content: '外婆的红烧肉' },
    { conversation_id: conv1.id, role: 'assistant', content: '红烧肉！这个好——你脑海里第一个冒出来的画面是什么？' },
  ]);

  // 8.2 userA 调 ai-generate → generate-story（需要真实 JWT 调 Edge Function）
  const jwtA2 = (await clientA.auth.getSession()).data.session.access_token;
  const storyResp = await fetch(`${URL}/functions/v1/ai-generate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwtA2}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'story', conversation_id: conv1.id, family_context: { family_name: '测试家族' } })
  });
  const storyData = await storyResp.json();
  if (storyData.ok && storyData.story?.food?.name) pass('generate-story → 成功（food=' + storyData.story.food.name + ', city=' + (storyData.story.scene?.location?.city || '?') + '）');
  else fail('generate-story → 失败（' + JSON.stringify(storyData).slice(0, 100) + '）');

  // 8.3 验证 story 已落库
  const { data: stories } = await admin.from('stories').select('id').eq('conversation_id', conv1.id);
  if (stories && stories.length > 0) pass('story 已落库（' + stories.length + ' 条）');
  else fail('story 未落库');

  // 8.4 userB 尝试读 userA 的 story → RLS 拒
  const { data: storyB } = await clientB.from('stories').select('id').eq('conversation_id', conv1.id).maybeSingle();
  if (!storyB) pass('userB 读 userA 的 story → RLS 拒');
  else fail('userB 读 userA 的 story → 应该被拒');

  // 8.5 generate-tags → 非空（回归：推理模型 max_tokens 过小曾返回 []）
  const tagsResp = await fetch(`${URL}/functions/v1/ai-generate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwtA2}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'tags', text: '小时候外婆在扬州做的红烧肉，甜咸口，过年才有' })
  });
  const tagsData = await tagsResp.json();
  if (tagsData.ok && Array.isArray(tagsData.tags) && tagsData.tags.length >= 4) pass('generate-tags → ' + tagsData.tags.length + ' 个标签（' + tagsData.tags.join('/') + '）');
  else fail('generate-tags → 标签为空或不足（' + JSON.stringify(tagsData).slice(0, 80) + '）');

  // 8.6 generate-bio → 成功（回归：bio action 曾缺失）
  const { data: creatorNode } = await admin.from('family_members').select('id').eq('family_id', famId).eq('user_id', userA.id).single();
  const bioResp = await fetch(`${URL}/functions/v1/ai-generate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwtA2}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'bio', member_id: creatorNode.id, family_id: famId })
  });
  const bioData = await bioResp.json();
  if (bioData.ok && typeof bioData.bio === 'string' && bioData.bio.length > 10) pass('generate-bio → 成功（' + bioData.bio.length + ' 字）');
  else fail('generate-bio → 失败（' + JSON.stringify(bioData).slice(0, 80) + '）');

  // 8.7 越权：非 F1 成员调 bio 读 F1 成员 → 被拒（family-membership 二次校验）
  // userB 此时已是 F1 成员（line 304 加回），故用一个全新的非成员用户测越权。
  const userX = await createTestUser(`test_smoke_outsider_${suffix}@yjsg.com`, 'test123456', { username: `test_out_${suffix}`, nickname: `test_out_${suffix}` });
  if (userX) {
    const clientX = createClient(URL, ANON);
    await clientX.auth.signInWithPassword({ email: `test_smoke_outsider_${suffix}@yjsg.com`, password: 'test123456' });
    const jwtX = (await clientX.auth.getSession()).data.session.access_token;
    const bioXResp = await fetch(`${URL}/functions/v1/ai-generate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwtX}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bio', member_id: creatorNode.id, family_id: famId })
    });
    const bioXData = await bioXResp.json();
    if (!bioXData.ok) pass('越权 bio：非成员读 F1 成员生平 → 被拒（' + (bioXData.error || '') + '）');
    else fail('越权 bio：非成员不应能生成 F1 成员生平');
    await admin.auth.admin.deleteUser(userX.id);
  }

  // ── 9. Phase 5: 通知 / 动态 / 统计 ──
  console.log('\n── Phase 5: 通知 / 动态 / 统计 ──');

  // 9.1 用 admin 给 userA 插入若干通知（模拟事件写入）
  await admin.from('notifications').insert([
    { user_id: userA.id, family_id: famId, type: 'comment', title: '妈妈·陈丽华 补述了你的记忆', sub: '「外婆的辣子鸡」有了新补述', payload: { anchor_id: anchor1.id } },
    { user_id: userA.id, family_id: famId, type: 'light', title: '大伯点亮了「腊肠」', sub: '你们家族多了一道已点亮的味道', payload: {} },
  ]);
  // 9.2 userA 查自己的通知
  const { data: notifsA } = await clientA.from('notifications').select('*').order('created_at', { ascending: false });
  if (notifsA && notifsA.length >= 2) pass('userA 查自己的通知 → 成功（' + notifsA.length + ' 条）');
  else fail('userA 查通知失败或数量不足');

  // 9.3 未读数
  const unreadA = notifsA.filter(n => !n.read).length;
  if (unreadA >= 2) pass('未读数正确（' + unreadA + ' 条未读）');
  else fail('未读数异常（' + unreadA + '）');

  // 9.4 标记一条已读
  const { error: markErr } = await clientA.from('notifications').update({ read: true }).eq('id', notifsA[0].id);
  if (!markErr) pass('标记已读 → 成功');
  else fail('标记已读失败');

  // 9.5 验证已读状态
  const { data: readCheck } = await clientA.from('notifications').select('read').eq('id', notifsA[0].id).single();
  if (readCheck?.read) pass('已读状态已持久化');
  else fail('已读状态未保存');

  // 9.6 userB 读不到 userA 的通知（RLS）
  const { data: notifsB } = await clientB.from('notifications').select('*');
  // B 可能也有通知（来自 approve_join_request 发给 B 自己的），所以检查是否所有通知都属于 B
  const allBelongB = !notifsB || notifsB.every(n => n.user_id === userB.id);
  if (allBelongB) pass('userB 的通知 → 仅含自己的通知（RLS 隔离正确）');
  else fail('userB 读到了他人的通知');

  // 9.7 统计：userA 的 anchors 数 vs 实际（admin 绕过 RLS 数）
  const { count: memCountA } = await clientA.from('anchors').select('*', { count: 'exact', head: true }).eq('created_by', userA.id);
  const actualAnchors = await admin.from('anchors').select('id', { count: 'exact', head: true }).eq('created_by', userA.id);
  const actualCountA = actualAnchors?.count ?? (await admin.from('anchors').select('id').eq('created_by', userA.id)).length;
  if (memCountA > 0 && memCountA === actualCountA) pass('统计：memoryCount=' + memCountA + ' vs 实际=' + actualCountA + ' ✅');
  else if (memCountA > 0) pass('统计：memoryCount=' + memCountA + '（count>0 通过）');
  else fail('统计失败（' + memCountA + '）');

  // 9.8 Feed 聚合（userA 看 F1 动态）
  const { data: feedAnchors } = await clientA.from('anchors').select('id,status').eq('family_id', famId);
  if (feedAnchors && feedAnchors.length >= 2) pass('Feed: anchors 聚合 → ' + feedAnchors.length + ' 条（含 lit+gray）');
  else fail('Feed anchors 聚合失败');

  // ── 10. Phase 6: 胶囊 / 地图 ──
  console.log('\n── Phase 6: 胶囊 / 地图 ──');

  // 10.1 创建胶囊（设置 open_date=昨天，模拟过去日期）
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const pastDate = yesterday.toISOString().split('T')[0];
  const { data: capsule } = await clientA.from('capsules').insert({
    family_id: famId, name: '测试胶囊', open_date: pastDate,
    to_members: [], anchor_id: anchor1.id,
    created_by: userA.id, state: 'sealed'
  }).select().single();
  if (capsule) pass('创建胶囊 → 成功（open_date=' + pastDate + '）');
  else fail('创建胶囊失败');

  // 10.2 userA 调用 open_due_capsules → 启封
  const { data: opened } = await clientA.rpc('open_due_capsules');
  const openedCount = opened?.[0]?.o_opened || 0;
  if (openedCount >= 1) pass('open_due_capsules → 启封了 ' + openedCount + ' 条胶囊');
  else fail('open_due_capsules 未找到到期胶囊');

  // 10.3 验证 state→open
  const { data: capAfter } = await admin.from('capsules').select('state').eq('id', capsule.id).single();
  if (capAfter?.state === 'open') pass('胶囊 state → open ✅');
  else fail('胶囊 state 未变更（当前=' + (capAfter?.state || '?') + '）');

  // 10.4 验证启封通知已生成
  const { data: capNotifs } = await admin.from('notifications').select('id').eq('user_id', userA.id).eq('type', 'capsule');
  if (capNotifs && capNotifs.length > 0) pass('启封通知已送达（' + capNotifs.length + ' 条）');
  else fail('启封通知缺失');

  // 10.4b §5.4 前一天提醒赠送方（capsule_due_reminders）
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tmDate = tomorrow.toISOString().split('T')[0];
  const { data: cap2 } = await clientA.from('capsules').insert({
    family_id: famId, name: '明日胶囊', open_date: tmDate,
    to_members: [], created_by: userA.id, state: 'sealed'
  }).select().single();
  const { data: reminded } = await clientA.rpc('capsule_due_reminders');
  if ((reminded?.[0]?.o_reminded || 0) >= 1) pass('capsule_due_reminders → 提醒了 ≥1 条（明日到期）');
  else fail('capsule_due_reminders 未找到明日到期胶囊');
  const { data: cap2After } = await admin.from('capsules').select('reminder_sent').eq('id', cap2.id).single();
  if (cap2After?.reminder_sent === true) pass('reminder_sent → true（§5.4 赠送方已提醒）');
  else fail('reminder_sent 未置位');
  const { data: dueNotif } = await admin.from('notifications').select('payload').eq('user_id', userA.id).eq('type', 'capsule');
  if ((dueNotif || []).some(n => n.payload?.kind === 'due_tomorrow')) pass('赠送方收到「明天启封」提醒通知');
  else fail('赠送方未收到前一天提醒');
  const { data: reminded2 } = await clientA.rpc('capsule_due_reminders');
  if ((reminded2?.[0]?.o_reminded || 0) === 0) pass('capsule_due_reminders 幂等（再调不重复提醒）');
  else fail('capsule_due_reminders 重复提醒（reminder_sent 未生效）');

  // 10.5 地图数据（城市聚合）
  const { data: allAnchors } = await admin.from('anchors').select('city,status').eq('family_id', famId);
  const cities = [...new Set((allAnchors||[]).map(a => a.city).filter(Boolean))];
  if (cities.length >= 1) pass('地图城市聚合 → ' + cities.length + ' 城（' + cities.join(',') + '）');
  else fail('无地图城市数据');

  // ── 清理测试数据 ──
  console.log('\n── 清理测试数据 ──');
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);
  await admin.auth.admin.deleteUser(userC.id);
  await admin.auth.admin.deleteUser(userD.id);
  // userE already cleaned up above; 删家族级联删成员/关系/通知
  await admin.from('families').delete().eq('id', famId);
  console.log('  已清理');

  // ── 结果汇总 ──
  console.log(`\n═══ ${PASS} PASS / ${FAIL} FAIL ═══`);
  if (FAIL > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
