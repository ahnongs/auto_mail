export default function UndoToast({ countdown, onCancel, total = 10 }) {
  const pct = (countdown / total) * 100

  return (
    <div style={styles.wrap}>
      <div style={styles.toast}>
        <div style={{ ...styles.progress, width: `${pct}%` }} />
        <div style={styles.left}>
          <span style={styles.msg}>📤 {countdown}초 후 발송됩니다</span>
        </div>
        <button style={styles.btn} onClick={onCancel}>취소</button>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    position: 'fixed',
    bottom: 32,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: '#1e1e2e',
    color: '#fff',
    borderRadius: 14,
    padding: '14px 20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
    minWidth: 280,
    maxWidth: 360,
    position: 'relative',
    overflow: 'hidden',
    pointerEvents: 'auto',
  },
  progress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    background: '#667eea',
    borderRadius: '0 0 0 14px',
    transition: 'width 1s linear',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
  },
  msg: {
    fontSize: 14,
    fontWeight: 500,
  },
  btn: {
    background: '#667eea',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
  },
}
