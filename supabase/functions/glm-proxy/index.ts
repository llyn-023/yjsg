// supabase/functions/glm-proxy/index.ts
// Phase 4.1 · 智谱 GLM 统一代理（所有 AI 调用走此处，密钥仅存服务端）。
// 调用方传入 messages + 可选参数；返回 GLM 原始 choices[0].message。

const GLM_BASE = Deno.env.get("GLM_BASE_URL") ?? "https://open.bigmodel.cn/api/paas/v4";
const ENDPOINT = `${GLM_BASE}/chat/completions`;
const TIMEOUT_MS = 25_000;

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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const apiKey = Deno.env.get("GLM_API_KEY");
  const model = Deno.env.get("GLM_MODEL") ?? "glm-5.1";

  if (!apiKey) {
    return json({ ok: false, error: "GLM_API_KEY not configured" }, 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid JSON body" }, 400);
  }

  const messages = body.messages;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return json({ ok: false, error: "messages is required (non-empty array)" }, 400);
  }

  const temperature = typeof body.temperature === "number" ? body.temperature : 0.8;
  const maxTokens = typeof body.max_tokens === "number" ? body.max_tokens : 2048;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return json({ ok: false, error: `GLM HTTP ${resp.status}`, detail: errText.slice(0, 500) }, 502);
    }

    const data = await resp.json();
    const msg = data?.choices?.[0]?.message ?? {};
    const reply = msg.content ?? "";
    return json({
      ok: true,
      model: data.model ?? model,
      reply,
      reasoning: msg.reasoning_content ?? null,
      usage: data?.usage ?? null,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === "AbortError") {
      return json({ ok: false, error: "GLM timeout" }, 504);
    }
    return json({ ok: false, error: String(e) }, 500);
  }
});
