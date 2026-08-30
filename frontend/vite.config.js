import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 개발 환경에서도 배포(Vercel /api rewrite)와 동일하게 same-origin 으로 동작시킨다.
// 프론트는 항상 '/api/...' 로 호출하고, 개발 서버가 이를 백엔드로 프록시한다.
// (배포에서는 vercel.json 의 rewrite 가 같은 역할)
const BACKEND = process.env.VITE_DEV_BACKEND || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
