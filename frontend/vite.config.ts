import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendProxy = process.env.VITE_PROXY_BACKEND ?? 'http://127.0.0.1:8080'
const projectsProxy = process.env.VITE_PROXY_PROJECTS ?? 'http://127.0.0.1:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
    },
    proxy: {
      '/api': {
        target: backendProxy,
        changeOrigin: true,
      },
      '/projects-api': {
        target: projectsProxy,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/projects-api/, ''),
      },
    },
  },
})
