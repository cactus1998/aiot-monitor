import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Relative base + hash routing: the build works from any sub-path (GitHub Pages, IIS virtual dir).
  base: './',
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: `http://127.0.0.1:${process.env.API_PORT ?? 3100}`, changeOrigin: true },
    },
  },
  build: {
    // ECharts is already registered on demand (see components/charts/echarts.ts) and split
    // into its own chunk (~620 kB raw, ~210 kB gzip); raise the warning limit to match.
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender'))
            return 'echarts'
          if (id.includes('node_modules/zod')) return 'zod'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
})
