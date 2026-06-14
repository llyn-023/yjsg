// test-agent-chat.mjs — 5-6 轮真实记忆挖掘对话测试
// 用法：node scripts/test-agent-chat.mjs
// 验证：对话自然度、红线合规、era/city 正确抽取、「籍贯锚点问城市」桥段

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^(\w+)=(.*)/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.SUPABASE_URL;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.SUPABASE_ANON_KEY;
const admin = createClient(URL, SR);

async function createTestUser(email, password, meta) {
  const resp = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'apikey': SR, 'Authorization': `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: meta })
  });
  return (await resp.json());
}

async function main() {
  console.log('═══ agent-chat 5-6 轮对话测试 ═══\n');

  // ── 1. 建测试环境 ──
  const suffix = Date.now().toString(36);
  const user = await createTestUser(`test_agent_${suffix}@yjsg.com`, 'test123', { username: `test_agent_${suffix}`, nickname: `测试用户` });
  console.log('1. 用户:', user.id);

  const client = createClient(URL, ANON);
  await client.auth.signInWithPassword({ email: `test_agent_${suffix}@yjsg.com`, password: 'test123' });

  // 建家族
  const { data: fam } = await client.from('families').insert({
    name: 'TEST_AGENT_' + suffix, surname: '陈', code: 'AGT' + suffix.slice(-3).toUpperCase(), creator_id: user.id
  }).select().single();
  const famId = fam.id;

  // 建成员节点（含籍贯）
  await admin.from('family_members').insert([
    { family_id: famId, user_id: user.id, name: '测试用户', gender: '男', status: 'claimed', role: 'creator' },
    { family_id: famId, name: '外婆', gender: '女', hometown: '江苏·扬州', status: 'placeholder', role: 'member' },
    { family_id: famId, name: '妈妈', gender: '女', hometown: '江苏·扬州', status: 'placeholder', role: 'member' },
  ]);

  // 建 conversation
  const { data: conv } = await client.from('conversations').insert({
    user_id: user.id, family_id: famId, type: 'new', title: '外婆的红烧肉',
    entry_context: { food_name: '外婆的红烧肉' },
    status: 'active'
  }).select().single();
  const convId = conv.id;
  console.log('2. 对话 ID:', convId);

  // ── 2. 5-6 轮对话 ──
  const context = {
    family_name: 'TEST_AGENT_' + suffix,
    family_surname: '陈',
    entry_type: 'blank',
    entry_context: { food_name: '外婆的红烧肉' },
    family_tree_nodes: [
      { id: '1', name: '测试用户', status: 'active' },
      { id: '2', name: '外婆', status: 'placeholder', hometown: '江苏·扬州' },
      { id: '3', name: '妈妈', status: 'placeholder', hometown: '江苏·扬州' },
    ],
    related_person_hometown: '扬州（外婆的籍贯）',
    existing_anchors: [],
    gray_anchors: [],
  };

  const rounds = [
    "外婆的红烧肉",
    "小时候在扬州外婆家，她系着蓝色围裙在灶台前忙活",
    "甜咸口的，肉是深琥珀色亮晶晶的。每次过年才有",
    "嗯……她特别喜欢在灶台旁边哼歌，一边炒菜一边哼，还偷吃给我看",
    "哈哈对！有一次偷偷夹了一块，她反而多夹了一块给我，说多吃点长身体",
    "好像就这些了。就是……走到哪都忘不了那个味道",
  ];

  // 加初始 system 消息占位
  const JWT = (await client.auth.getSession()).data.session.access_token;

  for (let i = 0; i < rounds.length; i++) {
    console.log(`\n── 第 ${i + 1} 轮 ──`);
    console.log(`👤 User: ${rounds[i]}`);

    // 第一轮是初始化，不需要调 agent-chat（直接当 user message 插）
    if (i === 0) {
      // 用 agent-chat 函数处理
      const resp = await fetch(`${URL}/functions/v1/agent-chat`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${JWT}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: convId, user_message: rounds[i], context })
      });
      const data = await resp.json();
      if (data.ok) {
        console.log(`🤖 Agent: ${data.reply}`);
        console.log(`📊 State: era=${data.state?.era || '?'} city=${data.state?.city || '?'} locked=${data.state?.time_location_locked}`);
      } else {
        console.log(`❌ Error: ${JSON.stringify(data)}`);
      }
    } else {
      const resp = await fetch(`${URL}/functions/v1/agent-chat`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${JWT}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: convId, user_message: rounds[i], context })
      });
      const data = await resp.json();
      if (data.ok) {
        console.log(`🤖 Agent: ${data.reply}`);
        console.log(`📊 State: era=${data.state?.era || '?'} city=${data.state?.city || '?'} locked=${data.state?.time_location_locked} turns=${data.state?.conversation_turns}`);
      } else {
        console.log(`❌ Error: ${JSON.stringify(data)}`);
      }
    }

    // 短暂间隔避免 API 限流
    await new Promise(r => setTimeout(r, 1500));
  }

  // ── 3. 最终状态 ──
  console.log('\n═══ 最终状态 ═══');
  const { data: finalConv } = await admin.from('conversations').select('state').eq('id', convId).single();
  console.log(JSON.stringify(finalConv?.state, null, 2));

  // ── 4. 红线检查 ──
  console.log('\n═══ 红线检查 ═══');
  const { data: allMsgs } = await admin.from('conversation_messages').select('content,role').eq('conversation_id', convId).order('created_at');
  const assistantMsgs = (allMsgs || []).filter(m => m.role === 'assistant').map(m => m.content);

  const redLines = [
    { name: '不称 AI', pattern: /AI|助手|机器人/ },
    { name: '不填表问时间', pattern: /请(告诉|提供|输入).*(哪一年|年份|时间)/ },
    { name: '不填表问地点', pattern: /请(告诉|提供|输入).*(城市|地点|地址)/ },
    { name: '不主动问生死', pattern: /还在吗|现在怎么样了|还活着吗|去世|离世/ },
    { name: '不输出 JSON', pattern: /\{.*"era"/ },
    { name: '不说谢谢分享', pattern: /谢谢你的分享/ },
    { name: '不说让我们继续', pattern: /让我们继续|接下来我想了解|好的，那么/ },
  ];

  let allClear = true;
  for (const rl of redLines) {
    const hit = assistantMsgs.some(m => rl.pattern.test(m));
    if (hit) { console.log(`  ❌ ${rl.name}`); allClear = false; }
    else console.log(`  ✅ ${rl.name}`);
  }

  // 检查是否有「籍贯锚点问城市」桥段
  const hasHometownAnchor = assistantMsgs.some(m => /扬州|籍贯|那边/.test(m));
  if (hasHometownAnchor) console.log('  ✅ 含籍贯锚点桥段');
  else console.log('  ⚠️  未检测到籍贯锚点桥段');

  // ── 清理 ──
  console.log('\n── 清理 ──');
  await admin.from('families').delete().eq('id', famId);
  await admin.auth.admin.deleteUser(user.id);
  console.log('已清理');

  if (!allClear) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
