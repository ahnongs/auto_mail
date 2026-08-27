import { c } from '../styles/pageStyles'

export default function SendPendingScreen({ countdown, onCancel, onSendNow, total = 10 }) {
  const pct = ((total - countdown) / total) * 100

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>{countdown}초 후 발송됩니다</h2>
        <p style={s.sub}>취소하면 다시 작성 화면으로 돌아가요</p>

        <div style={s.barTrack}>
          <div style={{ ...s.barFill, width: `${pct}%` }} />
        </div>

        <div style={s.btnRow}>
          <button style={s.cancelBtn} onClick={onCancel}>전송 취소</button>
          <button style={s.sendNowBtn} onClick={onSendNow}>바로 전송</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: c.canvas,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    background: c.surface,
    border: `1px solid ${c.line}`,
    borderRadius: 12,
    padding: '44px 36px',
    textAlign: 'center',
    boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
    width: '90%',
    maxWidth: 360,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    marginBottom: 8,
    color: c.inkStrong,
  },
  sub: {
    fontSize: 13,
    color: c.muted,
    marginBottom: 28,
  },
  barTrack: {
    background: c.surface2,
    border: `1px solid ${c.line}`,
    borderRadius: 6,
    height: 8,
    marginBottom: 32,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: c.accent,
    borderRadius: 6,
    transition: 'width 1s linear',
  },
  btnRow: {
    display: 'flex',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    background: c.surface,
    color: c.muted,
    border: `1px solid ${c.line}`,
    borderRadius: 6,
    padding: '13px 0',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  sendNowBtn: {
    flex: 1,
    background: c.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '13px 0',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
}
