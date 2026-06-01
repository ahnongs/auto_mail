import { useState, useEffect } from 'react'
import { getMailHistory } from '../api'

const TYPE_META = {
  vacation:  { label: '휴가신청',   icon: '🌴', color: '#22c55e' },
  expense:   { label: '지출결의',   icon: '💳', color: '#667eea' },
  payment:   { label: '입금요청',   icon: '💰', color: '#f59e0b' },
  clockfix:  { label: '출퇴근변경', icon: '🕐', color: '#6366f1' },
  interview: { label: '면담신청',   icon: '💬', color: '#ec4899' },
  repair:    { label: '수리요청',   icon: '🔧', color: '#f97316' },
  payment2:  { label: '온라인결제', icon: '🛒', color: '#14b8a6' },
}

function formatSentAt(iso) {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${min}`
}

export default function HistoryPage({ onBack }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getMailHistory()
      .then(r => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const usedTypes = [...new Set(history.map(m => m.type).filter(Boolean))]
  const filtered = filter === 'all' ? history : history.filter(m => m.type === filter)

  return (
    <div style={s.page}>
      <header style={s.header} className="r-header">
        <button style={s.backBtn} onClick={onBack}>← 뒤로</button>
        <span style={s.headerTitle}>📋 발송 이력</span>
        <div style={{ width: 60 }} />
      </header>

      <div style={s.container}>
        {/* 필터 탭 */}
        {usedTypes.length > 0 && (
          <div style={s.filterRow}>
            <button
              style={{ ...s.filterBtn, ...(filter === 'all' ? s.filterBtnActive : {}) }}
              onClick={() => setFilter('all')}
            >전체 {history.length}건</button>
            {usedTypes.map(t => {
              const meta = TYPE_META[t]
              if (!meta) return null
              const count = history.filter(m => m.type === t).length
              return (
                <button
                  key={t}
                  style={{
                    ...s.filterBtn,
                    ...(filter === t ? { background: meta.color, borderColor: meta.color, color: '#fff', fontWeight: 700 } : {})
                  }}
                  onClick={() => setFilter(t)}
                >{meta.icon} {meta.label} {count}</button>
              )
            })}
          </div>
        )}

        {/* 목록 */}
        <div style={s.list}>
          {loading && (
            <div style={s.empty}>불러오는 중...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={s.empty}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div>{filter === 'all' ? '아직 발송한 메일이 없어요.' : '해당 종류의 발송 이력이 없어요.'}</div>
            </div>
          )}
          {filtered.map((mail, i) => {
            const meta = TYPE_META[mail.type] || { label: mail.type || '기타', icon: '📧', color: '#aaa' }
            const gmailUrl = mail.message_id
              ? `https://mail.google.com/mail/u/0/#sent/${mail.message_id}`
              : null
            return (
              <div key={i} style={s.item}>
                <div style={s.itemLeft}>
                  <span style={{ ...s.badge, background: meta.color + '18', color: meta.color }}>
                    {meta.icon} {meta.label}
                  </span>
                  <div style={s.subject}>{mail.subject}</div>
                  <div style={s.meta}>→ {mail.to} · {formatSentAt(mail.sent_at)}</div>
                </div>
                {gmailUrl && (
                  <a href={gmailUrl} target="_blank" rel="noreferrer" style={s.gmailLink}>
                    Gmail ↗
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#f5f5f5' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: 56, background: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  headerTitle: { fontSize: 16, fontWeight: 700 },
  backBtn: { background: 'none', border: 'none', fontSize: 14, color: '#667eea', cursor: 'pointer' },
  container: { maxWidth: 720, margin: '0 auto', padding: 24 },
  filterRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  filterBtn: {
    fontSize: 12, padding: '6px 14px',
    border: '1.5px solid #e0e0e0', borderRadius: 20,
    background: '#fff', color: '#666', cursor: 'pointer',
  },
  filterBtnActive: {
    background: '#667eea', borderColor: '#667eea', color: '#fff', fontWeight: 700,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  empty: {
    textAlign: 'center', color: '#bbb', fontSize: 14,
    padding: '60px 0',
  },
  item: {
    background: '#fff', borderRadius: 12, padding: '14px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  itemLeft: { flex: 1, minWidth: 0 },
  badge: {
    display: 'inline-block', fontSize: 11, fontWeight: 700,
    borderRadius: 20, padding: '2px 9px', marginBottom: 6,
  },
  subject: {
    fontSize: 14, fontWeight: 600, color: '#222',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  meta: { fontSize: 11, color: '#aaa', marginTop: 3 },
  gmailLink: {
    fontSize: 12, color: '#667eea', fontWeight: 600,
    textDecoration: 'none', flexShrink: 0,
    padding: '6px 12px', border: '1.5px solid #e0e0e8',
    borderRadius: 8, background: '#f8f8ff',
  },
}
