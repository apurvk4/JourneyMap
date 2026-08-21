import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const isGithubActions = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
    base: isGithubActions ? '/JourneyMap/' : '/',
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/setupTests.ts'],
        exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
        globals: true,
    },
    server: {
        port: 5173,
    },
    build: {
        target: 'es2021',
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-maplibre': ['maplibre-gl'],
                },
            },
        },
    },
})
