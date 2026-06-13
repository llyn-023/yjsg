// screen-p2.jsx — P2 入伙引导页（创建/加入家族）
function P2_Family() {
  const { navigate, showToast } = useApp();
  const [sheet, setSheet] = React.useState(null); // 'create' | 'join' | 'created'
  const [fam, setFam] = React.useState({ name:'', surname:'', selfName:'' });
  const [fErr, setFErr] = React.useState({});
  const [code, setCode] = React.useState('');
  const [codeErr, setCodeErr] = React.useState('');

  const VALID = ['YJ2026','ABCD12','HOME01'];

  function handleCreate() {
    const e = {};
    if (!fam.name.trim()) e.name = '请填写家族名称';
    if (!fam.selfName.trim()) e.selfName = '请填写你的称呼';
    if (Object.keys(e).length) { setFErr(e); return; }
    setSheet('created');
  }

  function handleJoin() {
    if (code.length !== 6) { setCodeErr('家族代码为 6 位'); return; }
    if (!VALID.includes(code)) { setCodeErr('代码无效，请向家族成员核实'); return; }
    setSheet(null); navigate('P3');
  }

  return (
    <div style={{ width:'100%', height:'100%', background:C.bg, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>
      <StatusBar />

      {/* 顶部场景插画 */}
      <div style={{ position:'relative', height:210, flexShrink:0, overflow:'hidden' }}>
        <img src="uploads/微信图片_20260611103040_114_20.png" alt=""
          style={{ width:'100%', height:270, objectFit:'cover', objectPosition:'center 18%', display:'block' }}
        />
        {/* 淡出到页面背景色 */}
        <div style={{ position:'absolute', inset:0, background:`linear-gradient(to bottom, rgba(250,247,242,0) 30%, ${C.bg} 100%)` }}/>
        {/* 退出登录按钮 */}
        <button onClick={()=>navigate('P1')} style={{
          position:'absolute', top:10, right:14,
          background:'rgba(255,255,255,0.78)', backdropFilter:'blur(6px)',
          border:'none', borderRadius:20, padding:'6px 14px',
          fontSize:13, color:C.t2, cursor:'pointer', fontFamily:'inherit',
        }}>退出登录</button>

        {/* 食物插画小装饰 — 悬浮在角落 */}
        <div style={{ position:'absolute', bottom:8, right:16, opacity:0.85 }}>
          <div style={{ width:52, height:52, borderRadius:'50%', overflow:'hidden', border:`2px solid rgba(212,234,227,0.9)`, boxShadow:'0 2px 10px rgba(40,91,78,0.15)', background:'#fff' }}>
            <img src="uploads/微信图片_2026-06-11_094349_088.png" alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          </div>
        </div>
      </div>

      {/* 正文内容 */}
      <div style={{ flex:1, overflowY:'auto', padding:'4px 24px 32px', display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <div style={{ fontFamily:'"Noto Serif SC",serif', fontSize:22, fontWeight:700, color:C.primaryDark, marginBottom:6, lineHeight:1.4 }}>
            找到你的家族
          </div>
          <div style={{ fontSize:14, color:C.t2, lineHeight:1.85 }}>
            与家人共同守护那些流传已久的味道与记忆
          </div>
        </div>

        {/* 创建家族 */}
        <button onClick={()=>setSheet('create')} style={{
          width:'100%', padding:'18px 20px', background:C.primary, border:'none',
          borderRadius:18, cursor:'pointer', display:'flex', alignItems:'center', gap:14,
          boxShadow:'0 6px 24px rgba(40,91,78,0.30)', textAlign:'left',
        }}>
          <div style={{ width:54, height:54, background:'rgba(255,255,255,0.14)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {/* 使用一张食物插画做图标 */}
            <div style={{ width:42, height:42, borderRadius:'50%', overflow:'hidden', background:'rgba(255,255,255,0.2)' }}>
              <img src="uploads/微信图片_2026-06-11_094322_572.png" alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:3 }}>创建家族</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.72)' }}>开启一个新的家族记忆空间</div>
          </div>
          <span style={{ color:'rgba(255,255,255,0.45)', fontSize:22 }}>›</span>
        </button>

        {/* 加入家族 */}
        <button onClick={()=>setSheet('join')} style={{
          width:'100%', padding:'18px 20px', background:'#fff',
          border:`1.5px solid ${C.primary100}`, borderRadius:18, cursor:'pointer',
          display:'flex', alignItems:'center', gap:14,
          boxShadow:'0 2px 12px rgba(40,91,78,0.06)', textAlign:'left',
        }}>
          <div style={{ width:54, height:54, background:C.primaryPale, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <div style={{ width:42, height:42, borderRadius:'50%', overflow:'hidden', background:C.primary100 }}>
              <img src="uploads/微信图片_2026-06-11_094332_860.png" alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:700, color:C.primaryDark, marginBottom:3 }}>加入家族</div>
            <div style={{ fontSize:13, color:C.t2 }}>输入家族代码，找到家人</div>
          </div>
          <span style={{ color:C.primary100, fontSize:22 }}>›</span>
        </button>

        <div style={{ textAlign:'center', fontSize:12, color:C.t4, marginTop:2 }}>
          一个账号最多加入 3 个家族
        </div>
      </div>

      {/* ── 创建家族弹层 ── */}
      <BottomSheet open={sheet==='create'} onClose={()=>{ setSheet(null); setFErr({}); }} title="创建家族">
        <div style={{ display:'flex', flexDirection:'column', gap:14, paddingBottom:24 }}>
          <AppInput label="家族名称" placeholder="例：陈氏大家庭、我们一家人"
            value={fam.name} onChange={v=>{ setFam(f=>({...f,name:v})); setFErr(e=>({...e,name:''})); }} error={fErr.name}
          />
          <AppInput label="家族姓氏（可选）" placeholder="例：陈、刘、王"
            value={fam.surname} onChange={v=>setFam(f=>({...f,surname:v}))}
          />
          <AppInput label="我在家谱里的称呼" placeholder="例：外婆、大儿子、小陈"
            value={fam.selfName} onChange={v=>{ setFam(f=>({...f,selfName:v})); setFErr(e=>({...e,selfName:''})); }}
            error={fErr.selfName} hint="将成为你在家谱中的节点名称，可随时修改"
          />
          <Btn onClick={handleCreate} fullWidth size="lg">创建家族</Btn>
        </div>
      </BottomSheet>

      {/* ── 家族已建弹层 ── */}
      <BottomSheet open={sheet==='created'} onClose={()=>{}} title={'家族已建好 🎉'}>
        <div style={{ display:'flex', flexDirection:'column', gap:16, paddingBottom:24, alignItems:'center' }}>
          <div style={{ fontSize:14, color:C.t2, textAlign:'center', lineHeight:1.85 }}>
            把代码分享给家人，邀请他们加入<br/>
            <strong style={{ color:C.primaryDark }}>「{fam.name||'我的家族'}」</strong>
          </div>
          {/* 代码展示 */}
          <div style={{ width:'100%', background:C.primaryPale, border:`2px dashed ${C.primaryLight}`, borderRadius:16, padding:'20px 0', textAlign:'center' }}>
            <div style={{ fontSize:11, color:C.primaryLight, letterSpacing:2, marginBottom:8 }}>家族代码</div>
            <div style={{ fontFamily:'monospace', fontSize:36, fontWeight:900, color:C.primary, letterSpacing:10 }}>YJ2026</div>
          </div>
          {/* 食物插画横排装饰 */}
          <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
            {['094308_309','094322_572','094332_860'].map((n,i)=>(
              <div key={i} style={{ width:44, height:44, borderRadius:'50%', overflow:'hidden', border:`2px solid ${C.primary100}`, background:'#fff', boxShadow:'0 2px 8px rgba(40,91,78,0.10)' }}>
                <img src={`uploads/微信图片_2026-06-11_${n}.png`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              </div>
            ))}
            <div style={{ width:44, height:44, borderRadius:'50%', background:C.primaryPale, border:`2px dashed ${C.primary100}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:C.primaryLight }}>+</div>
          </div>
          <div style={{ fontSize:12, color:C.t3, textAlign:'center', lineHeight:1.7 }}>等家人加入后，每位家人都会有一道属于自己的味道</div>
          <Btn onClick={()=>showToast('代码已复制')} variant="outline" fullWidth>复制代码</Btn>
          <Btn onClick={()=>{ setSheet(null); showToast('家族创建成功！'); setTimeout(()=>navigate('P3'),800); }} fullWidth size="lg">进入家族</Btn>
        </div>
      </BottomSheet>

      {/* ── 加入家族弹层 ── */}
      <BottomSheet open={sheet==='join'} onClose={()=>{ setSheet(null); setCode(''); setCodeErr(''); }} title="加入家族">
        <div style={{ display:'flex', flexDirection:'column', gap:16, paddingBottom:24 }}>
          <div style={{ fontSize:14, color:C.t2, lineHeight:1.8 }}>向已加入家族的成员索取 6 位代码</div>
          {/* 6格代码显示 */}
          <div>
            <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:10 }}>
              {Array.from({length:6},(_,i)=>(
                <div key={i} style={{
                  width:44, height:52, background:C.inputBg,
                  border:`2px solid ${code[i]?C.primary:C.border}`,
                  borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:20, fontWeight:800, color:C.primary, transition:'border-color 0.15s',
                }}>
                  {code[i]||''}
                </div>
              ))}
            </div>
            <input value={code} maxLength={6}
              onChange={e=>{ setCode(e.target.value.replace(/[^a-zA-Z0-9]/g,'').slice(0,6).toUpperCase()); setCodeErr(''); }}
              placeholder="输入 6 位代码"
              style={{ width:'100%', height:48, padding:'0 16px', background:C.inputBg, border:`1.5px solid ${codeErr?C.red:C.border}`, borderRadius:12, fontSize:18, fontFamily:'monospace', textAlign:'center', letterSpacing:6, textTransform:'uppercase', color:C.primary, outline:'none', fontWeight:700 }}
            />
            {codeErr && <div style={{ fontSize:12, color:C.red, marginTop:6, textAlign:'center' }}>{codeErr}</div>}
          </div>
          <div style={{ textAlign:'center', fontSize:12, color:C.t3 }}>
            测试代码：<span style={{ color:C.primary, fontFamily:'monospace', cursor:'pointer', fontWeight:700 }} onClick={()=>setCode('YJ2026')}>YJ2026</span>
          </div>
          <Btn onClick={handleJoin} disabled={code.length!==6} fullWidth size="lg">下一步</Btn>
        </div>
      </BottomSheet>
    </div>
  );
}

Object.assign(window, { P2_Family });
