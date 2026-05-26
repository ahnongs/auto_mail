import { buildSignatureHtml } from '../utils/signature'
import { R } from '../config/recipients'
import { useState, useMemo } from 'react'
import { api, sendMail } from '../api'
import FileDropZone from '../components/FileDropZone'
import { useUndoSend } from '../hooks/useUndoSend'
import SendPendingScreen from '../components/SendPendingScreen'


const CATEGORIES = ['복리후생비(식대)', '복리후생비(회식/간식)', '여비교통비(출장/외근)', '접대비(고객사 접대)', '운반비(퀵/택배 등)', '소모품비(사무용품/도서인쇄)', '수선비(비품수리/청소)', '지급수수료', '광고선전비']

const CATEGORY_GUIDE = [
  { name: '복리후생비(식대)', desc: '야근 식대' },
  { name: '복리후생비(회식/간식)', desc: '공식 팀 회식비, 탕비실 커피·음료·간식 구매비, 워크숍 비용, 직원 경조사비' },
  { name: '여비교통비(출장/외근)', desc: '병원 미팅 방문 시 택시비·버스/지하철비, 출장/지방 미팅용 KTX·고속버스 요금, 외근 시 주차비·통행료(하이패스)' },
  { name: '접대비(고객사 접대)', desc: '병원 관계자(원장님 등) 미팅 식사/카피, 병원 개원 축하 화환 및 기념 선물, 명절/기념일 클라이언트 선물 구매' },
  { name: '운반비(퀵/택배 등)', desc: '병원으로 홍보물(X배너·브로셔) 발송비, 긴급 시안 전달용 퀵서비스 이용료, 우체국 등기 우편 요금' },
  { name: '소모품비(사무용품/도서인쇄)', desc: '촬영용 소품(꽃·가구·배경지 등), 명함 인쇄·제안서 제본 비용, 마케팅/디자인 관련 도서 구입비, 문구류·A4용지·토너 등' },
  { name: '수선비(비품수리/청소)', desc: '업무용 노트북·카메라 수리비, 사무실 전구 교체·도어락 수리 등, 사무실 정기 청소 및 방역 비용' },
  { name: '지급수수료', desc: '외주 업체 등 당사가 사용한 서비스에 대한 대가로 지불하는 비용 등' },
  { name: '광고선전비', desc: '당사 내부 마케팅(인하우스) 등을 위해 사용한 비용' },
]
const emptyItem = () => ({ date: '', category: CATEGORIES[0], detail: '', amount: '', note: '' })

function buildBodyHtml({ user, settings, items, total, attachFile, isImage }) {
  const tdStyle = 'border:1px solid #ccc;padding:6px 10px;font-size:13px;'
  const thStyle = tdStyle + 'background:#f0f0f0;font-weight:700;text-align:center;'

  let html = `<div style="font-family:sans-serif;font-size:14px;color:#333;line-height:1.8;">`
  html += `<p>아래와 같이 개인비용 지출결의서를 작성하여 상신드리오니 결재 부탁드립니다.</p>`

  // 작성자 정보
  html += `<p style="font-weight:700;margin-top:16px;">■ 작성자 정보</p>`
  html += `<table style="border-collapse:collapse;width:100%;margin-bottom:16px;">`
  html += `<tr>`
  html += `<td style="${thStyle}width:80px;">이름</td><td style="${tdStyle}">${user.name}</td>`
  html += `<td style="${thStyle}width:80px;">부서</td><td style="${tdStyle}">${settings.dept || '-'}</td>`
  html += `</tr><tr>`
  html += `<td style="${thStyle}">계좌정보</td>`
  html += `<td style="${tdStyle}">${settings.bank || '-'}</td>`
  html += `<td style="${tdStyle}">${settings.account || '-'}</td>`
  html += `<td style="${tdStyle}">${settings.accountHolder || '-'}</td>`
  html += `</tr></table>`

  // 지출 내역
  html += `<p style="font-weight:700;">■ 지출 내역</p>`
  html += `<table style="border-collapse:collapse;width:100%;">`
  html += `<tr>`
  html += `<th style="${thStyle}width:40px;">NO</th>`
  html += `<th style="${thStyle}width:90px;">사용 일자</th>`
  html += `<th style="${thStyle}">구분(목적)</th>`
  html += `<th style="${thStyle}">세부내용</th>`
  html += `<th style="${thStyle}width:90px;">금액(원)</th>`
  html += `<th style="${thStyle}width:80px;">비고</th>`
  html += `</tr>`

  items.forEach((it, i) => {
    const amt = it.amount ? `₩${Number(it.amount.replace(/,/g, '')).toLocaleString()}` : '₩0'
    html += `<tr>`
    html += `<td style="${tdStyle}text-align:center;">${i + 1}</td>`
    html += `<td style="${tdStyle}text-align:center;">${it.date || '-'}</td>`
    html += `<td style="${tdStyle}">${it.category}</td>`
    html += `<td style="${tdStyle}">${it.detail || '-'}</td>`
    html += `<td style="${tdStyle}text-align:right;">${amt}</td>`
    html += `<td style="${tdStyle}">${it.note || ''}</td>`
    html += `</tr>`
  })

  html += `<tr>`
  html += `<td colspan="4" style="${tdStyle}text-align:right;font-weight:700;background:#f0f0f0;">합계</td>`
  html += `<td style="${tdStyle}text-align:right;font-weight:700;">₩${total.toLocaleString()}</td>`
  html += `<td style="${tdStyle}"></td>`
  html += `</tr></table>`

  if (attachFile) {
    html += `<p style="margin-top:16px;"><strong>&lt;첨부파일&gt;</strong></p>`
    if (!isImage) {
      html += `<p style="margin:0;font-size:13px;">${attachFile.name}</p>`
    }
  }

  html += `</div>`
  return html
}

export default function ExpenseRequest({ user, settings, onBack }) {
  const [form, setForm] = useState({ dept: settings.dept || '' })
  const [items, setItems] = useState([emptyItem()])
  const [attachFile, setAttachFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const { pending, countdown, schedule, cancel } = useUndoSend()

  const setItem = (i, k, v) => setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  const addItem = () => setItems(arr => [...arr, emptyItem()])
  const removeItem = (i) => setItems(arr => arr.filter((_, idx) => idx !== i))

  const total = items.reduce((s, it) => s + (Number(it.amount.replace(/,/g, '')) || 0), 0)

  const to = R.request
  const cc = [settings.ceoEmail, settings.directorEmail, settings.managerEmail].filter(Boolean).join(', ')
  const previewTo = settings.testMode ? settings.testEmail : to
  const previewCc = settings.testMode ? '' : cc

  const mmdd = (() => {
    const d = new Date()
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  })()

  const subject = `(지출결의서) ${settings.dept || form.dept || 'OOO파트'} ${user.name} 개인비용 사용의 건 ${mmdd}`

  const plainBody = useMemo(() => {
    let t = `아래와 같이 개인비용 지출결의서를 작성하여 상신드리오니 결재 부탁드립니다.\n\n`
    t += `■ 작성자 정보\n`
    t += `  이름: ${user.name} / 부서: ${settings.dept || '(미입력)'}\n`
    t += `  계좌: ${settings.bank || '-'} ${settings.account || '-'} (${settings.accountHolder || '-'})\n\n`
    t += `■ 지출 내역\n`
    items.forEach((it, i) => {
      const amt = it.amount ? `₩${Number(it.amount.replace(/,/g, '')).toLocaleString()}` : '₩0'
      t += `  ${i + 1}. [${it.date || '-'}] ${it.category} / ${it.detail || '-'} / ${amt}\n`
    })
    t += `\n  합계: ₩${total.toLocaleString()}\n`
    return t
  }, [form, items, user, total, settings])

  const handleSend = async () => {
    setError('')
    if (items.some(it => !it.detail || !it.amount)) return setError('지출 내역을 모두 입력해주세요.')
    if (!attachFile) return setError('영수증 파일을 첨부해주세요.')

    schedule(async () => {
      setSending(true)
      try {
        const attachmentData = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target.result.split(',')[1])
          reader.readAsDataURL(attachFile)
        })

        const isImage = attachFile.type.startsWith('image/')
        const bodyHtml = buildBodyHtml({ user, settings, items, total, attachFile, isImage })

        await sendMail({
          to, cc, subject,
          body: plainBody,
          bodyHtml,
          attachmentData: isImage ? '' : attachmentData,
          attachmentName: isImage ? '' : attachFile.name,
          attachmentType: isImage ? '' : attachFile.type,
          bodyImageData: isImage ? attachmentData : '',
          bodyImageType: isImage ? attachFile.type : '',
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

  if (pending) return <SendPendingScreen countdown={countdown} onCancel={cancel} />

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
        <span style={s.headerTitle}>💳 개인비용 지출결의서</span>
        <div style={{ width: 60 }} />
      </header>

      <div style={s.layout} className="r-layout">
        <div style={s.formCol}>

          {/* 작성자 */}
          <div style={s.card}>
            <div style={s.cardTitle}>작성자 정보</div>
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
            {(settings.bank || settings.account) ? (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0f0ff', borderRadius: 8, fontSize: 12, color: '#667eea' }}>
                💳 {settings.bank} {settings.account} ({settings.accountHolder}) — 설정에서 변경 가능
              </div>
            ) : (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff8e1', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                ⚠️ 계좌 정보가 없어요. 설정(⚙️)에서 먼저 입력해주세요.
              </div>
            )}
          </div>

          {/* 지출 내역 */}
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
                <div style={s.row} className="r-date-row">
                  <div style={{ flex: 1 }}>
                    <div style={s.sublabel}>사용 일자</div>
                    <input type="date" style={s.input} value={it.date} onChange={e => setItem(i, 'date', e.target.value)} />
                  </div>
                  <div style={{ flex: 1, marginLeft: 8 }}>
                    <div style={s.sublabel}>금액 (원)</div>
                    <input style={s.input} placeholder="0" value={it.amount} onChange={e => setItem(i, 'amount', e.target.value)} />
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={s.sublabel}>구분(목적)</div>
                  <select style={s.input} value={it.category} onChange={e => setItem(i, 'category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={s.sublabel}>세부내용</div>
                  <input style={s.input} placeholder="예: 야근식대" value={it.detail} onChange={e => setItem(i, 'detail', e.target.value)} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={s.sublabel}>비고 (선택)</div>
                  <input style={s.input} placeholder="" value={it.note} onChange={e => setItem(i, 'note', e.target.value)} />
                </div>
              </div>
            ))}
            <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 700, color: '#333', marginTop: 4, paddingRight: 4 }}>
              합계: ₩{total.toLocaleString()}
            </div>
          </div>

          {/* 영수증 첨부 */}
          <div style={{ ...s.card, ...(error.includes('영수증') ? { border: '1.5px solid #fca5a5' } : {}) }}>
            <div style={s.cardTitle}>📎 영수증 첨부 <span style={{ color: '#ef4444' }}>*</span></div>
            <FileDropZone file={attachFile} onChange={setAttachFile} />
          </div>

          {error && <div style={s.error}>⚠️ {error}</div>}
          <button style={{ ...s.btnPrimary, padding: '14px', fontSize: 15, borderRadius: 12 }} onClick={handleSend} disabled={sending}>
            {sending ? '발송 중...' : '📤 메일 발송하기'}
          </button>
        </div>

        {/* 미리보기 + 가이드 */}
        <div style={s.previewCol} className="r-preview-col">
          <div style={s.previewTitle}>실시간 미리보기</div>
          <div style={s.previewCard}>
            {settings.testMode && <div style={{ background:'#fff3cd', borderRadius:6, padding:'5px 8px', marginBottom:8, fontSize:11, color:'#92400e' }}>🧪 테스트 모드 — 실제 수신자 대신 아래 주소로 발송됩니다</div>}
            <div style={s.pRow}><span style={s.pKey}>받는사람</span><span style={{ ...s.pVal, ...(settings.testMode ? {color:'#b45309',fontWeight:600} : {}) }}>{previewTo}</span></div>
            <div style={s.pRow}><span style={s.pKey}>참조</span><span style={{ ...s.pVal, color: '#666', fontSize: 12 }}>{previewCc || '없음'}</span></div>
            <div style={s.pRow}><span style={s.pKey}>제목</span><span style={{ ...s.pVal, fontWeight: 600 }}>{subject}</span></div>
            {attachFile && <div style={s.pRow}><span style={s.pKey}>첨부</span><span style={{ ...s.pVal, color: '#667eea', fontSize: 12 }}>📎 {attachFile.name}</span></div>}
            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '12px 0' }} />
            <pre style={s.preBody}>{plainBody}</pre>
          </div>

          {/* 지출 구분 기준 */}
          <div style={{ marginTop: 16 }}>
            <div style={s.previewTitle}>지출 구분 기준</div>
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ background: '#667eea', color: '#fff', textAlign: 'center', padding: '8px 0', fontSize: 13, fontWeight: 700 }}>
                &lt;지출 구분 기준&gt;
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={s.gTh}>계정과목</th>
                    <th style={s.gTh}>내 용</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_GUIDE.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8f8ff' }}>
                      <td style={s.gTdName}>{row.name}</td>
                      <td style={s.gTdDesc}>{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
  gTh: { background: '#eef0ff', color: '#444', fontSize: 11, fontWeight: 700, padding: '7px 10px', border: '1px solid #dde0ff', textAlign: 'center' },
  gTdName: { fontSize: 11, fontWeight: 700, color: '#333', padding: '6px 10px', border: '1px solid #eee', whiteSpace: 'pre-line', verticalAlign: 'middle', minWidth: 80 },
  gTdDesc: { fontSize: 11, color: '#555', padding: '6px 10px', border: '1px solid #eee', lineHeight: 1.6, verticalAlign: 'middle' },
}
