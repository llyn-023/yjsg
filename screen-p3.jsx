// screen-p3.jsx — P3 找到你的位置（三步）
function P3_Position() {
  const { navigate, showToast } = useApp();
  const [step, setStep] = React.useState(1);
  const [path, setPath] = React.useState(null); // 'relate' | 'claim'
  const [selMember, setSelMember] = React.useState(null);
  const [selRel, setSelRel] = React.useState(null);
  const [profile, setProfile] = React.useState({ name:'', birthday:'' });

  // 家谱成员 — 头像用食物插画（核心创意：每人对应一道味道）
  const MEMBERS = [
    { id:1, name:'奶奶 · 王秀英', food:'辣子鸡', img:'uploads/微信图片_2026-06-11_094308_309.png' },
    { id:2, name:'爷爷 · 陈国强', food:'烧饼',   img:'uploads/微信图片_2026-06-11_094322_572.png' },
    { id:3, name:'爸爸 · 陈建明', food:'冰粉',   img:'uploads/微信图片_2026-06-11_094332_860.png' },
    { id:4, name:'妈妈 · 刘晓芳', food:'北京烤鸭', img:'uploads/微信图片_2026-06-11_094344_584.png' },
    { id:5, name:'姐姐 · 陈小云', food:'待点亮…', img:null },
  ];

  const REL_TYPES = ['父亲','母亲','祖父','祖母','兄弟','姐妹','配偶','子女','孙子/女','叔伯姑舅','其他'];
  const UNCLAIMED = [
    { id:1, name:'陈小明', addedBy:'爸爸 · 陈建明' },
    { id:2, name:'陈大伟', addedBy:'奶奶 · 王秀英' },
    { id:3, name:'刘婷婷', addedBy:'妈妈 · 刘晓芳' },
  ];

  function goBack() {
    if (step === 1) navigate('P2');
    else setStep(s => s - 1);
  }

  // ─── 食物头像组件 ────────────────────────────────────
  function FoodAvatar({ member, size = 44, selected }) {
    return (
      <div style={{
        width:size, height:size, borderRadius:'50%', overflow:'hidden', flexShrink:0,
        border:`2.5px solid ${selected ? C.primary : C.border}`,
        boxShadow: selected ? `0 0 0 3px ${C.primaryPale}` : '0 1px 4px rgba(0,0,0,0.08)',
        background: member.img ? '#fff' : C.primaryPale,
        display:'flex', alignItems:'center', justifyContent:'center',
        transition:'all 0.15s',
      }}>
        {member.img
          ? <img src={member.img} alt={member.food} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          : <span style={{ fontSize: size * 0.4, color: C.primaryLight }}>🍃</span>
        }
      </div>
    );
  }

  return (
    <div style={{ width:'100%', height:'100%', background:C.bg, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>
      <StatusBar />
      <NavBar title="找到你的位置" onBack={goBack} />

      {/* 步骤指示器 */}
      <div style={{ padding:'0 32px 2px', flexShrink:0 }}>
        <StepDots total={3} current={step-1} />
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10.5, color:C.t3, padding:'0 4px', marginTop:1 }}>
          <span>选择方式</span><span>建立关系</span><span>完善资料</span>
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 22px 24px' }}>

        {/* Step 1 — 选择入谱方式 */}
        {step === 1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:15, color:C.t2, lineHeight:1.9, textAlign:'center', marginBottom:4 }}>
              你是如何进入这个家族的？
            </div>
            {[
              { p:'relate', icon:'🤝', title:'我和某位家人有关系', desc:'告诉我们你与谁相关，系统自动推导你在家谱中的位置' },
              { p:'claim',  icon:'🔍', title:'我就是谱上的某个人', desc:'家人已提前添加了你，认领属于你的节点' },
            ].map(({p,icon,title,desc})=>(
              <button key={p} onClick={()=>{ setPath(p); setStep(2); }} style={{
                width:'100%', padding:'18px 16px', background:'#fff',
                border:`1.5px solid ${C.primary100}`, borderRadius:18, cursor:'pointer',
                display:'flex', alignItems:'flex-start', gap:14, textAlign:'left',
                boxShadow:'0 2px 12px rgba(40,91,78,0.06)',
              }}>
                <div style={{ fontSize:28, lineHeight:1, marginTop:2, flexShrink:0 }}>{icon}</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.primaryDark, marginBottom:4 }}>{title}</div>
                  <div style={{ fontSize:13, color:C.t2, lineHeight:1.65 }}>{desc}</div>
                </div>
              </button>
            ))}

            {/* 说明：食物头像含义 */}
            <div style={{ marginTop:4, background:C.primaryPale, borderRadius:12, padding:'12px 14px', display:'flex', gap:10, alignItems:'center' }}>
              <div style={{ display:'flex', gap:-4 }}>
                {MEMBERS.slice(0,3).map((m,i)=>(
                  <div key={i} style={{ marginLeft: i>0?-10:0, zIndex:3-i }}>
                    <FoodAvatar member={m} size={32}/>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, color:C.primaryMid, lineHeight:1.65, flex:1 }}>
                家族里，<strong>每位家人都与一道味道相连</strong>——加入后你也会有属于自己的那道菜
              </div>
            </div>
          </div>
        )}

        {/* Step 2A — 声明与某家人的关系 */}
        {step === 2 && path === 'relate' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:14, color:C.t2, lineHeight:1.85, marginBottom:2 }}>
              选择一位你认识的家人
            </div>

            {MEMBERS.map(m=>(
              <button key={m.id} onClick={()=>{ setSelMember(m); setSelRel(null); }} style={{
                width:'100%', padding:'12px 14px', background: selMember?.id===m.id ? C.primaryPale : '#fff',
                border:`1.5px solid ${selMember?.id===m.id ? C.primary : C.border}`,
                borderRadius:14, cursor:'pointer', display:'flex', alignItems:'center', gap:12,
                textAlign:'left', transition:'all 0.15s',
              }}>
                <FoodAvatar member={m} size={44} selected={selMember?.id===m.id}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:C.t1 }}>{m.name}</div>
                  <div style={{ fontSize:11, color: m.img ? C.primaryLight : C.t4, marginTop:2 }}>
                    {m.img ? `TA 的味道：${m.food}` : m.food}
                  </div>
                </div>
                {selMember?.id===m.id && <span style={{ color:C.primary, fontWeight:800, fontSize:16 }}>✓</span>}
              </button>
            ))}

            {selMember && (
              <div style={{ marginTop:4, display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.t1 }}>
                  {selMember.name.split(' · ')[1] || selMember.name} 是我的——
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {REL_TYPES.map(t=>(
                    <button key={t} onClick={()=>setSelRel(t)} style={{
                      padding:'8px 14px', borderRadius:9999,
                      background: selRel===t ? C.primary : C.inputBg,
                      border:`1.5px solid ${selRel===t ? C.primary : C.border}`,
                      color: selRel===t ? '#fff' : C.t2,
                      fontSize:13, cursor:'pointer', fontWeight:500, transition:'all 0.15s',
                    }}>{t}</button>
                  ))}
                </div>
              </div>
            )}

            {selMember && selRel && (
              <div style={{ background:C.primaryPale, borderRadius:12, padding:'12px 14px', display:'flex', gap:10, alignItems:'center' }}>
                <FoodAvatar member={selMember} size={36}/>
                <div style={{ fontSize:13, color:C.t2, lineHeight:1.8, flex:1 }}>
                  <strong style={{ color:C.primaryDark }}>{selMember.name.split(' · ')[1] || selMember.name}</strong> 是我的 <strong style={{ color:C.primary }}>{selRel}</strong>，系统将据此推导你与家族其他成员的关系。
                </div>
              </div>
            )}

            <Btn onClick={()=>selMember&&selRel&&setStep(3)} disabled={!selMember||!selRel} fullWidth size="lg" xstyle={{marginTop:4}}>
              确认关系
            </Btn>
          </div>
        )}

        {/* Step 2B — 认领节点 */}
        {step === 2 && path === 'claim' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:14, color:C.t2, lineHeight:1.85 }}>
              以下是尚未被认领的家族节点，找到你的名字
            </div>
            {UNCLAIMED.map(u=>(
              <button key={u.id} onClick={()=>{ setSelMember(u); setStep(3); }} style={{
                width:'100%', padding:'15px 16px', background:'#fff',
                border:`1.5px solid ${C.border}`, borderRadius:14, cursor:'pointer',
                display:'flex', alignItems:'center', gap:12, textAlign:'left',
                boxShadow:'0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{ width:44, height:44, background:C.inputBg, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:C.t3 }}>👤</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:C.t1 }}>{u.name}</div>
                  <div style={{ fontSize:12, color:C.t3, marginTop:2 }}>由 {u.addedBy} 添加 · 待认领</div>
                </div>
                <span style={{ fontSize:13, color:C.primary, fontWeight:700, whiteSpace:'nowrap' }}>这是我 ›</span>
              </button>
            ))}
            <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:C.t3, padding:'8px 0', textAlign:'center' }}>
              我的名字不在这里？
            </button>
          </div>
        )}

        {/* Step 3 — 完善资料 */}
        {step === 3 && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* 用户头像选择 — 食物插画选择器 */}
            <div style={{ textAlign:'center', marginBottom:4 }}>
              <div style={{ fontSize:13, color:C.t3, marginBottom:12, lineHeight:1.7 }}>
                选一张你最喜欢的食物作为你的味道头像
              </div>
              {/* 食物头像选择网格 */}
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', marginBottom:8 }}>
                {[
                  'uploads/微信图片_2026-06-11_094353_200.png',
                  'uploads/微信图片_2026-06-11_094358_346.png',
                  'uploads/微信图片_2026-06-11_094402_462.png',
                  'uploads/微信图片_2026-06-11_094406_527.png',
                  'uploads/微信图片_2026-06-11_094414_627.png',
                  'uploads/微信图片_2026-06-11_094419_425.png',
                ].map((src,i)=>{
                  const sel = profile.avatar === src;
                  return (
                    <div key={i} onClick={()=>setProfile(p=>({...p,avatar:src}))} style={{
                      width:58, height:58, borderRadius:'50%', overflow:'hidden',
                      border:`2.5px solid ${sel ? C.primary : C.border}`,
                      boxShadow: sel ? `0 0 0 3px ${C.primaryPale}` : '0 1px 4px rgba(0,0,0,0.08)',
                      cursor:'pointer', background:'#fff', transition:'all 0.15s',
                    }}>
                      <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    </div>
                  );
                })}
              </div>
              {profile.avatar && (
                <div style={{ display:'flex', justifyContent:'center' }}>
                  <div style={{ width:72, height:72, borderRadius:'50%', overflow:'hidden', border:`3px solid ${C.primary}`, boxShadow:'0 4px 16px rgba(40,91,78,0.2)' }}>
                    <img src={profile.avatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  </div>
                </div>
              )}
            </div>

            <AppInput label="你在家族里的称呼" placeholder="例：小明、二伯、外婆"
              value={profile.name} onChange={v=>setProfile(p=>({...p,name:v}))}
              hint="将显示在家谱节点上，可随时修改"
            />
            <AppInput label="生日（可选）" placeholder="例：1990年3月15日"
              value={profile.birthday} onChange={v=>setProfile(p=>({...p,birthday:v}))}
            />

            <div style={{ background:C.warnBg, border:`1px solid ${C.warnBdr}`, borderRadius:12, padding:'11px 14px', fontSize:13, color:C.warn, lineHeight:1.8 }}>
              📋 你的加入申请将发给家族管理员审核。审核前可浏览内容，审核通过后即可参与记忆创作。
            </div>

            <Btn onClick={()=>{ showToast('申请已发送，等待家人确认～'); setTimeout(()=>navigate('P0'),1400); }}
              disabled={!profile.name.trim()} fullWidth size="lg" xstyle={{marginTop:4}}>
              完成，进入家族
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { P3_Position });
