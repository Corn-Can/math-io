import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // 告訴 Vite: 遇到 "@" 就指向 "src" 資料夾
      '@': path.resolve(__dirname, './src'),
    },
  },
})
