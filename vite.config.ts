import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'progress-tracker'
  const baseFromEnv = process.env.VITE_BASE?.trim()
  const base = baseFromEnv ? baseFromEnv : mode === 'production' ? `/${repoName}/` : '/'

  return {
    base,
    plugins: [react()],
    build: {
      outDir: 'docs',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1500,
    },
  }
})
