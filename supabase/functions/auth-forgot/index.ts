// supabase/functions/auth-forgot/index.ts
// Phase 1.3 · 密保找回（service role：读他人 profile + admin 改密）。
// 纯 fetch，无任何外部 import（避免冷启动拉 esm.sh 不稳 → BOOT_ERROR）。
// 密保问题固定「你小时候最爱吃的一道菜叫什么？」；业务错误统一 200 {ok:false}。

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
}
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function b64u(s) { return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function b64uDec(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return atob(s); }
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const SUPA_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPA_URL || !SERVICE) return json({ ok: false, error: "服务端未配置" }, 500);

  let body = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "无效请求" }, 400); }

  const adminH = { apikey: SERVICE, Authorization: "Bearer " + SERVICE };
  // service-role 查 profile（绕 RLS）
  async function findProfile(username, select) {
    const r = await fetch(SUPA_URL + "/rest/v1/profiles?username=eq." + encodeURIComponent(username) + "&select=" + select, { headers: adminH });
    if (!r.ok) return null;
    const arr = await r.json();
    return Array.isArray(arr) && arr.length ? arr[0] : null;
  }

  if (body.action === "verify-answer") {
    const username = String(body.username || "").trim();
    const answer = String(body.answer || "");
    if (!username || !answer) return json({ ok: false, error: "请填写用户名和密保答案" });
    const prof = await findProfile(username, "security_answer_hash");
    const matched = prof && prof.security_answer_hash === await sha256Hex(answer.trim());
    if (!matched) return json({ ok: false, error: "用户名或密保答案错误" });
    const exp = Date.now() + 10 * 60 * 1000;
    const payload = b64u(JSON.stringify({ u: username, exp }));
    const sig = await hmacHex(SERVICE, payload);
    return json({ ok: true, token: payload + "." + sig });
  }

  if (body.action === "reset") {
    const token = String(body.token || "");
    const newPassword = String(body.newPassword || "");
    if (!token) return json({ ok: false, error: "无效 token" });
    if (newPassword.length < 6) return json({ ok: false, error: "新密码至少 6 位" });
    const parts = token.split(".");
    if (parts.length !== 2) return json({ ok: false, error: "无效 token" });
    if ((await hmacHex(SERVICE, parts[0])) !== parts[1]) return json({ ok: false, error: "无效 token" });
    let claims; try { claims = JSON.parse(b64uDec(parts[0])); } catch { return json({ ok: false, error: "无效 token" }); }
    if (!claims.exp || Date.now() > claims.exp) return json({ ok: false, error: "验证已过期，请重新找回" });
    const prof = await findProfile(claims.u, "id");
    if (!prof) return json({ ok: false, error: "账号不存在" });
    const r = await fetch(SUPA_URL + "/auth/v1/admin/users/" + prof.id, {
      method: "PUT",
      headers: Object.assign({}, adminH, { "Content-Type": "application/json" }),
      body: JSON.stringify({ password: newPassword })
    });
    if (!r.ok) { const t = await r.text(); return json({ ok: false, error: "重置失败：" + t.slice(0, 150) }, 502); }
    return json({ ok: true });
  }

  return json({ ok: false, error: "未知 action" }, 400);
});
