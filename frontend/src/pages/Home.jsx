import { useState, useEffect, useRef } from 'react'
import { getScheduledMails, cancelScheduledMail } from '../api'
import { c, mono } from '../styles/pageStyles'

function formatSendAt(iso) {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${mm}월 ${dd}일 ${hh}:${min}`
}

const formatPhone = (v) => {
  const n = v.replace(/\D/g, '').slice(0, 11)
  if (n.startsWith('02')) {
    if (n.length <= 2) return n
    if (n.length <= 5) return n.slice(0, 2) + '-' + n.slice(2)
    if (n.length <= 9) return n.slice(0, 2) + '-' + n.slice(2, 5) + '-' + n.slice(5)
    return n.slice(0, 2) + '-' + n.slice(2, 6) + '-' + n.slice(6, 10)
  }
  if (n.length <= 3) return n
  if (n.length <= 7) return n.slice(0, 3) + '-' + n.slice(3)
  return n.slice(0, 3) + '-' + n.slice(3, 7) + '-' + n.slice(7, 11)
}

const trimPart = (v) => v.replace(/\s*파트\s*$/, '').trim()

const formatNameKo = (v) => {
  const n = v.replace(/\s/g, '')
  return n.split('').join(' ')
}

// ── 라인 아이콘 (Phosphor 계열, stroke 통일) ──
const iconProps = { width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
const templateIcons = {
  vacation: <svg {...iconProps}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  expense: <svg {...iconProps}><rect x="2.5" y="5.5" width="19" height="13" rx="1.5" /><path d="M2.5 9.5h19M6 14.5h4" /></svg>,
  payment: <svg {...iconProps}><circle cx="9" cy="9" r="6.5" /><path d="M14.5 5.5a6.5 6.5 0 010 13M9 6v6M6.5 8h5" /></svg>,
  clockfix: <svg {...iconProps}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  interview: <svg {...iconProps}><path d="M4 4.5h16v11H8l-4 4z" /></svg>,
  repair: <svg {...iconProps}><path d="M15 6.5a3.5 3.5 0 00-4.7 4.7l-6 6L6.8 19.4l6-6A3.5 3.5 0 0017.5 9L15 11.5 12.5 9z" /></svg>,
  payment2: <svg {...iconProps}><path d="M3 4h2l2 12h10l2-8H6" /><circle cx="9" cy="19.5" r="1.3" /><circle cx="16" cy="19.5" r="1.3" /></svg>,
  design: <svg {...iconProps}><path d="M15.5 4.5l4 4L8 20l-4.5.5L4 16z" /><path d="M13 7l4 4" /></svg>,
}

export default function Home({ user, onLogout, onNavigate, settings, onSaveSettings, testMode, testEmail, onToggleTestMode, onSetTestEmail }) {
  const [showSettings, setShowSettings] = useState(false)
  const [settingsHint, setSettingsHint] = useState('')
  const [draft, setDraft] = useState(settings)
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  const [scheduledMails, setScheduledMails] = useState([])
  useEffect(() => {
    getScheduledMails().then(r => setScheduledMails(r.data)).catch(() => {})
  }, [])

  // 설정 모달: Esc로 닫기 + 포커스 트랩 + 열릴 때 첫 입력에 포커스
  const modalRef = useRef(null)
  useEffect(() => {
    if (!showSettings) return
    const el = modalRef.current
    const getFocusable = () => el
      ? Array.from(el.querySelectorAll('input, select, textarea, button, [tabindex]:not([tabindex="-1"])'))
          .filter(n => !n.disabled && n.offsetParent !== null)
      : []
    getFocusable()[0]?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { setShowSettings(false); return }
      if (e.key === 'Tab') {
        const items = getFocusable()
        if (!items.length) return
        const first = items[0], last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showSettings])
  const [confirmCancelId, setConfirmCancelId] = useState(null)
  const handleCancelSchedule = (id) => setConfirmCancelId(id)
  const handleConfirmCancel = async () => {
    await cancelScheduledMail(confirmCancelId)
    setScheduledMails(prev => prev.filter(m => m.id !== confirmCancelId))
    setConfirmCancelId(null)
  }
  useEffect(() => {
    if (!confirmCancelId) return
    const onKey = (e) => { if (e.key === 'Escape') setConfirmCancelId(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmCancelId])

  const handleSave = () => {
    const normalized = {
      ...draft,
      dept: draft.dept ? trimPart(draft.dept) + ' 파트' : '',
      sigPosition: trimPart(draft.sigPosition || ''),
      managerEmail: draft.sigRole === '파트장' ? '' : draft.managerEmail,
    }
    onSaveSettings(normalized)
    setShowSettings(false)
    setSettingsHint('')
  }

  const isMissingRecipients = testMode
    ? !testEmail
    : (settings.sigRole !== '파트장' && !settings.managerEmail) || !settings.ceoEmail || !settings.directorEmail
  const isMissingSignature = !settings.sigNameKo
  const isMissingAccount = !settings.bank || !settings.accountHolder || !settings.account

  const handleCardClick = (t) => {
    if (!t.ready) return
    if (isMissingRecipients || isMissingSignature) {
      const missing = []
      if (isMissingRecipients) missing.push('수신자')
      if (isMissingSignature) missing.push('메일 서명')
      setSettingsHint(`${missing.join(', ')} 정보를 먼저 입력해주세요.`)
      setDraft(settings)
      setShowSettings(true)
      return
    }
    if (t.id === 'expense' && isMissingAccount) {
      setSettingsHint('개인비용지출을 사용하려면 계좌 정보를 먼저 입력해주세요.')
      setDraft(settings)
      setShowSettings(true)
      return
    }
    onNavigate(t.id)
  }

  const isSettingsEmpty = isMissingRecipients || isMissingSignature
  const visibleTemplates = templates.filter(t => t.ready)

  return (
    <div style={s.container}>
      <header style={s.header} className="r-home-header">
        <div style={s.headerLeft}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: c.accent }}>
            <rect x="2.5" y="4.5" width="19" height="15" rx="1.5" /><path d="M3 6l9 6 9-6" />
          </svg>
          <span style={s.headerTitle}>사내 메일 서비스</span>
        </div>
        <div style={s.headerRight}>
          <img src={user.picture} alt={user.name} style={s.avatar} />
          <span style={s.userName}>{user.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }} onClick={onToggleTestMode}>
            <span style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: testMode ? c.accent : c.faint, fontWeight: 600, userSelect: 'none' }}>테스트</span>
            <div style={{ width: 34, height: 18, borderRadius: 9, background: testMode ? c.accent : c.lineStrong, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: testMode ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
            </div>
          </div>
          <button style={s.historyBtn} onClick={() => onNavigate('history')}>보낸 메일</button>
          <button style={s.settingsBtn} onClick={() => { setDraft(settings); setShowSettings(true) }}>설정</button>
          <button style={s.logoutBtn} onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <main style={s.main} className="r-main">
        <div style={s.welcome}>
          <div style={s.eyebrow}>STARDOC · 사내 문서 발송</div>
          <h2 style={s.welcomeTitle}>어떤 메일을 보낼까요?</h2>
          <p style={s.welcomeSub}>{user.name}님 · <span style={s.welcomeEmail}>{user.email}</span></p>
        </div>

        {isSettingsEmpty && (
          <div style={s.banner}>
            <span style={s.bannerText}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M12 3l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" />
              </svg>
              {isMissingRecipients && isMissingSignature ? '수신자 · 메일 서명' : isMissingRecipients ? '수신자' : '메일 서명'} 설정이 필요해요.
            </span>
            <button style={s.bannerBtn} onClick={() => { setSettingsHint(''); setDraft(settings); setShowSettings(true) }}>
              지금 설정하기 →
            </button>
          </div>
        )}

        <div style={s.sectionLabel}>
          <span style={s.sectionLabelTitle}>메일 양식</span>
          <span style={s.sectionLabelCount}>{String(visibleTemplates.length).padStart(2, '0')}</span>
        </div>

        <div style={s.grid} className="r-grid">
          {visibleTemplates.map((t, i) => (
            <button key={t.id}
              style={{ ...s.card, ...(i === 0 ? s.cardFeature : {}) }}
              onClick={() => handleCardClick(t)}>
              <div style={{ ...s.cardIcon, ...(i === 0 ? s.cardIconFeature : {}) }}>{templateIcons[t.id]}</div>
              <div style={s.cardName}>{t.name}</div>
              <div style={s.cardDesc}>{t.desc}</div>
            </button>
          ))}
        </div>

        {scheduledMails.length > 0 && (
          <>
            <div style={s.sectionLabel}>
              <span style={s.sectionLabelTitle}>발송 예약 내역</span>
              <span style={s.sectionLabelCount}>{String(scheduledMails.length).padStart(2, '0')}</span>
            </div>
            <div style={s.scheduleSection}>
              {scheduledMails.map(mail => (
                <div key={mail.id} style={s.scheduleItem}>
                  <div style={s.scheduleDate}>{formatSendAt(mail.send_at)}</div>
                  <div style={s.scheduleInfo}>
                    <div style={s.scheduleSubject}><span style={s.statusDot} />{mail.subject}</div>
                    <div style={s.scheduleTo}>→ {mail.to}</div>
                  </div>
                  <button style={s.scheduleCancelBtn} onClick={() => handleCancelSchedule(mail.id)}>
                    취소
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

      </main>

      {/* 예약 취소 확인 모달 */}
      {confirmCancelId && (
        <div style={s.overlay}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', width: 300, textAlign: 'center', border: `1px solid ${c.line}`, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: c.inkStrong }}>예약 취소</div>
            <div style={{ fontSize: 14, color: c.muted, marginBottom: 24 }}>예약을 취소하시겠습니까?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmCancelId(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 6, border: `1px solid ${c.line}`, background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: c.muted }}>
                아니오
              </button>
              <button onClick={handleConfirmCancel}
                style={{ flex: 1, padding: '10px 0', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                예
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 설정 모달 */}
      {showSettings && (
        <div style={s.overlay} onClick={() => setShowSettings(false)}>
          <div ref={modalRef} style={s.modal} className="r-modal" onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>설정</h2>
            {settingsHint && (
              <div style={{ background: c.warnBg, border: `1px solid ${c.warnLine}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: c.warnInk }}>
                {settingsHint}
              </div>
            )}

            {/* 1. 개인정보 */}
            <div style={s.section}>
              <div style={s.sectionTitle}>개인정보</div>
              <div style={s.sigGrid}>
                <Field label="이름 (한글)" required>
                  <input style={s.input} placeholder="홍 길 동"
                    value={draft.sigNameKo}
                    onChange={e => set('sigNameKo', e.target.value)}
                    onBlur={e => set('sigNameKo', formatNameKo(e.target.value))} />
                </Field>
                <Field label="이름 (영문)">
                  <input style={s.input} placeholder="Gildong Hong"
                    value={draft.sigNameEn} onChange={e => set('sigNameEn', e.target.value)} />
                </Field>
              </div>
              <Field label="소속 부서">
                <select style={s.input} value={draft.sigPosition || ''} onChange={e => {
                  const v = e.target.value
                  set('sigPosition', v)
                  set('dept', v ? v + ' 파트' : '')
                }}>
                  <option value="">선택</option>
                  <option value="마케팅기획디자인개발">마케팅기획디자인개발 파트</option>
                </select>
              </Field>
              <Field label="직책">
                <div style={{ display: 'flex', gap: 8 }}>
                  {['매니저', 'PM', '파트장'].map(r => (
                    <button key={r} type="button"
                      style={{ padding: '7px 16px', border: `1px solid ${draft.sigRole === r ? c.accent : c.line}`, borderRadius: 6, background: draft.sigRole === r ? c.accentSoft : '#fff', color: draft.sigRole === r ? c.accent : c.muted, fontSize: 13, fontWeight: draft.sigRole === r ? 700 : 400, cursor: 'pointer' }}
                      onClick={() => set('sigRole', draft.sigRole === r ? '' : r)}>{r}</button>
                  ))}
                </div>
              </Field>
              <Field label="전화번호">
                <input style={s.input} placeholder="010-0000-0000"
                  value={draft.sigPhone} onChange={e => set('sigPhone', formatPhone(e.target.value))} />
              </Field>
            </div>

            {/* 2. 계좌 정보 */}
            <div style={s.section}>
              <div style={s.sectionTitle}>계좌 정보 <span style={{ fontSize: 11, fontWeight: 400, color: c.faint }}>지출결의서 자동입력</span></div>
              <div style={s.sigGrid}>
                <Field label="은행명">
                  <input style={s.input} placeholder="예: 국민은행"
                    value={draft.bank} onChange={e => set('bank', e.target.value)} />
                </Field>
                <Field label="예금주">
                  <input style={s.input} placeholder="예금주 이름"
                    value={draft.accountHolder} onChange={e => set('accountHolder', e.target.value)} />
                </Field>
              </div>
              <Field label="계좌번호">
                <input style={s.input} placeholder="000-0000-0000-00"
                  value={draft.account} onChange={e => set('account', e.target.value)} />
              </Field>
            </div>

            {/* 3. 수신자 */}
            <div style={s.section}>
              <div style={s.sectionTitle}>수신자</div>
              {testMode ? (
                <>
                  <div style={{ background: c.warnBg, border: `1px solid ${c.warnLine}`, borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: c.warnInk }}>
                    테스트 모드 — 모든 메일이 아래 주소로만 발송됩니다
                  </div>
                  <Field label="테스트 수신 이메일" required>
                    <input style={s.input} placeholder="test@example.com"
                      value={testEmail} onChange={e => onSetTestEmail(e.target.value)} />
                  </Field>
                </>
              ) : (
                <>
                  {draft.sigRole !== '파트장' && (
                    <Field label="파트장 이메일" required>
                      <input style={s.input} placeholder="파트장@stardoc1.com"
                        value={draft.managerEmail} onChange={e => set('managerEmail', e.target.value)} />
                    </Field>
                  )}
                  <Field label="대표 이메일" required>
                    <input style={s.input} placeholder="대표@stardoc1.com"
                      value={draft.ceoEmail} onChange={e => set('ceoEmail', e.target.value)} />
                  </Field>
                  <Field label="본부장 이메일" required>
                    <input style={s.input} placeholder="본부장@stardoc1.com"
                      value={draft.directorEmail} onChange={e => set('directorEmail', e.target.value)} />
                  </Field>
                  <Field label="경영관리 파트장 이메일">
                    <input style={s.input} placeholder="경영관리파트장@stardoc1.com"
                      value={draft.bizManagerEmail} onChange={e => set('bizManagerEmail', e.target.value)} />
                  </Field>
                </>
              )}
            </div>

            {/* 4. 회사 로고 */}
            <div style={s.section}>
              <div style={s.sectionTitle}>회사 로고 이미지</div>
              {draft.logoImageData ? (
                <div>
                  <img src={`data:${draft.logoImageType};base64,${draft.logoImageData}`}
                    style={{ maxHeight: 50, display: 'block', marginBottom: 8, border: `1px solid ${c.line}`, borderRadius: 4 }} alt="로고" />
                  <button style={s.removeBtn} onClick={() => { set('logoImageData', ''); set('logoImageType', '') }}>
                    ✕ 로고 제거
                  </button>
                </div>
              ) : (
                <label style={s.uploadBtn}>
                  이미지 업로드
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files[0]
                      if (!f) return
                      const reader = new FileReader()
                      reader.onload = ev => {
                        const [meta, data] = ev.target.result.split(',')
                        set('logoImageData', data)
                        set('logoImageType', meta.match(/:(.*?);/)[1])
                      }
                      reader.readAsDataURL(f)
                    }} />
                </label>
              )}
            </div>

            {/* 5. 메일 서명 미리보기 */}
            {(draft.sigNameKo || draft.sigPosition) && (
              <div style={s.section}>
                <div style={s.sectionTitle}>메일 서명 미리보기</div>
                <div style={s.sigPreview}>
                  <div style={{ fontFamily: "'Noto Sans',sans-serif", lineHeight: 1.2, color: '#000' }}>
                    <p style={{ margin: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{draft.sigNameKo}</span>
                      {draft.sigNameEn && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6 }}>{draft.sigNameEn}</span>}
                    </p>
                    {(draft.sigPosition || draft.sigRole) && (
                      <p style={{ margin: 0, fontSize: 13 }}>
                        {[draft.sigPosition, draft.sigRole ? `파트 ${draft.sigRole}` : ''].filter(Boolean).join(' ')}
                      </p>
                    )}
                    <br />
                    {draft.sigPhone && <p style={{ margin: 0, fontSize: 13 }}>T. {draft.sigPhone}</p>}
                    <p style={{ margin: 0, fontSize: 13 }}>E. {user.email}</p>
                    <br />
                    <p style={{ margin: 0, fontSize: 11, color: '#333' }}>서울 강남구 테헤란로57길 21 2층 | 02-533-7776</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#333' }}>james@eszett.co.kr | https://www.startdoctor.co.kr</p>
                    <br />
                    {draft.logoImageData && (
                      <img src={`data:${draft.logoImageType};base64,${draft.logoImageData}`}
                        style={{ height: 20, width: 'auto', display: 'block' }} alt="로고" />
                    )}
                  </div>
                </div>
              </div>
            )}

            <div style={s.modalActions} className="r-modal-actions">
              <button style={s.cancelBtn} onClick={() => setShowSettings(false)}>취소</button>
              <button style={s.saveBtn} onClick={handleSave}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.muted, marginBottom: 5 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const templates = [
  { id: 'vacation', name: '휴가신청', desc: '연차·반차·대체휴무 신청', ready: true },
  { id: 'expense', name: '개인비용 지출', desc: '지출결의서 작성 및 발송', ready: true },
  { id: 'payment', name: '입금요청', desc: '업체 대금 결제 요청', ready: true },
  { id: 'clockfix', name: '출퇴근 변경', desc: '플렉스 출퇴근 수정 요청', ready: true },
  { id: 'interview', name: '면담신청', desc: '파트장·본부장 면담 요청', ready: true },
  { id: 'repair', name: '수리요청', desc: '비품·시설 수리 요청', ready: true },
  { id: 'payment2', name: '온라인결제', desc: '온라인 구매 결제 요청', ready: true },
  { id: 'design', name: '디자인요청', desc: '이미지 제작 요청', ready: false },
]

const s = {
  container: { minHeight: '100vh', background: c.canvas },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 60, background: c.surface, borderBottom: `1px solid ${c.line}` },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 14, fontWeight: 600, color: c.inkStrong, letterSpacing: '-0.01em' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 28, height: 28, borderRadius: '50%', border: `1px solid ${c.line}` },
  userName: { fontSize: 13, color: c.ink },
  historyBtn: { padding: '6px 12px', border: `1px solid ${c.line}`, borderRadius: 6, background: c.surface, fontSize: 13, color: c.accent, cursor: 'pointer', fontWeight: 600 },
  settingsBtn: { padding: '6px 12px', border: `1px solid ${c.line}`, borderRadius: 6, background: c.surface, fontSize: 13, color: c.ink, cursor: 'pointer' },
  logoutBtn: { padding: '6px 12px', border: `1px solid ${c.line}`, borderRadius: 6, background: c.surface, fontSize: 13, color: c.muted, cursor: 'pointer' },
  main: { padding: '48px 28px 64px', maxWidth: 960, margin: '0 auto' },
  welcome: { marginBottom: 36 },
  eyebrow: { fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.faint, marginBottom: 12 },
  welcomeTitle: { fontSize: 34, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.12, color: c.inkStrong, marginBottom: 8 },
  welcomeSub: { fontSize: 14, color: c.muted },
  welcomeEmail: { fontFamily: mono, fontSize: 13, color: c.ink },
  banner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: c.warnBg, border: `1px solid ${c.warnLine}`, borderRadius: 8, padding: '14px 18px', marginBottom: 36, fontSize: 14, color: c.warnInk },
  bannerText: { display: 'flex', alignItems: 'center', gap: 10 },
  bannerBtn: { background: c.warnInk, color: c.warnBg, border: 'none', borderRadius: 5, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  sectionLabel: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18, marginTop: 44 },
  sectionLabelTitle: { fontSize: 13, fontWeight: 600, color: c.inkStrong },
  sectionLabelCount: { fontFamily: mono, fontSize: 11, color: c.faint },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  card: { background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, padding: '22px 20px 20px', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column' },
  cardFeature: { gridColumn: 'span 2' },
  cardIcon: { width: 34, height: 34, borderRadius: 7, marginBottom: 16, display: 'grid', placeItems: 'center', color: c.inkStrong, background: c.surface2, border: `1px solid ${c.line}` },
  cardIconFeature: { background: c.accentSoft, borderColor: c.accentLine, color: c.accent },
  cardName: { fontSize: 14.5, fontWeight: 600, color: c.inkStrong, marginBottom: 4, letterSpacing: '-0.01em' },
  cardDesc: { fontSize: 12, color: c.muted, lineHeight: 1.45 },
  scheduleSection: { background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, overflow: 'hidden' },
  scheduleItem: { display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderTop: `1px solid ${c.line}` },
  scheduleDate: { fontFamily: mono, fontSize: 12, fontWeight: 500, color: c.accent, minWidth: 108, flexShrink: 0 },
  scheduleInfo: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  scheduleSubject: { fontSize: 13.5, color: c.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  scheduleTo: { fontFamily: mono, fontSize: 11, color: c.faint, marginTop: 2 },
  statusDot: { display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: c.accent, marginRight: 7, verticalAlign: 'middle' },
  scheduleCancelBtn: { background: c.surface, color: c.muted, border: `1px solid ${c.line}`, borderRadius: 5, padding: '6px 14px', fontSize: 12, cursor: 'pointer', flexShrink: 0 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: c.surface, borderRadius: 12, padding: '28px 24px', width: 460, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${c.line}`, boxShadow: '0 8px 40px rgba(0,0,0,0.1)' },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 20, color: c.inkStrong },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: c.inkStrong, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${c.line}` },
  sigGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  sigPreview: { marginTop: 16, padding: 14, background: c.surface2, border: `1px solid ${c.line}`, borderRadius: 8 },
  input: { width: '100%', padding: '9px 12px', border: `1px solid ${c.line}`, borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: c.surface, color: c.ink },
  uploadBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: `1px dashed ${c.lineStrong}`, borderRadius: 6, fontSize: 13, color: c.muted, cursor: 'pointer', background: c.surface2 },
  removeBtn: { background: 'none', border: `1px solid ${c.line}`, borderRadius: 6, padding: '3px 10px', fontSize: 12, color: c.muted, cursor: 'pointer' },
  modalActions: { display: 'flex', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, padding: '11px', border: `1px solid ${c.line}`, borderRadius: 6, background: c.surface, fontSize: 14, cursor: 'pointer', color: c.muted },
  saveBtn: { flex: 2, padding: '11px', border: 'none', borderRadius: 6, background: c.accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
}
