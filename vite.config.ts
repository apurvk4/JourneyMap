import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV)
const isGhPages = process.env.GITHUB_PAGES === 'true' || (process.env.GITHUB_ACTIONS === 'true' && !isVercel)

// Decouple site URLs to prevent cross-domain links between GitHub Pages and Vercel
let rawSiteUrl = ''
if (isGhPages) {
    rawSiteUrl = process.env.GH_PAGES_URL || 'https://apurvk4.github.io/JourneyMap'
} else if (isVercel) {
    rawSiteUrl =
        process.env.VERCEL_SITE_URL ||
        process.env.SITE_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : '') ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
        'https://journeymap.vercel.app'
} else {
    rawSiteUrl = process.env.SITE_URL || 'http://localhost:5173'
}

const siteUrl = rawSiteUrl ? rawSiteUrl.replace(/\/+$/, '') : ''

export default defineConfig({
    base: isGhPages ? '/JourneyMap/' : '/',
    plugins: [
        react(),
        {
            name: 'html-transform',
            transformIndexHtml(html) {
                return html
                    .replace(/%SITE_URL%/g, siteUrl)
                    .replace(/%OG_IMAGE_URL%/g, `${siteUrl}/og-image.png`)
            },
        },
    ],
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
