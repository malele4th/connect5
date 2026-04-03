import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  /** 生产与开发统一子路径，便于同机部署多应用（Nginx location /web/connect5/） */
  base: '/web/connect5/',
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  server: {
    port: 8686,
    /** 允许手机等同 Wi‑Fi 设备通过局域网 IP 访问开发服务器 */
    host: true,
    proxy: {
      '/socket': {
        target: 'ws://127.0.0.1:3003',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
