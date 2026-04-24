import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3010,
    proxy: {
      // Forward /api/* to the FastAPI backend
      '/api': 'http://localhost:8010',
    },
  },
})
