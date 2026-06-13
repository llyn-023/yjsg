// screen-p0.jsx — P0 启动页
function P0_Splash() {
  const { navigate } = useApp();
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const start = Date.now(), dur = 2600;
    const id = setInterval(() => {
      const p = Math.min((Date.now() - start) / dur, 1);
      setProgress(p);
      if (p >= 1) { clearInterval(id); setTimeout(() => navigate('P1'), 180); }
    }, 40);
    return () => clearInterval(id);
  }, []);

  return (
    <div onClick={() => navigate('P1')} style={{
      width: '100%', height: '100%', position: 'relative',
      cursor: 'pointer', overflow: 'hidden', background: '#1A3028',
    }}>
      {/* 全屏竹林家庭插画 */}
      <img src="uploads/微信图片_20260611103100_116_20.png" alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
      />
      {/* 底部渐变遮罩 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(10,28,20,0.72) 70%, rgba(10,28,20,0.96) 100%)',
      }}/>

      {/* 品牌内容区 */}
      <div style={{
        position: 'absolute', bottom: 50, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '0 36px',
      }}>
        {/* Logo 图标 */}
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <circle cx="22" cy="22" r="20" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
          <path d="M10 20h24M12 20c0 7 4.5 11 10 11s10-4 10-11" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M18 15c0-2 1.8-4 4-4s4 2 4 4" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M22 15v5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {/* 品牌名 */}
        <div style={{ fontFamily: '"ZCOOL XiaoWei","Noto Serif SC",serif', fontSize: 40, color: '#fff', letterSpacing: 10, textShadow: '0 2px 24px rgba(0,0,0,0.35)' }}>
          一家食光
        </div>
        {/* Slogan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 0.5, background: 'rgba(255,255,255,0.4)' }}/>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', letterSpacing: 3, fontFamily: '"Noto Serif SC",serif' }}>食有来处，家有回声</span>
          <div style={{ width: 36, height: 0.5, background: 'rgba(255,255,255,0.4)' }}/>
        </div>

        {/* 进度条 */}
        <div style={{ width: 160, marginTop: 20 }}>
          <div style={{ height: 2, background: 'rgba(255,255,255,0.18)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'rgba(255,255,255,0.75)', width: `${progress * 100}%`, transition: 'width 0.04s linear', borderRadius: 1 }}/>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', letterSpacing: 2, marginTop: 2 }}>轻触跳过</div>
      </div>
    </div>
  );
}

Object.assign(window, { P0_Splash });
