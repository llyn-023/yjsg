// supabase/functions/ai-generate/index.ts
// Phase 4.4–4.6 · 统一 AI 生成函数
// action: "story" | "recipe" | "tags"
// 按 P30 §10.2 输出结构生成故事；recipe 从正文提取；tags 生成 4-5 个标签。

const GLM_BASE = Deno.env.get("GLM_BASE_URL") ?? "https://open.bigmodel.cn/api/paas/v4";
const ENDPOINT = `${GLM_BASE}/chat/completions`;
const MODEL = Deno.env.get("GLM_MODEL") ?? "glm-5.1";
const TIMEOUT_MS = 40_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
}

async function callGLM(messages: any[], temperature = 0.7, maxTokens = 4096, timeoutMs = TIMEOUT_MS) {
  const apiKey = Deno.env.get("GLM_API_KEY");
  if (!apiKey) throw new Error("GLM_API_KEY not configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(ENDPOINT, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens }),
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`GLM HTTP ${resp.status}`);
    return await resp.json();
  } finally { clearTimeout(timer); }
}

// ── DB helpers ──
async function pg(path: string, opts: any = {}, srKey: string, supabaseUrl: string) {
  const url = `${supabaseUrl}/rest/v1/${path}`;
  const headers: any = { "apikey": srKey, "Authorization": `Bearer ${srKey}`, "Content-Type": "application/json", ...opts.headers };
  if (opts.prefer) headers["Prefer"] = opts.prefer;
  const resp = await fetch(url, { method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (!resp.ok) throw new Error(`DB error: ${resp.status}`);
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

// ── Parse JSON from GLM (handle markdown wrappers) ──
function parseGLMJSON(text: string) {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  // Find first { or [
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); }
    catch { /* fall through */ }
  }
  try { return JSON.parse(cleaned); }
  catch { return null; }
}

// 从文本里抽取一个 JSON 数组（标签用；reasoning 里可能夹带散文）
function parseGLMArray(text: string) {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const start = cleaned.lastIndexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); }
    catch { /* fall through */ }
  }
  try { const v = JSON.parse(cleaned); return Array.isArray(v) ? v : null; }
  catch { return null; }
}

// ═══ 处理函数 ═══

async function generateStory(convHistory: any[], state: any, familyContext: any) {
  const prompt = `You are a food memory archivist. Based on the conversation below, generate a structured story output.

Return ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "food": { "name": "...", "ingredients_impression": "...", "taste_memory": "...", "appearance": "...", "special_impression": "..." },
  "people": { "main_person": {"name":"","habits_details":"","signature_phrases":[]}, "inheritance":{"chain":[],"current_status":""}, "co_eaters":[] },
  "scene": { "era": "...", "occasion": "...", "location": {"city":"","province":"","venue":"","spatial_details":"","is_origin":true}, "season": "" },
  "emotion": { "core_feeling": "...", "stories": [{"summary":"","detail":"","emotional_tone":""}], "generational_connection": "", "personal_meaning": "" },
  "related_foods": [{"name":"","relation":"","source_quote":""}],
  "story_suggestions": {"angle":"","tone":"","key_quotes":[]},
  "gray_anchor_suggestions": [{"food_name":"","source":"","context_quote":"","suggested_person":""}]
}

Conversation:
${convHistory.map(m => `${m.role}: ${m.content}`).join("\n\n")}

Current state:
${JSON.stringify(state)}

Family context:
${JSON.stringify(familyContext)}

Generate the story based on this conversation. Fill in ALL fields that have information from the conversation. Use null or empty values for fields with no information.`;

  const data = await callGLM([
    { role: "system", content: "You are a food memory archivist. Return ONLY valid JSON." },
    { role: "user", content: prompt }
  ], 0.3, 4096);

  const text = data?.choices?.[0]?.message?.content ?? "";
  let result = parseGLMJSON(text);
  // 规范化：确保所有必要字段存在，缺失时填兜底值（对齐 §2.4）
  if (result) {
    if (!result.food) result.food = {};
    if (!result.food.name) result.food.name = "未知";
    if (!result.scene) result.scene = {};
    if (!result.scene.era) result.scene.era = "1900";
    if (!result.scene.location) result.scene.location = {};
    if (!result.scene.location.city) result.scene.location.city = "未知";
    if (!result.people) result.people = {};
    if (!result.emotion) result.emotion = {};
    if (!result.story_suggestions) result.story_suggestions = {};
    if (!result.gray_anchor_suggestions) result.gray_anchor_suggestions = [];
  }
  return result;
}

async function generateRecipe(text: string, foodName: string) {
  const prompt = `请根据下面这段家味记忆，还原这道菜的做法。只返回一个 JSON 对象（不要 markdown、不要解释），所有内容必须用中文：
{"ingredients":["食材1","食材2",...], "steps":["步骤1","步骤2",...], "note":"一句关于地道做法或变化的小提示"}

「${foodName}」的记忆描述：
${text}`;

  const data = await callGLM([
    { role: "system", content: "你是一位还原家常菜谱的助手。只返回合法的 JSON，所有文字用中文。" },
    { role: "user", content: prompt }
  ], 0.3, 4096);

  const text2 = data?.choices?.[0]?.message?.content ?? "";
  let parsed = parseGLMJSON(text2);
  if (!parsed && data?.choices?.[0]?.message?.reasoning_content) {
    parsed = parseGLMJSON(data.choices[0].message.reasoning_content);
  }
  return parsed;
}

async function generateTags(text: string) {
  const prompt = `根据下面这段家味记忆正文，生成 4-5 个中文「#标签」。只返回一个字符串 JSON 数组，不要任何其它内容。
示例：["外婆的味道","扬州","年夜饭","家的温暖"]

正文：${text}`;

  // ⚠️ glm-5.1 是推理模型，max_tokens 过小会被 reasoning 吃光导致 content 为空 → 给足额度
  const data = await callGLM([
    { role: "system", content: "你是标签生成器。只返回一个中文字符串 JSON 数组。" },
    { role: "user", content: prompt }
  ], 0.5, 2048);

  const extracted = data?.choices?.[0]?.message?.content ?? "";
  // 先试正常 content，再从 reasoning 兜底抽取数组
  let parsed = parseGLMArray(extracted);
  if (!parsed && data?.choices?.[0]?.message?.reasoning_content) {
    parsed = parseGLMArray(data.choices[0].message.reasoning_content);
  }
  return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
}

// P21 · 人物生平简述（plan 4.6 / 需要补充逻辑 §2.1）
async function generateBio(member: any, anchors: any[]) {
  const facts: string[] = [];
  if (member.name) facts.push(`姓名：${member.name}`);
  if (member.gender) facts.push(`性别：${member.gender === "male" ? "男" : "女"}`);
  if (member.birth_date) facts.push(`出生：${member.birth_date}`);
  if (member.death_year) facts.push(`离世年份：${member.death_year}`);
  if (member.hometown) facts.push(`籍贯：${member.hometown}`);
  if (member.dish) facts.push(`代表味道：${member.dish}`);
  const anchorText = (anchors || [])
    .map((a: any) => `「${a.name}」${a.era ? `（${a.era}）` : ""}：${(a.text || "").slice(0, 80)}`)
    .join("\n");

  const prompt = `你是一位家族记忆的记述者。请根据以下信息，为这位家人写一段温暖、平实的个人简介（120-200 字，中文，一段即可，不要分点、不要标题）。\n\n基本信息：\n${facts.join("\n")}\n\n与 TA 相关的家味记忆：\n${anchorText || "（暂无记忆记录）"}\n\n如果信息很少，就写得简短克制，不要编造不存在的事实。简介：`;

  const data = await callGLM([
    { role: "system", content: "你是家族记忆记述者，输出温暖平实的中文人物简介，绝不编造未提供的事实。" },
    { role: "user", content: prompt }
  ], 0.7, 2048);

  let bio = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!bio && data?.choices?.[0]?.message?.reasoning_content) {
    bio = String(data.choices[0].message.reasoning_content).trim();
  }
  return bio;
}

// ═══ 入口 ═══
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const srKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  let userId = "";
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    userId = JSON.parse(atob(base64)).sub || "";
  } catch { return json({ ok: false, error: "invalid token" }, 401); }

  try {
    const action = body.action;

    if (action === "story") {
      // ── generate-story ──
      const conversationId = body.conversation_id;
      if (!conversationId) return json({ ok: false, error: "conversation_id required" }, 400);

      // Load conversation
      const convs = await pg(`conversations?id=eq.${conversationId}&select=*`, {}, srKey, supabaseUrl);
      if (!convs || convs.length === 0) return json({ ok: false, error: "对话不存在" }, 404);
      const conv = convs[0];
      if (conv.user_id !== userId) return json({ ok: false, error: "无权访问" }, 403);

      // Load messages
      const msgs = await pg(`conversation_messages?conversation_id=eq.${conversationId}&order=created_at`, {}, srKey, supabaseUrl);
      const history = (msgs || []).map((m: any) => ({ role: m.role, content: m.content }));

      const familyContext = body.family_context || {};
      const result = await generateStory(history, conv.state || {}, familyContext);
      if (!result) return json({ ok: false, error: "故事生成失败" }, 500);

      // Save to stories table
      const storyRow = await pg("stories", {
        method: "POST",
        body: { conversation_id: conversationId, user_id: userId, family_id: conv.family_id, title: result.food?.name || "故事", output: result, status: "published" },
        prefer: "return=representation",
      }, srKey, supabaseUrl);

      return json({ ok: true, story: result, story_id: storyRow?.[0]?.id });

    } else if (action === "recipe") {
      // ── generate-recipe ──
      const result = await generateRecipe(body.text || "", body.food_name || "");
      if (!result) return json({ ok: false, error: "菜谱生成失败" }, 500);
      return json({ ok: true, recipe: result });

    } else if (action === "tags") {
      // ── generate-tags ──
      const tags = await generateTags(body.text || "");
      return json({ ok: true, tags });

    } else if (action === "bio") {
      // ── generate-bio（P21 人物生平）──
      const memberId = body.member_id;
      const familyId = body.family_id;
      if (!memberId || !familyId) return json({ ok: false, error: "member_id 和 family_id required" }, 400);

      // 校验调用者属于该家族（二次校验，§四 AI 调用）
      const myNode = await pg(`family_members?family_id=eq.${familyId}&user_id=eq.${userId}&select=id`, {}, srKey, supabaseUrl);
      if (!myNode || myNode.length === 0) return json({ ok: false, error: "无权访问该家族" }, 403);

      const memberRows = await pg(`family_members?id=eq.${memberId}&family_id=eq.${familyId}&select=*`, {}, srKey, supabaseUrl);
      if (!memberRows || memberRows.length === 0) return json({ ok: false, error: "成员不存在" }, 404);
      const member = memberRows[0];

      const anchors = await pg(`anchors?family_id=eq.${familyId}&by_member=eq.${memberId}&select=name,era,text`, {}, srKey, supabaseUrl);
      const bio = await generateBio(member, anchors || []);
      if (!bio) return json({ ok: false, error: "生平生成失败" }, 500);
      return json({ ok: true, bio });

    } else if (action === "memorial") {
      // ── 纪念册文案（P61）──
      const familyId = body.family_id;
      if (!familyId) return json({ ok: false, error: "family_id required" }, 400);

      const anchorsData = await pg(`anchors?family_id=eq.${familyId}&status=eq.lit&select=name,era,city,text,by_member`, {}, srKey, supabaseUrl);
      const anchorList = (anchorsData || []).map((a: any) => `「${a.name}」— ${a.era || '?'}年 ${a.city || '?'}：${(a.text||'').slice(0, 100)}`).join('\n');

      const style = body.style || 'classic';
      const styleGuide = {
        classic: '仿古书页、暖黄纸色，语气如家书、序言，温厚沉静',
        warm: '暖色调、手写信质感，语气亲近随意，像家人围坐聊天',
        fresh: '清新淡雅、水彩风格，语气轻松明快，如春日午后',
      };
      const styleDesc = styleGuide[style] || styleGuide.classic;
      const prompt = `你是一位家族纪念册的编辑。请根据以下家族记忆，撰写一段温暖、有历史感的纪念册引言（200-300字，中文）。\n风格要求：${styleDesc}\n\n家族记忆：\n${anchorList}\n\n引言：`;

      // glm-5.1 为推理模型，max_tokens 过小会被 reasoning 吃光 → 给足 + reasoning 兜底；放宽超时
      const data = await callGLM([
        { role: "system", content: "你是家族纪念册编辑，输出温暖、有历史感的引言。" },
        { role: "user", content: prompt }
      ], 0.7, 2560, 110_000);

      let intro = data?.choices?.[0]?.message?.content?.trim() || "";
      if (!intro && data?.choices?.[0]?.message?.reasoning_content) intro = String(data.choices[0].message.reasoning_content).trim();
      return json({ ok: true, memorial: { intro, anchor_count: (anchorsData || []).length } });

    } else {
      return json({ ok: false, error: "unknown action: " + action }, 400);
    }
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
