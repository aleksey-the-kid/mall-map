import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'spa-fallback',
      closeBundle() {
        if (!process.env.GITHUB_PAGES) return
        const indexPath = path.resolve('dist', 'index.html')
        const fallbackPath = path.resolve('dist', '404.html')
        fs.copyFileSync(indexPath, fallbackPath)
      },
    },
  ],
  base: process.env.GITHUB_PAGES ? '/mall-map/' : '/',
})
