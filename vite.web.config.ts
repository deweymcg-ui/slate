// Browser-preview config — UI development without Electron (window.slate is mocked).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src/renderer/src') }
  },
  server: { port: 5199, fs: { allow: [__dirname] } }
})
