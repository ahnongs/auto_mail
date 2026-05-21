import { useState, useMemo } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:8000', withCredentials: true })

function buildSignatureHtml(settings, userEmail) {
  if (!settings.sigNameKo && !settings.sigPosition) return ''
  let h = '<div style="font-family:sans-serif;border-left:3px solid #667eea;padding-left:12px">'
  if (settings.sigNameKo) {
    h += `<div style="font-size:15px;font-weight:700;color:#222">${settings.sigNameKo}`
    if (settings.sigNameEn) h += `<span style="font-size:12px;font-weight:400;color:#888;margin-left:6px">${settings.sigNameEn}</span>`
    h += '</div>'
  }
  if (settings.sigPosition) h += `<div style="font-size:12px;color:#555;margin-top:2px">${settings.sigPosition}</div>`
  h += '<div style="margin-top:6px;font-size:12px;color:#444;line-height:1.6">'
  if (settings.sigPhone) h += `<div>T. ${settings.sigPhone}</div>`
  h += `<div>E. ${userEmail}</div></div>`
  h += '<div style="margin-top:6px;font-size:11px;color:#aaa">서울 강남구 테헤란로57길 21 2층 | 02-533-7776</div></div>'
  return h
}

const CATEGORIES = ['복리후생비(식대/회식/간식)', '여비교통비', '접대비', '운반비', '소모품비', '수선비', '지급수수료', '광고선전비']

const emptyItem = () => ({ date: '', category: CATEGORIES[0], detail: '', amount: '' })

export default function ExpenseRequest({ user, settings, onBack }) {
  const [form, setForm] = useState({
    dept: settings.dept || '',
    bank: '',
    account: '',
  })
  const [items, setItems] = useState([emptyItem()])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setItem = (i, k, v) => setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  const addItem = () => setItems(arr => [...arr, emptyItem()])
  const removeItem = (i) => setItems(arr => arr.filter((_, idx) => idx !== i))

  const total = items.reduce((s, it) => s + (Number(it.amount.replace(/,/g, '')) || 0), 0)

  const to = 'request@stardoc1.com'
  const cc = [settings.ceoEmail, settings.directorEmail, settings.managerEmail].filter(Boolean).join(', ')

  const mmdd = useMemo(() => {
    const d = new Date()
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const subject = `(지출결의서) ${form.dept || 'OOO파트'} ${user.name} 개인비용 사용의 건 ${mmdd}`

  const body = useMemo(() => {
    let t = `아래와 같이 개인비용 지출결의서를 제출합니다.\n\n`
    t += `■ 작성자 정보\n`
    t += `  - 이름: ${user.name}\n`
    t += `  - 부서: ${form.dept || '(미입력)'}\n`
    t += `  - 계좌: ${form.bank || '(은행)'} ${form.account || '(계좌번호)'}\n\n`
    t += `■ 지출 내역\n`
    t += `${'─'.repeat(70)}\n`
    t += ` No | 일자       | 구분              | 세부내용          | 금액\n`
    t += `${'─'.repeat(70)}\n`
    items.forEach((it, i) => {
      const amt = it.amount ? Number(it.amount.replace(/,/g, '')).toLocaleString() + '원' : '-'
      t += ` ${String(i + 1).padEnd(2)} | ${(it.date || '-').padEnd(10)} | ${it.category.slice(0, 16).padEnd(17)} | ${(it.detail || '-').slice(0, 16).padEnd(17)} | ${amt}\n`
    })
    t += `${'─'.repeat(70)}\n`
    t += ` 합계: ${total.toLocaleString()}원\n`
    return t
  }, [form, items, user, total])

  const handleSend = async () => {
    setError('')
    if (!form.dept) return setError('부서를 입력해주세요.')
    if (!form.account) return setError('계좌번호를 입력해주세요.')
    if (items.some(it => !it.detail || !it.amount)) return setError('지출 내역을 모두 입력해주세요.')

    setSending(true)
    try {
      await api.post('/mail/send', {
        to, cc, subject, body,
        signatureImageData: settings.logoImageData || '',
        signatureImageType: settings.logoImageType || '',
        signatureHtml: buildSignatureHtml(settings, user.email),
      })
      setSent(true)
    } catch (e) {
      setError('발송 실패: ' + (e.response?.data?.detail || e.message))
    } finally {
      setSending(false)
    }
  }

  if (sent) return (
    <div style={s.center}>
      <div style={s.successCard}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
        <h2 style={{ marginBottom: 6 }}>메일 발송 완료!</h2>
        <p style={{ color: '#888', marginBottom: 24 }}>{to}에게 전송됐어요.</p>
        <button style={s.btnPrimary} onClick={onBack}>홈으로 돌아가기</button>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.backBtn} onClick={onBack}>← 뒤로</button>
        <span style={s.headerTitle}>💳 개인비용 지출결의서</span>
        <div style={{ width: 60 }} />
      </header>

      <div style={s.layout}>
        <div style={s.formCol}>
          <div style={s.card}>
            <div style={s.cardTitle}>작성자 정보</div>
            <div style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={s.sublabel}>이름 (자동입력)</div>
                <input style={{ ...s.input, background: '#f7f7f7', color: '#aaa' }} value={user.name} readOnly />
              </div>
              <div style={{ flex: 1, marginLeft: 12 }}>
                <div style={s.sublabel}>부서 <span style={{ color: '#ef4444' }}>*</span></div>
                <input style={s.input} placeholder="예: 마케팅파트" value={form.dept} onChange={e => set('dept', e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={s.sublabel}>환급 계좌 <span style={{ color: '#ef4444' }}>*</span></div>
              <div style={s.row}>
                <input style={{ ...s.input, flex: 1 }} placeholder="은행명" value={form.bank} onChange={e => set('bank', e.target.value)} />
                <input style={{ ...s.input, flex: 2, marginLeft: 8 }} placeholder="계좌번호" value={form.account} onChange={e => set('account', e.target.value)} />
              </div>
            </div>
          </div>

          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={s.cardTitle}>지출 내역 <span style={{ color: '#ef4444' }}>*</span></div>
              <button style={s.addBtn} onClick={addItem}>+ 항목 추가</button>
            </div>
            {items.map((it, i) => (
              <div key={i} style={{ background: '#f8f8ff', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#667eea' }}>항목 {i + 1}</span>
                  {items.length > 1 && <button style={s.removeBtn} onClick={() => removeItem(i)}>✕</button>}
                </div>
                <div style={s.row}>
                  <div style={{ flex: 1 }}>
                    <div style={s.sublabel}>일자</div>
                    <input type="date" style={s.input} value={it.date} onChange={e => setItem(i, 'date', e.target.value)} />
                  </div>
                  <div style={{ flex: 1, marginLeft: 8 }}>
                    <div style={s.sublabel}>금액</div>
                    <input style={s.input} placeholder="0" value={it.amount} onChange={e => setItem(i, 'amount', e.target.value)} />
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={s.sublabel}>구분</div>
                  <select style={s.input} value={it.category} onChange={e => setItem(i, 'category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={s.sublabel}>세부내용</div>
                  <input style={s.input} placeholder="예: 팀 점심 식사" value={it.detail} onChange={e => setItem(i, 'detail', e.target.value)} />
                </div>
              </div>
            ))}
            <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#333', marginTop: 4 }}>
              합계: {total.toLocaleString()}원
            </div>
          </div>

          {error && <div style={s.error}>⚠️ {error}</div>}
          <button style={{ ...s.btnPrimary, padding: '14px', fontSize: 15, borderRadius: 12 }} onClick={handleSend} disabled={sending}>
            {sending ? '발송 중...' : '📤 메일 발송하기'}
          </button>
        </div>

        <div style={s.previewCol}>
          <div style={s.previewTitle}>실시간 미리보기</div>
          <div style={s.previewCard}>
            <div style={s.pRow}><span style={s.pKey}>받는사람</span><span style={s.pVal}>{to}</span></div>
            <div style={s.pRow}><span style={s.pKey}>참조</span><span style={{ ...s.pVal, color: '#666', fontSize: 12 }}>{cc || '없음'}</span></div>
            <div style={s.pRow}><span style={s.pKey}>제목</span><span style={{ ...s.pVal, fontWeight: 600 }}>{subject}</span></div>
            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '12px 0' }} />
            <pre style={s.preBody}>{body}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#f5f5f5' },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 56, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  headerTitle: { fontSize: 16, fontWeight: 700 },
  backBtn: { background: 'none', border: 'none', fontSize: 14, color: '#667eea', cursor: 'pointer' },
  layout: { display: 'flex', gap: 20, padding: 24, maxWidth: 1080, margin: '0 auto', alignItems: 'flex-start' },
  formCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 12 },
  previewCol: { width: 360, position: 'sticky', top: 24 },
  card: { background: '#fff', borderRadius: 12, padding: 20 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 0 },
  sublabel: { fontSize: 12, color: '#888', marginBottom: 6 },
  row: { display: 'flex', gap: 0 },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e8e8e8', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  addBtn: { background: '#667eea', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' },
  removeBtn: { background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#999' },
  error: { background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' },
  btnPrimary: { background: '#667eea', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' },
  successCard: { background: '#fff', borderRadius: 16, padding: '48px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
  previewTitle: { fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8, paddingLeft: 2 },
  previewCard: { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  pRow: { display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  pKey: { fontSize: 11, fontWeight: 600, color: '#bbb', minWidth: 52, paddingTop: 1 },
  pVal: { fontSize: 13, color: '#333', flex: 1, wordBreak: 'break-all' },
  preBody: { fontSize: 11.5, color: '#444', lineHeight: 1.75, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 },
}
