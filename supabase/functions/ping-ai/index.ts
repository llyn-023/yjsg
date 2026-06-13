// supabase/functions/ping-ai/index.ts
// Phase 0.3 · 验证 Edge Function → GLM 连通。
// 密钥（GLM_API_KEY）只存在于服务端 secrets，前端永远拿不到。

// 编程套餐（coding plan）走 /api/coding/paas/v4；标准按量计费走 /api/paas/v4。
// 可用 GLM_BASE_URL secret 切换，免重新部署。
const GLM_BASE = Deno.env.get("GLM_BASE_URL") ?? "https://open.bigmodel.cn/api/coding/paas/v4";
const GLM_ENDPOINT = `${GLM_BASE}/chat/completions`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

Deno.serve(async (req: Request) => {
  // 预检
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const apiKey = Deno.env.get("GLM_API_KEY");
  const model = Deno.env.get("GLM_MODEL") ?? "glm-5.1";

  if (!apiKey) {
    return json({ ok: false, error: "GLM_API_KEY secret 未配置" }, 500);
  }

  try {
    const resp = await fetch(GLM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是「食光小记」，一家食光家族记忆的向导。用一句话、温暖、不自称 AI 地打招呼。" },
          { role: "user", content: "你好，验证一下连通。" },
        ],
        temperature: 0.8,
        max_tokens: 2048,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return json({ ok: false, error: `GLM HTTP ${resp.status}`, detail: errText }, 502);
    }

    const data = await resp.json();
    const msg = data?.choices?.[0]?.message ?? {};
    const reply = msg.content ?? "(空回复)";
    return json({ ok: true, model, reply, reasoning: msg.reasoning_content ?? null, usage: data?.usage ?? null });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
