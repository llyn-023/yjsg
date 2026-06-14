// supabase/functions/agent-chat/index.ts
// Phase 4.3 · Agent 对话（P30 记忆挖掘）
// 严格按《P30_记忆挖掘Agent_对话Skill规格.md》：
//   §11 System Prompt 模板 → buildSystemPrompt()
//   §8.1 状态模型 → current_state
//   §13.2 请求结构 → ConversationRequest
//   §13.4 时空校验 → extractState()

const GLM_BASE = Deno.env.get("GLM_BASE_URL") ?? "https://open.bigmodel.cn/api/paas/v4";
const ENDPOINT = `${GLM_BASE}/chat/completions`;
const MODEL = Deno.env.get("GLM_MODEL") ?? "glm-5.1";
const TIMEOUT_MS = 30_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
}

// ── GLM 调用 ──
async function callGLM(messages: any[], temperature = 0.8, maxTokens = 1024) {
  const apiKey = Deno.env.get("GLM_API_KEY");
  if (!apiKey) throw new Error("GLM_API_KEY not configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens }),
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`GLM HTTP ${resp.status}: ${await resp.text().catch(() => "")}`);
    const data = await resp.json();
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ── §11 System Prompt 模板 ──
function buildSystemPrompt(ctx: any, state: any) {
  const familyName = ctx.family_name || "未知家族";
  const familySurname = ctx.family_surname || "";
  const treeSummary = (ctx.family_tree_nodes || []).map((n: any) =>
    `${n.name}（${n.status === 'deceased' ? '已故' : '在世'}${n.hometown ? '，' + n.hometown : ''}）`
  ).join("、") || "无";
  const relatedHometown = ctx.related_person_hometown || "未知";
  const existingAnchors = (ctx.existing_anchors || []).map((a: any) => a.food_name).join("、") || "无";
  const grayAnchors = (ctx.gray_anchors || []).map((a: any) => `${a.food_name}（${a.label}）`).join("、") || "无";
  const entryType = ctx.entry_type || "blank";
  const entryCtx = ctx.entry_context?.food_name || "";
  const timeLocked = state?.time_location_locked ? "已锚定" : "未锚定";
  const era = state?.era || "未知";
  const city = state?.city || "未知";
  const uncovered = state?.dimensions_covered
    ? Object.entries(state.dimensions_covered).filter(([_,v]) => !v).map(([k]) => k).join("、")
    : "待探索";
  const emoState = state?.emotional_state || "normal";

  return `你是「一家食光」App 里的记忆倾听者。你在陪用户聊一道家常味道背后的记忆。

## 你是谁

你温暖、好奇，像一个对家里味道特别在意的家人。你坐在对面，对用户说的每一句话都真的感兴趣。你不是在采访，你是在聊天。有时候你会追问，有时候你只是想说一句让 TA 觉得被接住的话。

## 你怎么说话

- 像跟朋友坐在饭桌边聊天，不要像做采访
- 会笑（"哈哈"），会感慨（"嗯"），会惊讶（"真的吗"），也会认真沉默
- 该短就短，该多说两句就多说两句
- 不是每句话都在追问——有时候只是陪 TA 呆一会儿
- 一次只问一个核心问题（时间和地点可以在同一句里温和带出）
- 用感官词汇帮用户回忆（"闻起来""看起来""摸上去"）
- 每句话都从用户刚才说的内容出发
- 绝不说"谢谢你的分享""请告诉我更多""好的，让我们继续"
- 绝不用填表口吻追问时间地点（"请问哪一年""请提供城市"是禁止的）

## 你的原则

- 用户说什么你就接什么，不提前想好要问什么
- 先接住用户说的话，再追问
- 用画面感引导，不问抽象问题
- 模糊的记忆也要肯定（"好像就够了"）
- 用户难过了就停下来，先接住 TA 的情绪
- 不评判对错和真假
- 不提产品功能
- 不自称 AI、助手或机器人
- 不一次问两个不相干的问题
- 不输出 JSON 或结构化数据
- 绝不主动问"XX还在吗？""TA现在怎么样了？"这类涉及生死的问题

## ★ 时间和地点（重要）

每一道味道都要有「来处」，所以你要在对话早期（前 1-2 轮）自然地把"什么时候、在哪儿"带出来：

- 开场就温和地问：「{entryCtx || "这道菜"}！这个好——你脑海里第一个冒出来的画面，大概是什么时候、在哪儿的事儿呀？」
- ★ 时间要尽量锚定到具体年份（如 1998 年、2005 年左右）。用户说"小时候""几年前"时，可以温和追问：「大概是哪一年的事？九几年还是零几年？」帮 TA 把模糊记忆落到年份上
- 如果用户说"X年前"，你可以帮 TA 算：「现在是${new Date().getFullYear()}年，那大概是${new Date().getFullYear() - 10}年前后的事对吧？」——用当前日历信息帮 TA 定位
- ★ 实在想不起具体年份的，记为「未知」，不强求，不破坏聊天节奏
- **地点必须挖到「城市」级**。用户说"外婆家""老家"时，温和地问是哪个市
- 追问城市的最好方式：用家族籍贯当锚点（"是在{relatedHometown}那边吧？"），让用户点头或补一句
- 把"问时间地点"包装成"想和你一起回到那个画面"，语气永远不会生硬

## 你关心什么

在聊天中你自然关注这些方面（不要求全聊到，但时间和地点要早聊）：

- 这道菜：什么味道、什么样子、有什么特别的印象
- 谁做的：谁最拿手、有什么小习惯、说过什么话
- 什么时候：什么年代、什么季节、什么场合、用户当时多大
- 在哪里：★ 哪个城市、什么场所、周围什么画面
- 感受和故事：什么心情、有没有难忘的事、对用户意味着什么
- 其他菜：用户提到的其他吃食

## 上下文信息

当前家族：${familyName}（${familySurname}家）
家谱成员：${treeSummary}
关联人物籍贯：${relatedHometown}  ← 追问城市时优先用它当锚点
已有锚点：${existingAnchors}
灰锚点信息：${grayAnchors}
入口类型：${entryType}
入口上下文：${entryCtx}

## 对话状态

已收集信息：见下方状态
已锚定时间：${timeLocked}（${era}）
已锚定城市：${state?.city ? '已锚定' : '未锚定'}（${city}）
未覆盖维度：${uncovered}
当前情绪状态：${emoState}`;
}

// ── §13.4 时空抽取（轻量调用）──
async function extractState(userMsg: string, assistantReply: string, prevState: any, relatedHometown: string) {
  const currentYear = new Date().getFullYear();
  const extractionPrompt = `Extract era (time period) and city from this conversation about a food memory. Return ONLY a JSON object (no markdown, no explanation).

Key extraction rules:
- If the user mentions a specific year, use it directly as "era" (e.g. "1998年" → era:"1998")
- If the user says "X years ago" or "X年前", CALCULATE: ${currentYear} - X = the approximate year, and use that as "era"
- If the user gives a vague time like "小时候" or "我上学的时候", try to estimate: if they were ~10 years old, era = birth_year_estimate; otherwise set era to null
- If absolutely no time reference can be extracted, set era to null

Previous state: ${JSON.stringify(prevState || {})}
Related person's hometown (use as anchor for city guessing): ${relatedHometown || "unknown"}

User: ${userMsg}
Assistant: ${assistantReply}

Return JSON: {"era":"..."|null,"city":"..."|null,"era_detail":"..."|null,"city_confidence":"confirmed"|"guessed"|"unknown","venue":"..."|null,"season":"..."|null}`;

  const data = await callGLM(
    [{ role: "system", content: "You are a state extraction tool. Return ONLY valid JSON." },
     { role: "user", content: extractionPrompt }],
    0.1, 256
  );
  const text = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    // Clean markdown wrappers
    const jsonStr = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}

// ── 主处理 ──
async function handleChat(body: any, userId: string) {
  const { conversation_id, user_message, context } = body;
  if (!conversation_id || !user_message) {
    return { ok: false, error: "conversation_id and user_message required" };
  }

  // 从 DB 加载对话
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const srKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  async function pg(path: string, opts: any = {}) {
    const url = `${supabaseUrl}/rest/v1/${path}`;
    const headers: any = {
      "apikey": srKey,
      "Authorization": `Bearer ${srKey}`,
      "Content-Type": "application/json",
      ...opts.headers,
    };
    if (opts.prefer) headers["Prefer"] = opts.prefer;
    const resp = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      throw new Error(`DB error: ${resp.status} ${err}`);
    }
    const text = await resp.text();
    return text ? JSON.parse(text) : null;
  }

  // 验证对话归属
  const conv = await pg(`conversations?id=eq.${conversation_id}&select=*`);
  if (!conv || conv.length === 0) return { ok: false, error: "对话不存在" };
  if (conv[0].user_id !== userId) return { ok: false, error: "无权访问该对话" };

  // 加载历史消息
  const msgs = await pg(`conversation_messages?conversation_id=eq.${conversation_id}&order=created_at`);
  const history = (msgs || []).map((m: any) => ({ role: m.role, content: m.content }));

  // 当前状态
  let currentState = conv[0].state || {};
  if (!currentState.dimensions_covered) {
    currentState = {
      food: {}, people: {}, scene: { location: {} },
      emotion: {}, related_foods: [],
      dimensions_covered: {},
      time_location_locked: false,
      conversation_turns: 0,
      emotional_state: "normal"
    };
  }
  currentState.conversation_turns = (currentState.conversation_turns || 0) + 1;

  // 构建 System Prompt
  const ctx = context || {};
  const systemPrompt = buildSystemPrompt(ctx, currentState);

  // 组装 messages
  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-20), // 最近 20 条，避免上下文过长
    { role: "user", content: user_message },
  ];

  // 调用 GLM
  const glmData = await callGLM(messages, 0.8, 2048);
  const reply = glmData?.choices?.[0]?.message?.content ?? "";

  // §13.4 时空抽取
  const relatedHometown = ctx.related_person_hometown || "";
  const extracted = await extractState(user_message, reply, currentState, relatedHometown);

  // 更新状态
  if (extracted.era) {
    currentState.era = extracted.era;
    if (!currentState.scene) currentState.scene = {};
    currentState.scene.era = extracted.era;
  }
  if (extracted.era_detail) {
    currentState.era_detail = extracted.era_detail;
    currentState.scene!.era_detail = extracted.era_detail;
  }
  if (extracted.city) {
    currentState.city = extracted.city;
    if (!currentState.scene) currentState.scene = {};
    if (!currentState.scene.location) currentState.scene.location = {};
    currentState.scene.location.city = extracted.city;
    currentState.scene.location.city_confidence = extracted.city_confidence || "confirmed";
  }
  if (extracted.venue) {
    if (!currentState.scene) currentState.scene = {};
    if (!currentState.scene.location) currentState.scene.location = {};
    currentState.scene.location.venue = extracted.venue;
  }
  if (extracted.season) {
    if (!currentState.scene) currentState.scene = {};
    currentState.scene.season = extracted.season;
  }
  // 时空是否锚定：era 和 city 都有了才算
  currentState.time_location_locked = !!(currentState.era && currentState.city);

  // 落库：user message
  await pg("conversation_messages", {
    method: "POST",
    body: { conversation_id, role: "user", content: user_message },
    prefer: "return=minimal",
  });

  // 落库：assistant message
  await pg("conversation_messages", {
    method: "POST",
    body: {
      conversation_id, role: "assistant", content: reply,
      metadata: {
        reasoning: glmData?.choices?.[0]?.message?.reasoning_content || null,
        era_extracted: !!extracted.era,
        city_extracted: !!extracted.city,
      },
    },
    prefer: "return=minimal",
  });

  // 更新 conversation state
  await pg(`conversations?id=eq.${conversation_id}`, {
    method: "PATCH",
    body: { state: currentState, updated_at: new Date().toISOString() },
    prefer: "return=minimal",
  });

  // CTA：时空足够 + 3 轮以上即可
  const ctaReady = currentState.time_location_locked && currentState.conversation_turns >= 3;

  return {
    ok: true,
    reply,
    state: currentState,
    cta_ready: ctaReady,
    reasoning: glmData?.choices?.[0]?.message?.reasoning_content ?? null,
    usage: glmData?.usage ?? null,
  };
}

// ── 入口 ──
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return json({ ok: false, error: "invalid JSON body" }, 400);
  }

  // 从 JWT 取 userId
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  let userId = "";
  try {
    // base64url → base64
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    userId = payload.sub || "";
  } catch {
    return json({ ok: false, error: "invalid token" }, 401);
  }

  try {
    const result = await handleChat(body, userId);
    return json(result, result.ok ? 200 : 403);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
