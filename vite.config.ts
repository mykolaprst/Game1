import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base so the build works from any folder (GitHub Pages, a Capacitor shell, file hosting).
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
