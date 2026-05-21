import { buildSignatureHtml } from '../utils/signature'
import { R } from '../config/recipients'
import { useState, useMemo } from 'react'
import { api } from '../api'
import FileDropZone from '../components/FileDropZone'


const URGENCY = ['일반', '긴급']
const REQ_TYPE = ['계약 포함', '서비스', '비용 청구', '내부 디자인']

export default function DesignRequest({ user, settings, onBack }) {
  const [form, setForm] = useState({
    dept: settings.dept || '',
    client: '',
    usage: '',
    deadline: '',
    urgency: '일반',
    reqType: '내부 디자인',
    quantity: '1',
    description: '',
  })
  const [attachFile, setAttachFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const to = R.design
  const cc = [settings.ceoEmail, settings.directorEmail, settings.managerEmail].filter(Boolean).join(', ')

  const today = new Date().toISOString().slice(0, 10)

  const subject = useMemo(() => {
    const d = new Date()
    const yy = String(d.getFullYear()).slice(2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `(디자인요청) ${form.description ? form.description.slice(0, 20) : 'OOO'} 이미지 제작 요청의 건 ${yy}.${mm}.${dd}`
  }, [form.description])

  const body = useMemo(() => {
    let t = `아래와 같이 디자인 제작을 요청합니다.\n\n`
    t += `1. 클라이언트: ${form.client || '(미입력)'}\n`
    t += `2. 이미지 활용처: ${form.usage || '(미입력)'}\n`
    t += `3. 요청자: ${user.name} (${form.dept || settings.dept || '미입력'})\n`
    t += `4. 요청일: ${today}\n`
    t += `5. 희망 마감일: ${form.deadline || '(미입력)'}\n`
    t += `6. 업무 긴급도: ${form.urgency}\n`
    t += `7. 요청 구분: ${form.reqType}\n`
    t += `8. 제작 수량: ${form.quantity}개\n`
    if (form.description) t += `\n■ 요청 내용\n${form.description}\n`
    if (attachFile) t += `\n■ 기획서 첨부`
    return t
  }, [form, user, today, attachFile, settings.dept])

  const handleSend = async () => {
    setError('')
    if (!form.client) return setError('클라이언트를 입력해주세요.')
    if (!form.usage) return setError('이미지 활용처를 입력해주세요.')
    if (!form.description) return setError('요청 내용을 입력해주세요.')
    if (!form.deadline) return setError('희망 마감일을 선택해주세요.')

    setSending(true)
    try {
      const payload = {
        to, cc, subject, body,
        signatureImageData: settings.logoImageData || '',
        signatureImageType: settings.logoImageType || '',
        signatureHtml: buildSignatureHtml(settings, user.email),
      }
      if (attachFile) {
        payload.attachmentData = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target.result.split(',')[1])
          reader.readAsDataURL(attachFile)
        })
        payload.attachmentName = attachFile.name
        payload.attachmentType = attachFile.type
      }
      await api.post('/mail/send', payload)
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
        <span style={s.headerTitle}>🎨 디자인요청</span>
        <div style={{ width: 60 }} />
      </header>

      <div style={s.layout} className="r-layout">
        <div style={s.formCol}>
          <div style={s.card}>
            <div style={s.cardTitle}>기본 정보</div>
            <div style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={s.sublabel}>클라이언트 <span style={{ color: '#ef4444' }}>*</span></div>
                <input style={s.input} placeholder="예: OO병원" value={form.client} onChange={e => set('client', e.target.value)} />
              </div>
              <div style={{ flex: 1, marginLeft: 12 }}>
                <div style={s.sublabel}>이미지 활용처 <span style={{ color: '#ef4444' }}>*</span></div>
                <input style={s.input} placeholder="예: SNS 피드, 현수막" value={form.usage} onChange={e => set('usage', e.target.value)} />
              </div>
            </div>
            <div style={{ ...s.row, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={s.sublabel}>희망 마감일 <span style={{ color: '#ef4444' }}>*</span></div>
                <input type="date" style={s.input} value={form.deadline} onChange={e => set('deadline', e.target.value)} />
              </div>
              <div style={{ flex: 1, marginLeft: 12 }}>
                <div style={s.sublabel}>제작 수량</div>
                <input style={s.input} placeholder="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
              </div>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>요청 구분</div>
            <div style={s.sublabel}>업무 긴급도</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {URGENCY.map(v => (
                <button key={v} style={{ ...s.optBtn, ...(form.urgency === v ? s.optSel : {}), ...(v === '긴급' && form.urgency === v ? { borderColor: '#ef4444', background: '#fff0f0', color: '#ef4444' } : {}) }}
                  onClick={() => set('urgency', v)}>{v === '긴급' ? '🔴 긴급' : '🟢 일반'}</button>
              ))}
            </div>
            <div style={s.sublabel}>요청 구분</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {REQ_TYPE.map(v => (
                <button key={v} style={{ ...s.optBtn, ...(form.reqType === v ? s.optSel : {}) }} onClick={() => set('reqType', v)}>{v}</button>
              ))}
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>요청 내용 <span style={{ color: '#ef4444' }}>*</span></div>
            <textarea style={s.textarea} rows={5} placeholder="제작 요청 내용을 상세히 작성해주세요 (사이즈, 컬러, 스타일 등)" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>📎 기획서 첨부 <span style={{ color: '#bbb', fontSize: 12, fontWeight: 400 }}>선택</span></div>
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
  optBtn: { padding: '8px 14px', border: '1.5px solid #e8e8e8', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer' },
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
