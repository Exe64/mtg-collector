import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // En dev, proxy /api vers le backend pour rester sur la même origine (#2)
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
