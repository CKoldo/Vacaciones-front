import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    server: {
      port: 5173,
      host: true,
      strictPort: true,
    allowedHosts: [
      'localhost',
      '.ngrok-free.app'
    ],proxy: {
      '/api': {
        //backend local
        //target: 'http://localhost:5175'
        //backend supabase
        target: 'http://localhost:5175',
        changeOrigin: true,
        secure: false
      }
    }
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
