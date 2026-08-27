import { API_BASE } from '../api'
import { c, mono } from '../styles/pageStyles'

export default function Login() {
  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.eyebrow}>STARDOC · 사내 문서 발송</div>
        <div style={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: c.accent }}>
            <rect x="2.5" y="4.5" width="19" height="15" rx="1.5" /><path d="M3 6l9 6 9-6" />
          </svg>
        </div>
        <h1 style={styles.title}>사내 메일 서비스</h1>
        <p style={styles.subtitle}>Google 계정으로 로그인하여 시작하세요</p>

        <button style={styles.googleButton} onClick={handleGoogleLogin}>
          <svg viewBox="0 0 48 48" width="18" height="18" style={styles.googleIcon} aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Google 계정으로 로그인
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: c.canvas,
    padding: '24px',
  },
  card: {
    background: c.surface,
    border: `1px solid ${c.line}`,
    borderRadius: '12px',
    padding: '44px 40px',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
  },
  eyebrow: {
    fontFamily: mono,
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: c.faint,
    marginBottom: '20px',
  },
  logo: {
    width: '48px',
    height: '48px',
    margin: '0 auto 18px',
    borderRadius: '10px',
    display: 'grid',
    placeItems: 'center',
    background: c.accentSoft,
    border: `1px solid ${c.accentLine}`,
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    letterSpacing: '-0.03em',
    color: c.inkStrong,
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: c.muted,
    marginBottom: '28px',
    lineHeight: '1.5',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '12px 24px',
    border: `1px solid ${c.line}`,
    borderRadius: '6px',
    background: c.surface,
    fontSize: '14px',
    fontWeight: '600',
    color: c.inkStrong,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  googleIcon: {
    width: '18px',
    height: '18px',
    flexShrink: 0,
  },
}
