import { useEffect, useRef } from 'react'
import { c } from '../styles/pageStyles'

// 에러가 나타나면 자동으로 화면에 스크롤 → 긴 폼에서도 사용자가 바로 인지 (P1 UX)
export default function ErrorNotice({ message }) {
  const ref = useRef(null)
  useEffect(() => {
    if (message && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [message])

  if (!message) return null
  return (
    <div ref={ref} role="alert" style={style}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" />
      </svg>
      <span>{message}</span>
    </div>
  )
}

const style = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: c.errBg, border: `1px solid ${c.errLine}`, borderRadius: 6,
  padding: '10px 14px', fontSize: 13, color: c.errInk,
}
