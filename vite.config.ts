import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: {
    target: 'chrome87', // Android Automotive head units lag desktop Chrome
    cssTarget: 'chrome87',
    assetsInlineLimit: 2048,
  },
});
