import { buildSignatureHtml } from '../utils/signature'
import { R } from '../config/recipients'
import { useState, useMemo } from 'react'
import { api, sendMail } from '../api'
import FileDropZone from '../components/FileDropZone'
import { useUndoSend } from '../hooks/useUndoSend'
import SendPendingScreen from '../components/SendPendingScreen'
import { ps } from '../styles/pageStyles'
import { getMMDD } from '../utils/dateUtils'
import { readFileAsBase64 } from '../utils/fileUtils'


export default function RepairRequest({ user, settings, onBack }) {
  const [form, setForm] = useState({
    dept: settings.dept || '',
    target: '',
    occurDate: '',
    symptom: '',
  })
  const [attachFile, setAttachFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const { pending, countdown, schedule, cancel, sendNow } = useUndoSend()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const to = R.request
  const cc = [settings.ceoEmail, settings.directorEmail].filter(Boolean).join(', ')
  const previewTo = settings.testMode ? settings.testEmail : to
  const previewCc = settings.testMode ? '' : cc

  const mmdd = useMemo(() => getMMDD(), [])

  const subject = `(수리요청) ${form.target || 'OO'} 고장의 건 ${mmdd}`

  const body = useMemo(() => {
    let t = `아래와 같이 수리를 요청합니다.\n\n`
    t += `1. 고장/수리 필요 대상: ${form.target || '(미입력)'}\n`
    t += `2. 발생 일자: ${form.occurDate || '(미입력)'}\n`
    t += `3. 상황 / 증상\n${form.symptom || '(미입력)'}\n`
    if (attachFile) t += `\n■ 고장 현황 사진 첨부`
    return t
  }, [form, attachFile])

  const handleSend = async () => {
    setError('')
    if (!form.target) return setError('고장/수리 대상을 입력해주세요.')
    if (!form.symptom) return setError('상황/증상을 입력해주세요.')
    if (!attachFile) return setError('고장 현황 사진을 첨부해주세요.')

    schedule(async () => {
      setSending(true)
      try {
        const attachmentData = await readFileAsBase64(attachFile)
        await sendMail({
          to, cc, subject, body,
          attachmentData,
          attachmentName: attachFile.name,
          attachmentType: attachFile.type,
          mailType: 'repair',
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
        <span style={s.headerTitle}>🔧 수리요청</span>
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
            <div style={s.cardTitle}>수리 정보</div>
            <div style={s.sublabel}>고장/수리 필요 대상 <span style={{ color: '#ef4444' }}>*</span></div>
            <input style={s.input} placeholder="예: 모니터, 에어컨, 복합기" value={form.target} onChange={e => set('target', e.target.value)} />
            <div style={{ ...s.sublabel, marginTop: 12 }}>발생 일자</div>
            <input type="date" style={s.input} value={form.occurDate} onChange={e => set('occurDate', e.target.value)} />
            <div style={{ ...s.sublabel, marginTop: 12 }}>상황 / 증상 <span style={{ color: '#ef4444' }}>*</span></div>
            <textarea style={s.textarea} rows={4} placeholder="구체적인 증상과 상황을 설명해주세요" value={form.symptom} onChange={e => set('symptom', e.target.value)} />
          </div>

          <div style={{ ...s.card, ...(error.includes('사진') ? { border: '1.5px solid #fca5a5' } : {}) }}>
            <div style={s.cardTitle}>📎 고장 현황 사진 <span style={{ color: '#ef4444' }}>*</span></div>
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
            {settings.testMode && <div style={{ background:'#fff3cd', borderRadius:6, padding:'5px 8px', marginBottom:8, fontSize:11, color:'#92400e' }}>🧪 테스트 모드 — 실제 수신자 대신 아래 주소로 발송됩니다</div>}
            <div style={s.pRow}><span style={s.pKey}>받는사람</span><span style={{ ...s.pVal, ...(settings.testMode ? {color:'#b45309',fontWeight:600} : {}) }}>{previewTo}</span></div>
            <div style={s.pRow}><span style={s.pKey}>참조</span><span style={{ ...s.pVal, color: '#666', fontSize: 12 }}>{previewCc || '없음'}</span></div>
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

const s = ps
