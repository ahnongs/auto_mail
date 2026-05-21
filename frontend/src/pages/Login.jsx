export default function Login() {
  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:8000/auth/google'
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>✉️</div>
        <h1 style={styles.title}>사내 메일 서비스</h1>
        <p style={styles.subtitle}>Google 계정으로 로그인하여 시작하세요</p>

        <button style={styles.googleButton} onClick={handleGoogleLogin}>
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            style={styles.googleIcon}
          />
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
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  logo: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '32px',
    lineHeight: '1.5',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 24px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    background: '#fff',
    fontSize: '15px',
    fontWeight: '500',
    color: '#333',
    transition: 'all 0.2s',
  },
  googleIcon: {
    width: '20px',
    height: '20px',
  },
}
