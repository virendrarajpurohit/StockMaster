import './server/loadEnv.js';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = process.env.PORT || 10000;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true
      }
    }
  }
});
