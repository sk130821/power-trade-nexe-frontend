import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:5000'

const proxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
  },
  '/uploads': {
    target: apiTarget,
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy,
  },
  // `npm run preview` also needs proxy — otherwise /api hits the static server and returns 404
  preview: {
    port: 3000,
    strictPort: true,
    proxy,
  },
})
