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
  managerEmail: '', ceoEmail: '', directorEmail: '', dept: '',
  sigNameKo: '', sigNameEn: '', sigPosition: '', sigPhone: '',
  logoImageData: '', logoImageType: ''
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
  }

  const handleLogout = () => { window.location.href = 'http://localhost:8000/auth/logout' }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #ddd', borderTop: '3px solid #667eea', borderRadius: '50%' }} />
    </div>
  )

  if (!user) return <Login />

  const pageProps = { user, settings, onBack: () => setPage('home') }

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
      onNavigate={setPage}
      settings={settings}
      onSaveSettings={handleSaveSettings}
    />
  )
}
