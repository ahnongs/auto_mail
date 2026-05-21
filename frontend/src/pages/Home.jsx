import { useState, useEffect, useCallback } from 'react'

export default function Home({ user, onLogout, onNavigate, settings, onSaveSettings }) {
  const [showSettings, setShowSettings] = useState(false)
  const [draft, setDraft] = useState(settings)
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  const handleSave = () => { onSaveSettings(draft); setShowSettings(false) }

  // 설정 모달 열려있을 때 Ctrl+V로 로고 붙여넣기
  const handlePasteLogo = useCallback((e) => {
    if (!showSettings) return
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile()
        const reader = new FileReader()
        reader.onload = ev => {
          const [meta, data] = ev.target.result.split(',')
          set('logoImageData', data)
          set('logoImageType', meta.match(/:(.*?);/)[1])
        }
        reader.readAsDataURL(f)
        break
      }
    }
  }, [showSettings])

  useEffect(() => {
    window.addEventListener('paste', handlePasteLogo)
    return () => window.removeEventListener('paste', handlePasteLogo)
  }, [handlePasteLogo])

  const isSettingsEmpty = !settings.managerEmail || !settings.ceoEmail || !settings.directorEmail

  return (
    <div style={s.container}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: 22 }}>✉️</span>
          <span style={s.headerTitle}>사내 메일 서비스</span>
        </div>
        <div style={s.headerRight}>
          <img src={user.picture} alt={user.name} style={s.avatar} />
          <span style={s.userName}>{user.name}</span>
          <button style={s.settingsBtn} onClick={() => { setDraft(settings); setShowSettings(true) }}>⚙️ 설정</button>
          <button style={s.logoutBtn} onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.welcome}>
          <h2 style={s.welcomeTitle}>안녕하세요, {user.name}님 👋</h2>
          <p style={s.welcomeSub}>{user.email} · 어떤 메일을 보낼까요?</p>
        </div>

        {isSettingsEmpty && (
          <div style={s.banner}>
            <span>⚠️ 수신자 설정이 필요해요.</span>
            <button style={s.bannerBtn} onClick={() => { setDraft(settings); setShowSettings(true) }}>
              지금 설정하기 →
            </button>
          </div>
        )}

        <div style={s.grid}>
          {templates.map(t => (
            <button key={t.id}
              style={{ ...s.card, ...(t.ready ? {} : s.cardDisabled) }}
              onClick={() => t.ready && onNavigate(t.id)}
              disabled={!t.ready}>
              <div style={s.cardIcon}>{t.icon}</div>
              <div style={s.cardName}>{t.name}</div>
              <div style={s.cardDesc}>{t.desc}</div>
              {!t.ready && <span style={s.soon}>준비 중</span>}
            </button>
          ))}
        </div>
      </main>

      {/* 설정 모달 */}
      {showSettings && (
        <div style={s.overlay} onClick={() => setShowSettings(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>⚙️ 설정</h2>

            {/* 수신자 */}
            <div style={s.section}>
              <div style={s.sectionTitle}>수신자</div>
              <Field label="파트장 이메일" required>
                <input style={s.input} placeholder="파트장@stardoc1.com"
                  value={draft.managerEmail} onChange={e => set('managerEmail', e.target.value)} />
              </Field>
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
              <Field label="소속 부서">
                <input style={s.input} placeholder="예: 마케팅파트"
                  value={draft.dept} onChange={e => set('dept', e.target.value)} />
              </Field>
            </div>

            {/* 계좌 정보 */}
            <div style={s.section}>
              <div style={s.sectionTitle}>계좌 정보 (지출결의서 자동입력)</div>
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

            {/* 메일 서명 */}
            <div style={s.section}>
              <div style={s.sectionTitle}>메일 서명</div>
              <div style={s.sigDesc}>입력한 내용으로 공식 서명 양식이 자동 생성됩니다.</div>
              <div style={s.sigGrid}>
                <Field label="이름 (한글)">
                  <input style={s.input} placeholder="홍 길 동"
                    value={draft.sigNameKo} onChange={e => set('sigNameKo', e.target.value)} />
                </Field>
                <Field label="이름 (영문)">
                  <input style={s.input} placeholder="Gildong Hong"
                    value={draft.sigNameEn} onChange={e => set('sigNameEn', e.target.value)} />
                </Field>
              </div>
              <Field label="직위 / 파트">
                <input style={s.input} placeholder="콘텐츠제작파트 매니저"
                  value={draft.sigPosition} onChange={e => set('sigPosition', e.target.value)} />
              </Field>
              <Field label="전화번호">
                <input style={s.input} placeholder="010-0000-0000"
                  value={draft.sigPhone} onChange={e => set('sigPhone', e.target.value)} />
              </Field>
              <Field label="회사 로고 이미지">
                <div style={s.sigDesc}>파일 선택 또는 로고 이미지 Ctrl+V 붙여넣기</div>
                {draft.logoImageData ? (
                  <div>
                    <img src={`data:${draft.logoImageType};base64,${draft.logoImageData}`}
                      style={{ maxHeight: 50, display: 'block', marginBottom: 6, border: '1px solid #eee', borderRadius: 4 }} alt="로고" />
                    <button style={s.removeBtn} onClick={() => { set('logoImageData', ''); set('logoImageType', '') }}>
                      ✕ 로고 제거
                    </button>
                  </div>
                ) : (
                  <label style={s.uploadBtn}>
                    🖼️ 로고 이미지 업로드
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
              </Field>

              {/* 서명 미리보기 */}
              {(draft.sigNameKo || draft.sigPosition) && (
                <div style={s.sigPreview}>
                  <div style={s.sigPreviewLabel}>미리보기</div>
                  <div style={{ borderLeft: '3px solid #667eea', paddingLeft: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>
                      {draft.sigNameKo}
                      {draft.sigNameEn && <span style={{ fontSize: 12, fontWeight: 400, color: '#888', marginLeft: 6 }}>{draft.sigNameEn}</span>}
                    </div>
                    {draft.sigPosition && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{draft.sigPosition}</div>}
                    <div style={{ marginTop: 6, fontSize: 12, color: '#444', lineHeight: 1.6 }}>
                      {draft.sigPhone && <div>T. {draft.sigPhone}</div>}
                      <div>E. {user.email}</div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: '#aaa' }}>서울 강남구 테헤란로57길 21 2층 | 02-533-7776</div>
                    {draft.logoImageData && (
                      <img src={`data:${draft.logoImageType};base64,${draft.logoImageData}`}
                        style={{ maxHeight: 40, marginTop: 8 }} alt="로고" />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={s.modalActions}>
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
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const templates = [
  { id: 'vacation', icon: '🌴', name: '휴가신청', desc: '연차·반차·대체휴무 신청', ready: true },
  { id: 'expense', icon: '💳', name: '개인비용 지출', desc: '지출결의서 작성 및 발송', ready: true },
  { id: 'payment', icon: '💰', name: '입금요청', desc: '업체 대금 결제 요청', ready: true },
  { id: 'clockfix', icon: '🕐', name: '출퇴근 변경', desc: '플렉스 출퇴근 수정 요청', ready: true },
  { id: 'interview', icon: '💬', name: '면담신청', desc: '파트장·본부장 면담 요청', ready: true },
  { id: 'repair', icon: '🔧', name: '수리요청', desc: '비품·시설 수리 요청', ready: true },
  { id: 'payment2', icon: '🛒', name: '온라인결제', desc: '온라인 구매 결제 요청', ready: true },
  { id: 'design', icon: '🎨', name: '디자인요청', desc: '이미지 제작 요청', ready: false },
]

const s = {
  container: { minHeight: '100vh', background: '#f5f5f5' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 60, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 17, fontWeight: 700, color: '#1a1a1a' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 30, height: 30, borderRadius: '50%' },
  userName: { fontSize: 14, color: '#444' },
  settingsBtn: { padding: '6px 12px', border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff', fontSize: 13, color: '#444', cursor: 'pointer' },
  logoutBtn: { padding: '6px 12px', border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff', fontSize: 13, color: '#666', cursor: 'pointer' },
  main: { padding: '36px 28px', maxWidth: 900, margin: '0 auto' },
  welcome: { marginBottom: 20 },
  welcomeTitle: { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  welcomeSub: { fontSize: 14, color: '#888' },
  banner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff8e1', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 18px', marginBottom: 20, fontSize: 14, color: '#92400e' },
  bannerBtn: { background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 },
  card: { background: '#fff', border: '2px solid transparent', borderRadius: 14, padding: '24px 18px', textAlign: 'left', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  cardDisabled: { opacity: 0.55, cursor: 'default' },
  cardIcon: { fontSize: 32, marginBottom: 10 },
  cardName: { fontSize: 15, fontWeight: 700, marginBottom: 4, color: '#1a1a1a' },
  cardDesc: { fontSize: 12, color: '#888', lineHeight: 1.4, marginBottom: 10 },
  soon: { display: 'inline-block', padding: '2px 8px', background: '#f0f0f0', borderRadius: 20, fontSize: 11, color: '#aaa' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: 16, padding: '28px 24px', width: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#667eea', marginBottom: 12, paddingBottom: 6, borderBottom: '1.5px solid #e8e8ff' },
  sigGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  sigDesc: { fontSize: 12, color: '#aaa', marginBottom: 10 },
  sigPreview: { marginTop: 16, padding: 14, background: '#f8f8f8', borderRadius: 10 },
  sigPreviewLabel: { fontSize: 11, color: '#aaa', fontWeight: 600, marginBottom: 10 },
  input: { width: '100%', padding: '9px 12px', border: '1.5px solid #e8e8e8', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  uploadBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '2px dashed #ddd', borderRadius: 8, fontSize: 13, color: '#888', cursor: 'pointer', background: '#fafafa' },
  removeBtn: { background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '3px 10px', fontSize: 12, color: '#999', cursor: 'pointer' },
  modalActions: { display: 'flex', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, padding: '11px', border: '1.5px solid #e0e0e0', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer', color: '#666' },
  saveBtn: { flex: 2, padding: '11px', border: 'none', borderRadius: 8, background: '#667eea', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
}
