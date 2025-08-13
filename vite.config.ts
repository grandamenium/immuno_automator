import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  esbuild: {
    jsx: 'automatic',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});


