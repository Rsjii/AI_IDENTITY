import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // loads .env, .env.local, etc.
  const apiTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:3000'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@tanstack/react-query'],
            // Large feature chunks
            'admin': [
              './src/pages/AdminPage',
              './src/pages/AdminUserPage',
            ],
            'onboarding': [
              './src/pages/OnboardingGatePage',
              './src/pages/OnboardingQuizPage',
              './src/pages/OnboardingContentPage',
              './src/pages/OnboardingPricingPage',
              './src/pages/OnboardingPlanPage',
              './src/pages/OnboardingDeployPage',
              './src/pages/OnboardingTrainingPage',
            ],
            'dashboard': [
              './src/pages/CreatorDashboardPage',
              './src/pages/EndUserDashboardPage',
            ],
            'marketplace': [
              './src/pages/MarketplacePage',
              './src/pages/MarketplaceListingPage',
              './src/pages/MarketplaceManagePage',
            ],
          },
        },
      },
      chunkSizeWarningLimit: 1000, // Increase limit to 1MB
    },
  }
})