import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
              target: 'http://localhost:9000',
        changeOrigin: true
      }
    }
  },
  build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        input: {
          admin: resolve(__dirname, 'admin.html'),
        },
      },
    },
});
