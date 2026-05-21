import { buildSignatureHtml } from '../utils/signature'
import { R } from '../config/recipients'
import { useState, useMemo } from 'react'
import { api } from '../api'


const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(dateStr) {
  if (!dateStr) return '(미입력)'
  const d = new Date(dateStr)
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 (${DAYS[d.getDay()]}요일)`
}

function buildBodyHtml({ user, settings, form }) {
  const td = 'border:1px solid #ccc;padding:7px 12px;font-size:13px;'
  const th = td + 'background:#f0f0f0;font-weight:700;text-align:center;'

  const statusStyle = (v) => {
    if (!v) return td + 'text-align:center;'
    const lower = v.replace(/\s/g, '')
    if (lower.includes('완료') || lower.includes('체크')) return td + 'text-align:center;background:#fff9c4;color:#b45309;font-weight:600;'
    if (lower.includes('미처리') || lower.includes('누락')) return td + 'text-align:center;background:#f5f5f5;color:#888;'
    return td + 'text-align:center;'
  }

  let html = `<div style="font-family:sans-serif;font-size:14px;color:#333;line-height:1.8;">`
  html += `<p>안녕하세요,<br>아래 사유로 인하여 플렉스 출퇴근 시간 입력을 하지 못하여, 변경을 요청드리고자 합니다.<br>확인 부탁드리겠습니다.</p>`
  html += `<p style="margin-top:8px;">`
  html += `1. 성명: ${user.name}<br>`
  html += `2. 부서: ${settings.dept || form.dept || '(미입력)'}<br>`
  html += `3. 조정희망일자: ${formatDate(form.targetDate)}<br>`
  html += `4. 조정사유: ${form.reason || '(미입력)'}`
  html += `</p>`

  html += `<p style="font-weight:700;margin-top:16px;">■ 상세 내용</p>`
  html += `<table style="border-collapse:collapse;width:100%;max-width:500px;">`
  html += `<tr><th style="${th}">구분</th><th style="${th}">시간</th><th style="${th}">플렉스 현황</th></tr>`
  html += `<tr>`
  html += `<td style="${td}">실제 출근시간</td>`
  html += `<td style="${td}text-align:center;">${form.actualIn || '-'}</td>`
  html += `<td style="${statusStyle(form.flexStatusIn)}">${form.flexStatusIn || '-'}</td>`
  html += `</tr>`
  html += `<tr>`
  html += `<td style="${td}">실제 퇴근시간</td>`
  html += `<td style="${td}text-align:center;">${form.actualOut || '-'}</td>`
  html += `<td style="${statusStyle(form.flexStatusOut)}">${form.flexStatusOut || '-'}</td>`
  html += `</tr>`
  html += `</table>`
  html += `</div>`
  return html
}

export default function ClockFixRequest({ user, settings, onBack }) {
  const [form, setForm] = useState({
    dept: settings.dept || '',
    targetDate: '',
    reason: '',
    actualIn: '',
    actualOut: '',
    flexStatusIn: '',
    flexStatusOut: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const to = R.clockinout
  const cc = [settings.ceoEmail, settings.directorEmail, settings.managerEmail].filter(Boolean).join(', ')

  const mmdd = useMemo(() => {
    const d = new Date()
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const subject = `(출퇴근변경) ${settings.dept || form.dept || '00파트'} ${user.name} 플렉스 출퇴근 변경신청의 건 ${mmdd}`

  const plainBody = useMemo(() => {
    let t = `안녕하세요,\n아래 사유로 인하여 플렉스 출퇴근 시간 입력을 하지 못하여, 변경을 요청드리고자 합니다.\n확인 부탁드리겠습니다.\n\n`
    t += `1. 성명: ${user.name}\n`
    t += `2. 부서: ${settings.dept || form.dept || '(미입력)'}\n`
    t += `3. 조정희망일자: ${formatDate(form.targetDate)}\n`
    t += `4. 조정사유: ${form.reason || '(미입력)'}\n\n`
    t += `■ 상세 내용\n`
    t += `  실제 출근시간: ${form.actualIn || '-'} / 플렉스 현황: ${form.flexStatusIn || '-'}\n`
    t += `  실제 퇴근시간: ${form.actualOut || '-'} / 플렉스 현황: ${form.flexStatusOut || '-'}\n`
    return t
  }, [form, user, settings])

  const handleSend = async () => {
    setError('')
    if (!form.targetDate) return setError('조정 희망 일자를 선택해주세요.')
    if (!form.reason) return setError('조정 사유를 입력해주세요.')

    setSending(true)
    try {
      const bodyHtml = buildBodyHtml({ user, settings, form })
      await api.post('/mail/send', {
        to, cc, subject,
        body: plainBody,
        bodyHtml,
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
        <span style={s.headerTitle}>🕐 출퇴근 변경신청</span>
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
                <input style={{ ...s.input, background: '#f7f7f7', color: '#aaa' }} value={settings.dept || '(설정에서 입력)'} readOnly />
              </div>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>변경 정보</div>
            <div style={s.sublabel}>조정 희망 일자 <span style={{ color: '#ef4444' }}>*</span></div>
            <input type="date" style={s.input} value={form.targetDate} onChange={e => set('targetDate', e.target.value)} />
            {form.targetDate && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#667eea' }}>{formatDate(form.targetDate)}</div>
            )}
            <div style={{ ...s.sublabel, marginTop: 12 }}>조정 사유 <span style={{ color: '#ef4444' }}>*</span></div>
            <textarea style={s.textarea} rows={2} placeholder="예: 퇴근 시 착오누락" value={form.reason} onChange={e => set('reason', e.target.value)} />
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>■ 상세 내용</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div style={s.tableHeader}>구분</div>
              <div style={s.tableHeader}>시간</div>
              <div style={s.tableHeader}>플렉스 현황</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div style={s.tableLabel}>실제 출근시간</div>
              <input type="time" style={s.input} value={form.actualIn} onChange={e => set('actualIn', e.target.value)} />
              <select style={s.input} value={form.flexStatusIn} onChange={e => set('flexStatusIn', e.target.value)}>
                <option value="">선택</option>
                <option value="체크완료">체크완료</option>
                <option value="미처리">미처리</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={s.tableLabel}>실제 퇴근시간</div>
              <input type="time" style={s.input} value={form.actualOut} onChange={e => set('actualOut', e.target.value)} />
              <select style={s.input} value={form.flexStatusOut} onChange={e => set('flexStatusOut', e.target.value)}>
                <option value="">선택</option>
                <option value="체크완료">체크완료</option>
                <option value="미처리">미처리</option>
              </select>
            </div>
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
            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '12px 0' }} />
            <pre style={s.preBody}>{plainBody}</pre>
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
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e8e8e8', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  textarea: { width: '100%', padding: '10px 12px', border: '1.5px solid #e8e8e8', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
  tableHeader: { fontSize: 12, fontWeight: 700, color: '#667eea', padding: '6px 0', borderBottom: '1.5px solid #e8e8ff' },
  tableLabel: { fontSize: 13, fontWeight: 600, color: '#444', display: 'flex', alignItems: 'center' },
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
