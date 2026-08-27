import { c } from '../styles/pageStyles'

// 실제 전송 중(취소 유예 이후) 표시되는 로딩 화면
export default function SendingScreen() {
  return (
    <div style={s.page}>
      <div style={s.spinner} />
      <div style={s.title}>전송 중...</div>
      <div style={s.sub}>메일을 발송하고 있어요. 잠시만 기다려주세요.</div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh', background: c.canvas,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  spinner: {
    width: 40, height: 40, marginBottom: 20,
    border: `3px solid ${c.line}`, borderTopColor: c.accent,
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  title: { fontSize: 18, fontWeight: 700, color: c.inkStrong, letterSpacing: '-0.02em' },
  sub: { fontSize: 13, color: c.muted, marginTop: 4 },
}
