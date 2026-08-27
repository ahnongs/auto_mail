import { useState, useEffect } from 'react'

// 앱 최초 로딩 화면. Render 무료 플랜은 절전 후 깨어나는 데 시간이 걸려서,
// 몇 초 이상 걸리면 "서버 깨우는 중" 안내를 보여줘 접속 불가로 오해하지 않게 함.
export default function WakingScreen() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={s.page}>
      <div style={s.spinner} />
      <div style={s.title}>불러오는 중...</div>
      <div style={{ ...s.hint, opacity: slow ? 1 : 0 }}>
        서버가 절전 상태에서 깨어나는 중이에요.<br />
        처음 접속은 최대 1분 정도 걸릴 수 있어요. 조금만 기다려 주세요.
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh', background: 'var(--canvas)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: 24, textAlign: 'center',
  },
  spinner: {
    width: 40, height: 40, marginBottom: 20,
    border: '3px solid var(--line)', borderTopColor: 'var(--accent)',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--ink-strong)', letterSpacing: '-0.02em' },
  hint: {
    marginTop: 12, fontSize: 13, lineHeight: 1.6, color: 'var(--muted)',
    maxWidth: 320, transition: 'opacity 0.4s ease',
  },
}
