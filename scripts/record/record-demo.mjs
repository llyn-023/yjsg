// record-demo.mjs — Playwright 自动录制「一家食光」七幕演示
// 用法：node scripts/record/record-demo.mjs [scene]
//   scene 省略 = 全部；或传 1..7 只跑某幕（调试用）
// 产物：scripts/record/out/*.webm（原始视频）、scripts/record/shots/*.png（每步截图）
// 依赖：playwright、ffmpeg-static（转 mp4 在 build-mp4.mjs）
//
// 设计：app 是状态驱动单页，启动强制停在 P0 并清 hash；加载后 hashchange 监听有效，
// 故顶层页用 hash 跳转兜底，关键动作走真实点击。

import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');           // 项目根
const OUT = path.join(__dirname, 'out');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const PORT = 5599;
const BASE = `http://localhost:${PORT}/%E4%B8%80%E5%AE%B6%E9%A3%9F%E5%85%89.html`; // 一家食光.html（URL编码）

// ───────── 极简静态服务器 ─────────
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.json':'application/json', '.webp':'image/webp', '.gif':'image/gif' };
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      try {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (p === '/') p = '/一家食光.html';
        const fp = path.join(ROOT, p);
        if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('404'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
        fs.createReadStream(fp).pipe(res);
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

// ───────── 账号 / 数据 ─────────
const ACC = {
  a: { u:'test_demo_a', p:'demo1234', name:'陈建国' },
  b: { u:'test_demo_b', p:'demo1234', name:'陈志远' },
  c: { u:'test_demo_c', p:'demo1234', name:'陈晓梅' },
  d: { u:'test_demo_d', p:'demo1234', name:'陈志强' },
};
const FAM_CODE = 'CH2026';

// ───────── helper ─────────
let stepN = 0;
const log = (m) => console.log(`  · ${m}`);
async function shot(page, tag) { stepN++; const f = path.join(SHOTS, `${String(stepN).padStart(2,'0')}_${tag}.png`); await page.screenshot({ path: f }).catch(()=>{}); }
const pace = (page, ms=900) => page.waitForTimeout(ms);

async function waitApp(page) {
  await page.waitForFunction(() => {
    const r = document.getElementById('root');
    return r && r.children.length > 0 && window.api && window.api.auth;
  }, { timeout: 60000 });
  await hideBadge(page);
}
async function hideBadge(page) {
  await page.evaluate(() => {
    document.querySelectorAll('div[style*="z-index:999999"],div[style*="z-index: 999999"]').forEach(e=>e.remove());
  }).catch(()=>{});
}
// 等到登录页（出现「立即注册」）
async function waitLogin(page) {
  await page.waitForFunction(() => document.body.innerText.includes('立即注册'), { timeout: 20000 });
  await hideBadge(page);
}
// 点可见文字（button/div 皆可）。flexible：允许文字中间有空格
async function tap(page, text, { exact=false, nth=0, timeout=15000 }={}) {
  const loc = exact ? page.getByText(text, { exact:true }) : page.locator(`text=${text}`);
  const el = loc.nth(nth);
  await el.waitFor({ state:'visible', timeout });
  await el.scrollIntoViewIfNeeded().catch(()=>{});
  await hideBadge(page);
  try { await el.click({ timeout: 8000 }); }
  catch { await el.click({ force: true, timeout: 5000 }); }   // 动画遮罩拦截时强制点
}
// 逐字打字（显示真实输入动画）
async function typeInto(loc, text, delay=75) {
  await loc.waitFor({ state:'visible', timeout:15000 });
  await loc.scrollIntoViewIfNeeded().catch(()=>{});
  await loc.click().catch(()=>{});
  await loc.pressSequentially(text, { delay });
}
async function fillPH(page, ph, val, delay=70) {
  await typeInto(page.getByPlaceholder(ph).first(), val, delay);
}
// hash 跳顶层页（登录后用），并等动画
async function go(page, id, waitMs=1400) {
  await page.evaluate((i)=>{ window.location.hash = i; }, id);
  await page.waitForTimeout(waitMs);
}
// 关闭当前打开的 BottomSheet（点顶部遮罩区）
async function closeSheet(page) { await page.mouse.click(215, 64).catch(()=>{}); await page.waitForTimeout(500); }
// 登出并重新登录另一账号（最稳：直接调 api.logout + reload）
async function relogin(page, acc) {
  await page.evaluate(()=>{ try{ window.api?.auth?.logout?.(); }catch(e){} }).catch(()=>{});
  await page.goto(BASE, { waitUntil:'domcontentloaded' }); await waitApp(page); await waitLogin(page);
  await pace(page, 500); await login(page, acc);
}
// 设置 window 上下文后 hash 跳页（用于需要 ctx 的页面）
async function ctxGo(page, ctxExpr, id, waitMs=1800) {
  await page.evaluate(({c,i})=>{ eval(c); window.location.hash=i; }, { c:ctxExpr, i:id });
  await page.waitForTimeout(waitMs); await hideBadge(page);
}
// 从 P2 自然点进家族 → 设置 window.__famCtx，落到 P10。之后 hash 跳转各页都有家族上下文。
async function enterFamily(page, famName='TEST_陈家味道') {
  await page.waitForFunction(()=>document.body.innerText.includes('找到你的家族'), { timeout:15000 }).catch(()=>{});
  await page.waitForFunction(()=>/已加入\s*[1-9]/.test(document.body.innerText), { timeout:15000 }); // 等 myFams 加载
  await pace(page, 700);
  await tap(page, '查看已加入家族');
  await page.waitForFunction(()=>document.body.innerText.includes('选择家族'), { timeout:8000 }).catch(()=>{});
  await pace(page, 700);
  await tap(page, famName);
  await page.waitForFunction(()=>location.hash.includes('P10'), { timeout:15000 }).catch(()=>{});
  await hideBadge(page); await pace(page, 1500);
  log(`已进入家族「${famName}」，__famCtx 已设`);
}
async function login(page, acc) {
  log(`登录 ${acc.name}（${acc.u}）`);
  await fillPH(page, '用户名', acc.u);
  await fillPH(page, '密码', acc.p);
  await pace(page, 500);
  await tap(page, '登 录').catch(async()=>{ await page.locator('button', { hasText:/登\s*录/ }).first().click(); });
  // 登录成功 → P2 入伙引导
  await page.waitForFunction(() => location.hash.includes('P2') || document.body.innerText.includes('找到你的家族'), { timeout: 25000 }).catch(()=>{});
  await pace(page, 1200);
}

// ───────── 主流程 ─────────
const ONLY = process.argv[2] ? Number(process.argv[2]) : null;

async function main() {
  const srv = await startServer();
  console.log(`静态服务 ${BASE}`);
  const browser = await chromium.launch({ headless: true, slowMo: 120 });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: { width: 430, height: 932 } },
  });
  // 每次加载（含 reload）都隐藏右上角「Supabase 连通」自检角标
  await context.addInitScript(() => {
    const inject = () => {
      const s = document.createElement('style');
      s.textContent = 'div[style*="z-index:999999"],div[style*="z-index: 999999"]{display:none!important;}';
      (document.head || document.documentElement).appendChild(s);
    };
    if (document.head) inject(); else document.addEventListener('DOMContentLoaded', inject);
  });
  const page = await context.newPage();

  try {
    console.log('\n▶ 打开 app');
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitApp(page);
    log('React 已挂载、window.api 就绪');
    await shot(page, 'loaded');

    // ===== 第①幕 认证 =====
    if (!ONLY || ONLY===1) {
      console.log('\n▶ 第①幕 认证');
      await waitLogin(page);                       // 等启动页自动跳到登录页
      await pace(page, 1400); await shot(page, 'login');
      // 展示注册页
      await tap(page, '立即注册');
      await page.waitForFunction(()=>document.body.innerText.includes('创建账号')||document.body.innerText.includes('注册'), { timeout:10000 }).catch(()=>{});
      await pace(page, 1600); await shot(page, 'register');
      // reload 回到干净登录页
      await page.goto(BASE, { waitUntil:'domcontentloaded' }); await waitApp(page); await waitLogin(page);
      await pace(page, 800);
      // 展示「忘记密码」密保找回面板
      await tap(page, '忘记密码');
      await page.waitForFunction(()=>document.body.innerText.includes('找回密码'), { timeout:10000 }).catch(()=>{});
      await pace(page, 1600); await shot(page, 'forgot');
      // reload 回到干净登录页，真正登录 A
      await page.goto(BASE, { waitUntil:'domcontentloaded' }); await waitApp(page); await waitLogin(page);
      await pace(page, 700);
      await login(page, ACC.a);
      await shot(page, 'after-login');
    } else {
      await waitLogin(page);
      await login(page, ACC.a);
    }

    // 进入家族（设 __famCtx），之后各页 hash 跳转才有数据
    if (!ONLY || ONLY>=2) await enterFamily(page);

    // ===== 第②幕 家谱 + 称谓 =====
    if (!ONLY || ONLY===2) {
      console.log('\n▶ 第②幕 家谱 + 称谓');
      await go(page, 'P20', 2400); await hideBadge(page); await shot(page, 'tree');
      // 展示「添加家人」（按关系定位）面板
      await tap(page, '添加家人').catch(()=>log('添加家人未命中'));
      await pace(page, 1700); await shot(page, 'add-member');
      await closeSheet(page);
      // 点人物节点 → P21 人物详情（显示称谓）
      await tap(page, '陈志远').catch(()=>log('节点 陈志远 未命中'));
      await page.waitForFunction(()=>location.hash.includes('P21'), { timeout:8000 }).catch(()=>{});
      await hideBadge(page); await pace(page, 2200); await shot(page, 'person');
    }

    // ===== 第③幕 多账号·凭码加入（切到 C 认领 陈小雨）=====
    if (!ONLY || ONLY===3) {
      console.log('\n▶ 第③幕 凭码加入（陈晓梅 认领）');
      await relogin(page, ACC.c);   // 落到 P2
      await page.waitForFunction(()=>document.body.innerText.includes('找到你的家族'), { timeout:15000 }).catch(()=>{});
      await pace(page, 1000);
      await tap(page, '加入家族');                       // 打开加入面板
      await pace(page, 1000); await shot(page, 'join-sheet');
      await typeInto(page.getByPlaceholder('输入 6 位代码').first(), FAM_CODE, 220).catch(async()=>{ await typeInto(page.locator('input').last(), FAM_CODE, 220); });
      await pace(page, 800);
      await tap(page, '下一步');                         // → P3
      await page.waitForFunction(()=>location.hash.includes('P3'), { timeout:12000 }).catch(()=>{});
      await hideBadge(page); await pace(page, 1400); await shot(page, 'p3');
      await tap(page, '我就是谱上的某个人').catch(()=>log('claim 入口未命中'));
      await pace(page, 1200); await shot(page, 'p3-claim');
      await tap(page, '陈小雨').catch(()=>log('占位节点 陈小雨 未命中'));
      await pace(page, 1200);
      await tap(page, '完成，进入家族').catch(()=>log('完成按钮 未命中'));
      await page.waitForFunction(()=>location.hash.includes('P20'), { timeout:15000 }).catch(()=>{});
      await hideBadge(page); await pace(page, 2200); await shot(page, 'p3-done');
    }

    // ===== 第⑤幕 AI 对话（切回 A）=====
    if (!ONLY || ONLY===5) {
      console.log('\n▶ 第⑤幕 AI 对话挖掘');
      if (!ONLY) { await relogin(page, ACC.a); await enterFamily(page); }
      await ctxGo(page, "window.__p30ctx={type:'new'}", 'P30', 2200);
      await shot(page, 'chat-open');
      const chatInput = page.locator('input,textarea').last();
      for (const msg of ['外婆的红烧肉', '小时候在扬州外婆家，过年才做，深琥珀色亮晶晶的']) {
        await typeInto(chatInput, msg, 95).catch(()=>{});   // 逐字打字
        await pace(page, 500);
        await tap(page, '发送').catch(()=>{});
        log('已发送：'+msg+'（等 AI 回复…）');
        // 等 AI 回复气泡增加（最多 40s）
        await page.waitForTimeout(1500);
        await page.waitForFunction(()=>!document.body.innerText.includes('正在想'), { timeout:45000 }).catch(()=>{});
        await hideBadge(page); await pace(page, 1800); await shot(page, 'chat-reply');
      }
    }

    // ===== 第④幕 创建者审核（A 在 P52 审核 陈志强）=====
    if (!ONLY || ONLY===4) {
      console.log('\n▶ 第④幕 创建者审核');
      await go(page, 'P52', 2600); await hideBadge(page); await pace(page, 1800); await shot(page, 'mgmt'); // 待审核·1
      // 点待审条目 → 审核面板（confirmMem 渲染 bug 已修）
      await page.getByText('未知', { exact:true }).first().click().catch(()=>log('待审条目 未命中'));
      await page.waitForFunction(()=>document.body.innerText.includes('申请加入家族'), { timeout:8000 }).catch(()=>{});
      await hideBadge(page); await pace(page, 1700); await shot(page, 'review');
      // 通过申请 → 组件内刷新（家人+1、待审核清零）
      await tap(page, '通过申请').catch(()=>log('通过申请 未命中'));
      await page.waitForFunction(()=>document.body.innerText.includes('暂无待审核申请')||/家人\s*·\s*8/.test(document.body.innerText), { timeout:12000 }).catch(()=>{});
      await hideBadge(page); await pace(page, 2200); await shot(page, 'approved'); // 待审核·0 + 陈志强 入列
      log('已通过 陈志强 的加入申请');
    }

    // ===== 第⑥幕 多账号社交：B 补述 =====
    if (!ONLY || ONLY===6) {
      console.log('\n▶ 第⑥幕 多账号社交（B 补述）');
      await relogin(page, ACC.b); await enterFamily(page);
      // 进味道桌，点开「奶奶的红烧肉」记忆 → P11
      await go(page, 'P10', 2600); await hideBadge(page); await shot(page, 'b-home');
      await tap(page, '奶奶的红烧肉').catch(()=>log('记忆 红烧肉 未命中'));
      await page.waitForFunction(()=>location.hash.includes('P11'), { timeout:8000 }).catch(()=>{});
      await hideBadge(page); await pace(page, 1800); await shot(page, 'b-anchor');
      // 补述输入 + 发送（精确定位补述框，避免点到别的按钮）
      const cmtInput = page.getByPlaceholder(/补一句/).first();
      await typeInto(cmtInput, '过年那锅我也馋了好多年，今年想跟着奶奶的方子试试。', 85).catch(()=>{});  // 逐字打字
      await pace(page, 700);
      // 「发送」按钮就在补述框右侧，点最后一个发送
      await page.getByText('发送', { exact:true }).last().click().catch(()=>log('补述发送 未命中'));
      await page.waitForFunction(()=>/补述\s*·\s*[2-9]/.test(document.body.innerText), { timeout:8000 }).catch(()=>{});
      await hideBadge(page); await pace(page, 1800); await shot(page, 'b-comment');
    }

    // ===== 第⑦幕 传承（地图/胶囊/纪念册）+ A 视角 =====
    if (!ONLY || ONLY===7) {
      console.log('\n▶ 第⑦幕 传承');
      await relogin(page, ACC.a); await enterFamily(page);
      for (const [id, name, ms] of [['P60','记忆地图',2600],['P62','时间胶囊',2400],['P40','家族动态',2600]]) {
        await go(page, id, ms); await hideBadge(page);
        log('展示 '+name);
        await shot(page, id);
        await pace(page, 800);
      }
    }

  } catch (e) {
    console.error('\n❌ 录制中断:', e.message);
    await shot(page, 'ERROR');
  } finally {
    await pace(page, 600);
    await context.close();   // 关闭后视频才落盘
    await browser.close();
    srv.close();
    const vids = fs.readdirSync(OUT).filter(f=>f.endsWith('.webm'));
    console.log('\n视频文件:', vids.map(v=>path.join(OUT, v)));
  }
}
main();
