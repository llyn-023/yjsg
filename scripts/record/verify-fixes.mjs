// verify-fixes.mjs — 真实环境验证 4 个 bug 修复（截图取证）
// 先 node scripts/seed-demo.mjs，再 node scripts/record/verify-fixes.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SHOTS = path.join(__dirname, 'verify'); fs.mkdirSync(SHOTS, { recursive:true });

// env
const env={}; for(const l of fs.readFileSync(path.join(ROOT,'.env.local'),'utf8').split('\n')){const m=l.match(/^(\w+)=(.*)/);if(m)env[m[1]]=m[2].trim();}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Bug3 测试数据：给灰锚点「爷爷的腊味煲仔饭」补一个同名 lit → 它应从「还有人在等」消失
const { data: fam } = await admin.from('families').select('id,creator_id').eq('name','TEST_陈家味道').single();
await admin.from('anchors').delete().eq('family_id',fam.id).eq('name','爷爷的腊味煲仔饭').eq('status','lit'); // 幂等
await admin.from('anchors').insert({ family_id:fam.id, name:'爷爷的腊味煲仔饭', status:'lit', city:'广州', era:'1995', text:'砂锅底那层焦香的锅巴。', created_by:fam.creator_id });
console.log('已为 Bug3 造数据：lit「爷爷的腊味煲仔饭」（应使同名灰锚点从「还有人在等」消失）');

// static server
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json'};
const srv=http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/一家食光.html'; const fp=path.join(ROOT,p); if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end();return;} res.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'}); fs.createReadStream(fp).pipe(res); });
await new Promise(r=>srv.listen(5597,r));
const BASE='http://localhost:5597/%E4%B8%80%E5%AE%B6%E9%A3%9F%E5%85%89.html';

const b=await chromium.launch({headless:true}); const ctx=await b.newContext({viewport:{width:430,height:932},deviceScaleFactor:2});
await ctx.addInitScript(()=>{const s=document.createElement('style');s.textContent='div[style*="z-index:999999"]{display:none!important;}';(document.head||document.documentElement).appendChild(s);});
const page=await ctx.newPage();
let bugErr=null; page.on('pageerror',e=>{ bugErr=e.message; });
const pause=(ms)=>page.waitForTimeout(ms);
const shot=(n)=>page.screenshot({path:path.join(SHOTS,n+'.png')});
const hide=()=>page.evaluate(()=>document.querySelectorAll('div[style*="z-index:999999"]').forEach(e=>e.remove())).catch(()=>{});

await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.api&&window.api.auth,{timeout:60000});
await page.waitForFunction(()=>document.body.innerText.includes('立即注册'),{timeout:20000});
await page.getByPlaceholder('用户名').first().fill('test_demo_a'); await page.getByPlaceholder('密码').first().fill('demo1234');
await page.getByText('登 录').click();
await page.waitForFunction(()=>document.body.innerText.includes('找到你的家族'),{timeout:20000});
await page.waitForFunction(()=>/已加入\s*[1-9]/.test(document.body.innerText),{timeout:15000});
await page.getByText('查看已加入家族').click(); await pause(700);
await page.getByText('TEST_陈家味道').click();
await page.waitForFunction(()=>location.hash.includes('P10'),{timeout:15000}); await hide(); await pause(1500);

// ---- Bug3: P10「还有人在等」不含「爷爷的腊味煲仔饭」----
const grayHasLao = await page.evaluate(()=>{ const idx=document.body.innerText.indexOf('还有人在等'); return idx>=0 ? document.body.innerText.slice(idx).includes('爷爷的腊味煲仔饭') : false; });
console.log('Bug3 「还有人在等」是否仍含已点亮的「爷爷的腊味煲仔饭」:', grayHasLao, grayHasLao?'❌ 仍在(未修)':'✅ 已消失');
await shot('p10-gray');

// ---- Bug1: P62 时间胶囊列表 = 真实数据 ----
await page.evaluate(()=>{ window.location.hash='P62'; }); await pause(2200); await hide();
const capReal = await page.evaluate(()=>({ has真:document.body.innerText.includes('给志远的成年礼'), hasMock:document.body.innerText.includes('给女儿十八岁的老味道') }));
console.log('Bug1 P62 含真实胶囊「给志远的成年礼」:', capReal.has真?'✅':'❌', '| 含 mock:', capReal.hasMock?'❌仍是mock':'✅无mock');
await shot('p62-capsules');

// ---- Bug2: P50 我的记忆可点开 + 列表 ----
await page.evaluate(()=>{ window.location.hash='P50'; }); await pause(2200); await hide();
await page.getByText('我的记忆').first().click().catch(()=>{}); await pause(1200); await hide();
const myMemList = await page.evaluate(()=>({ hasSheet:document.body.innerText.includes('我的已点亮记忆'), hasHongshao:document.body.innerText.includes('奶奶的红烧肉'), hasGui:document.body.innerText.includes('妈妈的桂花糖藕') }));
console.log('Bug2 我的记忆面板:', myMemList.hasSheet?'✅打开':'❌', '| 列出已点亮记忆:', (myMemList.hasHongshao||myMemList.hasGui)?'✅':'❌');
await shot('p50-mymems');

// ---- Bug4: P31 卡片名兜底——AI 无提取内容时取钩子原名（hookName）----
await page.evaluate(()=>{ sessionStorage.setItem('p31ctx', JSON.stringify({ story:{ food:{}, scene:{}, emotion:{} }, hookName:'外婆的冰酒', familyId:null })); window.location.hash='P31'; });
await pause(2000); await hide();
const bug4 = await page.evaluate(()=>({ hasName:document.body.innerText.includes('外婆的冰酒'), hasUnknown:/^\s*未知\s*$/m.test(document.body.innerText) }));
console.log('Bug4 P31 卡片名兜底取钩子名「外婆的冰酒」:', bug4.hasName?'✅':'❌（仍是未知）');
await shot('p31-bug4');

console.log('\n页面 render 错误:', bugErr||'无');
await ctx.close(); await b.close(); srv.close();
// 清掉 Bug3 测试数据
await admin.from('anchors').delete().eq('family_id',fam.id).eq('name','爷爷的腊味煲仔饭').eq('status','lit');
console.log('已清理 Bug3 测试数据');
