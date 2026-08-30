import { buildSignatureHtml } from '../utils/signature'
import { R } from '../config/recipients'
import { useState, useMemo } from 'react'
import { sendMail } from '../api'
import { useUndoSend } from '../hooks/useUndoSend'
import SendPendingScreen from '../components/SendPendingScreen'
import SendingScreen from '../components/SendingScreen'
import ErrorNotice from '../components/ErrorNotice'
import SuccessCard from '../components/SuccessCard'
import { ps, c } from '../styles/pageStyles'
import { getMMDD } from '../utils/dateUtils'


const formatAmount = (v) => { const n = String(v).replace(/[^\d]/g, ''); return n ? Number(n).toLocaleString() : '' }

export default function OnlinePaymentRequest({ user, settings, onBack, onNavigate }) {
  const [form, setForm] = useState({
    dept: settings.dept || '',
    vendor: '',
    vendorUrl: '',
    purpose: '',
    items: '',
    amount: '',
    deliveryAddr: '서울 강남구 테헤란로57길 21 2층',
    receiverName: '',
    receiverPhone: '',
    managerApproved: '승인 완료',
    extraCc: '',
    notes: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const { pending, countdown, schedule, cancel, sendNow } = useUndoSend()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const to = R.request
  const cc = [settings.ceoEmail, settings.bizManagerEmail, form.extraCc].filter(Boolean).join(', ')
  const previewTo = settings.testMode ? settings.testEmail : to
  const previewCc = settings.testMode ? '' : cc

  const mmdd = useMemo(() => getMMDD(), [])

  const subject = `(온라인결제요청) ${form.items || 'OO'} 구매의 건 ${mmdd}`

  const body = useMemo(() => {
    let t = `아래와 같이 온라인 결제를 요청합니다.\n\n`
    t += `1. 구입처: ${form.vendor || '(미입력)'}${form.vendorUrl ? ' (' + form.vendorUrl + ')' : ''}\n`
    t += `2. 구매 목적: ${form.purpose || '(미입력)'}\n`
    t += `3. 품목/옵션/수량: ${form.items || '(미입력)'}\n`
    t += `4. 총 금액: ${form.amount ? Number(form.amount.replace(/,/g, '')).toLocaleString() + '원' : '(미입력)'}\n`
    t += `5. 배송지: ${form.deliveryAddr || '(미입력)'}\n`
    t += `6. 받는 분 성명: ${form.receiverName || '(미입력)'}\n`
    t += `7. 받는 분 연락처: ${form.receiverPhone || '(미입력)'}\n`
    t += `8. 파트장 승인 여부: ${form.managerApproved}\n`
    if (form.notes) t += `\n※ 기타사항: ${form.notes}\n`
    return t
  }, [form])

  const handleSend = async () => {
    setError('')
    if (!form.vendor) return setError('구입처를 입력해주세요.')
    if (!form.purpose) return setError('구매 목적을 입력해주세요.')
    if (!form.items) return setError('품목을 입력해주세요.')
    if (!form.amount) return setError('금액을 입력해주세요.')

    schedule(async () => {
      setSending(true)
      try {
        await sendMail({
          to, cc, subject, body,
          mailType: 'payment2',
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
  if (sending) return <SendingScreen />

  if (sent) return <SuccessCard to={previewTo} onBack={onBack} onNavigate={onNavigate} />

  const missing = []
  if (!form.vendor) missing.push('구입처')
  if (!form.purpose) missing.push('구매 목적')
  if (!form.items) missing.push('품목')
  if (!form.amount) missing.push('금액')

  return (
    <div style={s.page}>
      <header style={s.header} className="r-header">
        <button style={s.backBtn} onClick={onBack}>← 뒤로</button>
        <span style={s.headerTitle}>온라인결제요청</span>
        <div style={{ width: 60 }} />
      </header>

      <div style={s.layout} className="r-layout">
        <div style={s.formCol}>
          <div style={s.card}>
            <div style={s.cardTitle}>구매 정보</div>
            <div style={s.sublabel}>구입처 (업체명) <span style={{ color: '#ef4444' }}>*</span></div>
            <input style={s.input} placeholder="예: 쿠팡, 네이버쇼핑" value={form.vendor} onChange={e => set('vendor', e.target.value)} />
            <div style={{ marginTop: 12 }}>
              <div style={s.sublabel}>구매 링크 (선택)</div>
              <input style={s.input} placeholder="https://..." value={form.vendorUrl} onChange={e => set('vendorUrl', e.target.value)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={s.sublabel}>구매 목적 <span style={{ color: '#ef4444' }}>*</span></div>
              <input style={s.input} placeholder="예: 사무용품 구매" value={form.purpose} onChange={e => set('purpose', e.target.value)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={s.sublabel}>품목 / 옵션 / 수량 <span style={{ color: '#ef4444' }}>*</span></div>
              <textarea style={s.textarea} rows={2} placeholder="예: A4용지 500매 x 2박스" value={form.items} onChange={e => set('items', e.target.value)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={s.sublabel}>총 금액 <span style={{ color: '#ef4444' }}>*</span></div>
              <input style={s.input} placeholder="예: 35,000" inputMode="numeric" value={form.amount} onChange={e => set('amount', formatAmount(e.target.value))} />
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>배송 정보</div>
            <div style={s.sublabel}>배송지</div>
            <input style={s.input} value={form.deliveryAddr} onChange={e => set('deliveryAddr', e.target.value)} />
            <div style={{ ...s.sublabel, marginTop: 12 }}>받는 분 성명</div>
            <input style={s.input} placeholder="담당자명" value={form.receiverName} onChange={e => set('receiverName', e.target.value)} />
            <div style={{ ...s.sublabel, marginTop: 12 }}>받는 분 연락처</div>
            <input style={s.input} placeholder="010-0000-0000" value={form.receiverPhone} onChange={e => set('receiverPhone', e.target.value)} />
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>파트장 승인</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['승인 완료', '승인 요청 중', '미승인'].map(v => (
                <button key={v} style={{ ...s.optBtn, ...(form.managerApproved === v ? s.optSel : {}) }} onClick={() => set('managerApproved', v)}>{v}</button>
              ))}
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>추가 참조 <span style={{ color: '#bbb', fontSize: 12, fontWeight: 400 }}>선택</span></div>
            <div style={s.sublabel}>프로젝트 관련자 등 추가로 참조할 이메일</div>
            <input style={s.input} placeholder="예: person@stardoc1.com" value={form.extraCc} onChange={e => set('extraCc', e.target.value)} />
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>기타사항 <span style={{ color: '#bbb', fontSize: 12, fontWeight: 400 }}>선택</span></div>
            <textarea style={s.textarea} rows={2} placeholder="없음" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {missing.length > 0 && (
            <div style={{ fontSize: 12, color: c.muted, textAlign: 'center' }}>
              남은 필수 항목: <span style={{ color: c.warnInk, fontWeight: 600 }}>{missing.join(' · ')}</span>
            </div>
          )}
          <ErrorNotice message={error} />
          <button style={s.btnSend} onClick={handleSend} disabled={sending}>
            {sending ? '발송 중...' : '메일 발송하기'}
          </button>
        </div>

        <div style={s.previewCol} className="r-preview-col">
          <div style={s.previewTitle}>실시간 미리보기</div>
          <div style={s.previewCard}>
            {settings.testMode && <div style={s.testModeBanner}>테스트 모드 — 실제 수신자 대신 아래 주소로 발송됩니다</div>}
            <div style={s.pRow}><span style={s.pKey}>받는사람</span><span style={{ ...s.pVal, ...(settings.testMode ? {color:'#b45309',fontWeight:600} : {}) }}>{previewTo}</span></div>
            <div style={s.pRow}><span style={s.pKey}>참조</span><span style={{ ...s.pVal, color: c.muted, fontSize: 12 }}>{previewCc || '없음'}</span></div>
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
