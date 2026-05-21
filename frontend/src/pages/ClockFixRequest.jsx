import { useState, useMemo } from 'react'
import axios from 'axios'
import FileDropZone from '../components/FileDropZone'

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

export default function ClockFixRequest({ user, settings, onBack }) {
  const [form, setForm] = useState({
    dept: settings.dept || '',
    targetDate: '',
    reason: '',
    actualIn: '',
    actualOut: '',
    flexIn: '',
    flexOut: '',
  })
  const [attachFile, setAttachFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const to = 'clockinout@stardoc1.com'
  const cc = [settings.ceoEmail, settings.directorEmail, settings.managerEmail].filter(Boolean).join(', ')

  const mmdd = useMemo(() => {
    const d = new Date()
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const subject = `(출퇴근변경) ${form.dept || '00파트'} ${user.name} 플렉스 출퇴근 변경신청의 건 ${mmdd}`

  const body = useMemo(() => {
    let t = `아래와 같이 플렉스 출퇴근 변경을 신청합니다.\n\n`
    t += `1. 성명: ${user.name}\n`
    t += `2. 부서: ${form.dept || '(미입력)'}\n`
    t += `3. 조정 희망 일자: ${form.targetDate || '(미입력)'}\n`
    t += `4. 조정 사유: ${form.reason || '(미입력)'}\n\n`
    t += `5. 출퇴근 현황\n`
    t += `${'─'.repeat(40)}\n`
    t += `  구분       | 출근       | 퇴근\n`
    t += `${'─'.repeat(40)}\n`
    t += `  실제 시간  | ${(form.actualIn || '-').padEnd(10)} | ${form.actualOut || '-'}\n`
    t += `  플렉스 현황| ${(form.flexIn || '-').padEnd(10)} | ${form.flexOut || '-'}\n`
    t += `${'─'.repeat(40)}\n`
    if (attachFile) t += `\n■ 플렉스 캡처 이미지 첨부`
    return t
  }, [form, user, attachFile])

  const handleSend = async () => {
    setError('')
    if (!form.dept) return setError('부서를 입력해주세요.')
    if (!form.targetDate) return setError('조정 희망 일자를 선택해주세요.')
    if (!form.reason) return setError('조정 사유를 입력해주세요.')
    if (!attachFile) return setError('플렉스 화면 캡처 이미지를 첨부해주세요.')

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
      <header style={s.header}>
        <button style={s.backBtn} onClick={onBack}>← 뒤로</button>
        <span style={s.headerTitle}>🕐 출퇴근 변경신청</span>
        <div style={{ width: 60 }} />
      </header>

      <div style={s.layout}>
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
            <div style={s.cardTitle}>변경 정보</div>
            <div style={s.sublabel}>조정 희망 일자 <span style={{ color: '#ef4444' }}>*</span></div>
            <input type="date" style={s.input} value={form.targetDate} onChange={e => set('targetDate', e.target.value)} />
            <div style={{ ...s.sublabel, marginTop: 12 }}>조정 사유 <span style={{ color: '#ef4444' }}>*</span></div>
            <textarea style={s.textarea} rows={3} placeholder="출퇴근 변경 사유를 입력해주세요" value={form.reason} onChange={e => set('reason', e.target.value)} />
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>출퇴근 시간 비교</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 6, paddingLeft: 2 }}>
              <span></span><span>출근</span><span>퇴근</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#555' }}>실제 시간</div>
              <input type="time" style={s.input} value={form.actualIn} onChange={e => set('actualIn', e.target.value)} />
              <input type="time" style={s.input} value={form.actualOut} onChange={e => set('actualOut', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#555' }}>플렉스 현황</div>
              <input type="time" style={s.input} value={form.flexIn} onChange={e => set('flexIn', e.target.value)} />
              <input type="time" style={s.input} value={form.flexOut} onChange={e => set('flexOut', e.target.value)} />
            </div>
          </div>

          <div style={{ ...s.card, ...(error.includes('캡처') ? { border: '1.5px solid #fca5a5' } : {}) }}>
            <div style={s.cardTitle}>📎 플렉스 화면 캡처 <span style={{ color: '#ef4444' }}>*</span></div>
            <FileDropZone file={attachFile} onChange={setAttachFile} />
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
