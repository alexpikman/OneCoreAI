import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const designerRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: designerRoot,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(designerRoot, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(designerRoot, 'dist-designer'),
    emptyOutDir: true,
  },
});
