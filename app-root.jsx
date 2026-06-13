// app-root.jsx — Design Canvas 画廊框架 + App 根组件

const SCREENS = [
  { id:'P0', group:'认证与入伙', label:'启动页',      sub:'Splash',       Comp: ()=>window.P0_Splash  && React.createElement(P0_Splash) },
  { id:'P1', group:'认证与入伙', label:'登录',         sub:'Login',        Comp: ()=>window.P1_Login   && React.createElement(P1_Login) },
  { id:'P2', group:'认证与入伙', label:'入伙引导',     sub:'Family Entry', Comp: ()=>window.P2_Family  && React.createElement(P2_Family) },
  { id:'P3', group:'认证与入伙', label:'找到我的位置', sub:'Identity',     Comp: ()=>window.P3_Position&& React.createElement(P3_Position) },
];

const PW = 390, PH = 844;

function App() {
  // ── 路由 & 过渡 ─────────────────────────────────────
  const initId = () => {
    const h = window.location.hash.slice(1);
    return SCREENS.find(s=>s.id===h) ? h : 'P0';
  };
  const [screenId, setScreenId] = React.useState(initId);
  const [dir,      setDir]      = React.useState('fwd'); // fwd | bwd
  const [animKey,  setAnimKey]  = React.useState(0);

  // ── Toast ───────────────────────────────────────────
  const [toast, setToast] = React.useState({ msg:'', on:false });
  const toastRef = React.useRef();
  function showToast(msg) {
    clearTimeout(toastRef.current);
    setToast({ msg, on:true });
    toastRef.current = setTimeout(()=>setToast(t=>({...t,on:false})), 2200);
  }

  const curIdx = SCREENS.findIndex(s=>s.id===screenId);

  function navigate(id, forceDir) {
    const idx = SCREENS.findIndex(s=>s.id===id);
    const d = forceDir ?? (idx >= curIdx ? 'fwd' : 'bwd');
    setDir(d); setAnimKey(k=>k+1); setScreenId(id);
    window.history.replaceState(null,'','#'+id);
  }

  // ── 键盘导航 ────────────────────────────────────────
  React.useEffect(()=>{
    const h = e => {
      if (e.key==='ArrowRight'||e.key==='ArrowDown') {
        const n = SCREENS[curIdx+1]; if(n) navigate(n.id,'fwd');
      }
      if (e.key==='ArrowLeft'||e.key==='ArrowUp') {
        const n = SCREENS[curIdx-1]; if(n) navigate(n.id,'bwd');
      }
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[curIdx]);

  // ── 舞台缩放 ────────────────────────────────────────
  const [scale, setScale] = React.useState(1);
  const stageRef = React.useRef();
  React.useEffect(()=>{
    const upd = ()=>{
      if (!stageRef.current) return;
      const {clientWidth:sw, clientHeight:sh} = stageRef.current;
      setScale(Math.min((sw-80)/PW, (sh-60)/PH, 1));
    };
    upd();
    const ro = new ResizeObserver(upd);
    if(stageRef.current) ro.observe(stageRef.current);
    return ()=>ro.disconnect();
  },[]);

  const info = SCREENS[curIdx];
  const groups = [...new Set(SCREENS.map(s=>s.group))];
  const ctx = { navigate, showToast };

  const CurComp = SCREENS[curIdx]?.Comp;

  return (
    <AppContext.Provider value={ctx}>
      <div style={{ display:'flex', width:'100vw', height:'100dvh', overflow:'hidden', fontFamily:'"PingFang SC","Hiragino Sans GB",-apple-system,system-ui,sans-serif' }}>

        {/* ══════════ 左侧目录 ══════════ */}
        <aside style={{ width:210, flexShrink:0, background:'#142820', display:'flex', flexDirection:'column', borderRight:'1px solid rgba(255,255,255,0.055)' }}>
          {/* 品牌标题 */}
          <div style={{ padding:'22px 20px 16px', borderBottom:'1px solid rgba(255,255,255,0.065)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:4 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" fill="rgba(40,91,78,0.5)" stroke="rgba(184,214,203,0.4)" strokeWidth="1"/>
                <path d="M5 11h14M6.5 11c0 4 2.5 6 5.5 6s5.5-2 5.5-6" stroke="#A8D4C2" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M10 8c0-1.2.8-2 2-2s2 .8 2 2" stroke="#A8D4C2" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <div style={{ fontFamily:'"ZCOOL XiaoWei",serif', fontSize:17, color:'#A8D4C2', letterSpacing:3 }}>一家食光</div>
            </div>
            <div style={{ fontSize:9.5, color:'rgba(255,255,255,0.26)', letterSpacing:1.5, marginLeft:33 }}>
              DESIGN CANVAS · BATCH 01
            </div>
          </div>

          {/* 导航列表 */}
          <div style={{ flex:1, overflowY:'auto', padding:'10px 0' }}>
            {groups.map(g=>(
              <div key={g}>
                <div style={{ padding:'10px 20px 4px', fontSize:9.5, fontWeight:700, letterSpacing:2, color:'rgba(255,255,255,0.26)', textTransform:'uppercase' }}>
                  {g}
                </div>
                {SCREENS.filter(s=>s.group===g).map(s=>{
                  const active = screenId===s.id;
                  return (
                    <button key={s.id} onClick={()=>navigate(s.id)} style={{
                      width:'100%', padding:'10px 20px', border:'none', cursor:'pointer',
                      background: active ? 'rgba(168,212,194,0.11)' : 'transparent',
                      borderLeft: `3px solid ${active?'#7BAF9A':'transparent'}`,
                      display:'flex', alignItems:'center', gap:10, textAlign:'left',
                      transition:'all 0.15s',
                    }}>
                      {/* 屏编号 badge */}
                      <div style={{ width:26, height:26, borderRadius:7, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, letterSpacing:0, background: active?'#285B4E':'rgba(255,255,255,0.07)', color: active?'#A8D4C2':'rgba(255,255,255,0.28)' }}>
                        {s.id}
                      </div>
                      <div>
                        <div style={{ fontSize:13, color: active?'#E8F4EF':'rgba(255,255,255,0.56)', fontWeight: active?600:400 }}>{s.label}</div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.22)', marginTop:1 }}>{s.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* 底部提示 */}
          <div style={{ padding:'10px 20px 16px', borderTop:'1px solid rgba(255,255,255,0.055)' }}>
            <div style={{ display:'flex', gap:5, alignItems:'center', marginBottom:6 }}>
              {['←','→'].map(k=>(
                <kbd key={k} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 6px', fontSize:11, color:'rgba(255,255,255,0.28)', fontFamily:'monospace' }}>{k}</kbd>
              ))}
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.2)', marginLeft:3 }}>切换屏幕</span>
            </div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.18)' }}>
              {curIdx+1} / {SCREENS.length} 屏 · 点击画布内可交互
            </div>
          </div>
        </aside>

        {/* ══════════ 右侧舞台 ══════════ */}
        <main ref={stageRef} style={{
          flex:1, position:'relative', overflow:'hidden',
          background:'#E5E5E0',
          backgroundImage:'radial-gradient(rgba(0,0,0,0.07) 1px,transparent 1px)',
          backgroundSize:'22px 22px',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          {/* 屏名 + 尺寸标签 */}
          <div style={{ position:'absolute', top:16, left:16, right:16, display:'flex', justifyContent:'space-between', pointerEvents:'none', zIndex:10 }}>
            <div style={{ background:'rgba(255,255,255,0.88)', backdropFilter:'blur(8px)', borderRadius:8, padding:'6px 12px', fontSize:12, color:'#4A4A42', display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontWeight:700, color:'#1E1E18' }}>{info?.label}</span>
              <span style={{ color:'#B8B8AE' }}>—</span>
              <span style={{ color:'#A0A098', fontSize:11 }}>390 × 844 pt</span>
            </div>
            <div style={{ background:'rgba(255,255,255,0.88)', backdropFilter:'blur(8px)', borderRadius:8, padding:'6px 12px', fontSize:11, color:'#A0A098' }}>
              {curIdx+1} / {SCREENS.length}
            </div>
          </div>

          {/* 左右翻页箭头 */}
          {curIdx > 0 && (
            <button onClick={()=>navigate(SCREENS[curIdx-1].id,'bwd')} style={{ position:'absolute', left:16, width:40, height:40, borderRadius:'50%', background:'rgba(255,255,255,0.9)', border:'none', cursor:'pointer', fontSize:22, color:'#5A5A52', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 10px rgba(0,0,0,0.1)', zIndex:10 }}>‹</button>
          )}
          {curIdx < SCREENS.length-1 && (
            <button onClick={()=>navigate(SCREENS[curIdx+1].id,'fwd')} style={{ position:'absolute', right:16, width:40, height:40, borderRadius:'50%', background:'rgba(255,255,255,0.9)', border:'none', cursor:'pointer', fontSize:22, color:'#5A5A52', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 10px rgba(0,0,0,0.1)', zIndex:10 }}>›</button>
          )}

          {/* ══ 手机外壳 ══ */}
          <div style={{
            width:PW, height:PH,
            transform:`scale(${scale})`, transformOrigin:'center center',
            borderRadius:52, overflow:'hidden',
            boxShadow:'0 40px 100px rgba(0,0,0,0.28), 0 8px 30px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.06)',
            position:'relative', background:'#FAF7F2',
          }}>
            {/* Dynamic Island */}
            <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:126, height:38, background:'#080808', borderRadius:'0 0 22px 22px', zIndex:20 }}/>

            {/* 屏幕过渡层 */}
            <div key={animKey} className={dir==='fwd'?'slide-in-right':'slide-in-left'} style={{ width:'100%', height:'100%', position:'relative' }}>
              {CurComp && <CurComp />}
            </div>

            {/* Toast（在手机内浮层）*/}
            <Toast message={toast.msg} visible={toast.on} />
          </div>
        </main>
      </div>
    </AppContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
