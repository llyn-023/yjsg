// supabase/functions/kinship-rebuild/index.ts
// Phase 2.5.4 · 称谓缓存落库（kinship_cache）
// 入参：{ family_id }
// 流程：校验调用者是该家族成员 → service-role 读 members+relations →
//        移植前端 ke* 引擎推导每一对 ego→alter 称谓 → 全量重建 kinship_cache。
// 称呼是跨模块核心数据：此函数把"推导一次→落库"做实，下游只读 kinship_cache。
// 部署：Management API，verify_jwt=true。

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
}

// ── DB helper（PostgREST，service role 绕 RLS）──
async function pg(path: string, opts: any, srKey: string, supabaseUrl: string) {
  const headers: any = { apikey: srKey, Authorization: `Bearer ${srKey}`, "Content-Type": "application/json" };
  if (opts.prefer) headers["Prefer"] = opts.prefer;
  const resp = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!resp.ok) throw new Error(`DB ${resp.status}: ${await resp.text()}`);
  const t = await resp.text();
  return t ? JSON.parse(t) : null;
}

// ═══ ke* 称谓引擎（与 一家食光.html 同源移植；修正了 classifyBoShu 伯/叔反向 bug）═══
function keBuildGraph(members: any[], relations: any[]) {
  const nodes = new Map(), edges = new Map();
  for (const m of members) {
    nodes.set(m.id, { gender: m.gender, birthDate: m.birth_date || null, birthType: m.birth_type || "solar", createdAt: m.created_at });
    edges.set(m.id, []);
  }
  for (const r of relations) {
    const f = nodes.get(r.from), t = nodes.get(r.to);
    if (!f || !t) continue;
    if (r.type === "parent_of") {
      edges.get(r.to).push({ target: r.from, type: "parent_of", direction: "up", parentGender: f.gender });
      edges.get(r.from).push({ target: r.to, type: "parent_of", direction: "down", parentGender: null });
    } else if (r.type === "spouse_of") {
      edges.get(r.from).push({ target: r.to, type: "spouse_of", direction: "side", parentGender: null });
      edges.get(r.to).push({ target: r.from, type: "spouse_of", direction: "side", parentGender: null });
    }
  }
  return { nodes, edges };
}
function keShortestPath(graph: any, egoId: string, alterId: string) {
  if (egoId === alterId) return [];
  const visited = new Set([egoId]);
  const queue: any[] = [{ nodeId: egoId, path: [] }];
  let best: any = null, bestSide = Infinity;
  while (queue.length) {
    const { nodeId, path } = queue.shift();
    for (const e of (graph.edges.get(nodeId) || [])) {
      if (visited.has(e.target) && e.target !== alterId) continue;
      const nn = graph.nodes.get(e.target);
      if (!nn) continue;
      const step = { direction: e.direction, nodeId: e.target, gender: nn.gender, birthDate: nn.birthDate, parentGender: e.parentGender || null };
      const np = [...path, step];
      if (e.target === alterId) { const sc = np.filter((s: any) => s.direction === "side").length; if (sc < bestSide) { best = np; bestSide = sc; } continue; }
      visited.add(e.target);
      queue.push({ nodeId: e.target, path: np });
    }
  }
  return best;
}
function keAllAncestors(graph: any, nodeId: string) {
  const anc = new Map(), vis = new Set(), q: any[] = [{ nodeId, dist: 0 }];
  while (q.length) {
    const { nodeId: cur, dist } = q.shift();
    if (vis.has(cur)) continue; vis.add(cur);
    for (const e of (graph.edges.get(cur) || [])) if (e.direction === "up") { anc.set(e.target, dist + 1); q.push({ nodeId: e.target, dist: dist + 1 }); }
  }
  return anc;
}
function keFindLCA(graph: any, a: string, b: string) {
  const aa = keAllAncestors(graph, a), ab = keAllAncestors(graph, b);
  let best: any = null, bd = Infinity;
  for (const [id, d1] of aa) if (ab.has(id)) { const d = (d1 as number) + (ab.get(id) as number); if (d < bd) { bd = d; best = id; } }
  return best;
}
function kePathFromAncestor(graph: any, ancId: string, descId: string) {
  const path: any[] = [];
  (function dfs(cur: string, tgt: string, cp: any[], vis: Set<string>): boolean {
    if (cur === tgt) { path.push(...cp); return true; }
    vis.add(cur);
    for (const e of (graph.edges.get(cur) || [])) {
      if (e.direction === "down" && !vis.has(e.target)) {
        const node = graph.nodes.get(e.target); if (!node) continue;
        const pn = graph.nodes.get(cur);
        const step = { direction: "down", nodeId: e.target, gender: node.gender, birthDate: node.birthDate, parentNode: pn, parentGender: pn ? pn.gender : null };
        if (dfs(e.target, tgt, [...cp, step], new Set(vis))) return true;
      }
    }
    return false;
  })(ancId, descId, [], new Set());
  return path;
}
function keCompareAge(ego: any, peer: any) {
  const nd = (m: any) => { if (!m || !m.birth_date) return null; const d = new Date(m.birth_date); return isNaN(d.getTime()) ? null : d; };
  const ed = nd(ego), pd = nd(peer);
  if (ed && pd) return ed < pd ? "ego_older" : "peer_older";
  // 用出生年份结合当前日历对比
  const by = (m: any) => { if (!m || !m.birth_date) return null; const y = parseInt(String(m.birth_date).slice(0,4)); return isNaN(y) ? null : y; };
  const eby = by(ego), pby = by(peer);
  if (eby && pby && eby !== pby) return eby < pby ? "ego_older" : "peer_older"; // ego 出生年份更早 → ego 更年长
  if (ed && !pd) return "ego_older";
  if (!ed && pd) return "peer_older";
  const ec = new Date((ego && ego.created_at) || 0), pc = new Date((peer && peer.created_at) || 0);
  if (isNaN(ec.getTime()) || isNaN(pc.getTime())) return "unknown";
  return ec < pc ? "ego_older" : "peer_older";
}
function keClassifyBoShu(father: any, uncle: any) { return keCompareAge(father, uncle) === "peer_older" ? "伯父" : "叔叔"; }
function keClassifyCousin(graph: any, egoId: string, peerId: string) {
  const lca = keFindLCA(graph, egoId, peerId);
  if (!lca) return "biao";
  const pe = kePathFromAncestor(graph, lca, egoId), pp = kePathFromAncestor(graph, lca, peerId);
  const allP = (p: any[]) => p.length > 0 && p.every((s: any) => s.direction === "down" && s.parentNode && s.parentNode.gender === "male");
  return (allP(pe) && allP(pp)) ? "tang" : "biao";
}
const KE_UP: any = { M: { 1: "父亲", 2: "爷爷", 3: "曾祖父", 4: "高祖父" }, F: { 1: "母亲", 2: "奶奶", 3: "曾祖母", 4: "高祖母" } };
const KE_MUP: any = { M: { 2: "外公", 3: "曾外祖父", 4: "外高祖父" }, F: { 2: "外婆", 3: "曾外祖母", 4: "外高祖母" } };
const KE_DOWN: any = { M: { 1: "儿子", 2: "孙子", 3: "曾孙", 4: "玄孙" }, F: { 1: "女儿", 2: "孙女", 3: "曾孙女", 4: "玄孙女" } };
function keDerive(graph: any, egoId: string, alterId: string, members: any[]) {
  if (egoId === alterId) return "自己";
  const path = keShortestPath(graph, egoId, alterId);
  if (!path || path.length === 0) return "家人";
  if (path.length > 5) return "长辈";
  let up = 0, down = 0, side = 0; const gchain: any[] = [], pg: any[] = [];
  for (const s of path) { gchain.push(s.gender); if (s.direction === "up") { up++; if (s.parentGender) pg.push(s.parentGender); } else if (s.direction === "down") down++; else side++; }
  const ego = graph.nodes.get(egoId), alter = graph.nodes.get(alterId);
  if (!ego || !alter) return "家人";
  const ag = alter.gender === "female" ? "F" : "M";
  const findMem = (id: string) => members.find((m: any) => m.id === id);
  if (side > 0) {
    if (up === 0 && down === 0) return alter.gender === "male" ? "丈夫" : "妻子";
    if (up === 1 && down === 0) {
      // 如果第一步是 up（走到自己的父/母），那么 up+side 就是父/母的配偶 = 自己的另一位父/母
      if (path[0].direction === "up") {
        return path[0].parentGender === "male" ? "母亲" : "父亲";
      }
      // 否则：先走 side（走到配偶）再 up（配偶的父/母）= 岳父/岳母/公公/婆婆
      return alter.gender === "male" ? (ego.gender === "male" ? "岳父" : "公公") : (ego.gender === "male" ? "岳母" : "婆婆");
    }
    if (up === 0 && down === 1) return alter.gender === "male" ? "女婿" : "儿媳";
    return "家人";
  }
  if (up > 0 && down === 0) {
    if (pg[0] === "male") return KE_UP[ag][up] || "长辈";
    if (up === 1) return "母亲";
    return KE_MUP[ag][up] || "长辈";
  }
  if (down > 0 && up === 0) return KE_DOWN[ag][down] || "晚辈";
  if (up === down && up >= 2) {
    const cc = keClassifyCousin(graph, egoId, alterId);
    const ar = keCompareAge(findMem(egoId), findMem(alterId));
    const pre = cc === "tang" ? "堂" : "表";
    return ar === "peer_older" ? pre + (alter.gender === "male" ? "兄" : "姐") : pre + (alter.gender === "male" ? "弟" : "妹");
  }
  if (up === 1 && down === 1) {
    const ar = keCompareAge(findMem(egoId), findMem(alterId));
    if (ar === "peer_older") return alter.gender === "male" ? "哥哥" : "姐姐";
    return alter.gender === "male" ? "弟弟" : "妹妹";
  }
  if (up === 2 && down === 1) {
    const viaFather = path[0].parentGender === "male";
    if (viaFather) {
      if (alter.gender === "male") { const father = findMem(path[0].nodeId), uncle = findMem(alterId); if (father && uncle) return keClassifyBoShu(father, uncle); return "伯父/叔叔"; }
      return "姑姑";
    }
    return alter.gender === "male" ? "舅舅" : "阿姨";
  }
  if (up === 1 && down === 2) {
    const viaBrother = path[0].parentGender === "male";
    if (viaBrother) return alter.gender === "male" ? "侄子" : "侄女";
    return alter.gender === "male" ? "外甥" : "外甥女";
  }
  if (up > down) return "长辈";
  if (up < down) return "晚辈";
  return "家人";
}

// ═══ 入口 ═══
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const srKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
  const familyId = body.family_id;
  if (!familyId) return json({ ok: false, error: "family_id required" }, 400);

  // JWT → userId
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  let userId = "";
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    userId = JSON.parse(atob(b64)).sub || "";
  } catch { return json({ ok: false, error: "invalid token" }, 401); }
  if (!userId) return json({ ok: false, error: "invalid token" }, 401);

  try {
    // 二次校验：调用者必须是该家族成员
    const mine = await pg(`family_members?family_id=eq.${familyId}&user_id=eq.${userId}&select=id`, {}, srKey, supabaseUrl);
    if (!mine || mine.length === 0) return json({ ok: false, error: "无权访问该家族" }, 403);

    // 读 members + relations
    const members = await pg(`family_members?family_id=eq.${familyId}&select=id,gender,birth_date,birth_type,created_at&order=created_at`, {}, srKey, supabaseUrl) || [];
    const relRows = await pg(`family_relations?family_id=eq.${familyId}&select=relation_type,from_member,to_member`, {}, srKey, supabaseUrl) || [];
    const relations = relRows.map((x: any) => ({ type: x.relation_type, from: x.from_member, to: x.to_member }));

    // 推导每一对 ego→alter（跳过自己；"家人"等兜底也存，便于下游统一只读）
    const graph = keBuildGraph(members, relations);
    const rows: any[] = [];
    for (const ego of members) {
      for (const alter of members) {
        if (ego.id === alter.id) continue;
        const term = keDerive(graph, ego.id, alter.id, members);
        rows.push({ family_id: familyId, ego_id: ego.id, alter_id: alter.id, kinship_term: term, updated_at: new Date().toISOString() });
      }
    }

    // 全量重建：先删该家族旧缓存，再批量插入
    await pg(`kinship_cache?family_id=eq.${familyId}`, { method: "DELETE", prefer: "return=minimal" }, srKey, supabaseUrl);
    if (rows.length > 0) {
      await pg("kinship_cache", { method: "POST", body: rows, prefer: "return=minimal" }, srKey, supabaseUrl);
    }

    return json({ ok: true, members: members.length, pairs: rows.length });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
