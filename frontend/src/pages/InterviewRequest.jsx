import { buildSignatureHtml } from '../utils/signature'
import { R } from '../config/recipients'
import { useState, useMemo } from 'react'
import { api, sendMail } from '../api'
import { useUndoSend } from '../hooks/useUndoSend'
import UndoToast from '../components/UndoToast'


const TARGETS = ['파트장', '본부장', '경영지원 파트장']
const PURPOSES = ['업무 분장', '사내 고충', '개인 상담', '기타']

export default function InterviewRequest({ user, settings, onBack }) {
  const [form, setForm] = useState({
    dept: settings.dept || '',
    target: TARGETS[0],
    purpose: PURPOSES[0],
    preferDate: '',
    content: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const { pending, countdown, schedule, cancel } = useUndoSend()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const to = R.interview
  const cc = [settings.managerEmail].filter(Boolean).join(', ')
  const previewTo = settings.testMode ? settings.testEmail : to
  const previewCc = settings.testMode ? '' : cc

  const mmdd = useMemo(() => {
    const d = new Date()
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const subject = `(면담신청) ${form.dept || '00파트'} ${user.name} 면담 요청 건 ${mmdd}`

  const body = useMemo(() => {
    let t = `아래와 같이 면담을 신청합니다.\n\n`
    t += `1. 면담 신청자: ${user.name}\n`
    t += `2. 소속 부서: ${form.dept || '(미입력)'}\n`
    t += `3. 요청 대상: ${form.target}\n`
    t += `4. 요청 목적: ${form.purpose}\n`
    t += `5. 희망 일정: ${form.preferDate || '(미입력)'}\n`
    if (form.content) t += `\n6. 면담 내용\n${form.content}\n`
    return t
  }, [form, user])

  const handleSend = async () => {
    setError('')
    if (!form.dept) return setError('부서를 입력해주세요.')
    if (!form.preferDate) return setError('희망 면담 일자를 선택해주세요.')
    if (!form.content) return setError('면담 내용을 입력해주세요.')

    schedule(async () => {
      setSending(true)
      try {
        await sendMail({
          to, cc, subject, body,
          signatureImageData: settings.logoImageData || '',
          signatureImageType: settings.logoImageType || '',
          signatureHtml: buildSignatureHtml(settings, user.email),
        }, settings)
        setSent(true)
      } catch (e) {
        setError('발송 실패: ' + (e.response?.data?.detail || e.message))
      } finally {
        setSending(false)
      }
    })
  }

  if (sent) return (
    <div style={s.center}>
      <div style={s.successCard}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
        <h2 style={{ marginBottom: 6 }}>메일 발송 완료!</h2>
        <p style={{ color: '#888', marginBottom: 24 }}>{previewTo}에게 전송됐어요.</p>
        <button style={s.btnPrimary} onClick={onBack}>홈으로 돌아가기</button>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <header style={s.header} className="r-header">
        <button style={s.backBtn} onClick={onBack}>← 뒤로</button>
        <span style={s.headerTitle}>💬 면담신청</span>
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
                <div style={s.sublabel}>부서 <span style={{ color: '#ef4444' }}>*</span></div>
                <input style={s.input} placeholder="예: 마케팅파트" value={form.dept} onChange={e => set('dept', e.target.value)} />
              </div>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>면담 정보</div>
            <div style={s.sublabel}>요청 대상</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {TARGETS.map(t => (
                <button key={t} style={{ ...s.optBtn, ...(form.target === t ? s.optSel : {}) }} onClick={() => set('target', t)}>{t}</button>
              ))}
            </div>
            <div style={s.sublabel}>요청 목적</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {PURPOSES.map(p => (
                <button key={p} style={{ ...s.optBtn, ...(form.purpose === p ? s.optSel : {}) }} onClick={() => set('purpose', p)}>{p}</button>
              ))}
            </div>
            <div style={s.sublabel}>희망 일자 <span style={{ color: '#ef4444' }}>*</span></div>
            <input type="date" style={s.input} value={form.preferDate} onChange={e => set('preferDate', e.target.value)} />
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>면담 내용 <span style={{ color: '#ef4444' }}>*</span></div>
            <textarea style={s.textarea} rows={5} placeholder="면담에서 논의하고 싶은 내용을 작성해주세요" value={form.content} onChange={e => set('content', e.target.value)} />
          </div>

          {error && <div style={s.error}>⚠️ {error}</div>}
          <button style={{ ...s.btnPrimary, padding: '14px', fontSize: 15, borderRadius: 12 }} onClick={handleSend} disabled={sending || pending}>
            {sending ? '발송 중...' : '📤 메일 발송하기'}
          </button>
          {pending && <UndoToast countdown={countdown} onCancel={cancel} />}
        </div>

        <div style={s.previewCol} className="r-preview-col">
          <div style={s.previewTitle}>실시간 미리보기</div>
          <div style={s.previewCard}>
            {settings.testMode && <div style={{ background:'#fff3cd', borderRadius:6, padding:'5px 8px', marginBottom:8, fontSize:11, color:'#92400e' }}>🧪 테스트 모드 — 실제 수신자 대신 아래 주소로 발송됩니다</div>}
            <div style={s.pRow}><span style={s.pKey}>받는사람</span><span style={{ ...s.pVal, ...(settings.testMode ? {color:'#b45309',fontWeight:600} : {}) }}>{previewTo}</span></div>
            <div style={s.pRow}><span style={s.pKey}>참조</span><span style={{ ...s.pVal, color: '#666', fontSize: 12 }}>{previewCc || '없음'}</span></div>
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
