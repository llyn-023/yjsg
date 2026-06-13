// screen-p1.jsx — P1 登录页（含注册、找回密码）
function P1_Login() {
  const { navigate, showToast } = useApp();
  const [form, setForm] = React.useState({ username: '', password: '' });
  const [showPwd, setShowPwd] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  const [sheet, setSheet] = React.useState(null); // 'register' | 'forgot'

  const [reg, setReg] = React.useState({ username:'', password:'', confirm:'', nickname:'', secA1:'', secA2:'', agreed:false });
  const [regErr, setRegErr] = React.useState({});
  const [fgt, setFgt] = React.useState({ username:'', step:1, a1:'', a2:'' });

  const FOOD_CIRCLES = [
    { src: 'uploads/微信图片_2026-06-11_094308_309.png', size: 88, x: 14, rotate: -12 },
    { src: 'uploads/微信图片_2026-06-11_094322_572.png', size: 76, x: 118, rotate: 6 },
    { src: 'uploads/微信图片_2026-06-11_094332_860.png', size: 82, x: 222, rotate: -8 },
    { src: 'uploads/微信图片_2026-06-11_094344_584.png', size: 72, x: 310, rotate: 10 },
  ];

  function handleLogin() {
    const e = {};
    if (!form.username.trim()) e.username = '请输入用户名';
    if (!form.password) e.password = '请输入密码';
    if (Object.keys(e).length) { setErrors(e); return; }
    navigate('P2');
  }

  function handleRegister() {
    const e = {};
    if (!reg.username.trim()) e.username = '请输入用户名';
    if (reg.password.length < 6) e.password = '密码至少 6 位';
    if (reg.password !== reg.confirm) e.confirm = '两次密码不一致';
    if (!reg.nickname.trim()) e.nickname = '请输入昵称';
    if (!reg.secA1.trim()) e.secA1 = '请填写密保答案';
    if (!reg.secA2.trim()) e.secA2 = '请填写密保答案';
    if (!reg.agreed) e.agreed = '请阅读并同意协议';
    if (Object.keys(e).length) { setRegErr(e); return; }
    setSheet(null);
    showToast('注册成功，欢迎加入一家食光！');
    setTimeout(() => navigate('P2'), 1100);
  }

  const inputStyle = (err, focused) => ({
    flex:1, height:50, padding:'0 16px', background: C.inputBg,
    border:`1.5px solid ${err ? C.red : focused ? C.primary : C.border}`,
    borderRadius:12, fontSize:15, color:C.t1, fontFamily:'inherit', outline:'none',
  });

  return (
    <div style={{ width:'100%', height:'100%', background:C.bg, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>
      <StatusBar />

      {/* 主体可滚动内容 */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', padding:'8px 28px 0' }}>
        {/* 品牌头部 */}
        <div style={{ textAlign:'center', padding:'20px 0 36px' }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#EBF5F0,#D4EAE3)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 20px rgba(40,91,78,0.14)' }}>
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                <path d="M5 13h24M7 13c0 6.5 4.5 10.5 10 10.5S27 19.5 27 13" stroke="#285B4E" strokeWidth="2" strokeLinecap="round"/>
                <path d="M14 9c0-2 1.3-3 3-3s3 1 3 3" stroke="#285B4E" strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="17" y1="9" x2="17" y2="13" stroke="#285B4E" strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="9" y1="24" x2="25" y2="24" stroke="#285B4E" strokeWidth="1.4" strokeLinecap="round" opacity="0.45"/>
              </svg>
            </div>
          </div>
          <div style={{ fontFamily:'"ZCOOL XiaoWei",serif', fontSize:28, color:C.primaryDark, letterSpacing:6, marginBottom:5 }}>
            一家食光
          </div>
          <div style={{ fontSize:12, color:C.t3, letterSpacing:2.5 }}>食有来处，家有回声</div>
        </div>

        {/* 表单 */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <AppInput placeholder="用户名" value={form.username}
            onChange={v=>{ setForm(f=>({...f,username:v})); setErrors(e=>({...e,username:''})); }}
            error={errors.username} autoComplete="username"
          />
          <AppInput placeholder="密码" type={showPwd?'text':'password'} value={form.password}
            onChange={v=>{ setForm(f=>({...f,password:v})); setErrors(e=>({...e,password:''})); }}
            error={errors.password} autoComplete="current-password"
            rightEl={
              <button onClick={()=>setShowPwd(s=>!s)} style={{ background:'none', border:'none', cursor:'pointer', color:C.t3, fontSize:13, padding:4, lineHeight:1 }}>
                {showPwd ? '隐藏' : '显示'}
              </button>
            }
          />
          <div style={{ textAlign:'right', marginTop:-4 }}>
            <button onClick={()=>setSheet('forgot')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:C.t3, padding:0 }}>
              忘记密码？
            </button>
          </div>
          <Btn onClick={handleLogin} fullWidth size="lg">登 录</Btn>
          <div style={{ textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:5, marginTop:2 }}>
            <span style={{ fontSize:14, color:C.t3 }}>还没有账号？</span>
            <button onClick={()=>setSheet('register')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:C.primary, fontWeight:700, padding:0 }}>
              立即注册
            </button>
          </div>
        </div>

        {/* 食物插画浮动装饰区 */}
        <div style={{ flex:1, position:'relative', minHeight:110, marginTop:20 }}>
          {/* 渐变遮罩让插画从底部淡出 */}
          <div style={{ position:'absolute', top:0, left:-28, right:-28, bottom:0, background:`linear-gradient(to bottom, ${C.bg} 0%, transparent 30%)`, zIndex:2, pointerEvents:'none' }}/>
          {FOOD_CIRCLES.map((f,i) => (
            <div key={i} style={{
              position:'absolute', bottom: i % 2 === 0 ? -20 : -6,
              left: f.x, width:f.size, height:f.size,
              borderRadius:'50%', overflow:'hidden',
              border:`2.5px solid rgba(212,234,227,0.8)`,
              boxShadow:'0 4px 16px rgba(40,91,78,0.12)',
              transform:`rotate(${f.rotate}deg)`,
              background:'#fff',
            }}>
              <img src={f.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            </div>
          ))}
        </div>
      </div>

      {/* ── 注册底部弹层 ── */}
      <BottomSheet open={sheet==='register'} onClose={()=>setSheet(null)} title="创建新账号">
        <div style={{ display:'flex', flexDirection:'column', gap:14, paddingBottom:24 }}>
          {/* 密保警告 */}
          <div style={{ background:C.warnBg, border:`1px solid ${C.warnBdr}`, borderRadius:10, padding:'11px 14px', fontSize:13, color:C.warn, lineHeight:1.8 }}>
            ⚠️ <strong>重要：</strong>本产品不绑定手机/邮箱，<strong>密保问题是找回密码的唯一方式</strong>，请务必记牢答案。
          </div>
          <AppInput label="用户名" placeholder="字母、数字、下划线"
            value={reg.username} onChange={v=>{ setReg(r=>({...r,username:v})); setRegErr(e=>({...e,username:''})); }}
            error={regErr.username}
          />
          <AppInput label="密码" placeholder="至少 6 位" type="password"
            value={reg.password} onChange={v=>{ setReg(r=>({...r,password:v})); setRegErr(e=>({...e,password:''})); }}
            error={regErr.password}
          />
          <AppInput label="确认密码" placeholder="再输一次" type="password"
            value={reg.confirm} onChange={v=>{ setReg(r=>({...r,confirm:v})); setRegErr(e=>({...e,confirm:''})); }}
            error={regErr.confirm}
          />
          <AppInput label="昵称" placeholder="家人认识你的称呼"
            value={reg.nickname} onChange={v=>{ setReg(r=>({...r,nickname:v})); setRegErr(e=>({...e,nickname:''})); }}
            error={regErr.nickname}
          />

          {/* 密保问题 */}
          <div style={{ background:'#F5F0E8', borderRadius:12, padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.t2, letterSpacing:0.5 }}>密保问题（必须设置 2 个）</div>
            <div>
              <div style={{ fontSize:12, color:C.t2, marginBottom:5 }}>① 你小时候最爱吃的一道菜叫什么？</div>
              <input value={reg.secA1} onChange={e=>{ setReg(r=>({...r,secA1:e.target.value})); setRegErr(x=>({...x,secA1:''})); }}
                placeholder="请填写答案并牢记"
                style={{ width:'100%', height:42, padding:'0 12px', background:'#FFFDF8', border:`1px solid ${regErr.secA1?C.red:C.border}`, borderRadius:8, fontSize:14, color:C.t1, fontFamily:'inherit', outline:'none' }}
              />
              {regErr.secA1 && <div style={{ fontSize:11, color:C.red, marginTop:3 }}>{regErr.secA1}</div>}
            </div>
            <div>
              <div style={{ fontSize:12, color:C.t2, marginBottom:5 }}>② 你家乡最有名的一种食物是？</div>
              <input value={reg.secA2} onChange={e=>{ setReg(r=>({...r,secA2:e.target.value})); setRegErr(x=>({...x,secA2:''})); }}
                placeholder="请填写答案并牢记"
                style={{ width:'100%', height:42, padding:'0 12px', background:'#FFFDF8', border:`1px solid ${regErr.secA2?C.red:C.border}`, borderRadius:8, fontSize:14, color:C.t1, fontFamily:'inherit', outline:'none' }}
              />
              {regErr.secA2 && <div style={{ fontSize:11, color:C.red, marginTop:3 }}>{regErr.secA2}</div>}
            </div>
          </div>

          {/* 协议 */}
          <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
            <div onClick={()=>setReg(r=>({...r,agreed:!r.agreed}))} style={{
              width:20, height:20, borderRadius:5, flexShrink:0, marginTop:1, cursor:'pointer',
              background:reg.agreed?C.primary:'transparent',
              border:`2px solid ${reg.agreed?C.primary:C.t3}`,
              display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
            }}>
              {reg.agreed && <span style={{ color:'#fff', fontSize:11, fontWeight:800 }}>✓</span>}
            </div>
            <span style={{ fontSize:13, color:C.t2, lineHeight:1.65 }}>
              已阅读并同意<span style={{ color:C.primary, fontWeight:600 }}>《用户协议》</span>与<span style={{ color:C.primary, fontWeight:600 }}>《隐私政策》</span>
            </span>
          </div>
          {regErr.agreed && <div style={{ fontSize:12, color:C.red, marginTop:-6 }}>{regErr.agreed}</div>}

          <Btn onClick={handleRegister} fullWidth size="lg">完成注册</Btn>
        </div>
      </BottomSheet>

      {/* ── 忘记密码底部弹层 ── */}
      <BottomSheet open={sheet==='forgot'} onClose={()=>{ setSheet(null); setFgt({username:'',step:1,a1:'',a2:''}); }} title="找回密码">
        <div style={{ display:'flex', flexDirection:'column', gap:14, paddingBottom:24 }}>
          {fgt.step === 1 && (
            <>
              <AppInput label="用户名" placeholder="输入你的用户名"
                value={fgt.username} onChange={v=>setFgt(f=>({...f,username:v}))}
              />
              <Btn onClick={()=>fgt.username.trim()&&setFgt(f=>({...f,step:2}))} disabled={!fgt.username.trim()} fullWidth>下一步</Btn>
            </>
          )}
          {fgt.step === 2 && (
            <>
              <div style={{ fontSize:14, color:C.t2, lineHeight:1.8 }}>请回答你设置的两道密保问题（均需答对）</div>
              <div style={{ background:'#F5F0E8', borderRadius:10, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:12, color:C.t2, fontWeight:500 }}>你小时候最爱吃的一道菜叫什么？</div>
                <AppInput placeholder="请输入答案" value={fgt.a1} onChange={v=>setFgt(f=>({...f,a1:v}))}/>
              </div>
              <div style={{ background:'#F5F0E8', borderRadius:10, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:12, color:C.t2, fontWeight:500 }}>你家乡最有名的一种食物是？</div>
                <AppInput placeholder="请输入答案" value={fgt.a2} onChange={v=>setFgt(f=>({...f,a2:v}))}/>
              </div>
              <div style={{ fontSize:12, color:C.t3 }}>连续答错 5 次将锁定 24 小时</div>
              <Btn onClick={()=>{ showToast('验证成功，请设置新密码'); setSheet(null); }} disabled={!fgt.a1.trim()||!fgt.a2.trim()} fullWidth>验证</Btn>
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}

Object.assign(window, { P1_Login });
