import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({ baseURL: API_BASE, withCredentials: true })

// ─────────────────────────────────────────────────────────────
// 테스트 모드 안전장치
// 테스트 중 실제 수신자(대표/파트장/본부장 등)에게 실수로 발송되는 것을 막는다.
//  1) 테스트 모드면 to → 테스트 이메일, cc → 완전 삭제
//  2) 테스트 이메일이 유효하지 않으면 조용히 실제 발송하지 않고 '에러를 던진다'
//     (기존: testEmail 이 비면 가드가 깨져 실제 수신자에게 나갈 수 있었음)
//  3) testMode/testEmail 을 서버에도 함께 보내 백엔드가 2차로 강제하게 한다
// ─────────────────────────────────────────────────────────────
function applyTestMode(params, settings) {
  const testMode = !!settings?.testMode
  const testEmail = (settings?.testEmail || '').trim()
  if (!testMode) {
    return { ...params, testMode: false, testEmail: '' }
  }
  if (!testEmail.includes('@')) {
    throw new Error('테스트 모드입니다. 설정에서 테스트 수신 이메일을 먼저 입력해주세요.')
  }
  return { ...params, to: testEmail, cc: '', testMode: true, testEmail }
}

export function sendMail(params, settings) {
  let payload
  try {
    payload = applyTestMode(params, settings)
  } catch (e) {
    return Promise.reject(e)
  }
  return api.post('/mail/send', payload)
}

export function scheduleMail(params, settings) {
  let payload
  try {
    payload = applyTestMode(params, settings)
  } catch (e) {
    return Promise.reject(e)
  }
  return api.post('/mail/schedule', payload)
}

export const getScheduledMails = () => api.get('/mail/scheduled')
export const cancelScheduledMail = (id) => api.delete(`/mail/scheduled/${id}`)
export const getMailHistory = () => api.get('/mail/history')
