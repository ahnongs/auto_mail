import { useState, useEffect } from 'react'
import axios from 'axios'
import Login from './pages/Login'
import Home from './pages/Home'
import VacationRequest from './pages/VacationRequest'
import PaymentRequest from './pages/PaymentRequest'
import ExpenseRequest from './pages/ExpenseRequest'
import ClockFixRequest from './pages/ClockFixRequest'
import InterviewRequest from './pages/InterviewRequest'
import RepairRequest from './pages/RepairRequest'
import OnlinePaymentRequest from './pages/OnlinePaymentRequest'
import DesignRequest from './pages/DesignRequest'

const api = axios.create({ baseURL: 'http://localhost:8000', withCredentials: true })

const DEFAULT_SETTINGS = {
  managerEmail: '', ceoEmail: '', directorEmail: '', bizManagerEmail: '', dept: '',
  sigNameKo: '', sigNameEn: '', sigPosition: '', sigRole: '', sigPhone: '', sigExtra: '',
  logoImageData: '', logoImageType: '',
  bank: '', account: '', accountHolder: '',
}

function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('automail_settings') || '{}') } }
  catch { return DEFAULT_SETTINGS }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('home')
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  // 브라우저 뒤로가기 지원
  useEffect(() => {
    history.replaceState({ page: 'home' }, '')
    const onPop = (e) => setPage(e.state?.page || 'home')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (newPage) => {
    history.pushState({ page: newPage }, '')
    setPage(newPage)
  }

  const goBack = () => {
    history.back()
  }

  // 로그인 후 서버에서 계정별 설정 불러오기
  useEffect(() => {
    if (!user) return
    api.get('/settings')
      .then(res => {
        if (res.data && Object.keys(res.data).length > 0) {
          const merged = { ...DEFAULT_SETTINGS, ...res.data }
          setSettings(merged)
          localStorage.setItem('automail_settings', JSON.stringify(merged))
        }
      })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    if (settings.logoImageData) return
    fetch('/logo.png')
      .then(r => r.blob())
      .then(blob => new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result)
        reader.readAsDataURL(blob)
      }))
      .then(dataUrl => {
        const [meta, data] = dataUrl.split(',')
        const type = meta.match(/:(.*?);/)[1]
        setSettings(s => ({ ...s, logoImageData: data, logoImageType: type }))
      })
      .catch(() => {})
  }, [])

  const handleSaveSettings = (s) => {
    setSettings(s)
    localStorage.setItem('automail_settings', JSON.stringify(s))
    api.post('/settings', s).catch(() => {})
  }

  const handleLogout = () => { window.location.href = 'http://localhost:8000/auth/logout' }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #ddd', borderTop: '3px solid #667eea', borderRadius: '50%' }} />
    </div>
  )

  if (!user) return <Login />

  const pageProps = { user, settings, onBack: goBack }

  if (page === 'vacation') return <VacationRequest {...pageProps} />
  if (page === 'payment') return <PaymentRequest {...pageProps} />
  if (page === 'expense') return <ExpenseRequest {...pageProps} />
  if (page === 'clockfix') return <ClockFixRequest {...pageProps} />
  if (page === 'interview') return <InterviewRequest {...pageProps} />
  if (page === 'repair') return <RepairRequest {...pageProps} />
  if (page === 'payment2') return <OnlinePaymentRequest {...pageProps} />
  if (page === 'design') return <DesignRequest {...pageProps} />

  return (
    <Home
      user={user}
      onLogout={handleLogout}
      onNavigate={navigate}
      settings={settings}
      onSaveSettings={handleSaveSettings}
    />
  )
}
