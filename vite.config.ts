import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import stylex from '@stylexjs/rollup-plugin'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: path.join(rootDir, 'web'),
  plugins: [
    stylex({
      fileName: 'stylex.css',
      runtimeInjection: true,
      dev: process.env.NODE_ENV !== 'production',
      treeshakeCompensation: true,
      unstable_moduleResolution: {
        type: 'commonJS',
        rootDir,
      },
    }),
    react(),
    cloudflare({
      configPath: path.join(rootDir, 'wrangler.toml'),
      // Vite 根目录是 web/，默认会把 D1 写到 web/.wrangler。迁移命令在仓库根目录执行，两边必须共用同一份本地库。
      persistState: { path: path.join(rootDir, '.wrangler/state') },
    }),
  ],
  build: {
    outDir: path.join(rootDir, 'dist/client'),
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
