// 无头渲染每个页面组件，捕获 render 期抛错（不跑 effect，故不需真实后端）
import { readFileSync } from 'fs';
import babel from '@babel/standalone';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const html = readFileSync('一家食光.html', 'utf8');
// 各 babel 块在浏览器里是独立 <script>（独立作用域），靠 window 互通 → 逐块独立编译/执行
const blocks = [...html.matchAll(/<script type="text\/babel">([\s\S]*?)<\/script>/g)].map(m => m[1]);
const compiled = blocks.map(b => {
  const s = b.replace(/const root = ReactDOM\.createRoot[\s\S]*$/, 'window.__SCREENS = SCREENS;');
  return babel.transform(s, { presets: ['react'], sourceType: 'script' }).code;
});

// 伪 window / 全局
const noop = () => {};
const stubApiNS = new Proxy({}, { get: () => (async () => ({ ok:true, data:[] })) });
const win = {
  SUPABASE_URL: 'http://x', SUPABASE_ANON_KEY: 'x',
  __famCtx: { id: 'fam1' }, __p11ctx:{id:'a1'}, __p30ctx:{type:'new'}, __memberCtx:{id:'m1',familyId:'fam1'},
  __editMemoryCtx:{id:'a1',isOwner:true}, __editMemCtx:{id:'m1',familyId:'fam1'}, __capsuleCtx:{id:'c1'}, __joinCode:'ABC123',
  addEventListener: noop, removeEventListener: noop, location:{hash:'',pathname:'/',search:''}, history:{replaceState:noop},
  innerWidth: 390, matchMedia: ()=>({matches:false,addListener:noop,removeListener:noop}),
  sb: {
    auth: { getUser: async()=>({data:{user:{id:'u1'}}}), getSession: async()=>({data:{session:{access_token:'t'}}}) },
    from: () => { const chain = new Proxy(function(){}, { get:(t,p)=>{ if(p==='then') return undefined; return (...a)=>chain; }, apply:()=>chain }); return chain; },
    storage: { from: () => ({ upload: async()=>({}), getPublicUrl: ()=>({data:{publicUrl:''}}), remove: async()=>({}) }) },
    rpc: async()=>({data:[]}),
  },
};
// api 各命名空间方法都返回安全 promise
win.api = new Proxy({}, { get: () => stubApiNS });
global.window = win;
global.document = { getElementById:()=>({}), createElement:()=>({ style:{}, setAttribute:noop, appendChild:noop }), body:{ appendChild:noop, removeChild:noop }, addEventListener:noop };
const navigatorStub = { clipboard:{ writeText:async()=>{} } };
const ReactDOMStub = { createRoot: ()=>({ render: noop }) };
const documentStub = { getElementById:()=>({}), createElement:()=>({ style:{}, setAttribute:noop, appendChild:noop }), body:{ appendChild:noop, removeChild:noop }, addEventListener:noop };

// 逐块运行（每块独立作用域，与浏览器一致；靠 win 互通）
for (const code of compiled) {
  new Function('React','ReactDOM','window','document','navigator', code)(React, ReactDOMStub, win, documentStub, navigatorStub);
}

const SCREENS = win.__SCREENS || [];
console.log('共', SCREENS.length, '个页面');
let bad = 0;
for (const s of SCREENS) {
  try { renderToStaticMarkup(React.createElement(s.Comp)); }
  catch (e) { bad++; console.log(`❌ ${s.id} (${s.label}): ${String(e.message||e).split('\n')[0]}`); }
}
console.log(bad ? `\n${bad} 个页面 render 抛错` : '\n✅ 所有页面 render 通过');
