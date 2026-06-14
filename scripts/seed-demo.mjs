// seed-demo.mjs — 录制演示用·干净数据种子
// 用法：node scripts/seed-demo.mjs
// 产出：1 个家族 TEST_陈家味道 + 4 个账号 + 三代家谱 + 记忆/补述/钩子/胶囊/待审申请
// 清理：node scripts/clean-demo.mjs
//
// 全部测试数据带前缀：用户名 test_demo_*、家族名 TEST_*（符合 CLAUDE.md 卫生纪律）
// 节点显示名/昵称用真实中文名，录出来好看。

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^(\w+)=(.*)/); if (m) env[m[1]] = m[2].trim();
}
const URL = env.SUPABASE_URL, SR = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.SUPABASE_ANON_KEY;
const admin = createClient(URL, SR);

const PW = 'demo1234';
const FAM_NAME = 'TEST_陈家味道';
const FAM_CODE = 'CH2026';

// 幂等：账号存在则复用（重置密码），否则新建。避免 deleteUser 后 email 未释放的竞态。
async function createUser(username, nickname, gender) {
  const email = `${username}@yjsg.com`;
  const { data:{ users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let u = users.find(x => x.email === email);
  if (u) {
    await admin.auth.admin.updateUserById(u.id, { password: PW, user_metadata: { username, nickname } });
  } else {
    const resp = await fetch(`${URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'apikey': SR, 'Authorization': `Bearer ${SR}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PW, email_confirm: true, user_metadata: { username, nickname } })
    });
    const data = await resp.json();
    if (!data?.id) { console.error('createUser 失败', username, data); process.exit(1); }
    u = data;
  }
  await admin.from('profiles').update({ nickname, gender }).eq('id', u.id);
  return { id: u.id, email, username, nickname };
}
async function login(email) {
  const c = createClient(URL, ANON);
  const { data } = await c.auth.signInWithPassword({ email, password: PW });
  return { client: c, jwt: data.session.access_token };
}

async function main() {
  console.log('═══ 清理旧家族（账号幂等复用，不删）═══');
  // 删除该名下旧家族（级联成员/关系/anchors...），账号保留复用，避免 email 释放竞态
  await admin.from('families').delete().eq('name', FAM_NAME);
  // 清掉演示账号可能残留在别处的孤立申请/通知（保守起见仅按家族名已级联）

  console.log('\n═══ 创建演示账号 ═══');
  const A = await createUser('test_demo_a', '陈建国', '男'); console.log('  A 创建者:', A.nickname);
  const B = await createUser('test_demo_b', '陈志远', '男'); console.log('  B 成员:  ', B.nickname);
  const C = await createUser('test_demo_c', '陈晓梅', '女'); console.log('  C 待加入: ', C.nickname);
  const D = await createUser('test_demo_d', '陈志强', '男'); console.log('  D 待审申请:', D.nickname);

  console.log('\n═══ 创建家族 ═══');
  const { data: fam } = await admin.from('families').insert({
    name: FAM_NAME, surname: '陈', code: FAM_CODE,
    description: '一家人围着灶台的那些年', creator_id: A.id
  }).select().single();
  console.log(`  ${fam.name} | 邀请码 ${fam.code}`);

  console.log('\n═══ 建三代家谱节点 ═══');
  // gender 用 male/female（称谓引擎认英文）
  async function node(name, gender, opts={}) {
    const { data } = await admin.from('family_members').insert({
      family_id: fam.id, name, gender, birth_type: 'solar',
      status: opts.status || 'placeholder', role: opts.role || 'member',
      user_id: opts.user_id || null, birth_date: opts.birth_date || null,
      death_year: opts.death_year || null, hometown: opts.hometown || null, dish: opts.dish || null
    }).select().single();
    console.log(`  ${name} [${data.status}]`);
    return data;
  }
  // 祖辈
  const ye  = await node('陈守业', 'male',   { birth_date:'1930-03-12', death_year:2010, status:'deceased', hometown:'江苏扬州' });
  const nai = await node('林秀英', 'female', { birth_date:'1933-08-20', death_year:2015, status:'deceased', hometown:'江苏扬州', dish:'红烧肉' });
  // 父辈
  const A_node = await node('陈建国', 'male',   { birth_date:'1958-05-01', status:'claimed', role:'creator', user_id:A.id, hometown:'江苏扬州' });
  const mu  = await node('王桂芳', 'female', { birth_date:'1960-11-08', hometown:'江苏南京', dish:'桂花糖藕' });
  const shu = await node('陈建军', 'male',   { birth_date:'1962-02-14', hometown:'江苏扬州' });
  // 子辈
  const B_node = await node('陈志远', 'male',   { birth_date:'1988-07-30', status:'claimed', user_id:B.id });
  const nv  = await node('陈小雨', 'female', { birth_date:'1992-09-15' }); // 占位，留给 claim 演示

  console.log('\n═══ 建关系边（parent_of / spouse_of）═══');
  async function rel(type, from, to) {
    await admin.from('family_relations').insert({ family_id: fam.id, relation_type: type, from_member: from.id, to_member: to.id });
  }
  await rel('spouse_of', ye, nai);
  await rel('parent_of', ye, A_node);   // 守业 → 建国
  await rel('parent_of', nai, A_node);
  await rel('parent_of', ye, shu);      // 守业 → 建军（建国之弟 → 志远叫叔叔）
  await rel('parent_of', nai, shu);
  await rel('spouse_of', A_node, mu);   // 建国 ⇄ 桂芳
  // 注意：只让建国当孩子的「血亲父亲」，桂芳仅靠夫妻边连接。
  // 否则称谓引擎「血亲优先」会走 建国→孩子→桂芳 两跳，把妻子误判成「妹妹」。
  // 这样建国看桂芳=妻子；志远看桂芳=母亲（引擎正确推导「父亲的妻子」）。均正确。
  await rel('parent_of', A_node, B_node); // 建国 → 志远
  await rel('parent_of', A_node, nv);   // 建国 → 小雨（占位）
  console.log('  8 条边已建（三代：祖父母 / 父辈含叔 / 子辈）');

  console.log('\n═══ 味道桌：记忆 / 补述 / 钩子 ═══');
  const { data: m1 } = await admin.from('anchors').insert({
    family_id: fam.id, name: '奶奶的红烧肉', by_member: nai.id, era: '1985', city: '扬州', province: '江苏',
    text: '过年才舍得做的一锅。奶奶系着蓝围裙在灶台前守一下午，肉是深琥珀色、亮晶晶的，甜咸口。一端上桌，一桌子人都安静了。',
    status: 'lit', tags: ['奶奶的味道','扬州','红烧肉','过年'], created_by: A.id
  }).select().single();
  console.log('  已点亮：奶奶的红烧肉（扬州·1985）');

  const { data: m2 } = await admin.from('anchors').insert({
    family_id: fam.id, name: '妈妈的桂花糖藕', by_member: mu.id, era: '1992', city: '南京', province: '江苏',
    text: '桂花是院子里那棵树上现摘的。糯米塞进藕孔要用筷子一点点捅实，糖色熬到挂勺。咬下去是软糯和清甜。',
    status: 'lit', tags: ['妈妈的味道','南京','桂花','糖藕'], created_by: A.id
  }).select().single();
  console.log('  已点亮：妈妈的桂花糖藕（南京·1992）');

  const { data: g1 } = await admin.from('anchors').insert({
    family_id: fam.id, name: '爷爷的腊味煲仔饭', status: 'gray', gray_label: '陈志远想听', created_by: A.id
  }).select().single();
  console.log('  待讲（灰锚点）：爷爷的腊味煲仔饭');

  // B（陈志远）对 m1 的补述
  await admin.from('comments').insert({
    anchor_id: m1.id, member_id: B_node.id, text: '我记得那蓝围裙后来洗得发白，奶奶还舍不得换。'
  });
  console.log('  补述：陈志远 在「奶奶的红烧肉」下留言');

  // A 抛钩子 @B（爷爷的腊味），并发被点名通知给 B
  const { data: hook } = await admin.from('hooks').insert({
    family_id: fam.id, dish: '爷爷的腊味煲仔饭', anchor_id: g1.id,
    created_by: A.id, target_members: [B_node.id], status: 'open'
  }).select().single();
  const aLogin = await login(A.email);
  await aLogin.client.rpc('notify_hook_targets', { p_hook_id: hook.id });
  console.log('  抛钩子：陈建国 @ 陈志远（爷爷的腊味）→ 已发被点名通知');

  console.log('\n═══ 传承：时间胶囊 ═══');
  await admin.from('capsules').insert({
    family_id: fam.id, name: '给志远的成年礼', open_date: '2027-06-01',
    to_members: [B_node.id], created_by: A.id, state: 'sealed',
    text: '等你成家那天再打开。这锅红烧肉的方子，别丢。'
  });
  console.log('  已封存：给志远的成年礼（2027-06-01 启封）');

  console.log('\n═══ 待审申请（供第④幕 审核演示）═══');
  const dLogin = await login(D.email);
  const { data: jr } = await dLogin.client.rpc('request_join', { p_code: FAM_CODE });
  console.log('  陈志强 已凭码申请加入 → 待 陈建国 在 P52 审核', jr?.[0] ? '✅' : '(检查)');

  console.log('\n═══ 重建称谓缓存 ═══');
  const kr = await fetch(`${URL}/functions/v1/kinship-rebuild`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${aLogin.jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ family_id: fam.id })
  });
  const krd = await kr.json();
  console.log('  kinship-rebuild:', krd.ok ? `${krd.members} 人 / ${krd.pairs} 对称谓` : JSON.stringify(krd));

  console.log('\n\n╔══════════════ 录制账号速查 ══════════════╗');
  console.log(`  家族：${FAM_NAME}    邀请码：${FAM_CODE}`);
  console.log('  ┌─────────────┬──────────┬────────┬──────────────────────┐');
  console.log('  │ 用户名       │ 密码      │ 昵称    │ 角色/用途              │');
  console.log('  ├─────────────┼──────────┼────────┼──────────────────────┤');
  console.log(`  │ test_demo_a │ ${PW} │ 陈建国  │ 创建者（主演示）        │`);
  console.log(`  │ test_demo_b │ ${PW} │ 陈志远  │ 成员（补述/被点名/越权）│`);
  console.log(`  │ test_demo_c │ ${PW} │ 陈晓梅  │ 待加入（现场凭码加入）  │`);
  console.log(`  │ test_demo_d │ ${PW} │ 陈志强  │ 已提交待审申请          │`);
  console.log('  └─────────────┴──────────┴────────┴──────────────────────┘');
  console.log('  占位节点「陈小雨」可供 C 演示 claim 认领；或 C 选关系 relate。');
  console.log('╚════════════════════════════════════════════╝');
}
main().catch(e => { console.error(e); process.exit(1); });
