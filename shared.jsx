// shared.jsx — 一家食光共享组件
// 导出到 window 供其他 Babel 脚本使用

const C = {
  bg:          '#FAF7F2',
  bgCard:      '#FFFFFF',
  primary:     '#285B4E',
  primaryDark: '#1C4238',
  primaryMid:  '#376B5C',
  primaryLight:'#4A8A76',
  primaryPale: '#EBF5F0',
  primary100:  '#D4EAE3',
  t1: '#2C1A0E',
  t2: '#7A6E65',
  t3: '#A09590',
  t4: '#C8BFB8',
  border:   '#E6DFCF',
  inputBg:  '#F2EDE5',
  red:      '#D94F3A',
  warn:     '#8A6710',
  warnBg:   '#FEF8E6',
  warnBdr:  '#E8CC90',
  gold:     '#C89A5A',
};

const AppContext = React.createContext({});
const useApp = () => React.useContext(AppContext);

/* ── Status Bar ─────────────────────────────────── */
function StatusBar({ dark = false }) {
  const fg = dark ? 'rgba(255,255,255,0.92)' : C.t1;
  return (
    <div style={{
      height: 54, display: 'flex', alignItems: 'flex-end',
      justifyContent: 'space-between', padding: '0 22px 10px',
      flexShrink: 0, position: 'relative', zIndex: 5,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: fg, fontVariantNumeric: 'tabular-nums' }}>9:41</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="17" height="12" viewBox="0 0 17 12" fill={fg}>
          <rect x="0" y="8" width="3" height="4" rx="1" opacity="0.38"/>
          <rect x="4.5" y="5" width="3" height="7" rx="1" opacity="0.65"/>
          <rect x="9" y="2" width="3" height="10" rx="1" opacity="0.88"/>
          <rect x="13.5" y="0" width="3" height="12" rx="1"/>
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M8 8.6a1.4 1.4 0 0 1 1 .4L8 11.2 7 9a1.4 1.4 0 0 1 1-.4Z" fill={fg}/>
          <path d="M5.5 6.8A3.5 3.5 0 0 1 8 5.8c1 0 1.9.4 2.5 1" stroke={fg} strokeWidth="1.2" fill="none" opacity="0.68"/>
          <path d="M2.8 4.2A7 7 0 0 1 8 2a7 7 0 0 1 5.2 2.2" stroke={fg} strokeWidth="1.2" fill="none" opacity="0.38"/>
        </svg>
        <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
          <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke={fg} strokeOpacity="0.38"/>
          <rect x="1.5" y="1.5" width="16" height="10" rx="2.5" fill={fg}/>
          <path d="M23 4.5v4c1.2-.5 1.2-3.5 0-4Z" fill={fg} fillOpacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}

/* ── Bottom Sheet ────────────────────────────────── */
function BottomSheet({ open, onClose, title, children }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(28,16,8,0.42)', zIndex: 100,
        opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none',
        transition: 'opacity 0.25s',
      }}/>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: '#FFFDF8', borderRadius: '22px 22px 0 0', zIndex: 101,
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
        maxHeight: '84%', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: '#D8CEBF', borderRadius: 2 }}/>
        </div>
        {title && (
          <div style={{ padding: '10px 22px 14px', fontSize: 17, fontWeight: 700, color: C.t1, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            {title}
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 24px', WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </div>
    </>
  );
}

/* ── Toast ───────────────────────────────────────── */
function Toast({ message, visible }) {
  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      background: 'rgba(22,50,40,0.94)', color: '#fff',
      fontSize: 14, fontWeight: 500, padding: '10px 22px',
      borderRadius: 10, zIndex: 200,
      opacity: visible ? 1 : 0, pointerEvents: 'none',
      transition: 'opacity 0.2s', whiteSpace: 'nowrap',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    }}>
      {message}
    </div>
  );
}

/* ── Button ──────────────────────────────────────── */
function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, fullWidth, xstyle }) {
  const sz = { lg:{height:52,fontSize:16,padding:'0 32px'}, md:{height:48,fontSize:15,padding:'0 24px'}, sm:{height:40,fontSize:14,padding:'0 18px'}, xs:{height:32,fontSize:12,padding:'0 12px',borderRadius:8} }[size] || {};
  const vt = {
    primary:   { background: disabled ? C.primary100 : C.primary, color:'#fff' },
    secondary: { background: C.primaryPale, color: C.primary, border:`1px solid ${C.primary100}` },
    outline:   { background: 'transparent', color: C.primary, border:`1.5px solid ${C.primary}` },
    ghost:     { background: 'transparent', color: C.t2, border:`1px solid ${C.border}` },
    warm:      { background: C.gold, color:'#fff' },
    text:      { background:'transparent', color:C.primary, height:'auto', padding:0 },
  }[variant] || {};
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
      borderRadius: 9999, border:'none', cursor: disabled?'not-allowed':'pointer',
      fontFamily:'inherit', fontWeight:600, letterSpacing:0.2,
      transition:'all 0.15s', userSelect:'none',
      width: fullWidth?'100%':undefined, opacity: disabled?0.48:1,
      ...sz, ...vt, ...xstyle,
    }}
      onMouseDown={e=>{ if(!disabled) e.currentTarget.style.opacity='0.78'; }}
      onMouseUp={e=>{ e.currentTarget.style.opacity=disabled?'0.48':'1'; }}
      onMouseLeave={e=>{ e.currentTarget.style.opacity=disabled?'0.48':'1'; }}
    >
      {children}
    </button>
  );
}

/* ── Input ───────────────────────────────────────── */
function AppInput({ label, placeholder, value, onChange, type='text', error, rightEl, hint, autoComplete }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      {label && <label style={{ fontSize:13, fontWeight:600, color:C.t2, letterSpacing:0.3 }}>{label}</label>}
      <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
        <input
          type={type} value={value} placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={e => onChange && onChange(e.target.value)}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          style={{
            flex:1, height:50, padding: rightEl?'0 48px 0 16px':'0 16px',
            background: C.inputBg, border:`1.5px solid ${error?C.red:focused?C.primary:C.border}`,
            borderRadius:12, fontSize:15, color:C.t1,
            fontFamily:'inherit', outline:'none', transition:'border-color 0.15s',
          }}
        />
        {rightEl && <div style={{ position:'absolute', right:12 }}>{rightEl}</div>}
      </div>
      {error && <div style={{ fontSize:12, color:C.red }}>{error}</div>}
      {hint && !error && <div style={{ fontSize:12, color:C.t3, lineHeight:1.5 }}>{hint}</div>}
    </div>
  );
}

/* ── Step Dots ───────────────────────────────────── */
function StepDots({ total, current }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 0' }}>
      {Array.from({length:total},(_,i)=>(
        <React.Fragment key={i}>
          <div style={{
            width:28, height:28, borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:12, fontWeight:700, flexShrink:0,
            background: i < current ? C.primary : i === current ? C.primary : '#E8E0D4',
            color: i <= current ? '#fff' : C.t3,
            boxShadow: i === current ? `0 0 0 4px ${C.primaryPale}` : 'none',
            transition:'all 0.2s',
          }}>
            {i < current ? '✓' : i+1}
          </div>
          {i < total-1 && (
            <div style={{ height:2, width:44, background: i<current?C.primary:'#E8E0D4', flexShrink:0, transition:'background 0.2s' }}/>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ── Nav Bar ─────────────────────────────────────── */
function NavBar({ title, onBack, rightEl }) {
  return (
    <div style={{ height:44, display:'flex', alignItems:'center', padding:'0 16px', gap:8, flexShrink:0 }}>
      <button onClick={onBack} style={{
        width:40, height:40, border:'none', background:'transparent',
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:24, color:C.primary, marginLeft:-8
      }}>‹</button>
      <div style={{ flex:1, textAlign:'center', fontSize:16, fontWeight:700, color:C.t1, fontFamily:'"Noto Serif SC",serif' }}>
        {title}
      </div>
      {rightEl || <div style={{ width:40 }}/>}
    </div>
  );
}

Object.assign(window, { C, AppContext, useApp, StatusBar, BottomSheet, Toast, Btn, AppInput, StepDots, NavBar });
