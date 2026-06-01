import { buildSignatureHtml } from '../utils/signature'
import { R } from '../config/recipients'
import { useState, useMemo } from 'react'
import { api, sendMail } from '../api'
import { useUndoSend } from '../hooks/useUndoSend'
import SendPendingScreen from '../components/SendPendingScreen'
import { ps } from '../styles/pageStyles'
import { getMMDD } from '../utils/dateUtils'


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
  const { pending, countdown, schedule, cancel, sendNow } = useUndoSend()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const to = R.interview
  const cc = [settings.managerEmail].filter(Boolean).join(', ')
  const previewTo = settings.testMode ? settings.testEmail : to
  const previewCc = settings.testMode ? '' : cc

  const mmdd = useMemo(() => getMMDD(), [])

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
          mailType: 'interview',
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

  if (pending) return <SendPendingScreen countdown={countdown} onCancel={cancel} onSendNow={sendNow} />

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
          <button style={{ ...s.btnPrimary, padding: '14px', fontSize: 15, borderRadius: 12 }} onClick={handleSend} disabled={sending}>
            {sending ? '발송 중...' : '📤 메일 발송하기'}
          </button>
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

const s = ps
