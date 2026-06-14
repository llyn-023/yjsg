// test-generate-story.mjs — 验证 4.4 generate-story + 4.6 generate-tags
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
  console.log('═══ generate-story + generate-tags 测试 ═══\n');

  const suffix = Date.now().toString(36);
  const user = await createTestUser(`test_gs_${suffix}@yjsg.com`, 'test123', { username: `test_gs_${suffix}`, nickname: '测试' });
  const client = createClient(URL, ANON);
  await client.auth.signInWithPassword({ email: `test_gs_${suffix}@yjsg.com`, password: 'test123' });
  const JWT = (await client.auth.getSession()).data.session.access_token;

  // 建家族
  const { data: fam } = await client.from('families').insert({
    name: 'TEST_GS_' + suffix, surname: '陈', code: 'GST' + suffix.slice(-3).toUpperCase(), creator_id: user.id
  }).select().single();

  // 建对话（含模拟 3 轮对话消息）
  const { data: conv } = await client.from('conversations').insert({
    user_id: user.id, family_id: fam.id, type: 'new', title: '外婆的红烧肉',
    state: { era: '小时候', city: '扬州', time_location_locked: true, conversation_turns: 3,
      scene: { era: '小时候', location: { city: '扬州', venue: '外婆家', city_confidence: 'confirmed' } }
    },
    status: 'active'
  }).select().single();

  const convId = conv.id;
  await admin.from('conversation_messages').insert([
    { conversation_id: convId, role: 'user', content: '外婆的红烧肉' },
    { conversation_id: convId, role: 'assistant', content: '红烧肉！这个好——你脑海里第一个冒出来的画面，大概是什么时候、在哪儿的事儿呀？' },
    { conversation_id: convId, role: 'user', content: '小时候在扬州外婆家，她系着蓝色围裙在灶台前忙活' },
    { conversation_id: convId, role: 'assistant', content: '扬州，外婆家，蓝色围裙……这是什么画面啊。她做红烧肉的时候你在旁边吗？' },
    { conversation_id: convId, role: 'user', content: '甜咸口的，深琥珀色亮晶晶的，每次过年才有。外婆会哼着歌炒菜，还偷偷夹肉给我吃，说多吃点长身体' },
    { conversation_id: convId, role: 'assistant', content: '甜咸口的红烧肉，过年才有——那是年夜饭桌上最抢手的一道吧。外婆哼歌夹肉给你，那个画面想想就暖。' },
  ]);

  console.log('对话 ID:', convId);

  // ── 1. generate-story ──
  console.log('\n── 1. generate-story ──');
  const storyResp = await fetch(`${URL}/functions/v1/ai-generate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${JWT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'story', conversation_id: convId, family_context: { family_name: '陈家', family_surname: '陈' } })
  });
  const storyData = await storyResp.json();
  console.log('ok:', storyData.ok, 'story_id:', storyData.story_id);

  if (storyData.story?.food) {
    console.log('🍽️  菜名:', storyData.story.food.name);
    console.log('👤 人物:', storyData.story.people?.main_person?.name);
    console.log('📍 城市:', storyData.story.scene?.location?.city);
    console.log('🕐 年代:', storyData.story.scene?.era);
    console.log('💭 情感:', storyData.story.emotion?.core_feeling);
    console.log('📖 故事:', storyData.story.emotion?.stories?.[0]?.summary);
    console.log('🏷️  关联吃食:', (storyData.story.related_foods || []).map(f => f.name).join(', '));
    console.log('🔮 灰锚点建议:', (storyData.story.gray_anchor_suggestions || []).map(g => g.food_name).join(', '));
    console.log('\n✅ generate-story PASS');
  } else {
    console.log('❌ FAIL: no food in story output');
    console.log(JSON.stringify(storyData).slice(0, 300));
  }

  // ── 2. generate-tags ──
  console.log('\n── 2. generate-tags ──');
  const tagsResp = await fetch(`${URL}/functions/v1/ai-generate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${JWT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'tags', text: '外婆的红烧肉是深琥珀色亮晶晶的甜咸口，扬州老房子的灶台前，过年才有。她系着蓝色围裙哼歌炒菜，偷偷夹肉给我吃。' })
  });
  const tagsData = await tagsResp.json();
  console.log('ok:', tagsData.ok, 'tags:', tagsData.tags);

  // ── 3. generate-recipe ──
  console.log('\n── 3. generate-recipe ──');
  const recipeResp = await fetch(`${URL}/functions/v1/ai-generate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${JWT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'recipe', food_name: '外婆的红烧肉', text: '甜咸口的红烧肉，肉是深琥珀色亮晶晶的，五花肉、冰糖、老抽、姜片，外婆会先用冰糖炒糖色，然后在灶台上小火慢炖一个多小时，肉皮都炖得糯糯的，肥而不腻。' })
  });
  const recipeData = await recipeResp.json();
  console.log('ok:', recipeData.ok, 'ingredients:', recipeData.recipe?.ingredients?.length, 'steps:', recipeData.recipe?.steps?.length);

  // ── 清理 ──
  await admin.from('families').delete().eq('id', fam.id);
  await admin.auth.admin.deleteUser(user.id);
  console.log('\n已清理');
}

main().catch(e => { console.error(e); process.exit(1); });
