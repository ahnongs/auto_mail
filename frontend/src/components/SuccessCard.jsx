import { ps, c } from '../styles/pageStyles'

// 발송 완료 화면 — 이모지 대신 SVG 체크, "보낸 메일 보기" 다음 동작 제공 (P2 UX)
export default function SuccessCard({ to, onBack, onNavigate, children }) {
  return (
    <div style={ps.center}>
      <div style={ps.successCard}>
        <div style={checkWrap}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: c.okInk }}>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 style={{ marginBottom: 6, fontSize: 20, fontWeight: 700, color: c.inkStrong }}>메일 발송 완료</h2>
        <p style={{ color: c.muted, marginBottom: 24, fontSize: 14 }}>{to}에게 전송됐어요.</p>
        {children}
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...ps.btnPrimary, background: c.surface, color: c.muted, border: `1px solid ${c.line}` }} onClick={onBack}>
            홈으로 돌아가기
          </button>
          {onNavigate && (
            <button style={ps.btnPrimary} onClick={() => onNavigate('history')}>
              보낸 메일 보기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const checkWrap = {
  width: 52, height: 52, borderRadius: '50%', margin: '0 auto 16px',
  display: 'grid', placeItems: 'center',
  background: c.okBg, border: `1px solid ${c.okLine}`,
}
