// ─────────────────────────────────────────────
// 테스트 시: TEST_MODE = true
// 운영 시:   TEST_MODE = false
// ─────────────────────────────────────────────
const TEST_MODE = true
const TEST_EMAIL = 'ahnongseo@gmail.com'

const REAL = {
  request:    'request@stardoc1.com',
  clockinout: 'clockinout@stardoc1.com',
  interview:  'interview@stardoc1.com',
  design:     'Design@stardoc1.com',
  leave:      'leave@stardoc1.com',
}

export const R = TEST_MODE
  ? Object.fromEntries(Object.keys(REAL).map(k => [k, TEST_EMAIL]))
  : REAL
