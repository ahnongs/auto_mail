import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({ baseURL: API_BASE, withCredentials: true })

// 테스트 모드일 때 to/cc를 testEmail로 교체
export function sendMail(params, settings) {
  if (settings?.testMode && settings?.testEmail) {
    return api.post('/mail/send', { ...params, to: settings.testEmail, cc: '' })
  }
  return api.post('/mail/send', params)
}

export const getScheduledMails = () => api.get('/mail/scheduled')
export const cancelScheduledMail = (id) => api.delete(`/mail/scheduled/${id}`)
