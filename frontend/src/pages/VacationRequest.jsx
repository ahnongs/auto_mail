import { buildSignatureHtml } from '../utils/signature'
import { R } from '../config/recipients'
import { useState, useMemo } from 'react'
import { api } from '../api'
import FileDropZone from '../components/FileDropZone'


const TYPES = [
  { id: '연차',      label: '연차',     icon: '🌴', multiDay: true  },
  { id: '반차(오전)', label: '오전 반차', icon: '🌅', multiDay: false },
  { id: '반차(오후)', label: '오후 반차', icon: '🌇', multiDay: false },
  { id: '반반차',    label: '반반차',   icon: '⏱️', multiDay: false },
  { id: '시간차',    label: '시간차',   icon: '🕐', multiDay: false },
  { id: '대체휴무',  label: '대체휴무', icon: '🔄', multiDay: false },
]

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function toKo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]}요일)`
}

function dayCount(start, end) {
  if (!start || !end || end <= start) return 1
  return Math.round((new Date(end) - new Date(start)) / 86400000) + 1
}

export default function VacationRequest({ user, settings, onBack }) {
  const [form, setForm] = useState({
    dept: settings.dept || '',
    startDate: '', endDate: '',
    type: '연차',
    handover: '본인 업무 직접 처리 예정',
    notes: '없음',
    overtimeDate: '', overtimeReason: '',
  })
  const [attachFile, setAttachFile] = useState(null)
  const [scheduleOpt, setScheduleOpt] = useState({ enabled: false, time: '18:00' })
  const [scheduleResult, setScheduleResult] = useState(null) // 등록된 send_at
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const selectedType = TYPES.find(t => t.id === form.type)
  const isMulti = selectedType?.multiDay && form.endDate && form.endDate > form.startDate
  const days = isMulti ? dayCount(form.startDate, form.endDate) : 1
  const isManager = settings.sigRole !== '파트장'
  const to = isManager ? settings.managerEmail : settings.directorEmail
  const cc = isManager
    ? [settings.ceoEmail, settings.directorEmail].filter(Boolean).join(', ')
    : [settings.ceoEmail].filter(Boolean).join(', ')

  const periodText = useMemo(() => {
    if (!form.startDate) return '날짜를 선택해주세요'
    const dateStr = toKo(form.startDate)
    if (isMulti) return `${dateStr} ~ ${toKo(form.endDate)} 총 ${days}일`
    if (form.type === '반반차') return `${dateStr} 총 0.25일`
    if (form.type.includes('반차')) return `${dateStr} 총 0.5일`
    if (form.type === '시간차') return `${dateStr} 총 1시간`
    return `${dateStr} 총 1일`
  }, [form.startDate, form.endDate, form.type, isMulti, days])

  const dayBefore = useMemo(() => {
    if (!form.startDate) return null
    const d = new Date(form.startDate + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const yy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yy}-${mm}-${dd}`
  }, [form.startDate])

  const scheduleSendAt = scheduleOpt.enabled && dayBefore
    ? `${dayBefore}T${scheduleOpt.time}:00`
    : null

  const subject = useMemo(() => {
    if (!form.startDate) return `(휴가신청) 26년 00월 00일 ${user.name} 휴가사용의 건`
    const d = new Date(form.startDate + 'T00:00:00')
    const yy = String(d.getFullYear()).slice(2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `(휴가신청) ${yy}년 ${mm}월 ${dd}일 ${user.name} 휴가사용의 건`
  }, [form.startDate, user.name])

  const body = useMemo(() => {
    let t = `아래와 같이 ${form.type}을(를) 사용하고자 하오니 확인 부탁드리겠습니다.\n\n`
    t += `1. 성명 및 부서: ${user.name} ${form.dept || '(부서 미입력)'}\n`
    t += `2. 휴가기간: ${periodText}\n`
    t += `3. 휴가유형: ${form.type}\n`
    t += `4. 업무 인수인계: ${form.handover || '(미입력)'}\n`
    t += `5. 특이사항: ${form.notes || '없음'}\n`
    if (form.type === '대체휴무') {
      t += `\n*대체휴무 추가 작성\n`
      t += `1. 휴일 근무 발생일: ${form.overtimeDate ? toKo(form.overtimeDate) + ' 총 1일' : '(미입력)'}\n`
      t += `2. 휴일 근무 사유: ${form.overtimeReason || '(미입력)'}\n`
    }
    t += `\n■ 휴가 신청 내역 이미지 첨부`
    return t
  }, [form, user, periodText])

  const handleSend = async () => {
    setError('')
    if (!to) return setError('설정에서 파트장 이메일을 먼저 입력해주세요.')
    if (!form.startDate) return setError('휴가 날짜를 선택해주세요.')
    if (!form.dept) return setError('부서를 입력해주세요.')
    if (!attachFile) return setError('플렉스 휴가 신청 캡처 이미지를 첨부해주세요.')

    setSending(true)
    try {
      const { data: attachmentData, type: attachmentType } = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const [meta, data] = e.target.result.split(',')
          resolve({ data, type: meta.match(/:(.*?);/)[1] })
        }
        reader.readAsDataURL(attachFile)
      })

      const isImage = attachmentType.startsWith('image/')

      const sendRes = await api.post('/mail/send', {
        to, cc, subject, body,
        attachmentData,
        attachmentName: attachFile.name,
        attachmentType,
        bodyImageData: isImage ? attachmentData : '',
        bodyImageType: isImage ? attachmentType : '',
        signatureImageData: settings.logoImageData || '',
        signatureImageType: settings.logoImageType || '',
        signatureHtml: buildSignatureHtml(settings, user.email),
      })

      // 예약 메일 등록
      if (scheduleOpt.enabled && scheduleSendAt) {
        try {
          const dept = settings.dept || form.dept || ''
          const coverBody = [
            `안녕하세요, ${dept} ${user.name}, ${form.type} 사용 승인 건 공유드립니다.`,
            ``,
            `- 일시 및 시간: ${periodText}`,
            ``,
            `감사합니다.`,
          ].join('\n')

          await api.post('/mail/schedule', {
            send_at: scheduleSendAt,
            to: R.leave,
            cc: '',
            subject: `Fwd: ${subject}`,
            body: coverBody,
            cover_body: coverBody,
            original_message_id: sendRes.data.message_id || '',
            fwd_body_image_data: isImage ? attachmentData : '',
            fwd_body_image_type: isImage ? attachmentType : '',
            signatureHtml: buildSignatureHtml(settings, user.email),
            signatureImageData: settings.logoImageData || '',
            signatureImageType: settings.logoImageType || '',
          })
          setScheduleResult(scheduleSendAt)
        } catch (e) {
          console.error('예약 등록 실패:', e)
        }
      }

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
        <p style={{ color: '#888', marginBottom: scheduleResult ? 12 : 24 }}>{to}에게 전송됐어요.</p>
        {scheduleResult && (
          <div style={{ background: '#f0fff4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#15803d', textAlign: 'left' }}>
            📅 사전 알림 예약 완료<br />
            <span style={{ fontSize: 12, color: '#166534' }}>
              {dayBefore} {scheduleOpt.time} → {R.leave}로 자동 발송 예정
            </span>
          </div>
        )}
        <button style={s.btnPrimary} onClick={onBack}>홈으로 돌아가기</button>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <header style={s.header} className="r-header">
        <button style={s.backBtn} onClick={onBack}>← 뒤로</button>
        <span style={s.headerTitle}>🌴 휴가신청</span>
        <div style={{ width: 60 }} />
      </header>

      <div style={s.layout} className="r-layout">
        <div style={s.formCol}>

          {/* 유형 */}
          <div style={s.card}>
            <div style={s.cardTitle}>휴가 유형</div>
            <div style={s.typeGrid}>
              {TYPES.map(t => (
                <button key={t.id}
                  style={{ ...s.typeBtn, ...(form.type === t.id ? s.typeSel : {}) }}
                  onClick={() => set('type', t.id)}>
                  <span style={{ fontSize: 22 }}>{t.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 날짜 + 시간 */}
          <div style={s.card}>
            <div style={s.cardTitle}>휴가 일시</div>

            {/* 날짜 */}
            <div style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={s.sublabel}>날짜</div>
                <input type="date" style={s.input} value={form.startDate}
                  onChange={e => set('startDate', e.target.value)} />
              </div>
              {selectedType?.multiDay && (
                <div style={{ flex: 1, marginLeft: 12 }}>
                  <div style={s.sublabel}>종료일 <span style={{ color: '#bbb' }}>(연속 사용 시)</span></div>
                  <input type="date" style={s.input} value={form.endDate}
                    min={form.startDate} onChange={e => set('endDate', e.target.value)} />
                </div>
              )}
            </div>

            {form.startDate && <div style={{ ...s.hint, marginTop: 10 }}>📅 {periodText}</div>}
          </div>

          {/* 신청자 */}
          <div style={s.card}>
            <div style={s.cardTitle}>신청자 정보</div>
            <div style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={s.sublabel}>이름 (자동입력)</div>
                <input style={{ ...s.input, background: '#f7f7f7', color: '#aaa' }}
                  value={user.name} readOnly />
              </div>
              <div style={{ flex: 1, marginLeft: 12 }}>
                <div style={s.sublabel}>부서</div>
                <input style={s.input} placeholder="예: 마케팅파트"
                  value={form.dept} onChange={e => set('dept', e.target.value)} />
              </div>
            </div>
          </div>

          {/* 수신자 */}
          <div style={{ ...s.card, background: '#f8f8ff', border: '1.5px solid #e0e0ff' }}>
            <div style={s.cardTitle}>수신자 <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}>설정에서 관리</span></div>
            <div style={s.recipientRow}>
              <span style={s.recipientKey}>받는사람</span>
              <span style={s.recipientVal}>{to || <span style={{ color: '#f59e0b' }}>⚠️ 설정 필요</span>}</span>
            </div>
            <div style={s.recipientRow}>
              <span style={s.recipientKey}>참조</span>
              <span style={s.recipientVal}>{cc || <span style={{ color: '#ccc' }}>없음</span>}</span>
            </div>
          </div>

          {/* 업무 인수인계 */}
          <div style={s.card}>
            <div style={s.cardTitle}>업무 인수인계</div>
            <textarea style={s.textarea} rows={3} value={form.handover}
              onChange={e => set('handover', e.target.value)} />
          </div>

          {/* 특이사항 */}
          <div style={s.card}>
            <div style={s.cardTitle}>특이사항 <span style={{ color: '#bbb', fontSize: 12, fontWeight: 400 }}>선택</span></div>
            <input style={s.input} value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="없음" />
          </div>

          {/* 대체휴무 */}
          {form.type === '대체휴무' && (
            <div style={{ ...s.card, background: '#fffbeb', border: '1.5px solid #fcd34d' }}>
              <div style={s.cardTitle}>📋 대체휴무 추가 정보</div>
              <div style={s.sublabel}>휴일 근무 발생일</div>
              <input type="date" style={s.input} value={form.overtimeDate}
                onChange={e => set('overtimeDate', e.target.value)} />
              <div style={{ ...s.sublabel, marginTop: 12 }}>휴일 근무 사유</div>
              <input style={s.input} placeholder="예: 지방 병원 촬영"
                value={form.overtimeReason} onChange={e => set('overtimeReason', e.target.value)} />
            </div>
          )}

          {/* 플렉스 캡처 — 필수 */}
          <div style={{ ...s.card, ...(error.includes('캡처') ? { border: '1.5px solid #fca5a5' } : {}) }}>
            <div style={s.cardTitle}>
              📎 플렉스 휴가 신청 캡처
              <span style={{ ...s.required, marginLeft: 4 }}>*</span>
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 10 }}>
              플렉스 앱 → 휴가 → 예정된 휴가 화면을 캡처해서 첨부해주세요.
            </div>
            <FileDropZone file={attachFile} onChange={setAttachFile} />
          </div>

          {/* 하루 전날 사전 알림 예약 */}
          <div style={{ ...s.card, background: '#f0fff4', border: '1.5px solid #bbf7d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: scheduleOpt.enabled ? 12 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>📅 하루 전날 사전 알림 예약</div>
              <button
                style={{ background: scheduleOpt.enabled ? '#22c55e' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setScheduleOpt(o => ({ ...o, enabled: !o.enabled }))}>
                {scheduleOpt.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {scheduleOpt.enabled && (
              <>
                <div style={s.sublabel}>발송 시각</div>
                <select style={s.input} value={scheduleOpt.time}
                  onChange={e => setScheduleOpt(o => ({ ...o, time: e.target.value }))}>
                  {Array.from({ length: 14 }, (_, i) => {
                    const h = i + 7
                    const label = h < 12 ? `오전 ${h}:00` : h === 12 ? '오후 12:00' : `오후 ${h - 12}:00`
                    const val = `${String(h).padStart(2, '0')}:00`
                    return <option key={val} value={val}>{label}</option>
                  })}
                </select>
                {dayBefore ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#15803d', fontWeight: 500 }}>
                    📬 {dayBefore} {scheduleOpt.time}에 {R.leave}로 자동 발송
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#f59e0b' }}>
                    ⚠️ 휴가 날짜를 먼저 선택해주세요.
                  </div>
                )}
              </>
            )}
          </div>

          {error && <div style={s.error}>⚠️ {error}</div>}

          <button style={{ ...s.btnPrimary, padding: '14px', fontSize: 15, borderRadius: 12 }}
            onClick={handleSend} disabled={sending}>
            {sending ? '발송 중...' : '📤 메일 발송하기'}
          </button>
        </div>

        {/* 미리보기 */}
        <div style={s.previewCol} className="r-preview-col">
          <div style={s.previewTitle}>실시간 미리보기</div>
          <div style={s.previewCard}>
            <div style={s.pRow}>
              <span style={s.pKey}>받는사람</span>
              <span style={s.pVal}>{to || <span style={{ color: '#f59e0b' }}>설정 필요</span>}</span>
            </div>
            <div style={s.pRow}>
              <span style={s.pKey}>참조</span>
              <span style={{ ...s.pVal, color: '#666', fontSize: 12 }}>{cc || <span style={{ color: '#ccc' }}>없음</span>}</span>
            </div>
            <div style={s.pRow}>
              <span style={s.pKey}>제목</span>
              <span style={{ ...s.pVal, fontWeight: 600 }}>{subject}</span>
            </div>
            {attachFile && (
              <div style={s.pRow}>
                <span style={s.pKey}>첨부</span>
                <span style={{ ...s.pVal, color: '#667eea', fontSize: 12 }}>📎 {attachFile.name}</span>
              </div>
            )}
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
  required: { color: '#ef4444', fontWeight: 700 },
  row: { display: 'flex', gap: 0 },
  hint: { fontSize: 12, color: '#667eea', marginTop: 10, fontWeight: 500 },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e8e8e8', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  textarea: { width: '100%', padding: '10px 12px', border: '1.5px solid #e8e8e8', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
  typeGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  typeBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '12px 6px', border: '2px solid #e8e8e8', borderRadius: 10, background: '#fff', cursor: 'pointer' },
  typeSel: { border: '2px solid #667eea', background: '#f0f0ff' },
  error: { background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' },
  btnPrimary: { background: '#667eea', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' },
  successCard: { background: '#fff', borderRadius: 16, padding: '48px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
  previewTitle: { fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8, paddingLeft: 2 },
  previewCard: { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  pRow: { display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  pKey: { fontSize: 11, fontWeight: 600, color: '#bbb', minWidth: 52, paddingTop: 1 },
  pVal: { fontSize: 13, color: '#333', flex: 1, wordBreak: 'break-all' },
  preBody: { fontSize: 11.5, color: '#444', lineHeight: 1.75, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 },
  recipientRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 },
  recipientKey: { fontSize: 11, fontWeight: 600, color: '#aaa', minWidth: 52 },
  recipientVal: { fontSize: 13, color: '#555' },
}
