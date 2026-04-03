import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  // Tauri expects a fixed port in dev
  server: {
    port: 5173,
    strictPort: true,
  },
});
