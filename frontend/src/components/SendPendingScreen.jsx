export default function SendPendingScreen({ countdown, onCancel, total = 10 }) {
  const pct = ((total - countdown) / total) * 100

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>📤</div>
        <h2 style={s.title}>{countdown}초 후 발송됩니다</h2>
        <p style={s.sub}>취소하면 다시 작성 화면으로 돌아가요</p>

        <div style={s.barTrack}>
          <div style={{ ...s.barFill, width: `${pct}%` }} />
        </div>

        <button style={s.cancelBtn} onClick={onCancel}>✕ 전송 취소</button>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '48px 36px',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    width: '90%',
    maxWidth: 360,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 8,
    color: '#1e1e2e',
  },
  sub: {
    fontSize: 13,
    color: '#999',
    marginBottom: 28,
  },
  barTrack: {
    background: '#f0f0f0',
    borderRadius: 6,
    height: 8,
    marginBottom: 32,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: '#667eea',
    borderRadius: 6,
    transition: 'width 1s linear',
  },
  cancelBtn: {
    background: '#fff0f0',
    color: '#dc2626',
    border: '1.5px solid #fca5a5',
    borderRadius: 12,
    padding: '14px 0',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  },
}
