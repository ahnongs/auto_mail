import { buildSignatureHtml } from '../utils/signature'
import { R } from '../config/recipients'
import { useState, useMemo } from 'react'
import { api } from '../api'
import FileDropZone from '../components/FileDropZone'


const TODAY = new Date().toISOString().slice(0, 10)

export default function PaymentRequest({ user, settings, onBack }) {
  const [form, setForm] = useState({
    dept: settings.dept || '',
    purchaseDate: TODAY,
    vendor: '',
    amount: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    deadline: '',
    taxInvoice: '',
    notes: '',
  })
  const [attachFile, setAttachFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const to = R.request
  const cc = [settings.ceoEmail, settings.directorEmail, settings.managerEmail].filter(Boolean).join(', ')

  const mmdd = useMemo(() => {
    const d = new Date()
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const subject = `(입금요청) ${form.vendor || 'OO'} 입금 요청의 건 ${mmdd}`

  const body = useMemo(() => {
    let t = `아래와 같이 입금 요청 드립니다.\n\n`
    t += `1. 구매일자: ${form.purchaseDate}\n`
    t += `2. 업체명: ${form.vendor || '(미입력)'}\n`
    t += `3. 금액 (VAT 포함): ${form.amount ? Number(form.amount.replace(/,/g, '')).toLocaleString() + '원' : '(미입력)'}\n`
    t += `4. 계좌번호: ${form.bankName || '(은행)'} ${form.accountNumber || '(계좌번호)'}\n`
    t += `5. 예금주명: ${form.accountHolder || '(미입력)'}\n`
    t += `6. 입금기한: ${form.deadline || '(미입력)'}\n`
    t += `7. 세금계산서 발행 여부: ${form.taxInvoice}\n`
    if (form.notes) t += `\n※ 기타사항: ${form.notes}\n`
    t += `\n■ 거래내역서/명세서 첨부`
    return t
  }, [form])

  const handleSend = async () => {
    setError('')
    if (!form.vendor) return setError('업체명을 입력해주세요.')
    if (!form.amount) return setError('금액을 입력해주세요.')
    if (!form.accountNumber) return setError('계좌번호를 입력해주세요.')
    if (!attachFile) return setError('거래내역서/명세서를 첨부해주세요.')

    setSending(true)
    try {
      const attachmentData = await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result.split(',')[1])
        reader.readAsDataURL(attachFile)
      })
      await api.post('/mail/send', {
        to, cc, subject, body,
        attachmentData,
        attachmentName: attachFile.name,
        attachmentType: attachFile.type,
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
      <header style={s.header} className="r-header">
        <button style={s.backBtn} onClick={onBack}>← 뒤로</button>
        <span style={s.headerTitle}>💰 입금요청</span>
        <div style={{ width: 60 }} />
      </header>

      <div style={s.layout} className="r-layout">
        <div style={s.formCol}>
          <div style={s.card}>
            <div style={s.cardTitle}>신청자 정보</div>
            <div style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={s.sublabel}>이름 (자동입력)</div>
                <input style={{ ...s.input, background: '#f7f7f7', color: '#aaa' }} value={user.name} readOnly />
              </div>
              <div style={{ flex: 1, marginLeft: 12 }}>
                <div style={s.sublabel}>부서</div>
                <input style={s.input} placeholder="예: 마케팅파트" value={form.dept} onChange={e => set('dept', e.target.value)} />
              </div>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>입금 정보</div>
            <div style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={s.sublabel}>구매일자</div>
                <input type="date" style={s.input} value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} />
              </div>
              <div style={{ flex: 1, marginLeft: 12 }}>
                <div style={s.sublabel}>입금기한</div>
                <input type="date" style={s.input} value={form.deadline} onChange={e => set('deadline', e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={s.sublabel}>업체명 <span style={{ color: '#ef4444' }}>*</span></div>
              <input style={s.input} placeholder="예: (주)스타닥" value={form.vendor} onChange={e => set('vendor', e.target.value)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={s.sublabel}>금액 (VAT 포함) <span style={{ color: '#ef4444' }}>*</span></div>
              <input style={s.input} placeholder="예: 110,000" value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>계좌 정보</div>
            <div style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={s.sublabel}>은행명</div>
                <input style={s.input} placeholder="예: 국민은행" value={form.bankName} onChange={e => set('bankName', e.target.value)} />
              </div>
              <div style={{ flex: 2, marginLeft: 12 }}>
                <div style={s.sublabel}>계좌번호 <span style={{ color: '#ef4444' }}>*</span></div>
                <input style={s.input} placeholder="000-0000-0000-00" value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={s.sublabel}>예금주명</div>
              <input style={s.input} placeholder="예금주 이름" value={form.accountHolder} onChange={e => set('accountHolder', e.target.value)} />
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>세금계산서 발행 여부</div>
            <div style={s.sublabel}>세금계산서 발행여부</div>
            <input style={s.input} value={form.taxInvoice} onChange={e => set('taxInvoice', e.target.value)} />
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>기타사항 <span style={{ color: '#bbb', fontSize: 12, fontWeight: 400 }}>선택</span></div>
            <textarea style={s.textarea} rows={2} placeholder="없음" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div style={{ ...s.card, ...(error.includes('첨부') ? { border: '1.5px solid #fca5a5' } : {}) }}>
            <div style={s.cardTitle}>📎 거래내역서 / 명세서 <span style={{ color: '#ef4444' }}>*</span></div>
            <FileDropZone file={attachFile} onChange={setAttachFile} />
          </div>

          {error && <div style={s.error}>⚠️ {error}</div>}
          <button style={{ ...s.btnPrimary, padding: '14px', fontSize: 15, borderRadius: 12 }} onClick={handleSend} disabled={sending}>
            {sending ? '발송 중...' : '📤 메일 발송하기'}
          </button>
        </div>

        <div style={s.previewCol} className="r-preview-col">
          <div style={s.previewTitle}>실시간 미리보기</div>
          <div style={s.previewCard}>
            <div style={s.pRow}><span style={s.pKey}>받는사람</span><span style={s.pVal}>{to}</span></div>
            <div style={s.pRow}><span style={s.pKey}>참조</span><span style={{ ...s.pVal, color: '#666', fontSize: 12 }}>{cc || '없음'}</span></div>
            <div style={s.pRow}><span style={s.pKey}>제목</span><span style={{ ...s.pVal, fontWeight: 600 }}>{subject}</span></div>
            {attachFile && <div style={s.pRow}><span style={s.pKey}>첨부</span><span style={{ ...s.pVal, color: '#667eea', fontSize: 12 }}>📎 {attachFile.name}</span></div>}
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
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 12 },
  sublabel: { fontSize: 12, color: '#888', marginBottom: 6 },
  row: { display: 'flex', gap: 0 },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e8e8e8', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  textarea: { width: '100%', padding: '10px 12px', border: '1.5px solid #e8e8e8', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
  optBtn: { padding: '8px 16px', border: '1.5px solid #e8e8e8', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' },
  optSel: { border: '1.5px solid #667eea', background: '#f0f0ff', color: '#667eea', fontWeight: 600 },
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
